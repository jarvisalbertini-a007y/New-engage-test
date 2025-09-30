import { storage } from "../storage";
import { type InsertVisitorSession, type VisitorSession } from "@shared/schema";
import { identifyCompanyFromIP, enrichCompanyData, getCompanyVisitorHistory } from "./ipIntelligence";

export interface VisitorIntelligenceData {
  session: VisitorSession;
  company: any;
  intentScore: number;
  timeAgo: string;
  activitySummary: string;
}

export async function calculateIntentScore(session: VisitorSession): Promise<number> {
  let score = 0;
  
  // Base score for visiting
  score += 20;
  
  // Page-based scoring
  if (session.pagesViewed) {
    const pages = session.pagesViewed;
    
    // High-intent pages
    if (pages.includes('/pricing') || pages.includes('/pricing/')) score += 30;
    if (pages.includes('/demo') || pages.includes('/demo/')) score += 25;
    if (pages.includes('/contact') || pages.includes('/contact/')) score += 25;
    if (pages.includes('/trial') || pages.includes('/signup')) score += 35;
    
    // Medium-intent pages
    if (pages.includes('/features') || pages.includes('/features/')) score += 15;
    if (pages.includes('/solutions') || pages.includes('/solutions/')) score += 15;
    if (pages.includes('/case-studies') || pages.includes('/customers/')) score += 20;
    
    // Multiple page visits indicate engagement
    if (pages.length > 3) score += 10;
    if (pages.length > 5) score += 15;
  }
  
  // Time on site scoring
  if (session.timeOnSite) {
    if (session.timeOnSite > 300) score += 15; // > 5 minutes
    if (session.timeOnSite > 600) score += 20; // > 10 minutes
  }
  
  // Recent activity boost
  const hoursSinceLastActivity = session.lastActivity ? 
    (Date.now() - new Date(session.lastActivity).getTime()) / (1000 * 60 * 60) : 0;
  
  if (hoursSinceLastActivity < 1) score += 10;
  if (hoursSinceLastActivity < 0.5) score += 15;
  
  return Math.min(100, Math.max(0, score));
}

export async function getActiveVisitorIntelligence(): Promise<VisitorIntelligenceData[]> {
  const activeSessions = await storage.getActiveVisitorSessions();
  const intelligenceData: VisitorIntelligenceData[] = [];
  
  for (const session of activeSessions) {
    const company = session.companyId ? await storage.getCompany(session.companyId) : null;
    
    if (company) {
      const intentScore = await calculateIntentScore(session);
      const timeAgo = getTimeAgo(session.lastActivity);
      const activitySummary = generateActivitySummary(session);
      
      intelligenceData.push({
        session,
        company,
        intentScore,
        timeAgo,
        activitySummary
      });
    }
  }
  
  // Sort by intent score (highest first)
  return intelligenceData.sort((a, b) => b.intentScore - a.intentScore);
}

export async function trackVisitorActivity(ipAddress: string, userAgent: string, page: string): Promise<VisitorSession> {
  // Try to find existing active session
  const activeSessions = await storage.getActiveVisitorSessions();
  let existingSession = activeSessions.find(s => s.ipAddress === ipAddress && s.isActive);
  
  if (existingSession) {
    // Update existing session
    const updatedPages = existingSession.pagesViewed ? [...existingSession.pagesViewed, page] : [page];
    const timeOnSite = Math.floor((Date.now() - new Date(existingSession.createdAt).getTime()) / 1000);
    const intentScore = await calculateIntentScore({ ...existingSession, pagesViewed: updatedPages, timeOnSite });
    
    const updatedSession = await storage.updateVisitorSession(existingSession.id, {
      pagesViewed: updatedPages,
      timeOnSite,
      intentScore,
      lastActivity: new Date()
    });
    return updatedSession!;
  } else {
    // Create new session with company identification
    const company = await identifyCompanyFromIP(ipAddress);
    
    const newSession: InsertVisitorSession = {
      companyId: company?.id || null,
      ipAddress,
      userAgent,
      pagesViewed: [page],
      timeOnSite: 0,
      intentScore: 0,
      isActive: true
    };
    
    const session = await storage.createVisitorSession(newSession);
    
    // Trigger enrichment in background if company was identified
    if (company?.domain) {
      enrichCompanyData(company.domain).then(enrichment => {
        console.log(`Enriched data for ${company.name}:`, enrichment);
      }).catch(err => {
        console.error('Enrichment failed:', err);
      });
    }
    
    return session;
  }
}


function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function generateActivitySummary(session: VisitorSession): string {
  const pageCount = session.pagesViewed?.length || 0;
  const timeMinutes = Math.floor((session.timeOnSite || 0) / 60);
  
  return `${pageCount} pages viewed, ${timeMinutes}m on site`;
}
