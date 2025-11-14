import { storage } from "../storage";
import { 
  Insight, InsertInsight, Company, VisitorSession, Email, Sequence
} from "@shared/schema";

// Event trigger types
export type InsightSource = 'visitor' | 'email' | 'sequence' | 'enrichment' | 'deal' | 'campaign';

export interface InsightTrigger {
  source: InsightSource;
  eventType: string;
  companyId: string;
  companyName?: string;
  data: any;
  timestamp: Date;
}

export interface NormalizedTrigger extends InsightTrigger {
  fingerprint: string;
  relevance: number;
}

export interface InsightCandidate {
  trigger: NormalizedTrigger;
  type: string;
  title: string;
  description: string;
  score: number;
  actionable: boolean;
}

// Event type definitions for each source
export const EventTypes = {
  visitor: {
    INTENT_SPIKE: 'intent_spike',
    MULTI_VISIT: 'multi_visit',
    HIGH_ENGAGEMENT: 'high_engagement',
    NEW_COMPANY: 'new_company'
  },
  email: {
    REPLY_RECEIVED: 'reply_received',
    HIGH_OPEN_RATE: 'high_open_rate',
    LINK_CLICKED: 'link_clicked',
    UNSUBSCRIBE: 'unsubscribe'
  },
  sequence: {
    COMPLETED: 'completed',
    HIGH_ENGAGEMENT: 'high_engagement',
    MILESTONE_REACHED: 'milestone_reached'
  },
  enrichment: {
    FUNDING_DETECTED: 'funding_detected',
    LEADERSHIP_CHANGE: 'leadership_change',
    TECH_STACK_UPDATE: 'tech_stack_update',
    COMPANY_GROWTH: 'company_growth'
  },
  deal: {
    STAGE_ADVANCE: 'stage_advance',
    STUCK_DEAL: 'stuck_deal',
    HIGH_VELOCITY: 'high_velocity'
  },
  campaign: {
    PERFORMANCE_SPIKE: 'performance_spike',
    ANOMALY_DETECTED: 'anomaly_detected'
  }
} as const;

export class InsightsOrchestrator {
  private deduplicationWindow: Map<string, Date> = new Map();
  private deduplicationTTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Accept and process a single trigger
   */
  async acceptTrigger(trigger: InsightTrigger): Promise<Insight | null> {
    // Ensure company exists
    const company = await this.ensureCompanyContext(trigger.companyId);
    if (!company) {
      console.warn(`Company not found for insight trigger: ${trigger.companyId}`);
      return null;
    }

    // Normalize the trigger
    const normalized = this.normalizeTrigger(trigger, company);
    
    // Check for duplicates
    if (this.isDuplicate(normalized)) {
      return null;
    }

    // Score and create candidate
    const candidate = await this.createCandidate(normalized, company);
    if (!candidate || candidate.score < 30) {
      return null;
    }

    // Persist insight
    return this.persistInsight(candidate, company);
  }

  /**
   * Process multiple triggers in batch
   */
  async acceptBatch(triggers: InsightTrigger[]): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    for (const trigger of triggers) {
      const insight = await this.acceptTrigger(trigger);
      if (insight) {
        insights.push(insight);
      }
    }
    
