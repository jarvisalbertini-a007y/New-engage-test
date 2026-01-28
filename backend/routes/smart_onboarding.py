"""Smart Onboarding - Email-only onboarding with AI research"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
import os
import re

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

def extract_domain_from_email(email: str) -> str:
    """Extract domain from email address"""
    if "@" in email:
        return email.split("@")[1]
    return ""

def extract_name_from_email(email: str) -> dict:
    """Try to extract name from email prefix"""
    if "@" not in email:
        return {"firstName": "", "lastName": ""}
    
    prefix = email.split("@")[0]
    
    # Common patterns: john.doe, johndoe, john_doe, jdoe
    parts = re.split(r'[._]', prefix)
    
    if len(parts) >= 2:
        return {
            "firstName": parts[0].title(),
            "lastName": parts[-1].title()
        }
    elif len(parts) == 1:
        # Try to split camelCase or detect common patterns
        name = parts[0]
        if len(name) > 3:
            return {"firstName": name.title(), "lastName": ""}
    
    return {"firstName": "", "lastName": ""}

@router.post("/start")
async def start_smart_onboarding(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Start smart onboarding with just email address"""
    email = current_user.get("email", request.get("email", ""))
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    domain = extract_domain_from_email(email)
    name_parts = extract_name_from_email(email)
    
    db = get_db()
    
    # Create onboarding session
    session = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "email": email,
        "domain": domain,
        "status": "researching",
        "step": 1,
        "extractedName": name_parts,
        "companyResearch": None,
        "userResearch": None,
        "suggestedIcp": None,
        "suggestedStrategy": None,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.smart_onboarding.insert_one(session)
    
    # Start AI research in background (simulated as sync for demo)
    research_result = await research_company_and_user(domain, email, name_parts)
    
    # Update session with research
    await db.smart_onboarding.update_one(
        {"id": session["id"]},
        {"$set": {
            "status": "research_complete",
            "step": 2,
            "companyResearch": research_result.get("company"),
            "userResearch": research_result.get("user"),
            "suggestedIcp": research_result.get("icp"),
            "suggestedStrategy": research_result.get("strategy")
        }}
    )
    
    session.pop("_id", None)
    session.update(research_result)
    
    return session

