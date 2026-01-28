"""
Autonomous Prospecting Mode - Meta-Cognitive Sales AI Engine

Implements the DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT framework
for fully autonomous prospecting with continuous learning.

Architecture inspired by AutoGPT (goal decomposition, task queues) and 
MoltBot (adaptive learning, multi-agent coordination).
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import asyncio
import re

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ============== META-COGNITIVE FRAMEWORK ==============

class MetaCognitivePhase:
    """Phases of the meta-cognitive reasoning process"""
    DECOMPOSE = "decompose"    # Break goal into sub-tasks
    SOLVE = "solve"            # Execute sub-tasks
    VERIFY = "verify"          # Validate results
    SYNTHESIZE = "synthesize"  # Combine results
    REFLECT = "reflect"        # Learn and improve


# ============== COMPETITOR INTELLIGENCE SOURCES ==============

COMPETITOR_SOURCES = {
    "gong": {
        "name": "Gong",
        "domain": "gong.io",
        "type": "conversation_intelligence",
        "scrape_paths": ["/", "/solutions", "/blog", "/resources"],
        "learn_topics": ["conversation_patterns", "objection_handling", "closing_techniques"]
    },
    "outreach": {
        "name": "Outreach",
        "domain": "outreach.io",
        "type": "sales_engagement",
        "scrape_paths": ["/", "/platform", "/resources", "/blog"],
        "learn_topics": ["sequence_patterns", "timing_optimization", "personalization"]
    },
    "zoominfo": {
        "name": "ZoomInfo",
        "domain": "zoominfo.com",
        "type": "data_intelligence",
        "scrape_paths": ["/", "/solutions", "/resources"],
        "learn_topics": ["data_enrichment", "icp_targeting", "intent_signals"]
    },
    "salesloft": {
        "name": "SalesLoft",
        "domain": "salesloft.com",
        "type": "sales_engagement",
        "scrape_paths": ["/", "/platform", "/resources"],
        "learn_topics": ["cadence_optimization", "engagement_tracking", "ai_coaching"]
    },
    "apollo": {
        "name": "Apollo.io",
        "domain": "apollo.io",
        "type": "prospecting",
        "scrape_paths": ["/", "/product", "/blog"],
        "learn_topics": ["lead_scoring", "email_sequences", "data_sourcing"]
    },
    "regie": {
        "name": "Regie.ai",
        "domain": "regie.ai",
        "type": "ai_content",
        "scrape_paths": ["/", "/platform", "/resources"],
        "learn_topics": ["ai_copywriting", "personalization_at_scale", "brand_voice"]
    }
}


# ============== AI HELPER ==============

async def call_ai(prompt: str, system_instruction: str = None) -> str:
    """Call Gemini AI for meta-cognitive reasoning"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"meta-{str(uuid4())[:8]}"
        system_msg = system_instruction or "You are a meta-cognitive sales AI with deep reasoning capabilities."
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        print(f"AI call error: {e}")
        return None


# ============== BASIC AUTOMATION LOOPS ==============

class ProspectingLoop:
    """Base class for modular automation loops"""
    
    def __init__(self, loop_id: str, user_id: str, db):
        self.loop_id = loop_id
        self.user_id = user_id
        self.db = db
        self.status = "idle"
        self.iterations = 0
        self.results = []
        
    async def run(self, params: dict) -> dict:
        """Override in subclass"""
        raise NotImplementedError
        
    async def log_activity(self, activity_type: str, message: str, data: dict = None):
        """Log loop activity"""
        await self.db.autonomous_activity.insert_one({
            "id": str(uuid4()),
            "userId": self.user_id,
            "loopId": self.loop_id,
            "type": activity_type,
            "message": message,
            "data": data or {},
            "createdAt": datetime.now(timezone.utc).isoformat()
        })


# ============== LOOP 1: DISCOVERY LOOP ==============

