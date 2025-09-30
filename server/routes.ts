import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertContactSchema, insertCompanySchema, insertSequenceSchema, insertPersonaSchema, insertTaskSchema } from "@shared/schema";
import { analyzeEmail, improveEmail, analyzeSpamRisk, optimizeSubjectLine } from "./services/emailAnalysis";
import { generateContent, generateSequenceSteps } from "./services/contentGeneration";
import { getActiveVisitorIntelligence, trackVisitorActivity } from "./services/visitorIntelligence";
import { enrichCompanyData, getCompanyVisitorHistory } from "./services/ipIntelligence";
import { discoverInsights, generateInsightRecommendations, scoreInsightRelevance } from "./services/insightsEngine";
import { generatePersonalizedEmail, categorizeEmailResponse } from "./services/openai";
import { initiateCall, getCallAnalytics, scheduleCallCampaign, getOrGenerateCallScript } from "./services/cloudDialer";

export async function registerRoutes(app: Express): Promise<Server> {
  // Dashboard & Analytics Routes
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

  // Visitor Intelligence Routes
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

  // Content Generation Routes
  app.post("/api/content/generate", async (req, res) => {
    try {
      const content = await generateContent(req.body);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
      const { personaId, sequenceType, stepCount } = req.body;
      const steps = await generateSequenceSteps(personaId, sequenceType, stepCount);
      res.json(steps);
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

  // Onboarding routes
  app.get("/api/onboarding/profile", async (req, res) => {
    try {
      const userId = (req as any).session?.userId || "demo-user";
      const profile = await storage.getOnboardingProfile(userId);
      res.json(profile || { onboardingStep: 1, isComplete: false });
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
      const updated = await storage.updateOnboardingProfile(userId, req.body);
      res.json(updated);
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
      const { personas, sequences, agents } = req.body;
      const results: { personas: any[]; sequences: any[]; agents: any[] } = { 
        personas: [], 
        sequences: [], 
        agents: [] 
      };

      // Create personas
      if (personas?.length) {
        for (const persona of personas) {
          const created = await storage.createPersona(persona);
          results.personas.push(created);
        }
      }

      // Create sequences
      if (sequences?.length) {
        for (const sequence of sequences) {
          const created = await storage.createSequence(sequence);
          results.sequences.push(created);
        }
      }

      // Create AI agents
      if (agents?.length) {
        for (const agent of agents) {
          const created = await storage.createAiAgent(agent);
          results.agents.push(created);
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

  const httpServer = createServer(app);
  return httpServer;
}