    return insights;
  }

  /**
   * Ensure company exists and is enriched
   */
  private async ensureCompanyContext(companyId: string): Promise<Company | null> {
    const company = await storage.getCompany(companyId);
    return company || null;
  }

  /**
   * Normalize trigger with fingerprint and relevance
   */
  private normalizeTrigger(trigger: InsightTrigger, company: Company): NormalizedTrigger {
    // Create deterministic fingerprint
    const fingerprint = this.generateFingerprint(trigger);
    
    // Calculate base relevance
    const relevance = this.calculateRelevance(trigger, company);
    
    return {
      ...trigger,
      fingerprint,
      relevance
    };
  }

  /**
   * Generate deterministic fingerprint for deduplication
   */
  private generateFingerprint(trigger: InsightTrigger): string {
    const keyFields = [
      trigger.source,
      trigger.eventType,
      trigger.companyId,
      JSON.stringify(trigger.data?.key || trigger.data?.id || '')
    ];
    
    return keyFields.join(':');
  }

  /**
   * Check if this insight is a duplicate
   */
  private isDuplicate(trigger: NormalizedTrigger): boolean {
    const lastSeen = this.deduplicationWindow.get(trigger.fingerprint);
    const now = new Date();
    
    // Clean old entries
    this.cleanDeduplicationWindow();
    
    if (lastSeen && (now.getTime() - lastSeen.getTime() < this.deduplicationTTL)) {
      return true;
    }
    
    // Mark as seen
    this.deduplicationWindow.set(trigger.fingerprint, now);
    return false;
  }

  /**
   * Clean old entries from deduplication window
   */
  private cleanDeduplicationWindow(): void {
    const now = Date.now();
    
    Array.from(this.deduplicationWindow.entries()).forEach(([fingerprint, date]) => {
      if (now - date.getTime() > this.deduplicationTTL) {
        this.deduplicationWindow.delete(fingerprint);
      }
    });
  }

  /**
   * Calculate relevance score based on trigger and company context
   */
  private calculateRelevance(trigger: InsightTrigger, company: Company): number {
    let score = 50; // Base score
    
    // Source-based scoring
    switch (trigger.source) {
      case 'visitor':
        if (trigger.eventType === EventTypes.visitor.INTENT_SPIKE) score += 30;
        if (trigger.eventType === EventTypes.visitor.MULTI_VISIT) score += 20;
        break;
      case 'email':
        if (trigger.eventType === EventTypes.email.REPLY_RECEIVED) score += 35;
        if (trigger.eventType === EventTypes.email.LINK_CLICKED) score += 15;
        break;
      case 'enrichment':
        if (trigger.eventType === EventTypes.enrichment.FUNDING_DETECTED) score += 40;
        if (trigger.eventType === EventTypes.enrichment.LEADERSHIP_CHANGE) score += 30;
        break;
      case 'deal':
        if (trigger.eventType === EventTypes.deal.STUCK_DEAL) score += 25;
        if (trigger.eventType === EventTypes.deal.STAGE_ADVANCE) score += 20;
        break;
    }
    
    // Company size bonus
    if (company.size && (company.size.includes('100') || company.size.includes('500') || company.size.includes('1000'))) {
      score += 10;
    }
    
    // Industry relevance (if target industry)
    if (company.industry && ['SaaS', 'Technology', 'Financial Services'].includes(company.industry)) {
      score += 5;
    }
    
    return Math.min(100, score);
  }

  /**
   * Create insight candidate from normalized trigger
   */
  private async createCandidate(trigger: NormalizedTrigger, company: Company): Promise<InsightCandidate | null> {
    let candidate: InsightCandidate | null = null;
    
    switch (trigger.source) {
      case 'visitor':
        candidate = this.createVisitorInsight(trigger, company);
        break;
      case 'email':
        candidate = this.createEmailInsight(trigger, company);
        break;
      case 'enrichment':
        candidate = this.createEnrichmentInsight(trigger, company);
        break;
      case 'sequence':
        candidate = this.createSequenceInsight(trigger, company);
        break;
      case 'deal':
        candidate = this.createDealInsight(trigger, company);
        break;
      case 'campaign':
        candidate = this.createCampaignInsight(trigger, company);
        break;
    }
    
    return candidate;
  }

  /**
   * Create visitor-based insight
   */
  private createVisitorInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    let title = '';
    let description = '';
    let type = 'engagement';
    
    switch (trigger.eventType) {
      case EventTypes.visitor.INTENT_SPIKE:
        title = `${company.name} showing high intent`;
        description = `${data.visitCount || 'Multiple'} visits in the last ${data.period || '7 days'}. ${data.pagesViewed || 'Key pages'} viewed including pricing.`;
        type = 'intent';
        break;
      case EventTypes.visitor.MULTI_VISIT:
        title = `Active visitor from ${company.name}`;
        description = `${data.uniqueVisitors || 'Multiple'} unique visitors, ${data.totalPageViews || 'high'} total page views. Strong buying signals detected.`;
        break;
      case EventTypes.visitor.HIGH_ENGAGEMENT:
        title = `Deep engagement from ${company.name}`;
        description = `Visitor spent ${data.timeOnSite || 'significant time'} on site, viewed ${data.pagesViewed || 'multiple'} pages including key conversion pages.`;
        break;
      case EventTypes.visitor.NEW_COMPANY:
        title = `New company discovered: ${company.name}`;
        description = `First-time visitor from ${company.name}. Industry: ${company.industry || 'Unknown'}. Company size: ${company.size || 'Unknown'}.`;
        type = 'new_prospect';
        break;
    }
    
    return {
      trigger,
      type,
      title,
      description,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Create email-based insight
   */
  private createEmailInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    let title = '';
    let description = '';
    let type = 'engagement';
    
    switch (trigger.eventType) {
      case EventTypes.email.REPLY_RECEIVED:
        title = `${company.name} replied to your email`;
        description = `${data.contactName || 'Contact'} responded to your ${data.campaignName || 'outreach'}. Reply sentiment: ${data.sentiment || 'positive'}. Priority follow-up recommended.`;
        type = 'reply';
        break;
      case EventTypes.email.HIGH_OPEN_RATE:
        title = `High email engagement from ${company.name}`;
        description = `${data.openRate || 'High'}% open rate, ${data.opensCount || 'multiple'} opens. They're actively engaging with your content.`;
        break;
      case EventTypes.email.LINK_CLICKED:
        title = `${company.name} clicked your link`;
        description = `${data.contactName || 'Contact'} clicked on ${data.linkDescription || 'your call-to-action'}. Follow up while interest is high.`;
        type = 'engagement';
        break;
    }
    
    return {
      trigger,
      type,
      title,
      description,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Create enrichment-based insight
   */
  private createEnrichmentInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    let title = '';
    let description = '';
    let type = 'market_intel';
    
    switch (trigger.eventType) {
      case EventTypes.enrichment.FUNDING_DETECTED:
        title = `${company.name} raised ${data.amount || 'funding'}`;
        description = `${data.round || 'New funding'} round closed. Perfect timing to reach out about growth initiatives and scaling solutions.`;
        type = 'funding';
        break;
      case EventTypes.enrichment.LEADERSHIP_CHANGE:
        title = `New ${data.role || 'executive'} at ${company.name}`;
        description = `${data.personName || 'New leader'} joined as ${data.role || 'executive'}. Great opportunity to introduce your solution during their evaluation period.`;
        type = 'leadership_change';
        break;
      case EventTypes.enrichment.TECH_STACK_UPDATE:
        title = `${company.name} added new technology`;
        description = `Detected ${data.technology || 'new tech'} in their stack. This indicates ${data.indication || 'growth and modernization initiatives'}.`;
        type = 'tech_stack';
        break;
      case EventTypes.enrichment.COMPANY_GROWTH:
        title = `${company.name} is expanding`;
        description = `Employee count increased by ${data.growthPercent || 'significant'}%. ${data.jobPostings || 'Multiple'} new job postings indicate rapid growth.`;
        type = 'expansion';
        break;
    }
    
    return {
      trigger,
      type,
      title,
      description,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Create sequence-based insight
   */
  private createSequenceInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    return {
      trigger,
      type: 'sequence',
      title: `Sequence milestone for ${company.name}`,
      description: `${data.sequenceName || 'Sequence'} reached ${data.milestone || 'key milestone'}. ${data.engagement || 'Good engagement'} observed.`,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Create deal-based insight
   */
  private createDealInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    let title = '';
    let description = '';
    let type = 'deal';
    
    switch (trigger.eventType) {
      case EventTypes.deal.STUCK_DEAL:
        title = `Deal stuck: ${company.name}`;
        description = `Deal has been in ${data.currentStage || 'current stage'} for ${data.daysStuck || 'extended period'}. Intervention recommended.`;
        type = 'risk';
        break;
      case EventTypes.deal.STAGE_ADVANCE:
        title = `${company.name} advancing in pipeline`;
        description = `Deal moved to ${data.newStage || 'next stage'}. Momentum is positive. ${data.nextSteps || 'Continue engagement'}.`;
        type = 'opportunity';
        break;
    }
    
    return {
      trigger,
      type,
      title,
      description,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Create campaign-based insight
   */
  private createCampaignInsight(trigger: NormalizedTrigger, company: Company): InsightCandidate {
    const data = trigger.data;
    return {
      trigger,
      type: 'campaign',
      title: `Campaign performance alert: ${company.name}`,
      description: `${data.campaignName || 'Campaign'} showing ${data.metric || 'unusual activity'}. ${data.recommendation || 'Review and optimize'}.`,
      score: trigger.relevance,
      actionable: true
    };
  }

  /**
   * Persist insight to storage
   */
  private async persistInsight(candidate: InsightCandidate, company: Company): Promise<Insight> {
    const insertInsight: InsertInsight = {
      companyId: company.id,
      type: candidate.type,
      title: candidate.title,
      description: candidate.description,
      source: candidate.trigger.source,
      confidence: (candidate.score / 100).toFixed(2),
      relevanceScore: candidate.score,
      actionable: candidate.actionable,
      data: candidate.trigger.data
    };
    
    return await storage.createInsight(insertInsight);
  }

  /**
   * Age out stale insights
   */
  async expireStaleInsights(daysOld: number = 90): Promise<number> {
    const insights = await storage.getInsights();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let expired = 0;
    for (const insight of insights) {
      if (new Date(insight.createdAt) < cutoffDate) {
        // In a real implementation, we'd have a deleteInsight method
        // For now, we'll just count them
        expired++;
      }
    }
    
    return expired;
  }

  /**
   * Replay historical events to generate insights
   */
  async replayHistoricalEvents(since: Date): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    // Get companies and their visitor sessions
    const companies = await storage.getCompanies(20);
    for (const company of companies) {
      const sessions = await storage.getVisitorSessionsByCompany(company.id);
      for (const session of sessions) {
        if (new Date(session.firstSeen) >= since) {
          const trigger: InsightTrigger = {
            source: 'visitor',
            eventType: EventTypes.visitor.NEW_COMPANY,
            companyId: company.id,
            companyName: company.name,
            data: {
              sessionId: session.id,
              pageViews: session.pageViews,
              duration: session.totalDuration
            },
            timestamp: new Date(session.firstSeen)
          };
          
          const insight = await this.acceptTrigger(trigger);
          if (insight) insights.push(insight);
        }
      }
    }
    
    // Get recent emails with replies
    const emails = await storage.getEmails({ limit: 100 });
    for (const email of emails) {
      if (email.repliedAt && new Date(email.repliedAt) >= since && email.contactId) {
        const contact = await storage.getContact(email.contactId);
        if (contact?.companyId) {
          const contactName = `${contact.firstName} ${contact.lastName}`.trim();
          const trigger: InsightTrigger = {
            source: 'email',
            eventType: EventTypes.email.REPLY_RECEIVED,
            companyId: contact.companyId,
            data: {
              emailId: email.id,
              contactName: contactName,
              subject: email.subject
            },
            timestamp: new Date(email.repliedAt)
          };
          
          const insight = await this.acceptTrigger(trigger);
          if (insight) insights.push(insight);
        }
      }
    }
    
    return insights;
  }
}

// Export singleton instance
export const insightsOrchestrator = new InsightsOrchestrator();