import { openAIClient } from "./openaiClient";
import { storage } from "../storage";

export interface CompanyResearchResult {
  name: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  valueProposition: string;
  differentiators: string[];
  competitors: string[];
  targetMarkets: string[];
  products: string[];
  keyPainPoints: string[];
  typicalBuyers: {
    title: string;
    industry: string;
    sizeRange: string;
  }[];
}

export interface ICPSuggestion {
  industries: string[];
  companySizes: string[];
  roles: string[];
  regions?: string[];
}

export interface PersonaSuggestion {
  title: string;
  industry: string;
  companySize: string;
  pains: string[];
  goals: string[];
  valueProps: string[];
  proofPoints: string[];
  communicationStyle: string;
}

const AI_RATE_LIMIT = {
  maxCallsPerMinute: 10,
  calls: [] as number[]
};

async function checkRateLimit(): Promise<boolean> {
  const now = Date.now();
  AI_RATE_LIMIT.calls = AI_RATE_LIMIT.calls.filter(t => now - t < 60000);
  if (AI_RATE_LIMIT.calls.length >= AI_RATE_LIMIT.maxCallsPerMinute) {
    return false;
  }
  AI_RATE_LIMIT.calls.push(now);
  return true;
}

function extractDomain(websiteUrl: string): string {
  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
    return url.hostname.replace('www.', '');
  } catch {
    return websiteUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

export async function researchCompany(websiteUrl: string): Promise<CompanyResearchResult> {
  if (!await checkRateLimit()) {
    throw new Error('AI rate limit exceeded. Please wait a moment and try again.');
  }
  
  const domain = extractDomain(websiteUrl);
  
  const prompt = `Research this company based on their website URL: ${websiteUrl}

Analyze and provide detailed information about:
1. Company name
2. Industry/sector
3. Company size estimate (1-10, 11-50, 51-200, 201-1000, 1000+)
4. What they do (brief description)
5. Their main value proposition
6. Key differentiators from competitors
7. Main competitors (3-5)
8. Target markets they serve
9. Main products/services
10. Common pain points their customers have
11. Typical buyer personas (title, industry, company size)

Return as JSON with this structure:
{
  "name": "Company Name",
  "domain": "${domain}",
  "industry": "Industry",
  "size": "11-50",
  "description": "What they do",
  "valueProposition": "Main value prop",
  "differentiators": ["diff1", "diff2"],
  "competitors": ["comp1", "comp2"],
  "targetMarkets": ["market1", "market2"],
  "products": ["product1", "product2"],
  "keyPainPoints": ["pain1", "pain2"],
  "typicalBuyers": [{"title": "VP Sales", "industry": "SaaS", "sizeRange": "11-50"}]
}`;

  const systemPrompt = `You are a business analyst expert. Analyze company websites and provide structured research data. Return only valid JSON matching the requested structure.`;

  const response = await openAIClient.generateJSON<CompanyResearchResult>(
    prompt,
    systemPrompt,
    {
      feature: 'company-research',
      model: 'gpt-4o-mini' as any,
      temperature: 0.7,
      maxTokens: 2000,
      fallback: {
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        domain,
        industry: 'Technology',
        size: '11-50',
        description: 'A technology company',
        valueProposition: 'Innovative solutions for modern businesses',
        differentiators: ['Quality service', 'Expert team', 'Competitive pricing'],
        competitors: [],
        targetMarkets: ['Enterprise', 'Mid-Market'],
        products: ['Core Platform'],
        keyPainPoints: ['Efficiency challenges', 'Growth bottlenecks'],
        typicalBuyers: [{ title: 'Decision Maker', industry: 'Technology', sizeRange: '11-50' }]
      }
    }
  );

  if (response.success && response.data) {
    return response.data;
  }
  
  if (response.fallback) {
    console.log('Using fallback for company research - OpenAI API not available');
    return response.fallback;
  }
  
  throw new Error(response.error || 'Failed to research company');
}

export async function generateICPSuggestions(research: CompanyResearchResult): Promise<ICPSuggestion> {
  if (!await checkRateLimit()) {
    throw new Error('AI rate limit exceeded. Please wait a moment and try again.');
  }

  const prompt = `Based on this company research, suggest ideal customer profile (ICP) segments:

Company: ${research.name}
Industry: ${research.industry}
Value Prop: ${research.valueProposition}
Typical Buyers: ${JSON.stringify(research.typicalBuyers)}
Target Markets: ${research.targetMarkets.join(', ')}

Suggest:
1. Top 5-7 industries that would benefit from their solution
2. Company size ranges (1-10, 11-50, 51-200, 201-1000, 1000+)
3. Key decision-maker roles/titles (5-7)
4. Geographic regions if relevant

Return as JSON:
{
  "industries": ["Industry1", "Industry2"],
  "companySizes": ["11-50", "51-200"],
  "roles": ["VP Sales", "CTO"],
  "regions": ["North America", "Europe"]
}`;

  const systemPrompt = `You are a B2B sales strategy expert. Generate ideal customer profile suggestions based on company data. Return only valid JSON matching the requested structure.`;

  const response = await openAIClient.generateJSON<ICPSuggestion>(
    prompt,
    systemPrompt,
    {
      feature: 'icp-generation',
      model: 'gpt-4o-mini' as any,
      temperature: 0.7,
      maxTokens: 1500,
      fallback: {
        industries: ['Technology', 'SaaS', 'Professional Services', 'Financial Services', 'Healthcare'],
        companySizes: ['11-50', '51-200', '201-1000'],
        roles: ['VP Sales', 'CTO', 'CEO', 'Director of Operations', 'Head of Marketing'],
        regions: ['North America', 'Europe', 'Asia Pacific']
      }
    }
  );

  if (response.success && response.data) {
    return response.data;
  }
  
  if (response.fallback) {
    console.log('Using fallback for ICP suggestions - OpenAI API not available');
    return response.fallback;
  }
  
  throw new Error(response.error || 'Failed to generate ICP suggestions');
}

export async function generatePersonas(
  research: CompanyResearchResult,
  icp: ICPSuggestion,
  selectedIndustries: string[],
  selectedSizes: string[],
  selectedRoles: string[]
): Promise<PersonaSuggestion[]> {
  if (!await checkRateLimit()) {
    throw new Error('AI rate limit exceeded. Please wait a moment and try again.');
  }

  const combinations: { industry: string; size: string; role: string }[] = [];
  for (const industry of selectedIndustries.slice(0, 3)) {
    for (const size of selectedSizes.slice(0, 2)) {
      for (const role of selectedRoles.slice(0, 3)) {
        combinations.push({ industry, size, role });
      }
    }
  }

  if (combinations.length === 0) {
    return [];
  }

  const prompt = `Generate detailed buyer personas for this company's sales team:

Company: ${research.name}
Value Prop: ${research.valueProposition}
Key Differentiators: ${research.differentiators.join(', ')}

Generate a persona for each of these ICP combinations:
${combinations.map((c, i) => `${i + 1}. ${c.role} at ${c.size} employee ${c.industry} company`).join('\n')}

For each persona, provide:
- title: The job title
- industry: The industry
- companySize: The size range
- pains: 3-4 pain points relevant to this persona
- goals: 3-4 goals this persona has
- valueProps: 2-3 value propositions that resonate with this persona
- proofPoints: 2-3 proof points/social proof that would convince them
- communicationStyle: How they prefer to communicate (formal, casual, data-driven, etc.)

Return as JSON object with a "personas" array:
{
  "personas": [{
    "title": "VP Sales",
    "industry": "SaaS",
    "companySize": "51-200",
    "pains": ["pain1", "pain2"],
    "goals": ["goal1", "goal2"],
    "valueProps": ["value1", "value2"],
    "proofPoints": ["proof1", "proof2"],
    "communicationStyle": "Data-driven and concise"
  }]
}`;

  const systemPrompt = `You are a B2B buyer persona expert. Generate detailed, actionable buyer personas. Return only valid JSON with a "personas" array.`;

  const fallbackPersonas: PersonaSuggestion[] = combinations.slice(0, 5).map(c => ({
    title: c.role,
    industry: c.industry,
    companySize: c.size,
    pains: [
      'Struggling with efficiency and productivity',
      'Difficulty scaling operations',
      'Budget constraints'
    ],
    goals: [
      'Improve team productivity',
      'Reduce operational costs',
      'Drive revenue growth'
    ],
    valueProps: [
      research.valueProposition || 'Streamlined solution for your needs',
      research.differentiators[0] || 'Proven results with similar companies'
    ],
    proofPoints: [
      'Trusted by industry leaders',
      'Measurable ROI within 90 days'
    ],
    communicationStyle: 'Professional and data-driven'
  }));

  const response = await openAIClient.generateJSON<{ personas: PersonaSuggestion[] }>(
    prompt,
    systemPrompt,
    {
      feature: 'persona-generation',
      model: 'gpt-4o-mini' as any,
      temperature: 0.7,
      maxTokens: 3000,
      fallback: { personas: fallbackPersonas }
    }
  );

  if (response.success && response.data) {
    const result = response.data;
    return Array.isArray(result) ? result : (result.personas || []);
  }
  
  if (response.fallback) {
    console.log('Using fallback for personas - OpenAI API not available');
    return response.fallback.personas;
  }
  
  throw new Error(response.error || 'Failed to generate personas');
}

export async function cacheCompanyResearch(
  orgId: string,
  research: CompanyResearchResult,
  icp: ICPSuggestion,
  personas: PersonaSuggestion[]
): Promise<void> {
  const existing = await storage.getCustomerProfile(orgId);
  
  const profileData = {
    orgId,
    companyResearch: research,
    icpData: icp,
    personaData: personas,
    valueProps: research.differentiators.map(d => ({ text: d, source: 'ai_generated' })),
    messagingFramework: {
      painPoints: research.keyPainPoints,
      valueProposition: research.valueProposition,
      differentiators: research.differentiators,
    },
    lastAiCallAt: new Date(),
  };

  if (existing) {
    await storage.updateCustomerProfile(orgId, profileData);
  } else {
    await storage.createCustomerProfile(profileData);
  }
}

export async function getCachedResearch(orgId: string): Promise<{
  research: CompanyResearchResult | null;
  icp: ICPSuggestion | null;
  personas: PersonaSuggestion[];
} | null> {
  const profile = await storage.getCustomerProfile(orgId);
  if (!profile) return null;
  
  return {
    research: profile.companyResearch as CompanyResearchResult | null,
    icp: profile.icpData as ICPSuggestion | null,
    personas: (profile.personaData as PersonaSuggestion[]) || [],
  };
}

export async function runFullCompanyResearch(
  websiteUrl: string,
  orgId: string,
  options?: {
    selectedIndustries?: string[];
    selectedSizes?: string[];
    selectedRoles?: string[];
  }
): Promise<{
  research: CompanyResearchResult;
  icp: ICPSuggestion;
  personas: PersonaSuggestion[];
}> {
  const research = await researchCompany(websiteUrl);
  
  const icp = await generateICPSuggestions(research);
  
  const selectedIndustries = options?.selectedIndustries || icp.industries.slice(0, 3);
  const selectedSizes = options?.selectedSizes || icp.companySizes.slice(0, 2);
  const selectedRoles = options?.selectedRoles || icp.roles.slice(0, 3);
  
  const personas = await generatePersonas(
    research,
    icp,
    selectedIndustries,
    selectedSizes,
    selectedRoles
  );
  
  await cacheCompanyResearch(orgId, research, icp, personas);
  
  return { research, icp, personas };
}
