import { OpenAI } from "openai";
import { AiAgent, Task, InsertTask, Company, Contact, AgentExecution, InsertAgentExecution, AgentMetric } from "@shared/schema";
import { storage } from "../storage";
import { emailDeliveryService } from "./emailDelivery";
import { contentGenerationService } from "./contentGeneration";

// Initialize OpenAI client if API key is available
let openaiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Job queue for background processing
interface AgentJob {
  id: string;
  agentId: string;
  taskType: string;
  targetId?: string;
  context: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class AgentJobQueue {
  private jobs: Map<string, AgentJob> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  
  async start() {
    if (this.processingInterval) return;
    
    // Load incomplete jobs from database on startup
    try {
      const incompleteJobs = await storage.getAgentExecutions({
        status: 'pending'
      });
      
      for (const execution of incompleteJobs) {
        // Mark old stuck jobs as failed
        const ageMs = Date.now() - new Date(execution.createdAt).getTime();
        if (ageMs > 3600000) { // 1 hour
          await storage.updateAgentExecution(execution.id, {
            status: 'failed',
            error: 'Job timed out',
            completedAt: new Date().toISOString()
          });
        } else {
          // Re-add to in-memory queue
          this.jobs.set(execution.id, {
            id: execution.id,
            agentId: execution.agentId,
            taskType: execution.taskType,
            targetId: execution.targetId || undefined,
            context: execution.context as Record<string, any>,
            status: 'pending',
            createdAt: new Date(execution.createdAt)
          });
        }
      }
    } catch (error) {
      console.error("[AgentExecutor] Failed to load incomplete jobs:", error);
    }
    
    // Process jobs every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 5000);
    
    console.log("[AgentExecutor] Job queue started");
  }
  
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log("[AgentExecutor] Job queue stopped");
  }
  
  async addJob(agentId: string, taskType: string, context: Record<string, any>, targetId?: string, createdBy: string = 'system'): Promise<string> {
    // Create database record first
    const execution: InsertAgentExecution = {
      agentId,
      taskType,
      targetId,
      context,
      status: 'pending',
      createdBy
    };
    
    const created = await storage.createAgentExecution(execution);
    
    // Add to in-memory queue
    const job: AgentJob = {
      id: created.id,
      agentId,
      taskType,
      targetId,
      context,
      status: 'pending',
      createdAt: new Date(created.createdAt)
    };
    
    this.jobs.set(created.id, job);
    console.log(`[AgentExecutor] Job ${created.id} added for agent ${agentId}`);
    return created.id;
  }
  
  getJob(jobId: string): AgentJob | undefined {
    return this.jobs.get(jobId);
  }
  
  async processNextJob() {
    const pendingJob = Array.from(this.jobs.values()).find(j => j.status === 'pending');
    if (!pendingJob) return;
    
    pendingJob.status = 'processing';
    pendingJob.startedAt = new Date();
    
    // Update database to mark as processing
    try {
      await storage.updateAgentExecution(pendingJob.id, {
        status: 'processing',
        startedAt: pendingJob.startedAt.toISOString()
      });
    } catch (error) {
      console.error(`[AgentExecutor] Failed to update job ${pendingJob.id} to processing:`, error);
    }
    
    try {
      const result = await executeAgentTask(pendingJob);
      pendingJob.status = 'completed';
      pendingJob.result = result;
      pendingJob.completedAt = new Date();
      const executionTimeMs = pendingJob.completedAt.getTime() - pendingJob.startedAt.getTime();
      
      // Update database with completion
      await storage.updateAgentExecution(pendingJob.id, {
        status: 'completed',
        result,
        completedAt: pendingJob.completedAt.toISOString(),
        executionTimeMs
      });
      
      // Update agent metrics
      await updateAgentMetrics(pendingJob.agentId, true, executionTimeMs, pendingJob.taskType);
      
      console.log(`[AgentExecutor] Job ${pendingJob.id} completed successfully`);
    } catch (error) {
      pendingJob.status = 'failed';
      pendingJob.error = error instanceof Error ? error.message : 'Unknown error';
      pendingJob.completedAt = new Date();
      
      // Update database with failure
      await storage.updateAgentExecution(pendingJob.id, {
        status: 'failed',
        error: pendingJob.error,
        completedAt: pendingJob.completedAt.toISOString()
      });
      
      // Update agent metrics
      await updateAgentMetrics(pendingJob.agentId, false, undefined, pendingJob.taskType);
      
      console.error(`[AgentExecutor] Job ${pendingJob.id} failed:`, error);
    }
    
    // Clean up old completed/failed jobs after 1 hour
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt.getTime() < oneHourAgo) {
        this.jobs.delete(id);
      }
    }
  }
  
  getQueueStatus() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length
    };
  }
}

