from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
import os
import httpx

from database import get_db
from models.onboarding import OnboardingProfile, OnboardingProfileCreate, ICP, Strategy
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

@router.get("/profile")
async def get_onboarding_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    profile = await db.onboarding_profiles.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not profile:
        # Create initial profile
        now = datetime.now(timezone.utc)
        profile = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "step": 1,
            "isComplete": False,
            "companyName": current_user.get("companyName"),
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat()
        }
        await db.onboarding_profiles.insert_one(profile)
        del profile["_id"] if "_id" in profile else None
    
    return profile

@router.post("/profile")
async def create_onboarding_profile(
    profile_data: OnboardingProfileCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Check if profile exists
    existing = await db.onboarding_profiles.find_one({"userId": current_user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    now = datetime.now(timezone.utc)
    profile = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "step": 1,
        "isComplete": False,
        **profile_data.dict(),
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.onboarding_profiles.insert_one(profile)
    del profile["_id"] if "_id" in profile else None
    return profile

@router.put("/profile")
async def update_onboarding_profile(
    updates: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    profile = await db.onboarding_profiles.find_one({"userId": current_user["id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.onboarding_profiles.update_one(
        {"userId": current_user["id"]},
        {"$set": updates}
    )
    
    updated = await db.onboarding_profiles.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    return updated

@router.post("/research-company")
async def research_company(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Research a company based on domain and generate ICP/Strategy suggestions"""
    domain = request.get("domain", "")
    company_name = request.get("companyName", "")
    
    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Domain or company name required")
    
    # TODO: Use Gemini to research company
    # For now, return mock research data
    
    research_result = {
        "company": {
            "name": company_name or domain.split(".")[0].title(),
            "domain": domain,
            "industry": "Technology",
            "size": "51-200",
            "description": f"A technology company focused on innovation.",
            "valueProposition": "Helping businesses achieve more with AI-powered solutions.",
            "competitors": ["Competitor A", "Competitor B", "Competitor C"]
        },
        "suggestedIcp": {
            "industries": ["Technology", "SaaS", "Enterprise Software"],
            "companySizes": ["51-200", "201-500", "501-1000"],
            "titles": ["VP of Sales", "Head of Revenue", "Sales Director", "CRO"],
            "geographies": ["United States", "Canada", "United Kingdom"],
            "technologies": ["Salesforce", "HubSpot", "Outreach"],
            "painPoints": [
                "Manual prospecting takes too long",
                "Low response rates on outreach",
                "Difficulty scaling sales operations"
            ],
            "buyingSignals": [
                "Recent funding round",
                "Hiring sales roles",
                "Expanding to new markets"
            ],
            "decisionMakers": ["VP Sales", "CRO", "CEO"]
        },
        "suggestedStrategy": {
            "approach": "consultative",
            "primaryChannel": "multi-channel",
            "cadence": "balanced",
            "personalization": "high",
            "automationLevel": "guided",
            "focusAreas": ["Enterprise accounts", "Mid-market expansion"],
            "messagingPillars": [
                "ROI-focused messaging",
                "Time savings emphasis",
                "Competitive displacement"
            ],
            "differentiators": [
                "AI-powered automation",
                "1000+ agent library",
                "Self-improving workflows"
            ],
            "objectionHandlers": {
                "Already have a solution": "We integrate with existing tools and enhance their capabilities.",
                "Budget constraints": "Our ROI typically shows 3x return within 6 months.",
                "Too complex": "Our guided onboarding gets you up and running in under an hour."
            }
        },
        "confidence": 0.85,
        "sources": ["LinkedIn", "Crunchbase", "Company Website", "News Articles"]
    }
    
    # Save research to profile
    db = get_db()
    await db.onboarding_profiles.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "aiResearch": research_result,
                "aiResearchedAt": datetime.now(timezone.utc).isoformat(),
                "companyName": research_result["company"]["name"],
                "companyDomain": domain,
                "industry": research_result["company"]["industry"],
                "companyDescription": research_result["company"]["description"],
                "valueProposition": research_result["company"]["valueProposition"],
                "competitors": research_result["company"]["competitors"],
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return research_result

@router.post("/approve-icp")
async def approve_icp(
    icp_data: ICP,
    current_user: dict = Depends(get_current_user)
):
    """Approve or modify the suggested ICP"""
    db = get_db()
    
    await db.onboarding_profiles.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "icp": icp_data.dict(),
                "icpApproved": True,
                "step": 3,  # Move to strategy step
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    profile = await db.onboarding_profiles.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    return profile

@router.post("/approve-strategy")
async def approve_strategy(
    strategy_data: Strategy,
    current_user: dict = Depends(get_current_user)
):
    """Approve or modify the suggested strategy"""
    db = get_db()
    
    await db.onboarding_profiles.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "strategy": strategy_data.dict(),
                "strategyApproved": True,
                "step": 4,  # Move to completion
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    profile = await db.onboarding_profiles.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    return profile

@router.post("/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """Mark onboarding as complete"""
    db = get_db()
    
    await db.onboarding_profiles.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "isComplete": True,
                "step": 5,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Also update user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"onboardingCompleted": True}}
    )
    
    profile = await db.onboarding_profiles.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    return profile
