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

  const httpServer = createServer(app);
  return httpServer;
}
