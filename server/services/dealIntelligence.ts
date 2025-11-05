import { storage } from "../storage";
import {
  type IntentSignal,
  type InsertIntentSignal,
  type DealIntelligence,
  type InsertDealIntelligence,
  type TimingOptimization,
  type InsertTimingOptimization,
  type PredictiveModel,
  type InsertPredictiveModel,
  type Company,
  type Contact
} from "@shared/schema";

export class DealIntelligenceEngine {
  private signalWeights = {
    website_visit: 3,
    content_download: 7,
    email_open: 5,
    price_check: 9,
    competitor_research: 8,
    demo_request: 10,
    feature_comparison: 8,
    case_study_view: 7,
    roi_calculator: 9,
    contact_sales: 10
  };

  private buyingStages = [
    "awareness",
    "consideration",
    "evaluation",
    "decision",
    "purchase"
  ];

  // Capture and process new intent signals
  async captureIntent(signal: InsertIntentSignal): Promise<IntentSignal> {
    // Validate and enrich the signal
    const enrichedSignal = {
      ...signal,
      signalStrength: signal.signalStrength || this.calculateSignalStrength(signal.signalType),
      metadata: {
        ...signal.metadata,
        timestamp: new Date().toISOString(),
        processed: true
      }
    };

    // Store the signal
    const savedSignal = await storage.createIntentSignal(enrichedSignal);

    // Update company intelligence if company is provided
    if (signal.companyId) {
      await this.updateCompanyIntelligence(signal.companyId);
    }

    // Check for micro-moments and trigger actions
    await this.checkMicroMoments(savedSignal);

    return savedSignal;
  }

  // Calculate intent score for a company (0-100)
  async calculateIntentScore(companyId: string): Promise<number> {
    // Get all signals for the company
    const signals = await storage.getIntentSignals({ companyId, limit: 100 });
    
    if (!signals || signals.length === 0) return 0;

    // Calculate weighted score based on signals
    let totalScore = 0;
    let weightSum = 0;
    
    // Recent signals have more weight
    const now = Date.now();
    signals.forEach(signal => {
      const age = now - new Date(signal.detectedAt).getTime();
      const ageInDays = age / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0, 1 - (ageInDays / 30)); // Decay over 30 days
      
      const signalWeight = signal.signalStrength * recencyWeight;
      totalScore += signalWeight;
      weightSum += recencyWeight;
    });

    // Normalize to 0-100 scale
    const normalizedScore = weightSum > 0 ? Math.min(100, Math.round((totalScore / weightSum) * 10)) : 0;
    
