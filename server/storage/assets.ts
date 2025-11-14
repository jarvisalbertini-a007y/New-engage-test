import { randomUUID } from 'node:crypto';
import { 
  ContentTemplate, InsertContentTemplate,
  TemplateVersion, InsertTemplateVersion,
  Playbook, InsertPlaybook,
  Persona, InsertPersona
} from '@shared/schema';
import { db } from '../db';
import { contentTemplates, templateVersions, playbooks, personas } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Assets domain storage adapter
 * Manages content templates, template versions, playbooks, and personas
 */
export interface IAssetsStorage {
  // Content Templates
  getContentTemplate(id: string): Promise<ContentTemplate | undefined>;
  getContentTemplates(filters?: { createdBy?: string; contentType?: string }): Promise<ContentTemplate[]>;
  createContentTemplate(template: InsertContentTemplate): Promise<ContentTemplate>;
  updateContentTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined>;
  deleteContentTemplate(id: string): Promise<boolean>;

  // Template Versions
  getTemplateVersion(id: string): Promise<TemplateVersion | undefined>;
  getTemplateVersionsByTemplateId(templateId: string): Promise<TemplateVersion[]>;
  createTemplateVersion(version: InsertTemplateVersion): Promise<TemplateVersion>;
  updateTemplateVersion(id: string, updates: Partial<TemplateVersion>): Promise<TemplateVersion | undefined>;

  // Playbooks
  getPlaybook(id: string): Promise<Playbook | undefined>;
  getPlaybooks(): Promise<Playbook[]>;
  createPlaybook(playbook: InsertPlaybook): Promise<Playbook>;
  updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined>;
  deletePlaybook(id: string): Promise<boolean>;

  // Personas
  getPersona(id: string): Promise<Persona | undefined>;
  getPersonas(createdBy?: string): Promise<Persona[]>;
  createPersona(persona: InsertPersona): Promise<Persona>;
  updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined>;
  deletePersona(id: string): Promise<boolean>;
}

/**
 * Memory implementation of Assets storage
 */
export class MemAssetsStorage implements IAssetsStorage {
  private contentTemplates = new Map<string, ContentTemplate>();
  private templateVersions = new Map<string, TemplateVersion>();
  private playbooks = new Map<string, Playbook>();
  private personas = new Map<string, Persona>();

  async getContentTemplate(id: string): Promise<ContentTemplate | undefined> {
    return this.contentTemplates.get(id);
  }

  async getContentTemplates(filters?: { createdBy?: string; contentType?: string }): Promise<ContentTemplate[]> {
    let templates = Array.from(this.contentTemplates.values());
    if (filters?.createdBy) {
      templates = templates.filter(t => t.createdBy === filters.createdBy);
    }
    if (filters?.contentType) {
      templates = templates.filter(t => t.contentType === filters.contentType);
    }
    return templates;
  }

  async createContentTemplate(template: InsertContentTemplate): Promise<ContentTemplate> {
    const id = randomUUID();
    const newTemplate = { 
      ...template, 
      id, 
      currentVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    } as ContentTemplate;
    this.contentTemplates.set(id, newTemplate);
    return newTemplate;
  }

  async updateContentTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    const template = this.contentTemplates.get(id);
    if (!template) return undefined;
    const updated = { ...template, ...updates, updatedAt: new Date() };
    this.contentTemplates.set(id, updated);
    return updated;
  }

  async deleteContentTemplate(id: string): Promise<boolean> {
    return this.contentTemplates.delete(id);
  }

  async getTemplateVersion(id: string): Promise<TemplateVersion | undefined> {
    return this.templateVersions.get(id);
  }

  async getTemplateVersionsByTemplateId(templateId: string): Promise<TemplateVersion[]> {
    return Array.from(this.templateVersions.values()).filter(v => v.templateId === templateId);
  }

  async createTemplateVersion(version: InsertTemplateVersion): Promise<TemplateVersion> {
    const id = randomUUID();
    const newVersion = { 
      ...version, 
      id, 
      createdAt: new Date(),
      publishedAt: null
    } as TemplateVersion;
    this.templateVersions.set(id, newVersion);
    return newVersion;
  }

  async updateTemplateVersion(id: string, updates: Partial<TemplateVersion>): Promise<TemplateVersion | undefined> {
    const version = this.templateVersions.get(id);
    if (!version) return undefined;
    const updated = { ...version, ...updates };
    this.templateVersions.set(id, updated);
    return updated;
  }

  async getPlaybook(id: string): Promise<Playbook | undefined> {
    return this.playbooks.get(id);
  }

  async getPlaybooks(): Promise<Playbook[]> {
    return Array.from(this.playbooks.values());
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    const id = randomUUID();
    const newPlaybook = { ...playbook, id, createdAt: new Date() } as Playbook;
    this.playbooks.set(id, newPlaybook);
    return newPlaybook;
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    const playbook = this.playbooks.get(id);
    if (!playbook) return undefined;
    const updated = { ...playbook, ...updates };
    this.playbooks.set(id, updated);
    return updated;
  }

  async deletePlaybook(id: string): Promise<boolean> {
    return this.playbooks.delete(id);
  }

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

  async createPersona(persona: InsertPersona): Promise<Persona> {
    const id = randomUUID();
    const newPersona = { ...persona, id, createdAt: new Date() } as Persona;
    this.personas.set(id, newPersona);
    return newPersona;
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const persona = this.personas.get(id);
    if (!persona) return undefined;
    const updated = { ...persona, ...updates };
    this.personas.set(id, updated);
    return updated;
  }

  async deletePersona(id: string): Promise<boolean> {
    return this.personas.delete(id);
  }
}

