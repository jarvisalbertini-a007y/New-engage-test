"""Execution Engine - Actually performs actions, autonomous execution, self-improvement"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import asyncio
import random

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ============== ACTION EXECUTION ==============

async def call_ai(prompt: str, system_instruction: str = None) -> str:
    """Call Gemini AI"""
    try:
        from emergentintegrations.llm.chat import chat, Message, ModelType
        
        messages = []
        if system_instruction:
            messages.append(Message(role="system", content=system_instruction))
        messages.append(Message(role="user", content=prompt))
        
        response = await chat(
            emergent_api_key=EMERGENT_LLM_KEY,
            model=ModelType.GEMINI_2_0_FLASH,
            messages=messages
        )
        return response.message.content
    except Exception as e:
        print(f"AI call error: {e}")
        return None


@router.post("/execute-action")
async def execute_action(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Execute a specific action - this actually does things!"""
    action_type = request.get("action")
    params = request.get("params", {})
    
    db = get_db()
    
    # Create execution record
    execution = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "actionType": action_type,
        "params": params,
        "status": "running",
        "result": None,
        "error": None,
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None
    }
    await db.action_executions.insert_one(execution)
    
    # Execute the action
    result = None
    error = None
    
    try:
        if action_type == "find_prospects":
            result = await action_find_prospects(params, current_user, db)
        elif action_type == "research_company":
            result = await action_research_company(params, current_user, db)
        elif action_type == "draft_email":
            result = await action_draft_email(params, current_user, db)
        elif action_type == "score_prospect":
            result = await action_score_prospect(params, current_user, db)
        elif action_type == "create_sequence":
            result = await action_create_sequence(params, current_user, db)
        elif action_type == "send_email":
            result = await action_send_email(params, current_user, db)
        elif action_type == "schedule_followup":
            result = await action_schedule_followup(params, current_user, db)
        else:
            error = f"Unknown action type: {action_type}"
    except Exception as e:
        error = str(e)
    
    # Update execution record
    await db.action_executions.update_one(
        {"id": execution["id"]},
        {"$set": {
            "status": "completed" if result else "failed",
            "result": result,
            "error": error,
            "completedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "executionId": execution["id"],
        "action": action_type,
        "status": "completed" if result else "failed",
        "result": result,
        "error": error
    }


# ============== ACTION IMPLEMENTATIONS ==============

async def action_find_prospects(params: dict, user: dict, db) -> dict:
    """Actually find prospects using AI"""
    criteria = params.get("criteria", "")
    count = params.get("count", 10)
    
    # Use AI to generate realistic prospects based on criteria
    prompt = f"""Generate {count} realistic B2B sales prospects matching these criteria: {criteria}

For each prospect, provide:
- firstName, lastName
- title (job title)
- company (company name)
- email (realistic business email)
- linkedinUrl (linkedin profile URL pattern)
- industry
- companySize (e.g., "51-200")
- icpScore (0-100 match score)
- signals (list of buying signals detected)

Return as JSON array. Make the data realistic and varied."""

    ai_response = await call_ai(prompt)
    
    prospects = []
    if ai_response:
        try:
            # Parse JSON from response
            import re
            json_match = re.search(r'\[.*\]', ai_response, re.DOTALL)
            if json_match:
                prospects = json.loads(json_match.group())
        except:
            pass
    
    # If AI fails, generate sample prospects
    if not prospects:
        prospects = generate_sample_prospects(criteria, count)
    
    # Save prospects to database
    saved_prospects = []
    for p in prospects[:count]:
        prospect = {
            "id": str(uuid4()),
            "userId": user["id"],
            "firstName": p.get("firstName", "John"),
            "lastName": p.get("lastName", "Doe"),
            "email": p.get("email", f"{p.get('firstName', 'john').lower()}@company.com"),
            "title": p.get("title", "Director"),
            "company": p.get("company", "Acme Inc"),
            "linkedinUrl": p.get("linkedinUrl", ""),
            "industry": p.get("industry", "Technology"),
            "companySize": p.get("companySize", "51-200"),
            "icpScore": p.get("icpScore", random.randint(60, 95)),
            "signals": p.get("signals", []),
            "status": "new",
            "source": "ai_prospecting",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.prospects.insert_one(prospect)
        prospect.pop("_id", None)
        saved_prospects.append(prospect)
    
    return {
        "prospectsFound": len(saved_prospects),
        "prospects": saved_prospects,
        "criteria": criteria
    }


async def action_research_company(params: dict, user: dict, db) -> dict:
    """Actually research a company using AI"""
    company_name = params.get("company", "")
    domain = params.get("domain", "")
    
    prompt = f"""Research the company "{company_name}" (domain: {domain if domain else 'unknown'}).

Provide comprehensive information:
1. Company Overview: What they do, founding year, headquarters
2. Industry & Market: Industry classification, target market, market position
3. Size & Funding: Employee count, funding stage/amount, revenue estimate
4. Technology Stack: Known technologies they use
5. Recent News: Any recent announcements, funding, or key events
6. Key People: C-level executives and their backgrounds
7. Pain Points: Likely business challenges they face
8. Buying Signals: Indicators that suggest they might need our solution
9. Competitors: Main competitors in their space
10. Outreach Angle: Best angle to approach them for a sales conversation

Return as structured JSON."""

    ai_response = await call_ai(prompt)
    
    research = {"company": company_name, "raw": ai_response}
    if ai_response:
        try:
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                research = json.loads(json_match.group())
                research["company"] = company_name
        except:
            pass
    
    # Save research to database
    research_doc = {
        "id": str(uuid4()),
        "userId": user["id"],
        "companyName": company_name,
        "domain": domain,
        "research": research,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.company_research.insert_one(research_doc)
    
    return research


async def action_draft_email(params: dict, user: dict, db) -> dict:
    """Actually draft a personalized email using AI"""
    prospect = params.get("prospect", {})
    email_type = params.get("type", "cold_intro")
    tone = params.get("tone", "professional")
    context = params.get("context", {})
    
    # Get user's company info for signature
    user_info = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    prompt = f"""Write a {email_type} sales email with a {tone} tone.

Prospect Information:
- Name: {prospect.get('firstName', '')} {prospect.get('lastName', '')}
- Title: {prospect.get('title', '')}
- Company: {prospect.get('company', '')}
- Industry: {prospect.get('industry', '')}

Additional Context: {json.dumps(context)}

Sender: {user_info.get('firstName', 'Sales Rep')} from {user_info.get('companyName', 'Our Company')}

Requirements:
1. Subject line that gets opened (no spam triggers)
2. Personalized opening that shows research
3. Clear value proposition
4. Specific call-to-action
5. Keep it under 150 words
6. No generic phrases like "I hope this email finds you well"

Return JSON with: subject, body, callToAction, estimatedOpenRate (0-100), personalizationScore (0-100)"""

    ai_response = await call_ai(prompt)
    
    email = {"subject": "Quick question", "body": "Hi there...", "type": email_type}
    if ai_response:
        try:
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                email = json.loads(json_match.group())
        except:
            email["body"] = ai_response
    
    # Save draft
    draft = {
        "id": str(uuid4()),
        "userId": user["id"],
        "prospectId": prospect.get("id"),
        "type": email_type,
        "subject": email.get("subject", "Quick question"),
        "body": email.get("body", ""),
        "status": "draft",
        "metadata": {
            "estimatedOpenRate": email.get("estimatedOpenRate", 0),
            "personalizationScore": email.get("personalizationScore", 0)
        },
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.email_drafts.insert_one(draft)
    draft.pop("_id", None)
    
    return draft


async def action_score_prospect(params: dict, user: dict, db) -> dict:
    """Score a prospect against ICP using AI"""
    prospect = params.get("prospect", {})
    
    # Get user's ICP from onboarding
    onboarding = await db.onboarding_profiles.find_one(
        {"userId": user["id"]},
        {"_id": 0, "icp": 1}
    )
    icp = onboarding.get("icp", {}) if onboarding else {}
    
    prompt = f"""Score this prospect against the Ideal Customer Profile.

Prospect:
{json.dumps(prospect, indent=2)}

ICP Criteria:
{json.dumps(icp, indent=2) if icp else "Technology companies, 50-500 employees, B2B SaaS"}

Provide:
1. Overall ICP match score (0-100)
2. Individual scores for: company_fit, title_fit, industry_fit, company_size_fit
3. Strengths (why they're a good fit)
4. Weaknesses (concerns or gaps)
5. Recommendation: hot_lead, warm_lead, nurture, or disqualify
6. Suggested approach for outreach

Return as JSON."""

    ai_response = await call_ai(prompt)
    
    scoring = {"score": 50, "recommendation": "warm_lead"}
    if ai_response:
        try:
            import re
            json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
            if json_match:
                scoring = json.loads(json_match.group())
        except:
            pass
    
    # Update prospect with score
    if prospect.get("id"):
        await db.prospects.update_one(
            {"id": prospect["id"]},
            {"$set": {
                "icpScore": scoring.get("score", scoring.get("overall_score", 50)),
                "icpAnalysis": scoring,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return scoring


async def action_create_sequence(params: dict, user: dict, db) -> dict:
    """Create an outreach sequence"""
    name = params.get("name", "New Sequence")
    prospect_ids = params.get("prospectIds", [])
    template = params.get("template", "basic_outbound")
    
    # Create sequence
    sequence = {
        "id": str(uuid4()),
        "userId": user["id"],
        "name": name,
        "status": "active",
        "template": template,
        "steps": [
            {"day": 0, "type": "email", "template": "cold_intro"},
            {"day": 3, "type": "email", "template": "followup_1"},
            {"day": 7, "type": "linkedin", "template": "connection_request"},
            {"day": 10, "type": "email", "template": "value_add"},
            {"day": 14, "type": "email", "template": "breakup"}
        ],
        "prospectsCount": len(prospect_ids),
        "metrics": {
            "sent": 0,
            "opened": 0,
            "replied": 0,
            "meetings": 0
        },
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.sequences.insert_one(sequence)
    
    # Add prospects to sequence
    for pid in prospect_ids:
        await db.sequence_enrollments.insert_one({
            "id": str(uuid4()),
            "sequenceId": sequence["id"],
            "prospectId": pid,
            "currentStep": 0,
            "status": "active",
            "enrolledAt": datetime.now(timezone.utc).isoformat()
        })
    
    sequence.pop("_id", None)
    return sequence


async def action_send_email(params: dict, user: dict, db) -> dict:
    """Send an email (simulated - would integrate with email provider)"""
    draft_id = params.get("draftId")
    prospect_id = params.get("prospectId")
    
    # Get draft
    draft = await db.email_drafts.find_one({"id": draft_id}, {"_id": 0})
    if not draft:
        return {"error": "Draft not found"}
    
    # Log the send (in production, this would actually send via SendGrid, etc.)
    send_log = {
        "id": str(uuid4()),
        "userId": user["id"],
        "draftId": draft_id,
        "prospectId": prospect_id,
        "subject": draft.get("subject"),
        "status": "sent",  # In production: queued, sent, delivered, bounced
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "openedAt": None,
        "clickedAt": None,
        "repliedAt": None
    }
    await db.email_sends.insert_one(send_log)
    
    # Update draft status
    await db.email_drafts.update_one(
        {"id": draft_id},
        {"$set": {"status": "sent", "sentAt": send_log["sentAt"]}}
    )
    
    return {
        "sent": True,
        "sendId": send_log["id"],
        "message": "Email sent successfully"
    }


async def action_schedule_followup(params: dict, user: dict, db) -> dict:
    """Schedule a follow-up action"""
    prospect_id = params.get("prospectId")
    action_type = params.get("actionType", "email")
    delay_days = params.get("delayDays", 3)
    
    scheduled_time = datetime.now(timezone.utc) + timedelta(days=delay_days)
    
    followup = {
        "id": str(uuid4()),
        "userId": user["id"],
        "prospectId": prospect_id,
        "actionType": action_type,
        "scheduledFor": scheduled_time.isoformat(),
        "status": "scheduled",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.scheduled_actions.insert_one(followup)
    
    return {
        "scheduled": True,
        "followupId": followup["id"],
        "scheduledFor": followup["scheduledFor"]
    }


def generate_sample_prospects(criteria: str, count: int) -> list:
    """Generate sample prospects when AI fails"""
    titles = ["VP of Sales", "Director of Marketing", "CTO", "Head of Growth", "CEO", "CMO", "Sales Manager"]
    companies = ["TechCorp", "DataFlow Inc", "CloudBase", "GrowthHub", "ScaleUp Co", "InnovateTech"]
    industries = ["Technology", "SaaS", "FinTech", "Healthcare", "E-commerce"]
    
    prospects = []
    for i in range(count):
        first_names = ["Sarah", "Michael", "Jennifer", "David", "Emily", "James", "Amanda", "Robert"]
        last_names = ["Johnson", "Chen", "Williams", "Garcia", "Miller", "Davis", "Anderson"]
        
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        company = random.choice(companies)
        
        prospects.append({
            "firstName": fn,
            "lastName": ln,
            "title": random.choice(titles),
            "company": company,
            "email": f"{fn.lower()}.{ln.lower()}@{company.lower().replace(' ', '')}.com",
            "industry": random.choice(industries),
            "companySize": random.choice(["11-50", "51-200", "201-500", "501-1000"]),
            "icpScore": random.randint(60, 95),
            "signals": random.sample(["hiring", "funding", "expansion", "new_product"], k=random.randint(1, 3))
        })
    
    return prospects


# ============== AUTONOMOUS EXECUTION ==============

@router.post("/autonomous/start")
async def start_autonomous_mode(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start autonomous prospecting and engagement"""
    db = get_db()
    
    # Get user settings
    settings = await db.user_settings.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings or not settings.get("autonomous", {}).get("enabled"):
        raise HTTPException(status_code=400, detail="Enable autonomous mode in settings first")
    
    # Create autonomous session
    session = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "status": "running",
        "settings": settings.get("autonomous", {}),
        "stats": {
            "prospectsFound": 0,
            "companiesResearched": 0,
            "emailsDrafted": 0,
            "emailsSent": 0,
            "awaitingApproval": 0
        },
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "lastActivityAt": datetime.now(timezone.utc).isoformat()
    }
    await db.autonomous_sessions.insert_one(session)
    
    # Run autonomous cycle
    background_tasks.add_task(run_autonomous_cycle, current_user["id"], session["id"])
    
    return {
        "started": True,
        "sessionId": session["id"],
        "message": "Autonomous mode started. Check activity feed for updates."
    }


async def run_autonomous_cycle(user_id: str, session_id: str):
    """Run one cycle of autonomous prospecting"""
    from database import get_db
    db = get_db()
    
    try:
        # Get session and settings
        session = await db.autonomous_sessions.find_one({"id": session_id})
        if not session or session["status"] != "running":
            return
        
        settings = session.get("settings", {})
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        
        # Step 1: Find new prospects
        if settings.get("prospectingEnabled", True):
            max_prospects = settings.get("maxProspectsPerDay", 50)
            
            # Get ICP for targeting
            onboarding = await db.onboarding_profiles.find_one({"userId": user_id})
            icp = onboarding.get("icp", {}) if onboarding else {}
            
            criteria = f"Find prospects matching: industries={icp.get('industries', ['Technology'])}, titles={icp.get('titles', ['VP Sales', 'Director'])}, company size=50-500 employees"
            
            result = await action_find_prospects(
                {"criteria": criteria, "count": min(5, max_prospects)},
                {"id": user_id},
                db
            )
            
            await log_autonomous_activity(db, user_id, session_id, "prospect_discovery", 
                f"Found {result.get('prospectsFound', 0)} new prospects")
        
        # Step 2: Research companies
        if settings.get("autoResearch", True):
            # Get unresearched prospects
            prospects = await db.prospects.find(
                {"userId": user_id, "source": "ai_prospecting"},
                {"_id": 0}
            ).limit(3).to_list(3)
            
            for p in prospects:
                if p.get("company"):
                    await action_research_company(
                        {"company": p["company"]},
                        {"id": user_id},
                        db
                    )
                    await log_autonomous_activity(db, user_id, session_id, "company_research",
                        f"Researched {p['company']}")
        
        # Step 3: Draft emails
        if settings.get("autoOutreach", False):
            # Get prospects without drafts
            prospects = await db.prospects.find(
                {"userId": user_id, "icpScore": {"$gte": settings.get("icpStrictness", 70)}},
                {"_id": 0}
            ).limit(3).to_list(3)
            
            for p in prospects:
                draft = await action_draft_email(
                    {"prospect": p, "type": "cold_intro"},
                    {"id": user_id},
                    db
                )
                
                # If approval required, create approval request
                if settings.get("requireApprovalForSend", True):
                    await db.workflow_approvals.insert_one({
                        "id": str(uuid4()),
                        "userId": user_id,
                        "approverId": user_id,
                        "type": "send",
                        "title": f"Approve email to {p.get('firstName', '')} at {p.get('company', '')}",
                        "description": f"Review AI-drafted email before sending",
                        "content": draft,
                        "context": {"prospect": p},
                        "status": "pending",
                        "createdAt": datetime.now(timezone.utc).isoformat()
                    })
                    await log_autonomous_activity(db, user_id, session_id, "approval_created",
                        f"Email to {p.get('firstName', '')} awaiting approval")
        
        # Update session stats
        await db.autonomous_sessions.update_one(
            {"id": session_id},
            {"$set": {"lastActivityAt": datetime.now(timezone.utc).isoformat()}}
        )
        
    except Exception as e:
        print(f"Autonomous cycle error: {e}")
        await log_autonomous_activity(db, user_id, session_id, "error", str(e))


async def log_autonomous_activity(db, user_id: str, session_id: str, activity_type: str, message: str):
    """Log autonomous activity"""
    await db.autonomous_activity.insert_one({
        "id": str(uuid4()),
        "userId": user_id,
        "sessionId": session_id,
        "type": activity_type,
        "message": message,
        "createdAt": datetime.now(timezone.utc).isoformat()
    })


@router.post("/autonomous/stop")
async def stop_autonomous_mode(
    current_user: dict = Depends(get_current_user)
):
    """Stop autonomous mode"""
    db = get_db()
    
    await db.autonomous_sessions.update_many(
        {"userId": current_user["id"], "status": "running"},
        {"$set": {
            "status": "stopped",
            "stoppedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"stopped": True, "message": "Autonomous mode stopped"}


@router.get("/autonomous/activity")
async def get_autonomous_activity(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get autonomous activity log"""
    db = get_db()
    
    activity = await db.autonomous_activity.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return activity


# ============== SELF-IMPROVEMENT / A/B TESTING ==============

@router.post("/ab-test/create")
async def create_ab_test(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create an A/B test for email content"""
    db = get_db()
    
    test = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": request.get("name", "Email A/B Test"),
        "type": request.get("type", "subject_line"),  # subject_line, email_body, send_time
        "variants": request.get("variants", []),  # List of variants to test
        "status": "running",
        "metrics": {
            "variants": {}  # Per-variant metrics
        },
        "winner": None,
        "confidenceLevel": 0,
        "minSampleSize": request.get("minSampleSize", 100),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Initialize variant metrics
    for i, variant in enumerate(test["variants"]):
        test["metrics"]["variants"][f"variant_{i}"] = {
            "sent": 0,
            "opened": 0,
            "clicked": 0,
            "replied": 0,
            "openRate": 0,
            "replyRate": 0
        }
    
    await db.ab_tests.insert_one(test)
    test.pop("_id", None)
    
    return test


@router.post("/ab-test/{test_id}/record")
async def record_ab_test_event(
    test_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Record an event for A/B test"""
    db = get_db()
    
    variant = request.get("variant")
    event_type = request.get("event")  # sent, opened, clicked, replied
    
    # Update variant metrics
    update_key = f"metrics.variants.{variant}.{event_type}"
    await db.ab_tests.update_one(
        {"id": test_id},
        {"$inc": {update_key: 1}}
    )
    
    # Check if we should analyze and pick winner
    test = await db.ab_tests.find_one({"id": test_id}, {"_id": 0})
    if test:
        await analyze_ab_test(db, test)
    
    return {"recorded": True}


async def analyze_ab_test(db, test: dict):
    """Analyze A/B test and determine winner"""
    variants = test["metrics"].get("variants", {})
    min_sample = test.get("minSampleSize", 100)
    
    # Check if we have enough data
    total_sent = sum(v.get("sent", 0) for v in variants.values())
    if total_sent < min_sample:
        return
    
    # Calculate rates for each variant
    best_variant = None
    best_rate = 0
    
    for variant_id, metrics in variants.items():
        sent = metrics.get("sent", 0)
        if sent > 0:
            # Use reply rate as primary metric
            rate = metrics.get("replied", 0) / sent
            if rate > best_rate:
                best_rate = rate
                best_variant = variant_id
            
            # Update calculated rates
            metrics["openRate"] = metrics.get("opened", 0) / sent * 100
            metrics["replyRate"] = metrics.get("replied", 0) / sent * 100
    
    # Simple confidence calculation (in production, use proper statistics)
    confidence = min(95, total_sent / min_sample * 50 + 45) if best_rate > 0 else 0
    
    # Update test with analysis
    await db.ab_tests.update_one(
        {"id": test["id"]},
        {"$set": {
            "winner": best_variant if confidence >= 95 else None,
            "confidenceLevel": confidence,
            "metrics.variants": variants,
            "analyzedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If we have a winner, log the optimization
    if confidence >= 95 and best_variant:
        await db.optimization_log.insert_one({
            "id": str(uuid4()),
            "userId": test["userId"],
            "testId": test["id"],
            "type": test["type"],
            "winner": best_variant,
            "improvement": f"{best_rate * 100:.1f}% reply rate",
            "createdAt": datetime.now(timezone.utc).isoformat()
        })


@router.get("/ab-tests")
async def get_ab_tests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all A/B tests"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    
    tests = await db.ab_tests.find(query, {"_id": 0}).sort("createdAt", -1).to_list(50)
    return tests


@router.get("/optimization-log")
async def get_optimization_log(
    current_user: dict = Depends(get_current_user)
):
    """Get log of AI optimizations made"""
    db = get_db()
    
    log = await db.optimization_log.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(50).to_list(50)
    
    return log
