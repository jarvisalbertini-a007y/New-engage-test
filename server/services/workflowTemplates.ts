import { storage } from "../storage";
import type { InsertWorkflowTemplate, InsertAgentType } from "@shared/schema";

// Seed specialist AI agent types
export async function seedAgentTypes() {
  const agentTypes = [
    {
      id: "email-composer-1",
      name: "Email Composer Pro",
      description: "Writes personalized emails with high conversion rates",
      category: "communication",
      systemPrompt: "You are an expert email copywriter. Create compelling, personalized emails that drive engagement. Focus on value propositions, clear CTAs, and appropriate tone. Return JSON with 'subject' and 'body' fields.",
      inputSchema: {
        recipientName: "string",
        recipientCompany: "string",
        context: "string",
        tone: "professional | casual | urgent"
      },
      outputSchema: {
        subject: "string",
        body: "string"
      },
      model: "gpt-4o-mini",
      temperature: "0.7",
      maxTokens: 2000,
      successRate: "0.92"
    },
    {
      id: "data-researcher-1",
      name: "Data Research Agent",
      description: "Enriches lead and company data from multiple sources",
      category: "research",
      systemPrompt: "You are a data research specialist. Enrich the provided information with relevant business insights, tech stack, funding data, and key personnel. Return structured JSON with all discovered data points.",
      inputSchema: {
        companyName: "string",
        domain: "string",
        industry: "string"
      },
      outputSchema: {
        enrichedData: "object",
        confidence: "number"
      },
      model: "gpt-4o-mini",
      temperature: "0.3",
      maxTokens: 2000,
      successRate: "0.88"
    },
    {
      id: "lead-scorer-1",
      name: "Lead Scoring Expert",
      description: "Scores leads based on ICP fit and buying signals",
      category: "analytics",
      systemPrompt: "You are a lead scoring expert. Analyze the provided lead data and assign a score from 0-100 based on: company fit (size, industry, tech stack), engagement signals, timing indicators. Return JSON with 'score', 'tier' (A/B/C/D), and 'reasons' array.",
      inputSchema: {
        leadData: "object",
        scoringCriteria: "object"
      },
      outputSchema: {
        score: "number",
        tier: "string",
        reasons: "array"
      },
      model: "gpt-4o-mini",
      temperature: "0.2",
      maxTokens: 1000,
      successRate: "0.95"
    },
    {
      id: "meeting-scheduler-1",
      name: "Meeting Scheduler",
      description: "Finds optimal meeting times and sends calendar invites",
      category: "scheduling",
      systemPrompt: "You are a meeting scheduling assistant. Propose optimal meeting times based on timezone, availability, and urgency. Consider meeting purpose and attendees. Return JSON with 'proposedTimes' array and 'meetingDetails'.",
      inputSchema: {
        participants: "array",
        duration: "number",
        purpose: "string",
        urgency: "string"
      },
      outputSchema: {
        proposedTimes: "array",
        meetingDetails: "object",
        calendarLink: "string"
      },
      model: "gpt-4o-mini",
      temperature: "0.5",
      maxTokens: 1500,
      successRate: "0.90"
    },
    {
      id: "content-creator-1",
      name: "Content Generator",
      description: "Creates personalized content for campaigns",
      category: "content",
      systemPrompt: "You are a content creation specialist. Generate engaging, relevant content based on the target audience, campaign goals, and brand voice. Include SEO optimization when relevant. Return JSON with 'title', 'content', 'metadata'.",
      inputSchema: {
        contentType: "string",
        topic: "string",
        audience: "object",
        keywords: "array"
      },
      outputSchema: {
        title: "string",
        content: "string",
        metadata: "object"
      },
      model: "gpt-4o-mini",
      temperature: "0.8",
      maxTokens: 3000,
      successRate: "0.87"
    }
  ];

  for (const agentType of agentTypes) {
    try {
      // Check if agent type exists by name since name is unique
      const existing = await storage.getAgentTypes();
      const exists = existing.some(a => a.name === agentType.name);
      
      if (!exists) {
        // Remove id field before creating since it's auto-generated
        const { id, ...agentTypeData } = agentType;
        await storage.createAgentType(agentTypeData as InsertAgentType);
        console.log(`Created agent type: ${agentType.name}`);
      }
    } catch (error) {
      console.error(`Failed to create agent type ${agentType.name}:`, error);
    }
  }
}