// Global job queue instance
const jobQueue = new AgentJobQueue();

// Execute agent task based on type
async function executeAgentTask(job: AgentJob): Promise<any> {
  const agent = await storage.getAiAgent(job.agentId);
  if (!agent) throw new Error("Agent not found");
  
  switch (job.taskType) {
    case 'find_leads':
      return await executeFindLeadsTask(agent, job.context);
    
    case 'enrich_data':
      return await executeEnrichDataTask(agent, job.context, job.targetId);
    
    case 'compose_email':
      return await executeComposeEmailTask(agent, job.context, job.targetId);
    
    case 'score_leads':
      return await executeScoreLeadsTask(agent, job.context);
    
    case 'schedule_followup':
      return await executeScheduleFollowupTask(agent, job.context, job.targetId);
    
    case 'analyze_engagement':
      return await executeAnalyzeEngagementTask(agent, job.context);
    
    default:
      throw new Error(`Unknown task type: ${job.taskType}`);
  }
}

// Find leads based on criteria
async function executeFindLeadsTask(agent: AiAgent, context: Record<string, any>) {
  const { industry, companySize, location, technologies } = context;
  
  // Query companies matching criteria
  const companies = await storage.getCompanies({
    limit: 50
  });
  
  // Filter based on criteria (in production, this would be a proper DB query)
  const matches = companies.filter(company => {
    if (industry && company.industry !== industry) return false;
    if (companySize && !matchCompanySize(company.employeeCount, companySize)) return false;
    // Add more filtering logic as needed
    return true;
  });
  
  // Use AI to rank and score if available
  if (openaiClient && matches.length > 0) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a lead qualification expert. Rank the provided companies by potential value and fit. Return a JSON array of company IDs in order of priority."
          },
          {
            role: "user",
            content: JSON.stringify({
              criteria: context,
              companies: matches.slice(0, 20).map(c => ({
                id: c.id,
                name: c.name,
                industry: c.industry,
                size: c.employeeCount,
                description: c.description
              }))
            })
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });
      
      const ranking = JSON.parse(response.choices[0].message.content || "{}");
      if (ranking.companyIds) {
        const rankedMatches = ranking.companyIds
          .map((id: string) => matches.find(c => c.id === id))
          .filter(Boolean);
        return { leads: rankedMatches, totalFound: rankedMatches.length };
      }
    } catch (error) {
      console.error("AI ranking failed, using default order:", error);
    }
  }
  
  return { leads: matches.slice(0, 10), totalFound: matches.length };
}

// Enrich contact or company data
async function executeEnrichDataTask(agent: AiAgent, context: Record<string, any>, targetId?: string) {
  if (!targetId) throw new Error("Target ID required for enrichment");
  
  const { targetType = 'contact' } = context;
  
  if (targetType === 'contact') {
    const contact = await storage.getContact(targetId);
    if (!contact) throw new Error("Contact not found");
    
    // Simulate enrichment (in production, would call external APIs)
    const enrichedData = {
      socialProfiles: {
        linkedin: contact.linkedinUrl || `https://linkedin.com/in/${contact.firstName}-${contact.lastName}`,
        twitter: `https://twitter.com/${contact.firstName}${contact.lastName}`
      },
      jobHistory: [
        { company: contact.companyId, title: contact.title, current: true }
      ],
      skills: generateSkills(contact.title),
      interests: generateInterests(contact.title)
    };
    
    // Update contact with enriched data
    await storage.updateContact(targetId, {
      metadata: enrichedData
    });
    
    return enrichedData;
  } else {
    const company = await storage.getCompany(targetId);
    if (!company) throw new Error("Company not found");
    
    // Simulate enrichment
    const enrichedData = {
      technologies: generateTechStack(company.industry),
      fundingHistory: generateFundingHistory(company.employeeCount),
      competitors: [`${company.industry} Corp`, `${company.industry} Solutions`],
      recentNews: [`${company.name} expands operations`, `${company.name} launches new product`]
    };
    
    // Update company with enriched data
    await storage.updateCompany(targetId, {
      metadata: enrichedData
    });
    
    return enrichedData;
  }
}

