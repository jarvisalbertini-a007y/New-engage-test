import { db } from "./db";
import { companies, visitorSessions, insights } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create sample companies
  const companiesData = [
    {
      name: "TechCorp Solutions",
      domain: "techcorp.com",
      industry: "SaaS",
      size: "50-200",
      location: "San Francisco, CA",
      revenue: "$10M-50M",
      technologies: ["React", "Node.js", "AWS"],
      description: "Leading SaaS platform for enterprise automation",
      linkedinUrl: "https://linkedin.com/company/techcorp",
    },
    {
      name: "DataFlow Inc",
      domain: "dataflow.com",
      industry: "Fintech",
      size: "200-500",
      location: "Austin, TX",
      revenue: "$50M-100M",
      technologies: ["Python", "PostgreSQL", "Kubernetes"],
      description: "Financial data processing solutions",
      linkedinUrl: "https://linkedin.com/company/dataflow",
    },
    {
      name: "NextGen Analytics",
      domain: "nextgen.com",
      industry: "Healthcare",
      size: "100-300",
      location: "Denver, CO",
      revenue: "$25M-50M",
      technologies: ["Angular", "MongoDB", "Docker"],
      description: "Healthcare analytics and insights platform",
      linkedinUrl: "https://linkedin.com/company/nextgen",
    }
  ];

  const createdCompanies = await db.insert(companies).values(companiesData).returning();
  console.log(`✅ Created ${createdCompanies.length} companies`);

  // Create sample visitor sessions
  const sessionsData = [
    {
      companyId: createdCompanies[0].id,
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0...",
      pagesViewed: ["/pricing", "/features", "/demo"],
      timeOnSite: 450,
      intentScore: 94,
      isActive: true,
    },
    {
      companyId: createdCompanies[1].id,
      ipAddress: "192.168.1.101",
      userAgent: "Mozilla/5.0...",
      pagesViewed: ["/features", "/about"],
      timeOnSite: 180,
      intentScore: 72,
      isActive: true,
    }
  ];

  const createdSessions = await db.insert(visitorSessions).values(sessionsData).returning();
  console.log(`✅ Created ${createdSessions.length} visitor sessions`);

  // Create sample insights
  const insightsData = [
    {
      companyId: createdCompanies[0].id,
      type: "funding",
      title: "TechCorp raised $15M Series A",
      description: "Perfect timing to reach out about scaling solutions",
      source: "TechCrunch",
      confidence: "0.95",
      relevanceScore: 88,
      actionable: true,
      data: { amount: "$15M", round: "Series A" },
    },
    {
      companyId: createdCompanies[1].id,
      type: "leadership_change",
      title: "New CTO at DataFlow Inc",
      description: "Sarah Chen joined as CTO - focus on tech stack modernization",
      source: "LinkedIn",
      confidence: "0.87",
      relevanceScore: 92,
      actionable: true,
      data: { person: "Sarah Chen", role: "CTO" },
    }
  ];

  const createdInsights = await db.insert(insights).values(insightsData).returning();
  console.log(`✅ Created ${createdInsights.length} insights`);

  console.log("✨ Database seeding completed!");
}

seed()
  .catch((error) => {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
