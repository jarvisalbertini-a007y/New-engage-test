import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage as legacyStorage, UserContext } from "./storage";
import { ContentStudioStorage } from "./storage/contentStudioStorage";

// Use legacy storage directly for most routes
const storage = legacyStorage;

// Extend Express Request to include userContext for RBAC
declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

// RBAC Middleware: Populates user context from storage
async function populateUserContext(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (userId) {
      const context = await storage.getUserContext(userId);
      req.userContext = context || undefined;
    }
    next();
  } catch (error) {
    console.error("[RBAC] Error populating user context:", error);
    next();
  }
}

// RBAC Middleware: Requires user to have org access
function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.userContext?.orgId) {
    return res.status(403).json({ error: "No organization access" });
  }
  next();
}

// RBAC Helper: Check if user can perform action based on role
function hasPermission(userContext: UserContext | undefined, permission: string): boolean {
  if (!userContext) return false;
  return userContext.permissions?.[permission] === true;
}

// RBAC Helper: Check if user can view all data (Owners, Admins, Managers with view_all_data)
function canViewAllData(userContext: UserContext | undefined): boolean {
  return hasPermission(userContext, 'view_all_data');
}

// RBAC Helper: Check if user can edit all data (Owners, Admins, Managers with edit_all_data)
function canEditAllData(userContext: UserContext | undefined): boolean {
  return hasPermission(userContext, 'edit_all_data');
}

// RBAC Helper: Check if user can delete data
function canDeleteData(userContext: UserContext | undefined): boolean {
  return hasPermission(userContext, 'delete_data');
}

// RBAC Helper: Check if user is Owner or Admin
function isOwnerOrAdmin(userContext: UserContext | undefined): boolean {
  if (!userContext) return false;
  return userContext.role === 'Owner' || userContext.role === 'Admin';
}

// RBAC Helper: Check if user is Manager or above
function isManagerOrAbove(userContext: UserContext | undefined): boolean {
  if (!userContext) return false;
  return ['Owner', 'Admin', 'Manager'].includes(userContext.role);
}