    return normalizedScore;
  }

  // Predict which stage of the buying journey the company is in
  async predictBuyingStage(companyId: string): Promise<string> {
    const signals = await storage.getIntentSignals({ companyId, limit: 50 });
    
    if (!signals || signals.length === 0) return "awareness";

    // Analyze signal patterns
    const signalTypes = signals.map(s => s.signalType);
    
    // Decision stage indicators
    if (signalTypes.includes("demo_request") || signalTypes.includes("contact_sales")) {
      return "decision";
    }
    
    // Evaluation stage indicators
    if (signalTypes.includes("price_check") || signalTypes.includes("competitor_research") || signalTypes.includes("feature_comparison")) {
      return "evaluation";
    }
    
    // Consideration stage indicators
    if (signalTypes.includes("case_study_view") || signalTypes.includes("content_download")) {
      return "consideration";
    }
    
    // Default to awareness
    return "awareness";
  }

  // Identify champions within the company
  async identifyChampions(companyId: string): Promise<any[]> {
    const signals = await storage.getIntentSignals({ companyId, limit: 100 });
    const contacts = await storage.getContacts({ companyId });
    
    const championScores = new Map<string, number>();
    
    // Score contacts based on their engagement
    signals.forEach(signal => {
      if (signal.contactId) {
        const currentScore = championScores.get(signal.contactId) || 0;
        championScores.set(signal.contactId, currentScore + signal.signalStrength);
      }
    });
    
    // Identify top champions
    const champions = [];
    for (const [contactId, score] of championScores.entries()) {
      if (score > 20) { // Threshold for champion status
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
          champions.push({
            contact,
            engagementScore: score,
            role: contact.title || "Unknown",
            isChampion: true
          });
        }
      }
    }
    
    return champions.sort((a, b) => b.engagementScore - a.engagementScore);
  }

  // Detect potential blockers in the deal
  async detectBlockers(companyId: string): Promise<any[]> {
    const signals = await storage.getIntentSignals({ companyId, limit: 100 });
    const blockers = [];
    
    // Analyze for negative patterns
    const recentSignals = signals.filter(s => {
      const age = Date.now() - new Date(s.detectedAt).getTime();
      return age < 7 * 24 * 60 * 60 * 1000; // Last 7 days
    });
    
    // Check for stalled engagement
    if (recentSignals.length === 0 && signals.length > 10) {
      blockers.push({
        type: "engagement_stalled",
        severity: "high",
        description: "No recent engagement in the last 7 days",
        recommendation: "Schedule a check-in call or send personalized content"
      });
    }
    
    // Check for lack of decision maker engagement
    const hasDecisionMaker = signals.some(s => {
      const metadata = s.metadata as any;
      return metadata?.contactTitle?.includes("VP") || 
             metadata?.contactTitle?.includes("Director") ||
             metadata?.contactTitle?.includes("C-");
    });
    
    if (!hasDecisionMaker && signals.length > 5) {
      blockers.push({
        type: "no_decision_maker",
        severity: "medium",
        description: "No engagement from decision makers",
        recommendation: "Try to get introduced to senior stakeholders"
      });
    }
    
    // Check for competitor research
    const competitorSignals = signals.filter(s => s.signalType === "competitor_research");
    if (competitorSignals.length > 3) {
      blockers.push({
        type: "competitor_evaluation",
        severity: "medium",
        description: "Heavy competitor research detected",
        recommendation: "Highlight differentiators and unique value propositions"
      });
    }
    
    return blockers;
  }

  // Predict optimal timing for engagement
  async predictOptimalTiming(contactId: string): Promise<TimingOptimization> {
    const signals = await storage.getIntentSignals({ contactId, limit: 100 });
    
    // Analyze engagement patterns
    const hourlyEngagement = new Array(24).fill(0);
    const dayEngagement = new Array(7).fill(0);
    
    signals.forEach(signal => {
      const date = new Date(signal.detectedAt);
      hourlyEngagement[date.getHours()]++;
      dayEngagement[date.getDay()]++;
    });
    
    // Find best times
    const bestHour = hourlyEngagement.indexOf(Math.max(...hourlyEngagement));
    const bestDay = dayEngagement.indexOf(Math.max(...dayEngagement));
    
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bestCallTime = `${days[bestDay]} ${bestHour}:00`;
    const bestEmailTime = `${days[bestDay]} ${(bestHour + 1) % 24}:00`;
    const bestLinkedInTime = `${days[bestDay]} ${(bestHour + 2) % 24}:00`;
    
    // Create or update timing optimization
    const existing = await storage.getTimingOptimizationByContact(contactId);
    const timingData: InsertTimingOptimization = {
      contactId,
      bestCallTime,
      bestEmailTime,
      bestLinkedInTime,
      responsePatterns: {
        hourlyEngagement,
        dayEngagement,
        totalEngagements: signals.length
      },
      timezone: "UTC" // Default, would detect from actual data
    };
    
    if (existing) {
      const updated = await storage.updateTimingOptimization(existing.id, timingData);
      return updated!;
    } else {
      return await storage.createTimingOptimization(timingData);
    }
  }

  // Generate real-time micro-moments for engagement
  async generateMicroMoments(): Promise<any[]> {
    const recentSignals = await storage.getIntentSignals({ limit: 50 });
    const microMoments = [];
    
    // Group signals by company
    const companySignals = new Map<string, IntentSignal[]>();
    recentSignals.forEach(signal => {
      if (signal.companyId) {
        const signals = companySignals.get(signal.companyId) || [];
        signals.push(signal);
        companySignals.set(signal.companyId, signals);
      }
    });
    
    // Analyze each company for micro-moments
    for (const [companyId, signals] of companySignals.entries()) {
      const company = await storage.getCompany(companyId);
      if (!company) continue;
      
      // High-value micro-moment: Multiple signals in short time
      const recentCount = signals.filter(s => {
        const age = Date.now() - new Date(s.detectedAt).getTime();
        return age < 60 * 60 * 1000; // Last hour
      }).length;
      
      if (recentCount >= 3) {
        microMoments.push({
          type: "surge_in_activity",
          companyId,
          companyName: company.name,
          urgency: "high",
          action: "Immediate outreach",
          message: `${company.name} showing high engagement - ${recentCount} actions in the last hour`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Price checking micro-moment
      const priceCheck = signals.find(s => s.signalType === "price_check");
      if (priceCheck) {
        const age = Date.now() - new Date(priceCheck.detectedAt).getTime();
        if (age < 24 * 60 * 60 * 1000) { // Last 24 hours
          microMoments.push({
            type: "price_interest",
            companyId,
            companyName: company.name,
            urgency: "high",
            action: "Send pricing follow-up",
            message: `${company.name} recently viewed pricing - perfect time for pricing discussion`,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Demo request micro-moment
      const demoRequest = signals.find(s => s.signalType === "demo_request");
      if (demoRequest) {
        microMoments.push({
          type: "demo_requested",
          companyId,
          companyName: company.name,
          urgency: "critical",
          action: "Schedule demo immediately",
          message: `${company.name} requested a demo - schedule within 24 hours`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return microMoments.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }

  // Forecast deal outcome with win probability and close date
  async forecastDealOutcome(companyId: string): Promise<any> {
    const intelligence = await storage.getDealIntelligenceByCompany(companyId);
    const signals = await storage.getIntentSignals({ companyId, limit: 100 });
    const company = await storage.getCompany(companyId);
    
    if (!company) {
      throw new Error("Company not found");
    }
    
    // Calculate win probability based on multiple factors
    let winProbability = 50; // Base probability
    
    // Factor 1: Intent score
    const intentScore = await this.calculateIntentScore(companyId);
    winProbability += (intentScore - 50) * 0.3; // Adjust based on intent
    
    // Factor 2: Buying stage
    const stage = await this.predictBuyingStage(companyId);
    const stageBonus = {
      awareness: -20,
      consideration: -10,
      evaluation: 10,
      decision: 20,
      purchase: 30
    };
    winProbability += stageBonus[stage] || 0;
    
    // Factor 3: Champions vs Blockers
    const champions = await this.identifyChampions(companyId);
    const blockers = await this.detectBlockers(companyId);
    winProbability += (champions.length * 5) - (blockers.length * 10);
    
    // Factor 4: Engagement recency
    if (signals.length > 0) {
      const lastSignal = signals[0];
      const daysSinceLastEngagement = (Date.now() - new Date(lastSignal.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastEngagement < 3) winProbability += 10;
      else if (daysSinceLastEngagement > 14) winProbability -= 20;
    }
    
    // Normalize probability
    winProbability = Math.max(0, Math.min(100, Math.round(winProbability)));
    
    // Predict close date based on stage and velocity
    const stageToClose = {
      awareness: 90,
      consideration: 60,
      evaluation: 30,
      decision: 14,
      purchase: 7
    };
    const daysToClose = stageToClose[stage] || 60;
    const predictedCloseDate = new Date(Date.now() + daysToClose * 24 * 60 * 60 * 1000);
    
    // Predict deal size (mock calculation)
    const baseDealSize = company.size === "Enterprise" ? 100000 : 
                         company.size === "51-200" ? 50000 : 
                         company.size === "11-50" ? 25000 : 10000;
    const dealSizeMultiplier = 1 + (intentScore / 100);
    const predictedDealSize = Math.round(baseDealSize * dealSizeMultiplier);
    
    // Update or create deal intelligence
    const dealIntelligenceData: InsertDealIntelligence = {
      companyId,
      intentScore,
      buyingStage: stage,
      champions: champions,
      blockers: blockers,
      predictedCloseDate,
      predictedDealSize: predictedDealSize.toString(),
      winProbability,
      competitorMentions: this.extractCompetitorMentions(signals),
      budgetIndicators: this.extractBudgetIndicators(signals),
      timelineSignals: this.extractTimelineSignals(signals),
      decisionMakers: champions.filter(c => c.role?.includes("VP") || c.role?.includes("Director") || c.role?.includes("C-"))
    };
    
    if (intelligence) {
      await storage.updateDealIntelligence(intelligence.id, dealIntelligenceData);
    } else {
      await storage.createDealIntelligence(dealIntelligenceData);
    }
    
    return {
      winProbability,
      predictedCloseDate,
      predictedDealSize,
      buyingStage: stage,
      intentScore,
      riskFactors: blockers,
      positiveIndicators: champions.map(c => ({
        type: "champion",
        description: `${c.contact.firstName} ${c.contact.lastName} is highly engaged`,
        impact: "positive"
      })),
      recommendations: this.generateRecommendations(winProbability, stage, blockers)
    };
  }

  // Helper methods
  private calculateSignalStrength(signalType: string): number {
    return this.signalWeights[signalType] || 5;
  }

  private async updateCompanyIntelligence(companyId: string): Promise<void> {
    const intentScore = await this.calculateIntentScore(companyId);
    const buyingStage = await this.predictBuyingStage(companyId);
    
    const existing = await storage.getDealIntelligenceByCompany(companyId);
    if (existing) {
      await storage.updateDealIntelligence(existing.id, {
        intentScore,
        buyingStage,
        lastUpdated: new Date()
      });
    } else {
      await storage.createDealIntelligence({
        companyId,
        intentScore,
        buyingStage
      });
    }
  }

  private async checkMicroMoments(signal: IntentSignal): Promise<void> {
    // Check if this signal triggers any micro-moments
    if (signal.signalType === "demo_request" || signal.signalType === "contact_sales") {
      // Would trigger immediate notification/action
      console.log(`MICRO-MOMENT: High-value action detected from ${signal.contactId || signal.companyId}`);
    }
  }

  private extractCompetitorMentions(signals: IntentSignal[]): any {
    const mentions = signals.filter(s => s.signalType === "competitor_research");
    return {
      count: mentions.length,
      competitors: mentions.map(m => (m.metadata as any)?.competitorName).filter(Boolean),
      lastMention: mentions[0]?.detectedAt
    };
  }

  private extractBudgetIndicators(signals: IntentSignal[]): any {
    const priceChecks = signals.filter(s => s.signalType === "price_check" || s.signalType === "roi_calculator");
    return {
      hasBudgetInterest: priceChecks.length > 0,
      priceChecks: priceChecks.length,
      lastPriceCheck: priceChecks[0]?.detectedAt
    };
  }

  private extractTimelineSignals(signals: IntentSignal[]): any {
    const urgencySignals = signals.filter(s => 
      s.signalType === "demo_request" || 
      s.signalType === "contact_sales" ||
      s.signalStrength >= 8
    );
    return {
      urgencyLevel: urgencySignals.length > 3 ? "high" : urgencySignals.length > 0 ? "medium" : "low",
      urgentActions: urgencySignals.length,
      estimatedTimeline: urgencySignals.length > 3 ? "immediate" : "standard"
    };
  }

  private generateRecommendations(winProbability: number, stage: string, blockers: any[]): string[] {
    const recommendations = [];
    
    if (winProbability < 30) {
      recommendations.push("Schedule executive alignment meeting");
      recommendations.push("Offer proof of concept or pilot program");
    } else if (winProbability > 70) {
      recommendations.push("Accelerate deal closure with limited-time incentive");
      recommendations.push("Schedule implementation planning session");
    }
    
    if (stage === "awareness" || stage === "consideration") {
      recommendations.push("Share relevant case studies and success stories");
      recommendations.push("Offer educational webinar or workshop");
    } else if (stage === "evaluation" || stage === "decision") {
      recommendations.push("Provide detailed ROI analysis");
      recommendations.push("Connect with reference customers");
    }
    
    if (blockers.some(b => b.type === "no_decision_maker")) {
      recommendations.push("Request introduction to senior stakeholders");
    }
    
    if (blockers.some(b => b.type === "competitor_evaluation")) {
      recommendations.push("Schedule competitive differentiation session");
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const dealIntelligenceEngine = new DealIntelligenceEngine();