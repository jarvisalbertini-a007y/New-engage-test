import { 
  type User, type InsertUser, type UpsertUser,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type VisitorSession, type InsertVisitorSession,
  type Sequence, type InsertSequence,
  type Email, type InsertEmail,
  type Insight, type InsertInsight,
  type Persona, type InsertPersona,
  type Task, type InsertTask,
  type PhoneCall, type InsertPhoneCall,
  type CallScript, type InsertCallScript,
  type Voicemail, type InsertVoicemail,
  type AiAgent, type InsertAiAgent,
  type OnboardingProfile, type InsertOnboardingProfile,
  type PlatformConfig, type InsertPlatformConfig,
  type WorkflowTrigger, type InsertWorkflowTrigger,
  type Playbook, type InsertPlaybook,
  type AutopilotCampaign, type InsertAutopilotCampaign,
  type AutopilotRun, type InsertAutopilotRun,
  type LeadScoringModel, type InsertLeadScoringModel,
  type LeadScore, type InsertLeadScore,
  type Workflow, type InsertWorkflow,
  type WorkflowExecution, type InsertWorkflowExecution,
  type AgentType, type InsertAgentType,
  type WorkflowTemplate, type InsertWorkflowTemplate,
  type HumanApproval, type InsertHumanApproval,
  users, companies, contacts, visitorSessions, sequences, emails, insights, personas, tasks, phoneCalls, callScripts, voicemails, aiAgents, onboardingProfiles, platformConfigs, workflowTriggers, playbooks, autopilotCampaigns, autopilotRuns, leadScoringModels, leadScores, workflows, workflowExecutions, agentTypes, workflowTemplates, humanApprovals
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

// Helper to filter out undefined values from partial updates
function cleanPartial<T extends Record<string, any>>(obj: Partial<T>): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export interface IStorage {
  // Users - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanies(limit?: number): Promise<Company[]>;
  getCompaniesByDomain(domain: string): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined>;

  // Contacts
  getContact(id: string): Promise<Contact | undefined>;
  getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;

  // Visitor Sessions
  getVisitorSession(id: string): Promise<VisitorSession | undefined>;
  getActiveVisitorSessions(): Promise<VisitorSession[]>;
  getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]>;
  createVisitorSession(session: InsertVisitorSession): Promise<VisitorSession>;
  updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined>;

  // Sequences
  getSequence(id: string): Promise<Sequence | undefined>;
  getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]>;
  createSequence(sequence: InsertSequence): Promise<Sequence>;
  updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined>;

  // Emails
  getEmail(id: string): Promise<Email | undefined>;
  getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined>;

  // Insights
  getInsight(id: string): Promise<Insight | undefined>;
  getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;

  // Personas
  getPersona(id: string): Promise<Persona | undefined>;
  getPersonas(createdBy?: string): Promise<Persona[]>;
  createPersona(persona: InsertPersona): Promise<Persona>;
  updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;

  // Phone Calls
  getPhoneCall(id: string): Promise<PhoneCall | undefined>;
  getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]>;
  createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall>;
  updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined>;

  // Call Scripts
  getCallScript(id: string): Promise<CallScript | undefined>;
  getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]>;
  createCallScript(script: InsertCallScript): Promise<CallScript>;
  updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined>;

  // Voicemails
  getVoicemail(id: string): Promise<Voicemail | undefined>;
  getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]>;
  createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail>;
  updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined>;

  // AI Agents
  getAiAgent(id: string): Promise<AiAgent | undefined>;
  getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<boolean>;
  
  // Onboarding
  getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined>;
  createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile>;
  updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined>;
  
  // Platform Config
  getPlatformConfig(userId: string): Promise<PlatformConfig | undefined>;
  createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig>;
  updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined>;
  
  // Workflow Triggers
  getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined>;
  getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]>;
  createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger>;
  updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined>;
  deleteWorkflowTrigger(id: string): Promise<boolean>;
  
  // Playbooks
  getPlaybook(id: string): Promise<Playbook | undefined>;
  getPlaybooks(filters?: { industry?: string; isTemplate?: boolean }): Promise<Playbook[]>;
  createPlaybook(playbook: InsertPlaybook): Promise<Playbook>;
  updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined>;

  // Autopilot Campaigns
  getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined>;
  getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]>;
  createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign>;
  updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined>;

  // Autopilot Runs
  getAutopilotRun(id: string): Promise<AutopilotRun | undefined>;
  getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]>;
  createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun>;
  updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined>;

  // Lead Scoring Model methods
  getLeadScoringModels(): Promise<LeadScoringModel[]>;
  getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined>;
  createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel>;
  updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel>;
  deleteLeadScoringModel(id: string): Promise<void>;

  // Lead Score methods
  getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]>;
  getLeadScoreById(id: string): Promise<LeadScore | undefined>;
  createLeadScore(score: InsertLeadScore): Promise<LeadScore>;
  updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore>;
  deleteLeadScore(id: string): Promise<void>;

  // Workflows
  getWorkflow(id: string): Promise<Workflow | undefined>;
  getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  
  // Workflow Executions
  getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined>;
  getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]>;
  createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution>;
  updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined>;
  
  // Agent Types
  getAgentType(id: string): Promise<AgentType | undefined>;
  getAgentTypes(filters?: { category?: string }): Promise<AgentType[]>;
  createAgentType(agentType: InsertAgentType): Promise<AgentType>;
  updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined>;
  
  // Workflow Templates
  getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined>;
  getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]>;
  createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate>;
  updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined>;
  
  // Human Approvals
  getHumanApproval(id: string): Promise<HumanApproval | undefined>;
  getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]>;
  createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval>;
  updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private visitorSessions: Map<string, VisitorSession> = new Map();
  private sequences: Map<string, Sequence> = new Map();
  private emails: Map<string, Email> = new Map();
  private insights: Map<string, Insight> = new Map();
  private personas: Map<string, Persona> = new Map();
  private tasks: Map<string, Task> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Create sample companies
    const companies = [
      {
        id: "comp1",
        name: "TechCorp Solutions",
        domain: "techcorp.com",
        industry: "SaaS",
        size: "50-200",
        location: "San Francisco, CA",
        revenue: "$10M-50M",
        technologies: ["React", "Node.js", "AWS"],
        description: "Leading SaaS platform for enterprise automation",
        linkedinUrl: "https://linkedin.com/company/techcorp",
        createdAt: new Date(),
      },
      {
        id: "comp2",
        name: "DataFlow Inc",
        domain: "dataflow.com",
        industry: "Fintech",
        size: "200-500",
        location: "Austin, TX",
        revenue: "$50M-100M",
        technologies: ["Python", "PostgreSQL", "Kubernetes"],
        description: "Financial data processing solutions",
        linkedinUrl: "https://linkedin.com/company/dataflow",
        createdAt: new Date(),
      },
      {
        id: "comp3",
        name: "NextGen Analytics",
        domain: "nextgen.com",
        industry: "Healthcare",
        size: "100-300",
        location: "Denver, CO",
        revenue: "$25M-50M",
        technologies: ["Angular", "MongoDB", "Docker"],
        description: "Healthcare analytics and insights platform",
        linkedinUrl: "https://linkedin.com/company/nextgen",
        createdAt: new Date(),
      }
    ];

    companies.forEach(company => this.companies.set(company.id, company));

    // Create sample visitor sessions
    const sessions = [
      {
        id: "session1",
        companyId: "comp1",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0...",
        pagesViewed: ["/pricing", "/features", "/demo"],
        timeOnSite: 450,
        intentScore: 94,
        isActive: true,
        lastActivity: new Date(),
        createdAt: new Date(),
      },
      {
        id: "session2",
        companyId: "comp2",
        ipAddress: "192.168.1.101",
        userAgent: "Mozilla/5.0...",
        pagesViewed: ["/features", "/about"],
        timeOnSite: 180,
        intentScore: 72,
        isActive: true,
        lastActivity: new Date(),
        createdAt: new Date(),
      }
    ];

    sessions.forEach(session => this.visitorSessions.set(session.id, session));

    // Create sample insights
    const insights = [
      {
        id: "insight1",
        companyId: "comp1",
        type: "funding",
        title: "TechCorp raised $15M Series A",
        description: "Perfect timing to reach out about scaling solutions",
        source: "TechCrunch",
        confidence: "0.95",
        relevanceScore: 88,
        actionable: true,
        data: { amount: "$15M", round: "Series A" },
        createdAt: new Date(),
      },
      {
        id: "insight2",
        companyId: "comp2",
        type: "leadership_change",
        title: "New CTO at DataFlow Inc",
        description: "Sarah Chen joined as CTO - focus on tech stack modernization",
        source: "LinkedIn",
        confidence: "0.87",
        relevanceScore: 92,
        actionable: true,
        data: { person: "Sarah Chen", role: "CTO" },
        createdAt: new Date(),
      }
    ];

    insights.forEach(insight => this.insights.set(insight.id, insight));
  }

  // User methods - Required for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || randomUUID();
    const existingUser = this.users.get(id);
    const user = existingUser 
      ? { ...existingUser, ...userData, updatedAt: new Date() } as User
      : { ...userData, id, createdAt: new Date(), updatedAt: new Date(), role: userData.role || "Sales Rep" } as User;
    this.users.set(id, user);
    return user;
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanies(limit = 50): Promise<Company[]> {
    return Array.from(this.companies.values()).slice(0, limit);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(c => c.domain === domain);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const company: Company = { 
      id, 
      createdAt: new Date(),
      name: insertCompany.name,
      domain: insertCompany.domain ?? null,
      industry: insertCompany.industry ?? null,
      size: insertCompany.size ?? null,
      location: insertCompany.location ?? null,
      revenue: insertCompany.revenue ?? null,
      technologies: insertCompany.technologies ?? null,
      description: insertCompany.description ?? null,
      linkedinUrl: insertCompany.linkedinUrl ?? null
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...updates };
    this.companies.set(id, updated);
    return updated;
  }

  // Contact methods
  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());
    
    if (filters?.companyId) {
      contacts = contacts.filter(c => c.companyId === filters.companyId);
    }
    
    return contacts.slice(0, filters?.limit || 50);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { 
      id,
      createdAt: new Date(),
      email: insertContact.email,
      firstName: insertContact.firstName,
      lastName: insertContact.lastName,
      companyId: insertContact.companyId ?? null,
      title: insertContact.title ?? null,
      linkedinUrl: insertContact.linkedinUrl ?? null,
      phoneNumber: insertContact.phoneNumber ?? null,
      isVerified: insertContact.isVerified ?? null
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updated = { ...contact, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  // Visitor session methods
  async getVisitorSession(id: string): Promise<VisitorSession | undefined> {
    return this.visitorSessions.get(id);
  }

  async getActiveVisitorSessions(): Promise<VisitorSession[]> {
    return Array.from(this.visitorSessions.values()).filter(s => s.isActive);
  }

  async getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]> {
    return Array.from(this.visitorSessions.values()).filter(s => s.companyId === companyId);
  }

  async createVisitorSession(insertSession: InsertVisitorSession): Promise<VisitorSession> {
    const id = randomUUID();
    const session: VisitorSession = { 
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: insertSession.ipAddress,
      companyId: insertSession.companyId ?? null,
      userAgent: insertSession.userAgent ?? null,
      pagesViewed: insertSession.pagesViewed ?? null,
      timeOnSite: insertSession.timeOnSite ?? null,
      intentScore: insertSession.intentScore ?? null,
      isActive: insertSession.isActive ?? null
    };
    this.visitorSessions.set(id, session);
    return session;
  }

  async updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined> {
    const session = this.visitorSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.visitorSessions.set(id, updated);
    return updated;
  }

  // Sequence methods
  async getSequence(id: string): Promise<Sequence | undefined> {
    return this.sequences.get(id);
  }

  async getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]> {
    let sequences = Array.from(this.sequences.values());
    
    if (filters?.createdBy) {
      sequences = sequences.filter(s => s.createdBy === filters.createdBy);
    }
    
    if (filters?.status) {
      sequences = sequences.filter(s => s.status === filters.status);
    }
    
    return sequences;
  }

  async createSequence(insertSequence: InsertSequence): Promise<Sequence> {
    const id = randomUUID();
    const sequence: Sequence = { 
      id,
      createdAt: new Date(),
      name: insertSequence.name,
      steps: insertSequence.steps,
      description: insertSequence.description ?? null,
      status: insertSequence.status ?? "draft",
      targets: insertSequence.targets ?? null,
      createdBy: insertSequence.createdBy ?? null
    };
    this.sequences.set(id, sequence);
    return sequence;
  }

  async updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined> {
    const sequence = this.sequences.get(id);
    if (!sequence) return undefined;
    const updated = { ...sequence, ...updates };
    this.sequences.set(id, updated);
    return updated;
  }

  // Email methods
  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]> {
    let emails = Array.from(this.emails.values());
    
    if (filters?.contactId) {
      emails = emails.filter(e => e.contactId === filters.contactId);
    }
    
    if (filters?.status) {
      emails = emails.filter(e => e.status === filters.status);
    }
    
    return emails.slice(0, filters?.limit || 50);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const email: Email = { 
      id,
      createdAt: new Date(),
      subject: insertEmail.subject,
      body: insertEmail.body,
      status: insertEmail.status ?? "draft",
      contactId: insertEmail.contactId ?? null,
      sequenceExecutionId: insertEmail.sequenceExecutionId ?? null,
      sentAt: insertEmail.sentAt ?? null,
      openedAt: insertEmail.openedAt ?? null,
      repliedAt: insertEmail.repliedAt ?? null,
      aiScore: insertEmail.aiScore ?? null,
      aiSuggestions: insertEmail.aiSuggestions ?? null
    };
    this.emails.set(id, email);
    return email;
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    const updated = { ...email, ...updates };
    this.emails.set(id, updated);
    return updated;
  }

  // Insight methods
  async getInsight(id: string): Promise<Insight | undefined> {
    return this.insights.get(id);
  }

  async getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]> {
    let insights = Array.from(this.insights.values());
    
    if (filters?.companyId) {
      insights = insights.filter(i => i.companyId === filters.companyId);
    }
    
    if (filters?.type) {
      insights = insights.filter(i => i.type === filters.type);
    }
    
    return insights.slice(0, filters?.limit || 20);
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const id = randomUUID();
    const insight: Insight = { 
      id,
      createdAt: new Date(),
      type: insertInsight.type,
      title: insertInsight.title,
      description: insertInsight.description,
      data: insertInsight.data ?? null,
      source: insertInsight.source ?? null,
      companyId: insertInsight.companyId ?? null,
      confidence: insertInsight.confidence ?? null,
      relevanceScore: insertInsight.relevanceScore ?? null,
      actionable: insertInsight.actionable ?? null
    };
    this.insights.set(id, insight);
    return insight;
  }

  // Persona methods
  async getPersona(id: string): Promise<Persona | undefined> {
    return this.personas.get(id);
  }

  async getPersonas(createdBy?: string): Promise<Persona[]> {
    let personas = Array.from(this.personas.values());
    
    if (createdBy) {
      personas = personas.filter(p => p.createdBy === createdBy);
    }
    
    return personas;
  }

  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const id = randomUUID();
    const persona: Persona = { 
      id,
      createdAt: new Date(),
      name: insertPersona.name,
      description: insertPersona.description ?? null,
      createdBy: insertPersona.createdBy ?? null,
      targetTitles: insertPersona.targetTitles ?? null,
      industries: insertPersona.industries ?? null,
      companySizes: insertPersona.companySizes ?? null,
      valuePropositions: insertPersona.valuePropositions ?? null,
      toneGuidelines: insertPersona.toneGuidelines ?? null
    };
    this.personas.set(id, persona);
    return persona;
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const persona = this.personas.get(id);
    if (!persona) return undefined;
    const updated = { ...persona, ...updates };
    this.personas.set(id, updated);
    return updated;
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filters?.assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
    }
    
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    
    if (filters?.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    
    return tasks;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = { 
      id,
      createdAt: new Date(),
      title: insertTask.title,
      type: insertTask.type,
      description: insertTask.description ?? null,
      status: insertTask.status ?? "pending",
      companyId: insertTask.companyId ?? null,
      contactId: insertTask.contactId ?? null,
      assignedTo: insertTask.assignedTo ?? null,
      priority: insertTask.priority ?? "medium",
      dueDate: insertTask.dueDate ?? null
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  // Phone Calls (stub implementations)
  async getPhoneCall(id: string): Promise<PhoneCall | undefined> {
    return undefined;
  }

  async getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]> {
    return [];
  }

  async createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall> {
    return { ...call, id: randomUUID(), createdAt: new Date() } as PhoneCall;
  }

  async updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined> {
    return undefined;
  }

  // Call Scripts (stub implementations)
  async getCallScript(id: string): Promise<CallScript | undefined> {
    return undefined;
  }

  async getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]> {
    return [];
  }

  async createCallScript(script: InsertCallScript): Promise<CallScript> {
    return { ...script, id: randomUUID(), createdAt: new Date(), usageCount: 0 } as CallScript;
  }

  async updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined> {
    return undefined;
  }

  // Voicemails (stub implementations)
  async getVoicemail(id: string): Promise<Voicemail | undefined> {
    return undefined;
  }

  async getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]> {
    return [];
  }

  async createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail> {
    return { ...voicemail, id: randomUUID(), createdAt: new Date() } as Voicemail;
  }

  async updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined> {
    return undefined;
  }

  // AI Agents (stub implementations)
  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    return undefined;
  }

  async getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]> {
    return [];
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    return { ...agent, id: randomUUID(), createdAt: new Date() } as AiAgent;
  }

  async updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    return undefined;
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    return false;
  }
  
  // Onboarding (stub implementations)
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined> {
    return undefined;
  }
  
  async createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile> {
    return { ...profile, id: randomUUID(), createdAt: new Date(), isComplete: false, onboardingStep: 1 } as OnboardingProfile;
  }
  
  async updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    return undefined;
  }
  
  // Platform Config stubs
  async getPlatformConfig(userId: string): Promise<PlatformConfig | undefined> {
    return undefined;
  }

  async createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig> {
    return { ...config, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as PlatformConfig;
  }

  async updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined> {
    return undefined;
  }
  
  // Workflow Trigger stubs
  async getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined> {
    return undefined;
  }

  async getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]> {
    return [];
  }

  async createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger> {
    return { ...trigger, id: randomUUID(), createdAt: new Date(), executionCount: 0, lastExecuted: null } as WorkflowTrigger;
  }

  async updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined> {
    return undefined;
  }

  async deleteWorkflowTrigger(id: string): Promise<boolean> {
    return false;
  }
  
  // Playbook stubs  
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    return undefined;
  }

  async getPlaybooks(filters?: { industry?: string; isTemplate?: boolean }): Promise<Playbook[]> {
    return [];
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    return { ...playbook, id: randomUUID(), createdAt: new Date() } as Playbook;
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    return undefined;
  }

  // Autopilot stubs
  async getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined> {
    return undefined;
  }

  async getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]> {
    return [];
  }

  async createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign> {
    return { ...campaign, id: randomUUID(), createdAt: new Date() } as AutopilotCampaign;
  }

  async updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined> {
    return { id, ...updates, createdAt: new Date() } as AutopilotCampaign;
  }

  async getAutopilotRun(id: string): Promise<AutopilotRun | undefined> {
    return undefined;
  }

  async getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]> {
    return [];
  }

  async createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun> {
    return { ...run, id: randomUUID(), startedAt: new Date() } as AutopilotRun;
  }

  async updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined> {
    return { id, ...updates, startedAt: new Date() } as AutopilotRun;
  }

  // Lead Scoring Model stub methods
  async getLeadScoringModels(): Promise<LeadScoringModel[]> {
    return [];
  }

  async getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined> {
    return undefined;
  }

  async createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel> {
    return { id: randomUUID(), ...model, createdAt: new Date(), updatedAt: new Date() } as LeadScoringModel;
  }

  async updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel> {
    return { id, ...model, createdAt: new Date(), updatedAt: new Date() } as LeadScoringModel;
  }

  async deleteLeadScoringModel(id: string): Promise<void> {
    // Stub implementation
  }

  // Lead Score stub methods
  async getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]> {
    return [];
  }

  async getLeadScoreById(id: string): Promise<LeadScore | undefined> {
    return undefined;
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    return { id: randomUUID(), ...score, calculatedAt: new Date(), createdAt: new Date() } as LeadScore;
  }

  async updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore> {
    return { id, ...score, calculatedAt: new Date(), createdAt: new Date() } as LeadScore;
  }

  async deleteLeadScore(id: string): Promise<void> {
    // Stub implementation
  }

  // Workflow stub methods
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    return undefined;
  }

  async getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]> {
    return [];
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    return { 
      id: randomUUID(), 
      ...workflow, 
      nodes: workflow.nodes || [], 
      edges: workflow.edges || [],
      createdAt: new Date(), 
      updatedAt: new Date() 
    } as Workflow;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined> {
    return { id, ...updates, createdAt: new Date(), updatedAt: new Date() } as Workflow;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    return true;
  }

  // Workflow Execution stub methods
  async getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined> {
    return undefined;
  }

  async getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]> {
    return [];
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    return { 
      id: randomUUID(), 
      ...execution, 
      startedAt: new Date() 
    } as WorkflowExecution;
  }

  async updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined> {
    return { id, ...updates, startedAt: new Date() } as WorkflowExecution;
  }

  // Agent Type stub methods
  async getAgentType(id: string): Promise<AgentType | undefined> {
    return undefined;
  }

  async getAgentTypes(filters?: { category?: string }): Promise<AgentType[]> {
    return [];
  }

  async createAgentType(agentType: InsertAgentType): Promise<AgentType> {
    return { 
      id: randomUUID(), 
      ...agentType, 
      temperature: agentType.temperature || 0.7,
      maxTokens: agentType.maxTokens || 2000,
      createdAt: new Date() 
    } as AgentType;
  }

  async updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined> {
    return { id, ...updates, createdAt: new Date() } as AgentType;
  }

  // Workflow Template stub methods
  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    return undefined;
  }

  async getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]> {
    return [];
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    return { 
      id: randomUUID(), 
      ...template,
      usageCount: 0, 
      createdAt: new Date() 
    } as WorkflowTemplate;
  }

  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined> {
    return { id, ...updates, createdAt: new Date() } as WorkflowTemplate;
  }

  // Human Approval stub methods
  async getHumanApproval(id: string): Promise<HumanApproval | undefined> {
    return undefined;
  }

  async getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]> {
    return [];
  }

  async createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval> {
    return { 
      id: randomUUID(), 
      ...approval, 
      requestedAt: new Date() 
    } as HumanApproval;
  }

  async updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined> {
    return { id, ...updates, requestedAt: new Date() } as HumanApproval;
  }
}

