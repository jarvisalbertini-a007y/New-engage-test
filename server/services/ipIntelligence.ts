import { Company, InsertCompany } from "@shared/schema";
import { storage } from "../storage";

// Mock IP ranges for demo purposes
const IP_COMPANY_DATABASE = [
  {
    ipRange: "98.137.",
    company: {
      name: "Microsoft Corporation",
      domain: "microsoft.com",
      industry: "Technology",
      size: "10000+",
      location: "Redmond, WA",
      revenue: "$198B",
      technologies: ["Azure", "Office 365", "Teams", "Dynamics"],
      description: "Leading technology corporation developing computer software and consumer electronics",
      linkedinUrl: "https://linkedin.com/company/microsoft"
    }
  },
  {
    ipRange: "173.252.",
    company: {
      name: "Meta Platforms",
      domain: "meta.com",
      industry: "Social Media",
      size: "10000+",
      location: "Menlo Park, CA",
      revenue: "$117B",
      technologies: ["React", "GraphQL", "PyTorch", "WhatsApp"],
      description: "Social technology company building the metaverse",
      linkedinUrl: "https://linkedin.com/company/meta"
    }
  },
  {
    ipRange: "52.84.",
    company: {
      name: "Amazon Web Services",
      domain: "aws.amazon.com",
      industry: "Cloud Computing",
      size: "10000+",
      location: "Seattle, WA",
      revenue: "$80B",
      technologies: ["AWS", "EC2", "S3", "Lambda"],
      description: "Leading cloud infrastructure provider",
      linkedinUrl: "https://linkedin.com/company/amazon-web-services"
    }
  },
  {
    ipRange: "162.125.",
    company: {
      name: "Salesforce",
      domain: "salesforce.com",
      industry: "CRM Software",
      size: "10000+",
      location: "San Francisco, CA",
      revenue: "$31B",
      technologies: ["Apex", "Lightning", "Heroku", "MuleSoft"],
      description: "Customer relationship management platform",
      linkedinUrl: "https://linkedin.com/company/salesforce"
    }
  },
  {
    ipRange: "104.16.",
    company: {
      name: "Cloudflare",
      domain: "cloudflare.com",
      industry: "Internet Infrastructure",
      size: "1000-5000",
      location: "San Francisco, CA",
      revenue: "$1.3B",
      technologies: ["CDN", "DDoS Protection", "Workers", "R2"],
      description: "Web infrastructure and security company",
      linkedinUrl: "https://linkedin.com/company/cloudflare"
    }
  },
  {
    ipRange: "192.168.",
    company: {
      name: "Acme Corporation",
      domain: "acme.example.com",
      industry: "Software",
      size: "51-200",
      location: "Austin, TX",
      revenue: "$15M",
      technologies: ["Node.js", "React", "PostgreSQL", "AWS"],
      description: "Innovative software solutions provider",
      linkedinUrl: "https://linkedin.com/company/acme-corp"
    }
  }
];

// Extended enrichment data for demo
const ENRICHMENT_DATABASE: Record<string, any> = {
  "microsoft.com": {
    funding: "Public (MSFT)",
    employees: 221000,
    founded: 1975,
    techStack: ["Azure", "Office 365", "Teams", "GitHub", "VS Code", ".NET"],
    recentNews: "Launched new AI Copilot features across Office suite",
    intentSignals: ["Expanding cloud infrastructure", "AI investments", "Developer tools growth"]
  },
  "meta.com": {
    funding: "Public (META)",
    employees: 86000,
    founded: 2004,
    techStack: ["React", "GraphQL", "PyTorch", "Cassandra", "Presto"],
    recentNews: "Investing heavily in AR/VR metaverse technology",
    intentSignals: ["Metaverse development", "AI research", "Social commerce expansion"]
  },
  "aws.amazon.com": {
    funding: "Public (AMZN)",
    employees: 100000,
    founded: 2006,
    techStack: ["EC2", "S3", "Lambda", "DynamoDB", "RDS", "CloudFormation"],
    recentNews: "Announced new generative AI services at re:Invent",
    intentSignals: ["AI/ML services", "Edge computing", "Serverless expansion"]
  },
  "salesforce.com": {
    funding: "Public (CRM)",
    employees: 73000,
    founded: 1999,
    techStack: ["Apex", "Lightning", "Heroku", "MuleSoft", "Tableau", "Slack"],
    recentNews: "Integrated Einstein AI across entire platform",
    intentSignals: ["AI CRM features", "Industry cloud solutions", "Data integration"]
  }
};

