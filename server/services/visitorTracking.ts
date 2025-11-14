import { storage } from "../storage";
import { VisitorSession, Company } from "@shared/schema";
import { insightsOrchestrator } from "./insightsOrchestrator";
import { EventTypes } from "./insightsOrchestrator";

/**
 * Track a new visitor session and generate insights
 */
export async function trackVisitorSession(
  sessionData: {
    companyId?: string;
    companyDomain?: string;
    companyName?: string;
    pageViews: number;
    totalDuration: number;
    referrerSource?: string;
  }
): Promise<VisitorSession> {
  // Create or update visitor session
  const session = await storage.createVisitorSession({
    companyId: sessionData.companyId,
    companyDomain: sessionData.companyDomain,
    visitorId: Math.random().toString(36).substr(2, 9),
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    pageViews: sessionData.pageViews,
    totalDuration: sessionData.totalDuration,
    referrerSource: sessionData.referrerSource,
    entryPage: "/",
    exitPage: "/",
    technology: [],
    location: null,
    industry: null,
    isQualifiedLead: false,
    leadScore: 0
  });
  
  // If we have a company, emit insight triggers
  if (sessionData.companyId) {
    const company = await storage.getCompany(sessionData.companyId);
    if (company) {
      // Emit trigger for new company visit if first session
      const sessions = await storage.getVisitorSessionsByCompany(sessionData.companyId);
      if (sessions.length === 1) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.NEW_COMPANY,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            pageViews: sessionData.pageViews,
            duration: sessionData.totalDuration,
            referrer: sessionData.referrerSource
          },
          timestamp: new Date()
        });
      }
      
      // Emit trigger for high engagement if applicable
      if (sessionData.pageViews >= 5 || sessionData.totalDuration >= 300) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.HIGH_ENGAGEMENT,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            pageViews: sessionData.pageViews,
            duration: sessionData.totalDuration,
            pagesViewed: sessionData.pageViews,
            timeOnSite: `${Math.floor(sessionData.totalDuration / 60)}m`
          },
          timestamp: new Date()
        });
      }
      
      // Emit trigger for repeat visit
      if (sessions.length > 1) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.REPEAT_VISIT,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            totalVisits: sessions.length,
            previousVisit: sessions[sessions.length - 2]?.lastSeen
          },
          timestamp: new Date()
        });
      }
    }
  }
  
  return session;
}

/**
 * Enrich a visitor session with company data
 */
export async function enrichVisitorSession(
  sessionId: string,
  enrichmentData: {
    companyId?: string;
    companyDomain?: string;
    technology?: string[];
    location?: string;
    industry?: string;
  }
): Promise<VisitorSession | undefined> {
  const session = await storage.getVisitorSession(sessionId);
  if (!session) return undefined;
  
  const updated = await storage.updateVisitorSession(sessionId, {
    companyId: enrichmentData.companyId || session.companyId,
    companyDomain: enrichmentData.companyDomain || session.companyDomain,
    technology: enrichmentData.technology || session.technology,
    location: enrichmentData.location || session.location,
    industry: enrichmentData.industry || session.industry,
    lastSeen: new Date().toISOString()
  });
  
  // If we just enriched with a company, emit new company trigger
  if (enrichmentData.companyId && !session.companyId) {
    const company = await storage.getCompany(enrichmentData.companyId);
    if (company) {
      await insightsOrchestrator.acceptTrigger({
        source: 'enrichment',
        eventType: EventTypes.enrichment.COMPANY_IDENTIFIED,
        companyId: enrichmentData.companyId,
        companyName: company.name,
        data: {
          sessionId,
          technology: enrichmentData.technology,
          industry: enrichmentData.industry,
          location: enrichmentData.location
        },
        timestamp: new Date()
      });
    }
  }
  
  return updated;
}

/**
 * Calculate lead score for a visitor session
 */
export async function calculateLeadScore(sessionId: string): Promise<number> {
  const session = await storage.getVisitorSession(sessionId);
  if (!session) return 0;
  
  let score = 0;
  
  // Page views scoring
  if (session.pageViews >= 10) score += 30;
  else if (session.pageViews >= 5) score += 20;
  else if (session.pageViews >= 3) score += 10;
  
  // Duration scoring (in seconds)
  if (session.totalDuration >= 600) score += 30;
  else if (session.totalDuration >= 300) score += 20;
  else if (session.totalDuration >= 120) score += 10;
  
  // Company enrichment
  if (session.companyId) score += 20;
  
  // Technology stack matching
  if (session.technology && session.technology.length > 0) {
    const targetTech = ['React', 'Node.js', 'AWS', 'Salesforce'];
    const matches = session.technology.filter(t => targetTech.includes(t));
    score += matches.length * 5;
  }
  
  // Industry matching
  if (session.industry && ['SaaS', 'Technology', 'Financial Services'].includes(session.industry)) {
    score += 10;
  }
  
  // Update the session with the calculated score
  await storage.updateVisitorSession(sessionId, {
    leadScore: score,
    isQualifiedLead: score >= 50
  });
  
  // If high score, emit trigger
  if (score >= 70 && session.companyId) {
    const company = await storage.getCompany(session.companyId);
    if (company) {
      await insightsOrchestrator.acceptTrigger({
        source: 'visitor',
        eventType: EventTypes.visitor.HIGH_ENGAGEMENT,
        companyId: session.companyId,
        companyName: company.name,
        data: {
          sessionId,
          leadScore: score,
          qualificationReason: 'High engagement and company match'
        },
        timestamp: new Date()
      });
    }
  }
  
  return score;
}