export class DbStorage implements IStorage {
  // User methods - Required for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async getCompanies(limit = 50): Promise<Company[]> {
    return await db.select().from(companies).limit(limit);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.domain, domain));
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(insertCompany).returning();
    return result[0];
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getCompany(id);
    const result = await db.update(companies).set(cleaned).where(eq(companies.id, id)).returning();
    return result[0];
  }

  // Contact methods
  async getContact(id: string): Promise<Contact | undefined> {
    const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    return result[0];
  }

  async getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]> {
    let query = db.select().from(contacts);
    
    if (filters?.companyId) {
      query = query.where(eq(contacts.companyId, filters.companyId)) as any;
    }
    
    return await query.limit(filters?.limit || 50);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const result = await db.insert(contacts).values(insertContact).returning();
    return result[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getContact(id);
    const result = await db.update(contacts).set(cleaned).where(eq(contacts.id, id)).returning();
    return result[0];
  }

  // Visitor session methods
  async getVisitorSession(id: string): Promise<VisitorSession | undefined> {
    const result = await db.select().from(visitorSessions).where(eq(visitorSessions.id, id)).limit(1);
    return result[0];
  }

  async getActiveVisitorSessions(): Promise<VisitorSession[]> {
    return await db.select().from(visitorSessions).where(eq(visitorSessions.isActive, true));
  }

  async getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]> {
    return await db.select().from(visitorSessions).where(eq(visitorSessions.companyId, companyId));
  }

  async createVisitorSession(insertSession: InsertVisitorSession): Promise<VisitorSession> {
    const result = await db.insert(visitorSessions).values(insertSession).returning();
    return result[0];
  }

  async updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getVisitorSession(id);
    const result = await db.update(visitorSessions).set(cleaned).where(eq(visitorSessions.id, id)).returning();
    return result[0];
  }

  // Sequence methods
  async getSequence(id: string): Promise<Sequence | undefined> {
    const result = await db.select().from(sequences).where(eq(sequences.id, id)).limit(1);
    return result[0];
  }

  async getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]> {
    let query = db.select().from(sequences);
    const conditions = [];
    
    if (filters?.createdBy) {
      conditions.push(eq(sequences.createdBy, filters.createdBy));
    }
    
    if (filters?.status) {
      conditions.push(eq(sequences.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async createSequence(insertSequence: InsertSequence): Promise<Sequence> {
    const result = await db.insert(sequences).values(insertSequence).returning();
    return result[0];
  }

  async updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getSequence(id);
    const result = await db.update(sequences).set(cleaned).where(eq(sequences.id, id)).returning();
    return result[0];
  }

  // Email methods
  async getEmail(id: string): Promise<Email | undefined> {
    const result = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
    return result[0];
  }

  async getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]> {
    let query = db.select().from(emails);
    const conditions = [];
    
    if (filters?.contactId) {
      conditions.push(eq(emails.contactId, filters.contactId));
    }
    
    if (filters?.status) {
      conditions.push(eq(emails.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.limit(filters?.limit || 50);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const result = await db.insert(emails).values(insertEmail).returning();
    return result[0];
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getEmail(id);
    const result = await db.update(emails).set(cleaned).where(eq(emails.id, id)).returning();
    return result[0];
  }

  // Insight methods
  async getInsight(id: string): Promise<Insight | undefined> {
    const result = await db.select().from(insights).where(eq(insights.id, id)).limit(1);
    return result[0];
  }

  async getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]> {
    let query = db.select().from(insights);
    const conditions = [];
    
    if (filters?.companyId) {
      conditions.push(eq(insights.companyId, filters.companyId));
    }
    
    if (filters?.type) {
      conditions.push(eq(insights.type, filters.type));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.limit(filters?.limit || 20);
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const result = await db.insert(insights).values(insertInsight).returning();
    return result[0];
  }

  // Persona methods
  async getPersona(id: string): Promise<Persona | undefined> {
    const result = await db.select().from(personas).where(eq(personas.id, id)).limit(1);
    return result[0];
  }

  async getPersonas(createdBy?: string): Promise<Persona[]> {
    let query = db.select().from(personas);
    
    if (createdBy) {
      query = query.where(eq(personas.createdBy, createdBy)) as any;
    }
    
    return await query;
  }

  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const result = await db.insert(personas).values(insertPersona).returning();
    return result[0];
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPersona(id);
    const result = await db.update(personas).set(cleaned).where(eq(personas.id, id)).returning();
    return result[0];
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]> {
    let query = db.select().from(tasks);
    const conditions = [];
    
    if (filters?.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(insertTask).returning();
    return result[0];
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getTask(id);
    const result = await db.update(tasks).set(cleaned).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  // Phone Call methods
  async getPhoneCall(id: string): Promise<PhoneCall | undefined> {
    const result = await db.select().from(phoneCalls).where(eq(phoneCalls.id, id)).limit(1);
    return result[0];
  }

  async getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]> {
    let query = db.select().from(phoneCalls);
    
    const conditions: any[] = [];
    if (filters?.contactId) conditions.push(eq(phoneCalls.contactId, filters.contactId));
    if (filters?.userId) conditions.push(eq(phoneCalls.userId, filters.userId));
    if (filters?.status) conditions.push(eq(phoneCalls.status, filters.status));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall> {
    const result = await db.insert(phoneCalls).values(call).returning();
    return result[0];
  }

  async updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPhoneCall(id);
    const result = await db.update(phoneCalls).set(cleaned).where(eq(phoneCalls.id, id)).returning();
    return result[0];
  }

  // Call Script methods
  async getCallScript(id: string): Promise<CallScript | undefined> {
    const result = await db.select().from(callScripts).where(eq(callScripts.id, id)).limit(1);
    return result[0];
  }

  async getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]> {
    let query = db.select().from(callScripts);
    
    const conditions: any[] = [];
    if (filters?.type) conditions.push(eq(callScripts.type, filters.type));
    if (filters?.personaId) conditions.push(eq(callScripts.personaId, filters.personaId));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createCallScript(script: InsertCallScript): Promise<CallScript> {
    const result = await db.insert(callScripts).values(script).returning();
    return result[0];
  }

  async updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getCallScript(id);
    const result = await db.update(callScripts).set(cleaned).where(eq(callScripts.id, id)).returning();
    return result[0];
  }

  // Voicemail methods
  async getVoicemail(id: string): Promise<Voicemail | undefined> {
    const result = await db.select().from(voicemails).where(eq(voicemails.id, id)).limit(1);
    return result[0];
  }

  async getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]> {
    let query = db.select().from(voicemails);
    
    const conditions: any[] = [];
    if (filters?.contactId) conditions.push(eq(voicemails.contactId, filters.contactId));
    if (filters?.isListened !== undefined) conditions.push(eq(voicemails.isListened, filters.isListened));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail> {
    const result = await db.insert(voicemails).values(voicemail).returning();
    return result[0];
  }

  async updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getVoicemail(id);
    const result = await db.update(voicemails).set(cleaned).where(eq(voicemails.id, id)).returning();
    return result[0];
  }

  // AI Agent methods
  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    const result = await db.select().from(aiAgents).where(eq(aiAgents.id, id)).limit(1);
    return result[0];
  }

  async getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]> {
    let query = db.select().from(aiAgents);
    
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(aiAgents.status, filters.status));
    if (filters?.type) conditions.push(eq(aiAgents.type, filters.type));
    if (filters?.createdBy) conditions.push(eq(aiAgents.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const result = await db.insert(aiAgents).values(agent).returning();
    return result[0];
  }

  async updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAiAgent(id);
    const result = await db.update(aiAgents).set(cleaned).where(eq(aiAgents.id, id)).returning();
    return result[0];
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    const result = await db.delete(aiAgents).where(eq(aiAgents.id, id)).returning();
    return result.length > 0;
  }

  // Onboarding methods
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined> {
    const result = await db.select().from(onboardingProfiles).where(eq(onboardingProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile> {
    const result = await db.insert(onboardingProfiles).values(profile).returning();
    return result[0];
  }

  async updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getOnboardingProfile(userId);
    const result = await db.update(onboardingProfiles).set(cleaned).where(eq(onboardingProfiles.userId, userId)).returning();
    return result[0];
  }
  
  // Platform Config methods
  async getPlatformConfig(userId: string): Promise<PlatformConfig | undefined> {
    const result = await db.select().from(platformConfigs).where(eq(platformConfigs.userId, userId)).limit(1);
    return result[0];
  }

  async createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig> {
    const result = await db.insert(platformConfigs).values(config).returning();
    return result[0];
  }

  async updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPlatformConfig(userId);
    const result = await db.update(platformConfigs).set(cleaned).where(eq(platformConfigs.userId, userId)).returning();
    return result[0];
  }
  
  // Workflow Trigger methods
  async getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined> {
    const result = await db.select().from(workflowTriggers).where(eq(workflowTriggers.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]> {
    let query = db.select().from(workflowTriggers);
    
    const conditions: any[] = [];
    if (filters?.isActive !== undefined) conditions.push(eq(workflowTriggers.isActive, filters.isActive));
    if (filters?.triggerType) conditions.push(eq(workflowTriggers.triggerType, filters.triggerType));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger> {
    const result = await db.insert(workflowTriggers).values(trigger).returning();
    return result[0];
  }

  async updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowTrigger(id);
    const result = await db.update(workflowTriggers).set(cleaned).where(eq(workflowTriggers.id, id)).returning();
    return result[0];
  }

  async deleteWorkflowTrigger(id: string): Promise<boolean> {
    const result = await db.delete(workflowTriggers).where(eq(workflowTriggers.id, id)).returning();
    return result.length > 0;
  }
  
  // Playbook methods  
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    const result = await db.select().from(playbooks).where(eq(playbooks.id, id)).limit(1);
    return result[0];
  }

  async getPlaybooks(filters?: { industry?: string; isTemplate?: boolean }): Promise<Playbook[]> {
    let query = db.select().from(playbooks);
    
    const conditions: any[] = [];
    if (filters?.industry) conditions.push(eq(playbooks.industry, filters.industry));
    if (filters?.isTemplate !== undefined) conditions.push(eq(playbooks.isTemplate, filters.isTemplate));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    const result = await db.insert(playbooks).values(playbook).returning();
    return result[0];
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPlaybook(id);
    const result = await db.update(playbooks).set(cleaned).where(eq(playbooks.id, id)).returning();
    return result[0];
  }

  // Autopilot Campaign methods
  async getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined> {
    const result = await db.select().from(autopilotCampaigns).where(eq(autopilotCampaigns.id, id)).limit(1);
    return result[0];
  }

  async getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]> {
    let query = db.select().from(autopilotCampaigns);
    
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(autopilotCampaigns.status, filters.status));
    if (filters?.createdBy) conditions.push(eq(autopilotCampaigns.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign> {
    const result = await db.insert(autopilotCampaigns).values(campaign).returning();
    return result[0];
  }

  async updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAutopilotCampaign(id);
    const result = await db.update(autopilotCampaigns).set(cleaned).where(eq(autopilotCampaigns.id, id)).returning();
    return result[0];
  }

  // Autopilot Run methods
  async getAutopilotRun(id: string): Promise<AutopilotRun | undefined> {
    const result = await db.select().from(autopilotRuns).where(eq(autopilotRuns.id, id)).limit(1);
    return result[0];
  }

  async getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]> {
    return await db.select().from(autopilotRuns)
      .where(eq(autopilotRuns.campaignId, campaignId))
      .orderBy(autopilotRuns.startedAt);
  }

  async createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun> {
    const result = await db.insert(autopilotRuns).values(run).returning();
    return result[0];
  }

  async updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAutopilotRun(id);
    const result = await db.update(autopilotRuns).set(cleaned).where(eq(autopilotRuns.id, id)).returning();
    return result[0];
  }

  // Lead Scoring Model methods
  async getLeadScoringModels(): Promise<LeadScoringModel[]> {
    return await db.select().from(leadScoringModels);
  }

  async getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined> {
    const result = await db.select().from(leadScoringModels).where(eq(leadScoringModels.id, id)).limit(1);
    return result[0];
  }

  async createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel> {
    const result = await db.insert(leadScoringModels).values(model).returning();
    return result[0];
  }

  async updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel> {
    const cleaned = cleanPartial(model);
    if (Object.keys(cleaned).length === 0) {
      const existing = await this.getLeadScoringModelById(id);
      if (!existing) throw new Error('Lead scoring model not found');
      return existing;
    }
    const result = await db.update(leadScoringModels).set(cleaned).where(eq(leadScoringModels.id, id)).returning();
    if (!result[0]) throw new Error('Lead scoring model not found');
    return result[0];
  }

  async deleteLeadScoringModel(id: string): Promise<void> {
    await db.delete(leadScoringModels).where(eq(leadScoringModels.id, id));
  }

  // Lead Score methods
  async getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]> {
    let query = db.select().from(leadScores);
    const conditions = [];
    if (contactId) conditions.push(eq(leadScores.contactId, contactId));
    if (modelId) conditions.push(eq(leadScores.modelId, modelId));
    
    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getLeadScoreById(id: string): Promise<LeadScore | undefined> {
    const result = await db.select().from(leadScores).where(eq(leadScores.id, id)).limit(1);
    return result[0];
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    const result = await db.insert(leadScores).values(score).returning();
    return result[0];
  }

  async updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore> {
    const cleaned = cleanPartial(score);
    if (Object.keys(cleaned).length === 0) {
      const existing = await this.getLeadScoreById(id);
      if (!existing) throw new Error('Lead score not found');
      return existing;
    }
    const result = await db.update(leadScores).set(cleaned).where(eq(leadScores.id, id)).returning();
    if (!result[0]) throw new Error('Lead score not found');
    return result[0];
  }

  async deleteLeadScore(id: string): Promise<void> {
    await db.delete(leadScores).where(eq(leadScores.id, id));
  }

  // Workflow methods
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const result = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    return result[0];
  }

  async getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]> {
    let query = db.select().from(workflows);
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(workflows.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(workflows.category, filters.category));
    }
    if (filters?.isTemplate !== undefined) {
      conditions.push(eq(workflows.isTemplate, filters.isTemplate));
    }
    if (filters?.createdBy) {
      conditions.push(eq(workflows.createdBy, filters.createdBy));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const result = await db.insert(workflows).values(workflow).returning();
    return result[0];
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflow(id);
    const result = await db.update(workflows).set({
      ...cleaned,
      updatedAt: new Date()
    }).where(eq(workflows.id, id)).returning();
    return result[0];
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const result = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    return result.length > 0;
  }

  // Workflow Execution methods
  async getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined> {
    const result = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]> {
    let query = db.select().from(workflowExecutions);
    const conditions: any[] = [];

    if (filters?.workflowId) {
      conditions.push(eq(workflowExecutions.workflowId, filters.workflowId));
    }
    if (filters?.status) {
      conditions.push(eq(workflowExecutions.status, filters.status));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const result = await db.insert(workflowExecutions).values(execution).returning();
    return result[0];
  }

  async updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowExecution(id);
    const result = await db.update(workflowExecutions).set(cleaned).where(eq(workflowExecutions.id, id)).returning();
    return result[0];
  }

  // Agent Type methods
  async getAgentType(id: string): Promise<AgentType | undefined> {
    const result = await db.select().from(agentTypes).where(eq(agentTypes.id, id)).limit(1);
    return result[0];
  }

  async getAgentTypes(filters?: { category?: string }): Promise<AgentType[]> {
    if (filters?.category) {
      return await db.select().from(agentTypes).where(eq(agentTypes.category, filters.category));
    }
    return await db.select().from(agentTypes);
  }

  async createAgentType(agentType: InsertAgentType): Promise<AgentType> {
    const result = await db.insert(agentTypes).values(agentType).returning();
    return result[0];
  }

  async updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAgentType(id);
    const result = await db.update(agentTypes).set(cleaned).where(eq(agentTypes.id, id)).returning();
    return result[0];
  }

  // Workflow Template methods
  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    const result = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]> {
    let query = db.select().from(workflowTemplates);
    const conditions: any[] = [];

    if (filters?.category) {
      conditions.push(eq(workflowTemplates.category, filters.category));
    }
    if (filters?.difficulty) {
      conditions.push(eq(workflowTemplates.difficulty, filters.difficulty));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    const result = await db.insert(workflowTemplates).values(template).returning();
    return result[0];
  }

  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowTemplate(id);
    const result = await db.update(workflowTemplates).set(cleaned).where(eq(workflowTemplates.id, id)).returning();
    return result[0];
  }

  // Human Approval methods
  async getHumanApproval(id: string): Promise<HumanApproval | undefined> {
    const result = await db.select().from(humanApprovals).where(eq(humanApprovals.id, id)).limit(1);
    return result[0];
  }

  async getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]> {
    let query = db.select().from(humanApprovals);
    const conditions: any[] = [];

    if (filters?.executionId) {
      conditions.push(eq(humanApprovals.executionId, filters.executionId));
    }
    if (filters?.status) {
      conditions.push(eq(humanApprovals.status, filters.status));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval> {
    const result = await db.insert(humanApprovals).values(approval).returning();
    return result[0];
  }

  async updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getHumanApproval(id);
    const result = await db.update(humanApprovals).set(cleaned).where(eq(humanApprovals.id, id)).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