async def research_company_and_user(domain: str, email: str, name_parts: dict) -> dict:
    """Use AI to research company and user from email domain"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Research this company and user for sales engagement purposes.

Email: {email}
Domain: {domain}
Extracted Name: {name_parts.get('firstName', '')} {name_parts.get('lastName', '')}

Provide comprehensive research in JSON format:
{{
  "company": {{
    "name": "Company legal name",
    "domain": "{domain}",
    "industry": "Primary industry",
    "subIndustry": "Sub-industry",
    "size": "Employee count range (e.g., 51-200)",
    "revenue": "Estimated annual revenue",
    "founded": "Year founded",
    "headquarters": "City, Country",
    "description": "2-3 sentence company description",
    "products": ["Product 1", "Product 2"],
    "valueProposition": "Main value proposition",
    "targetCustomers": ["Customer segment 1", "Segment 2"],
    "competitors": ["Competitor 1", "Competitor 2", "Competitor 3"],
    "recentNews": ["Recent development 1", "Development 2"],
    "techStack": ["Technology 1", "Technology 2"],
    "fundingStage": "Seed/Series A/B/C/Public",
    "keyPeople": [{{"name": "CEO Name", "title": "CEO"}}]
  }},
  "user": {{
    "firstName": "Best guess first name",
    "lastName": "Best guess last name",
    "likelyTitle": "Most likely job title based on email pattern",
    "department": "Likely department",
    "seniority": "Entry/Mid/Senior/Executive",
    "focusAreas": ["Likely focus area 1", "Focus area 2"]
  }},
  "icp": {{
    "industries": ["Industry 1", "Industry 2", "Industry 3"],
    "companySizes": ["51-200", "201-500"],
    "titles": ["VP of Sales", "Head of Revenue", "CRO"],
    "geographies": ["United States", "Europe"],
    "painPoints": ["Pain point 1", "Pain point 2", "Pain point 3"],
    "buyingSignals": ["Signal 1", "Signal 2"],
    "technologies": ["Tech they likely use"]
  }},
  "strategy": {{
    "approach": "consultative",
    "primaryChannel": "email",
    "cadence": "balanced",
    "personalization": "high",
    "messagingPillars": ["Pillar 1", "Pillar 2"],
    "differentiators": ["Differentiator 1", "Differentiator 2"],
    "openingHooks": ["Hook 1 based on company", "Hook 2"],
    "objectionHandlers": {{
      "Too busy": "Response...",
      "Using competitor": "Response..."
    }}
  }}
}}

Be specific and realistic based on the domain. If unknown, make educated guesses based on domain patterns."""
        
        session_id = f"onboard-{str(uuid4())[:8]}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are an expert company researcher for sales purposes."
        )
        content = await llm.send_message(UserMessage(text=prompt))
        
        # Parse JSON from response
        import json
        
        # Try to extract JSON
        json_match = re.search(r'```json\s*({.*?})\s*```', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        
        # Try parsing entire response
        try:
            return json.loads(content)
        except:
            pass
        
        # Fallback response
        return generate_fallback_research(domain, name_parts)
        
    except Exception as e:
        print(f"Research error: {e}")
        return generate_fallback_research(domain, name_parts)

def generate_fallback_research(domain: str, name_parts: dict) -> dict:
    """Generate fallback research when AI fails"""
    company_name = domain.split(".")[0].title()
    
    return {
        "company": {
            "name": company_name,
            "domain": domain,
            "industry": "Technology",
            "size": "51-200",
            "description": f"{company_name} is a company focused on delivering innovative solutions.",
            "valueProposition": "Helping businesses achieve more.",
            "competitors": ["Competitor A", "Competitor B"],
            "techStack": ["Cloud", "SaaS"]
        },
        "user": {
            "firstName": name_parts.get("firstName", ""),
            "lastName": name_parts.get("lastName", ""),
            "likelyTitle": "Professional",
            "department": "Operations",
            "seniority": "Mid"
        },
        "icp": {
            "industries": ["Technology", "SaaS", "Enterprise Software"],
            "companySizes": ["51-200", "201-500"],
            "titles": ["VP of Sales", "Head of Revenue", "Sales Director"],
            "painPoints": ["Manual processes", "Scaling challenges", "Efficiency gaps"],
            "buyingSignals": ["Hiring", "Funding", "Expansion"]
        },
        "strategy": {
            "approach": "consultative",
            "primaryChannel": "multi-channel",
            "cadence": "balanced",
            "personalization": "high",
            "messagingPillars": ["ROI-focused", "Time savings"],
            "differentiators": ["AI-powered", "Easy to use"]
        }
    }

@router.get("/session")
async def get_onboarding_session(current_user: dict = Depends(get_current_user)):
    """Get current onboarding session"""
    db = get_db()
    
    session = await db.smart_onboarding.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="No onboarding session found")
    
    return session

@router.post("/approve")
async def approve_onboarding_research(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Approve and customize the AI-researched onboarding data"""
    db = get_db()
    
    session = await db.smart_onboarding.find_one({"userId": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="No onboarding session found")
    
    # Update with user modifications
    updates = {
        "status": "approved",
        "step": 3,
        "approvedAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Allow user to override AI suggestions
    if request.get("icp"):
        updates["finalIcp"] = request["icp"]
    if request.get("strategy"):
        updates["finalStrategy"] = request["strategy"]
    if request.get("userInfo"):
        updates["userResearch"] = {**session.get("userResearch", {}), **request["userInfo"]}
    
    await db.smart_onboarding.update_one(
        {"id": session["id"]},
        {"$set": updates}
    )
    
    # Update user profile with researched data
    user_updates = {
        "onboardingCompleted": True,
        "companyName": session.get("companyResearch", {}).get("name"),
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    if session.get("userResearch"):
        user_updates["firstName"] = session["userResearch"].get("firstName") or current_user.get("firstName")
        user_updates["lastName"] = session["userResearch"].get("lastName") or current_user.get("lastName")
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": user_updates}
    )
    
    # Create ICP document for future use
    if session.get("suggestedIcp"):
        icp_doc = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "name": "Primary ICP",
            "data": request.get("icp") or session["suggestedIcp"],
            "isDefault": True,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.icps.insert_one(icp_doc)
    
    return {"success": True, "message": "Onboarding completed successfully"}

@router.post("/refresh-research")
async def refresh_research(current_user: dict = Depends(get_current_user)):
    """Re-run AI research with fresh data"""
    db = get_db()
    
    session = await db.smart_onboarding.find_one({"userId": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="No onboarding session found")
    
    # Re-run research
    research_result = await research_company_and_user(
        session["domain"],
        session["email"],
        session.get("extractedName", {})
    )
    
    await db.smart_onboarding.update_one(
        {"id": session["id"]},
        {"$set": {
            "companyResearch": research_result.get("company"),
            "userResearch": research_result.get("user"),
            "suggestedIcp": research_result.get("icp"),
            "suggestedStrategy": research_result.get("strategy"),
            "refreshedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return research_result