/**
 * Database implementation of Assets storage
 */
export class DbAssetsStorage implements IAssetsStorage {
  async getContentTemplate(id: string): Promise<ContentTemplate | undefined> {
    const result = await db.select().from(contentTemplates).where(eq(contentTemplates.id, id));
    return result[0];
  }

  async getContentTemplates(filters?: { createdBy?: string; contentType?: string }): Promise<ContentTemplate[]> {
    const conditions = [];
    if (filters?.createdBy) {
      conditions.push(eq(contentTemplates.createdBy, filters.createdBy));
    }
    if (filters?.contentType) {
      conditions.push(eq(contentTemplates.contentType, filters.contentType));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(contentTemplates).where(and(...conditions));
    }
    return await db.select().from(contentTemplates);
  }

  async createContentTemplate(template: InsertContentTemplate): Promise<ContentTemplate> {
    const result = await db.insert(contentTemplates).values(template).returning();
    return result[0];
  }

  async updateContentTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    const result = await db.update(contentTemplates)
      .set(updates)
      .where(eq(contentTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteContentTemplate(id: string): Promise<boolean> {
    const result = await db.delete(contentTemplates).where(eq(contentTemplates.id, id)).returning();
    return result.length > 0;
  }

  async getTemplateVersion(id: string): Promise<TemplateVersion | undefined> {
    const result = await db.select().from(templateVersions).where(eq(templateVersions.id, id));
    return result[0];
  }

  async getTemplateVersionsByTemplateId(templateId: string): Promise<TemplateVersion[]> {
    return await db.select().from(templateVersions).where(eq(templateVersions.templateId, templateId));
  }

  async createTemplateVersion(version: InsertTemplateVersion): Promise<TemplateVersion> {
    const result = await db.insert(templateVersions).values(version).returning();
    return result[0];
  }

  async updateTemplateVersion(id: string, updates: Partial<TemplateVersion>): Promise<TemplateVersion | undefined> {
    const result = await db.update(templateVersions)
      .set(updates)
      .where(eq(templateVersions.id, id))
      .returning();
    return result[0];
  }

  async getPlaybook(id: string): Promise<Playbook | undefined> {
    const result = await db.select().from(playbooks).where(eq(playbooks.id, id));
    return result[0];
  }

  async getPlaybooks(): Promise<Playbook[]> {
    return await db.select().from(playbooks);
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    const result = await db.insert(playbooks).values(playbook as any).returning();
    return result[0];
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    const result = await db.update(playbooks)
      .set(updates)
      .where(eq(playbooks.id, id))
      .returning();
    return result[0];
  }

  async deletePlaybook(id: string): Promise<boolean> {
    const result = await db.delete(playbooks).where(eq(playbooks.id, id)).returning();
    return result.length > 0;
  }

  async getPersona(id: string): Promise<Persona | undefined> {
    const result = await db.select().from(personas).where(eq(personas.id, id));
    return result[0];
  }

  async getPersonas(createdBy?: string): Promise<Persona[]> {
    if (createdBy) {
      return await db.select().from(personas).where(eq(personas.createdBy, createdBy));
    }
    return await db.select().from(personas);
  }

  async createPersona(persona: InsertPersona): Promise<Persona> {
    const result = await db.insert(personas).values(persona).returning();
    return result[0];
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const result = await db.update(personas)
      .set(updates)
      .where(eq(personas.id, id))
      .returning();
    return result[0];
  }

  async deletePersona(id: string): Promise<boolean> {
    const result = await db.delete(personas).where(eq(personas.id, id)).returning();
    return result.length > 0;
  }
}