export async function identifyCompanyFromIP(ipAddress: string | null | undefined): Promise<Company | null> {
  // Validate IP address
  if (!ipAddress) {
    console.warn('identifyCompanyFromIP called with invalid IP address:', ipAddress);
    return null;
  }
  
  // Check if company already exists in database by IP lookup
  const existingSessions = await storage.getActiveVisitorSessions();
  const existingCompany = existingSessions.find(s => s.ipAddress === ipAddress && s.companyId);
  
  if (existingCompany?.companyId) {
    const company = await storage.getCompany(existingCompany.companyId);
    if (company) return company;
  }

  // Try to match IP to known company
  const matchedCompany = IP_COMPANY_DATABASE.find(entry => 
    ipAddress && ipAddress.startsWith(entry.ipRange)
  );

  if (matchedCompany) {
    // Check if company already exists by domain
    const companies = await storage.getCompanies(100);
    const existing = companies.find(c => c.domain === matchedCompany.company.domain);
    
    if (existing) {
      return existing;
    }

    // Create new company record
    const newCompany: InsertCompany = matchedCompany.company;
    return await storage.createCompany(newCompany);
  }

  // Generate anonymous visitor company for unknown IPs
  const anonymousCompany: InsertCompany = {
    name: `Visitor from ${ipAddress.split('.').slice(0, 2).join('.')}.x.x`,
    domain: `unknown-${Date.now()}.visitor`,
    industry: "Unknown",
    size: "Unknown",
    location: getLocationFromIP(ipAddress),
    technologies: [],
    description: "Anonymous visitor - pending identification"
  };

  return await storage.createCompany(anonymousCompany);
}

export async function enrichCompanyData(domain: string): Promise<any> {
  // Return enriched data if available
  const enrichmentData = ENRICHMENT_DATABASE[domain];
  
  if (enrichmentData) {
    return {
      success: true,
      data: enrichmentData,
      source: "IP Intelligence Database"
    };
  }

  // Return basic enrichment for unknown domains
  return {
    success: true,
    data: {
      funding: "Unknown",
      employees: "Unknown",
      techStack: [],
      recentNews: "No recent news available",
      intentSignals: []
    },
    source: "Basic Lookup"
  };
}

export function getLocationFromIP(ipAddress: string): string {
  // Mock geolocation based on IP patterns
  const firstOctet = parseInt(ipAddress.split('.')[0]);
  
  if (firstOctet < 50) return "East Coast, USA";
  if (firstOctet < 100) return "West Coast, USA";
  if (firstOctet < 150) return "Central USA";
  if (firstOctet < 200) return "Europe";
  return "Global";
}

export function calculateIntentScore(pagesViewed: string[], timeOnSite: number): number {
  let score = 0;
  
  // High-intent pages
  const highIntentPages = ['/pricing', '/demo', '/contact', '/signup', '/trial'];
  const mediumIntentPages = ['/features', '/solutions', '/case-studies', '/integrations'];
  
  pagesViewed.forEach(page => {
    if (highIntentPages.some(p => page.includes(p))) {
      score += 30;
    } else if (mediumIntentPages.some(p => page.includes(p))) {
      score += 15;
    } else {
      score += 5;
    }
  });
  
  // Time on site bonus
  if (timeOnSite > 300) score += 20; // 5+ minutes
  else if (timeOnSite > 120) score += 10; // 2+ minutes
  else if (timeOnSite > 60) score += 5; // 1+ minute
  
  // Cap at 100
  return Math.min(100, score);
}

export async function getCompanyVisitorHistory(companyId: string): Promise<{
  totalVisits: number;
  uniqueVisitors: number;
  avgTimeOnSite: number;
  topPages: string[];
  lastVisit: Date | null;
}> {
  const sessions = await storage.getVisitorSessionsByCompany(companyId);
  
  if (sessions.length === 0) {
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      avgTimeOnSite: 0,
      topPages: [],
      lastVisit: null
    };
  }
  
  const uniqueIPs = new Set(sessions.map(s => s.ipAddress));
  const allPages = sessions.flatMap(s => s.pagesViewed || []);
  const pageCount = allPages.reduce((acc, page) => {
    acc[page] = (acc[page] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topPages = Object.entries(pageCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([page]) => page);
  
  const avgTime = sessions.reduce((sum, s) => sum + (s.timeOnSite || 0), 0) / sessions.length;
  const lastVisit = sessions.sort((a, b) => 
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  )[0].lastActivity;
  
  return {
    totalVisits: sessions.length,
    uniqueVisitors: uniqueIPs.size,
    avgTimeOnSite: Math.round(avgTime),
    topPages,
    lastVisit
  };
}