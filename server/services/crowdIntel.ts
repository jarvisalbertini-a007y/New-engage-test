import { storage } from "../storage";
import { 
  type SharedIntel, 
  type InsertSharedIntel, 
  type IntelContribution,
  type InsertIntelContribution,
  type IntelRating,
  type InsertIntelRating,
  type BenchmarkData,
  type InsertBenchmarkData,
} from "@shared/schema";
import crypto from "crypto";

interface IntelContext {
  industry?: string;
  companySize?: string;
  category?: string;
  tags?: string[];
}

interface PerformanceMetrics {
  openRate?: number;
  replyRate?: number;
  conversionRate?: number;
  successRate?: number;
  sampleSize?: number;
}

export class CrowdIntelNetwork {
  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  /**
   * Anonymize data by removing identifying information
   */
  anonymizeData(data: any): any {
    const anonymized = JSON.parse(JSON.stringify(data));
    
    // Remove company-specific information
    const sensitiveFields = [
      'companyName', 'company', 'contactName', 'contactEmail', 
      'firstName', 'lastName', 'email', 'phone', 'phoneNumber',
      'linkedinUrl', 'website', 'domain', 'address'
    ];
    
    const removeFields = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const field of sensitiveFields) {
        delete obj[field];
      }
      
      // Replace specific company/person names in text content
      if (obj.content && typeof obj.content === 'string') {
        obj.content = obj.content
          .replace(/([A-Z][a-z]+ [A-Z][a-z]+)/g, '[Name]')
          .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[email]')
          .replace(/(\+?[1-9]\d{1,14})/g, '[phone]');
      }
      