// Seed workflow templates
export async function seedWorkflowTemplates() {
  const templates = [
    {
      name: "Lead Qualification Flow",
      description: "Automatically research, score, and route new leads to the right sales rep",
      category: "sales",
      difficulty: "beginner",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          agentType: "form_submission",
          label: "New Lead Form",
          config: {},
          position: { x: 100, y: 100 }
        },
        {
          id: "agent-1",
          type: "agent",
          agentType: "data-researcher-1",
          label: "Research Company",
          config: {},
          position: { x: 100, y: 200 }
        },
        {
          id: "agent-2",
          type: "agent",
          agentType: "lead-scorer-1",
          label: "Score Lead",
          config: {},
          position: { x: 100, y: 300 }
        },
        {
          id: "condition-1",
          type: "condition",
          agentType: "if_else",
          label: "Check Score",
          config: { condition: "score > 70" },
          position: { x: 100, y: 400 }
        },
        {
          id: "action-1",
          type: "action",
          agentType: "send_email",
          label: "Send Welcome Email",
          config: { template: "high_value_welcome" },
          position: { x: 50, y: 500 }
        },
        {
          id: "action-2",
          type: "action",
          agentType: "create_task",
          label: "Create Follow-up",
          config: { priority: "high" },
          position: { x: 150, y: 500 }
        }
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-2" },
        { id: "e3", source: "agent-2", target: "condition-1" },
        { id: "e4", source: "condition-1", target: "action-1", label: "true" },
        { id: "e5", source: "condition-1", target: "action-2", label: "false" }
      ],
      config: {
        autoStart: true,
        maxExecutions: 1000
      }
    },
    {
      name: "Daily Outreach Campaign",
      description: "Send personalized outreach emails every morning with AI-generated content",
      category: "marketing",
      difficulty: "intermediate",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          agentType: "schedule",
          label: "Daily at 9 AM",
          config: { cron: "0 9 * * *" },
          position: { x: 100, y: 100 }
        },
        {
          id: "action-1",
          type: "action",
          agentType: "fetch_leads",
          label: "Get Today's Leads",
          config: { limit: 50, status: "new" },
          position: { x: 100, y: 200 }
        },
        {
          id: "agent-1",
          type: "agent",
          agentType: "email-composer-1",
          label: "Generate Emails",
          config: {},
          position: { x: 100, y: 300 }
        },
        {
          id: "action-2",
          type: "action",
          agentType: "send_email",
          label: "Send Emails",
          config: { batchSize: 10, delay: 60000 },
          position: { x: 100, y: 400 }
        },
        {
          id: "action-3",
          type: "action",
          agentType: "send_slack",
          label: "Notify Team",
          config: { channel: "#sales" },
          position: { x: 100, y: 500 }
        }
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "action-1" },
        { id: "e2", source: "action-1", target: "agent-1" },
        { id: "e3", source: "agent-1", target: "action-2" },
        { id: "e4", source: "action-2", target: "action-3" }
      ],
      config: {
        requiresApproval: false,
        notifyOnError: true
      }
    },
    {
      name: "Meeting Booked Automation",
      description: "When a meeting is booked, prepare materials and notify the team",
      category: "sales",
      difficulty: "beginner",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          agentType: "calendar_event",
          label: "Meeting Booked",
          config: {},
          position: { x: 100, y: 100 }
        },
        {
          id: "agent-1",
          type: "agent",
          agentType: "data-researcher-1",
          label: "Research Attendees",
          config: {},
          position: { x: 100, y: 200 }
        },
        {
          id: "agent-2",
          type: "agent",
          agentType: "content-creator-1",
          label: "Prepare Talking Points",
          config: { contentType: "meeting_prep" },
          position: { x: 100, y: 300 }
        },
        {
          id: "action-1",
          type: "action",
          agentType: "send_email",
          label: "Send Confirmation",
          config: {},
          position: { x: 50, y: 400 }
        },
        {
          id: "action-2",
          type: "action",
          agentType: "send_slack",
          label: "Notify Sales Team",
          config: { channel: "#sales-meetings" },
          position: { x: 150, y: 400 }
        }
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-2" },
        { id: "e3", source: "agent-2", target: "action-1" },
        { id: "e4", source: "agent-2", target: "action-2" }
      ],
      config: {
        autoStart: true
      }
    },
    {
      name: "Stale Deal Revival",
      description: "Identify and re-engage deals that haven't had activity in 14 days",
      category: "sales",
      difficulty: "advanced",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          agentType: "schedule",
          label: "Daily Check",
          config: { cron: "0 10 * * *" },
          position: { x: 100, y: 100 }
        },
        {
          id: "action-1",
          type: "action",
          agentType: "query_deals",
          label: "Find Stale Deals",
          config: { daysInactive: 14 },
          position: { x: 100, y: 200 }
        },
        {
          id: "agent-1",
          type: "agent",
          agentType: "lead-scorer-1",
          label: "Re-score Deals",
          config: {},
          position: { x: 100, y: 300 }
        },
        {
          id: "condition-1",
          type: "condition",
          agentType: "if_else",
          label: "Worth Pursuing?",
          config: { condition: "score > 60" },
          position: { x: 100, y: 400 }
        },
        {
          id: "agent-2",
          type: "agent",
          agentType: "email-composer-1",
          label: "Create Re-engagement",
          config: { tone: "casual", intent: "revival" },
          position: { x: 50, y: 500 }
        },
        {
          id: "action-2",
          type: "action",
          agentType: "send_email",
          label: "Send Revival Email",
          config: { requiresApproval: true },
          position: { x: 50, y: 600 }
        },
        {
          id: "action-3",
          type: "action",
          agentType: "update_contact",
          label: "Mark as Lost",
          config: { status: "lost" },
          position: { x: 150, y: 500 }
        }
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "action-1" },
        { id: "e2", source: "action-1", target: "agent-1" },
        { id: "e3", source: "agent-1", target: "condition-1" },
        { id: "e4", source: "condition-1", target: "agent-2", label: "true" },
        { id: "e5", source: "agent-2", target: "action-2" },
        { id: "e6", source: "condition-1", target: "action-3", label: "false" }
      ],
      config: {
        maxExecutions: 50,
        requiresApproval: true
      }
    },
    {
      name: "Competitor Mention Alert",
      description: "Monitor for competitor mentions and create response strategy",
      category: "intelligence",
      difficulty: "intermediate",
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          agentType: "webhook",
          label: "Competitor Mentioned",
          config: { source: "email_tracking" },
          position: { x: 100, y: 100 }
        },
        {
          id: "agent-1",
          type: "agent",
          agentType: "data-researcher-1",
          label: "Analyze Context",
          config: {},
          position: { x: 100, y: 200 }
        },
        {
          id: "agent-2",
          type: "agent",
          agentType: "content-creator-1",
          label: "Create Response",
          config: { contentType: "competitive_response" },
          position: { x: 100, y: 300 }
        },
        {
          id: "action-1",
          type: "action",
          agentType: "create_task",
          label: "Create Response Task",
          config: { priority: "high", assignTo: "sales_manager" },
          position: { x: 100, y: 400 }
        },
        {
          id: "action-2",
          type: "action",
          agentType: "send_slack",
          label: "Alert Team",
          config: { channel: "#competitive-intel" },
          position: { x: 100, y: 500 }
        }
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "agent-1" },
        { id: "e2", source: "agent-1", target: "agent-2" },
        { id: "e3", source: "agent-2", target: "action-1" },
        { id: "e4", source: "action-1", target: "action-2" }
      ],
      config: {
        priority: "high",
        notifyOnTrigger: true
      }
    }
  ];

  for (const template of templates) {
    try {
      const existing = await storage.getWorkflowTemplates({ category: template.category });
      const exists = existing.some(t => t.name === template.name);
      
      if (!exists) {
        // Map the template structure to match the database schema
        const templateData = {
          name: template.name,
          description: template.description,
          category: template.category,
          difficulty: template.difficulty,
          workflowDefinition: {
            nodes: template.nodes,
            edges: template.edges,
            config: template.config || {}
          },
          requiredIntegrations: [],
          tags: [],
          usageCount: 0
        };
        await storage.createWorkflowTemplate(templateData);
        console.log(`Created workflow template: ${template.name}`);
      }
    } catch (error) {
      console.error(`Failed to create template ${template.name}:`, error);
    }
  }
}

// Initialize all templates and agent types
export async function initializeWorkflowData() {
  console.log("Initializing workflow data...");
  await seedAgentTypes();
  await seedWorkflowTemplates();
  console.log("Workflow data initialization complete");
}