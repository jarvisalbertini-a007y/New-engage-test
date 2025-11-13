import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertUserSchema, insertContactSchema, insertCompanySchema, insertSequenceSchema, insertPersonaSchema, insertTaskSchema, insertLeadScoringModelSchema, insertLeadScoreSchema, insertAutopilotCampaignSchema, insertAutopilotRunSchema, insertMarketplaceAgentSchema, insertAgentRatingSchema, insertIntentSignalSchema, insertVoiceCampaignSchema, insertVoiceScriptSchema, insertWhiteLabelSchema, insertEnterpriseSecuritySchema, insertAccessControlSchema, insertContentTemplateSchema, insertTemplateVersionSchema, insertAudienceSegmentSchema, insertTemplateMetricsSchema } from "@shared/schema";
import { analyzeEmail, improveEmail, analyzeSpamRisk, optimizeSubjectLine } from "./services/emailAnalysis";
import { generateContent, generateSequenceSteps } from "./services/contentGeneration";
import { getActiveVisitorIntelligence, trackVisitorActivity } from "./services/visitorIntelligence";
import { enrichCompanyData, getCompanyVisitorHistory } from "./services/ipIntelligence";
import { discoverInsights, generateInsightRecommendations, scoreInsightRelevance } from "./services/insightsEngine";
import { generatePersonalizedEmail, categorizeEmailResponse } from "./services/openai";
import { initiateCall, getCallAnalytics, scheduleCallCampaign, getOrGenerateCallScript } from "./services/cloudDialer";
import { canSendEmail, incrementSendCount, getWarmupSchedule, checkDomainReputation, validateEmailContent, getSendingRecommendations } from "./services/emailLimits";
import { parseNLPToWorkflow, executeWorkflow, resumeWorkflow } from "./services/workflowEngine";
import { sdrTeamManager } from "./services/sdrTeams";
import { insertSdrTeamSchema } from "@shared/schema";
import { dealIntelligenceEngine } from "./services/dealIntelligence";
import { revenueOpsCenter } from "./services/revenueOps";
import { voiceAIManager, createVoiceCampaign, getVoiceCampaigns, createVoiceScript, getVoiceScripts, getCallAnalytics as getVoiceCallAnalytics, getCampaignAnalytics } from "./services/voiceAI";
import { browserExtensionService } from "./services/browserExtension";
import { crowdIntelNetwork } from "./services/crowdIntel";
import { insertSharedIntelSchema, insertIntelRatingSchema } from "@shared/schema";
import { enterpriseManager } from "./services/enterprise";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware setup - from blueprint:javascript_log_in_with_replit
  console.log("[Auth Setup] Starting authentication setup...");
  try {
    await setupAuth(app);
    console.log("[Auth Setup] Authentication setup completed successfully");
  } catch (error) {
    console.error("[Auth Setup] Failed to set up authentication:", error);
    throw error;
  }
  
  // Define public endpoints that don't require authentication
  const publicEndpoints = [
    '/api/login',
    '/api/callback',
    '/api/logout',
    '/api/health' // Add any other public endpoints here
  ];
  
  // Global authentication middleware for all /api routes
  app.use('/api/*', (req: any, res, next) => {
    // Authentication is now properly enforced
    const TESTING_MODE = false; // Authentication is enabled for production
    
    if (TESTING_MODE) {
      // This code path is now disabled - proper authentication required
      if (!req.user) {
        req.user = {
          claims: {
            sub: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
            first_name: 'Test',
            last_name: 'User'
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        };
      }
      console.log('[AUTH] Testing mode enabled - bypassing authentication');
      return next();
    }
    
    // Skip authentication for public endpoints
    const path = req.baseUrl + req.path;
    if (publicEndpoints.some(endpoint => path.startsWith(endpoint))) {
      return next();
    }
    
    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    // Check authentication
    try {
      if (!req.session || !req.user || !req.user.claims || !req.user.claims.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (req.user.expires_at && now > req.user.expires_at) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard & Analytics Routes - Protected
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const activeVisitors = await storage.getActiveVisitorSessions();
      const sequences = await storage.getSequences();
      const emails = await storage.getEmails({ limit: 100 });
      const companies = await storage.getCompanies(100);
      
      // Calculate reply rate
      const sentEmails = emails.filter(e => e.status === 'sent' || e.status === 'delivered' || e.status === 'opened' || e.status === 'replied');
      const repliedEmails = emails.filter(e => e.status === 'replied');
      const replyRate = sentEmails.length > 0 ? (repliedEmails.length / sentEmails.length * 100) : 0;
      
      // Calculate pipeline value (simulated)
      const pipelineValue = companies.length * 25000; // Average deal size
      
      const stats = {
        activeVisitors: activeVisitors.length,
        replyRate: Math.round(replyRate * 10) / 10,
        pipelineValue: pipelineValue,
        aiSequences: sequences.filter(s => s.status === 'active').length
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/activity", async (req, res) => {
    try {
      // Fetch recent activity items
      const emails = await storage.getEmails({ limit: 10 });
      const sequences = await storage.getSequences(); // No limit parameter available
      const insights = await storage.getInsights({ limit: 10 });
      
      // Combine and format activity items
      const activity = [
        ...emails.map(email => ({
          id: email.id,
          type: 'email',
          message: `Email ${email.status}: ${email.subject || 'No subject'}`,
          timestamp: email.sentAt || new Date().toISOString(),
          icon: 'mail'
        })),
        ...sequences.slice(0, 5).map(seq => ({ // Slice to limit results
          id: seq.id,
          type: 'sequence',
          message: `Sequence ${seq.status}: ${seq.name}`,
          timestamp: seq.createdAt,
          icon: 'workflow'
        })),
        ...insights.map(insight => ({
          id: insight.id,
          type: 'insight',
          message: `New insight: ${insight.type} for company ${insight.companyId || 'Unknown'}`,
          timestamp: insight.createdAt,
          icon: 'lightbulb'
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
       .slice(0, 10); // Return top 10 most recent items
      
      res.json(activity);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/dashboard/insights", async (req, res) => {
    try {
      // Fetch recent insights and opportunities
      const insights = await storage.getInsights({ limit: 5 });
      const companies = await storage.getCompanies(10);
      const sequences = await storage.getSequences(); // No limit parameter available
      
      // Format insights for dashboard
      const dashboardInsights = insights.map(insight => ({
        id: insight.id,
        type: insight.type,
        companyId: insight.companyId,
        description: insight.description,
        confidence: insight.confidence,
        createdAt: insight.createdAt,
        relevanceScore: insight.relevanceScore
      }));
      
      // Add some AI-generated recommendations
      const recommendations = [
        {
          id: 'rec-1',
          title: 'High-Value Prospects Detected',
          description: `${companies.length} companies match your ideal customer profile`,
          action: 'View Companies',
          priority: 'high'
        },
        {
          id: 'rec-2',
          title: 'Sequence Optimization Available',
          description: `${sequences.filter(s => s.status === 'active').length} sequences can be optimized for better performance`,
          action: 'Optimize Now',
          priority: 'medium'
        }
      ];
      
      res.json({
        insights: dashboardInsights,
        recommendations
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Visitor Intelligence Routes - Protected
  app.get("/api/visitors/active", async (req, res) => {
    try {
      const visitorIntelligence = await getActiveVisitorIntelligence();
      res.json(visitorIntelligence);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/visitors/track", async (req, res) => {
    try {
      const { ipAddress, userAgent, page } = req.body;
      
      // Validate required fields
      if (!ipAddress || !page) {
        return res.status(400).json({ 
          error: "Missing required fields: ipAddress and page are required" 
        });
      }
      
      const session = await trackVisitorActivity(ipAddress, userAgent || "Unknown", page);
      res.json(session);
    } catch (error) {
      console.error("Error tracking visitor:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  
  // Company Routes
  app.get("/api/companies", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const companies = await storage.getCompanies(limit);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  // Update company endpoint
  app.put("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Remove id from updates if present
      delete updates.id;
      
      const company = await storage.updateCompany(id, updates);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update company' });
    }
  });
  
  // Delete company endpoint
  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCompany(id);
      if (!success) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete company' });
    }
  });
  
  // Company Enrichment Routes
  app.post("/api/companies/:id/enrich", async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company || !company.domain) {
        return res.status(404).json({ error: "Company not found or missing domain" });
      }
      
      const enrichment = await enrichCompanyData(company.domain);
      res.json(enrichment);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.get("/api/companies/:id/visitor-history", async (req, res) => {
    try {
      const history = await getCompanyVisitorHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Contact Routes
  app.get("/api/contacts", async (req, res) => {
    try {
      const companyId = req.query.companyId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const contacts = await storage.getContacts({ companyId, limit });
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update contact endpoint
  app.put("/api/contacts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Remove id from updates if present
      delete updates.id;
      
      const contact = await storage.updateContact(id, updates);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update contact' });
    }
  });
  
  // Delete contact endpoint
  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteContact(id);
      if (!success) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete contact' });
    }
  });
  
  // Bulk enrich contacts endpoint
  app.post("/api/contacts/enrich", async (req, res) => {
    try {
      const { contactIds } = req.body;
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: "Contact IDs array is required" });
      }
      
      // Simulate enrichment for each contact
      const enrichmentResults = await Promise.all(
        contactIds.map(async (id: string) => {
          const contact = await storage.getContact(id);
          if (!contact) return { id, error: "Contact not found" };
          
          // Simulate enrichment data
          const enrichedData = {
            verificationStatus: Math.random() > 0.2 ? "verified" : "unverified",
            enrichedAt: new Date().toISOString(),
            additionalInfo: {
              linkedinUrl: contact.email ? `https://linkedin.com/in/${contact.email.split('@')[0]}` : null,
              phoneVerified: Math.random() > 0.5,
              jobFunction: ["Sales", "Marketing", "Engineering", "Product", "Operations"][Math.floor(Math.random() * 5)]
            }
          };
          
          // Update contact with enriched data
          await storage.updateContact(id, {
            verificationStatus: enrichedData.verificationStatus as any,
            linkedinUrl: enrichedData.additionalInfo.linkedinUrl
          });
          
          return { id, ...enrichedData };
        })
      );
      
      res.json({ enriched: enrichmentResults });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to enrich contacts' });
    }
  });

  // Email Analysis Routes
  app.post("/api/emails/analyze", async (req, res) => {
    try {
      const { emailContent } = req.body;
      const analysis = await analyzeEmail(emailContent);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/emails/improve", async (req, res) => {
    try {
      const { emailContent } = req.body;
      const improvement = await improveEmail(emailContent);
      res.json(improvement);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/emails/spam-check", async (req, res) => {
    try {
      const { emailContent } = req.body;
      const spamAnalysis = analyzeSpamRisk(emailContent);
      res.json(spamAnalysis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/emails/optimize-subject", async (req, res) => {
    try {
      const { subject } = req.body;
      const optimization = optimizeSubjectLine(subject);
      res.json(optimization);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/emails/categorize", async (req, res) => {
    try {
      const { emailContent } = req.body;
      const categorization = await categorizeEmailResponse(emailContent);
      res.json(categorization);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  // Email Limits & Reputation Routes
  app.get("/api/emails/limits", async (req, res) => {
    try {
      const userId = "demo-user"; // Would come from session
      const limits = await canSendEmail(userId);
      const warmup = await getWarmupSchedule(userId);
      const recommendations = await getSendingRecommendations(userId);
      
      res.json({
        ...limits,
        warmup,
        recommendations
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.post("/api/emails/check-reputation", async (req, res) => {
    try {
      const { domain } = req.body;
      const reputation = await checkDomainReputation(domain);
      res.json(reputation);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.post("/api/emails/validate", async (req, res) => {
    try {
      const { content } = req.body;
      const validation = validateEmailContent(content);
      res.json(validation);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.post("/api/emails/send", async (req, res) => {
    try {
      const userId = "demo-user"; // Would come from session
      
      // Check if user can send email
      const { allowed, remaining, limit } = await canSendEmail(userId);
      if (!allowed) {
        return res.status(429).json({ 
          error: "Daily send limit reached",
          limit,
          remaining: 0 
        });
      }
      
      // Validate email content
      const { content, subject } = req.body;
      const validation = validateEmailContent(content);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "Email content has spam triggers",
          issues: validation.issues,
          spamScore: validation.spamScore
        });
      }
      
      // Create and "send" the email
      const emailData = {
        ...req.body,
        status: "sent",
        sentAt: new Date()
      };
      
      const email = await storage.createEmail(emailData);
      
      // Increment send counter
      incrementSendCount(userId);
      
      res.json({
        success: true,
        email,
        remaining: remaining - 1,
        limit
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Content Generation Routes
  // Original endpoint for backward compatibility
  app.post("/api/content/generate", async (req, res) => {
    try {
      const content = await generateContent(req.body);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // New endpoint used by Content Studio
  app.post("/api/content-generation/generate", async (req: any, res) => {
    try {
      console.log("Content generation request received:", {
        body: req.body,
        user: req.user,
        authenticated: !!req.user
      });
      
      // For now, just call generateContent with the request body
      // TODO: Update generateContent to accept userId when needed
      const content = await generateContent(req.body);
      console.log("Content generated successfully:", content);
      res.json(content);
    } catch (error) {
      console.error("Content generation error details:", {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        request: req.body
      });
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate content' });
    }
  });

  app.post("/api/content/personalized-email", async (req, res) => {
    try {
      const email = await generatePersonalizedEmail(req.body);
      res.json(email);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Sequence Routes
  app.get("/api/sequences", async (req, res) => {
    try {
      const createdBy = req.query.createdBy as string;
      const status = req.query.status as string;
      const sequences = await storage.getSequences({ createdBy, status });
      res.json(sequences);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sequences", async (req, res) => {
    try {
      const validatedData = insertSequenceSchema.parse(req.body);
      const sequence = await storage.createSequence(validatedData);
      res.json(sequence);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sequences/generate-steps", async (req, res) => {
    try {
      console.log("[Generate Steps] Request received:", {
        hasSession: !!req.session,
        hasUser: !!req.user,
        userSub: (req.user as any)?.claims?.sub,
        headers: req.headers,
        body: req.body
      });
      
      const { name, description, sequenceType = 'email_only' } = req.body;
      
      // Generate AI-powered sequence steps based on name and description
      // We'll create a simple sequence without requiring a persona
      const stepCount = sequenceType === 'multi_channel' ? 5 : 4;
      const steps = [];
      
      for (let i = 1; i <= stepCount; i++) {
        if (sequenceType === 'email_only') {
          steps.push({
            stepNumber: i,
            type: 'email',
            delay: i === 1 ? 0 : (i - 1) * 3, // 0, 3, 6, 9 days
            subject: i === 1 ? `Introduction - ${name}` : `Follow up ${i} - ${name}`,
            template: generateEmailTemplate(i, stepCount, name, description),
            isActive: true
          });
        } else {
          // Multi-channel: email, linkedin, email, phone, email pattern
          const stepTypes = ['email', 'linkedin', 'email', 'phone', 'email'];
          const stepType = stepTypes[i - 1] || 'email';
          
          steps.push({
            stepNumber: i,
            type: stepType,
            delay: i === 1 ? 0 : (i - 1) * 2, // 0, 2, 4, 6, 8 days
            subject: stepType === 'email' ? 
              (i === 1 ? `Introduction - ${name}` : `Follow up - ${name}`) : 
              undefined,
            template: generateStepContent(i, stepCount, stepType, name, description),
            isActive: true
          });
        }
      }
      
      res.json({ steps });
    } catch (error) {
      console.error("Error generating sequence steps:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate sequence steps' });
    }
  });
  
  // Helper function to generate email templates
  function generateEmailTemplate(stepNumber: number, totalSteps: number, sequenceName: string, description: string): string {
    const isFirst = stepNumber === 1;
    const isLast = stepNumber === totalSteps;
    
    if (isFirst) {
      return `Hi {{firstName}},

I hope this email finds you well. ${description ? description : `I'm reaching out regarding ${sequenceName}.`}

I noticed that {{company}} has been making great progress in {{industry}}, and I believe we could help you achieve even better results.

Would you be interested in a brief 15-minute call to discuss how we can help?

Best regards,
{{senderName}}`;
    } else if (isLast) {
      return `Hi {{firstName}},

I've reached out a few times about how we can help {{company}} with their goals.

If this isn't a priority right now, I completely understand. I'll check back in a few months.

If you are interested but the timing isn't right, just let me know when would be better.

Best regards,
{{senderName}}`;
    } else {
      return `Hi {{firstName}},

I wanted to follow up on my previous email about helping {{company}} achieve their goals.

I'd love to show you how we've helped similar companies in {{industry}} achieve great results.

Do you have 15 minutes this week for a quick call?

Best regards,
{{senderName}}`;
    }
  }
  
  // Helper function to generate content for different step types
  function generateStepContent(stepNumber: number, totalSteps: number, type: string, sequenceName: string, description: string): string {
    switch (type) {
      case 'email':
        return generateEmailTemplate(stepNumber, totalSteps, sequenceName, description);
      case 'linkedin':
        return `Hi {{firstName}}, I noticed we're both connected to the {{industry}} space. ${description ? description : `I'd love to connect and share insights about ${sequenceName}.`} Would you be open to connecting?`;
      case 'phone':
        return `Call Script:
1. Introduction: Hi {{firstName}}, this is {{senderName}} from {{companyName}}
2. Reference previous emails about ${sequenceName}
3. ${description ? description : 'Share value proposition'}
4. Ask for meeting or next steps
5. Handle objections if needed`;
      case 'wait':
        return 'Wait step - no action required';
      default:
        return '';
    }
  }
  
  // Campaigns Route - Aggregates all campaign types
  app.get("/api/campaigns", async (req, res) => {
    try {
      const status = req.query.status as string;
      const createdBy = req.query.createdBy as string;
      
      const allCampaigns = [];
      
      // Fetch autopilot campaigns (these should exist)
      try {
        const autopilotCampaigns = await storage.getAutopilotCampaigns({ status, createdBy });
        allCampaigns.push(...autopilotCampaigns.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          type: 'autopilot',
          status: campaign.status,
          createdAt: campaign.createdAt,
          metrics: {
            totalLeadsProcessed: campaign.totalLeadsProcessed || 0,
            totalEmailsSent: campaign.totalEmailsSent || 0,
            totalReplies: campaign.totalReplies || 0,
            totalMeetingsBooked: campaign.totalMeetingsBooked || 0
          }
        })));
      } catch (err) {
        console.warn('Failed to fetch autopilot campaigns:', err);
      }
      
      // Fetch voice campaigns (may not exist yet)
      try {
        const voiceCampaigns = await storage.getVoiceCampaigns({ status, createdBy });
        allCampaigns.push(...voiceCampaigns.map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          type: 'voice',
          status: campaign.status,
          createdAt: campaign.createdAt,
          metrics: {
            totalCalls: 0,
            connectedCalls: 0,
            voicemails: 0,
            conversions: 0
          }
        })));
      } catch (err) {
        console.warn('Failed to fetch voice campaigns:', err);
        // Continue without voice campaigns
      }
      
      // Sort by creation date (most recent first)
      allCampaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(allCampaigns);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Insights Routes
  app.get("/api/insights", async (req, res) => {
    try {
      const companyId = req.query.companyId as string;
      const type = req.query.type as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const insights = await storage.getInsights({ companyId, type, limit });
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/insights/discover", async (req, res) => {
    try {
      const insights = await discoverInsights();
      res.json(insights);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/insights/:id/recommendations", async (req, res) => {
    try {
      const recommendations = await generateInsightRecommendations(req.params.id);
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Persona Routes
  app.get("/api/personas", async (req, res) => {
    try {
      const createdBy = req.query.createdBy as string;
      const personas = await storage.getPersonas(createdBy);
      res.json(personas);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/personas", async (req, res) => {
    try {
      const validatedData = insertPersonaSchema.parse(req.body);
      const persona = await storage.createPersona(validatedData);
      res.json(persona);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  app.put("/api/personas/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || 'anonymous';
      
      // Check if persona exists and user owns it
      const existing = await storage.getPersona(id);
      if (!existing) {
        return res.status(404).json({ error: 'Persona not found' });
      }
      if (existing.createdBy && existing.createdBy !== userId && userId !== 'anonymous') {
        return res.status(403).json({ error: 'Not authorized to update this persona' });
      }
      
      // Validate partial update data
      const validatedData = insertPersonaSchema.partial().parse(req.body);
      const updated = await storage.updatePersona(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Failed to update persona' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating persona:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update persona' });
    }
  });
  
  app.delete("/api/personas/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub || 'anonymous';
      
      // Check if persona exists and user owns it
      const existing = await storage.getPersona(id);
      if (!existing) {
        return res.status(404).json({ error: 'Persona not found' });
      }
      if (existing.createdBy && existing.createdBy !== userId && userId !== 'anonymous') {
        return res.status(403).json({ error: 'Not authorized to delete this persona' });
      }
      
      const success = await storage.deletePersona(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Failed to delete persona' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting persona:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete persona' });
    }
  });

  // Task Routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const assignedTo = req.query.assignedTo as string;
      const status = req.query.status as string;
      const priority = req.query.priority as string;
      const tasks = await storage.getTasks({ assignedTo, status, priority });
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Phone Call Routes
  app.post("/api/calls/initiate", async (req, res) => {
    try {
      const { contactId, userId, scriptType } = req.body;
      if (!contactId || !userId) {
        return res.status(400).json({ error: "contactId and userId are required" });
      }
      const call = await initiateCall(contactId, userId, scriptType || 'cold_call');
      res.json(call);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/calls/campaign", async (req, res) => {
    try {
      const { contactIds, userId, scriptType } = req.body;
      if (!contactIds || !Array.isArray(contactIds) || !userId) {
        return res.status(400).json({ error: "contactIds array and userId are required" });
      }
      const calls = await scheduleCallCampaign(contactIds, userId, scriptType || 'cold_call');
      res.json({ message: `Scheduled ${contactIds.length} calls`, calls });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/calls/analytics", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const analytics = await getCallAnalytics(userId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/calls", async (req, res) => {
    try {
      const contactId = req.query.contactId as string;
      const userId = req.query.userId as string;
      const status = req.query.status as string;
      const calls = await storage.getPhoneCalls({ contactId, userId, status });
      res.json(calls);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/calls/:id", async (req, res) => {
    try {
      const call = await storage.getPhoneCall(req.params.id);
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      res.json(call);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/call-scripts", async (req, res) => {
    try {
      const type = req.query.type as string;
      const personaId = req.query.personaId as string;
      const scripts = await storage.getCallScripts({ type, personaId });
      res.json(scripts);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/call-scripts/generate", async (req, res) => {
    try {
      const { type, contactId } = req.body;
      const contact = contactId ? await storage.getContact(contactId) : null;
      const script = await getOrGenerateCallScript(type || 'cold_call', contact);
      res.json(script);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/voicemails", async (req, res) => {
    try {
      const contactId = req.query.contactId as string;
      const isListened = req.query.isListened === 'true';
      const voicemails = await storage.getVoicemails({ contactId, isListened });
      res.json(voicemails);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // AI Agents routes
  app.get("/api/agents/metrics", async (req, res) => {
    try {
      const agents = await storage.getAiAgents();
      const activeAgents = agents.filter(a => a.status === 'active');
      
      const totalProspected = agents.reduce((sum, a) => sum + (a.totalContacted || 0), 0);
      const totalQualified = agents.reduce((sum, a) => sum + (a.totalQualified || 0), 0);
      const avgSuccessRate = agents.length > 0 
        ? agents.reduce((sum, a) => sum + parseFloat(a.successRate || '0'), 0) / agents.length
        : 0;
      const todayActions = activeAgents.reduce((sum, a) => sum + (a.currentProgress || 0), 0);
      
      const metrics = {
        totalAgents: agents.length,
        activeAgents: activeAgents.length,
        totalProspected,
        totalQualified,
        avgSuccessRate: Math.round(avgSuccessRate),
        todayActions,
      };
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const status = req.query.status as string;
      const type = req.query.type as string;
      const createdBy = req.query.createdBy as string;
      
      const agents = await storage.getAiAgents({ status, type, createdBy });
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const { insertAiAgentSchema } = await import("@shared/schema");
      const agent = insertAiAgentSchema.parse(req.body);
      const created = await storage.createAiAgent(agent);
      res.json(created);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await storage.updateAiAgent(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAiAgent(id);
      if (!deleted) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Agent Execution routes
  app.post("/api/agents/:id/execute", async (req, res) => {
    try {
      const { id } = req.params;
      const { taskType, context, targetId } = req.body;
      const userId = req.user?.id || 'system';
      
      // Verify agent exists and is active
      const agent = await storage.getAiAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (agent.status !== 'active') {
        return res.status(400).json({ error: "Agent is not active" });
      }
      
      // Import and use the aiAgentExecutor
      const { aiAgentExecutor } = await import("./services/aiAgentExecutor");
      
      // Queue the task
      const jobId = await aiAgentExecutor.queueTask(id, taskType, context, targetId, userId);
      
      res.json({ 
        success: true, 
        jobId,
        message: "Task queued for execution"
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/agents/:id/executions", async (req, res) => {
    try {
      const { id } = req.params;
      const status = req.query.status as string;
      
      // Get executions for this agent
      const executions = await storage.getAgentExecutions({ 
        agentId: id, 
        status 
      });
      
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/agents/:id/metrics", async (req, res) => {
    try {
      const { id } = req.params;
      const date = req.query.date as string;
      
      // Get metrics for this agent
      const metrics = await storage.getAgentMetrics(id, date);
      
      if (!metrics) {
        // Return default metrics if none exist
        res.json({
          agentId: id,
          date: date || new Date().toISOString().split('T')[0],
          tasksCompleted: 0,
          tasksFailed: 0,
          avgExecutionTime: 0,
          successRate: 0,
          leadsGenerated: 0,
          emailsComposed: 0,
          dataEnriched: 0
        });
      } else {
        res.json(metrics);
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/executions/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // First check if it exists in database
      const execution = await storage.getAgentExecution(jobId);
      
      if (!execution) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      res.json(execution);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Onboarding routes
  app.get("/api/onboarding/profile", async (req, res) => {
    try {
      // Authentication is now properly enforced
      const TESTING_MODE = false; // Must match the flag in auth middleware
      if (TESTING_MODE) {
        res.json({ 
          userId: 'test-user-123',
          company: 'Test Company',
          industry: 'Technology',
          role: 'Sales Manager',
          onboardingStep: 5,
          isComplete: true 
        });
        return;
      }
      
      const userId = (req as any).session?.userId || "demo-user";
      const profile = await storage.getOnboardingProfile(userId);
      res.json(profile || { onboardingStep: 1, isComplete: false });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Reset onboarding for demo/testing purposes
  app.delete("/api/onboarding/reset", async (req, res) => {
    try {
      const { onboardingProfiles } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const userId = (req as any).session?.userId || "demo-user";
      // Delete the onboarding profile to allow re-running onboarding
      await db.delete(onboardingProfiles).where(eq(onboardingProfiles.userId, userId));
      res.json({ success: true, message: "Onboarding reset" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/onboarding/profile", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || "demo-user";
      const { insertOnboardingProfileSchema } = await import("@shared/schema");
      const profile = insertOnboardingProfileSchema.parse({ ...req.body, userId });
      const created = await storage.createOnboardingProfile(profile);
      res.json(created);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.patch("/api/onboarding/profile", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || "demo-user";
      const updates = { ...req.body };
      // Don't modify completedAt here - let the database handle it
      const updated = await storage.updateOnboardingProfile(userId, updates);
      res.json(updated || {});
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/onboarding/auto-configure", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || "demo-user";
      const { industry, companySize, targetMarket, primaryGoal } = req.body;
      
      // AI-based auto-configuration logic
      const config: {
        personas: any[];
        sequences: any[];
        agents: any[];
        templates: any[];
      } = {
        personas: [],
        sequences: [],
        agents: [],
        templates: []
      };

      // Auto-generate personas based on industry and target market
      if (industry && targetMarket) {
        const personaNames = targetMarket === 'B2B' 
          ? ['Decision Maker', 'Technical Buyer', 'End User']
          : ['Early Adopter', 'Value Seeker', 'Premium Buyer'];
          
        config.personas = personaNames.map(name => ({
          name: `${industry} ${name}`,
          description: `Key buyer persona for ${industry} companies`,
          targetTitles: targetMarket === 'B2B' 
            ? ['VP', 'Director', 'Manager'] 
            : ['Individual', 'Team Lead'],
          industries: [industry],
          companySizes: [companySize || 'all'],
        }));
      }

      // Auto-generate sequences based on primary goal
      if (primaryGoal) {
        const sequenceTypes = {
          'lead_gen': ['Cold Outreach', 'Content Nurture', 'Event Follow-up'],
          'closing': ['Decision Maker', 'Objection Handling', 'Contract Follow-up'],
          'nurturing': ['Welcome Series', 'Education', 'Re-engagement'],
          'all': ['Prospecting', 'Qualification', 'Closing']
        };
        
        config.sequences = (sequenceTypes[primaryGoal as keyof typeof sequenceTypes] || sequenceTypes.all).map(name => ({
          name,
          description: `Automated ${name.toLowerCase()} sequence`,
          steps: [
            { type: 'email', delay: 0, subject: `Initial ${name}`, template: 'auto-generated' },
            { type: 'email', delay: 3, subject: `Follow-up ${name}`, template: 'auto-generated' },
            { type: 'call', delay: 5, script: 'auto-generated' }
          ]
        }));
      }

      // Auto-generate AI agents
      config.agents = [
        {
          name: 'Lead Hunter',
          type: 'prospecting',
          description: `Find ${targetMarket} prospects in ${industry}`,
          targetsPerDay: 50,
          status: 'active'
        },
        {
          name: 'Engagement Bot',
          type: 'engagement',
          description: 'Automated follow-ups and responses',
          targetsPerDay: 30,
          status: 'active'
        }
      ];

      // Auto-generate email templates
      config.templates = [
        {
          name: 'Cold Intro',
          subject: `Quick question about {{company}}`,
          body: `Hi {{firstName}},\n\nI noticed {{company}} is in the ${industry} space...`
        },
        {
          name: 'Follow-up',
          subject: `Following up - {{company}}`,
          body: `Hi {{firstName}},\n\nJust wanted to circle back on my previous message...`
        }
      ];

      // Save the auto-configuration
      await storage.updateOnboardingProfile(userId, {
        aiSuggestions: config as any,
        autoConfigured: {
          personasCount: config.personas.length,
          sequencesCount: config.sequences.length,
          agentsCount: config.agents.length,
          templatesCount: config.templates.length
        } as any
      });

      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/onboarding/apply-config", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || "demo-user";
      const { personas, sequences, agents } = req.body;
      const results: { personas: any[]; sequences: any[]; agents: any[] } = { 
        personas: [], 
        sequences: [], 
        agents: [] 
      };

      // Create personas with required fields
      if (personas?.length) {
        for (const persona of personas) {
          try {
            const created = await storage.createPersona({
              ...persona,
              createdBy: userId,
              valuePropositions: persona.valuePropositions || [],
              painPoints: persona.painPoints || [],
              // Ensure required fields have defaults
              targetTitles: persona.targetTitles || [],
              industries: persona.industries || [],
              companySizes: persona.companySizes || []
            });
            results.personas.push(created);
          } catch (error) {
            console.error('Error creating persona:', error);
          }
        }
      }

      // Create sequences with required fields
      if (sequences?.length) {
        for (const sequence of sequences) {
          try {
            const created = await storage.createSequence({
              ...sequence,
              createdBy: userId,
              status: 'active',
              // Ensure steps are properly formatted
              steps: sequence.steps || []
            });
            results.sequences.push(created);
          } catch (error) {
            console.error('Error creating sequence:', error);
          }
        }
      }

      // Create AI agents with required fields
      if (agents?.length) {
        for (const agent of agents) {
          try {
            const created = await storage.createAiAgent({
              ...agent,
              createdBy: userId,
              status: agent.status || 'active',
              targetsPerDay: agent.targetsPerDay || 50,
              type: agent.type || 'prospecting',
              configuration: agent.configuration || {},
              conversationCount: 0,
              meetingsBooked: 0,
              positiveReplies: 0,
              performance: {}
            });
            results.agents.push(created);
          } catch (error) {
            console.error('Error creating agent:', error);
          }
        }
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Deliverability routes
  app.get("/api/deliverability/domain-health/:domain", async (req, res) => {
    try {
      // Mock implementation for domain health check
      const domainHealth = {
        overall: 85 + Math.floor(Math.random() * 10),
        spf: { status: Math.random() > 0.3 ? "pass" : "warning", record: "v=spf1 include:_spf.google.com ~all" },
        dkim: { status: Math.random() > 0.2 ? "pass" : "warning", selector: "google" },
        dmarc: { status: Math.random() > 0.5 ? "pass" : "warning", policy: "p=none" },
        reputation: 88 + Math.floor(Math.random() * 10),
        blacklists: Math.random() > 0.9 ? 1 : 0,
        deliverabilityRate: 93 + Math.random() * 5,
      };
      res.json(domainHealth);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/deliverability/warming-status/:domain", async (req, res) => {
    try {
      const warmingStatus = {
        isActive: true,
        currentVolume: Math.floor(Math.random() * 100) + 50,
        targetVolume: 500,
        daysActive: Math.floor(Math.random() * 30) + 1,
        schedule: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          emails: (i + 1) * 10 + Math.floor(Math.random() * 10),
          opened: Math.floor((i + 1) * 8 + Math.random() * 5),
          replied: Math.floor((i + 1) * 2 + Math.random() * 3),
        })),
      };
      res.json(warmingStatus);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/deliverability/inbox-placement", async (req, res) => {
    try {
      const inboxPlacement = [
        { provider: "Gmail", inbox: 92 + Math.floor(Math.random() * 5), spam: 3 + Math.floor(Math.random() * 3), missing: 2 },
        { provider: "Outlook", inbox: 90 + Math.floor(Math.random() * 5), spam: 4 + Math.floor(Math.random() * 3), missing: 2 },
        { provider: "Yahoo", inbox: 88 + Math.floor(Math.random() * 5), spam: 6 + Math.floor(Math.random() * 3), missing: 2 },
        { provider: "Apple", inbox: 94 + Math.floor(Math.random() * 4), spam: 2 + Math.floor(Math.random() * 2), missing: 1 },
      ];
      res.json(inboxPlacement);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/deliverability/warming-settings", async (req, res) => {
    try {
      const { enabled, speed } = req.body;
      // Mock implementation - would update warming settings
      res.json({ success: true, enabled, speed });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/deliverability/verify-domain", async (req, res) => {
    try {
      const { domain } = req.body;
      // Mock implementation - would trigger domain verification
      res.json({ success: true, domain, verified: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ====== Magic Setup & Platform Config ======
  app.post("/api/magic-setup", async (req, res) => {
    try {
      const { linkedinUrl } = req.body;
      
      // Parse LinkedIn data (mock implementation)
      const linkedinProfile = {
        name: "John Smith",
        title: "VP of Sales at TechCorp",
        company: "TechCorp Solutions",
        industry: "SaaS", 
        companySize: "50-200",
        location: "San Francisco, CA",
        summary: "Building enterprise sales teams that consistently exceed quota",
        experience: [
          { role: "VP Sales", company: "TechCorp", duration: "3 years" },
          { role: "Sales Director", company: "DataFlow", duration: "2 years" }
        ]
      };

      // Auto-configure platform settings
      const config = await storage.createPlatformConfig({
        userId: "demo-user",
        linkedinProfile,
        linkedinUrl,
        industryPlaybook: linkedinProfile.industry === "SaaS" ? "saas_enterprise" : "generic_b2b",
        emailTemplates: {
          coldEmail: generateEmailTemplate(linkedinProfile.industry),
          followUp: generateFollowUpTemplate(linkedinProfile.industry),
          meeting: generateMeetingTemplate(linkedinProfile.industry)
        },
        sequences: {
          coldOutreach: generateMagicSetupSequenceSteps(linkedinProfile.industry),
          nurture: generateNurtureSteps(linkedinProfile.industry)
        },
        emailDomain: linkedinProfile.company.toLowerCase().replace(/\s+/g, '') + '.com',
        dailySendLimit: 50,
        warmupEnabled: true,
        autopilotEnabled: false,
        autoFollowUp: true,
        smartScheduling: true,
        leadScoringRules: generateLeadScoringRules(linkedinProfile.industry),
        qualificationCriteria: generateQualificationCriteria(linkedinProfile.industry)
      });

      // Create default playbooks based on industry
      await createDefaultPlaybooks(linkedinProfile.industry);
      
      // Create initial workflow triggers
      await createDefaultWorkflowTriggers();

      res.json({ success: true, config, profile: linkedinProfile });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/platform-config", async (req, res) => {
    try {
      const userId = "demo-user"; // Would come from session
      const config = await storage.getPlatformConfig(userId);
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/platform-config", async (req, res) => {
    try {
      const userId = "demo-user"; 
      const updates = req.body;
      const config = await storage.updatePlatformConfig(userId, updates);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ====== Workflow Triggers ======
  app.get("/api/workflow-triggers", async (req, res) => {
    try {
      const { isActive, triggerType } = req.query;
      const filters: any = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (triggerType) filters.triggerType = triggerType as string;
      
      const triggers = await storage.getWorkflowTriggers(filters);
      res.json(triggers);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/workflow-triggers", async (req, res) => {
    try {
      const trigger = await storage.createWorkflowTrigger(req.body);
      res.json(trigger);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/workflow-triggers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const trigger = await storage.updateWorkflowTrigger(id, req.body);
      if (!trigger) {
        return res.status(404).json({ error: 'Trigger not found' });
      }
      res.json(trigger);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete("/api/workflow-triggers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteWorkflowTrigger(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Trigger not found' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ====== Lead Scoring Models ======
  app.get("/api/lead-scoring-models", async (req, res) => {
    try {
      const models = await storage.getLeadScoringModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/lead-scoring-models/:id", async (req, res) => {
    try {
      const model = await storage.getLeadScoringModelById(req.params.id);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/lead-scoring-models", async (req, res) => {
    try {
      const validated = insertLeadScoringModelSchema.parse(req.body);
      const model = await storage.createLeadScoringModel(validated);
      res.json(model);
    } catch (error) {
      console.error("Error creating lead scoring model:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.patch("/api/lead-scoring-models/:id", async (req, res) => {
    try {
      const model = await storage.updateLeadScoringModel(req.params.id, req.body);
      res.json(model);
    } catch (error) {
      console.error("Error updating lead scoring model:", error);
      res.status(500).json({ error: "Failed to update model" });
    }
  });

  app.delete("/api/lead-scoring-models/:id", async (req, res) => {
    try {
      await storage.deleteLeadScoringModel(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ====== Lead Scores ======
  app.get("/api/lead-scores", async (req, res) => {
    try {
      const { contactId, modelId } = req.query;
      const scores = await storage.getLeadScores(contactId as string, modelId as string);
      res.json(scores);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/lead-scores/:id", async (req, res) => {
    try {
      const score = await storage.getLeadScoreById(req.params.id);
      if (!score) {
        return res.status(404).json({ error: "Score not found" });
      }
      res.json(score);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/lead-scores", async (req, res) => {
    try {
      const validated = insertLeadScoreSchema.parse(req.body);
      const score = await storage.createLeadScore(validated);
      res.json(score);
    } catch (error) {
      console.error("Error creating lead score:", error);
      res.status(400).json({ error: "Invalid input" });
    }
  });

  app.patch("/api/lead-scores/:id", async (req, res) => {
    try {
      const score = await storage.updateLeadScore(req.params.id, req.body);
      res.json(score);
    } catch (error) {
      console.error("Error updating lead score:", error);
      res.status(500).json({ error: "Failed to update score" });
    }
  });

  app.delete("/api/lead-scores/:id", async (req, res) => {
    try {
      await storage.deleteLeadScore(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ====== Playbooks ======
  app.get("/api/playbooks", async (req, res) => {
    try {
      const { industry, isTemplate } = req.query;
      const filters: any = {};
      if (industry) filters.industry = industry as string;
      if (isTemplate !== undefined) filters.isTemplate = isTemplate === 'true';
      
      const playbooks = await storage.getPlaybooks(filters);
      res.json(playbooks);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/playbooks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const playbook = await storage.getPlaybook(id);
      if (!playbook) {
        return res.status(404).json({ error: 'Playbook not found' });
      }
      res.json(playbook);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/playbooks", async (req, res) => {
    try {
      const playbook = await storage.createPlaybook(req.body);
      res.json(playbook);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/playbooks/:id/apply", async (req, res) => {
    try {
      const { id } = req.params;
      const playbook = await storage.getPlaybook(id);
      if (!playbook) {
        return res.status(404).json({ error: 'Playbook not found' });
      }
      
      // Apply the playbook - create sequences, templates, etc.
      const results = await applyPlaybook(playbook);
      res.json({ success: true, applied: results });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Autopilot Campaigns
  app.get("/api/autopilot/campaigns", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.createdBy) filters.createdBy = req.query.createdBy as string;
      
      const campaigns = await storage.getAutopilotCampaigns(filters);
      res.json(campaigns);
    } catch (error: any) {
      console.error("Error fetching autopilot campaigns:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/autopilot/campaigns/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const campaign = await storage.getAutopilotCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      console.error("Error fetching autopilot campaign:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/autopilot/campaigns", async (req, res) => {
    try {
      const campaign = await storage.createAutopilotCampaign(req.body);
      res.json(campaign);
    } catch (error: any) {
      console.error("Error creating autopilot campaign:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/autopilot/campaigns/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const campaign = await storage.updateAutopilotCampaign(id, req.body);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      console.error("Error updating autopilot campaign:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ====== Workflow Automation ======
  
  // Workflows
  app.get("/api/workflows", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.category) filters.category = req.query.category as string;
      if (req.query.isTemplate !== undefined) filters.isTemplate = req.query.isTemplate === 'true';
      if (userId) filters.createdBy = userId;
      
      const workflows = await storage.getWorkflows(filters);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/workflows", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const workflowData = {
        ...req.body,
        createdBy: userId || 'system',
        status: req.body.status || 'draft'
      };
      const workflow = await storage.createWorkflow(workflowData);
      res.json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      res.status(400).json({ error: "Invalid workflow data" });
    }
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    try {
      const workflow = await storage.updateWorkflow(req.params.id, req.body);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      console.error("Error updating workflow:", error);
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteWorkflow(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Parse NLP to workflow
  app.post("/api/workflows/parse-nlp", async (req, res) => {
    try {
      const { input } = req.body;
      const result = await parseNLPToWorkflow(input);
      res.json(result);
    } catch (error) {
      console.error("Error parsing NLP:", error);
      res.status(500).json({ error: "Failed to parse workflow description" });
    }
  });

  // Workflow Executions
  app.get("/api/workflow-executions", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.workflowId) filters.workflowId = req.query.workflowId as string;
      if (req.query.status) filters.status = req.query.status as string;
      
      const executions = await storage.getWorkflowExecutions(filters);
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/workflow-executions/:id", async (req, res) => {
    try {
      const execution = await storage.getWorkflowExecution(req.params.id);
      if (!execution) {
        return res.status(404).json({ error: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/workflow-executions", async (req, res) => {
    try {
      const execution = await storage.createWorkflowExecution(req.body);
      res.json(execution);
    } catch (error) {
      console.error("Error creating workflow execution:", error);
      res.status(400).json({ error: "Invalid execution data" });
    }
  });

  app.patch("/api/workflow-executions/:id", async (req, res) => {
    try {
      const execution = await storage.updateWorkflowExecution(req.params.id, req.body);
      if (!execution) {
        return res.status(404).json({ error: "Execution not found" });
      }
      res.json(execution);
    } catch (error) {
      console.error("Error updating workflow execution:", error);
      res.status(500).json({ error: "Failed to update execution" });
    }
  });

  // Agent Types
  app.get("/api/agent-types", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.category) filters.category = req.query.category as string;
      
      const agentTypes = await storage.getAgentTypes(filters);
      res.json(agentTypes);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/agent-types/:id", async (req, res) => {
    try {
      const agentType = await storage.getAgentType(req.params.id);
      if (!agentType) {
        return res.status(404).json({ error: "Agent type not found" });
      }
      res.json(agentType);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/agent-types", async (req, res) => {
    try {
      const agentType = await storage.createAgentType(req.body);
      res.json(agentType);
    } catch (error) {
      console.error("Error creating agent type:", error);
      res.status(400).json({ error: "Invalid agent type data" });
    }
  });

  app.patch("/api/agent-types/:id", async (req, res) => {
    try {
      const agentType = await storage.updateAgentType(req.params.id, req.body);
      if (!agentType) {
        return res.status(404).json({ error: "Agent type not found" });
      }
      res.json(agentType);
    } catch (error) {
      console.error("Error updating agent type:", error);
      res.status(500).json({ error: "Failed to update agent type" });
    }
  });

  // Workflow Templates
  app.get("/api/workflow-templates", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.category) filters.category = req.query.category as string;
      if (req.query.difficulty) filters.difficulty = req.query.difficulty as string;
      
      const templates = await storage.getWorkflowTemplates(filters);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/workflow-templates/:id", async (req, res) => {
    try {
      const template = await storage.getWorkflowTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/workflow-templates", async (req, res) => {
    try {
      const template = await storage.createWorkflowTemplate(req.body);
      res.json(template);
    } catch (error) {
      console.error("Error creating workflow template:", error);
      res.status(400).json({ error: "Invalid template data" });
    }
  });

  app.patch("/api/workflow-templates/:id", async (req, res) => {
    try {
      const template = await storage.updateWorkflowTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating workflow template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  // Human Approvals
  app.get("/api/human-approvals", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.executionId) filters.executionId = req.query.executionId as string;
      if (req.query.status) filters.status = req.query.status as string;
      
      const approvals = await storage.getHumanApprovals(filters);
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/human-approvals/:id", async (req, res) => {
    try {
      const approval = await storage.getHumanApproval(req.params.id);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/human-approvals", async (req, res) => {
    try {
      const approval = await storage.createHumanApproval(req.body);
      res.json(approval);
    } catch (error) {
      console.error("Error creating human approval:", error);
      res.status(400).json({ error: "Invalid approval data" });
    }
  });

  app.patch("/api/human-approvals/:id", async (req, res) => {
    try {
      const approval = await storage.updateHumanApproval(req.params.id, req.body);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      console.error("Error updating human approval:", error);
      res.status(500).json({ error: "Failed to update approval" });
    }
  });

  // Execute a workflow
  app.post("/api/workflows/:id/execute", async (req, res) => {
    try {
      const { id } = req.params;
      const { context } = req.body;
      
      const execution = await executeWorkflow(id, context || {});
      res.json(execution);
    } catch (error) {
      console.error("Error executing workflow:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Workflow execution failed' });
    }
  });

  // Resume a paused workflow
  app.post("/api/workflow-executions/:executionId/resume", async (req, res) => {
    try {
      const { executionId } = req.params;
      const { approvalId, approved, feedback } = req.body;
      
      const execution = await resumeWorkflow(executionId, approvalId, approved, feedback);
      res.json(execution);
    } catch (error) {
      console.error("Error resuming workflow:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to resume workflow' });
    }
  });

  app.post("/api/autopilot/campaigns/:id/toggle", async (req, res) => {
    const { id } = req.params;
    try {
      const campaign = await storage.getAutopilotCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      const newStatus = campaign.status === "active" ? "paused" : "active";
      const updated = await storage.updateAutopilotCampaign(id, { 
        status: newStatus,
        lastRunAt: newStatus === "active" ? new Date() : campaign.lastRunAt
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error toggling autopilot campaign:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/autopilot/campaigns/:id/runs", async (req, res) => {
    const { id } = req.params;
    try {
      const runs = await storage.getAutopilotRunsByCampaign(id);
      res.json(runs);
    } catch (error: any) {
      console.error("Error fetching autopilot runs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/autopilot/campaigns/:id/run", async (req, res) => {
    const { id } = req.params;
    try {
      const campaign = await storage.getAutopilotCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      // Create a new run
      const run = await storage.createAutopilotRun({
        campaignId: id,
        status: "running",
        runType: "prospecting",
        leadsProcessed: 0,
        emailsSent: 0,
        emailsSkipped: 0
      });

      // Simulate autonomous processing (in production, this would be handled by a job queue)
      setTimeout(async () => {
        const leadsProcessed = Math.floor(Math.random() * 20) + 10;
        const emailsSent = Math.floor(Math.random() * leadsProcessed);
        
        await storage.updateAutopilotRun(run.id, {
          status: "completed",
          leadsProcessed,
          emailsSent,
          emailsSkipped: leadsProcessed - emailsSent,
          completedAt: new Date(),
          duration: Math.floor(Math.random() * 300) + 60
        });

        await storage.updateAutopilotCampaign(id, {
          totalLeadsProcessed: (campaign.totalLeadsProcessed || 0) + leadsProcessed,
          totalEmailsSent: (campaign.totalEmailsSent || 0) + emailsSent,
          totalReplies: (campaign.totalReplies || 0) + Math.floor(emailsSent * 0.15),
          totalMeetingsBooked: (campaign.totalMeetingsBooked || 0) + Math.floor(emailsSent * 0.05)
        });
      }, 5000);

      res.json({ message: "Autopilot run started", run });
    } catch (error: any) {
      console.error("Error starting autopilot run:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Marketplace API Routes
  app.get("/api/marketplace/agents", async (req: any, res) => {
    try {
      const { category, minRating, maxPrice, tags } = req.query;
      
      const filters: any = {};
      if (category) filters.category = category;
      if (minRating) filters.minRating = parseFloat(minRating);
      if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
      if (tags) filters.tags = Array.isArray(tags) ? tags : tags.split(',');
      
      const agents = await storage.getMarketplaceAgents(filters);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching marketplace agents:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch agents' });
    }
  });

  app.get("/api/marketplace/agents/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const agent = await storage.getMarketplaceAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Get ratings for this agent
      const ratings = await storage.getAgentRatings(id);
      
      // Check if user has downloaded/purchased this agent
      const userId = req.user.claims.sub;
      const hasDownloaded = await storage.hasUserDownloadedAgent(id, userId);
      const hasPurchased = parseFloat(agent.price) > 0 
        ? await storage.hasUserPurchasedAgent(id, userId) 
        : true;
      
      res.json({ 
        ...agent, 
        ratings, 
        hasDownloaded, 
        hasPurchased,
        canDownload: hasPurchased || parseFloat(agent.price) === 0
      });
    } catch (error) {
      console.error("Error fetching agent details:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch agent' });
    }
  });

  app.post("/api/marketplace/agents", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertMarketplaceAgentSchema.parse({
        ...req.body,
        author: userId
      });
      
      const agent = await storage.createMarketplaceAgent(validatedData);
      res.json(agent);
    } catch (error) {
      console.error("Error publishing agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish agent' });
    }
  });

  app.post("/api/marketplace/agents/:id/download", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const agent = await storage.getMarketplaceAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      // Check if user can download (free or already purchased)
      const price = parseFloat(agent.price);
      if (price > 0) {
        const hasPurchased = await storage.hasUserPurchasedAgent(id, userId);
        if (!hasPurchased) {
          return res.status(403).json({ error: "Please purchase this agent before downloading" });
        }
      }
      
      // Record download
      const download = await storage.createAgentDownload({
        agentId: id,
        userId,
        version: agent.version
      });
      
      res.json({ 
        message: "Agent downloaded successfully",
        agent,
        download
      });
    } catch (error) {
      console.error("Error downloading agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to download agent' });
    }
  });

  app.post("/api/marketplace/agents/:id/rate", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { rating, review } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      // Check if user has already rated
      const existingRating = await storage.getUserAgentRating(id, userId);
      
      if (existingRating) {
        // Update existing rating
        const updated = await storage.updateAgentRating(existingRating.id, {
          rating,
          review
        });
        res.json(updated);
      } else {
        // Create new rating
        const validatedData = insertAgentRatingSchema.parse({
          agentId: id,
          userId,
          rating,
          review
        });
        
        const newRating = await storage.createAgentRating(validatedData);
        res.json(newRating);
      }
    } catch (error) {
      console.error("Error rating agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to rate agent' });
    }
  });

  app.get("/api/marketplace/my-agents", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getMarketplaceAgentsByUser(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching user agents:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch user agents' });
    }
  });

  app.patch("/api/marketplace/agents/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify ownership
      const agent = await storage.getMarketplaceAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (agent.author !== userId) {
        return res.status(403).json({ error: "You can only update your own agents" });
      }
      
      const updated = await storage.updateMarketplaceAgent(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update agent' });
    }
  });

  app.delete("/api/marketplace/agents/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify ownership
      const agent = await storage.getMarketplaceAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (agent.author !== userId) {
        return res.status(403).json({ error: "You can only delete your own agents" });
      }
      
      const deleted = await storage.deleteMarketplaceAgent(id);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete agent' });
    }
  });

  app.post("/api/marketplace/agents/:id/purchase", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { transactionId } = req.body;
      
      const agent = await storage.getMarketplaceAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const price = parseFloat(agent.price);
      if (price === 0) {
        return res.status(400).json({ error: "This agent is free, no purchase required" });
      }
      
      // Check if already purchased
      const hasPurchased = await storage.hasUserPurchasedAgent(id, userId);
      if (hasPurchased) {
        return res.status(400).json({ error: "You have already purchased this agent" });
      }
      
      // Record purchase (in production, this would integrate with a payment provider)
      const purchase = await storage.createAgentPurchase({
        agentId: id,
        userId,
        amount: agent.price,
        transactionId: transactionId || `demo-${Date.now()}`
      });
      
      res.json({ 
        message: "Agent purchased successfully",
        purchase
      });
    } catch (error) {
      console.error("Error purchasing agent:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to purchase agent' });
    }
  });

  // Deal Intelligence API Routes
  app.post("/api/intelligence/signals", async (req: any, res) => {
    try {
      const validatedData = insertIntentSignalSchema.parse(req.body);
      const signal = await dealIntelligenceEngine.captureIntent(validatedData);
      res.json(signal);
    } catch (error) {
      console.error("Error capturing intent signal:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to capture signal' });
    }
  });

  app.get("/api/intelligence/company/:id", async (req: any, res) => {
    try {
      const companyId = req.params.id;
      
      // Get deal intelligence
      const intelligence = await storage.getDealIntelligenceByCompany(companyId);
      
      // Get additional data
      const intentScore = await dealIntelligenceEngine.calculateIntentScore(companyId);
      const buyingStage = await dealIntelligenceEngine.predictBuyingStage(companyId);
      const champions = await dealIntelligenceEngine.identifyChampions(companyId);
      const blockers = await dealIntelligenceEngine.detectBlockers(companyId);
      const forecast = await dealIntelligenceEngine.forecastDealOutcome(companyId);
      
      res.json({
        intelligence,
        intentScore,
        buyingStage,
        champions,
        blockers,
        forecast
      });
    } catch (error) {
      console.error("Error fetching company intelligence:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch intelligence' });
    }
  });

  app.get("/api/intelligence/timing/:contactId", async (req: any, res) => {
    try {
      const contactId = req.params.contactId;
      const timing = await dealIntelligenceEngine.predictOptimalTiming(contactId);
      res.json(timing);
    } catch (error) {
      console.error("Error predicting optimal timing:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to predict timing' });
    }
  });

  app.post("/api/intelligence/predict", async (req: any, res) => {
    try {
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }
      
      const forecast = await dealIntelligenceEngine.forecastDealOutcome(companyId);
      res.json(forecast);
    } catch (error) {
      console.error("Error running predictive models:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run predictions' });
    }
  });

  app.get("/api/intelligence/alerts", async (req: any, res) => {
    try {
      const microMoments = await dealIntelligenceEngine.generateMicroMoments();
      res.json(microMoments);
    } catch (error) {
      console.error("Error generating alerts:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate alerts' });
    }
  });

  app.get("/api/intelligence/insights", async (req: any, res) => {
    try {
      // Get recent signals and aggregate insights
      const signals = await storage.getIntentSignals({ limit: 100 });
      
      // Group by signal type
      const signalTypes: Record<string, number> = {};
      signals.forEach(signal => {
        signalTypes[signal.signalType] = (signalTypes[signal.signalType] || 0) + 1;
      });
      
      // Get companies with high intent
      const companies = await storage.getCompanies(50);
      const companyScores = await Promise.all(
        companies.map(async (company) => {
          const score = await dealIntelligenceEngine.calculateIntentScore(company.id);
          return { company, score };
        })
      );
      
      const hotCompanies = companyScores
        .filter(c => c.score > 70)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      res.json({
        totalSignals: signals.length,
        signalDistribution: signalTypes,
        hotCompanies: hotCompanies.map(c => ({
          id: c.company.id,
          name: c.company.name,
          intentScore: c.score
        })),
        trendsDetected: [
          { trend: "Increased pricing interest", change: "+23%", period: "7 days" },
          { trend: "Competitor research activity", change: "+15%", period: "30 days" },
          { trend: "Demo requests", change: "+41%", period: "7 days" }
        ]
      });
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch insights' });
    }
  });

  // Revenue Operations API Routes
  app.get("/api/revenue-ops/health", async (req: any, res) => {
    try {
      const health = await revenueOpsCenter.analyzePipelineHealth();
      res.json(health);
    } catch (error) {
      console.error("Error fetching pipeline health:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch pipeline health' });
    }
  });

  app.post("/api/revenue-ops/forensics", async (req: any, res) => {
    try {
      const { dealId, analysisType } = req.body;
      
      if (!dealId || !analysisType) {
        return res.status(400).json({ error: "Deal ID and analysis type are required" });
      }
      
      if (!['won', 'lost', 'stuck'].includes(analysisType)) {
        return res.status(400).json({ error: "Analysis type must be won, lost, or stuck" });
      }
      
      const forensics = await revenueOpsCenter.performDealForensics(dealId, analysisType);
      res.json(forensics);
    } catch (error) {
      console.error("Error performing deal forensics:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to perform deal forensics' });
    }
  });

  app.get("/api/revenue-ops/forecast", async (req: any, res) => {
    try {
      const period = req.query.period as string || 'Q1 2025';
      const forecast = await revenueOpsCenter.generateForecast(period);
      res.json(forecast);
    } catch (error) {
      console.error("Error generating revenue forecast:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate forecast' });
    }
  });

  app.get("/api/revenue-ops/risks", async (req: any, res) => {
    try {
      const risks = await revenueOpsCenter.identifyRisks();
      const recommendations = await revenueOpsCenter.recommendActions();
      
      res.json({
        risks,
        recommendations,
        totalAtRisk: risks.reduce((sum, r) => sum + r.dealCount, 0),
        totalValueAtRisk: risks.reduce((sum, r) => sum + r.totalValue, 0)
      });
    } catch (error) {
      console.error("Error identifying pipeline risks:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to identify risks' });
    }
  });

  app.get("/api/revenue-ops/coaching", async (req: any, res) => {
    try {
      const userId = req.query.userId as string || req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const insights = await revenueOpsCenter.generateCoachingInsights(userId);
      res.json(insights);
    } catch (error) {
      console.error("Error generating coaching insights:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate coaching insights' });
    }
  });

  app.post("/api/revenue-ops/intervene", async (req: any, res) => {
    try {
      const { type, dealId, action } = req.body;
      
      if (!type || !action) {
        return res.status(400).json({ error: "Intervention type and action are required" });
      }
      
      // Simulate intervention (in production, this would trigger actual workflows)
      const intervention = {
        id: `int-${Date.now()}`,
        type,
        dealId,
        action,
        triggeredBy: req.user?.claims?.sub,
        triggeredAt: new Date(),
        status: 'initiated',
        expectedImpact: 'medium'
      };
      
      res.json({
        message: "Intervention triggered successfully",
        intervention
      });
    } catch (error) {
      console.error("Error triggering intervention:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to trigger intervention' });
    }
  });

  app.get("/api/revenue-ops/velocity", async (req: any, res) => {
    try {
      const velocity = await revenueOpsCenter.trackVelocity();
      res.json(velocity);
    } catch (error) {
      console.error("Error tracking deal velocity:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to track velocity' });
    }
  });

  app.get("/api/revenue-ops/win-loss", async (req: any, res) => {
    try {
      const analysis = await revenueOpsCenter.analyzeWinLoss();
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing win/loss patterns:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze win/loss' });
    }
  });

  // Digital Twin API Routes
  app.get("/api/digital-twins/:contactId", async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const twin = await storage.getDigitalTwinByContact(contactId);
      
      if (!twin) {
        return res.status(404).json({ error: "Digital twin not found for this contact" });
      }
      
      res.json(twin);
    } catch (error) {
      console.error("Error fetching digital twin:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch digital twin' });
    }
  });

  app.post("/api/digital-twins", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { contactId } = req.body;
      
      if (!contactId) {
        return res.status(400).json({ error: "Contact ID is required" });
      }
      
      const twin = await digitalTwinEngine.createTwin(contactId);
      res.json(twin);
    } catch (error) {
      console.error("Error creating digital twin:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create digital twin' });
    }
  });

  app.put("/api/digital-twins/:id/learn", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      const interaction = req.body;
      
      // Create interaction record
      const twinInteraction = await storage.createTwinInteraction({
        twinId: id,
        ...interaction
      });
      
      // Update the twin model based on the interaction
      const updatedTwin = await digitalTwinEngine.updateTwin(id, twinInteraction);
      res.json({ twin: updatedTwin, interaction: twinInteraction });
    } catch (error) {
      console.error("Error updating digital twin:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update digital twin' });
    }
  });

  app.get("/api/digital-twins/:id/recommend", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      
      const recommendation = await digitalTwinEngine.recommendNextAction(id);
      res.json(recommendation);
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get recommendations' });
    }
  });

  app.post("/api/digital-twins/:id/personalize", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      const { template } = req.body;
      
      if (!template) {
        return res.status(400).json({ error: "Template is required" });
      }
      
      const personalizedContent = await digitalTwinEngine.generatePersonalizedContent(id, template);
      res.json({ content: personalizedContent });
    } catch (error) {
      console.error("Error personalizing content:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to personalize content' });
    }
  });

  app.get("/api/digital-twins/insights", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const insights = await digitalTwinEngine.getAggregateInsights();
      res.json(insights);
    } catch (error) {
      console.error("Error getting insights:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get insights' });
    }
  });

  app.get("/api/digital-twins/:id/patterns", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      
      const patterns = await digitalTwinEngine.analyzeResponsePatterns(id);
      res.json(patterns);
    } catch (error) {
      console.error("Error analyzing patterns:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze patterns' });
    }
  });

  app.get("/api/digital-twins/:id/buying-stage", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      
      const prediction = await digitalTwinEngine.predictBuyingStage(id);
      res.json(prediction);
    } catch (error) {
      console.error("Error predicting buying stage:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to predict buying stage' });
    }
  });

  app.get("/api/digital-twins/:id/approach", async (req: any, res) => {
    try {
      const { digitalTwinEngine } = await import("./services/digitalTwin");
      const { id } = req.params;
      const { messageType = "general" } = req.query;
      
      const approach = await digitalTwinEngine.predictBestApproach(id, messageType as string);
      res.json(approach);
    } catch (error) {
      console.error("Error predicting approach:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to predict approach' });
    }
  });

  app.get("/api/digital-twins/:id/interactions", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;
      
      const interactions = await storage.getTwinInteractions(id, parseInt(limit as string));
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching interactions:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch interactions' });
    }
  });

  app.get("/api/digital-twins/:id/predictions", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { type } = req.query;
      
      const predictions = await storage.getTwinPredictions(id, type as string);
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch predictions' });
    }
  });
  
  app.delete("/api/digital-twins/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if twin exists
      const twin = await storage.getDigitalTwin(id);
      if (!twin) {
        return res.status(404).json({ error: 'Digital twin not found' });
      }
      
      // Check ownership through the contact
      const contact = await storage.getContact(twin.contactId);
      if (!contact) {
        return res.status(404).json({ error: 'Associated contact not found' });
      }
      
      // Check if user owns the contact (simplified authorization)
      // In a real system, you'd check if the user has permission to manage this contact
      // For now, we'll allow any authenticated user to delete twins
      
      const success = await storage.deleteDigitalTwin(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Failed to delete digital twin' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting digital twin:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete digital twin' });
    }
  });

  // SDR Teams Routes
  app.get("/api/sdr-teams", async (req: any, res) => {
    try {
      const { teamType, isActive } = req.query;
      const filters: any = {};
      
      if (teamType) filters.teamType = teamType;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (req.user?.claims?.sub) filters.createdBy = req.user.claims.sub;
      
      const teams = await sdrTeamManager.getAllTeamsWithMetrics();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching SDR teams:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch teams' });
    }
  });

  app.post("/api/sdr-teams", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, teamType, roles, strategy } = req.body;
      
      if (!name || !roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "Name and roles are required" });
      }
      
      const team = await sdrTeamManager.createTeam({
        name,
        description,
        teamType,
        roles,
        strategy,
        createdBy: userId
      });
      
      res.json(team);
    } catch (error) {
      console.error("Error creating SDR team:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create team' });
    }
  });

  app.get("/api/sdr-teams/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const teamDetails = await sdrTeamManager.getTeamDetails(id);
      res.json(teamDetails);
    } catch (error) {
      console.error("Error fetching team details:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch team details' });
    }
  });

  app.post("/api/sdr-teams/:id/assign", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { dealId, contactId, companyId } = req.body;
      
      if (!dealId && !contactId && !companyId) {
        return res.status(400).json({ error: "At least one of dealId, contactId, or companyId is required" });
      }
      
      const collaboration = await sdrTeamManager.assignDeal(id, {
        dealId,
        contactId,
        companyId
      });
      
      res.json(collaboration);
    } catch (error) {
      console.error("Error assigning deal to team:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to assign deal' });
    }
  });

  app.get("/api/sdr-teams/:id/performance", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { period = 'weekly' } = req.query;
      
      const performance = await sdrTeamManager.reviewPerformance(
        id, 
        period as 'daily' | 'weekly' | 'monthly'
      );
      
      res.json(performance);
    } catch (error) {
      console.error("Error fetching team performance:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch performance' });
    }
  });

  app.post("/api/sdr-teams/:id/collaborate", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { type, context, targetContactId, targetCompanyId } = req.body;
      
      if (!type || !context) {
        return res.status(400).json({ error: "Type and context are required" });
      }
      
      const validTypes = ["research", "outreach", "qualification", "scheduling", "review"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` });
      }
      
      const result = await sdrTeamManager.orchestrateCollaboration(id, {
        type: type as any,
        context,
        targetContactId,
        targetCompanyId
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error orchestrating collaboration:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to orchestrate collaboration' });
    }
  });

  app.put("/api/sdr-teams/:id/optimize", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const optimization = await sdrTeamManager.optimizeTeamComposition(id);
      res.json(optimization);
    } catch (error) {
      console.error("Error optimizing team:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to optimize team' });
    }
  });

  // Multi-Channel Orchestration Routes
  app.get("/api/channels", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channels = await storage.getChannelConfigs(userId);
      res.json(channels);
    } catch (error) {
      console.error("Error fetching channels:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch channels' });
    }
  });

  app.post("/api/channels/configure", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { channel, settings } = req.body;
      
      if (!channel || !settings) {
        return res.status(400).json({ error: "Channel and settings are required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const config = await multiChannelOrchestrator.configureChannel(userId, channel, settings);
      res.json(config);
    } catch (error) {
      console.error("Error configuring channel:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to configure channel' });
    }
  });

  app.get("/api/multi-channel/campaigns", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaigns = await storage.getMultiChannelCampaigns({ createdBy: userId });
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch campaigns' });
    }
  });

  app.post("/api/multi-channel/campaigns", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaignData = {
        ...req.body,
        createdBy: userId,
        status: req.body.status || 'draft'
      };
      
      // Validate required fields
      if (!campaignData.name || !campaignData.channels || !Array.isArray(campaignData.channels) || campaignData.channels.length === 0) {
        return res.status(400).json({ error: "Name and at least one channel are required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const campaign = await multiChannelOrchestrator.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create campaign' });
    }
  });

  app.post("/api/multi-channel/send", async (req: any, res) => {
    try {
      const { campaignId, contactId } = req.body;
      
      if (!campaignId || !contactId) {
        return res.status(400).json({ error: "Campaign ID and contact ID are required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const result = await multiChannelOrchestrator.orchestrateOutreach(campaignId, contactId);
      res.json(result);
    } catch (error) {
      console.error("Error sending multi-channel message:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send message' });
    }
  });

  app.get("/api/multi-channel/analytics", async (req: any, res) => {
    try {
      const { campaignId } = req.query;
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const analytics = await multiChannelOrchestrator.getChannelAnalytics(campaignId as string | undefined);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch analytics' });
    }
  });

  app.post("/api/multi-channel/optimize", async (req: any, res) => {
    try {
      const { campaignId } = req.body;
      
      if (!campaignId) {
        return res.status(400).json({ error: "Campaign ID is required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const optimization = await multiChannelOrchestrator.optimizeChannelMix(campaignId);
      res.json(optimization);
    } catch (error) {
      console.error("Error optimizing channel mix:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to optimize channel mix' });
    }
  });

  app.post("/api/multi-channel/switch-channel", async (req: any, res) => {
    try {
      const { contactId, campaignId, reason } = req.body;
      
      if (!contactId || !campaignId || !reason) {
        return res.status(400).json({ error: "Contact ID, campaign ID, and reason are required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      const result = await multiChannelOrchestrator.switchChannel(contactId, campaignId, reason);
      res.json(result);
    } catch (error) {
      console.error("Error switching channel:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to switch channel' });
    }
  });

  app.post("/api/multi-channel/track-engagement", async (req: any, res) => {
    try {
      const { messageId, engagement } = req.body;
      
      if (!messageId || !engagement) {
        return res.status(400).json({ error: "Message ID and engagement data are required" });
      }
      
      // Import the orchestrator
      const { multiChannelOrchestrator } = await import('./services/multiChannel');
      await multiChannelOrchestrator.trackEngagement(messageId, engagement);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking engagement:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to track engagement' });
    }
  });

  // Voice AI Routes
  // Create voice campaign
  app.post("/api/voice/campaigns", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertVoiceCampaignSchema.parse({ ...req.body, createdBy: userId });
      const campaign = await createVoiceCampaign(validatedData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating voice campaign:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create voice campaign' });
    }
  });
  
  // Get voice campaigns
  app.get("/api/voice/campaigns", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status } = req.query;
      const campaigns = await getVoiceCampaigns({ 
        status: status as string,
        createdBy: userId 
      });
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching voice campaigns:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch voice campaigns' });
    }
  });
  
  app.put("/api/voice/campaigns/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if campaign exists and user owns it
      const existing = await storage.getVoiceCampaign(id);
      if (!existing) {
        return res.status(404).json({ error: 'Voice campaign not found' });
      }
      if (existing.createdBy !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this campaign' });
      }
      
      // Validate partial update data
      const validatedData = insertVoiceCampaignSchema.partial().parse(req.body);
      const updated = await storage.updateVoiceCampaign(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: 'Failed to update voice campaign' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating voice campaign:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update voice campaign' });
    }
  });
  
  app.delete("/api/voice/campaigns/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if campaign exists and user owns it
      const existing = await storage.getVoiceCampaign(id);
      if (!existing) {
        return res.status(404).json({ error: 'Voice campaign not found' });
      }
      if (existing.createdBy !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this campaign' });
      }
      
      const success = await storage.deleteVoiceCampaign(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Failed to delete voice campaign' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting voice campaign:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete voice campaign' });
    }
  });
  
  // Initiate single call
  app.post("/api/voice/call", async (req: any, res) => {
    try {
      const { contactId, scriptId, campaignId } = req.body;
      
      if (!contactId || !scriptId) {
        return res.status(400).json({ error: "Contact ID and Script ID are required" });
      }
      
      // Check compliance before initiating call
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      const complianceCheck = await voiceAIManager.checkCompliance(contact.phoneNumber || '');
      if (!complianceCheck.canCall) {
        return res.status(403).json({ 
          error: "Cannot initiate call", 
          reason: complianceCheck.reason 
        });
      }
      
      const call = await voiceAIManager.initiateCall(contactId, scriptId, campaignId);
      res.json(call);
    } catch (error) {
      console.error("Error initiating call:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to initiate call' });
    }
  });
  
  // Get call details
  app.get("/api/voice/calls/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const call = await storage.getVoiceCall(id);
      
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      
      res.json(call);
    } catch (error) {
      console.error("Error fetching call details:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch call details' });
    }
  });
  
  // Get all calls
  app.get("/api/voice/calls", async (req, res) => {
    try {
      const { campaignId, contactId, status } = req.query;
      const calls = await storage.getVoiceCalls({
        campaignId: campaignId as string,
        contactId: contactId as string,
        callStatus: status as string,
      });
      res.json(calls);
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch calls' });
    }
  });
  
  // Get call transcript
  app.get("/api/voice/transcript/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const call = await storage.getVoiceCall(id);
      
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      
      // If no transcript yet, generate one for demo
      if (!call.transcript) {
        const transcript = await voiceAIManager.transcribeCall(call.recordingUrl || '');
        await storage.updateVoiceCall(id, { transcript });
        return res.json({ transcript });
      }
      
      res.json({ transcript: call.transcript });
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch transcript' });
    }
  });
  
  // Analyze call performance
  app.post("/api/voice/analyze", async (req, res) => {
    try {
      const { callId } = req.body;
      
      if (!callId) {
        return res.status(400).json({ error: "Call ID is required" });
      }
      
      const analytics = await voiceAIManager.analyzeCall(callId);
      res.json(analytics);
    } catch (error) {
      console.error("Error analyzing call:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to analyze call' });
    }
  });
  
  // Get voice channel analytics
  app.get("/api/voice/analytics", async (req, res) => {
    try {
      const { campaignId, period } = req.query;
      
      let analytics;
      let avgDuration = 0;
      
      if (campaignId) {
        analytics = await getCampaignAnalytics(campaignId as string);
      } else {
        // Get all recent analytics
        const calls = await storage.getVoiceCalls({});
        const limitedCalls = calls.slice(0, 100); // Limit to recent 100 calls
        const analyticsPromises = limitedCalls.map(call => getCallAnalytics(call.id));
        
        const results = await Promise.all(analyticsPromises);
        analytics = results.filter(Boolean);
        
        // Create a map of callId to VoiceCall for duration lookup
        const callMap = new Map(limitedCalls.map(call => [call.id, call]));
        
        // Calculate average duration from VoiceCall records
        const totalDuration = analytics.reduce((acc: number, a: any) => {
          const call = callMap.get(a.callId);
          return acc + (call?.duration || 0);
        }, 0);
        
        avgDuration = analytics.length > 0 ? totalDuration / analytics.length : 0;
      }
      
      // Calculate aggregate metrics
      const aggregateMetrics = {
        totalCalls: analytics.length,
        avgDuration,
        avgSpeakingRatio: analytics.reduce((acc: number, a: any) => 
          acc + parseFloat(a.speakingRatio || '0'), 0) / analytics.length || 0,
        totalObjections: analytics.reduce((acc: number, a: any) => 
          acc + (a.objectionCount || 0), 0),
        positiveSignals: analytics.reduce((acc: number, a: any) => 
          acc + (a.positiveSignals || 0), 0),
        negativeSignals: analytics.reduce((acc: number, a: any) => 
          acc + (a.negativeSignals || 0), 0),
      };
      
      res.json({
        analytics,
        aggregateMetrics,
        period: period || 'all_time',
      });
    } catch (error) {
      console.error("Error fetching voice analytics:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch voice analytics' });
    }
  });
  
  // Create/edit voice scripts
  app.post("/api/voice/scripts", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertVoiceScriptSchema.parse({ ...req.body, createdBy: userId });
      const script = await createVoiceScript(validatedData);
      res.json(script);
    } catch (error) {
      console.error("Error creating voice script:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create voice script' });
    }
  });
  
  // Get voice scripts
  app.get("/api/voice/scripts", async (req: any, res) => {
    try {
      const { scriptType, isActive } = req.query;
      const scripts = await getVoiceScripts({
        scriptType: scriptType as string,
        isActive: isActive === 'true',
      });
      res.json(scripts);
    } catch (error) {
      console.error("Error fetching voice scripts:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch voice scripts' });
    }
  });
  
  // Update voice script
  app.patch("/api/voice/scripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const script = await storage.updateVoiceScript(id, req.body);
      
      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }
      
      res.json(script);
    } catch (error) {
      console.error("Error updating voice script:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update voice script' });
    }
  });
  
  // Handle real-time conversation (webhook for telephony provider)
  app.post("/api/voice/conversation", async (req, res) => {
    try {
      const { callId, input } = req.body;
      
      if (!callId || !input) {
        return res.status(400).json({ error: "Call ID and input are required" });
      }
      
      const response = await voiceAIManager.handleConversation(callId, input);
      res.json({ response });
    } catch (error) {
      console.error("Error handling conversation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to handle conversation' });
    }
  });
  
  // Schedule callback
  app.post("/api/voice/callback", async (req, res) => {
    try {
      const { contactId, time, notes } = req.body;
      
      if (!contactId || !time) {
        return res.status(400).json({ error: "Contact ID and time are required" });
      }
      
      const scheduled = await voiceAIManager.scheduleCallback(
        contactId, 
        new Date(time), 
        notes
      );
      
      res.json({ success: scheduled });
    } catch (error) {
      console.error("Error scheduling callback:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to schedule callback' });
    }
  });

  // ====== Browser Extension API Routes ======
  
  // Authenticate extension and get/generate API key
  app.post("/api/extension/auth", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const result = await browserExtensionService.authenticateExtension(userId);
      res.json(result);
    } catch (error) {
      console.error("Error authenticating extension:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to authenticate extension' });
    }
  });
  
  // Enrich prospect/company data
  app.post("/api/extension/enrich", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { url, domain, type } = req.body;
      
      if (!url && !domain) {
        return res.status(400).json({ error: "URL or domain is required" });
      }
      
      let result;
      if (type === 'company' && domain) {
        result = await browserExtensionService.enrichCompany(domain, userId);
      } else if (type === 'technologies' && domain) {
        result = await browserExtensionService.detectTechnologies(domain, userId);
      } else if (url) {
        result = await browserExtensionService.enrichProfile(url, userId);
      } else {
        return res.status(400).json({ error: "Invalid enrichment type" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error enriching data:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to enrich data' });
    }
  });
  
  // Get cached enrichment data for a domain
  app.get("/api/extension/cached/:domain", async (req: any, res) => {
    try {
      const { domain } = req.params;
      const cache = await storage.getEnrichmentCacheByDomain(domain);
      
      if (!cache) {
        return res.status(404).json({ error: "No cached data found" });
      }
      
      res.json(cache);
    } catch (error) {
      console.error("Error fetching cached data:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch cached data' });
    }
  });
  
  // Save enriched lead to database
  app.post("/api/extension/save", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const data = req.body;
      const result = await browserExtensionService.saveToDatabase(data, userId);
      res.json(result);
    } catch (error) {
      console.error("Error saving enriched data:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save data' });
    }
  });
  
  // Execute quick action from extension
  app.post("/api/extension/action", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { action, data } = req.body;
      
      if (!action) {
        return res.status(400).json({ error: "Action type is required" });
      }
      
      const result = await browserExtensionService.executeQuickAction(action, data, userId);
      res.json(result);
    } catch (error) {
      console.error("Error executing quick action:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute action' });
    }
  });
  
  // Get user's extension settings
  app.get("/api/extension/settings", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const settings = await browserExtensionService.getExtensionSettings(userId);
      
      if (!settings) {
        return res.status(404).json({ error: "Extension not configured" });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching extension settings:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch settings' });
    }
  });
  
  // Update extension settings
  app.patch("/api/extension/settings", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const settings = req.body;
      const updated = await browserExtensionService.updateExtensionSettings(userId, settings);
      
      if (!updated) {
        return res.status(404).json({ error: "Extension not configured" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating extension settings:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update settings' });
    }
  });
  
  // Get extension usage statistics
  app.get("/api/extension/stats", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const stats = await browserExtensionService.getExtensionStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching extension stats:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch stats' });
    }
  });
  
  // Get recent extension activities
  app.get("/api/extension/activities", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getExtensionActivities({ userId, limit });
      res.json(activities);
    } catch (error) {
      console.error("Error fetching extension activities:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch activities' });
    }
  });
  
  // Get quick actions history
  app.get("/api/extension/quick-actions", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const actions = await storage.getQuickActions({ userId, limit });
      res.json(actions);
    } catch (error) {
      console.error("Error fetching quick actions:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch quick actions' });
    }
  });
  
  // Find contacts at a company
  app.post("/api/extension/find-contacts", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { companyDomain } = req.body;
      
      if (!companyDomain) {
        return res.status(400).json({ error: "Company domain is required" });
      }
      
      const contacts = await browserExtensionService.findContacts(companyDomain, userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error finding contacts:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to find contacts' });
    }
  });
  
  // Content Template Routes
  // Get all content templates
  app.get("/api/content-templates", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const status = req.query.status as string;
      const personaId = req.query.personaId as string;
      const includeArchived = req.query.includeArchived === 'true';
      
      const templates = await storage.listTemplates({
        status,
        personaId,
        includeArchived
      });
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch templates' });
    }
  });
  
  // Get a specific template by ID
  app.get("/api/content-templates/:id", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const templateData = await storage.getTemplateWithRelations(id);
      
      if (!templateData) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(templateData);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch template' });
    }
  });
  
  // Create a new content template
  app.post("/api/content-templates", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const parsed = insertContentTemplateSchema.safeParse({
        ...req.body,
        createdBy: userId
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const { segmentIds, ...templateData } = parsed.data as any;
      const template = await storage.createTemplate({
        ...templateData,
        segmentIds
      });
      
      res.json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create template' });
    }
  });
  
  // Update a content template
  app.patch("/api/content-templates/:id", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const updates = req.body;
      
      const template = await storage.updateTemplate(id, updates);
      
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update template' });
    }
  });
  
  // Archive a content template (instead of delete)
  app.delete("/api/content-templates/:id", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const archived = await storage.archiveTemplate(id);
      
      if (!archived) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      res.json({ success: true, archived: true });
    } catch (error) {
      console.error("Error archiving template:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to archive template' });
    }
  });
  
  // Get template versions
  app.get("/api/content-templates/:id/versions", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const includeDrafts = req.query.includeDrafts === 'true';
      const versions = await storage.listTemplateVersions(id, { includeDrafts });
      
      res.json(versions);
    } catch (error) {
      console.error("Error fetching versions:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch versions' });
    }
  });
  
  // Create a new template version
  app.post("/api/content-templates/:id/versions", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const parsed = insertTemplateVersionSchema.safeParse({
        ...req.body,
        templateId: id,
        createdBy: userId
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const { segmentSnapshotIds, ...versionData } = parsed.data as any;
      const version = await storage.createTemplateVersion({
        ...versionData,
        segmentSnapshotIds
      });
      res.json(version);
    } catch (error) {
      console.error("Error creating version:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create version' });
    }
  });
  
  // Publish a template version
  app.post("/api/content-templates/:id/versions/:versionId/publish", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id, versionId } = req.params;
      const published = await storage.publishTemplateVersion(id, versionId);
      
      if (!published) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      res.json(published);
    } catch (error) {
      console.error("Error publishing version:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to publish version' });
    }
  });
  
  // Get audience segments
  app.get("/api/audience-segments", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const q = req.query.q as string;
      const includeGlobal = req.query.includeGlobal === 'true';
      const segments = await storage.listAudienceSegments({ 
        createdBy: userId, 
        q,
        includeGlobal
      });
      res.json(segments);
    } catch (error) {
      console.error("Error fetching segments:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch segments' });
    }
  });
  
  // Create audience segment
  app.post("/api/audience-segments", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const parsed = insertAudienceSegmentSchema.safeParse({
        ...req.body,
        createdBy: userId
      });
      
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      
      const segment = await storage.createAudienceSegment(parsed.data);
      res.json(segment);
    } catch (error) {
      console.error("Error creating segment:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create segment' });
    }
  });
  
  // Update audience segment  
  app.patch("/api/audience-segments/:id", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const segment = await storage.updateAudienceSegment(id, req.body);
      
      if (!segment) {
        return res.status(404).json({ error: "Segment not found" });
      }
      
      res.json(segment);
    } catch (error) {
      console.error("Error updating segment:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update segment' });
    }
  });
  
  // Delete audience segment
  app.delete("/api/audience-segments/:id", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const deleted = await storage.deleteAudienceSegment(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Segment not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting segment:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete segment' });
    }
  });
  
  // Attach segments to a template
  app.post("/api/content-templates/:id/segments", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const { segmentIds } = req.body;
      
      if (!Array.isArray(segmentIds)) {
        return res.status(400).json({ error: "segmentIds must be an array" });
      }
      
      await storage.attachSegments(id, segmentIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error attaching segments:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to attach segments' });
    }
  });
  
  // Detach a segment from a template
  app.delete("/api/content-templates/:id/segments/:segmentId", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id, segmentId } = req.params;
      const detached = await storage.detachSegment(id, segmentId);
      
      if (!detached) {
        return res.status(404).json({ error: "Segment not found on template" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error detaching segment:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to detach segment' });
    }
  });
  
  // Record template metrics
  app.post("/api/content-templates/:id/metrics", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const { versionId, channel, eventType, value } = req.body;
      
      if (!versionId || !channel || !eventType) {
        return res.status(400).json({ error: "versionId, channel, and eventType are required" });
      }
      
      await storage.recordTemplateMetricEvent({
        templateVersionId: versionId,
        channel,
        eventType,
        value: value || 1,
        occurredAt: new Date()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording metric:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record metric' });
    }
  });
  
  // Get template metrics
  app.get("/api/content-templates/:id/metrics", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { id } = req.params;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      const metrics = await storage.getTemplateMetrics(id, startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch metrics' });
    }
  });

  // Crowd Intelligence Routes
  // Browse shared intelligence
  app.get("/api/crowd-intel", async (req: any, res) => {
    try {
      const category = req.query.category as string;
      const industry = req.query.industry as string;
      const companySize = req.query.companySize as string;
      const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const intel = await storage.getSharedIntelList({
        category,
        industry,
        companySize,
        tags,
        limit
      });
      
      res.json(intel);
    } catch (error) {
      console.error("Error fetching crowd intel:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch intel' });
    }
  });
  
  // Get network statistics
  app.get("/api/crowd-intel/stats", async (req, res) => {
    try {
      const stats = await crowdIntelNetwork.getNetworkStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching crowd intel stats:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch stats' });
    }
  });
  
  // Contribute anonymized intelligence
  app.post("/api/crowd-intel/contribute", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category, content, effectiveness, industry, companySize, tags, performanceData } = req.body;
      
      if (!category || !content) {
        return res.status(400).json({ error: "Category and content are required" });
      }
      
      const intel = await crowdIntelNetwork.contributeIntel(userId, {
        category,
        content,
        effectiveness,
        industry,
        companySize,
        tags,
        performanceData
      });
      
      res.json(intel);
    } catch (error) {
      console.error("Error contributing intel:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to contribute intel' });
    }
  });
  
  // Get industry benchmarks
  app.get("/api/crowd-intel/benchmarks", async (req, res) => {
    try {
      const metric = req.query.metric as string;
      const industry = req.query.industry as string;
      const companySize = req.query.companySize as string;
      const channel = req.query.channel as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const benchmarks = await storage.getBenchmarkDataList({
        metric,
        industry,
        companySize,
        channel,
        limit
      });
      
      res.json(benchmarks);
    } catch (error) {
      console.error("Error fetching benchmarks:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch benchmarks' });
    }
  });
  
  // Improve content with crowd wisdom
  app.post("/api/crowd-intel/improve", async (req, res) => {
    try {
      const { content, category, industry, companySize, tags } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      
      const improved = await crowdIntelNetwork.improveFromCrowd(content, {
        category,
        industry,
        companySize,
        tags
      });
      
      res.json(improved);
    } catch (error) {
      console.error("Error improving content:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to improve content' });
    }
  });
  
  // Rate shared intelligence
  app.post("/api/crowd-intel/rate", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { intelId, rating, feedback, usefulnessScore } = req.body;
      
      if (!intelId || !rating) {
        return res.status(400).json({ error: "Intel ID and rating are required" });
      }
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      const ratingResult = await crowdIntelNetwork.rateIntel(
        userId,
        intelId,
        rating,
        feedback,
        usefulnessScore
      );
      
      res.json(ratingResult);
    } catch (error) {
      console.error("Error rating intel:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to rate intel' });
    }
  });
  
  // Get personalized recommendations
  app.get("/api/crowd-intel/recommendations", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const industry = req.query.industry as string;
      const companySize = req.query.companySize as string;
      const recentCategories = req.query.categories 
        ? (req.query.categories as string).split(',')
        : undefined;
      
      const recommendations = await crowdIntelNetwork.recommendIntel({
        userId,
        industry,
        companySize,
        recentCategories
      });
      
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting recommendations:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get recommendations' });
    }
  });
  
  // Aggregate benchmarks (admin endpoint)
  app.post("/api/crowd-intel/aggregate-benchmarks", async (req: any, res) => {
    try {
      // This could be restricted to admin users
      await crowdIntelNetwork.aggregateBenchmarks();
      res.json({ success: true, message: "Benchmarks aggregated successfully" });
    } catch (error) {
      console.error("Error aggregating benchmarks:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to aggregate benchmarks' });
    }
  });

  // Enterprise Routes
  
  // Configure White-Label
  app.post("/api/enterprise/white-label", async (req: any, res) => {
    try {
      const validatedData = insertWhiteLabelSchema.parse(req.body);
      const whiteLabel = await enterpriseManager.configureWhiteLabel(validatedData);
      res.json(whiteLabel);
    } catch (error) {
      console.error("Error configuring white-label:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to configure white-label' });
    }
  });
  
  // Get White-Label Configuration
  app.get("/api/enterprise/white-label/:organizationId", async (req, res) => {
    try {
      const { organizationId } = req.params;
      const whiteLabel = await storage.getWhiteLabel(organizationId);
      if (!whiteLabel) {
        return res.status(404).json({ error: "White-label configuration not found" });
      }
      res.json(whiteLabel);
    } catch (error) {
      console.error("Error fetching white-label:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch white-label' });
    }
  });
  
  // Get All White-Labels (Admin)
  app.get("/api/enterprise/white-labels", async (req, res) => {
    try {
      const whiteLabels = await storage.getWhiteLabels();
      res.json(whiteLabels);
    } catch (error) {
      console.error("Error fetching white-labels:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch white-labels' });
    }
  });
  
  // Update Security Settings
  app.post("/api/enterprise/security", async (req: any, res) => {
    try {
      const validatedData = insertEnterpriseSecuritySchema.parse(req.body);
      const security = await enterpriseManager.applySecuritySettings(validatedData);
      res.json(security);
    } catch (error) {
      console.error("Error applying security settings:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to apply security settings' });
    }
  });
  
  // Get Security Settings
  app.get("/api/enterprise/security/:organizationId", async (req, res) => {
    try {
      const { organizationId } = req.params;
      const security = await storage.getEnterpriseSecurity(organizationId);
      if (!security) {
        return res.status(404).json({ error: "Security settings not found" });
      }
      res.json(security);
    } catch (error) {
      console.error("Error fetching security settings:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch security settings' });
    }
  });
  
  // Get Audit Logs
  app.get("/api/enterprise/audit-log", async (req: any, res) => {
    try {
      const { organizationId, userId, resource, action, startDate, endDate, limit } = req.query;
      
      const filters: any = {};
      if (organizationId) filters.organizationId = organizationId as string;
      if (userId) filters.userId = userId as string;
      if (resource) filters.resource = resource as string;
      if (action) filters.action = action as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (limit) filters.limit = parseInt(limit as string);
      
      const auditLogs = await storage.getAuditLogs(filters);
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch audit logs' });
    }
  });
  
  // Create Access Control Role
  app.post("/api/enterprise/roles", async (req: any, res) => {
    try {
      const validatedData = insertAccessControlSchema.parse(req.body);
      const accessControl = await storage.createAccessControl(validatedData);
      
      // Log audit event
      await enterpriseManager.logAuditEvent({
        userId: req.user.claims.sub,
        organizationId: validatedData.organizationId,
        action: "create",
        resource: "access_control",
        resourceId: accessControl.id,
        metadata: { roleName: validatedData.roleName },
      });
      
      res.json(accessControl);
    } catch (error) {
      console.error("Error creating access control:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create access control' });
    }
  });
  
  // Get Access Control Roles
  app.get("/api/enterprise/roles/:organizationId", async (req, res) => {
    try {
      const { organizationId } = req.params;
      const accessControls = await storage.getAccessControls(organizationId);
      res.json(accessControls);
    } catch (error) {
      console.error("Error fetching access controls:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch access controls' });
    }
  });
  
  // Update Access Control Role
  app.put("/api/enterprise/roles/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updated = await storage.updateAccessControl(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Access control not found" });
      }
      
      // Log audit event
      await enterpriseManager.logAuditEvent({
        userId: req.user.claims.sub,
        organizationId: updated.organizationId,
        action: "update",
        resource: "access_control",
        resourceId: id,
        metadata: { changes: Object.keys(updates) },
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating access control:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update access control' });
    }
  });
  
  // Delete Access Control Role
  app.delete("/api/enterprise/roles/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get the role first for audit logging
      const role = await storage.getAccessControl(id);
      if (!role) {
        return res.status(404).json({ error: "Access control not found" });
      }
      
      if (role.isSystemRole) {
        return res.status(403).json({ error: "Cannot delete system role" });
      }
      
      const deleted = await storage.deleteAccessControl(id);
      
      // Log audit event
      await enterpriseManager.logAuditEvent({
        userId: req.user.claims.sub,
        organizationId: role.organizationId,
        action: "delete",
        resource: "access_control",
        resourceId: id,
        metadata: { roleName: role.roleName },
        severity: "warning",
      });
      
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting access control:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete access control' });
    }
  });
  
  // Generate Compliance Report
  app.get("/api/enterprise/compliance", async (req: any, res) => {
    try {
      const { organizationId, startDate, endDate } = req.query;
      
      if (!organizationId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await enterpriseManager.generateComplianceReport(
        organizationId as string,
        start,
        end
      );
      
      res.json(report);
    } catch (error) {
      console.error("Error generating compliance report:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate compliance report' });
    }
  });
  
  // Configure SSO
  app.post("/api/enterprise/sso", async (req: any, res) => {
    try {
      const { organizationId, provider, config } = req.body;
      
      if (!organizationId || !provider || !config) {
        return res.status(400).json({ error: "Organization ID, provider, and config are required" });
      }
      
      const security = await enterpriseManager.manageSSOIntegration(organizationId, provider, config);
      
      res.json(security);
    } catch (error) {
      console.error("Error configuring SSO:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to configure SSO' });
    }
  });
  
  // Check Permissions (internal use)
  app.post("/api/enterprise/check-permission", async (req: any, res) => {
    try {
      const { organizationId, action, resource } = req.body;
      const userId = req.user.claims.sub;
      
      if (!organizationId || !action || !resource) {
        return res.status(400).json({ error: "Organization ID, action, and resource are required" });
      }
      
      const hasPermission = await enterpriseManager.enforcePermissions(
        organizationId,
        userId,
        action,
        resource
      );
      
      res.json({ hasPermission });
    } catch (error) {
      console.error("Error checking permissions:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to check permissions' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions for Magic Setup
function generateEmailTemplate(industry: string) {
  const templates: any = {
    SaaS: "Hi {{firstName}},\n\nI noticed {{company}} is scaling rapidly. Many SaaS companies at your stage struggle with {{painPoint}}.\n\nWe've helped similar companies achieve {{outcome}}.\n\nWorth a quick chat?\n\nBest,\n{{senderName}}",
    Fintech: "Hi {{firstName}},\n\nWith increasing regulatory requirements, I imagine {{company}} faces challenges around {{painPoint}}.\n\nOur platform helps fintech companies like yours {{outcome}}.\n\nOpen for a brief call next week?\n\nBest,\n{{senderName}}",
    default: "Hi {{firstName}},\n\nI noticed {{company}} is {{trigger}}. This often means {{painPoint}}.\n\nWe've helped companies in {{industry}} achieve {{outcome}}.\n\nWould you be open to a quick conversation?\n\nBest,\n{{senderName}}"
  };
  return templates[industry] || templates.default;
}

function generateFollowUpTemplate(industry: string) {
  return "Hi {{firstName}},\n\nJust following up on my previous message. I know you're busy, so I'll keep this brief.\n\n{{valueProps}}\n\nIf this isn't a priority right now, I'd appreciate you letting me know.\n\nBest,\n{{senderName}}";
}

function generateMeetingTemplate(industry: string) {
  return "Hi {{firstName}},\n\nThanks for your interest! I have availability for a 30-minute call on:\n\n- {{slot1}}\n- {{slot2}}\n- {{slot3}}\n\nWhich works best for you? Here's my calendar link if easier: {{calendarLink}}\n\nLooking forward to our conversation!\n\nBest,\n{{senderName}}";
}

function generateMagicSetupSequenceSteps(industry: string) {
  return [
    { day: 0, type: "email", template: "coldEmail" },
    { day: 3, type: "linkedin", action: "connect" },
    { day: 5, type: "email", template: "followUp" },
    { day: 10, type: "call", script: "discovery" },
    { day: 14, type: "email", template: "finalFollowUp" }
  ];
}

function generateNurtureSteps(industry: string) {
  return [
    { day: 0, type: "email", template: "valueContent" },
    { day: 7, type: "linkedin", action: "share_content" },
    { day: 14, type: "email", template: "caseStudy" },
    { day: 30, type: "email", template: "checkIn" }
  ];
}

function generateLeadScoringRules(industry: string) {
  return {
    companySize: { weight: 25, ideal: ["50-200", "200-500"] },
    title: { weight: 30, ideal: ["VP", "Director", "C-Level"] },
    engagement: { weight: 20, signals: ["email_opened", "link_clicked", "replied"] },
    intent: { weight: 25, signals: ["pricing_page_visit", "demo_request", "content_download"] }
  };
}

function generateQualificationCriteria(industry: string) {
  return {
    budget: { required: true, minimum: 10000 },
    authority: { required: true, titles: ["VP", "Director", "C-Level"] },
    need: { required: true, painPoints: ["scaling", "automation", "efficiency"] },
    timeline: { required: false, ideal: "3-6 months" }
  };
}

async function createDefaultPlaybooks(industry: string) {
  const playbooks = [
    {
      name: `${industry} Cold Outreach`,
      industry,
      description: `Proven cold outreach playbook for ${industry} companies`,
      targetAudience: { titles: ["VP Sales", "CRO", "Head of Sales"], companySize: ["50-200", "200-500"] },
      sequences: generateMagicSetupSequenceSteps(industry),
      emailTemplates: { cold: generateEmailTemplate(industry), followUp: generateFollowUpTemplate(industry) },
      successMetrics: { openRate: 35, replyRate: 8, meetingRate: 3 },
      isTemplate: true
    },
    {
      name: `${industry} Nurture Campaign`,
      industry,
      description: `Long-term nurture sequence for ${industry} prospects`,
      targetAudience: { titles: ["Director", "Manager"], companySize: ["10-50", "50-200"] },
      sequences: generateNurtureSteps(industry),
      emailTemplates: { nurture: generateFollowUpTemplate(industry) },
      successMetrics: { openRate: 45, clickRate: 12, conversionRate: 2 },
      isTemplate: true
    }
  ];

  for (const playbook of playbooks) {
    await storage.createPlaybook(playbook);
  }
}

async function createDefaultWorkflowTriggers() {
  const triggers = [
    {
      name: "High-Intent Visitor Alert",
      description: "Trigger when visitor shows high buying intent",
      triggerType: "page_visit",
      triggerConditions: { pages: ["pricing", "demo"], timeOnSite: 300 },
      actions: [{ type: "notify_rep" }, { type: "create_task" }, { type: "send_email" }],
      isActive: true
    },
    {
      name: "Email Engagement Follow-up",
      description: "Auto follow-up when prospect engages with email",
      triggerType: "email_opened",
      triggerConditions: { openCount: 3, linkClicked: true },
      actions: [{ type: "send_followup" }, { type: "update_lead_score" }],
      isActive: true
    },
    {
      name: "Lead Score Threshold",
      description: "Alert when lead reaches qualification threshold",
      triggerType: "lead_score",
      triggerConditions: { scoreThreshold: 75 },
      actions: [{ type: "assign_to_ae" }, { type: "create_opportunity" }],
      isActive: true
    }
  ];

  for (const trigger of triggers) {
    await storage.createWorkflowTrigger(trigger);
  }
}

async function applyPlaybook(playbook: any) {
  // Implementation to apply playbook settings
  // This would create sequences, templates, scripts, etc.
  return {
    sequencesCreated: playbook.sequences?.length || 0,
    templatesCreated: Object.keys(playbook.emailTemplates || {}).length,
    scriptsCreated: Object.keys(playbook.callScripts || {}).length
  };
}