      // Recursively clean nested objects
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          removeFields(obj[key]);
        }
      }
    };
    
    removeFields(anonymized);
    return anonymized;
  }

  /**
   * Contribute intel to the network
   */
  async contributeIntel(
    userId: string,
    data: {
      category: string;
      content: any;
      effectiveness?: number;
      industry?: string;
      companySize?: string;
      tags?: string[];
      performanceData?: PerformanceMetrics;
    }
  ): Promise<SharedIntel> {
    const hashedUserId = this.hashUserId(userId);
    const anonymizedContent = this.anonymizeData(data.content);
    
    // Check if similar intel already exists
    const existingIntel = await this.findSimilarPatterns({
      category: data.category,
      industry: data.industry,
      companySize: data.companySize
    });
    
    let intel: SharedIntel;
    
    if (existingIntel.length > 0 && this.isSimilarContent(existingIntel[0].content, anonymizedContent)) {
      // Update existing intel
      intel = await this.improveExistingIntel(existingIntel[0].id, data.performanceData || {});
      
      // Record contribution
      await storage.createIntelContribution({
        intelId: intel.id,
        userId: hashedUserId,
        contributionType: 'improved',
        performanceData: data.performanceData || {}
      });
    } else {
      // Create new intel
      intel = await storage.createSharedIntel({
        category: data.category,
        content: anonymizedContent,
        effectiveness: data.effectiveness || null,
        industry: data.industry || null,
        companySize: data.companySize || null,
        tags: data.tags || null,
        successRate: data.performanceData?.successRate || null
      });
      
      // Record contribution
      await storage.createIntelContribution({
        intelId: intel.id,
        userId: hashedUserId,
        contributionType: 'created',
        performanceData: data.performanceData || {}
      });
    }
    
    return intel;
  }

  /**
   * Check if two pieces of content are similar
   */
  private isSimilarContent(content1: any, content2: any): boolean {
    const str1 = JSON.stringify(content1).toLowerCase();
    const str2 = JSON.stringify(content2).toLowerCase();
    
    // Simple similarity check - can be improved with better algorithms
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));
    
    return commonWords.length / Math.max(words1.length, words2.length) > 0.7;
  }

  /**
   * Improve existing intel with new performance data
   */
  private async improveExistingIntel(
    intelId: string,
    performanceData: PerformanceMetrics
  ): Promise<SharedIntel> {
    const intel = await storage.getSharedIntel(intelId);
    if (!intel) throw new Error('Intel not found');
    
    // Update metrics with weighted average
    const updates: Partial<SharedIntel> = {
      contributorCount: (intel.contributorCount || 1) + 1,
      useCount: (intel.useCount || 0) + 1
    };
    
    if (performanceData.successRate !== undefined && intel.successRate !== null) {
      const currentWeight = intel.contributorCount || 1;
      const newWeight = 1;
      const weightedAvg = (
        (Number(intel.successRate) * currentWeight + performanceData.successRate * newWeight) / 
        (currentWeight + newWeight)
      );
      updates.successRate = String(weightedAvg.toFixed(2));
    }
    
    if (performanceData.openRate !== undefined && intel.effectiveness !== null) {
      const currentWeight = intel.contributorCount || 1;
      const newWeight = 1;
      const weightedAvg = (
        (Number(intel.effectiveness) * currentWeight + performanceData.openRate * newWeight) / 
        (currentWeight + newWeight)
      );
      updates.effectiveness = String(weightedAvg.toFixed(2));
    }
    
    return await storage.updateSharedIntel(intelId, updates) || intel;
  }

  /**
   * Aggregate benchmarks from crowd data
   */
  async aggregateBenchmarks(): Promise<void> {
    // Get all contributions from the last 30 days
    const contributions = await storage.getIntelContributions({ limit: 1000 });
    
    // Group by metric, industry, and company size
    const metrics = ['open_rate', 'reply_rate', 'conversion_rate'];
    const industries = ['SaaS', 'Fintech', 'Healthcare', 'Ecommerce', 'Enterprise'];
    const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
    const channels = ['email', 'phone', 'linkedin'];
    
    for (const metric of metrics) {
      for (const industry of industries) {
        for (const companySize of companySizes) {
          for (const channel of channels) {
            const relevantData = contributions.filter(c => {
              const data = c.performanceData as any;
              return data && 
                data[metric] !== undefined &&
                data.industry === industry &&
                data.companySize === companySize &&
                data.channel === channel;
            });
            
            if (relevantData.length > 0) {
              const values = relevantData.map(d => (d.performanceData as any)[metric]);
              const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
              
              // Check if benchmark exists
              const existing = await storage.getBenchmarkDataList({
                metric,
                industry,
                companySize,
                channel,
                limit: 1
              });
              
              if (existing.length > 0) {
                await storage.updateBenchmarkData(existing[0].id, {
                  value: String(avgValue.toFixed(4)),
                  sampleSize: relevantData.length
                });
              } else {
                await storage.createBenchmarkData({
                  metric,
                  industry,
                  companySize,
                  channel,
                  value: String(avgValue.toFixed(4)),
                  sampleSize: relevantData.length
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Find similar patterns based on context
   */
  async findSimilarPatterns(context: IntelContext): Promise<SharedIntel[]> {
    const filters: any = {
      limit: 20
    };
    
    if (context.category) filters.category = context.category;
    if (context.industry) filters.industry = context.industry;
    if (context.companySize) filters.companySize = context.companySize;
    if (context.tags && context.tags.length > 0) filters.tags = context.tags;
    
    const results = await storage.getSharedIntelList(filters);
    
    // Sort by effectiveness and success rate
    return results.sort((a, b) => {
      const scoreA = (Number(a.effectiveness || 0) + Number(a.successRate || 0)) / 2;
      const scoreB = (Number(b.effectiveness || 0) + Number(b.successRate || 0)) / 2;
      return scoreB - scoreA;
    });
  }

  /**
   * Enhance content with crowd wisdom
   */
  async improveFromCrowd(
    content: any,
    context: IntelContext
  ): Promise<any> {
    const similarPatterns = await this.findSimilarPatterns(context);
    
    if (similarPatterns.length === 0) {
      return content;
    }
    
    // Get the top performing patterns
    const topPatterns = similarPatterns.slice(0, 3);
    
    // Extract successful elements from top patterns
    const improvements = {
      suggestedElements: [] as string[],
      bestPractices: [] as string[],
      avoidancePatterns: [] as string[]
    };
    
    for (const pattern of topPatterns) {
      const patternContent = pattern.content as any;
      
      // Extract key elements (this is simplified - in reality would use NLP)
      if (patternContent.subject && !content.subject) {
        improvements.suggestedElements.push(`Subject line: ${patternContent.subject}`);
      }
      
      if (patternContent.opening && !content.opening) {
        improvements.suggestedElements.push(`Opening: ${patternContent.opening}`);
      }
      
      if (patternContent.callToAction && !content.callToAction) {
        improvements.suggestedElements.push(`CTA: ${patternContent.callToAction}`);
      }
      
      // Add best practices based on success rates
      if (Number(pattern.successRate || 0) > 70) {
        improvements.bestPractices.push(
          `Pattern with ${pattern.successRate}% success rate includes: ${
            JSON.stringify(patternContent).substring(0, 100)
          }...`
        );
      }
    }
    
    return {
      original: content,
      improvements,
      topSimilarPatterns: topPatterns.map(p => ({
        content: p.content,
        effectiveness: p.effectiveness,
        successRate: p.successRate
      }))
    };
  }

  /**
   * Calculate effectiveness of intel
   */
  async calculateEffectiveness(intelId: string): Promise<number> {
    const intel = await storage.getSharedIntel(intelId);
    if (!intel) return 0;
    
    // Get all ratings for this intel
    const ratings = await storage.getIntelRatings({ intelId });
    if (ratings.length === 0) {
      return Number(intel.effectiveness || 0);
    }
    
    // Calculate weighted effectiveness
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    const normalizedRating = (avgRating / 5) * 100;
    
    // Combine with existing effectiveness (if any)
    const existingEffectiveness = Number(intel.effectiveness || 0);
    const combinedEffectiveness = existingEffectiveness 
      ? (existingEffectiveness + normalizedRating) / 2 
      : normalizedRating;
    
    // Update the intel record
    await storage.updateSharedIntel(intelId, {
      effectiveness: String(combinedEffectiveness.toFixed(2))
    });
    
    return combinedEffectiveness;
  }

  /**
   * Recommend intel based on user context
   */
  async recommendIntel(
    userContext: {
      userId: string;
      industry?: string;
      companySize?: string;
      recentCategories?: string[];
      performanceGoals?: PerformanceMetrics;
    }
  ): Promise<SharedIntel[]> {
    const recommendations: SharedIntel[] = [];
    
    // Get intel matching user's industry and company size
    const contextMatches = await this.findSimilarPatterns({
      industry: userContext.industry,
      companySize: userContext.companySize
    });
    
    // Filter by recent categories if provided
    if (userContext.recentCategories && userContext.recentCategories.length > 0) {
      const categoryMatches = contextMatches.filter(intel => 
        userContext.recentCategories?.includes(intel.category)
      );
      recommendations.push(...categoryMatches.slice(0, 5));
    }
    
    // Get high-performing intel that exceeds performance goals
    if (userContext.performanceGoals) {
      const highPerformers = contextMatches.filter(intel => {
        const goals = userContext.performanceGoals!;
        
        if (goals.successRate && intel.successRate) {
          return Number(intel.successRate) >= goals.successRate;
        }
        
        if (goals.openRate && intel.effectiveness) {
          return Number(intel.effectiveness) >= goals.openRate;
        }
        
        return false;
      });
      
      recommendations.push(...highPerformers.slice(0, 5));
    }
    
    // Add top-rated intel across all categories
    const allIntel = await storage.getSharedIntelList({ limit: 100 });
    const topRated = allIntel
      .filter(intel => Number(intel.effectiveness || 0) > 80)
      .sort((a, b) => Number(b.effectiveness || 0) - Number(a.effectiveness || 0))
      .slice(0, 3);
    
    recommendations.push(...topRated);
    
    // Remove duplicates and return top 10
    const uniqueRecommendations = Array.from(
      new Map(recommendations.map(item => [item.id, item])).values()
    );
    
    return uniqueRecommendations.slice(0, 10);
  }

  /**
   * Rate intel
   */
  async rateIntel(
    userId: string,
    intelId: string,
    rating: number,
    feedback?: string,
    usefulnessScore?: number
  ): Promise<IntelRating> {
    const hashedUserId = this.hashUserId(userId);
    
    // Check if user already rated this intel
    const existingRatings = await storage.getIntelRatings({
      intelId,
      userId: hashedUserId,
      limit: 1
    });
    
    if (existingRatings.length > 0) {
      // Update existing rating
      return await storage.updateIntelRating(existingRatings[0].id, {
        rating,
        feedback,
        usefulnessScore
      }) || existingRatings[0];
    }
    
    // Create new rating
    const newRating = await storage.createIntelRating({
      intelId,
      userId: hashedUserId,
      rating,
      feedback: feedback || null,
      usefulnessScore: usefulnessScore || null
    });
    
    // Recalculate effectiveness
    await this.calculateEffectiveness(intelId);
    
    return newRating;
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<{
    totalIntel: number;
    totalContributors: number;
    avgSuccessRate: number;
    topCategories: { category: string; count: number }[];
    industryBenchmarks: BenchmarkData[];
  }> {
    const allIntel = await storage.getSharedIntelList({ limit: 1000 });
    const contributions = await storage.getIntelContributions({ limit: 1000 });
    const benchmarks = await storage.getBenchmarkDataList({ limit: 20 });
    
    // Calculate unique contributors
    const uniqueContributors = new Set(contributions.map(c => c.userId)).size;
    
    // Calculate average success rate
    const successRates = allIntel
      .filter(i => i.successRate !== null)
      .map(i => Number(i.successRate));
    const avgSuccessRate = successRates.length > 0 
      ? successRates.reduce((a, b) => a + b, 0) / successRates.length 
      : 0;
    
    // Count by category
    const categoryCounts = new Map<string, number>();
    for (const intel of allIntel) {
      const count = categoryCounts.get(intel.category) || 0;
      categoryCounts.set(intel.category, count + 1);
    }
    
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalIntel: allIntel.length,
      totalContributors: uniqueContributors,
      avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      topCategories,
      industryBenchmarks: benchmarks
    };
  }
}

export const crowdIntelNetwork = new CrowdIntelNetwork();