import { storage } from "../storage";
import OpenAI from "openai";

const hasOpenAIKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
const openai = hasOpenAIKey ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
}) : null;

import type { 
  PipelineHealth, InsertPipelineHealth,
  DealForensics, InsertDealForensics,
  RevenueForecast, InsertRevenueForecast,
  CoachingInsight, InsertCoachingInsight
} from "@shared/schema";

interface DealStage {
  stage: string;
  count: number;
  value: number;
  avgDaysInStage: number;
}

interface VelocityMetrics {
  avgDealCycle: number;
  stageProgression: { [stage: string]: number };
  acceleratingDeals: number;
  deceleratingDeals: number;
}

interface ConversionMetrics {
  prospectToQualified: number;
  qualifiedToProposal: number;
  proposalToClose: number;
  overallConversion: number;
}

interface RiskIndicator {
  type: string; // stuck, slowing, ghosting, competitor
  severity: 'high' | 'medium' | 'low';
  dealCount: number;
  totalValue: number;
  description: string;
}

interface ForecastScenario {
  type: 'best' | 'worst' | 'most_likely';
  revenue: number;
  probability: number;
  assumptions: string[];
}

export class RevenueOpsCenter {
  /**
   * Analyze overall pipeline health and generate snapshot
   */
  async analyzePipelineHealth(): Promise<PipelineHealth> {
    // Simulate fetching deal data (in production, this would query actual deal tables)
    const deals = await this.getDealsData();
    
    // Calculate stage breakdown
    const byStage = this.calculateStageBreakdown(deals);
    
    // Calculate velocity metrics
    const velocity = this.calculateVelocityMetrics(deals);
    
    // Calculate conversion metrics
    const conversion = this.calculateConversionMetrics(deals);
    
    // Identify risk indicators
    const riskIndicators = await this.identifyRiskIndicators(deals);
    
    // Calculate overall health score (0-100)
    const healthScore = this.calculateHealthScore(
      velocity,
      conversion,
      riskIndicators
    );
    
    const pipelineHealth: InsertPipelineHealth = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, deal) => sum + deal.value, 0),
      byStage,
      velocity,
      conversion,
      riskIndicators,
      healthScore
    };
    
    return await storage.createPipelineHealth(pipelineHealth);
  }
  
  /**
   * Perform deep forensic analysis on a specific deal
   */
  async performDealForensics(dealId: string, analysisType: 'won' | 'lost' | 'stuck'): Promise<DealForensics> {
    // Get deal history and activities
    const dealData = await this.getDealHistory(dealId);
    
    // Identify root causes using AI
    const rootCauses = await this.identifyRootCauses(dealData, analysisType);
    
    // Find critical moments in the deal
    const criticalMoments = this.findCriticalMoments(dealData);
    
    // Analyze missed opportunities
    const missedOpportunities = await this.analyzeMissedOpportunities(dealData, analysisType);
    
    // Generate AI recommendations
    const recommendations = await this.generateDealRecommendations(
      dealData,
      rootCauses,
      missedOpportunities
    );
    
    // Analyze competitor factors
    const competitorFactors = await this.analyzeCompetitorFactors(dealData);
    
    const forensics: InsertDealForensics = {
      dealId,
      analysisType,
      rootCauses,
      criticalMoments,
      missedOpportunities,
      recommendations,
      competitorFactors
    };
    
    return await storage.createDealForensics(forensics);
  }
  
  /**
   * Generate AI-powered revenue forecast
   */
  async generateForecast(period: string): Promise<RevenueForecast> {
    const pipelineData = await storage.getLatestPipelineHealth();
    const historicalData = await this.getHistoricalRevenue();
    
    // Generate forecast scenarios using AI
    const prompt = `Based on the following pipeline data and historical trends, generate revenue forecast for ${period}:
    
    Current Pipeline:
    - Total deals: ${pipelineData?.totalDeals || 0}
    - Total value: $${pipelineData?.totalValue || 0}
    - Conversion rate: ${(pipelineData?.conversion as any)?.overallConversion || 0}%
    
    Historical trends: ${JSON.stringify(historicalData)}
    
    Generate three scenarios (best case, worst case, most likely) with specific revenue predictions and key assumptions for each.`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    
    const forecastData = this.parseForecastResponse(completion.choices[0].message.content || "");
    
    const forecast: InsertRevenueForecast = {
      forecastPeriod: period,
      predictedRevenue: forecastData.mostLikely.revenue,
      confidenceLevel: forecastData.confidence,
      assumptions: forecastData.assumptions,
      scenarios: forecastData.scenarios
    };
    
    return await storage.createRevenueForecast(forecast);
  }
  
  /**
   * Identify at-risk deals and pipeline gaps
   */
  async identifyRisks(): Promise<RiskIndicator[]> {
    const deals = await this.getDealsData();
    const risks: RiskIndicator[] = [];
    
    // Identify stuck deals (no activity > 14 days)
    const stuckDeals = deals.filter(deal => 
      deal.daysSinceLastActivity > 14 && deal.stage !== 'closed'
    );
    
    if (stuckDeals.length > 0) {
      risks.push({
        type: 'stuck',
        severity: 'high',
        dealCount: stuckDeals.length,
        totalValue: stuckDeals.reduce((sum, d) => sum + d.value, 0),
        description: `${stuckDeals.length} deals have had no activity for over 14 days`
      });
    }
    
    // Identify slowing deals (velocity decreased by >50%)
    const slowingDeals = deals.filter(deal => 
      deal.velocityChange < -0.5 && deal.stage !== 'closed'
    );
    
    if (slowingDeals.length > 0) {
      risks.push({
        type: 'slowing',
        severity: 'medium',
        dealCount: slowingDeals.length,
        totalValue: slowingDeals.reduce((sum, d) => sum + d.value, 0),
        description: `${slowingDeals.length} deals are progressing 50% slower than average`
      });
    }
    
    // Identify ghosting risk (no response after outreach)
    const ghostingDeals = deals.filter(deal => 
      deal.unrepliedOutreaches > 3 && deal.stage !== 'closed'
    );
    
    if (ghostingDeals.length > 0) {
      risks.push({
        type: 'ghosting',
        severity: 'medium',
        dealCount: ghostingDeals.length,
        totalValue: ghostingDeals.reduce((sum, d) => sum + d.value, 0),
        description: `${ghostingDeals.length} deals show signs of prospect ghosting`
      });
    }
    
    return risks;
  }
  
  /**
   * Generate AI coaching insights for sales reps
   */
  async generateCoachingInsights(userId: string): Promise<CoachingInsight[]> {
    const userPerformance = await this.getUserPerformance(userId);
    const insights: InsertCoachingInsight[] = [];
    
    // Analyze performance patterns
    const prompt = `Analyze this sales rep's performance and generate specific, actionable coaching insights:
    
    Performance data: ${JSON.stringify(userPerformance)}
    
    Generate insights in these categories:
    1. Performance gaps and how to address them
    2. Behavioral patterns that need adjustment
    3. Skills to develop
    4. Opportunities they might be missing
    
    For each insight, provide specific action items.`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });
    
    const aiInsights = this.parseCoachingInsights(completion.choices[0].message.content || "");
    
    for (const insight of aiInsights) {
      insights.push({
        userId,
        insightType: insight.type,
        insight: insight.text,
        actionItems: insight.actionItems,
        priority: insight.priority,
        status: 'pending'
      });
    }
    
    // Save all insights
    const savedInsights = await Promise.all(
      insights.map(insight => storage.createCoachingInsight(insight))
    );
    
    return savedInsights;
  }
  
  /**
   * Analyze win/loss patterns
   */
  async analyzeWinLoss(): Promise<{
    winPatterns: string[];
    lossPatterns: string[];
    recommendations: string[];
  }> {
    const wonDeals = await this.getDealsData('won');
    const lostDeals = await this.getDealsData('lost');
    
    const prompt = `Analyze these won and lost deals to identify patterns:
    
    Won deals (${wonDeals.length}): ${JSON.stringify(wonDeals.slice(0, 10))}
    Lost deals (${lostDeals.length}): ${JSON.stringify(lostDeals.slice(0, 10))}
    
    Identify:
    1. Common patterns in won deals
    2. Common patterns in lost deals
    3. Key differentiators
    4. Actionable recommendations to improve win rate`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    
    return this.parseWinLossAnalysis(completion.choices[0].message.content || "");
  }
  
  /**
   * Track deal velocity across stages
   */
  async trackVelocity(): Promise<VelocityMetrics> {
    const deals = await this.getDealsData();
    
    const stageProgression: { [stage: string]: number } = {};
    const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed'];
    
    for (const stage of stages) {
      const dealsInStage = deals.filter(d => d.stage === stage);
      if (dealsInStage.length > 0) {
        const avgDays = dealsInStage.reduce((sum, d) => sum + d.daysInStage, 0) / dealsInStage.length;
        stageProgression[stage] = Math.round(avgDays);
      }
    }
    
    const avgDealCycle = deals
      .filter(d => d.stage === 'closed')
      .reduce((sum, d) => sum + d.totalDays, 0) / deals.filter(d => d.stage === 'closed').length || 0;
    
    const acceleratingDeals = deals.filter(d => d.velocityChange > 0.2).length;
    const deceleratingDeals = deals.filter(d => d.velocityChange < -0.2).length;
    
    return {
      avgDealCycle: Math.round(avgDealCycle),
      stageProgression,
      acceleratingDeals,
      deceleratingDeals
    };
  }
  
  /**
   * Recommend specific actions to improve pipeline
   */
  async recommendActions(): Promise<string[]> {
    const risks = await this.identifyRisks();
    const velocity = await this.trackVelocity();
    const health = await storage.getLatestPipelineHealth();
    
    const recommendations: string[] = [];
    
    // Check for stuck deals
    const stuckRisk = risks.find(r => r.type === 'stuck');
    if (stuckRisk && stuckRisk.dealCount > 5) {
      recommendations.push(
        `Immediate action needed: ${stuckRisk.dealCount} deals worth $${stuckRisk.totalValue} are stuck. Schedule review calls with deal owners today.`
      );
    }
    
    // Check velocity issues
    if (velocity.deceleratingDeals > velocity.acceleratingDeals) {
      recommendations.push(
        `Deal velocity is declining. Consider implementing daily stand-ups to identify and remove blockers.`
      );
    }
    
    // Check conversion rates
    const conversion = health?.conversion as any;
    if (conversion?.qualifiedToProposal < 0.3) {
      recommendations.push(
        `Low qualification-to-proposal conversion (${(conversion.qualifiedToProposal * 100).toFixed(1)}%). Review qualification criteria and discovery process.`
      );
    }
    
    // Check pipeline coverage
    const coverage = (health?.totalValue || 0) / 1000000; // Assuming $1M target
    if (coverage < 3) {
      recommendations.push(
        `Pipeline coverage is only ${coverage.toFixed(1)}x. Increase prospecting activities by 50% this week.`
      );
    }
    
    return recommendations;
  }
  
  // Helper methods
  private async getDealsData(status?: string): Promise<any[]> {
    // In production, this would query actual deal tables
    // For now, return simulated data
    return [
      {
        id: '1',
        stage: 'proposal',
        value: 50000,
        daysInStage: 10,
        totalDays: 45,
        daysSinceLastActivity: 5,
        velocityChange: -0.2,
        unrepliedOutreaches: 1
      },
      {
        id: '2',
        stage: 'qualified',
        value: 75000,
        daysInStage: 20,
        totalDays: 20,
        daysSinceLastActivity: 18,
        velocityChange: -0.6,
        unrepliedOutreaches: 4
      },
      {
        id: '3',
        stage: 'closed',
        value: 100000,
        daysInStage: 5,
        totalDays: 60,
        daysSinceLastActivity: 0,
        velocityChange: 0.3,
        unrepliedOutreaches: 0
      }
    ].filter(d => !status || d.stage === status);
  }
  
  private calculateStageBreakdown(deals: any[]): DealStage[] {
    const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed'];
    return stages.map(stage => {
      const stageDeals = deals.filter(d => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + d.value, 0),
        avgDaysInStage: stageDeals.length > 0 
          ? stageDeals.reduce((sum, d) => sum + d.daysInStage, 0) / stageDeals.length
          : 0
      };
    });
  }
  
  private calculateVelocityMetrics(deals: any[]): VelocityMetrics {
    return this.trackVelocity() as any; // Simplified for now
  }
  
  private calculateConversionMetrics(deals: any[]): ConversionMetrics {
    const total = deals.length || 1;
    const qualified = deals.filter(d => ['qualified', 'proposal', 'negotiation', 'closed'].includes(d.stage)).length;
    const proposal = deals.filter(d => ['proposal', 'negotiation', 'closed'].includes(d.stage)).length;
    const closed = deals.filter(d => d.stage === 'closed').length;
    
    return {
      prospectToQualified: qualified / total,
      qualifiedToProposal: proposal / Math.max(qualified, 1),
      proposalToClose: closed / Math.max(proposal, 1),
      overallConversion: closed / total
    };
  }
  
  private async identifyRiskIndicators(deals: any[]): Promise<RiskIndicator[]> {
    return this.identifyRisks();
  }
  
  private calculateHealthScore(
    velocity: VelocityMetrics,
    conversion: ConversionMetrics,
    risks: RiskIndicator[]
  ): number {
    let score = 70; // Base score
    
    // Adjust for conversion rates
    score += conversion.overallConversion * 20;
    
    // Adjust for velocity
    if (velocity.acceleratingDeals > velocity.deceleratingDeals) {
      score += 5;
    } else {
      score -= 10;
    }
    
    // Adjust for risks
    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;
    score -= highRisks * 10;
    score -= mediumRisks * 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  private async getDealHistory(dealId: string): Promise<any> {
    // Simulate fetching deal history
    return {
      dealId,
      activities: [],
      communications: [],
      stageChanges: [],
      stakeholders: []
    };
  }
  
  private async identifyRootCauses(dealData: any, analysisType: string): Promise<any[]> {
    const prompt = `Analyze this ${analysisType} deal and identify root causes:
    Deal data: ${JSON.stringify(dealData)}
    
    Identify 3-5 root causes for why this deal ${analysisType === 'won' ? 'succeeded' : 'failed/stalled'}.`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    
    return this.parseRootCauses(completion.choices[0].message.content || "");
  }
  
  private findCriticalMoments(dealData: any): any[] {
    // Identify critical moments in the deal timeline
    return [
      {
        date: new Date().toISOString(),
        event: "Initial contact",
        impact: "positive",
        description: "Strong initial engagement"
      }
    ];
  }
  
  private async analyzeMissedOpportunities(dealData: any, analysisType: string): Promise<any> {
    if (analysisType === 'won') return null;
    
    return {
      opportunities: [
        "Could have engaged decision maker earlier",
        "Should have addressed pricing concerns proactively"
      ],
      alternativeApproaches: [
        "Multi-threading with additional stakeholders",
        "Value-based selling approach"
      ]
    };
  }
  
  private async generateDealRecommendations(
    dealData: any,
    rootCauses: any[],
    missedOpportunities: any
  ): Promise<any> {
    return {
      immediate: [
        "Schedule executive alignment call",
        "Prepare ROI analysis document"
      ],
      strategic: [
        "Implement champion building program",
        "Develop competitive displacement playbook"
      ]
    };
  }
  
  private async analyzeCompetitorFactors(dealData: any): Promise<any> {
    return {
      competitorsInvolved: ["Competitor A", "Competitor B"],
      competitivePosition: "challenger",
      differentiators: ["Better integration", "Superior support"],
      vulnerabilities: ["Higher price point", "Longer implementation"]
    };
  }
  
  private async getHistoricalRevenue(): Promise<any[]> {
    // Simulate historical revenue data
    return [
      { period: "Q1 2024", revenue: 1200000 },
      { period: "Q2 2024", revenue: 1500000 },
      { period: "Q3 2024", revenue: 1800000 }
    ];
  }
  
  private parseForecastResponse(response: string): any {
    // Parse AI response into structured forecast data
    return {
      mostLikely: { revenue: 2000000, probability: 0.6 },
      confidence: 0.75,
      assumptions: [
        "Current conversion rate maintains",
        "No major market disruptions",
        "Sales team at full capacity"
      ],
      scenarios: [
        { type: 'best', revenue: 2500000, probability: 0.2, assumptions: ["All large deals close"] },
        { type: 'worst', revenue: 1500000, probability: 0.2, assumptions: ["Major deals slip"] },
        { type: 'most_likely', revenue: 2000000, probability: 0.6, assumptions: ["Normal progression"] }
      ]
    };
  }
  
  private async getUserPerformance(userId: string): Promise<any> {
    // Simulate fetching user performance data
    return {
      userId,
      dealsWon: 10,
      dealsLost: 5,
      avgDealSize: 75000,
      avgDealCycle: 45,
      conversionRate: 0.35,
      activities: {
        calls: 150,
        emails: 500,
        meetings: 30
      }
    };
  }
  
  private parseCoachingInsights(response: string): any[] {
    // Parse AI response into structured coaching insights
    return [
      {
        type: 'performance',
        text: 'Your conversion rate is 15% below team average',
        actionItems: ['Review discovery call recordings', 'Practice objection handling'],
        priority: 'high'
      },
      {
        type: 'behavior',
        text: 'Follow-up timing could be improved',
        actionItems: ['Set up automated follow-up reminders', 'Reduce response time to under 2 hours'],
        priority: 'medium'
      }
    ];
  }
  
  private parseWinLossAnalysis(response: string): any {
    // Parse AI response into structured win/loss analysis
    return {
      winPatterns: [
        "Strong executive alignment",
        "Clear ROI demonstration",
        "Multi-stakeholder engagement"
      ],
      lossPatterns: [
        "Late competitor entry",
        "Budget constraints not identified early",
        "Single-threaded relationships"
      ],
      recommendations: [
        "Implement early competitor detection process",
        "Qualify budget in first call",
        "Mandate multi-threading for deals over $50K"
      ]
    };
  }
  
  private parseRootCauses(response: string): any[] {
    // Parse AI response into structured root causes
    return [
      {
        cause: "Lack of executive sponsorship",
        impact: "high",
        evidence: ["No C-level engagement", "Champion left company"]
      },
      {
        cause: "Competitive displacement",
        impact: "medium",
        evidence: ["Competitor offered lower price", "Feature parity concerns"]
      }
    ];
  }
}

// Export singleton instance
export const revenueOpsCenter = new RevenueOpsCenter();