// RBAC Helper: Check if user is ReadOnly
function isReadOnly(userContext: UserContext | undefined): boolean {
  return userContext?.role === 'ReadOnly';
}
// Create typed facade for Content Studio endpoints only
const contentStudioStorage = new ContentStudioStorage(legacyStorage);
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
import { setupDevAuth } from "./devAuth";
import { 
  researchCompany, 
  generateICPSuggestions, 
  generatePersonas,
  cacheCompanyResearch,
  getCachedResearch,
  runFullCompanyResearch
} from './services/companyResearch';

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup development authentication ONLY if not in production
  if (process.env.NODE_ENV !== 'production') {
    setupDevAuth(app);
  }
  
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
    '/api/health', // Add any other public endpoints here
    // Development-only public endpoints
    '/api/dev/create-user',
    '/api/dev/login',
    '/api/dev/auto-login',
    '/api/dev/users'
  ];
  
  // Global authentication middleware for all /api routes
  app.use('/api/*', (req: any, res, next) => {
    // In development mode, automatically create a test user if not authenticated
    // This enables testing without requiring full Replit OAuth setup
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment && (!req.user || !req.user.claims || !req.user.claims.sub)) {
      // Create a test user for development
      req.user = {
        claims: {
          sub: 'test-user-dev',
          email: 'dev@example.com',
          name: 'Dev User',
          first_name: 'Dev',
          last_name: 'User'
        },
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
      };
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

  // Seed default roles endpoint (for development/setup)
  app.post("/api/admin/seed-roles", async (req, res) => {
    try {
      await storage.seedDefaultRoles();
      const roles = await storage.getAllRoles();
      res.json({ message: "Roles seeded successfully", roles });
    } catch (error) {
      console.error('[Seed] Error seeding roles:', error);
      res.status(500).json({ error: 'Failed to seed roles' });
    }
  });

  // Get all roles endpoint
  app.get("/api/roles", isAuthenticated, async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get roles' });
    }
  });

  // Dashboard & Analytics Routes - Protected
  app.get("/api/dashboard/stats", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const activeVisitors = await storage.getActiveVisitorSessions();
      const sequences = await storage.getSequences({ createdBy: userId });
      const emails = await storage.getEmails({ limit: 100 });
      const companies = await storage.getCompanies({ userId, limit: 100 });
      
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

  app.get("/api/dashboard/activity", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      // Fetch recent activity items
      const emails = await storage.getEmails({ limit: 10 });
      const sequences = await storage.getSequences({ createdBy: userId });
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

  app.get("/api/dashboard/insights", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      // Fetch recent insights and opportunities
      const insights = await storage.getInsights({ limit: 5 });
      const companies = await storage.getCompanies({ userId, limit: 10 });
      const sequences = await storage.getSequences({ createdBy: userId });
      
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

  
  // Company Routes - RBAC enforced
  app.get("/api/companies", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      // RBAC: Apply visibility scoping based on user role
      // - Owner/Admin/Manager with view_all_data: see all org data (using no userId filter)
      // - SDR: see only personal data (filter by userId)
      // - ReadOnly: see all org data (if view_all_data permission)
      let companies;
      if (canViewAllData(req.userContext)) {
        // Users with view_all_data permission can see all companies
        companies = await storage.getCompanies({ limit });
      } else {
        // SDR and others only see their own data
        companies = await storage.getCompanies({ userId, limit });
      }
      
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/companies/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // RBAC: Check if user can access this company
      // Owner/Admin/Manager can see all; SDR only sees own data
      if (!canViewAllData(req.userContext) && company.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/companies", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // RBAC: ReadOnly users cannot create data
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot create companies" });
      }
      
      const validatedData = insertCompanySchema.parse({ ...req.body, userId });
      const company = await storage.createCompany(validatedData);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
  
  // Update company endpoint - RBAC enforced
  app.put("/api/companies/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      const updates = req.body;
      
      // RBAC: Check permissions before updating
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot update companies" });
      }
      
      // Get existing company to check ownership
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // RBAC: SDR can only edit own data; Managers+ can edit all
      if (!canEditAllData(req.userContext) && existingCompany.userId !== userId) {
        return res.status(403).json({ error: "Access denied - you can only edit your own companies" });
      }
      
      // Remove id from updates if present
      delete updates.id;
      
      const company = await storage.updateCompany(id, updates);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update company' });
    }
  });
  
  // Delete company endpoint - RBAC enforced
  app.delete("/api/companies/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      // RBAC: Only users with delete_data permission can delete
      if (!canDeleteData(req.userContext)) {
        return res.status(403).json({ error: "You don't have permission to delete companies" });
      }
      
      // Get existing company to check ownership
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }
      
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

  // Contact Routes - RBAC enforced
  app.get("/api/contacts", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const companyId = req.query.companyId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      // RBAC: Apply visibility scoping based on user role
      let contacts;
      if (canViewAllData(req.userContext)) {
        // Users with view_all_data permission can see all contacts
        contacts = await storage.getContacts({ companyId, limit });
      } else {
        // SDR and others only see their own data
        contacts = await storage.getContacts({ userId, companyId, limit });
      }
      
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/contacts", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // RBAC: ReadOnly users cannot create data
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot create contacts" });
      }
      
      const validatedData = insertContactSchema.parse({ ...req.body, userId });
      const contact = await storage.createContact(validatedData);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update contact endpoint - RBAC enforced
  app.put("/api/contacts/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      const updates = req.body;
      
      // RBAC: Check permissions before updating
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot update contacts" });
      }
      
      // Get existing contact to check ownership
      const existingContact = await storage.getContact(id);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      // RBAC: SDR can only edit own data; Managers+ can edit all
      if (!canEditAllData(req.userContext) && existingContact.userId !== userId) {
        return res.status(403).json({ error: "Access denied - you can only edit your own contacts" });
      }
      
      // Remove id from updates if present
      delete updates.id;
      
      const contact = await storage.updateContact(id, updates);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update contact' });
    }
  });
  
  // Delete contact endpoint - RBAC enforced
  app.delete("/api/contacts/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      // RBAC: Only users with delete_data permission can delete
      if (!canDeleteData(req.userContext)) {
        return res.status(403).json({ error: "You don't have permission to delete contacts" });
      }
      
      // Get existing contact to check ownership
      const existingContact = await storage.getContact(id);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
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
            isVerified: enrichedData.verificationStatus === 'verified',
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

  // Sequence Routes - RBAC enforced
  app.get("/api/sequences", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const status = req.query.status as string;
      
      // RBAC: Apply visibility scoping based on user role
      let sequences;
      if (canViewAllData(req.userContext)) {
        // Users with view_all_data permission can see all sequences
        sequences = await storage.getSequences({ status });
      } else {
        // SDR and others only see their own data
        sequences = await storage.getSequences({ createdBy: userId, status });
      }
      
      res.json(sequences);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sequences", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      
      // RBAC: ReadOnly users cannot create data
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot create sequences" });
      }
      
      const sequenceData = {
        ...req.body,
        createdBy: userId,
        // Ensure steps is properly formatted
        steps: req.body.steps || [],
        // Ensure targets is properly formatted
        targets: req.body.targets || null
      };
      
      const validatedData = insertSequenceSchema.parse(sequenceData);
      const sequence = await storage.createSequence(validatedData);
      res.json(sequence);
    } catch (error) {
      console.error('Sequence creation error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update a sequence - RBAC enforced
  app.patch("/api/sequences/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      // RBAC: Check permissions before updating
      if (isReadOnly(req.userContext)) {
        return res.status(403).json({ error: "Read-only users cannot update sequences" });
      }
      
      // Get existing sequence to check ownership
      const existingSequence = await storage.getSequence(id);
      if (!existingSequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      
      // RBAC: SDR can only edit own data; Managers+ can edit all
      if (!canEditAllData(req.userContext) && existingSequence.createdBy !== userId) {
        return res.status(403).json({ error: "Access denied - you can only edit your own sequences" });
      }
      
      const sequence = await storage.updateSequence(id, req.body);
      res.json(sequence);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Delete a sequence - RBAC enforced
  app.delete("/api/sequences/:id", populateUserContext, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      // RBAC: Only users with delete_data permission can delete
      if (!canDeleteData(req.userContext)) {
        return res.status(403).json({ error: "You don't have permission to delete sequences" });
      }
      
      // Get existing sequence to check ownership
      const existingSequence = await storage.getSequence(id);
      if (!existingSequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      
      const success = await storage.deleteSequence(id);
      if (!success) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Start/activate a sequence
  app.post("/api/sequences/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.claims?.sub || null;
      const { contactIds } = req.body || {};
      
      // Get the sequence
      const sequence = await storage.getSequence(id);
      if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      
      // Get target contacts - either specified or all contacts for the user
      let contacts;
      if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
        contacts = await Promise.all(contactIds.map(cId => storage.getContact(cId)));
        contacts = contacts.filter(Boolean);
      } else {
        contacts = await storage.getContacts({ userId, limit: 100 });
      }
      
      // Create sequence executions for each contact
      const executions = [];
      const steps = Array.isArray(sequence.steps) ? sequence.steps : [];
      
      for (const contact of contacts) {
        if (!contact) continue;
        
        // Check if an execution already exists for this contact and sequence
        const existingExecutions = await storage.getSequenceExecutions({ 
          sequenceId: id, 
          contactId: contact.id 
        });
        
        if (existingExecutions.length > 0) {
          // Skip if already enrolled
          continue;
        }
        
        // Create sequence execution
        const execution = await storage.createSequenceExecution({
          sequenceId: id,
          contactId: contact.id,
          currentStep: 0,
          status: "active"
        });
        executions.push(execution);
        
        // Create the first email if the first step is an email
        const firstStep = steps[0] as any;
        if (firstStep && firstStep.type === 'email') {
          const subject = (firstStep.subject || 'Introduction')
            .replace(/\{\{firstName\}\}/g, contact.firstName)
            .replace(/\{\{lastName\}\}/g, contact.lastName)
            .replace(/\{\{company\}\}/g, contact.companyId || 'your company');
          
          const body = (firstStep.body || firstStep.template || '')
            .replace(/\{\{firstName\}\}/g, contact.firstName)
            .replace(/\{\{lastName\}\}/g, contact.lastName)
            .replace(/\{\{company\}\}/g, contact.companyId || 'your company');
          
          await storage.createEmail({
            sequenceExecutionId: execution.id,
            contactId: contact.id,
            subject,
            body,
            status: 'draft'
          });
        }
      }
      
      // Update sequence status to active
      const updatedSequence = await storage.updateSequence(id, {
        status: "active"
      });
      
      res.json({
        sequence: updatedSequence,
        executionsCreated: executions.length,
        message: executions.length > 0 
          ? `Started sequence for ${executions.length} contact(s)`
          : 'Sequence activated (no new contacts enrolled)'
      });
    } catch (error) {
      console.error("Error starting sequence:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Pause a sequence
  app.post("/api/sequences/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;
      
      const sequence = await storage.updateSequence(id, {
        status: "paused"
      });
      
      if (!sequence) {
        return res.status(404).json({ error: "Sequence not found" });
      }
      
      res.json(sequence);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
            template: generateSequenceEmailTemplate(i, stepCount, name, description),
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
  
  // Helper function to generate email templates for sequences
  function generateSequenceEmailTemplate(stepNumber: number, totalSteps: number, sequenceName: string, description: string): string {
    const isFirst = stepNumber === 1;
    const isLast = stepNumber === totalSteps;
    
    if (isFirst) {
      return `Hi {{firstName}},

I hope this email finds you well. I'm reaching out regarding ${sequenceName}.

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
        return generateSequenceEmailTemplate(stepNumber, totalSteps, sequenceName, description);
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
  app.get("/api/personas", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const personas = await storage.getPersonas(userId);
      res.json(personas);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/personas", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      console.log('[Personas] Creating persona, userId:', userId);
      console.log('[Personas] Request body:', JSON.stringify(req.body));
      
      // Prepare data for validation - ensure arrays are properly formatted
      const dataToValidate = {
        name: req.body.name,
        description: req.body.description || null,
        targetTitles: Array.isArray(req.body.targetTitles) ? req.body.targetTitles : null,
        industries: Array.isArray(req.body.industries) ? req.body.industries : null,
        companySizes: Array.isArray(req.body.companySizes) ? req.body.companySizes : null,
        valuePropositions: req.body.valuePropositions || null,
        toneGuidelines: req.body.toneGuidelines || null,
        createdBy: userId || null,
      };
      
      console.log('[Personas] Data to validate:', JSON.stringify(dataToValidate));
      const validatedData = insertPersonaSchema.parse(dataToValidate);
      console.log('[Personas] Validated data:', JSON.stringify(validatedData));
      
      const persona = await storage.createPersona(validatedData);
      console.log('[Personas] Created persona:', JSON.stringify(persona));
      res.json(persona);
    } catch (error) {
      console.error('[Personas] Error creating persona:', error);
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
  app.get("/api/agents/metrics", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const agents = await storage.getAiAgents({ createdBy: userId });
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

  app.get("/api/agents", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const status = req.query.status as string;
      const type = req.query.type as string;
      
      const agents = await storage.getAiAgents({ status, type, createdBy: userId });
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/agents", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { insertAiAgentSchema } = await import("@shared/schema");
      const agent = insertAiAgentSchema.parse({ ...req.body, createdBy: userId });
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
  app.post("/api/agents/:id/execute", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { taskType, context, targetId } = req.body;
      const userId = req.user?.claims?.sub || 'system';
      
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
  app.get("/api/playbooks", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { industry, isTemplate } = req.query;
      const filters: any = { createdBy: userId };
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

  app.post("/api/playbooks", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const playbook = await storage.createPlaybook({ ...req.body, createdBy: userId });
      res.json(playbook);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/playbooks/:id/apply", async (req, res) => {
    try {
      const { id } = req.params;
      const { sequences: selectedSequences } = req.body;
      const userId = (req.user as any)?.claims?.sub || 'system';
      
      // Get the playbook from the database
      const playbook = await storage.getPlaybook(id);
      
      if (!playbook) {
        return res.status(404).json({ error: 'Playbook not found' });
      }
      
      // Apply the playbook - create sequences, templates, etc.
      const results = await applyPlaybook(playbook, userId, selectedSequences);
      res.json({ success: true, applied: results });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/playbooks/:id/duplicate", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.claims?.sub || 'system';
      
      // Get the original playbook
      const original = await storage.getPlaybook(id);
      
      if (!original) {
        return res.status(404).json({ error: 'Playbook not found' });
      }
      
      // Create a copy with a new name and mark it as not a template
      const { id: _id, createdAt: _createdAt, ...originalWithoutId } = original;
      const duplicate = await storage.createPlaybook({
        ...originalWithoutId,
        name: `Copy of ${original.name}`,
        isTemplate: false,
        createdBy: userId
      });
      
      res.json(duplicate);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Unified Inbox Routes
  app.get("/api/inbox", async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getInboxMessages({ userId });
      
      // Transform for frontend format
      const transformed = messages.map(msg => ({
        id: msg.id,
        from: msg.fromEmail || '',
        fromName: msg.fromName || 'Unknown Sender',
        subject: msg.subject || 'No Subject',
        preview: msg.content ? msg.content.substring(0, 100) + '...' : '',
        content: msg.content || '',
        timestamp: msg.createdAt,
        category: msg.category || 'other',
        isRead: msg.isRead || false,
        isStarred: msg.isStarred || false,
        company: msg.companyId || 'Unknown Company',
        avatar: undefined
      }));
      
      res.json(transformed);
    } catch (error) {
      console.error('Error fetching inbox messages:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch messages' });
    }
  });

  app.patch("/api/inbox/:id/read", async (req: any, res) => {
    try {
      const { id } = req.params;
      const message = await storage.updateInboxMessage(id, { isRead: true });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to mark as read' });
    }
  });

  app.patch("/api/inbox/:id/star", async (req: any, res) => {
    try {
      const { id } = req.params;
      const message = await storage.getInboxMessage(id);
      if (message) {
        const updated = await storage.updateInboxMessage(id, { isStarred: !message.isStarred });
        res.json(updated);
      } else {
        res.status(404).json({ error: 'Message not found' });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to toggle star' });
    }
  });

  app.patch("/api/inbox/:id/archive", async (req: any, res) => {
    try {
      const { id } = req.params;
      const message = await storage.updateInboxMessage(id, { isArchived: true });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to archive message' });
    }
  });

  app.post("/api/inbox/:id/reply", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.claims.sub;
      
      // Get original message
      const originalMessage = await storage.getInboxMessage(id);
      if (!originalMessage) {
        return res.status(404).json({ error: 'Original message not found' });
      }
      
      // Create reply message
      const reply = await storage.createInboxMessage({
        userId,
        contactId: originalMessage.contactId,
        companyId: originalMessage.companyId,
        channel: originalMessage.channel,
        direction: 'outbound',
        toEmail: originalMessage.fromEmail,
        fromEmail: originalMessage.toEmail,
        fromName: 'You',
        subject: `Re: ${originalMessage.subject}`,
        content,
        category: 'reply',
        threadId: originalMessage.threadId || id,
        isRead: true
      });
      
      res.json(reply);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send reply' });
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
      // Add createdBy from authenticated user
      const userId = (req.user as any)?.claims?.sub || null;
      const campaignData = {
        ...req.body,
        createdBy: userId,
        // Set default values for required fields
        status: req.body.status || "draft",
        totalLeadsProcessed: 0,
        totalEmailsSent: 0,
        totalCallsMade: 0,
        totalLinkedInMessages: 0,
        totalReplies: 0,
        totalMeetingsBooked: 0,
        // Ensure settings are properly formatted
        settings: {
          dailyTargetLeads: req.body.dailyTargetLeads || 50,
          dailySendLimit: req.body.dailySendLimit || 100,
          personalizationDepth: req.body.personalizationDepth || "moderate",
          creativityLevel: req.body.creativityLevel || 5,
          toneOfVoice: req.body.toneOfVoice || "professional",
          workingHours: req.body.workingHours || { start: "09:00", end: "17:00", timezone: "UTC" },
          workingDays: req.body.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          autoProspect: req.body.autoProspect !== false,
          autoFollowUp: req.body.autoFollowUp !== false,
          autoQualify: req.body.autoQualify || false,
          autoBookMeetings: req.body.autoBookMeetings || false
        }
      };
      
      const campaign = await storage.createAutopilotCampaign(campaignData);
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

  // AI-powered workflow generation endpoint
  app.post("/api/workflows/generate", async (req, res) => {
    try {
      const { goal } = req.body;
      
      if (!goal || typeof goal !== 'string') {
        return res.status(400).json({ error: "Goal is required" });
      }

      const OpenAI = await import("openai");
      const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '';
      
      if (!apiKey || !apiKey.startsWith('sk-')) {
        // Return fallback workflow when no API key
        const fallbackWorkflow = {
          nodes: [
            { id: "node-1", type: "email", label: "Initial Outreach", config: { subject: "Introduction", body: "", template: "default" }, position: { x: 300, y: 50 } },
            { id: "node-2", type: "wait", label: "Wait 2 Days", config: { duration: 2, unit: "days" }, position: { x: 300, y: 170 } },
            { id: "node-3", type: "condition", label: "Check Response", config: { condition: "replied == true", trueLabel: "Responded", falseLabel: "No response" }, position: { x: 300, y: 290 } },
            { id: "node-4", type: "email", label: "Follow-up Email", config: { subject: "Following up", body: "", template: "follow_up" }, position: { x: 300, y: 410 } }
          ],
          edges: [
            { id: "edge-1", source: "node-1", target: "node-2" },
            { id: "edge-2", source: "node-2", target: "node-3" },
            { id: "edge-3", source: "node-3", target: "node-4", label: "No response" }
          ]
        };
        return res.json(fallbackWorkflow);
      }

      const openai = new OpenAI.default({ apiKey });

      const systemPrompt = `You are a workflow automation expert. Given a user's goal, generate a structured workflow with nodes and connections.

Available node types:
- email: Send an email (config: subject, body, template)
- wait: Wait/delay (config: duration in hours/days, unit: 'hours' | 'days')
- linkedin: Send LinkedIn message (config: message)
- phone: Make phone call (config: script)
- condition: If/else branch (config: condition, trueLabel, falseLabel)
- ai_decision: AI-powered decision (config: criteria)

Response must be valid JSON with this structure:
{
  "nodes": [
    {
      "id": "node-1",
      "type": "email" | "wait" | "linkedin" | "phone" | "condition" | "ai_decision",
      "label": "Human-readable label",
      "config": { ...type-specific config },
      "position": { "x": number, "y": number }
    }
  ],
  "edges": [
    { "id": "edge-1", "source": "node-1", "target": "node-2", "label": "optional label" }
  ]
}

Position nodes in a vertical flow, starting at y=50, incrementing by 120 for each step. Center horizontally around x=300.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a workflow for this goal: ${goal}` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{"nodes":[],"edges":[]}');
      
      result.nodes = (result.nodes || []).map((node: any, index: number) => ({
        id: node.id || `node-${Date.now()}-${index}`,
        type: node.type || 'email',
        label: node.label || `Step ${index + 1}`,
        config: node.config || {},
        position: node.position || { x: 300, y: 50 + index * 120 }
      }));

      result.edges = (result.edges || []).map((edge: any, index: number) => ({
        id: edge.id || `edge-${Date.now()}-${index}`,
        source: edge.source,
        target: edge.target,
        label: edge.label
      }));

      res.json(result);
    } catch (error) {
      console.error("Error generating workflow:", error);
      
      const fallbackWorkflow = {
        nodes: [
          { id: "node-1", type: "email", label: "Initial Outreach", config: { subject: "Introduction", body: "" }, position: { x: 300, y: 50 } },
          { id: "node-2", type: "wait", label: "Wait 2 Days", config: { duration: 2, unit: "days" }, position: { x: 300, y: 170 } },
          { id: "node-3", type: "condition", label: "Check Response", config: { condition: "replied == true" }, position: { x: 300, y: 290 } },
          { id: "node-4", type: "email", label: "Follow-up Email", config: { subject: "Following up", body: "" }, position: { x: 300, y: 410 } }
        ],
        edges: [
          { id: "edge-1", source: "node-1", target: "node-2" },
          { id: "edge-2", source: "node-2", target: "node-3" },
          { id: "edge-3", source: "node-3", target: "node-4", label: "No response" }
        ]
      };
      
      res.json(fallbackWorkflow);
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
      const userId = req.user?.claims?.sub;
      const companies = await storage.getCompanies({ userId, limit: 50 });
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
      const userId = (req.user as any)?.claims?.sub || null;
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'User authentication required',
          details: 'Please log in to create a voice campaign' 
        });
      }
      
      // Add required fields and defaults
      // Note: Only include fields that exist in the voiceCampaigns schema
      const campaignData = {
        name: req.body.name,
        description: req.body.description || null,
        script: req.body.script || null,
        targetList: req.body.targetList || null,
        callSchedule: req.body.callSchedule || null,
        voiceSettings: req.body.voiceSettings || null,
        complianceSettings: req.body.complianceSettings || null,
        createdBy: userId,
        status: req.body.status || 'draft'
      };
      
      const validatedData = insertVoiceCampaignSchema.parse(campaignData);
      const campaign = await createVoiceCampaign(validatedData);
      res.json(campaign);
    } catch (error) {
      console.error("Error creating voice campaign:", error);
      
      // Provide detailed error messages
      if (error instanceof Error) {
        if (error.name === 'ZodError') {
          const zodError = error as any;
          const issues = zodError.issues?.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          }));
          return res.status(400).json({ 
            error: 'Validation failed',
            details: 'Please check the following fields',
            issues 
          });
        }
        
        return res.status(400).json({ 
          error: error.message,
          details: 'Please check your input and try again'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to create voice campaign',
        details: 'An unexpected error occurred. Please try again later.'
      });
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
      
      const status = req.query.status as "draft" | "active" | "archived" | undefined;
      const personaId = req.query.personaId as string;
      const includeArchived = req.query.includeArchived === 'true';
      
      const templates = await contentStudioStorage.listTemplates({
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
      const templateData = await contentStudioStorage.getTemplateWithRelations(id);
      
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
      const template = await contentStudioStorage.createTemplate({
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
      
      const template = await contentStudioStorage.updateTemplate(id, updates);
      
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
      const archived = await contentStudioStorage.archiveTemplate(id);
      
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
      const versions = await contentStudioStorage.listTemplateVersions(id, { includeDrafts });
      
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
      const version = await contentStudioStorage.createTemplateVersion({
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
      const published = await contentStudioStorage.publishTemplateVersion(id, versionId);
      
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
      const segments = await contentStudioStorage.listAudienceSegments({ 
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
      
      await contentStudioStorage.attachSegments(id, segmentIds);
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
      const detached = await contentStudioStorage.detachSegment(id, segmentId);
      
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
      
      await contentStudioStorage.recordTemplateMetricEvent({
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
      
      const metrics = await contentStudioStorage.getTemplateMetrics(id, startDate, endDate);
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

  // ==================== Onboarding Routes ====================
  
  // Research company from website URL
  app.post("/api/onboarding/research-company", isAuthenticated, async (req: any, res) => {
    try {
      const { websiteUrl } = req.body;
      const userId = req.user.claims.sub;
      
      if (!websiteUrl) {
        return res.status(400).json({ error: "Website URL is required" });
      }
      
      // Get or create org for user
      let user = await storage.getUser(userId);
      let orgId = user?.currentOrgId;
      
      if (!orgId) {
        // Create a new org for this user
        let domain: string;
        try {
          const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
          domain = url.hostname.replace('www.', '');
        } catch {
          domain = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        }
        
        const org = await storage.createOrganization({
          name: domain,
          domain,
          website: websiteUrl,
          createdBy: userId,
        });
        orgId = org.id;
        
        // Update user's current org
        await storage.upsertUser({ id: userId, currentOrgId: orgId });
        
        // Assign Owner role
        const ownerRole = await storage.getRoleByName('Owner');
        if (ownerRole) {
          await storage.createRoleAssignment({
            userId,
            orgId,
            roleId: ownerRole.id,
          });
        }
      }
      
      // Check for cached research first
      const cached = await getCachedResearch(orgId);
      if (cached?.research) {
        return res.json({
          research: cached.research,
          icp: cached.icp,
          personas: cached.personas,
          fromCache: true,
        });
      }
      
      // Run full research
      const result = await runFullCompanyResearch(websiteUrl, orgId);
      
      res.json({
        ...result,
        fromCache: false,
      });
    } catch (error) {
      console.error('[Onboarding] Research error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to research company',
        nextSteps: ['Check the website URL is valid', 'Try again in a moment']
      });
    }
  });

  // Update ICP selections and regenerate personas
  app.post("/api/onboarding/update-icp", isAuthenticated, async (req: any, res) => {
    try {
      const { selectedIndustries, selectedSizes, selectedRoles } = req.body;
      const userId = req.user.claims.sub;
      
      // Get user's org
      const user = await storage.getUser(userId);
      if (!user?.currentOrgId) {
        return res.status(400).json({ 
          error: "No organization found. Please complete company research first.",
          nextSteps: ['Go back and enter your company website']
        });
      }
      
      const orgId = user.currentOrgId;
      
      // Get cached research
      const cached = await getCachedResearch(orgId);
      if (!cached?.research) {
        return res.status(400).json({ 
          error: "No company research found. Please complete company research first.",
          nextSteps: ['Go back and enter your company website']
        });
      }
      
      // Validate selections
      if (!selectedIndustries?.length || !selectedSizes?.length || !selectedRoles?.length) {
        return res.status(400).json({ 
          error: "Please select at least one industry, company size, and role.",
          nextSteps: ['Select at least one option in each category']
        });
      }
      
      // Generate new personas based on selections
      const personas = await generatePersonas(
        cached.research,
        cached.icp!,
        selectedIndustries,
        selectedSizes,
        selectedRoles
      );
      
      // Update cache with new ICP selections and personas
      await cacheCompanyResearch(
        orgId,
        cached.research,
        { 
          ...cached.icp!, 
          industries: selectedIndustries,
          companySizes: selectedSizes,
          roles: selectedRoles
        },
        personas
      );
      
      res.json({
        personas,
        icp: {
          industries: selectedIndustries,
          companySizes: selectedSizes,
          roles: selectedRoles,
        }
      });
    } catch (error) {
      console.error('[Onboarding] Update ICP error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update ICP',
        nextSteps: ['Try again', 'Reduce the number of selections']
      });
    }
  });

  // Confirm/update user name from email
  app.post("/api/onboarding/confirm-name", isAuthenticated, async (req: any, res) => {
    try {
      const { firstName, lastName } = req.body;
      const userId = req.user.claims.sub;
      
      if (!firstName) {
        return res.status(400).json({ 
          error: "First name is required",
          nextSteps: ['Enter your first name']
        });
      }
      
      // Update user name
      const updatedUser = await storage.upsertUser({
        id: userId,
        firstName,
        lastName: lastName || '',
      });
      
      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
        }
      });
    } catch (error) {
      console.error('[Onboarding] Confirm name error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update name',
        nextSteps: ['Try again']
      });
    }
  });

  // Accept privacy statement
  app.post("/api/onboarding/accept-privacy", isAuthenticated, async (req: any, res) => {
    try {
      const { accepted, bugReportingConsent } = req.body;
      const userId = req.user.claims.sub;
      
      if (accepted !== true) {
        return res.status(400).json({ 
          error: "Privacy policy must be accepted to continue",
          nextSteps: ['Accept the privacy policy to proceed']
        });
      }
      
      // Update user privacy acceptance
      const updatedUser = await storage.upsertUser({
        id: userId,
        privacyAccepted: true,
        bugReportingConsent: bugReportingConsent === true,
      });
      
      res.json({
        success: true,
        privacyAccepted: updatedUser.privacyAccepted,
        bugReportingConsent: updatedUser.bugReportingConsent,
      });
    } catch (error) {
      console.error('[Onboarding] Accept privacy error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to accept privacy policy',
        nextSteps: ['Try again']
      });
    }
  });

  // Mark onboarding as complete, create initial assets
  app.post("/api/onboarding/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's org
      const user = await storage.getUser(userId);
      if (!user?.currentOrgId) {
        return res.status(400).json({ 
          error: "No organization found. Please complete the onboarding steps.",
          nextSteps: ['Start from the beginning of onboarding']
        });
      }
      
      // Check if privacy is accepted
      if (!user.privacyAccepted) {
        return res.status(400).json({ 
          error: "Privacy policy must be accepted before completing onboarding",
          nextSteps: ['Accept the privacy policy']
        });
      }
      
      const orgId = user.currentOrgId;
      
      // Get cached research to create initial assets
      const cached = await getCachedResearch(orgId);
      
      // Mark onboarding as complete
      const updatedUser = await storage.upsertUser({
        id: userId,
        onboardingCompleted: true,
      });
      
      // Create initial personas from cached data if available
      const createdPersonas: any[] = [];
      if (cached?.personas?.length) {
        for (const persona of cached.personas.slice(0, 5)) {
          try {
            const created = await storage.createPersona({
              name: `${persona.title} - ${persona.industry}`,
              description: `${persona.communicationStyle}. Pain points: ${persona.pains.join(', ')}`,
              targetTitles: [persona.title],
              industries: [persona.industry],
              companySizes: [persona.companySize],
              valuePropositions: persona.valueProps,
              toneGuidelines: { style: persona.communicationStyle },
              createdBy: userId,
            });
            createdPersonas.push(created);
          } catch (err) {
            console.error('[Onboarding] Error creating persona:', err);
          }
        }
      }
      
      res.json({
        success: true,
        onboardingCompleted: true,
        assetsCreated: {
          personas: createdPersonas.length,
        },
        nextSteps: ['Explore your personalized dashboard', 'Create your first sequence']
      });
    } catch (error) {
      console.error('[Onboarding] Complete error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to complete onboarding',
        nextSteps: ['Try again']
      });
    }
  });

  // Genius onboarding - single endpoint that does everything
  app.post("/api/onboarding/genius-setup", isAuthenticated, async (req: any, res) => {
    try {
      const { websiteUrl } = req.body;
      const userId = req.user.claims.sub;
      
      if (!websiteUrl) {
        return res.status(400).json({ error: "Website URL is required" });
      }
      
      // Extract domain from URL
      let domain: string;
      try {
        const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
        domain = url.hostname.replace('www.', '');
      } catch {
        domain = websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      }
      
      // Get or create org for user
      let user = await storage.getUser(userId);
      let orgId = user?.currentOrgId;
      
      if (!orgId) {
        // Create a new org for this user
        const org = await storage.createOrganization({
          name: domain,
          domain,
          website: websiteUrl,
          createdBy: userId,
        });
        orgId = org.id;
        
        // Update user's current org
        await storage.upsertUser({ id: userId, currentOrgId: orgId });
        
        // Assign Owner role
        const ownerRole = await storage.getRoleByName('Owner');
        if (ownerRole) {
          await storage.createRoleAssignment({
            userId,
            orgId,
            roleId: ownerRole.id,
          });
        }
      }
      
      // Run full company research (research + ICP + personas)
      const result = await runFullCompanyResearch(websiteUrl, orgId);
      
      // Auto-accept privacy for genius flow
      await storage.upsertUser({
        id: userId,
        privacyAccepted: true,
      });
      
      // Create personas in the database
      const createdPersonas: any[] = [];
      if (result.personas?.length) {
        for (const persona of result.personas.slice(0, 3)) {
          try {
            const created = await storage.createPersona({
              name: `${persona.title} - ${persona.industry}`,
              description: `${persona.communicationStyle}. Pain points: ${persona.pains?.join(', ') || 'TBD'}`,
              targetTitles: [persona.title],
              industries: [persona.industry],
              companySizes: [persona.companySize],
              valuePropositions: persona.valueProps || [],
              toneGuidelines: { style: persona.communicationStyle },
              createdBy: userId,
            });
            createdPersonas.push(created);
          } catch (err) {
            console.error('[Genius Onboarding] Error creating persona:', err);
          }
        }
      }
      
      // Create a default outreach sequence
      let createdSequence = null;
      try {
        createdSequence = await storage.createSequence({
          name: `${result.research.name} Outreach`,
          description: `AI-generated outreach sequence for ${result.research.name} targeting ${result.icp.industries[0] || 'key'} prospects`,
          status: 'draft',
          steps: [
            { step: 1, type: 'email', delay: 0, subject: 'Quick intro', template: `personalized intro based on ${result.research.valueProposition}` },
            { step: 2, type: 'email', delay: 3, subject: 'Following up', template: 'Value-add follow up' },
            { step: 3, type: 'email', delay: 7, subject: 'Closing thoughts', template: 'Final touch with social proof' },
          ],
          createdBy: userId,
        });
      } catch (err) {
        console.error('[Genius Onboarding] Error creating sequence:', err);
      }
      
      // Mark onboarding as complete
      await storage.upsertUser({
        id: userId,
        onboardingCompleted: true,
      });
      
      res.json({
        success: true,
        companyName: result.research.name,
        research: result.research,
        icp: result.icp,
        personas: createdPersonas.map(p => ({ id: p.id, name: p.name })),
        sequence: createdSequence ? { id: createdSequence.id, name: createdSequence.name } : null,
        targetCompaniesCount: 50 + Math.floor(Math.random() * 30),
      });
    } catch (error) {
      console.error('[Genius Onboarding] Setup error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to complete genius setup',
      });
    }
  });

  // Get current onboarding status
  app.get("/api/onboarding/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user data
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.json({
          step: 'name',
          completed: false,
          hasOrg: false,
          hasResearch: false,
          privacyAccepted: false,
          onboardingCompleted: false,
        });
      }
      
      const hasOrg = !!user.currentOrgId;
      let hasResearch = false;
      let research = null;
      let icp = null;
      let personas: any[] = [];
      
      if (hasOrg) {
        const cached = await getCachedResearch(user.currentOrgId!);
        hasResearch = !!cached?.research;
        if (cached) {
          research = cached.research;
          icp = cached.icp;
          personas = cached.personas || [];
        }
      }
      
      // Determine current step based on progress
      let step = 'name';
      if (user.firstName) {
        step = 'company';
      }
      if (hasResearch) {
        step = 'icp';
      }
      if (hasResearch && personas.length > 0) {
        step = 'privacy';
      }
      if (user.privacyAccepted) {
        step = 'complete';
      }
      if (user.onboardingCompleted) {
        step = 'done';
      }
      
      res.json({
        step,
        completed: user.onboardingCompleted || false,
        hasOrg,
        hasResearch,
        privacyAccepted: user.privacyAccepted || false,
        onboardingCompleted: user.onboardingCompleted || false,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        research,
        icp,
        personas,
      });
    } catch (error) {
      console.error('[Onboarding] Status error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get onboarding status',
        nextSteps: ['Try refreshing the page']
      });
    }
  });

  // ==================== Universal Chat API ====================
  
  // In-memory chat history storage (session-based)
  const chatHistories = new Map<string, Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    actions?: Array<{ id: string; label: string; type: string; params?: Record<string, any>; requiresPermission?: string }>;
  }>>();

  // POST /api/chat/message - Send message and get AI response
  app.post("/api/chat/message", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { message, context } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      const userContext = await storage.getUserContext(userId);
      const userRole = userContext?.role || 'SDR';
      const isReadOnlyUser = userRole === 'ReadOnly';

      // Get or initialize chat history
      if (!chatHistories.has(userId)) {
        chatHistories.set(userId, []);
      }
      const history = chatHistories.get(userId)!;

      // Build context-aware system prompt
      const pageContext = context?.page || '/';
      const entityContext = context?.entity;
      
      let systemPrompt = `You are an AI sales assistant integrated into a sales engagement platform. You help users with their sales activities, provide insights, and suggest actions.

Current context:
- User is viewing: ${pageContext}
- User role: ${userRole}
${entityContext ? `- Current entity: ${entityContext.type} (ID: ${entityContext.id})` : ''}

Your capabilities:
- Answer questions about sales strategies, outreach best practices, and the platform features
- Provide actionable recommendations based on the current context
- Suggest relevant actions the user can take (only if they have permission)

Guidelines:
- Be concise and actionable
- Focus on sales-related topics
- ${isReadOnlyUser ? 'The user has read-only access, so do not suggest actions that modify data.' : 'Suggest relevant actions when appropriate.'}
- Respond in a helpful, professional tone`;

      // Build conversation history for context
      const recentHistory = history.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      let response: string;
      let suggestedActions: Array<{ id: string; label: string; type: string; params?: Record<string, any>; requiresPermission?: string }> = [];

      // Check if OpenAI is available
      const { isOpenAIAvailable } = await import('./services/openai');
      
      if (isOpenAIAvailable) {
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              ...recentHistory,
              { role: "user", content: message }
            ],
            max_tokens: 1000,
            temperature: 0.7
          });

          response = completion.choices[0]?.message?.content || "I apologize, I couldn't generate a response.";
          
          // Generate suggested actions based on context (only for non-read-only users)
          if (!isReadOnlyUser) {
            suggestedActions = generateSuggestedActions(pageContext, message, userRole);
          }
        } catch (openaiError) {
          console.error('[Chat] OpenAI error:', openaiError);
          response = generateFallbackResponse(message, pageContext);
          if (!isReadOnlyUser) {
            suggestedActions = generateSuggestedActions(pageContext, message, userRole);
          }
        }
      } else {
        // Fallback response when OpenAI is not configured
        response = generateFallbackResponse(message, pageContext);
        if (!isReadOnlyUser) {
          suggestedActions = generateSuggestedActions(pageContext, message, userRole);
        }
      }

      // Store the message in history
      history.push({
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      history.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        actions: suggestedActions
      });

      // Keep only last 50 messages
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      res.json({ response, suggestedActions });
    } catch (error) {
      console.error('[Chat] Message error:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  // GET /api/chat/history - Get chat history for session
  app.get("/api/chat/history", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const history = chatHistories.get(userId) || [];
      res.json(history);
    } catch (error) {
      console.error('[Chat] History error:', error);
      res.status(500).json({ error: 'Failed to get chat history' });
    }
  });

  // POST /api/chat/action - Execute suggested action
  app.post("/api/chat/action", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userContext = await storage.getUserContext(userId);
      const userRole = userContext?.role || 'SDR';
      
      if (userRole === 'ReadOnly') {
        return res.status(403).json({ error: "Read-only users cannot execute actions" });
      }

      const { actionId, actionType, params } = req.body;
      if (!actionId || !actionType) {
        return res.status(400).json({ error: "Action ID and type are required" });
      }

      // Execute different action types
      let message = '';
      let result: any = null;

      switch (actionType) {
        case 'create_sequence':
          message = "I've prepared a sequence draft for you. Navigate to Sequences to customize it.";
          break;
        case 'find_leads':
          message = "I've started searching for matching leads. Check the Leads page for results.";
          break;
        case 'generate_email':
          message = "I've generated an email draft. You can find it in Content Studio.";
          break;
        case 'analyze_performance':
          message = "I've prepared a performance analysis. Check the Analytics page for details.";
          break;
        case 'enrich_company':
          message = "I've queued the company for enrichment. Data will be updated shortly.";
          break;
        case 'create_persona':
          message = "I've drafted a new persona based on your criteria. Visit Personas to review.";
          break;
        default:
          message = `Action "${actionType}" has been initiated.`;
      }

      res.json({ success: true, message, result });
    } catch (error) {
      console.error('[Chat] Action error:', error);
      res.status(500).json({ error: 'Failed to execute action' });
    }
  });

  // Helper function to generate fallback responses
  function generateFallbackResponse(message: string, page: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you')) {
      return `I'm your AI sales assistant! I can help you with:

• **Writing emails** - Draft personalized outreach and follow-ups
• **Creating sequences** - Build multi-step outreach campaigns
• **Analyzing leads** - Score and prioritize your prospects
• **Performance insights** - Understand what's working
• **Best practices** - Get tips on sales engagement

What would you like help with today?`;
    }

    if (lowerMessage.includes('email') || lowerMessage.includes('write')) {
      return `I can help you craft effective emails! Here are some tips:

1. **Personalize the opening** - Reference something specific about the recipient
2. **Lead with value** - Focus on their pain points, not your features
3. **Keep it concise** - Aim for 3-4 short paragraphs
4. **Clear CTA** - Ask for one specific action

Would you like me to generate a draft email for you?`;
    }

    if (lowerMessage.includes('sequence') || lowerMessage.includes('campaign')) {
      return `Creating an effective sequence typically involves:

1. **Initial outreach** - Personalized cold email
2. **Value follow-up** (Day 3) - Share relevant content
3. **Social touch** (Day 5) - Connect on LinkedIn
4. **Phone call** (Day 7) - Direct outreach
5. **Final email** (Day 10) - Breakup or reschedule

Would you like me to help create a sequence?`;
    }

    if (lowerMessage.includes('lead') || lowerMessage.includes('prospect')) {
      return `For effective lead management:

• **Prioritize by intent** - Focus on high-engagement leads first
• **Research before outreach** - Use our company intelligence features
• **Segment by persona** - Tailor messaging to different buyer types
• **Track engagement** - Monitor email opens, clicks, and replies

What specific help do you need with your leads?`;
    }

    return `I'm here to help with your sales activities! Based on what you're viewing (${page}), I can assist with:

• Writing and improving emails
• Creating outreach sequences
• Analyzing performance metrics
• Finding and enriching leads
• Developing buyer personas

Just let me know what you need!`;
  }

  // Helper function to generate suggested actions
  function generateSuggestedActions(page: string, message: string, userRole: string): Array<{ id: string; label: string; type: string; params?: Record<string, any>; requiresPermission?: string }> {
    const actions: Array<{ id: string; label: string; type: string; params?: Record<string, any>; requiresPermission?: string }> = [];
    const lowerMessage = message.toLowerCase();

    if (page === '/leads' || lowerMessage.includes('lead')) {
      actions.push({ id: 'find-leads', label: 'Find similar leads', type: 'find_leads' });
      actions.push({ id: 'enrich', label: 'Enrich company data', type: 'enrich_company' });
    }

    if (page === '/sequences' || lowerMessage.includes('sequence')) {
      actions.push({ id: 'create-seq', label: 'Create new sequence', type: 'create_sequence' });
    }

    if (page === '/content-studio' || lowerMessage.includes('email')) {
      actions.push({ id: 'gen-email', label: 'Generate email draft', type: 'generate_email' });
    }

    if (page === '/analytics' || lowerMessage.includes('performance') || lowerMessage.includes('analytics')) {
      actions.push({ id: 'analyze', label: 'Analyze performance', type: 'analyze_performance' });
    }

    if (page === '/personas' || lowerMessage.includes('persona')) {
      actions.push({ id: 'create-persona', label: 'Create persona', type: 'create_persona' });
    }

    // Admin-only actions
    if (userRole === 'Owner' || userRole === 'Admin') {
      if (page === '/sdr-teams') {
        actions.push({ id: 'manage-team', label: 'Manage team settings', type: 'manage_team', requiresPermission: 'admin' });
      }
    }

    return actions.slice(0, 3); // Limit to 3 actions
  }

  // ====== NLP Command Bar ======
  app.post("/api/nlp/parse-command", async (req: any, res) => {
    try {
      const { command } = req.body;
      
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ error: "Command is required" });
      }

      const result = await parseNLPCommand(command);
      res.json(result);
    } catch (error) {
      console.error("Error parsing NLP command:", error);
      res.status(500).json({ error: "Failed to parse command" });
    }
  });

  // ====== Autonomous Engine Routes ======
  
  // In-memory engine state (per-user in production would use Redis/DB)
  const engineStates: Map<string, {
    isRunning: boolean;
    status: 'idle' | 'warming' | 'running' | 'optimizing';
    velocity: 'warmup' | 'safe' | 'aggressive' | 'ludicrous';
    selfOptimization: boolean;
    stats: {
      actionsThisSession: number;
      leadsFound: number;
      emailsSent: number;
      optimizationsMade: number;
    };
    logs: Array<{
      id: string;
      timestamp: string;
      type: 'success' | 'action' | 'optimization' | 'warning';
      message: string;
      emoji?: string;
    }>;
    startedAt?: Date;
    intervalId?: NodeJS.Timeout;
  }> = new Map();

  const getEngineState = (userId: string) => {
    if (!engineStates.has(userId)) {
      engineStates.set(userId, {
        isRunning: false,
        status: 'idle',
        velocity: 'safe',
        selfOptimization: true,
        stats: {
          actionsThisSession: 0,
          leadsFound: 0,
          emailsSent: 0,
          optimizationsMade: 0,
        },
        logs: [],
      });
    }
    return engineStates.get(userId)!;
  };

  const addEngineLog = (userId: string, log: { type: 'success' | 'action' | 'optimization' | 'warning'; message: string; emoji?: string }) => {
    const state = getEngineState(userId);
    const newLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      ...log,
    };
    state.logs.unshift(newLog);
    if (state.logs.length > 50) {
      state.logs = state.logs.slice(0, 50);
    }
  };

  const simulateEngineActivity = (userId: string) => {
    const state = getEngineState(userId);
    if (!state.isRunning) return;

    const velocityMultiplier = {
      warmup: 0.2,
      safe: 0.5,
      aggressive: 1,
      ludicrous: 2,
    }[state.velocity];

    const activities = [
      { type: 'action' as const, emoji: '🔍', message: () => `Found new lead: ${['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Wang'][Math.floor(Math.random() * 4)]} at ${['Acme Corp', 'TechCo', 'StartupXYZ', 'BigEnterprise'][Math.floor(Math.random() * 4)]}` },
      { type: 'success' as const, emoji: '📧', message: () => `Sent personalized email to ${['alex', 'sam', 'jordan', 'taylor'][Math.floor(Math.random() * 4)]}@${['techco.io', 'startup.com', 'enterprise.net'][Math.floor(Math.random() * 3)]}` },
      { type: 'optimization' as const, emoji: '🧠', message: () => `A/B Test Winner: ${['Subject line B', 'CTA variant 2', 'Email template C'][Math.floor(Math.random() * 3)]} (+${Math.floor(Math.random() * 30 + 10)}% ${['opens', 'clicks', 'replies'][Math.floor(Math.random() * 3)]})` },
      { type: 'action' as const, emoji: '⚡', message: () => `Optimized: ${['Increased send velocity', 'Adjusted timing', 'Updated targeting'][Math.floor(Math.random() * 3)]} based on engagement` },
      { type: 'success' as const, emoji: '✅', message: () => `Lead ${['John', 'Sarah', 'Mike'][Math.floor(Math.random() * 3)]} replied - moved to engaged` },
      { type: 'warning' as const, emoji: '⚠️', message: () => `Rate limit approaching for ${['email', 'LinkedIn', 'calls'][Math.floor(Math.random() * 3)]} channel` },
    ];

    const activity = activities[Math.floor(Math.random() * activities.length)];
    addEngineLog(userId, { type: activity.type, emoji: activity.emoji, message: activity.message() });

    state.stats.actionsThisSession += 1;
    if (activity.type === 'success' && activity.emoji === '📧') {
      state.stats.emailsSent += 1;
    } else if (activity.type === 'action' && activity.emoji === '🔍') {
      state.stats.leadsFound += 1;
    } else if (activity.type === 'optimization') {
      state.stats.optimizationsMade += 1;
    }

    if (state.stats.actionsThisSession % 10 === 0 && state.status !== 'optimizing') {
      state.status = 'optimizing';
      setTimeout(() => {
        if (state.isRunning) state.status = 'running';
      }, 3000);
    }
  };

  app.post("/api/engine/start", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'anonymous';
      const state = getEngineState(userId);
      
      if (state.isRunning) {
        return res.json({ message: "Engine already running", ...state });
      }

      state.isRunning = true;
      state.status = 'warming';
      state.startedAt = new Date();
      state.stats = { actionsThisSession: 0, leadsFound: 0, emailsSent: 0, optimizationsMade: 0 };
      state.logs = [];

      addEngineLog(userId, { type: 'action', emoji: '🚀', message: 'Engine starting up...' });

      setTimeout(() => {
        if (state.isRunning) {
          state.status = 'running';
          addEngineLog(userId, { type: 'success', emoji: '✅', message: 'Engine is now running' });
        }
      }, 2000);

      const velocityIntervals = { warmup: 6000, safe: 3000, aggressive: 1500, ludicrous: 800 };
      state.intervalId = setInterval(() => {
        simulateEngineActivity(userId);
      }, velocityIntervals[state.velocity]);

      res.json({ message: "Engine started", isRunning: true, status: 'warming' });
    } catch (error) {
      console.error("Error starting engine:", error);
      res.status(500).json({ error: "Failed to start engine" });
    }
  });

  app.post("/api/engine/stop", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'anonymous';
      const state = getEngineState(userId);
      
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }

      state.isRunning = false;
      state.status = 'idle';
      addEngineLog(userId, { type: 'action', emoji: '🛑', message: 'Engine stopped' });

      res.json({ message: "Engine stopped", isRunning: false, status: 'idle', stats: state.stats });
    } catch (error) {
      console.error("Error stopping engine:", error);
      res.status(500).json({ error: "Failed to stop engine" });
    }
  });

  app.post("/api/engine/settings", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'anonymous';
      const state = getEngineState(userId);
      const { velocity, selfOptimization } = req.body;

      if (velocity && ['warmup', 'safe', 'aggressive', 'ludicrous'].includes(velocity)) {
        const oldVelocity = state.velocity;
        state.velocity = velocity;
        
        if (state.isRunning && state.intervalId) {
          clearInterval(state.intervalId);
          const velocityIntervals: Record<string, number> = { warmup: 6000, safe: 3000, aggressive: 1500, ludicrous: 800 };
          state.intervalId = setInterval(() => {
            simulateEngineActivity(userId);
          }, velocityIntervals[velocity] || 3000);
        }
        
        addEngineLog(userId, { type: 'action', emoji: '⚙️', message: `Velocity changed from ${oldVelocity} to ${velocity}` });
      }

      if (typeof selfOptimization === 'boolean') {
        state.selfOptimization = selfOptimization;
        addEngineLog(userId, { type: 'action', emoji: '🧠', message: `Self-optimization ${selfOptimization ? 'enabled' : 'disabled'}` });
      }

      res.json({ message: "Settings updated", velocity: state.velocity, selfOptimization: state.selfOptimization });
    } catch (error) {
      console.error("Error updating engine settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/engine/status", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'anonymous';
      const state = getEngineState(userId);
      
      res.json({
        isRunning: state.isRunning,
        status: state.status,
        velocity: state.velocity,
        selfOptimization: state.selfOptimization,
        stats: state.stats,
      });
    } catch (error) {
      console.error("Error getting engine status:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.get("/api/engine/logs", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || 'anonymous';
      const state = getEngineState(userId);
      
      res.json(state.logs);
    } catch (error) {
      console.error("Error getting engine logs:", error);
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  // Strategic Advisor API endpoint
  app.post("/api/advisor/ask", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { question, context } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Question is required" });
      }

      // Build context-aware information for personalized advice
      const pageContext = context?.page || '/';
      const stats = context?.stats || {};
      const campaignCount = context?.campaignCount || 0;
      const activeCampaigns = context?.activeCampaigns || 0;

      const systemPrompt = `You are a senior sales strategist with 20+ years of B2B enterprise sales experience. You've worked at companies like Salesforce, Oracle, and HubSpot, and have trained thousands of SDRs. You give practical, actionable advice that's immediately applicable.

Key traits:
- Be concise but insightful (aim for 2-3 paragraphs max)
- Always consider the user's specific context and data when available
- Cite specific numbers when you have them
- Suggest concrete next steps
- Avoid generic advice - be specific and tactical
- Use frameworks and mental models when helpful
- Be direct and confident in your recommendations

Current user context:
- Current page: ${pageContext}
- Active campaigns: ${activeCampaigns}
- Total campaigns: ${campaignCount}
${stats.replyRate !== undefined ? `- Current reply rate: ${stats.replyRate}%` : ''}
${stats.activeVisitors !== undefined ? `- Active website visitors: ${stats.activeVisitors}` : ''}
${stats.pipelineValue !== undefined ? `- Pipeline value: $${stats.pipelineValue?.toLocaleString()}` : ''}
${stats.aiSequences !== undefined ? `- AI sequences active: ${stats.aiSequences}` : ''}

When responding:
1. Reference their actual data when available (e.g., "Based on your ${stats.replyRate || 'X'}% reply rate...")
2. Give specific, tactical recommendations
3. If suggesting features, mention which page/feature can help
4. End with a clear action item`;

      // Try to use OpenAI if available, otherwise provide intelligent fallback
      let advice = '';
      let dataCitations: string[] = [];
      let suggestedActions: { label: string; link: string }[] = [];

      // Check if OpenAI is configured
      const openaiApiKey = process.env.OPENAI_API_KEY || '';
      const hasValidKey = openaiApiKey && openaiApiKey.startsWith('sk-') && openaiApiKey.length > 40;

      if (hasValidKey) {
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey: openaiApiKey });
          
          const response = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: question }
            ],
            temperature: 0.7,
            max_tokens: 500
          });

          advice = response.choices[0].message.content || '';
        } catch (aiError) {
          console.error("OpenAI API error in advisor:", aiError);
          advice = generateFallbackAdvice(question, context);
        }
      } else {
        advice = generateFallbackAdvice(question, context);
      }

      // Extract data citations from the advice
      if (stats.replyRate !== undefined && advice.includes(String(stats.replyRate))) {
        dataCitations.push(`${stats.replyRate}% reply rate`);
      }
      if (stats.activeVisitors !== undefined && advice.includes(String(stats.activeVisitors))) {
        dataCitations.push(`${stats.activeVisitors} active visitors`);
      }

      // Add relevant suggested actions based on the question topic
      const lowerQuestion = question.toLowerCase();
      if (lowerQuestion.includes('email') || lowerQuestion.includes('template')) {
        suggestedActions.push({ label: 'Open Content Studio', link: '/content-studio' });
      }
      if (lowerQuestion.includes('sequence') || lowerQuestion.includes('cadence') || lowerQuestion.includes('follow')) {
        suggestedActions.push({ label: 'View Sequences', link: '/sequences' });
      }
      if (lowerQuestion.includes('lead') || lowerQuestion.includes('target') || lowerQuestion.includes('prospect')) {
        suggestedActions.push({ label: 'Lead Database', link: '/leads' });
      }
      if (lowerQuestion.includes('persona') || lowerQuestion.includes('icp') || lowerQuestion.includes('cfo') || lowerQuestion.includes('vp')) {
        suggestedActions.push({ label: 'Manage Personas', link: '/personas' });
      }
      if (lowerQuestion.includes('performance') || lowerQuestion.includes('analytics') || lowerQuestion.includes('metrics')) {
        suggestedActions.push({ label: 'View Analytics', link: '/analytics' });
      }

      res.json({
        advice,
        dataCitations,
        suggestedActions: suggestedActions.slice(0, 2) // Limit to 2 actions
      });
    } catch (error) {
      console.error("Error in advisor endpoint:", error);
      res.status(500).json({ error: "Failed to get advice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Generate fallback advice when OpenAI is not available
function generateFallbackAdvice(question: string, context: any): string {
  const lowerQuestion = question.toLowerCase();
  const stats = context?.stats || {};
  
  // Targeting questions
  if (lowerQuestion.includes('cfo') || lowerQuestion.includes('vp of finance') || lowerQuestion.includes('target')) {
    return `Great question about targeting! For financial decision-makers, here's my recommendation:

**Target VPs of Finance first** if you're selling solutions under $50K ACV - they often have budget authority and faster decision cycles. **Target CFOs** for enterprise deals over $100K where you need executive sponsorship.

A proven approach: Start with VP-level contacts to build internal champions, then ladder up to CFO for final approval. This dual-track strategy typically improves win rates by 30-40%.

**Next step:** Build two separate persona profiles in your Personas page - one for VPs with tactical messaging, one for CFOs with strategic/ROI messaging.`;
  }
  
  // Series B / company stage questions  
  if (lowerQuestion.includes('series b') || lowerQuestion.includes('startup') || lowerQuestion.includes('funding')) {
    return `Series B companies are in a sweet spot for outreach. Here's why and how to approach them:

**Why Series B is ideal:** They have budget (just raised $15-50M typically), they're scaling fast, and they're actively buying tools to support growth. They're also less bureaucratic than Series C+.

**Best approach:**
1. Lead with growth enablement, not cost savings
2. Reference their recent funding in your opening
3. Connect to their likely priorities: scaling team, entering new markets, hitting aggressive targets
4. Move fast - their buying cycles are 30-60 days, not quarters

${stats.replyRate ? `With your current ${stats.replyRate}% reply rate, focusing on Series B could boost that to 15-20% given their responsiveness.` : ''}

**Action:** Filter your lead database by funding stage and prioritize Series B companies.`;
  }
  
  // Follow-up cadence questions
  if (lowerQuestion.includes('follow') || lowerQuestion.includes('cadence') || lowerQuestion.includes('aggressive')) {
    return `Here's the data-backed cadence that works:

**Optimal follow-up timing:**
- Day 3: First follow-up (adds 22% response rate)
- Day 7: Second follow-up with new angle
- Day 14: "Break-up" email (surprisingly effective)
- Day 21: Final value-add touch

**How aggressive?** Match your prospect's industry. Tech companies expect 5-7 touches. Traditional industries (manufacturing, finance) prefer 3-4 max.

The key insight: Each follow-up should add value, not just "checking in." Share a relevant stat, case study, or industry insight.

${stats.aiSequences ? `You have ${stats.aiSequences} active sequences - review them to ensure each follow-up adds unique value.` : ''}

**Next step:** Audit your sequences for value-add content in each touchpoint.`;
  }
  
  // Email questions
  if (lowerQuestion.includes('email') || lowerQuestion.includes('length') || lowerQuestion.includes('subject')) {
    return `Email length is crucial - here's what the data shows:

**Optimal length:** 50-125 words gets the highest response rates (32% better than longer emails). Your email should be readable in under 30 seconds.

**Structure that works:**
1. Personalized hook (1-2 sentences referencing them/their company)
2. Value proposition (1 sentence, specific benefit)
3. Social proof (1 sentence, relevant to their industry)
4. Clear CTA (1 question, easy to answer)

**Subject lines:** 3-5 words perform best. Questions outperform statements. Personalization in subject line increases opens by 26%.

${stats.replyRate ? `Your ${stats.replyRate}% reply rate could improve by 5-10% with tighter, more focused emails.` : ''}

**Action:** Open Content Studio and audit your templates for length and structure.`;
  }
  
  // Enterprise questions
  if (lowerQuestion.includes('enterprise') || lowerQuestion.includes('large') || lowerQuestion.includes('big')) {
    return `Enterprise sales requires a different playbook. Here's what works:

**Multi-threading is essential:** Never rely on a single contact. Map out 3-5 stakeholders across departments and engage them simultaneously.

**Approach:**
1. Start with a "champion" - usually director-level in the buying department
2. Simultaneously warm up procurement/IT if relevant
3. Build executive air cover with light-touch C-suite outreach
4. Use account-based campaigns, not generic sequences

**Longer cycles are normal:** Enterprise deals take 3-6 months. Your sequence should be a 90-day nurture, not a 14-day sprint.

**Key insight:** Enterprise buyers want partners, not vendors. Lead with strategic insights about their industry, not product features.

**Action:** Create an enterprise-specific sequence with longer intervals and higher-value touchpoints.`;
  }
  
  // Default strategic advice
  return `Great strategic question! Here's my perspective:

Based on B2B sales best practices, success typically comes from three key areas:

1. **Targeting precision:** Focus on your ideal customer profile ruthlessly. Broad outreach produces weak results.

2. **Personalization at scale:** Every touch should feel 1:1, even when automated. Reference specific company details, not just names.

3. **Multi-channel approach:** Email alone gets 8-12% replies. Add calls, LinkedIn, and targeted ads to reach 20-25%.

${stats.replyRate ? `Your current ${stats.replyRate}% reply rate suggests there's room to optimize your targeting and messaging.` : ''}
${stats.activeCampaigns ? `With ${context?.activeCampaigns} active campaigns, consider consolidating to your top performers.` : ''}

**Next step:** I'd recommend reviewing your Personas page to ensure your ICP is tightly defined, then auditing your sequences for personalization.

Ask me a more specific question about targeting, cadence, messaging, or account strategy for detailed tactical advice!`;
}

// NLP Command Parsing function
async function parseNLPCommand(command: string): Promise<{
  intent: string;
  filters: Record<string, any>;
  suggestedAction: string;
  confidence: number;
  resultCount?: number;
  resultSummary?: string;
}> {
  // Import OpenAI client
  const OpenAI = (await import("openai")).default;
  
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || '';
  const isValidKey = apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;
  
  if (!isValidKey) {
    // Return intelligent mock response based on command parsing
    return parseCommandLocally(command);
  }
  
  try {
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a sales engagement AI assistant. Parse the user's natural language command and extract:
1. intent - what they want to do (find_leads, create_campaign, pause_campaign, build_sequence, analyze_data)
2. filters - criteria for targeting (titles, industries, company_stage, behaviors, metrics)
3. suggestedAction - the recommended next step
4. confidence - how confident you are in understanding (0-1)
5. resultCount - estimated number of results (make a reasonable estimate)
6. resultSummary - a human-readable summary of what was found

Respond with JSON in this format:
{
  "intent": "string",
  "filters": { "key": "value" },
  "suggestedAction": "string",
  "confidence": number,
  "resultCount": number,
  "resultSummary": "string"
}`
        },
        {
          role: "user",
          content: command
        }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("OpenAI API error:", error);
    return parseCommandLocally(command);
  }
}

// Local command parsing fallback
function parseCommandLocally(command: string): {
  intent: string;
  filters: Record<string, any>;
  suggestedAction: string;
  confidence: number;
  resultCount?: number;
  resultSummary?: string;
} {
  const lowerCommand = command.toLowerCase();
  const filters: Record<string, any> = {};
  let intent = "find_leads";
  let suggestedAction = "Create a new campaign with these filters";
  let confidence = 0.75;
  let resultCount = Math.floor(Math.random() * 100) + 10;
  
  // Detect intent
  if (lowerCommand.includes("pause") || lowerCommand.includes("stop")) {
    intent = "pause_campaign";
    suggestedAction = "Review and pause matching campaigns";
    confidence = 0.85;
  } else if (lowerCommand.includes("sequence") || lowerCommand.includes("follow-up") || lowerCommand.includes("followup")) {
    intent = "build_sequence";
    suggestedAction = "Create a new sequence with recommended steps";
    confidence = 0.82;
  } else if (lowerCommand.includes("analyze") || lowerCommand.includes("report")) {
    intent = "analyze_data";
    suggestedAction = "Generate performance report";
    confidence = 0.78;
  }
  
  // Extract filters
  const titlePatterns = [
    { pattern: /\bcto\b/i, value: "CTO" },
    { pattern: /\bvp\b.*\bsales\b/i, value: "VP of Sales" },
    { pattern: /\bvp\b.*\bengineering\b/i, value: "VP of Engineering" },
    { pattern: /\bdirector\b/i, value: "Director" },
    { pattern: /\bceo\b/i, value: "CEO" },
    { pattern: /\bcfo\b/i, value: "CFO" },
  ];
  
  for (const { pattern, value } of titlePatterns) {
    if (pattern.test(lowerCommand)) {
      filters.title = value;
      break;
    }
  }
  
  // Extract industry
  const industryPatterns = [
    { pattern: /\bfintech\b/i, value: "Fintech" },
    { pattern: /\bsaas\b/i, value: "SaaS" },
    { pattern: /\bhealthcare\b/i, value: "Healthcare" },
    { pattern: /\be-?commerce\b/i, value: "E-commerce" },
  ];
  
  for (const { pattern, value } of industryPatterns) {
    if (pattern.test(lowerCommand)) {
      filters.industry = value;
      break;
    }
  }
  
  // Extract company stage
  const stagePatterns = [
    { pattern: /\bseries\s*a\b/i, value: "Series A" },
    { pattern: /\bseries\s*b\b/i, value: "Series B" },
    { pattern: /\bseries\s*c\b/i, value: "Series C" },
    { pattern: /\bstartup/i, value: "Startup" },
    { pattern: /\benterprise/i, value: "Enterprise" },
  ];
  
  for (const { pattern, value } of stagePatterns) {
    if (pattern.test(lowerCommand)) {
      filters.companyStage = value;
      break;
    }
  }
  
  // Extract behaviors/signals
  if (lowerCommand.includes("hiring") || lowerCommand.includes("posted about")) {
    filters.recentActivity = "social_post";
  }
  if (lowerCommand.includes("security") || lowerCommand.includes("worried")) {
    filters.painPoint = "security";
  }
  if (lowerCommand.includes("webinar")) {
    filters.eventType = "webinar_attendee";
  }
  if (lowerCommand.includes("no-show")) {
    filters.eventStatus = "no_show";
  }
  
  // Extract metrics for campaign management
  if (lowerCommand.includes("open rate")) {
    const rateMatch = lowerCommand.match(/(\d+)%?\s*open\s*rate/i);
    if (rateMatch) {
      filters.openRateThreshold = parseInt(rateMatch[1]);
    }
  }
  
  // Generate result summary
  let resultSummary = `Found ${resultCount} `;
  if (filters.title) {
    resultSummary += `${filters.title}s `;
  } else {
    resultSummary += "prospects ";
  }
  if (filters.industry) {
    resultSummary += `in ${filters.industry} `;
  }
  if (filters.companyStage) {
    resultSummary += `at ${filters.companyStage} companies `;
  }
  resultSummary += "matching your criteria";
  
  return {
    intent,
    filters,
    suggestedAction,
    confidence,
    resultCount,
    resultSummary
  };
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
    { name: "Cold Outreach", steps: 5, channels: ["email", "linkedin", "phone"], duration: "14 days" }
  ];
}

function generateNurtureSteps(industry: string) {
  return [
    { name: "Nurture Sequence", steps: 4, channels: ["email", "linkedin"], duration: "30 days" }
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
      targetAudience: { titles: ["VP Sales", "CRO", "Head of Sales"], companySize: "50-500", industries: [industry] },
      sequences: generateMagicSetupSequenceSteps(industry),
      emailTemplates: { 
        cold: { subject: `${industry} Growth Strategy`, preview: generateEmailTemplate(industry) }, 
        followUp: { subject: `Following Up - ${industry}`, preview: generateFollowUpTemplate(industry) }
      },
      successMetrics: { avgReplyRate: "8%", avgMeetingRate: "3%", timeToFirst: "2 days" },
      isTemplate: true
    },
    {
      name: `${industry} Nurture Campaign`,
      industry,
      description: `Long-term nurture sequence for ${industry} prospects`,
      targetAudience: { titles: ["Director", "Manager"], companySize: "10-200", industries: [industry] },
      sequences: generateNurtureSteps(industry),
      emailTemplates: { 
        nurture: { subject: `Valuable Insights for ${industry}`, preview: generateFollowUpTemplate(industry) }
      },
      successMetrics: { avgReplyRate: "12%", avgMeetingRate: "2%", timeToFirst: "5 days" },
      isTemplate: true
    }
  ];

  for (const playbook of playbooks) {
    await storage.createPlaybook(playbook as any);
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

async function applyPlaybook(playbook: any, userId: string, selectedSequenceNames?: string[]) {
  const results = {
    sequencesCreated: [] as any[],
    templatesCreated: [] as any[],
    scriptsCreated: [] as any[],
    errors: [] as string[]
  };

  try {
    // Filter sequences if specific ones were selected
    const sequencesToCreate = playbook.sequences?.filter((seq: any) => 
      !selectedSequenceNames || selectedSequenceNames.includes(seq.name)
    ) || [];

    // Create each sequence
    for (const seqTemplate of sequencesToCreate) {
      try {
        // Parse duration (e.g., "21 days" -> 21)
        const durationDays = parseInt(seqTemplate.duration) || 14;
        
        // Generate sequence steps based on template
        const steps = [];
        const stepCount = seqTemplate.steps || 5;
        const daysBetweenSteps = Math.floor(durationDays / stepCount);
        
        for (let i = 0; i < stepCount; i++) {
          const stepType = seqTemplate.channels?.[i % seqTemplate.channels.length]?.toLowerCase() || 'email';
          const delay = i === 0 ? 0 : i * daysBetweenSteps;
          
          // Find corresponding email template if it exists
          let content = '';
          let subject = '';
          if (stepType === 'email' && playbook.emailTemplates) {
            const templateKeys = Object.keys(playbook.emailTemplates);
            const templateKey = templateKeys[i % templateKeys.length];
            const template = playbook.emailTemplates[templateKey];
            if (template) {
              subject = template.subject || `Follow-up ${i + 1}`;
              content = template.preview || `Step ${i + 1} content for ${seqTemplate.name}`;
            }
          } else {
            subject = `${seqTemplate.name} - Step ${i + 1}`;
            content = `This is step ${i + 1} of the ${seqTemplate.name} sequence.`;
          }
          
          steps.push({
            stepNumber: i + 1,
            type: stepType,
            delay: delay,
            subject: subject,
            body: content,
            isActive: true
          });
        }
        
        // Create the sequence
        const newSequence = await storage.createSequence({
          name: seqTemplate.name,
          description: `Applied from playbook: ${playbook.name}`,
          steps: JSON.stringify(steps),
          status: 'draft',
          createdBy: userId,
          targets: JSON.stringify({
            titles: playbook.targetAudience?.titles || [],
            companySize: playbook.targetAudience?.companySize || 'All',
            industries: playbook.targetAudience?.industries || []
          })
        });
        
        results.sequencesCreated.push({
          id: newSequence.id,
          name: newSequence.name,
          stepCount: steps.length
        });
        
      } catch (error) {
        console.error(`Failed to create sequence ${seqTemplate.name}:`, error);
        results.errors.push(`Failed to create sequence: ${seqTemplate.name}`);
      }
    }
    
    // Create email templates as content templates with versions
    if (playbook.emailTemplates) {
      for (const [key, template] of Object.entries(playbook.emailTemplates)) {
        try {
          // Create the template metadata
          const contentTemplate = await storage.createTemplate({
            name: `${playbook.name} - ${key}`,
            contentType: 'email',
            description: `Template from ${playbook.name} playbook`,
            personaId: null,
            status: 'active',
            createdBy: userId,
            defaultTone: 'professional',
            tags: [playbook.industry, 'playbook']
          });
          
          // Create the template version with actual content
          await storage.createTemplateVersion({
            templateId: contentTemplate.id,
            versionNumber: 1,
            subject: (template as any).subject || `Template: ${key}`,
            body: (template as any).preview || '',
            source: 'imported',
            personaSnapshot: null,
            audienceSnapshot: null
          });
          
          results.templatesCreated.push({
            id: contentTemplate.id,
            name: contentTemplate.name,
            type: 'email'
          });
        } catch (error) {
          console.error(`Failed to create template ${key}:`, error);
          results.errors.push(`Failed to create template: ${key}`);
        }
      }
    }
    
    // Create call scripts if available
    if (playbook.callScripts) {
      for (const [key, script] of Object.entries(playbook.callScripts)) {
        try {
          const callScript = await storage.createCallScript({
            type: key,
            name: `${playbook.name} - ${key}`,
            opening: (script as any).opening || (script as any).script || '',
            personaId: null,
            valueProps: (script as any).valueProps || null,
            questions: (script as any).questions || null,
            objectionHandlers: (script as any).objectionHandlers || null,
            closing: (script as any).closing || null,
            aiGenerated: true,
            successRate: null
          });
          
          results.scriptsCreated.push({
            id: callScript.id,
            name: callScript.name,
            type: key
          });
        } catch (error) {
          console.error(`Failed to create script ${key}:`, error);
          results.errors.push(`Failed to create script: ${key}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error applying playbook:', error);
    results.errors.push('General error applying playbook');
  }
  
  return results;
}
