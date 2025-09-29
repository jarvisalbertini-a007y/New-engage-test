import { 
  type User, type InsertUser,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type VisitorSession, type InsertVisitorSession,
  type Sequence, type InsertSequence,
  type Email, type InsertEmail,
  type Insight, type InsertInsight,
  type Persona, type InsertPersona,
  type Task, type InsertTask
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, createdAt: new Date(), role: insertUser.role || "Sales Rep" };
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
}

export const storage = new MemStorage();
