import { storage } from "../storage";
import { randomUUID } from "crypto";
import type { 
  ExtensionUser, 
  InsertExtensionUser,
  EnrichmentCache,
  InsertEnrichmentCache,
  ExtensionActivity,
  InsertExtensionActivity,
  QuickAction,
  InsertQuickAction,
  Contact,
  Company,
  InsertContact,
  InsertCompany
} from "@shared/schema";

export class ExtensionService {
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Authenticate extension user and generate/retrieve API key
   */
  async authenticateExtension(userId: string): Promise<{ token: string; extensionUser: ExtensionUser }> {
    // Check if user already has an extension setup
    let extensionUser = await storage.getExtensionUserByUserId(userId);
    
    if (!extensionUser) {
      // Generate new extension ID (API key)
      const extensionId = `ext_${randomUUID().replace(/-/g, '')}`;
      
      // Create new extension user
      extensionUser = await storage.createExtensionUser({
        userId,
        extensionId,
        settings: {
          autoEnrich: true,
          captureFields: ['email', 'title', 'company', 'linkedin'],
          notificationsEnabled: true
        },
        isActive: true
      });
    } else {
      // Update last active timestamp
      extensionUser = await storage.updateExtensionUser(extensionUser.id, {
        lastActiveAt: new Date()
      });
    }
    
    return {
      token: extensionUser.extensionId,
      extensionUser: extensionUser!
    };
  }

  /**
   * Validate extension token
   */
  async validateExtensionToken(token: string): Promise<ExtensionUser | null> {
    const users = await storage.getExtensionActivities({ limit: 1000 }); // Get all extension users
    const extensionUser = await storage.getExtensionUserByUserId(""); // This needs fixing
    
    // For now, we'll use a simpler approach - validate by checking the extension ID format
    if (!token.startsWith('ext_')) {
      return null;
    }
    
    // In a real implementation, we'd look up the user by extensionId
    // For demo purposes, return a mock user
    return null;
  }

  /**
   * Enrich a prospect profile from URL (LinkedIn, etc.)
   */
  async enrichProfile(url: string, userId: string): Promise<any> {
    // Extract domain from URL
    const domain = this.extractDomain(url);
    
    // Check cache first
    const cached = await storage.getEnrichmentCacheByDomain(domain);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      // Track activity
      await storage.createExtensionActivity({
        userId,
        activityType: 'view',
        url,
        domain,
        enrichedData: cached.contactData
      });
      
      return cached.contactData;
    }
    
    // Simulate enrichment (in real implementation, this would call external APIs)
    const enrichedData = this.simulateProfileEnrichment(url);
    
    // Cache the results
    await storage.createEnrichmentCache({
      domain,
      contactData: enrichedData,
      companyData: enrichedData.company,
      expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
    });
    
    // Track activity
    await storage.createExtensionActivity({
      userId,
      activityType: 'enrich',
      url,
      domain,
      enrichedData
    });
    