// Compose personalized email
async function executeComposeEmailTask(agent: AiAgent, context: Record<string, any>, targetId?: string) {
  if (!targetId) throw new Error("Contact ID required for email composition");
  
  const contact = await storage.getContact(targetId);
  if (!contact) throw new Error("Contact not found");
  
  const { campaign, template, tone = 'professional' } = context;
  
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert email copywriter. Write a personalized ${tone} email for a B2B sales context. Return JSON with 'subject' and 'body' fields.`
          },
          {
            role: "user",
            content: JSON.stringify({
              recipient: {
                name: `${contact.firstName} ${contact.lastName}`,
                title: contact.title,
                company: contact.companyId
              },
              campaign,
              template,
              tone
            })
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000
      });
      
      const email = JSON.parse(response.choices[0].message.content || "{}");
      return email;
    } catch (error) {
      console.error("AI email generation failed:", error);
    }
  }
  
  // Fallback to template
  return {
    subject: `Quick question for ${contact.firstName}`,
    body: `Hi ${contact.firstName},\n\nI noticed your work at ${contact.companyId} and wanted to reach out...\n\nBest regards`
  };
}

// Score and prioritize leads
async function executeScoreLeadsTask(agent: AiAgent, context: Record<string, any>) {
  const { leadIds = [], criteria = {} } = context;
  
  const scoredLeads = [];
  for (const leadId of leadIds) {
    const contact = await storage.getContact(leadId);
    if (!contact) continue;
    
    // Calculate score based on criteria
    let score = 50; // Base score
    
    // Title-based scoring
    if (contact.title?.toLowerCase().includes('director')) score += 20;
    if (contact.title?.toLowerCase().includes('vp')) score += 25;
    if (contact.title?.toLowerCase().includes('chief')) score += 30;
    if (contact.title?.toLowerCase().includes('manager')) score += 15;
    
    // Engagement scoring (would check actual engagement data)
    if (contact.emailStatus === 'verified') score += 10;
    
    // Add random variation for demo
    score += Math.floor(Math.random() * 20) - 10;
    score = Math.max(0, Math.min(100, score)); // Clamp between 0-100
    
    scoredLeads.push({
      leadId,
      score,
      tier: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
      reasons: generateScoreReasons(score)
    });
  }
  
  // Sort by score descending
  scoredLeads.sort((a, b) => b.score - a.score);
  
  return { scoredLeads, totalScored: scoredLeads.length };
}

// Schedule follow-up task
async function executeScheduleFollowupTask(agent: AiAgent, context: Record<string, any>, targetId?: string) {
  if (!targetId) throw new Error("Contact ID required for follow-up scheduling");
  
  const { delayDays = 3, taskType = 'email', priority = 'medium', notes } = context;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + delayDays);
  
  const task: InsertTask = {
    title: `Follow up with contact`,
    description: notes || `Automated follow-up task created by ${agent.name}`,
    type: taskType,
    priority,
    status: 'pending',
    dueDate: dueDate.toISOString(),
    contactId: targetId,
    assignedTo: agent.assignedTo || 'system',
    metadata: {
      createdBy: 'ai-agent',
      agentId: agent.id,
      automationType: 'follow-up'
    }
  };
  
  const createdTask = await storage.createTask(task);
  
  return {
    taskId: createdTask.id,
    scheduledFor: dueDate.toISOString(),
    taskType,
    priority
  };
}

// Analyze engagement metrics
async function executeAnalyzeEngagementTask(agent: AiAgent, context: Record<string, any>) {
  const { timeRange = '7d', contactIds = [] } = context;
  
  // Get emails for specified contacts
  const engagementData = [];
  
  for (const contactId of contactIds) {
    const emails = await storage.getEmails({ contactId, limit: 50 });
    
    const metrics = {
      contactId,
      totalEmails: emails.length,
      opened: emails.filter(e => e.openedAt).length,
      clicked: emails.filter(e => e.clickedAt).length,
      replied: emails.filter(e => e.repliedAt).length,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      engagementScore: 0
    };
    
    if (metrics.totalEmails > 0) {
      metrics.openRate = (metrics.opened / metrics.totalEmails) * 100;
      metrics.clickRate = (metrics.clicked / metrics.totalEmails) * 100;
      metrics.replyRate = (metrics.replied / metrics.totalEmails) * 100;
      metrics.engagementScore = (metrics.openRate * 0.3 + metrics.clickRate * 0.3 + metrics.replyRate * 0.4);
    }
    
    engagementData.push(metrics);
  }
  
  // Sort by engagement score
  engagementData.sort((a, b) => b.engagementScore - a.engagementScore);
  
  return {
    timeRange,
    contacts: engagementData,
    summary: {
      avgOpenRate: average(engagementData.map(d => d.openRate)),
      avgClickRate: average(engagementData.map(d => d.clickRate)),
      avgReplyRate: average(engagementData.map(d => d.replyRate)),
      topPerformers: engagementData.slice(0, 5).map(d => d.contactId)
    }
  };
}

// Helper functions
function matchCompanySize(employeeCount: string | null, targetSize: string): boolean {
  if (!employeeCount) return false;
  const sizeMap: Record<string, string[]> = {
    'small': ['1-10', '11-50'],
    'medium': ['51-200', '201-500'],
    'large': ['500-1000', '1000+']
  };
  return sizeMap[targetSize]?.includes(employeeCount) || false;
}

function generateSkills(title: string | null): string[] {
  const baseSkills = ['Communication', 'Leadership', 'Strategy'];
  if (!title) return baseSkills;
  
  if (title.toLowerCase().includes('sales')) {
    return [...baseSkills, 'Negotiation', 'CRM', 'Pipeline Management'];
  }
  if (title.toLowerCase().includes('marketing')) {
    return [...baseSkills, 'Digital Marketing', 'Content Strategy', 'Analytics'];
  }
  if (title.toLowerCase().includes('engineering')) {
    return [...baseSkills, 'Software Development', 'Architecture', 'Agile'];
  }
  return baseSkills;
}

function generateInterests(title: string | null): string[] {
  const baseInterests = ['Innovation', 'Technology', 'Business Growth'];
  if (!title) return baseInterests;
  
  if (title.toLowerCase().includes('sales')) {
    return [...baseInterests, 'Revenue Growth', 'Customer Success'];
  }
  if (title.toLowerCase().includes('marketing')) {
    return [...baseInterests, 'Brand Building', 'Content Marketing'];
  }
  return baseInterests;
}

function generateTechStack(industry: string | null): string[] {
  const baseTech = ['Microsoft 365', 'Slack', 'Zoom'];
  if (!industry) return baseTech;
  
  if (industry.toLowerCase().includes('tech')) {
    return [...baseTech, 'AWS', 'React', 'Node.js', 'PostgreSQL'];
  }
  if (industry.toLowerCase().includes('finance')) {
    return [...baseTech, 'Salesforce', 'Bloomberg Terminal', 'SAP'];
  }
  return baseTech;
}

function generateFundingHistory(employeeCount: string | null): any[] {
  if (!employeeCount) return [];
  
  if (employeeCount.includes('1-10')) {
    return [{ round: 'Seed', amount: '$500K', date: '2023-01' }];
  }
  if (employeeCount.includes('11-50')) {
    return [
      { round: 'Seed', amount: '$500K', date: '2022-01' },
      { round: 'Series A', amount: '$5M', date: '2023-06' }
    ];
  }
  if (employeeCount.includes('51-200') || employeeCount.includes('201-500')) {
    return [
      { round: 'Seed', amount: '$500K', date: '2020-01' },
      { round: 'Series A', amount: '$5M', date: '2021-03' },
      { round: 'Series B', amount: '$25M', date: '2022-09' }
    ];
  }
  return [{ round: 'Series C+', amount: '$100M+', date: '2022-01' }];
}

function generateScoreReasons(score: number): string[] {
  const reasons = [];
  
  if (score >= 80) {
    reasons.push('High engagement signals');
    reasons.push('Perfect ICP fit');
    reasons.push('Active buying intent');
  } else if (score >= 60) {
    reasons.push('Good company fit');
    reasons.push('Moderate engagement');
    reasons.push('Potential opportunity');
  } else if (score >= 40) {
    reasons.push('Some interest shown');
    reasons.push('Needs nurturing');
  } else {
    reasons.push('Low engagement');
    reasons.push('Not ideal fit');
  }
  
  return reasons;
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

// Update agent metrics after task execution
async function updateAgentMetrics(agentId: string, success: boolean, executionTime?: number, taskType?: string) {
  try {
    // Get or create today's metrics
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let metric = await storage.getAgentMetrics(agentId, today);
    
    if (!metric) {
      // Create new metric for today
      const newMetric = await storage.createAgentMetric({
        agentId,
        date: today,
        tasksCompleted: success ? 1 : 0,
        tasksFailed: success ? 0 : 1,
        avgExecutionTime: executionTime || 0,
        successRate: success ? 1 : 0,
        leadsGenerated: taskType === 'find_leads' && success ? 1 : 0,
        emailsComposed: taskType === 'compose_email' && success ? 1 : 0,
        dataEnriched: taskType === 'enrich_data' && success ? 1 : 0
      });
      metric = newMetric;
    } else {
      // Update existing metric for today
      const updates: Partial<AgentMetric> = {
        tasksCompleted: (metric.tasksCompleted || 0) + (success ? 1 : 0),
        tasksFailed: (metric.tasksFailed || 0) + (success ? 0 : 1),
        updatedAt: new Date().toISOString()
      };
      
      // Update success rate
      const totalTasks = updates.tasksCompleted! + (metric.tasksFailed || 0) + (success ? 0 : 1);
      updates.successRate = totalTasks > 0 ? (updates.tasksCompleted! / totalTasks) : 0;
      
      // Update average execution time
      if (executionTime && success) {
        const currentAvg = metric.avgExecutionTime || 0;
        const currentTotal = metric.tasksCompleted || 0;
        const newTotal = currentTotal + 1;
        updates.avgExecutionTime = Math.round((currentAvg * currentTotal + executionTime) / newTotal);
      }
      
      // Update task-specific counters
      if (success) {
        if (taskType === 'find_leads') {
          updates.leadsGenerated = (metric.leadsGenerated || 0) + 1;
        } else if (taskType === 'compose_email') {
          updates.emailsComposed = (metric.emailsComposed || 0) + 1;
        } else if (taskType === 'enrich_data') {
          updates.dataEnriched = (metric.dataEnriched || 0) + 1;
        }
      }
      
      await storage.updateAgentMetric(metric.id, updates);
    }
    
    // Also update agent's last execution time and in-memory metrics
    const agent = await storage.getAiAgent(agentId);
    if (agent) {
      // Update in-memory metrics for quick access
      const metrics = agent.metrics || {};
      metrics.tasksCompleted = (metric.tasksCompleted || 0) + (success ? 1 : 0);
      metrics.tasksToday = metrics.tasksCompleted; // Today's count
      metrics.successRate = (metric.successRate || 0);
      metrics.avgExecutionTime = metric.avgExecutionTime || 2500;
      
      await storage.updateAiAgent(agentId, {
        metrics,
        lastExecutedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Failed to update agent metrics:", error);
  }
}

// Public API
export const aiAgentExecutor = {
  // Start/stop the job queue
  start: async () => await jobQueue.start(),
  stop: () => jobQueue.stop(),
  
  // Queue a new agent task
  queueTask: async (agentId: string, taskType: string, context: Record<string, any>, targetId?: string, createdBy: string = 'system') => {
    return await jobQueue.addJob(agentId, taskType, context, targetId, createdBy);
  },
  
  // Get job status
  getJobStatus: (jobId: string) => {
    const job = jobQueue.getJob(jobId);
    if (!job) return null;
    
    return {
      id: job.id,
      status: job.status,
      agentId: job.agentId,
      taskType: job.taskType,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    };
  },
  
  // Get queue statistics
  getQueueStats: () => jobQueue.getQueueStatus(),
  
  // Execute task immediately (bypass queue)
  executeTaskNow: async (agentId: string, taskType: string, context: Record<string, any>, targetId?: string) => {
    const job: AgentJob = {
      id: `immediate-${Date.now()}`,
      agentId,
      taskType,
      targetId,
      context,
      status: 'processing',
      createdAt: new Date(),
      startedAt: new Date()
    };
    
    const result = await executeAgentTask(job);
    await updateAgentMetrics(agentId, true, Date.now() - job.startedAt.getTime());
    return result;
  }
};

// Start the job queue automatically
aiAgentExecutor.start();