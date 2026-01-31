"""
Advanced Self-Improvement Loop

This module implements a continuous learning system that:
1. Analyzes email performance data (opens, clicks, replies)
2. Identifies winning patterns, phrases, and strategies
3. Automatically applies learnings to future email drafts
4. Tracks improvement over time

The system uses RAG (Retrieval Augmented Generation) to learn from:
- Historical email performance
- A/B test results
- Successful email patterns
- Industry best practices
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import re
from collections import defaultdict

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== AI HELPER ==============

async def call_ai(prompt: str, system_instruction: str = None) -> str:
    """Call Gemini AI for self-improvement analysis"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"self-improve-{str(uuid4())[:8]}"
        system_msg = system_instruction or "You are an expert email performance analyst specializing in B2B sales optimization."
        
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


# ============== PERFORMANCE LEARNING ENGINE ==============

class PerformanceLearningEngine:
    """
    Learns from email performance data and generates improvement rules.
    Uses pattern matching and AI to identify what works.
    """
    
    def __init__(self, user_id: str, db):
        self.user_id = user_id
        self.db = db
        self.patterns = {}
        self.rules = []
    
    async def analyze_all_performance(self) -> Dict:
        """Comprehensive analysis of all email performance"""
        
        # Get all email sends with outcomes
        emails = await self.db.email_sends.find(
            {"userId": self.user_id},
            {"_id": 0}
        ).to_list(1000)
        
        if len(emails) < 5:
            return {
                "status": "insufficient_data",
                "message": "Need at least 5 emails to analyze",
                "emailCount": len(emails)
            }
        
        # Categorize emails by outcome
        high_performers = []  # Got replies
        medium_performers = []  # Got opens/clicks
        low_performers = []  # No engagement
        
        for email in emails:
            if email.get("repliedAt"):
                high_performers.append(email)
            elif email.get("openedAt") or email.get("clickedAt"):
                medium_performers.append(email)
            else:
                low_performers.append(email)
        
        return {
            "totalEmails": len(emails),
            "highPerformers": len(high_performers),
            "mediumPerformers": len(medium_performers),
            "lowPerformers": len(low_performers),
            "replyRate": len(high_performers) / len(emails) * 100,
            "engagementRate": (len(high_performers) + len(medium_performers)) / len(emails) * 100,
            "emails": {
                "high": high_performers[:20],
                "medium": medium_performers[:20],
                "low": low_performers[:10]
            }
        }
    
    async def extract_winning_patterns(self) -> Dict:
        """Extract patterns from high-performing emails"""
        
        # Get emails that received replies
        winners = await self.db.email_sends.find(
            {"userId": self.user_id, "repliedAt": {"$ne": None}},
            {"_id": 0}
        ).to_list(100)
        
        if not winners:
            return {"patterns": [], "message": "No successful emails to analyze"}
        
        # Analyze patterns
        patterns = {
            "subject_patterns": defaultdict(int),
            "opening_patterns": defaultdict(int),
            "cta_patterns": defaultdict(int),
            "length_stats": {"subjects": [], "bodies": []},
            "personalization_usage": {"firstName": 0, "company": 0, "title": 0},
            "tone_distribution": defaultdict(int),
            "question_usage": 0,
            "urgency_usage": 0
        }
        
        for email in winners:
            subject = email.get("subject", "")
            body = email.get("body", "")
            
            # Subject pattern analysis
            if "?" in subject:
                patterns["subject_patterns"]["question"] += 1
            if "quick" in subject.lower():
                patterns["subject_patterns"]["quick"] += 1
            if "{{" in subject:
                patterns["subject_patterns"]["personalized"] += 1
            if len(subject) < 40:
                patterns["subject_patterns"]["short"] += 1
            elif len(subject) < 60:
                patterns["subject_patterns"]["medium"] += 1
            else:
                patterns["subject_patterns"]["long"] += 1
            
            # Opening pattern analysis
            first_line = body.split("\n")[0] if body else ""
            if "noticed" in first_line.lower() or "saw" in first_line.lower():
                patterns["opening_patterns"]["observation"] += 1
            if "congratul" in first_line.lower():
                patterns["opening_patterns"]["congratulatory"] += 1
            if "?" in first_line:
                patterns["opening_patterns"]["question"] += 1
            if "help" in first_line.lower():
                patterns["opening_patterns"]["helpful"] += 1
            
            # Personalization tracking
            if "{{firstName}}" in body or "{{firstname}}" in body.lower():
                patterns["personalization_usage"]["firstName"] += 1
            if "{{company}}" in body:
                patterns["personalization_usage"]["company"] += 1
            if "{{title}}" in body:
                patterns["personalization_usage"]["title"] += 1
            
            # Length stats
            patterns["length_stats"]["subjects"].append(len(subject))
            patterns["length_stats"]["bodies"].append(len(body.split()))
            
            # Question usage
            if "?" in body:
                patterns["question_usage"] += 1
        
        total = len(winners)
        
        # Calculate averages and percentages
        result = {
            "sampleSize": total,
            "subjectPatterns": [
                {"pattern": k, "count": v, "percentage": round(v / total * 100, 1)}
                for k, v in sorted(patterns["subject_patterns"].items(), key=lambda x: -x[1])
            ],
            "openingPatterns": [
                {"pattern": k, "count": v, "percentage": round(v / total * 100, 1)}
                for k, v in sorted(patterns["opening_patterns"].items(), key=lambda x: -x[1])
            ],
            "avgSubjectLength": sum(patterns["length_stats"]["subjects"]) / total if total else 0,
            "avgBodyLength": sum(patterns["length_stats"]["bodies"]) / total if total else 0,
            "personalizationRates": {
                k: round(v / total * 100, 1)
                for k, v in patterns["personalization_usage"].items()
            },
            "questionUsageRate": round(patterns["question_usage"] / total * 100, 1)
        }
        
        return result
    
    async def extract_winning_phrases(self) -> List[Dict]:
        """Extract specific phrases from successful emails"""
        
        # Get high-performing emails
        winners = await self.db.email_sends.find(
            {"userId": self.user_id, "repliedAt": {"$ne": None}},
            {"_id": 0, "subject": 1, "body": 1}
        ).to_list(50)
        
        if len(winners) < 3:
            return []
        
        # Use AI to extract winning phrases
        prompt = f"""Analyze these {len(winners)} successful B2B sales emails and extract the most effective phrases.

SUCCESSFUL EMAILS:
{json.dumps([{"subject": e.get("subject", ""), "body": e.get("body", "")[:500]} for e in winners[:10]], indent=2)}

Extract:
1. Subject line phrases that work (with frequency if used multiple times)
2. Opening lines that engage
3. Value proposition phrases
4. Call-to-action phrases
5. Closing phrases

Return JSON with:
- subject_phrases: Array of {{phrase, effectiveness_score (1-10), usage_tip}}
- opening_phrases: Array of {{phrase, effectiveness_score, usage_tip}}
- value_phrases: Array of {{phrase, effectiveness_score, usage_tip}}
- cta_phrases: Array of {{phrase, effectiveness_score, usage_tip}}
- closing_phrases: Array of {{phrase, effectiveness_score, usage_tip}}"""

        result = await call_ai(prompt)
        
        if result:
            try:
                json_match = re.search(r'\{.*\}', result, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
            except (json.JSONDecodeError, ValueError):
                pass
        
        return {}
    
    async def generate_improvement_rules(self) -> List[Dict]:
        """Generate actionable rules from performance analysis"""
        
        patterns = await self.extract_winning_patterns()
        
        if not patterns.get("sampleSize"):
            return []
        
        rules = []
        
        # Subject length rule
        avg_subj_len = patterns.get("avgSubjectLength", 50)
        rules.append({
            "id": str(uuid4()),
            "type": "subject_length",
            "rule": f"Keep subject lines around {int(avg_subj_len)} characters",
            "target": int(avg_subj_len),
            "tolerance": 10,
            "priority": "high",
            "basedOn": f"Average from {patterns['sampleSize']} successful emails"
        })
        
        # Body length rule
        avg_body_len = patterns.get("avgBodyLength", 80)
        rules.append({
            "id": str(uuid4()),
            "type": "body_length",
            "rule": f"Target {int(avg_body_len)} words in email body",
            "target": int(avg_body_len),
            "tolerance": 20,
            "priority": "high",
            "basedOn": f"Average from {patterns['sampleSize']} successful emails"
        })
        
        # Opening pattern rules
        if patterns.get("openingPatterns"):
            top_opening = patterns["openingPatterns"][0]
            if top_opening["percentage"] > 20:
                rules.append({
                    "id": str(uuid4()),
                    "type": "opening_style",
                    "rule": f"Use {top_opening['pattern']}-style openings",
                    "style": top_opening["pattern"],
                    "priority": "medium",
                    "basedOn": f"{top_opening['percentage']}% of successful emails"
                })
        
        # Personalization rules
        pers_rates = patterns.get("personalizationRates", {})
        if pers_rates.get("firstName", 0) > 70:
            rules.append({
                "id": str(uuid4()),
                "type": "personalization",
                "rule": "Always use first name personalization",
                "field": "firstName",
                "priority": "high",
                "basedOn": f"{pers_rates['firstName']}% of successful emails use it"
            })
        
        if pers_rates.get("company", 0) > 50:
            rules.append({
                "id": str(uuid4()),
                "type": "personalization",
                "rule": "Include company name in emails",
                "field": "company",
                "priority": "medium",
                "basedOn": f"{pers_rates['company']}% of successful emails use it"
            })
        
        # Question usage rule
        if patterns.get("questionUsageRate", 0) > 60:
            rules.append({
                "id": str(uuid4()),
                "type": "question_usage",
                "rule": "Include at least one question in the email",
                "priority": "medium",
                "basedOn": f"{patterns['questionUsageRate']}% of successful emails contain questions"
            })
        
        return rules


# ============== SELF-IMPROVEMENT ENDPOINTS ==============

@router.get("/status")
async def get_self_improvement_status(
    current_user: dict = Depends(get_current_user)
):
    """Get current self-improvement learning status"""
    db = get_db()
    
    # Get learning stats
    rules = await db.improvement_rules.find(
        {"userId": current_user["id"], "active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Get recent learning sessions
    sessions = await db.learning_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(5).to_list(5)
    
    # Get improvement metrics
    metrics = await db.improvement_metrics.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    return {
        "activeRules": len(rules),
        "rules": rules,
        "recentSessions": sessions,
        "metrics": metrics or {
            "totalEmailsAnalyzed": 0,
            "patternsIdentified": 0,
            "rulesGenerated": 0,
            "improvementApplied": 0
        }
    }


@router.post("/analyze")
async def run_performance_analysis(
    current_user: dict = Depends(get_current_user)
):
    """Run comprehensive performance analysis"""
    db = get_db()
    
    engine = PerformanceLearningEngine(current_user["id"], db)
    
    # Run analysis
    performance = await engine.analyze_all_performance()
    patterns = await engine.extract_winning_patterns()
    phrases = await engine.extract_winning_phrases()
    rules = await engine.generate_improvement_rules()
    
    # Save session
    session_id = str(uuid4())
    session = {
        "id": session_id,
        "userId": current_user["id"],
        "type": "comprehensive_analysis",
        "performance": performance,
        "patterns": patterns,
        "phrases": phrases,
        "rulesGenerated": len(rules),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.learning_sessions.insert_one(session)
    
    # Save new rules
    for rule in rules:
        rule["userId"] = current_user["id"]
        rule["sessionId"] = session_id
        rule["active"] = True
        rule["appliedCount"] = 0
        rule["createdAt"] = datetime.now(timezone.utc).isoformat()
        await db.improvement_rules.update_one(
            {"userId": current_user["id"], "type": rule["type"]},
            {"$set": rule},
            upsert=True
        )
    
    # Update metrics
    await db.improvement_metrics.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {"lastAnalysisAt": datetime.now(timezone.utc).isoformat()},
            "$inc": {
                "totalEmailsAnalyzed": performance.get("totalEmails", 0),
                "patternsIdentified": len(patterns.get("subjectPatterns", [])) + len(patterns.get("openingPatterns", [])),
                "rulesGenerated": len(rules)
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "sessionId": session_id,
        "summary": {
            "emailsAnalyzed": performance.get("totalEmails", 0),
            "highPerformers": performance.get("highPerformers", 0),
            "patternsFound": len(patterns.get("subjectPatterns", [])) + len(patterns.get("openingPatterns", [])),
            "rulesCreated": len(rules)
        },
        "performance": performance,
        "patterns": patterns,
        "phrases": phrases,
        "rules": rules
    }


@router.post("/apply-to-draft")
async def apply_learnings_to_draft(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Apply learned patterns to improve an email draft"""
    db = get_db()
    
    draft_id = request.get("draftId")
    subject = request.get("subject", "")
    body = request.get("body", "")
    
    # Get draft if ID provided
    if draft_id:
        draft = await db.email_drafts.find_one(
            {"id": draft_id, "userId": current_user["id"]},
            {"_id": 0}
        )
        if draft:
            subject = draft.get("subject", subject)
            body = draft.get("body", body)
    
    if not subject and not body:
        raise HTTPException(status_code=400, detail="Provide draftId or subject/body")
    
    # Get active rules
    rules = await db.improvement_rules.find(
        {"userId": current_user["id"], "active": True},
        {"_id": 0}
    ).to_list(50)
    
    if not rules:
        return {
            "success": True,
            "message": "No improvement rules yet. Run analysis first.",
            "improved": {"subject": subject, "body": body},
            "changes": []
        }
    
    # Get winning phrases
    phrases_doc = await db.learning_sessions.find_one(
        {"userId": current_user["id"], "type": "comprehensive_analysis"},
        {"_id": 0, "phrases": 1},
        sort=[("createdAt", -1)]
    )
    phrases = phrases_doc.get("phrases", {}) if phrases_doc else {}
    
    # Build AI prompt with rules and phrases
    prompt = f"""Improve this B2B sales email using these learned patterns and rules.

ORIGINAL EMAIL:
Subject: {subject}
Body: {body}

LEARNED RULES (apply these):
{json.dumps(rules, indent=2)}

WINNING PHRASES (incorporate naturally):
{json.dumps(phrases, indent=2) if phrases else "No phrase data yet"}

Instructions:
1. Apply length rules (subject ~{next((r['target'] for r in rules if r['type'] == 'subject_length'), 50)} chars, body ~{next((r['target'] for r in rules if r['type'] == 'body_length'), 80)} words)
2. Use the recommended opening style if applicable
3. Ensure personalization placeholders are present
4. Incorporate winning phrases naturally
5. Maintain professional tone

Return JSON with:
- subject: Improved subject line
- body: Improved email body
- changes: Array of changes made with reasons
- rulesApplied: Array of rule IDs that were applied"""

    result = await call_ai(prompt)
    
    improved = {"subject": subject, "body": body}
    changes = []
    rules_applied = []
    
    if result:
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                improved["subject"] = data.get("subject", subject)
                improved["body"] = data.get("body", body)
                changes = data.get("changes", [])
                rules_applied = data.get("rulesApplied", [])
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Update rule application counts
    for rule_id in rules_applied:
        await db.improvement_rules.update_one(
            {"id": rule_id},
            {"$inc": {"appliedCount": 1}}
        )
    
    # Update metrics
    await db.improvement_metrics.update_one(
        {"userId": current_user["id"]},
        {"$inc": {"improvementApplied": 1}},
        upsert=True
    )
    
    # Update draft if provided
    if draft_id:
        await db.email_drafts.update_one(
            {"id": draft_id},
            {"$set": {
                "subject": improved["subject"],
                "body": improved["body"],
                "selfImproved": True,
                "improvementChanges": changes,
                "improvedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "success": True,
        "original": {"subject": subject, "body": body},
        "improved": improved,
        "changes": changes,
        "rulesApplied": len(rules_applied)
    }


@router.get("/rules")
async def get_improvement_rules(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all improvement rules"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if active_only:
        query["active"] = True
    
    rules = await db.improvement_rules.find(
        query,
        {"_id": 0}
    ).sort("priority", 1).to_list(100)
    
    return rules


@router.put("/rules/{rule_id}")
async def update_improvement_rule(
    rule_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update an improvement rule"""
    db = get_db()
    
    update_data = {}
    if "active" in request:
        update_data["active"] = request["active"]
    if "priority" in request:
        update_data["priority"] = request["priority"]
    if "target" in request:
        update_data["target"] = request["target"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    result = await db.improvement_rules.update_one(
        {"id": rule_id, "userId": current_user["id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"success": True, "message": "Rule updated"}


@router.get("/phrases")
async def get_winning_phrases(
    current_user: dict = Depends(get_current_user)
):
    """Get learned winning phrases"""
    db = get_db()
    
    # Get latest analysis session with phrases
    session = await db.learning_sessions.find_one(
        {"userId": current_user["id"], "type": "comprehensive_analysis"},
        {"_id": 0, "phrases": 1, "createdAt": 1},
        sort=[("createdAt", -1)]
    )
    
    if not session or not session.get("phrases"):
        return {
            "phrases": {},
            "message": "No phrases learned yet. Run analysis on successful emails."
        }
    
    return {
        "phrases": session["phrases"],
        "analyzedAt": session.get("createdAt")
    }


@router.get("/improvement-history")
async def get_improvement_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get history of self-improvement applications"""
    db = get_db()
    
    # Get drafts that were self-improved
    improved_drafts = await db.email_drafts.find(
        {"userId": current_user["id"], "selfImproved": True},
        {"_id": 0}
    ).sort("improvedAt", -1).limit(limit).to_list(limit)
    
    # Get learning sessions
    sessions = await db.learning_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return {
        "improvedDrafts": improved_drafts,
        "learningSessions": sessions
    }


@router.post("/feedback")
async def submit_performance_feedback(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Submit feedback on improvement effectiveness"""
    db = get_db()
    
    draft_id = request.get("draftId")
    outcome = request.get("outcome")  # positive, negative, neutral
    got_reply = request.get("gotReply", False)
    notes = request.get("notes", "")
    
    if not draft_id or not outcome:
        raise HTTPException(status_code=400, detail="draftId and outcome required")
    
    feedback = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "draftId": draft_id,
        "outcome": outcome,
        "gotReply": got_reply,
        "notes": notes,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.improvement_feedback.insert_one(feedback)
    
    # If positive feedback, reinforce the rules used
    if outcome == "positive":
        draft = await db.email_drafts.find_one(
            {"id": draft_id},
            {"_id": 0, "improvementChanges": 1}
        )
        
        if draft and draft.get("improvementChanges"):
            # Boost effectiveness of applied rules
            await db.improvement_rules.update_many(
                {"userId": current_user["id"]},
                {"$inc": {"positiveOutcomes": 1}}
            )
    
    return {"success": True, "feedbackId": feedback["id"]}
