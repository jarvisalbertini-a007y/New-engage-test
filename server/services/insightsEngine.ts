import { storage } from "../storage";
import { type InsertInsight, type Insight, type Company } from "@shared/schema";

export interface TriggerData {
  companyId: string;
  type: string;
  data: any;
  source: string;
}

export async function generateInsight(trigger: TriggerData): Promise<Insight> {
  const company = await storage.getCompany(trigger.companyId);
  if (!company) throw new Error('Company not found');
  
  const insight = createInsightFromTrigger(trigger, company);
  return await storage.createInsight(insight);
}

export async function discoverInsights(): Promise<Insight[]> {
  // In a real implementation, this would connect to various data sources
  // For now, we'll simulate discovering insights
  
  const companies = await storage.getCompanies(20);
  const newInsights: Insight[] = [];
  
  for (const company of companies) {
    const insights = await simulateInsightDiscovery(company);
    for (const insight of insights) {
      newInsights.push(await storage.createInsight(insight));
    }
  }
  
  return newInsights;
}

export async function getRelevantInsights(companyId: string): Promise<Insight[]> {
  return await storage.getInsights({ companyId, limit: 10 });
}

export async function scoreInsightRelevance(insight: Insight, context: {
  targetPersona?: string;
  recentActivity?: boolean;
  companySize?: string;
}): Promise<number> {
  let score = 50; // Base relevance score
  
  // Time-based scoring (newer insights are more relevant)
  const ageInDays = (Date.now() - new Date(insight.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 7) score += 20;
  else if (ageInDays < 30) score += 10;
  else if (ageInDays > 90) score -= 20;
  
  // Insight type scoring
  switch (insight.type) {
    case 'funding':
      score += 30; // High relevance for sales
      break;
    case 'leadership_change':
      score += 25;
      break;
    case 'product_launch':
      score += 20;
      break;
    case 'hiring':
      score += 15;
      break;
    case 'news_mention':
      score += 10;
      break;
    default:
      score += 5;
  }
  
  // Context-based adjustments
  if (context.recentActivity) score += 15;
  
  // Confidence factor
  if (insight.confidence) {
    score += (parseFloat(insight.confidence) * 20);
  }
  
  return Math.max(0, Math.min(100, score));
}

function createInsightFromTrigger(trigger: TriggerData, company: Company): InsertInsight {
  const insightTemplates = {
    funding: {
      title: `${company.name} raised ${trigger.data.amount} ${trigger.data.round}`,
      description: `Perfect timing to reach out about scaling solutions - they have fresh capital to invest in growth initiatives`,
      confidence: "0.95",
      relevanceScore: 88
    },
    leadership_change: {
      title: `New ${trigger.data.role} at ${company.name}`,
      description: `${trigger.data.person} joined as ${trigger.data.role} - likely evaluating new tech stack and vendors`,
      confidence: "0.87",
      relevanceScore: 92
    },
    product_launch: {
      title: `${company.name} launched new product`,
      description: `${trigger.data.productName} launch suggests growth focus and potential need for supporting infrastructure`,
      confidence: "0.78",
      relevanceScore: 75
    },
    hiring: {
      title: `${company.name} is hiring ${trigger.data.roleCount} ${trigger.data.department} roles`,
      description: `Rapid hiring in ${trigger.data.department} indicates growth and potential need for productivity tools`,
      confidence: "0.82",
      relevanceScore: 70
    },
    acquisition: {
      title: `${company.name} acquired ${trigger.data.targetCompany}`,
      description: `Recent acquisition means integration challenges and potential need for unified systems`,
      confidence: "0.90",
      relevanceScore: 85
    },
    technology_adoption: {
      title: `${company.name} adopted ${trigger.data.technology}`,
      description: `New technology stack suggests they're modernizing and open to new solutions`,
      confidence: "0.75",
      relevanceScore: 68
    }
  };
  
  const template = insightTemplates[trigger.type as keyof typeof insightTemplates] || {
    title: `${company.name} - ${trigger.type}`,
    description: `New development detected at ${company.name}`,
    confidence: "0.50",
    relevanceScore: 50
  };
  
  return {
    companyId: trigger.companyId,
    type: trigger.type,
    title: template.title,
    description: template.description,
    source: trigger.source,
    confidence: template.confidence,
    relevanceScore: template.relevanceScore,
    actionable: true,
    data: trigger.data
  };
}

async function simulateInsightDiscovery(company: Company): Promise<InsertInsight[]> {
  const insights: InsertInsight[] = [];
  
  // Randomly generate some insights for demonstration
  const random = Math.random();
  
  if (random < 0.3) {
    // Funding insight
    insights.push({
      companyId: company.id,
      type: 'funding',
      title: `${company.name} raised $${Math.floor(Math.random() * 50 + 5)}M Series ${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}`,
      description: 'Perfect timing to reach out about scaling solutions - they have fresh capital to invest in growth initiatives',
      source: 'TechCrunch',
      confidence: "0.95",
      relevanceScore: 88,
      actionable: true,
      data: { amount: `$${Math.floor(Math.random() * 50 + 5)}M`, round: `Series ${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}` }
    });
  }
  
  if (random < 0.2) {
    // Leadership change
    const roles = ['CTO', 'VP of Sales', 'Head of Engineering', 'Chief Revenue Officer'];
    const names = ['Sarah Chen', 'Mike Johnson', 'Lisa Rodriguez', 'David Kim'];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    
    insights.push({
      companyId: company.id,
      type: 'leadership_change',
      title: `New ${role} at ${company.name}`,
      description: `${name} joined as ${role} - likely evaluating new tech stack and vendors`,
      source: 'LinkedIn',
      confidence: "0.87",
      relevanceScore: 92,
      actionable: true,
      data: { person: name, role }
    });
  }
  
  if (random < 0.15) {
    // Product launch
    insights.push({
      companyId: company.id,
      type: 'product_launch',
      title: `${company.name} launched new ${company.industry} solution`,
      description: 'Product launch suggests growth focus and potential need for supporting infrastructure',
      source: 'Company Blog',
      confidence: "0.78",
      relevanceScore: 75,
      actionable: true,
      data: { productName: `${company.industry} Platform 2.0` }
    });
  }
  
  return insights;
}

export async function generateInsightRecommendations(insightId: string): Promise<{
  messaging: string[];
  timing: string;
  channels: string[];
  nextSteps: string[];
}> {
  const insight = await storage.getInsight(insightId);
  if (!insight) throw new Error('Insight not found');
  
  const company = await storage.getCompany(insight.companyId!);
  if (!company) throw new Error('Company not found');
  
  const recommendations = {
    messaging: [
      `Reference their ${insight.type} in the opening line`,
      `Connect their growth to your value proposition`,
      `Mention specific benefits for ${company.industry} companies`,
      `Include social proof from similar companies`
    ],
    timing: getOptimalTiming(insight.type),
    channels: getRecommendedChannels(insight.type),
    nextSteps: [
      'Generate personalized email using this insight',
      'Add contact to relevant sequence',
      'Schedule follow-up task in 3 days',
      'Monitor for additional company signals'
    ]
  };
  
  return recommendations;
}

function getOptimalTiming(insightType: string): string {
  const timingMap: Record<string, string> = {
    funding: 'Within 2-4 weeks of announcement (gives time to settle, shows you\'re informed)',
    leadership_change: 'Within 1-2 weeks (new leaders are evaluating vendors)',
    product_launch: 'Within 1 week (momentum is high, infrastructure needs immediate)',
    hiring: 'Immediate (actively scaling, need productivity tools)',
    acquisition: 'Within 2-6 weeks (integration phase, need unified systems)',
    technology_adoption: 'Within 1-3 weeks (change momentum, open to new solutions)'
  };
  
  return timingMap[insightType] || 'Within 1-2 weeks of trigger event';
}

function getRecommendedChannels(insightType: string): string[] {
  const channelMap: Record<string, string[]> = {
    funding: ['email', 'linkedin', 'phone'],
    leadership_change: ['linkedin', 'email', 'phone'],
    product_launch: ['email', 'linkedin'],
    hiring: ['linkedin', 'email'],
    acquisition: ['email', 'phone', 'linkedin'],
    technology_adoption: ['email', 'linkedin']
  };
  
  return channelMap[insightType] || ['email', 'linkedin'];
}
