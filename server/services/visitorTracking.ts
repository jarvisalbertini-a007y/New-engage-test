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
    ipAddress: string;
    userAgent?: string;
    pagesViewed: string[];
    timeOnSite: number;
  }
): Promise<VisitorSession> {
  // Create visitor session
  const session = await storage.createVisitorSession({
    companyId: sessionData.companyId,
    ipAddress: sessionData.ipAddress,
    userAgent: sessionData.userAgent,
    pagesViewed: sessionData.pagesViewed,
    timeOnSite: sessionData.timeOnSite,
    intentScore: 0,
    isActive: true
  });
  
  // If we have a company, emit insight triggers
  if (sessionData.companyId) {
    const company = await storage.getCompany(sessionData.companyId);
    if (company) {
      // Get all sessions for this company
      const sessions = await storage.getVisitorSessionsByCompany(sessionData.companyId);
      
      // Emit trigger for new company visit if first session
      if (sessions.length === 1) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.NEW_COMPANY,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            pagesViewed: sessionData.pagesViewed.length,
            duration: sessionData.timeOnSite,
            ipAddress: sessionData.ipAddress
          },
          timestamp: new Date()
        });
      }
      
      // Emit trigger for high engagement if applicable
      if (sessionData.pagesViewed.length >= 5 || sessionData.timeOnSite >= 300) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.HIGH_ENGAGEMENT,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            pagesViewed: sessionData.pagesViewed.length,
            duration: sessionData.timeOnSite,
            timeOnSite: `${Math.floor(sessionData.timeOnSite / 60)}m`
          },
          timestamp: new Date()
        });
      }
      
      // Emit trigger for multi visit
      if (sessions.length > 1) {
        await insightsOrchestrator.acceptTrigger({
          source: 'visitor',
          eventType: EventTypes.visitor.MULTI_VISIT,
          companyId: sessionData.companyId,
          companyName: company.name,
          data: {
            sessionId: session.id,
            totalVisits: sessions.length,
            previousVisit: sessions[sessions.length - 2]?.lastActivity
          },
          timestamp: new Date()
        });
      }
    }
  }
  
  return session;
}

/**
 * Update visitor session activity
 */
export async function updateVisitorActivity(
  sessionId: string,
  activityData: {
    newPages?: string[];
    additionalTime?: number;
  }
): Promise<VisitorSession | undefined> {
  const session = await storage.getVisitorSession(sessionId);
  if (!session) return undefined;
  
  const updatedPages = [
    ...(session.pagesViewed || []),
    ...(activityData.newPages || [])
  ];
  
  const updatedTime = (session.timeOnSite || 0) + (activityData.additionalTime || 0);
  
  const updated = await storage.updateVisitorSession(sessionId, {
    pagesViewed: updatedPages,
    timeOnSite: updatedTime,
    lastActivity: new Date(),
    isActive: true
  });
  
  // Check for intent spike if significant activity
  if (session.companyId && updatedPages.length >= 10) {
    const company = await storage.getCompany(session.companyId);
    if (company) {
      await insightsOrchestrator.acceptTrigger({
        source: 'visitor',
        eventType: EventTypes.visitor.INTENT_SPIKE,
        companyId: session.companyId,
        companyName: company.name,
        data: {
          sessionId,
          pagesViewed: updatedPages.length,
          timeOnSite: `${Math.floor(updatedTime / 60)}m`,
          recentPages: updatedPages.slice(-5)
        },
        timestamp: new Date()
      });
    }
  }
  
  return updated;
}

/**
 * Calculate intent score for a visitor session
 */
export async function calculateIntentScore(sessionId: string): Promise<number> {
  const session = await storage.getVisitorSession(sessionId);
  if (!session) return 0;
  
  let score = 0;
  
  // Page views scoring
  const pageCount = session.pagesViewed?.length || 0;
  if (pageCount >= 10) score += 30;
  else if (pageCount >= 5) score += 20;
  else if (pageCount >= 3) score += 10;
  
  // Duration scoring (in seconds)
  const duration = session.timeOnSite || 0;
  if (duration >= 600) score += 30;
  else if (duration >= 300) score += 20;
  else if (duration >= 120) score += 10;
  
  // Company association
  if (session.companyId) score += 20;
  
  // High-value pages (pricing, demo, contact)
  if (session.pagesViewed) {
    const highValuePages = ['/pricing', '/demo', '/contact', '/trial'];
    const viewedHighValue = session.pagesViewed.some(page => 
      highValuePages.some(hvp => page.includes(hvp))
    );
    if (viewedHighValue) score += 20;
  }
  
  // Update the session with the calculated score
  await storage.updateVisitorSession(sessionId, {
    intentScore: score,
    isActive: score >= 50
  });
  
  // If high score, emit trigger
  if (score >= 70 && session.companyId) {
    const company = await storage.getCompany(session.companyId);
    if (company) {
      await insightsOrchestrator.acceptTrigger({
        source: 'visitor',
        eventType: EventTypes.visitor.INTENT_SPIKE,
        companyId: session.companyId,
        companyName: company.name,
        data: {
          sessionId,
          intentScore: score,
          qualificationReason: 'High intent score from engagement patterns'
        },
        timestamp: new Date()
      });
    }
  }
  
  return score;
}

/**
 * Mark session as inactive after period of no activity
 */
export async function deactivateSession(sessionId: string): Promise<void> {
  await storage.updateVisitorSession(sessionId, {
    isActive: false
  });
}