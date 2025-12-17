"""
Seed script for agent templates.
Run with: python seeds/seed_templates.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from uuid import uuid4
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "engageai")

# Agent templates for the catalog
AGENT_TEMPLATES = [
    # Prospecting Agents
    {
        "id": str(uuid4()),
        "name": "LinkedIn Lead Finder",
        "slug": "linkedin-lead-finder",
        "description": "Discovers potential leads on LinkedIn based on ICP criteria",
        "longDescription": "This agent searches LinkedIn profiles to find potential leads matching your Ideal Customer Profile. It considers job titles, company size, industry, and location to identify the best prospects.",
        "tier": "worker",
        "domain": "prospecting",
        "complexity": "simple",
        "capabilities": ["linkedin_search", "profile_extraction", "icp_matching"],
        "requiredIntegrations": ["linkedin"],
        "tags": ["linkedin", "lead-gen", "prospecting"],
    },
    {
        "id": str(uuid4()),
        "name": "Company Directory Scanner",
        "slug": "company-directory-scanner",
        "description": "Scans company directories and databases for potential leads",
        "tier": "worker",
        "domain": "prospecting",
        "complexity": "simple",
        "capabilities": ["database_search", "company_lookup"],
        "requiredIntegrations": [],
        "tags": ["database", "company", "prospecting"],
    },
    {
        "id": str(uuid4()),
        "name": "Event Attendee Finder",
        "slug": "event-attendee-finder",
        "description": "Finds prospects from conference and event attendee lists",
        "tier": "specialist",
        "domain": "prospecting",
        "complexity": "medium",
        "capabilities": ["event_search", "attendee_extraction"],
        "requiredIntegrations": [],
        "tags": ["events", "conferences", "prospecting"],
    },
    
    # Research Agents
    {
        "id": str(uuid4()),
        "name": "Company Research Agent",
        "slug": "company-research-agent",
        "description": "Researches company information including funding, news, and tech stack",
        "tier": "specialist",
        "domain": "research",
        "complexity": "medium",
        "capabilities": ["company_research", "news_tracking", "tech_stack_analysis"],
        "requiredIntegrations": [],
        "tags": ["research", "company", "intelligence"],
    },
    {
        "id": str(uuid4()),
        "name": "Technology Stack Analyzer",
        "slug": "technology-stack-analyzer",
        "description": "Identifies technologies used by target companies",
        "tier": "worker",
        "domain": "research",
        "complexity": "simple",
        "capabilities": ["tech_detection", "stack_analysis"],
        "requiredIntegrations": [],
        "tags": ["technology", "analysis", "research"],
    },
    {
        "id": str(uuid4()),
        "name": "Funding Intelligence Agent",
        "slug": "funding-intelligence-agent",
        "description": "Tracks funding rounds and investment opportunities",
        "tier": "specialist",
        "domain": "research",
        "complexity": "medium",
        "capabilities": ["funding_tracking", "investor_analysis"],
        "requiredIntegrations": [],
        "tags": ["funding", "investment", "research"],
    },
    
    # Outreach Agents
    {
        "id": str(uuid4()),
        "name": "Email Composer",
        "slug": "email-composer",
        "description": "Generates personalized cold emails for prospects",
        "tier": "worker",
        "domain": "outreach",
        "complexity": "simple",
        "capabilities": ["email_generation", "personalization"],
        "requiredIntegrations": ["email"],
        "tags": ["email", "outreach", "personalization"],
    },
    {
        "id": str(uuid4()),
        "name": "LinkedIn Message Writer",
        "slug": "linkedin-message-writer",
        "description": "Creates personalized LinkedIn connection requests and messages",
        "tier": "worker",
        "domain": "outreach",
        "complexity": "simple",
        "capabilities": ["linkedin_messaging", "personalization"],
        "requiredIntegrations": ["linkedin"],
        "tags": ["linkedin", "messaging", "outreach"],
    },
    {
        "id": str(uuid4()),
        "name": "Multi-Channel Sequence Builder",
        "slug": "multi-channel-sequence-builder",
        "description": "Creates automated outreach sequences across multiple channels",
        "tier": "leader",
        "domain": "outreach",
        "complexity": "complex",
        "capabilities": ["sequence_building", "multi_channel", "automation"],
        "requiredIntegrations": ["email", "linkedin"],
        "tags": ["sequence", "automation", "multi-channel"],
    },
    
    # Qualification Agents
    {
        "id": str(uuid4()),
        "name": "ICP Scorer",
        "slug": "icp-scorer",
        "description": "Scores prospects against your Ideal Customer Profile",
        "tier": "worker",
        "domain": "qualification",
        "complexity": "simple",
        "capabilities": ["scoring", "icp_matching"],
        "requiredIntegrations": [],
        "tags": ["scoring", "icp", "qualification"],
    },
    {
        "id": str(uuid4()),
        "name": "BANT Qualifier",
        "slug": "bant-qualifier",
        "description": "Qualifies leads using BANT framework (Budget, Authority, Need, Timeline)",
        "tier": "specialist",
        "domain": "qualification",
        "complexity": "medium",
        "capabilities": ["bant_qualification", "lead_scoring"],
        "requiredIntegrations": [],
        "tags": ["bant", "qualification", "scoring"],
    },
    {
        "id": str(uuid4()),
        "name": "Intent Signal Detector",
        "slug": "intent-signal-detector",
        "description": "Detects buying signals and intent indicators",
        "tier": "specialist",
        "domain": "qualification",
        "complexity": "medium",
        "capabilities": ["intent_detection", "signal_analysis"],
        "requiredIntegrations": [],
        "tags": ["intent", "signals", "qualification"],
    },
    
    # Scheduling Agents
    {
        "id": str(uuid4()),
        "name": "Meeting Scheduler",
        "slug": "meeting-scheduler",
        "description": "Automatically schedules meetings with qualified prospects",
        "tier": "worker",
        "domain": "scheduling",
        "complexity": "simple",
        "capabilities": ["calendar_management", "meeting_booking"],
        "requiredIntegrations": ["google_calendar"],
        "tags": ["scheduling", "meetings", "calendar"],
    },
    {
        "id": str(uuid4()),
        "name": "Demo Coordinator",
        "slug": "demo-coordinator",
        "description": "Coordinates product demos and follow-ups",
        "tier": "specialist",
        "domain": "scheduling",
        "complexity": "medium",
        "capabilities": ["demo_scheduling", "followup_coordination"],
        "requiredIntegrations": ["google_calendar", "email"],
        "tags": ["demos", "scheduling", "coordination"],
    },
    
    # Content Agents
    {
        "id": str(uuid4()),
        "name": "Email Template Generator",
        "slug": "email-template-generator",
        "description": "Creates reusable email templates for various scenarios",
        "tier": "worker",
        "domain": "content",
        "complexity": "simple",
        "capabilities": ["template_generation", "content_creation"],
        "requiredIntegrations": [],
        "tags": ["templates", "email", "content"],
    },
    {
        "id": str(uuid4()),
        "name": "Case Study Writer",
        "slug": "case-study-writer",
        "description": "Generates compelling case studies from customer data",
        "tier": "specialist",
        "domain": "content",
        "complexity": "medium",
        "capabilities": ["content_generation", "storytelling"],
        "requiredIntegrations": [],
        "tags": ["case-studies", "content", "marketing"],
    },
    {
        "id": str(uuid4()),
        "name": "Sales Script Generator",
        "slug": "sales-script-generator",
        "description": "Creates personalized sales call scripts",
        "tier": "worker",
        "domain": "content",
        "complexity": "simple",
        "capabilities": ["script_generation", "personalization"],
        "requiredIntegrations": [],
        "tags": ["scripts", "calls", "content"],
    },
    
    # Analysis Agents
    {
        "id": str(uuid4()),
        "name": "Pipeline Analyzer",
        "slug": "pipeline-analyzer",
        "description": "Analyzes sales pipeline health and suggests optimizations",
        "tier": "leader",
        "domain": "analysis",
        "complexity": "complex",
        "capabilities": ["pipeline_analysis", "forecasting"],
        "requiredIntegrations": [],
        "tags": ["pipeline", "analysis", "forecasting"],
    },
    {
        "id": str(uuid4()),
        "name": "Response Rate Optimizer",
        "slug": "response-rate-optimizer",
        "description": "Analyzes and improves email response rates",
        "tier": "specialist",
        "domain": "analysis",
        "complexity": "medium",
        "capabilities": ["response_analysis", "optimization"],
        "requiredIntegrations": ["email"],
        "tags": ["response-rate", "optimization", "analysis"],
    },
    
    # Integration Agents
    {
        "id": str(uuid4()),
        "name": "CRM Sync Agent",
        "slug": "crm-sync-agent",
        "description": "Syncs data with popular CRM platforms",
        "tier": "worker",
        "domain": "integration",
        "complexity": "simple",
        "capabilities": ["crm_sync", "data_transfer"],
        "requiredIntegrations": ["salesforce", "hubspot"],
        "tags": ["crm", "sync", "integration"],
    },
    {
        "id": str(uuid4()),
        "name": "Slack Notifier",
        "slug": "slack-notifier",
        "description": "Sends notifications and updates to Slack channels",
        "tier": "worker",
        "domain": "integration",
        "complexity": "simple",
        "capabilities": ["slack_messaging", "notifications"],
        "requiredIntegrations": ["slack"],
        "tags": ["slack", "notifications", "integration"],
    },
    
    # Management Agents
    {
        "id": str(uuid4()),
        "name": "Team Performance Tracker",
        "slug": "team-performance-tracker",
        "description": "Tracks and reports on sales team performance",
        "tier": "leader",
        "domain": "management",
        "complexity": "complex",
        "capabilities": ["performance_tracking", "reporting"],
        "requiredIntegrations": [],
        "tags": ["performance", "team", "management"],
    },
    {
        "id": str(uuid4()),
        "name": "Territory Manager",
        "slug": "territory-manager",
        "description": "Manages sales territories and assignments",
        "tier": "specialist",
        "domain": "management",
        "complexity": "medium",
        "capabilities": ["territory_management", "assignment"],
        "requiredIntegrations": [],
        "tags": ["territories", "management", "assignment"],
    },
    
    # Data Agents
    {
        "id": str(uuid4()),
        "name": "Email Verifier",
        "slug": "email-verifier",
        "description": "Verifies email addresses for deliverability",
        "tier": "worker",
        "domain": "data",
        "complexity": "simple",
        "capabilities": ["email_verification", "data_validation"],
        "requiredIntegrations": [],
        "tags": ["email", "verification", "data"],
    },
    {
        "id": str(uuid4()),
        "name": "Data Enrichment Agent",
        "slug": "data-enrichment-agent",
        "description": "Enriches lead data with additional information",
        "tier": "specialist",
        "domain": "data",
        "complexity": "medium",
        "capabilities": ["data_enrichment", "profile_completion"],
        "requiredIntegrations": [],
        "tags": ["enrichment", "data", "profiles"],
    },
    {
        "id": str(uuid4()),
        "name": "Duplicate Detector",
        "slug": "duplicate-detector",
        "description": "Identifies and merges duplicate records",
        "tier": "worker",
        "domain": "data",
        "complexity": "simple",
        "capabilities": ["duplicate_detection", "data_cleaning"],
        "requiredIntegrations": [],
        "tags": ["duplicates", "cleaning", "data"],
    },
]

async def seed_templates():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clear existing templates
    await db.agent_templates.delete_many({})
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Add timestamps to templates
    for template in AGENT_TEMPLATES:
        template["createdAt"] = now
        template["usageCount"] = 0
        template["rating"] = 4.5
    
    # Insert templates
    result = await db.agent_templates.insert_many(AGENT_TEMPLATES)
    print(f"Inserted {len(result.inserted_ids)} agent templates")
    
    # Create indexes
    await db.agent_templates.create_index("domain")
    await db.agent_templates.create_index("tier")
    await db.agent_templates.create_index("slug", unique=True)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_templates())
    print("Seeding completed!")
