import { IStorage } from '../storage';

/**
 * SimpleFacade provides a thin wrapper around legacy storage
 * to handle the Content Studio methods that don't exist in IStorage
 * while preserving all existing data and functionality
 */
export class SimpleFacade {
  constructor(private legacy: IStorage) {}

  // ========== Content Template Methods (for Content Studio) ==========
  // Map Content Studio route calls to actual legacy storage methods
  
  async getContentTemplates(filters?: any): Promise<any[]> {
    // Map to legacy storage's listTemplates method
    if ('listTemplates' in this.legacy) {
      return (this.legacy as any).listTemplates({
        status: filters?.status,
        personaId: filters?.personaId,
        includeArchived: filters?.includeArchived
      });
    }
    throw new Error('listTemplates method not available in storage');
  }
  
  async getTemplateWithRelations(id: string): Promise<any> {
    // This method exists in legacy storage with the same name
    if ('getTemplateWithRelations' in this.legacy) {
      return (this.legacy as any).getTemplateWithRelations(id);
    }
    throw new Error('getTemplateWithRelations method not available in storage');
  }
  
  async createContentTemplate(template: any): Promise<any> {
    // Map to legacy storage's createTemplate method
    if ('createTemplate' in this.legacy) {
      return (this.legacy as any).createTemplate(template);
    }
    throw new Error('createTemplate method not available in storage');
  }
  
  async updateTemplate(id: string, updates: any): Promise<any> {
    // This method exists in legacy storage with the same name
    if ('updateTemplate' in this.legacy) {
      return (this.legacy as any).updateTemplate(id, updates);
    }
    throw new Error('updateTemplate method not available in storage');
  }
  
  async archiveTemplate(id: string): Promise<boolean> {
    // This method exists in legacy storage with the same name
    if ('archiveTemplate' in this.legacy) {
      return (this.legacy as any).archiveTemplate(id);
    }
    throw new Error('archiveTemplate method not available in storage');
  }
  
  async listTemplateVersions(templateId: string, options?: any): Promise<any[]> {
    // This method exists in legacy storage with the same name
    if ('listTemplateVersions' in this.legacy) {
      return (this.legacy as any).listTemplateVersions(templateId, options);
    }
    throw new Error('listTemplateVersions method not available in storage');
  }
  
  async createTemplateVersion(version: any): Promise<any> {
    // Map to legacy storage's createTemplateVersion method
    if ('createTemplateVersion' in this.legacy) {
      return (this.legacy as any).createTemplateVersion(version);
    }
    throw new Error('createTemplateVersion method not available in storage');
  }
  
  async publishTemplateVersion(templateId: string, versionId: string): Promise<boolean> {
    // This method exists in legacy storage with the same name
    if ('publishTemplateVersion' in this.legacy) {
      const result = await (this.legacy as any).publishTemplateVersion(templateId, versionId);
      return !!result;
    }
    throw new Error('publishTemplateVersion method not available in storage');
  }
  
  async attachSegments(templateId: string, segmentIds: string[]): Promise<boolean> {
    // Delegate to legacy storage's attachSegments method
    if ('attachSegments' in this.legacy) {
      await (this.legacy as any).attachSegments(templateId, segmentIds);
      return true;
    }
    // If method doesn't exist, throw error instead of silently failing
    throw new Error('attachSegments method not available in storage');
  }
  
  async detachSegment(templateId: string, segmentId: string): Promise<boolean> {
    // Delegate to legacy storage's detachSegment method
    if ('detachSegment' in this.legacy) {
      return await (this.legacy as any).detachSegment(templateId, segmentId);
    }
    // If method doesn't exist, throw error instead of silently failing
    throw new Error('detachSegment method not available in storage');
  }
  
  async recordTemplateMetric(metric: any): Promise<any> {
    // Delegate to legacy if it has the method
    if ('upsertTemplateMetricsWindow' in this.legacy) {
      return (this.legacy as any).upsertTemplateMetricsWindow(metric);
    }
    return { ...metric, id: crypto.randomUUID() };
  }
  
  async getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<any[]> {
    // Delegate to legacy if it has the method
    if ('getTemplateMetrics' in this.legacy) {
      return (this.legacy as any).getTemplateMetrics(templateId, startDate, endDate);
    }
    return [];
  }
  
  async getAudienceSegments(filters?: any): Promise<any[]> {
    // Delegate to legacy if it has the method
    if ('listAudienceSegments' in this.legacy) {
      return (this.legacy as any).listAudienceSegments(filters);
    }
    return [];
  }
  
  // ========== Delegate ALL other methods directly to legacy storage ==========
  // This preserves all existing functionality and data
  
  // Proxy all other method calls to legacy storage
  // This allows us to handle any method call without explicitly defining each one
  [key: string]: any;
}

// Create a Proxy that delegates all undefined methods to legacy storage
export function createSimpleFacade(legacy: IStorage): any {
  const facade = new SimpleFacade(legacy);
  
  return new Proxy(facade, {
    get(target, prop) {
      // Handle symbol properties (like Symbol.toStringTag)
      if (typeof prop === 'symbol') {
        return undefined;
      }
      
      // If the facade has the method, use it
      if (prop in target) {
        return (target as any)[prop];
      }
      
      // Otherwise, delegate to legacy storage
      if (prop in legacy) {
        const value = (legacy as any)[prop];
        // Bind functions to legacy storage context
        if (typeof value === 'function') {
          return value.bind(legacy);
        }
        return value;
      }
      
      return undefined;
    }
  });
}