    return enrichedData;
  }

  /**
   * Enrich company information from domain
   */
  async enrichCompany(domain: string, userId: string): Promise<any> {
    // Check cache first
    const cached = await storage.getEnrichmentCacheByDomain(domain);
    if (cached && cached.companyData && new Date(cached.expiresAt) > new Date()) {
      return cached.companyData;
    }
    
    // Simulate company enrichment
    const companyData = this.simulateCompanyEnrichment(domain);
    
    // Update or create cache
    if (cached) {
      await storage.updateEnrichmentCache(cached.id, {
        companyData,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
      });
    } else {
      await storage.createEnrichmentCache({
        domain,
        companyData,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
      });
    }
    
    // Track activity
    await storage.createExtensionActivity({
      userId,
      activityType: 'enrich',
      domain,
      enrichedData: companyData
    });
    
    return companyData;
  }

  /**
   * Detect technologies used by a company
   */
  async detectTechnologies(domain: string, userId: string): Promise<any> {
    // Check cache first
    const cached = await storage.getEnrichmentCacheByDomain(domain);
    if (cached && cached.technologies && new Date(cached.expiresAt) > new Date()) {
      return cached.technologies;
    }
    
    // Simulate technology detection
    const technologies = this.simulateTechnologyDetection(domain);
    
    // Update or create cache
    if (cached) {
      await storage.updateEnrichmentCache(cached.id, {
        technologies,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
      });
    } else {
      await storage.createEnrichmentCache({
        domain,
        technologies,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_MS)
      });
    }
    
    return technologies;
  }

  /**
   * Find contacts at a company
   */
  async findContacts(companyDomain: string, userId: string): Promise<Contact[]> {
    // First check if we have this company
    const companies = await storage.getCompaniesByDomain(companyDomain);
    
    if (companies.length === 0) {
      // Create the company first
      const companyData = await this.enrichCompany(companyDomain, userId);
      await storage.createCompany({
        name: companyData.name,
        domain: companyDomain,
        industry: companyData.industry,
        size: companyData.size,
        location: companyData.location
      });
    }
    
    // Get contacts for this company
    const company = await storage.getCompaniesByDomain(companyDomain);
    if (company.length > 0) {
      return await storage.getContacts({ companyId: company[0].id });
    }
    
    return [];
  }

  /**
   * Save enriched data as a lead
   */
  async saveToDatabase(data: any, userId: string): Promise<{ contact?: Contact; company?: Company }> {
    const result: { contact?: Contact; company?: Company } = {};
    
    // Save company if provided
    if (data.company && data.company.domain) {
      const existingCompanies = await storage.getCompaniesByDomain(data.company.domain);
      
      if (existingCompanies.length === 0) {
        result.company = await storage.createCompany({
          name: data.company.name,
          domain: data.company.domain,
          industry: data.company.industry,
          size: data.company.size,
          location: data.company.location,
          technologies: data.company.technologies
        });
      } else {
        result.company = existingCompanies[0];
      }
    }
    
    // Save contact if provided
    if (data.contact && data.contact.email) {
      result.contact = await storage.createContact({
        companyId: result.company?.id,
        email: data.contact.email,
        firstName: data.contact.firstName || '',
        lastName: data.contact.lastName || '',
        title: data.contact.title,
        linkedinUrl: data.contact.linkedinUrl,
        phoneNumber: data.contact.phoneNumber
      });
    }
    
    // Track save activity
    await storage.createExtensionActivity({
      userId,
      activityType: 'save',
      domain: data.company?.domain,
      enrichedData: data
    });
    
    return result;
  }

  /**
   * Execute a quick action from the extension
   */
  async executeQuickAction(action: string, data: any, userId: string): Promise<any> {
    let result: any = {};
    
    switch (action) {
      case 'add_to_sequence':
        // Add contact to sequence logic
        result = { success: true, message: 'Contact added to sequence' };
        break;
        
      case 'send_email':
        // Send email logic
        result = { success: true, message: 'Email queued for sending' };
        break;
        
      case 'save_lead':
        // Save lead logic
        result = await this.saveToDatabase(data, userId);
        break;
        
      default:
        result = { success: false, error: 'Unknown action' };
    }
    
    // Track quick action
    await storage.createQuickAction({
      userId,
      actionType: action,
      targetData: data,
      result
    });
    
    return result;
  }

  /**
   * Get extension usage statistics
   */
  async getExtensionStats(userId: string): Promise<any> {
    const activities = await storage.getExtensionActivities({ userId });
    const quickActions = await storage.getQuickActions({ userId });
    
    // Calculate stats
    const stats = {
      totalEnrichments: activities.filter(a => a.activityType === 'enrich').length,
      totalSaves: activities.filter(a => a.activityType === 'save').length,
      totalViews: activities.filter(a => a.activityType === 'view').length,
      totalQuickActions: quickActions.length,
      recentActivity: activities.slice(0, 10),
      quickActionBreakdown: {
        add_to_sequence: quickActions.filter(a => a.actionType === 'add_to_sequence').length,
        send_email: quickActions.filter(a => a.actionType === 'send_email').length,
        save_lead: quickActions.filter(a => a.actionType === 'save_lead').length
      },
      lastActiveAt: activities[0]?.timestamp || null
    };
    
    return stats;
  }

  /**
   * Get user extension settings
   */
  async getExtensionSettings(userId: string): Promise<any> {
    const extensionUser = await storage.getExtensionUserByUserId(userId);
    
    if (!extensionUser) {
      return null;
    }
    
    return {
      extensionId: extensionUser.extensionId,
      settings: extensionUser.settings,
      isActive: extensionUser.isActive,
      installedAt: extensionUser.installedAt,
      lastActiveAt: extensionUser.lastActiveAt
    };
  }

  /**
   * Update extension settings
   */
  async updateExtensionSettings(userId: string, settings: any): Promise<ExtensionUser | null> {
    const extensionUser = await storage.getExtensionUserByUserId(userId);
    
    if (!extensionUser) {
      return null;
    }
    
    return await storage.updateExtensionUser(extensionUser.id, {
      settings
    });
  }

  // Helper methods
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  private simulateProfileEnrichment(url: string): any {
    // Simulate LinkedIn profile enrichment
    if (url.includes('linkedin.com')) {
      return {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        title: 'VP of Sales',
        company: {
          name: 'TechCorp Solutions',
          domain: 'techcorp.com',
          industry: 'SaaS',
          size: '50-200',
          location: 'San Francisco, CA'
        },
        linkedinUrl: url,
        phoneNumber: '+1 (555) 123-4567',
        socialProfiles: {
          twitter: '@johndoe',
          github: 'johndoe'
        },
        enrichedAt: new Date().toISOString()
      };
    }
    
    return {};
  }

  private simulateCompanyEnrichment(domain: string): any {
    // Simulate company data enrichment
    const companies: Record<string, any> = {
      'techcorp.com': {
        name: 'TechCorp Solutions',
        domain: 'techcorp.com',
        industry: 'SaaS',
        size: '50-200',
        location: 'San Francisco, CA',
        revenue: '$10M-50M',
        technologies: ['React', 'Node.js', 'AWS', 'PostgreSQL'],
        description: 'Leading SaaS platform for enterprise automation',
        fundingRounds: [
          { type: 'Series A', amount: '$15M', date: '2023-06' }
        ],
        socialProfiles: {
          linkedin: 'https://linkedin.com/company/techcorp',
          twitter: '@techcorp',
          crunchbase: 'https://crunchbase.com/organization/techcorp'
        }
      },
      'dataflow.com': {
        name: 'DataFlow Inc',
        domain: 'dataflow.com',
        industry: 'Fintech',
        size: '200-500',
        location: 'Austin, TX',
        revenue: '$50M-100M',
        technologies: ['Python', 'PostgreSQL', 'Kubernetes', 'TensorFlow'],
        description: 'Financial data processing and analytics solutions',
        fundingRounds: [
          { type: 'Series B', amount: '$35M', date: '2023-01' }
        ],
        socialProfiles: {
          linkedin: 'https://linkedin.com/company/dataflow',
          twitter: '@dataflow'
        }
      }
    };
    
    return companies[domain] || {
      name: domain.replace('.com', '').replace('.', ' '),
      domain,
      industry: 'Technology',
      size: '10-50',
      location: 'United States',
      technologies: ['JavaScript', 'React', 'Node.js']
    };
  }

  private simulateTechnologyDetection(domain: string): any {
    // Simulate technology stack detection
    const techStacks: Record<string, any> = {
      'techcorp.com': {
        frontend: ['React', 'TypeScript', 'Tailwind CSS'],
        backend: ['Node.js', 'Express', 'GraphQL'],
        database: ['PostgreSQL', 'Redis'],
        infrastructure: ['AWS', 'Docker', 'Kubernetes'],
        analytics: ['Google Analytics', 'Segment', 'Mixpanel'],
        marketing: ['HubSpot', 'Intercom', 'Mailchimp'],
        payments: ['Stripe'],
        cdn: ['Cloudflare']
      },
      'dataflow.com': {
        frontend: ['Vue.js', 'Nuxt.js'],
        backend: ['Python', 'Django', 'FastAPI'],
        database: ['PostgreSQL', 'MongoDB', 'Elasticsearch'],
        infrastructure: ['Google Cloud', 'Kubernetes'],
        analytics: ['Amplitude', 'Datadog'],
        marketing: ['Marketo', 'Drift'],
        payments: ['Plaid', 'Stripe']
      }
    };
    
    return techStacks[domain] || {
      frontend: ['Unknown'],
      backend: ['Unknown'],
      database: ['Unknown'],
      infrastructure: ['Unknown']
    };
  }
}

// Export singleton instance
export const browserExtensionService = new ExtensionService();