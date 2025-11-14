import { randomUUID } from 'node:crypto';
import { 
  User, InsertUser, UpsertUser,
  Company, InsertCompany,
  Contact, InsertContact
} from '@shared/schema';

/**
 * Accounts domain storage adapter
 * Manages users, companies, and contacts
 */
export interface IAccountsStorage {
  // Users - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanies(limit?: number): Promise<Company[]>;
  getCompaniesByDomain(domain: string): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // Contacts
  getContact(id: string): Promise<Contact | undefined>;
  getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
}

/**
 * Memory implementation of Accounts storage
 */
export class MemAccountsStorage implements IAccountsStorage {
  private users = new Map<string, User>();
  private companies = new Map<string, Company>();
  private contacts = new Map<string, Contact>();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const id = user.id || randomUUID();
    const existing = this.users.get(id);
    const userData = existing ? { ...existing, ...user, id } : { ...user, id } as User;
    this.users.set(id, userData);
    return userData;
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanies(limit: number = 100): Promise<Company[]> {
    const allCompanies = Array.from(this.companies.values());
    return allCompanies.slice(0, limit);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(c => c.domain === domain);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const newCompany = { ...company, id } as Company;
    this.companies.set(id, newCompany);
    return newCompany;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...updates };
    this.companies.set(id, updated);
    return updated;
  }

  async deleteCompany(id: string): Promise<boolean> {
    return this.companies.delete(id);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());
    if (filters?.companyId) {
      contacts = contacts.filter(c => c.companyId === filters.companyId);
    }
    if (filters?.limit) {
      contacts = contacts.slice(0, filters.limit);
    }
    return contacts;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const newContact = { ...contact, id } as Contact;
    this.contacts.set(id, newContact);
    return newContact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updated = { ...contact, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }
}

/**
 * Database implementation of Accounts storage
 */
import { db } from '../db';
import { users, companies, contacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class DbAccountsStorage implements IAccountsStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const result = await db.insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: user,
      })
      .returning();
    return result[0];
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanies(limit: number = 100): Promise<Company[]> {
    return await db.select().from(companies).limit(limit);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.domain, domain));
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const result = await db.update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const result = await db.select().from(contacts).where(eq(contacts.id, id));
    return result[0];
  }

  async getContacts(filters?: { companyId?: string; limit?: number }): Promise<Contact[]> {
    let query = db.select().from(contacts);
    if (filters?.companyId) {
      query = query.where(eq(contacts.companyId, filters.companyId)) as any;
    }
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    return await query;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const result = await db.insert(contacts).values(contact).returning();
    return result[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const result = await db.update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id)).returning();
    return result.length > 0;
  }
}