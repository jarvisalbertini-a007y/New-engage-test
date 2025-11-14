import { IStorage } from '../storage';
import type { 
  ContentTemplate, 
  InsertContentTemplate,
  TemplateVersion, 
  InsertTemplateVersion,
  AudienceSegment,
  TemplateMetrics
} from '@shared/schema';

// Type definitions for better type safety
type TemplateChannel = 'email' | 'linkedin' | 'phone' | 'sms';
type MetricEventType = 'send' | 'delivery' | 'open' | 'click' | 'reply' | 'meeting' | 'bounce' | 'unsubscribe';
type ContentTemplateStatus = 'draft' | 'active' | 'archived';

/**
 * Typed facade for Content Studio operations
 * This provides type safety and clear method definitions for Content Studio features
 * All methods delegate to legacy storage with proper error handling
 */
export class ContentStudioStorage {
  constructor(private legacy: IStorage) {}

  // Methods with names matching the routes
  async listTemplates(filters?: { 
    status?: ContentTemplateStatus; 
    personaId?: string; 
    includeArchived?: boolean 
  }): Promise<ContentTemplate[]> {
    // Validate status if provided
    if (filters?.status && !['draft', 'active', 'archived'].includes(filters.status)) {
      throw new Error(`Invalid template status: ${filters.status}`);
    }
    // Delegate to legacy storage's listTemplates method
    return this.legacy.listTemplates({
      status: filters?.status,
      personaId: filters?.personaId,
      includeArchived: filters?.includeArchived
    });
  }
  
  async getTemplateWithRelations(id: string): Promise<{
    template: ContentTemplate;
    versions: TemplateVersion[];
    segments: AudienceSegment[];
    metrics?: TemplateMetrics[];
  } | undefined> {
    // Delegate directly to legacy storage
    return this.legacy.getTemplateWithRelations(id);
  }
  
  async createTemplate(template: InsertContentTemplate & { segmentIds?: string[] }): Promise<ContentTemplate> {
    // Delegate to legacy storage's createTemplate method
    return this.legacy.createTemplate(template);
  }
  
  async updateTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    // Delegate directly to legacy storage
    return this.legacy.updateTemplate(id, updates);
  }
  
  async archiveTemplate(id: string): Promise<boolean> {
    // Delegate directly to legacy storage
    return this.legacy.archiveTemplate(id);
  }
  
  async listTemplateVersions(templateId: string, options?: { includeDrafts?: boolean }): Promise<TemplateVersion[]> {
    // Delegate directly to legacy storage
    return this.legacy.listTemplateVersions(templateId, options);
  }
  
  async createTemplateVersion(version: InsertTemplateVersion & { segmentSnapshotIds?: string[] }): Promise<TemplateVersion> {
    // Delegate directly to legacy storage
    return this.legacy.createTemplateVersion(version);
  }
  
  async publishTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion | undefined> {
    // Delegate directly to legacy storage and return the full version object
    return this.legacy.publishTemplateVersion(templateId, versionId);
  }
  
  async attachSegments(templateId: string, segmentIds: string[]): Promise<void> {
    // Delegate to legacy storage
    await this.legacy.attachSegments(templateId, segmentIds);
  }
  
  async detachSegment(templateId: string, segmentId: string): Promise<boolean> {
    // Delegate directly to legacy storage
    return this.legacy.detachSegment(templateId, segmentId);
  }
  
  // Record template metric events with type validation
  async recordTemplateMetricEvent(metric: {
    templateVersionId: string;
    channel: TemplateChannel;
    eventType: MetricEventType;
    value?: number;
    occurredAt?: Date;
  }): Promise<void> {
    // Delegate to legacy storage's recordTemplateMetricEvent
    // Legacy storage accepts strings, so we pass through after type validation
    return this.legacy.recordTemplateMetricEvent({
      templateVersionId: metric.templateVersionId,
      channel: metric.channel as string,
      eventType: metric.eventType as string,
      value: metric.value,
      occurredAt: metric.occurredAt
    });
  }
  
  async getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<TemplateMetrics[]> {
    // Delegate directly to legacy storage
    return this.legacy.getTemplateMetrics(templateId, startDate, endDate);
  }
  
  async getAudienceSegments(filters?: { createdBy?: string; isGlobal?: boolean }): Promise<AudienceSegment[]> {
    // Delegate to legacy storage's listAudienceSegments
    return this.legacy.listAudienceSegments({
      createdBy: filters?.createdBy,
      includeGlobal: filters?.isGlobal
    });
  }
  
  async listAudienceSegments(filters?: { createdBy?: string; q?: string; includeGlobal?: boolean }): Promise<AudienceSegment[]> {
    // Direct delegation to legacy storage with same method name
    return this.legacy.listAudienceSegments(filters);
  }
}