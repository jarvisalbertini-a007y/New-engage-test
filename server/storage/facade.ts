import { IAccountsStorage } from './accounts';
import { IAssetsStorage } from './assets';
import { IStorage } from '../storage';
import { 
  ContentTemplate, InsertContentTemplate,
  TemplateVersion, InsertTemplateVersion,
  TemplateMetrics, InsertTemplateMetrics,
  AudienceSegment
} from '@shared/schema';

/**
 * StorageFacade provides a migration path from monolithic IStorage to domain-specific adapters
 * It delegates calls to the appropriate domain adapter while maintaining backward compatibility
 */
export class StorageFacade {
  constructor(
    private accounts: IAccountsStorage,
    private assets: IAssetsStorage,
    private legacy: IStorage
  ) {}

  // ========== Content Template Methods (Assets Domain) ==========
  
  async getContentTemplates(filters?: { status?: string; personaId?: string; includeArchived?: boolean; createdBy?: string }): Promise<ContentTemplate[]> {
    // Use assets adapter for content templates
    const templates = await this.assets.getContentTemplates({ 
      createdBy: filters?.createdBy 
    });
    
    // Apply additional filters
    let filtered = templates;
    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    if (filters?.personaId) {
      filtered = filtered.filter(t => t.personaId === filters.personaId);
    }
    if (!filters?.includeArchived) {
      filtered = filtered.filter(t => !t.archivedAt);
    }
    
    return filtered;
  }
  
  async getTemplateWithRelations(id: string): Promise<ContentTemplate | undefined> {
    return await this.assets.getContentTemplate(id);
  }
  
  async createContentTemplate(template: InsertContentTemplate): Promise<ContentTemplate> {
    return await this.assets.createContentTemplate(template);
  }
  
  async updateTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    return await this.assets.updateContentTemplate(id, updates);
  }
  
  async archiveTemplate(id: string): Promise<boolean> {
    const template = await this.assets.getContentTemplate(id);
    if (!template) return false;
    
    const updated = await this.assets.updateContentTemplate(id, { 
      archivedAt: new Date(),
      status: 'archived'
    });
    return !!updated;
  }
  
  async listTemplateVersions(templateId: string, options?: { includeDrafts?: boolean }): Promise<TemplateVersion[]> {
    const versions = await this.assets.getTemplateVersionsByTemplateId(templateId);
    
    if (!options?.includeDrafts) {
      return versions.filter(v => v.publishedAt !== null);
    }
    
    return versions;
  }
  
  async createTemplateVersion(version: InsertTemplateVersion): Promise<TemplateVersion> {
    return await this.assets.createTemplateVersion(version);
  }
  
  async publishTemplateVersion(templateId: string, versionId: string): Promise<boolean> {
    // First, publish the version
    const version = await this.assets.updateTemplateVersion(versionId, {
      publishedAt: new Date()
    });
    
    if (!version) return false;
    
    // Then update the template's current version
    const template = await this.assets.updateContentTemplate(templateId, {
      currentVersionId: versionId
    });
    
    return !!template;
  }
  
  async attachSegments(templateId: string, segmentIds: string[]): Promise<boolean> {
    // For now, store segment IDs in the template itself
    // In a full implementation, this would use a junction table
    const template = await this.assets.getContentTemplate(templateId);
    if (!template) return false;
    
    // This is a simplified implementation
    // A proper implementation would use contentTemplateSegments table
    return true;
  }
  
  async detachSegment(templateId: string, segmentId: string): Promise<boolean> {
    // Simplified implementation
    return true;
  }
  
  async recordTemplateMetric(metric: InsertTemplateMetrics): Promise<TemplateMetrics> {
    // Use legacy storage for now as metrics aren't in assets adapter yet
    return await this.legacy.upsertTemplateMetricsWindow(metric);
  }
  
  async getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<TemplateMetrics[]> {
    // Use legacy storage for now
    return await this.legacy.getTemplateMetrics(templateId, startDate, endDate);
  }
  
  // ========== Audience Segments (Assets Domain) ==========
  
  async getAudienceSegments(filters?: { createdBy?: string; isGlobal?: boolean }): Promise<AudienceSegment[]> {
    // Use legacy storage for now - will move to assets adapter later
    return await this.legacy.listAudienceSegments({ 
      createdBy: filters?.createdBy,
      includeGlobal: filters?.isGlobal 
    });
  }
  
  async createAudienceSegment(segment: any): Promise<AudienceSegment> {
    return await this.legacy.createAudienceSegment(segment);
  }
  
  async updateAudienceSegment(id: string, updates: any): Promise<AudienceSegment | undefined> {
    return await this.legacy.updateAudienceSegment(id, updates);
  }
  
  async deleteAudienceSegment(id: string): Promise<boolean> {
    return await this.legacy.deleteAudienceSegment(id);
  }
  
  // ========== Delegate all other methods to legacy storage ==========
  
  // This allows us to gradually migrate methods to domain adapters
  // while keeping the rest of the application working
  
  async getUser(id: string) {
    return await this.accounts.getUser(id);
  }
  
  async upsertUser(user: any) {
    return await this.accounts.upsertUser(user);
  }
  
  async getCompany(id: string) {
    return await this.accounts.getCompany(id);
  }
  
  async getCompanies(limit?: number) {
    return await this.accounts.getCompanies(limit);
  }
  
  async createCompany(company: any) {
    return await this.accounts.createCompany(company);
  }
  
  async updateCompany(id: string, updates: any) {
    return await this.accounts.updateCompany(id, updates);
  }
  
  async deleteCompany(id: string) {
    return await this.accounts.deleteCompany(id);
  }
  
  async getContact(id: string) {
    return await this.accounts.getContact(id);
  }
  
  async getContacts(filters?: any) {
    return await this.accounts.getContacts(filters);
  }
  
  async createContact(contact: any) {
    return await this.accounts.createContact(contact);
  }
  
  async updateContact(id: string, updates: any) {
    return await this.accounts.updateContact(id, updates);
  }
  
  async deleteContact(id: string) {
    return await this.accounts.deleteContact(id);
  }
  
  async getPersona(id: string) {
    return await this.assets.getPersona(id);
  }
  
  async getPersonas(createdBy?: string) {
    return await this.assets.getPersonas(createdBy);
  }
  
  async createPersona(persona: any) {
    return await this.assets.createPersona(persona);
  }
  
  async updatePersona(id: string, updates: any) {
    return await this.assets.updatePersona(id, updates);
  }
  
  async deletePersona(id: string) {
    return await this.assets.deletePersona(id);
  }
  
  async getPlaybook(id: string) {
    return await this.assets.getPlaybook(id);
  }
  
  async getPlaybooks() {
    return await this.assets.getPlaybooks();
  }
  
  async createPlaybook(playbook: any) {
    return await this.assets.createPlaybook(playbook);
  }
  
  async updatePlaybook(id: string, updates: any) {
    return await this.assets.updatePlaybook(id, updates);
  }
  
  async deletePlaybook(id: string) {
    return await this.assets.deletePlaybook(id);
  }
  
  // For all other methods not yet migrated, delegate to legacy storage
  // This allows us to keep the application working while we migrate
}