async def run_discovery_loop(user_id: str, params: dict, db) -> dict:
    """
    Discovery Loop - Find new prospects matching ICP
    
    Phases:
    1. DECOMPOSE: Break down ICP into searchable criteria
    2. SOLVE: Search web for matching prospects
    3. VERIFY: Validate prospect data quality
    4. SYNTHESIZE: Compile verified prospect list
    5. REFLECT: Update search strategy based on results
    """
    loop_id = str(uuid4())
    results = {
        "loopId": loop_id,
        "loopType": "discovery",
        "phases": {},
        "prospects": [],
        "learnings": []
    }
    
    # Get ICP
    onboarding = await db.onboarding_profiles.find_one(
        {"userId": user_id}, {"_id": 0}
    )
    icp = onboarding.get("icp", {}) if onboarding else {}
    target_count = params.get("count", 10)
    
    # === PHASE 1: DECOMPOSE ===
    decompose_prompt = f"""Decompose this ICP into specific, searchable criteria:

ICP: {json.dumps(icp) if icp else "B2B SaaS companies, 50-500 employees, revenue $5M-$50M"}

Additional context: {params.get('context', 'Looking for companies that would benefit from sales automation')}

Return JSON with:
- search_queries: List of 3-5 specific search queries
- job_titles: Target titles to find
- industries: Target industries
- company_signals: Buying signals to look for
- exclusion_criteria: What to avoid
"""
    
    decompose_result = await call_ai(decompose_prompt)
    decompose_data = {}
    if decompose_result:
        try:
            json_match = re.search(r'\{.*\}', decompose_result, re.DOTALL)
            if json_match:
                decompose_data = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    results["phases"]["decompose"] = {
        "status": "complete",
        "output": decompose_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 2: SOLVE ===
    search_queries = decompose_data.get("search_queries", [
        "B2B SaaS companies hiring sales team",
        "Series A funded technology startups",
        "Growing tech companies VP Sales"
    ])
    
    all_prospects = []
    for query in search_queries[:3]:  # Limit to 3 queries per loop
        solve_prompt = f"""Find {target_count // 3 + 1} REAL prospects for: {query}

For each prospect provide:
- firstName, lastName
- title (job title)
- company (company name)
- email (pattern: firstname.lastname@companydomain.com)
- linkedinUrl
- industry
- companySize
- signals (buying signals)
- confidence (0-100)

Return as JSON array."""

        solve_result = await call_ai(solve_prompt)
        if solve_result:
            try:
                json_match = re.search(r'\[.*\]', solve_result, re.DOTALL)
                if json_match:
                    prospects = json.loads(json_match.group())
                    all_prospects.extend(prospects)
            except (json.JSONDecodeError, ValueError):
                pass
    
    results["phases"]["solve"] = {
        "status": "complete",
        "queriesExecuted": len(search_queries[:3]),
        "rawProspectsFound": len(all_prospects),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 3: VERIFY ===
    verified_prospects = []
    for p in all_prospects[:target_count * 2]:  # Verify more than needed
        # Basic verification
        has_required = all([
            p.get("firstName"),
            p.get("lastName"),
            p.get("company"),
            p.get("email") or p.get("linkedinUrl")
        ])
        
        # Email pattern validation
        email = p.get("email", "")
        valid_email = bool(re.match(r'^[\w\.\-]+@[\w\.\-]+\.\w+$', email)) if email else False
        
        confidence = p.get("confidence", 50)
        
        if has_required and (valid_email or p.get("linkedinUrl")) and confidence >= 60:
            p["verified"] = True
            p["verificationScore"] = min(100, confidence + (10 if valid_email else 0))
            verified_prospects.append(p)
    
    results["phases"]["verify"] = {
        "status": "complete",
        "verifiedCount": len(verified_prospects),
        "rejectedCount": len(all_prospects) - len(verified_prospects),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 4: SYNTHESIZE ===
    # Dedupe and rank
    seen_emails = set()
    unique_prospects = []
    for p in verified_prospects:
        email = p.get("email", "").lower()
        if email and email not in seen_emails:
            seen_emails.add(email)
            unique_prospects.append(p)
        elif not email:
            unique_prospects.append(p)
    
    # Sort by verification score
    unique_prospects.sort(key=lambda x: x.get("verificationScore", 0), reverse=True)
    final_prospects = unique_prospects[:target_count]
    
    # Save to database
    saved_ids = []
    for p in final_prospects:
        prospect_doc = {
            "id": str(uuid4()),
            "userId": user_id,
            "firstName": p.get("firstName", ""),
            "lastName": p.get("lastName", ""),
            "email": p.get("email", ""),
            "title": p.get("title", ""),
            "company": p.get("company", ""),
            "linkedinUrl": p.get("linkedinUrl", ""),
            "industry": p.get("industry", ""),
            "companySize": p.get("companySize", ""),
            "icpScore": p.get("verificationScore", 70),
            "signals": p.get("signals", []),
            "status": "new",
            "source": "autonomous_discovery",
            "loopId": loop_id,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.prospects.insert_one(prospect_doc)
        saved_ids.append(prospect_doc["id"])
    
    results["phases"]["synthesize"] = {
        "status": "complete",
        "finalProspectCount": len(final_prospects),
        "savedProspectIds": saved_ids,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    results["prospects"] = saved_ids
    
    # === PHASE 5: REFLECT ===
    reflect_prompt = f"""Analyze these prospecting results and provide learnings:

Queries used: {search_queries[:3]}
Prospects found: {len(all_prospects)}
Verified: {len(verified_prospects)}
Final saved: {len(final_prospects)}

Average confidence: {sum(p.get('confidence', 0) for p in final_prospects) / max(len(final_prospects), 1):.1f}
Top industries found: {list(set(p.get('industry', '') for p in final_prospects[:5]))}

Provide JSON with:
- effectiveness_score: 0-100 rating of this search
- successful_queries: Which queries worked best
- failed_queries: Which queries didn't work
- recommendations: How to improve next time
- new_queries_to_try: Suggested new search queries
"""
    
    reflect_result = await call_ai(reflect_prompt)
    reflect_data = {}
    if reflect_result:
        try:
            json_match = re.search(r'\{.*\}', reflect_result, re.DOTALL)
            if json_match:
                reflect_data = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    results["phases"]["reflect"] = {
        "status": "complete",
        "learnings": reflect_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    results["learnings"] = reflect_data.get("recommendations", [])
    
    # Save learnings for continuous improvement
    await db.autonomous_learnings.insert_one({
        "id": str(uuid4()),
        "userId": user_id,
        "loopId": loop_id,
        "loopType": "discovery",
        "learnings": reflect_data,
        "effectiveness": reflect_data.get("effectiveness_score", 50),
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return results


# ============== LOOP 2: RESEARCH LOOP ==============

async def run_research_loop(user_id: str, params: dict, db) -> dict:
    """
    Research Loop - Deep research on prospects/companies
    
    Phases:
    1. DECOMPOSE: Identify research questions
    2. SOLVE: Gather information from multiple sources
    3. VERIFY: Cross-validate facts
    4. SYNTHESIZE: Create comprehensive profile
    5. REFLECT: Identify outreach angles
    """
    loop_id = str(uuid4())
    results = {
        "loopId": loop_id,
        "loopType": "research",
        "phases": {},
        "profiles": [],
        "learnings": []
    }
    
    # Get prospects to research
    prospect_ids = params.get("prospectIds", [])
    if not prospect_ids:
        # Get unresearched prospects
        prospects = await db.prospects.find(
            {"userId": user_id, "researched": {"$ne": True}},
            {"_id": 0}
        ).limit(params.get("count", 5)).to_list(params.get("count", 5))
    else:
        prospects = await db.prospects.find(
            {"userId": user_id, "id": {"$in": prospect_ids}},
            {"_id": 0}
        ).to_list(len(prospect_ids))
    
    if not prospects:
        return {"loopId": loop_id, "loopType": "research", "message": "No prospects to research"}
    
    # === PHASE 1: DECOMPOSE ===
    companies = list(set(p.get("company", "") for p in prospects if p.get("company")))
    
    decompose_prompt = f"""For researching these companies for B2B sales outreach, identify key research questions:

Companies: {companies[:5]}

Return JSON with:
- company_questions: Questions about company (size, funding, tech stack, challenges)
- decision_maker_questions: Questions about the person (background, responsibilities, priorities)
- timing_questions: Questions about buying timing (budget cycle, initiatives, triggers)
- competitive_questions: What solutions might they already use
"""
    
    decompose_result = await call_ai(decompose_prompt)
    decompose_data = {}
    if decompose_result:
        try:
            json_match = re.search(r'\{.*\}', decompose_result, re.DOTALL)
            if json_match:
                decompose_data = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    results["phases"]["decompose"] = {
        "status": "complete",
        "companiesTargeted": len(companies),
        "researchQuestions": decompose_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 2: SOLVE ===
    research_results = []
    for company in companies[:5]:
        solve_prompt = f"""Research {company} and provide comprehensive sales intelligence:

Research areas:
{json.dumps(decompose_data, indent=2)}

Provide JSON with:
- companyOverview: What they do
- industry: Primary industry
- employeeCount: Estimated employees
- fundingStage: Funding status if known
- recentNews: Any recent announcements
- techStack: Technologies they use
- painPoints: Likely business challenges
- competitors: Main competitors
- buyingSignals: Signs they need our solution
- outreachAngle: Best angle to approach them
- keyPeople: Key decision makers
- timing: Best timing considerations
"""
        
        research = await call_ai(solve_prompt)
        if research:
            try:
                json_match = re.search(r'\{.*\}', research, re.DOTALL)
                if json_match:
                    company_data = json.loads(json_match.group())
                    company_data["company"] = company
                    research_results.append(company_data)
            except (json.JSONDecodeError, ValueError):
                research_results.append({"company": company, "raw": research})
    
    results["phases"]["solve"] = {
        "status": "complete",
        "companiesResearched": len(research_results),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 3: VERIFY ===
    verified_research = []
    for r in research_results:
        # Check completeness
        has_overview = bool(r.get("companyOverview"))
        has_outreach = bool(r.get("outreachAngle"))
        has_signals = bool(r.get("buyingSignals"))
        
        completeness = sum([has_overview, has_outreach, has_signals]) / 3 * 100
        r["completenessScore"] = completeness
        r["verified"] = completeness >= 60
        
        if r["verified"]:
            verified_research.append(r)
    
    results["phases"]["verify"] = {
        "status": "complete",
        "verifiedCount": len(verified_research),
        "avgCompleteness": sum(r.get("completenessScore", 0) for r in research_results) / max(len(research_results), 1),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # === PHASE 4: SYNTHESIZE ===
    # Save research and update prospects
    saved_profiles = []
    for research in verified_research:
        company_name = research.get("company", "")
        
        # Save company research
        profile_id = str(uuid4())
        await db.company_research.insert_one({
            "id": profile_id,
            "userId": user_id,
            "loopId": loop_id,
            "companyName": company_name,
            "research": research,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        saved_profiles.append(profile_id)
        
        # Update matching prospects
        await db.prospects.update_many(
            {"userId": user_id, "company": company_name},
            {"$set": {
                "researched": True,
                "researchId": profile_id,
                "outreachAngle": research.get("outreachAngle", ""),
                "buyingSignals": research.get("buyingSignals", []),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    results["phases"]["synthesize"] = {
        "status": "complete",
        "profilesSaved": len(saved_profiles),
        "prospectsUpdated": len(prospects),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    results["profiles"] = saved_profiles
    
    # === PHASE 5: REFLECT ===
    reflect_prompt = f"""Analyze research results and identify patterns:

Companies researched: {[r.get('company') for r in verified_research]}
Industries found: {list(set(r.get('industry', '') for r in verified_research))}
Common pain points: {[r.get('painPoints', []) for r in verified_research]}

Provide JSON with:
- pattern_insights: Common patterns across companies
- best_outreach_angles: Most promising approaches
- timing_recommendations: When to reach out
- content_suggestions: What to emphasize in outreach
- follow_up_research: Additional research needed
"""
    
    reflect_result = await call_ai(reflect_prompt)
    reflect_data = {}
    if reflect_result:
        try:
            json_match = re.search(r'\{.*\}', reflect_result, re.DOTALL)
            if json_match:
                reflect_data = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    results["phases"]["reflect"] = {
        "status": "complete",
        "insights": reflect_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    results["learnings"] = reflect_data.get("pattern_insights", [])
    
    return results


# ============== LOOP 3: OUTREACH LOOP ==============

async def run_outreach_loop(user_id: str, params: dict, db) -> dict:
    """
    Outreach Loop - Generate personalized outreach content
    
    Phases:
    1. DECOMPOSE: Analyze prospect for personalization angles
    2. SOLVE: Generate multiple email variations
    3. VERIFY: Check quality and compliance
    4. SYNTHESIZE: Select best version
    5. REFLECT: Learn what personalization works
    """
    loop_id = str(uuid4())
    results = {
        "loopId": loop_id,
        "loopType": "outreach",
        "phases": {},
        "drafts": [],
        "learnings": []
    }
    
    # Get prospects ready for outreach
    prospect_ids = params.get("prospectIds", [])
    if not prospect_ids:
        prospects = await db.prospects.find(
            {
                "userId": user_id,
                "researched": True,
                "status": {"$in": ["new", "researched"]}
            },
            {"_id": 0}
        ).limit(params.get("count", 5)).to_list(params.get("count", 5))
    else:
        prospects = await db.prospects.find(
            {"userId": user_id, "id": {"$in": prospect_ids}},
            {"_id": 0}
        ).to_list(len(prospect_ids))
    
    if not prospects:
        return {"loopId": loop_id, "loopType": "outreach", "message": "No prospects ready for outreach"}
    
    # Get user info for signature
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    generated_drafts = []
    
    for prospect in prospects:
        # === PHASE 1: DECOMPOSE ===
        decompose_prompt = f"""Analyze this prospect for personalization opportunities:

Prospect:
- Name: {prospect.get('firstName', '')} {prospect.get('lastName', '')}
- Title: {prospect.get('title', '')}
- Company: {prospect.get('company', '')}
- Industry: {prospect.get('industry', '')}
- Signals: {prospect.get('signals', [])}
- Outreach Angle: {prospect.get('outreachAngle', '')}

Provide JSON with:
- personalization_hooks: 3-5 specific things to reference
- pain_point_hypotheses: Likely challenges they face
- value_props: Which value props will resonate
- tone_recommendation: Formal, casual, urgent, etc.
- opening_strategies: 3 different opening approaches
- cta_options: Best call-to-action options
"""
        
        decompose_result = await call_ai(decompose_prompt)
        decompose_data = {}
        if decompose_result:
            try:
                json_match = re.search(r'\{.*\}', decompose_result, re.DOTALL)
                if json_match:
                    decompose_data = json.loads(json_match.group())
            except (json.JSONDecodeError, ValueError):
                pass
        
        # === PHASE 2: SOLVE ===
        solve_prompt = f"""Write 3 variations of a cold email to:
{prospect.get('firstName', '')} {prospect.get('lastName', '')}, {prospect.get('title', '')} at {prospect.get('company', '')}

Personalization data:
{json.dumps(decompose_data, indent=2)}

Sender: {user.get('firstName', 'Sales Rep')} from {user.get('companyName', 'Our Company')}

Requirements per email:
- Subject line (no spam triggers, under 50 chars)
- Body (under 100 words, personalized opening, clear value, specific CTA)
- Different angle for each variation

Return JSON with:
- variations: Array of 3 objects with subject, body, angle, estimated_response_rate
"""
        
        variations_result = await call_ai(solve_prompt)
        variations = []
        if variations_result:
            try:
                json_match = re.search(r'\{.*\}', variations_result, re.DOTALL)
                if json_match:
                    variations_data = json.loads(json_match.group())
                    variations = variations_data.get("variations", [])
            except (json.JSONDecodeError, ValueError):
                pass
        
        # === PHASE 3: VERIFY ===
        verified_variations = []
        for v in variations:
            # Check quality
            subject = v.get("subject", "")
            body = v.get("body", "")
            
            # Spam check
            spam_words = ["free", "act now", "limited time", "guaranteed", "winner"]
            has_spam = any(word in subject.lower() for word in spam_words)
            
            # Length check
            word_count = len(body.split())
            good_length = 30 <= word_count <= 150
            
            # Personalization check
            has_name = prospect.get("firstName", "").lower() in body.lower()
            has_company = prospect.get("company", "").lower() in body.lower()
            personalized = has_name or has_company
            
            quality_score = 0
            if not has_spam:
                quality_score += 30
            if good_length:
                quality_score += 30
            if personalized:
                quality_score += 40
            
            v["qualityScore"] = quality_score
            v["verified"] = quality_score >= 60
            
            if v["verified"]:
                verified_variations.append(v)
        
        # === PHASE 4: SYNTHESIZE ===
        if verified_variations:
            # Select best variation
            best = max(verified_variations, key=lambda x: x.get("qualityScore", 0))
            
            # Save draft
            draft = {
                "id": str(uuid4()),
                "userId": user_id,
                "loopId": loop_id,
                "prospectId": prospect.get("id"),
                "subject": best.get("subject"),
                "body": best.get("body"),
                "angle": best.get("angle"),
                "qualityScore": best.get("qualityScore"),
                "status": "draft",
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.email_drafts.insert_one(draft)
            generated_drafts.append(draft["id"])
            
            # Update prospect
            await db.prospects.update_one(
                {"id": prospect.get("id")},
                {"$set": {
                    "status": "draft_ready",
                    "latestDraftId": draft["id"],
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    results["phases"]["synthesize"] = {
        "status": "complete",
        "draftsGenerated": len(generated_drafts),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    results["drafts"] = generated_drafts
    
    # === PHASE 5: REFLECT ===
    results["phases"]["reflect"] = {
        "status": "complete",
        "prospectsProcessed": len(prospects),
        "successRate": len(generated_drafts) / max(len(prospects), 1) * 100,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    return results


# ============== LOOP 4: LEARNING LOOP ==============

async def run_learning_loop(user_id: str, params: dict, db) -> dict:
    """
    Learning Loop - Scrape competitors and learn techniques
    
    The AI decides what to research based on user's needs and
    scrapes competitor platforms for engagement techniques.
    """
    loop_id = str(uuid4())
    results = {
        "loopId": loop_id,
        "loopType": "learning",
        "sources_analyzed": [],
        "techniques_learned": [],
        "recommendations": []
    }
    
    # Get user's current performance
    user_stats = await db.email_sends.aggregate([
        {"$match": {"userId": user_id}},
        {"$group": {
            "_id": None,
            "totalSent": {"$sum": 1},
            "totalOpened": {"$sum": {"$cond": [{"$ne": ["$openedAt", None]}, 1, 0]}},
            "totalReplied": {"$sum": {"$cond": [{"$ne": ["$repliedAt", None]}, 1, 0]}}
        }}
    ]).to_list(1)
    
    stats = user_stats[0] if user_stats else {"totalSent": 0, "totalOpened": 0, "totalReplied": 0}
    
    # AI decides what to learn based on performance gaps
    decide_prompt = f"""Based on this user's sales performance, decide what they should learn:

Performance:
- Emails sent: {stats.get('totalSent', 0)}
- Open rate: {stats.get('totalOpened', 0) / max(stats.get('totalSent', 1), 1) * 100:.1f}%
- Reply rate: {stats.get('totalReplied', 0) / max(stats.get('totalSent', 1), 1) * 100:.1f}%

Available learning sources:
{json.dumps({k: v['learn_topics'] for k, v in COMPETITOR_SOURCES.items()}, indent=2)}

Determine:
1. What is their biggest weakness (opens, replies, or both)?
2. Which competitor sources would help most?
3. What specific techniques should we research?

Return JSON with:
- weakness_analysis: What needs improvement
- recommended_sources: Top 3 sources to learn from
- focus_topics: Specific techniques to learn
- expected_improvement: What improvement to expect
"""
    
    decision = await call_ai(decide_prompt)
    decision_data = {}
    if decision:
        try:
            json_match = re.search(r'\{.*\}', decision, re.DOTALL)
            if json_match:
                decision_data = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    results["decision"] = decision_data
    
    # Scrape selected sources
    recommended_sources = decision_data.get("recommended_sources", ["outreach", "gong", "apollo"])
    
    for source_key in recommended_sources[:3]:
        if source_key in COMPETITOR_SOURCES:
            source = COMPETITOR_SOURCES[source_key]
            
            # Simulate learning from source (in production, would scrape)
            learn_prompt = f"""Based on your knowledge of {source['name']} ({source['domain']}), 
extract key sales engagement techniques they recommend:

Focus on: {source['learn_topics']}

Provide JSON with:
- techniques: List of specific techniques with examples
- best_practices: Key best practices
- templates: Any template patterns they recommend
- metrics_to_track: What metrics they emphasize
- common_mistakes: Mistakes to avoid
"""
            
            learning = await call_ai(learn_prompt)
            learning_data = {}
            if learning:
                try:
                    json_match = re.search(r'\{.*\}', learning, re.DOTALL)
                    if json_match:
                        learning_data = json.loads(json_match.group())
                except (json.JSONDecodeError, ValueError):
                    pass
            
            results["sources_analyzed"].append({
                "source": source["name"],
                "domain": source["domain"],
                "learnings": learning_data
            })
            
            # Extract techniques
            techniques = learning_data.get("techniques", [])
            results["techniques_learned"].extend(techniques)
    
    # Synthesize recommendations
    synthesize_prompt = f"""Based on these learnings from sales platforms:

{json.dumps(results['sources_analyzed'], indent=2)}

Create specific, actionable recommendations for the user.

Return JSON with:
- immediate_actions: 3 things to implement now
- email_improvements: How to improve emails
- sequence_improvements: How to improve sequences
- timing_recommendations: Best times/cadences
- personalization_tips: How to personalize better
"""
    
    recommendations = await call_ai(synthesize_prompt)
    if recommendations:
        try:
            json_match = re.search(r'\{.*\}', recommendations, re.DOTALL)
            if json_match:
                results["recommendations"] = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Save learnings
    await db.autonomous_learnings.insert_one({
        "id": str(uuid4()),
        "userId": user_id,
        "loopId": loop_id,
        "loopType": "learning",
        "sources": results["sources_analyzed"],
        "techniques": results["techniques_learned"],
        "recommendations": results["recommendations"],
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return results


# ============== API ENDPOINTS ==============

@router.post("/loops/discovery")
async def execute_discovery_loop(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Execute a discovery loop to find new prospects"""
    db = get_db()
    
    # Run in background for large counts
    count = request.get("count", 10)
    if count > 20:
        background_tasks.add_task(
            run_discovery_loop,
            current_user["id"],
            request,
            db
        )
        return {
            "status": "running",
            "message": f"Discovery loop started for {count} prospects"
        }
    
    result = await run_discovery_loop(current_user["id"], request, db)
    return result


@router.post("/loops/research")
async def execute_research_loop(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a research loop on prospects/companies"""
    db = get_db()
    result = await run_research_loop(current_user["id"], request, db)
    return result


@router.post("/loops/outreach")
async def execute_outreach_loop(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute an outreach loop to generate personalized emails"""
    db = get_db()
    result = await run_outreach_loop(current_user["id"], request, db)
    return result


@router.post("/loops/learning")
async def execute_learning_loop(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a learning loop to improve from competitor techniques"""
    db = get_db()
    result = await run_learning_loop(current_user["id"], request, db)
    return result


# ============== COMBINED AUTONOMOUS MODE ==============

@router.post("/start")
async def start_autonomous_prospecting(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start the full autonomous prospecting engine.
    Combines all loops into a continuous cycle:
    Learning → Discovery → Research → Outreach → Learning...
    """
    db = get_db()
    
    # Create session
    session = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "status": "running",
        "config": {
            "prospectsPerCycle": request.get("prospectsPerCycle", 10),
            "learningEnabled": request.get("learningEnabled", True),
            "autoApprove": request.get("autoApprove", False),
            "maxCyclesPerDay": request.get("maxCyclesPerDay", 5)
        },
        "stats": {
            "cyclesCompleted": 0,
            "prospectsFound": 0,
            "companiesResearched": 0,
            "emailsDrafted": 0,
            "techniquesLearned": 0
        },
        "currentPhase": "initializing",
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "lastActivityAt": datetime.now(timezone.utc).isoformat()
    }
    await db.autonomous_sessions.insert_one(session)
    
    # Start the autonomous cycle in background
    background_tasks.add_task(
        run_autonomous_cycle_v2,
        current_user["id"],
        session["id"],
        db
    )
    
    return {
        "started": True,
        "sessionId": session["id"],
        "message": "Autonomous prospecting engine started",
        "config": session["config"]
    }


async def run_autonomous_cycle_v2(user_id: str, session_id: str, db):
    """Run one complete autonomous prospecting cycle"""
    try:
        session = await db.autonomous_sessions.find_one({"id": session_id})
        if not session or session["status"] != "running":
            return
        
        config = session.get("config", {})
        
        # Update phase
        await update_session_phase(db, session_id, "learning")
        
        # Step 1: Learn from competitors (if enabled)
        if config.get("learningEnabled", True):
            learning_result = await run_learning_loop(user_id, {}, db)
            await db.autonomous_sessions.update_one(
                {"id": session_id},
                {"$inc": {"stats.techniquesLearned": len(learning_result.get("techniques_learned", []))}}
            )
        
        # Update phase
        await update_session_phase(db, session_id, "discovery")
        
        # Step 2: Discover prospects
        discovery_result = await run_discovery_loop(
            user_id,
            {"count": config.get("prospectsPerCycle", 10)},
            db
        )
        await db.autonomous_sessions.update_one(
            {"id": session_id},
            {"$inc": {"stats.prospectsFound": len(discovery_result.get("prospects", []))}}
        )
        
        # Update phase
        await update_session_phase(db, session_id, "research")
        
        # Step 3: Research found prospects
        research_result = await run_research_loop(
            user_id,
            {"prospectIds": discovery_result.get("prospects", [])},
            db
        )
        await db.autonomous_sessions.update_one(
            {"id": session_id},
            {"$inc": {"stats.companiesResearched": len(research_result.get("profiles", []))}}
        )
        
        # Update phase
        await update_session_phase(db, session_id, "outreach")
        
        # Step 4: Generate outreach
        outreach_result = await run_outreach_loop(
            user_id,
            {"prospectIds": discovery_result.get("prospects", [])},
            db
        )
        await db.autonomous_sessions.update_one(
            {"id": session_id},
            {"$inc": {
                "stats.emailsDrafted": len(outreach_result.get("drafts", [])),
                "stats.cyclesCompleted": 1
            }}
        )
        
        # Update session
        await db.autonomous_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "currentPhase": "complete",
                "lastActivityAt": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Log completion
        await db.autonomous_activity.insert_one({
            "id": str(uuid4()),
            "userId": user_id,
            "sessionId": session_id,
            "type": "cycle_complete",
            "message": f"Cycle complete: {len(discovery_result.get('prospects', []))} prospects, {len(outreach_result.get('drafts', []))} drafts",
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        print(f"Autonomous cycle error: {e}")
        await db.autonomous_activity.insert_one({
            "id": str(uuid4()),
            "userId": user_id,
            "sessionId": session_id,
            "type": "error",
            "message": str(e),
            "createdAt": datetime.now(timezone.utc).isoformat()
        })


async def update_session_phase(db, session_id: str, phase: str):
    """Update session phase and log activity"""
    await db.autonomous_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "currentPhase": phase,
            "lastActivityAt": datetime.now(timezone.utc).isoformat()
        }}
    )


@router.post("/stop")
async def stop_autonomous_prospecting(
    current_user: dict = Depends(get_current_user)
):
    """Stop the autonomous prospecting engine"""
    db = get_db()
    
    result = await db.autonomous_sessions.update_many(
        {"userId": current_user["id"], "status": "running"},
        {"$set": {
            "status": "stopped",
            "stoppedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "stopped": True,
        "sessionsAffected": result.modified_count
    }


@router.get("/status")
async def get_autonomous_status(
    current_user: dict = Depends(get_current_user)
):
    """Get current autonomous prospecting status"""
    db = get_db()
    
    # Get active session
    session = await db.autonomous_sessions.find_one(
        {"userId": current_user["id"], "status": "running"},
        {"_id": 0}
    )
    
    # Get recent activity
    activity = await db.autonomous_activity.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(20).to_list(20)
    
    # Get learnings
    learnings = await db.autonomous_learnings.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(5).to_list(5)
    
    return {
        "activeSession": session,
        "recentActivity": activity,
        "recentLearnings": learnings,
        "isRunning": session is not None
    }


@router.get("/learnings")
async def get_learnings(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get accumulated learnings from autonomous mode"""
    db = get_db()
    
    learnings = await db.autonomous_learnings.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return learnings


@router.get("/competitor-sources")
async def get_competitor_sources():
    """Get available competitor sources for learning"""
    return [
        {"id": key, **value}
        for key, value in COMPETITOR_SOURCES.items()
    ]
