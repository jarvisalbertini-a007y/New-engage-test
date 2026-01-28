"""
AI-Powered Email Optimization & A/B Testing Engine

This module provides:
1. Email performance tracking (opens, clicks, replies)
2. AI analysis of what works (patterns, timing, personalization)
3. Automatic A/B test generation and winner selection
4. Self-improving email drafts based on historical data

Designed to be used both manually and autonomously.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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
    """Call Gemini AI for email optimization"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"email-opt-{str(uuid4())[:8]}"
        system_msg = system_instruction or "You are an expert email copywriter and conversion optimization specialist."
        
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


# ============== PERFORMANCE TRACKING ==============

@router.post("/track/open")
async def track_email_open(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Track when an email is opened"""
    db = get_db()
    
    email_id = request.get("emailId")
    draft_id = request.get("draftId")
    variation_id = request.get("variationId")
    
    # Update email record
    await db.email_sends.update_one(
        {"id": email_id},
        {
            "$set": {"openedAt": datetime.now(timezone.utc).isoformat()},
            "$inc": {"openCount": 1}
        }
    )
    
    # Track for A/B test if variation
    if variation_id:
        await db.ab_test_results.update_one(
            {"variationId": variation_id},
            {
                "$inc": {"opens": 1},
                "$set": {"lastOpenAt": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    # Log event for learning
    await db.email_events.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "emailId": email_id,
        "draftId": draft_id,
        "variationId": variation_id,
        "eventType": "open",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "tracked": "open"}


@router.post("/track/click")
async def track_email_click(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Track when a link in email is clicked"""
    db = get_db()
    
    email_id = request.get("emailId")
    draft_id = request.get("draftId")
    variation_id = request.get("variationId")
    link_url = request.get("linkUrl", "")
    
    # Update email record
    await db.email_sends.update_one(
        {"id": email_id},
        {
            "$set": {"clickedAt": datetime.now(timezone.utc).isoformat()},
            "$inc": {"clickCount": 1},
            "$push": {"clickedLinks": link_url}
        }
    )
    
    # Track for A/B test
    if variation_id:
        await db.ab_test_results.update_one(
            {"variationId": variation_id},
            {
                "$inc": {"clicks": 1},
                "$set": {"lastClickAt": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    await db.email_events.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "emailId": email_id,
        "draftId": draft_id,
        "variationId": variation_id,
        "eventType": "click",
        "linkUrl": link_url,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "tracked": "click"}


@router.post("/track/reply")
async def track_email_reply(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Track when a reply is received"""
    db = get_db()
    
    email_id = request.get("emailId")
    draft_id = request.get("draftId")
    variation_id = request.get("variationId")
    sentiment = request.get("sentiment", "neutral")  # positive, negative, neutral
    
    # Update email record
    await db.email_sends.update_one(
        {"id": email_id},
        {
            "$set": {
                "repliedAt": datetime.now(timezone.utc).isoformat(),
                "replySentiment": sentiment
            },
            "$inc": {"replyCount": 1}
        }
    )
    
    # Track for A/B test - replies are gold!
    if variation_id:
        await db.ab_test_results.update_one(
            {"variationId": variation_id},
            {
                "$inc": {"replies": 1, f"replySentiment.{sentiment}": 1},
                "$set": {"lastReplyAt": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    await db.email_events.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "emailId": email_id,
        "draftId": draft_id,
        "variationId": variation_id,
        "eventType": "reply",
        "sentiment": sentiment,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "tracked": "reply"}


# ============== A/B TEST CREATION ==============

@router.post("/ab-test/create")
async def create_ab_test(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an A/B test with multiple email variations.
    Can be triggered manually or by autonomous system.
    """
    db = get_db()
    
    test_name = request.get("name", "Email A/B Test")
    test_type = request.get("testType", "subject")  # subject, body, full, cta
    original_draft_id = request.get("draftId")
    variation_count = request.get("variationCount", 3)
    prospect_ids = request.get("prospectIds", [])
    auto_select_winner = request.get("autoSelectWinner", True)
    winner_criteria = request.get("winnerCriteria", "replies")  # opens, clicks, replies
    min_sample_size = request.get("minSampleSize", 10)
    
    # Get original draft
    original_draft = None
    if original_draft_id:
        original_draft = await db.email_drafts.find_one(
            {"id": original_draft_id, "userId": current_user["id"]},
            {"_id": 0}
        )
    
    if not original_draft:
        # Create a generic template for testing
        original_draft = {
            "subject": request.get("subject", "Quick question about {{company}}"),
            "body": request.get("body", "Hi {{firstName}}, I noticed {{company}} is growing and thought you might be interested in how we help similar companies...")
        }
    
    # Generate variations using AI
    variations = await generate_email_variations(
        original_draft["subject"],
        original_draft["body"],
        test_type,
        variation_count
    )
    
    # Create test record
    test_id = str(uuid4())
    test = {
        "id": test_id,
        "userId": current_user["id"],
        "name": test_name,
        "testType": test_type,
        "status": "running",
        "originalDraftId": original_draft_id,
        "originalSubject": original_draft["subject"],
        "originalBody": original_draft["body"],
        "variations": variations,
        "prospectIds": prospect_ids,
        "autoSelectWinner": auto_select_winner,
        "winnerCriteria": winner_criteria,
        "minSampleSize": min_sample_size,
        "winnerId": None,
        "stats": {
            "totalSent": 0,
            "totalOpens": 0,
            "totalClicks": 0,
            "totalReplies": 0
        },
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None
    }
    
    await db.ab_tests.insert_one(test)
    
    # Initialize variation results
    for var in variations:
        await db.ab_test_results.insert_one({
            "id": str(uuid4()),
            "testId": test_id,
            "variationId": var["id"],
            "variationName": var["name"],
            "sent": 0,
            "opens": 0,
            "clicks": 0,
            "replies": 0,
            "openRate": 0,
            "clickRate": 0,
            "replyRate": 0,
            "createdAt": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "success": True,
        "testId": test_id,
        "variationCount": len(variations),
        "variations": variations
    }


async def generate_email_variations(
    original_subject: str,
    original_body: str,
    test_type: str,
    count: int
) -> List[Dict]:
    """Generate email variations using AI"""
    
    variations = [{
        "id": str(uuid4()),
        "name": "Control (Original)",
        "subject": original_subject,
        "body": original_body,
        "isControl": True
    }]
    
    if test_type == "subject":
        prompt = f"""Generate {count - 1} alternative subject lines for this cold email.
        
Original subject: {original_subject}
Email body context: {original_body[:200]}...

Requirements for each variation:
- Different psychological angle (curiosity, urgency, social proof, personalization, question)
- Under 50 characters
- No spam trigger words
- Maintain professional tone

Return JSON array with objects containing:
- name: Brief description of the angle used
- subject: The subject line
"""
    elif test_type == "body":
        prompt = f"""Generate {count - 1} alternative email body variations.
        
Original email:
Subject: {original_subject}
Body: {original_body}

Requirements for each variation:
- Same core message, different approach
- Try: shorter version, story-based, data-driven, question-led
- Keep under 100 words
- Maintain personalization placeholders ({{firstName}}, {{company}})

Return JSON array with objects containing:
- name: Brief description of the approach
- body: The email body
"""
    elif test_type == "cta":
        prompt = f"""Generate {count - 1} alternative call-to-action variations for this email.
        
Original email:
Subject: {original_subject}
Body: {original_body}

Create variations with different CTAs:
- Calendar link approach
- Quick question approach
- Resource sharing approach
- Social proof approach

Return JSON array with objects containing:
- name: CTA approach name
- body: Full email body with new CTA
"""
    else:  # full
        prompt = f"""Generate {count - 1} completely different email variations for cold outreach.
        
Context from original:
Subject: {original_subject}
Body: {original_body}

Create distinct approaches:
- Direct value proposition
- Curiosity-driven opener
- Social proof heavy
- Problem-solution focused

Return JSON array with objects containing:
- name: Approach name
- subject: Subject line
- body: Email body
"""
    
    result = await call_ai(prompt)
    
    if result:
        try:
            json_match = re.search(r'\[.*\]', result, re.DOTALL)
            if json_match:
                ai_variations = json.loads(json_match.group())
                for var in ai_variations[:count - 1]:
                    variations.append({
                        "id": str(uuid4()),
                        "name": var.get("name", f"Variation {len(variations)}"),
                        "subject": var.get("subject", original_subject),
                        "body": var.get("body", original_body),
                        "isControl": False
                    })
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse AI variations: {e}")
    
    # Ensure we have enough variations
    while len(variations) < count:
        variations.append({
            "id": str(uuid4()),
            "name": f"Variation {len(variations)}",
            "subject": original_subject + f" (v{len(variations)})",
            "body": original_body,
            "isControl": False
        })
    
    return variations


@router.get("/ab-test/{test_id}")
async def get_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get A/B test details with results"""
    db = get_db()
    
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get results for each variation
    results = await db.ab_test_results.find(
        {"testId": test_id},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate rates
    for r in results:
        sent = r.get("sent", 0) or 1
        r["openRate"] = round(r.get("opens", 0) / sent * 100, 1)
        r["clickRate"] = round(r.get("clicks", 0) / sent * 100, 1)
        r["replyRate"] = round(r.get("replies", 0) / sent * 100, 1)
    
    test["results"] = results
    
    return test


@router.get("/ab-tests")
async def list_ab_tests(
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List all A/B tests"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    
    tests = await db.ab_tests.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).limit(50).to_list(50)
    
    return tests


@router.post("/ab-test/{test_id}/select-winner")
async def select_ab_test_winner(
    test_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Manually or automatically select A/B test winner"""
    db = get_db()
    
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    winner_id = request.get("winnerId")
    
    if not winner_id:
        # Auto-select based on criteria
        results = await db.ab_test_results.find(
            {"testId": test_id},
            {"_id": 0}
        ).to_list(100)
        
        criteria = test.get("winnerCriteria", "replies")
        
        if criteria == "replies":
            best = max(results, key=lambda x: x.get("replies", 0))
        elif criteria == "clicks":
            best = max(results, key=lambda x: x.get("clicks", 0))
        else:  # opens
            best = max(results, key=lambda x: x.get("opens", 0))
        
        winner_id = best.get("variationId")
    
    # Update test
    await db.ab_tests.update_one(
        {"id": test_id},
        {"$set": {
            "status": "completed",
            "winnerId": winner_id,
            "completedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get winner details
    winner_var = next(
        (v for v in test.get("variations", []) if v["id"] == winner_id),
        None
    )
    
    return {
        "success": True,
        "winnerId": winner_id,
        "winnerName": winner_var.get("name") if winner_var else "Unknown",
        "status": "completed"
    }


# ============== EMAIL OPTIMIZATION ==============

@router.post("/optimize")
async def optimize_email(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Optimize an email based on historical performance data.
    Can be called manually or by autonomous system.
    """
    db = get_db()
    
    subject = request.get("subject", "")
    body = request.get("body", "")
    prospect_industry = request.get("industry", "")
    prospect_title = request.get("title", "")
    optimization_focus = request.get("focus", "all")  # subject, body, all, cta
    
    # Get historical performance data
    performance_data = await get_email_performance_insights(current_user["id"], db)
    
    # Get successful patterns
    successful_patterns = await analyze_successful_emails(current_user["id"], db)
    
    # Build optimization prompt
    prompt = f"""Optimize this cold sales email based on performance data.

CURRENT EMAIL:
Subject: {subject}
Body: {body}

TARGET PROSPECT:
Industry: {prospect_industry or "Unknown"}
Title: {prospect_title or "Unknown"}

PERFORMANCE INSIGHTS FROM PAST EMAILS:
{json.dumps(performance_data, indent=2)}

PATTERNS FROM SUCCESSFUL EMAILS (got replies):
{json.dumps(successful_patterns, indent=2)}

OPTIMIZATION FOCUS: {optimization_focus}

Provide an optimized version that:
1. Incorporates successful patterns from past emails
2. Addresses common reasons emails fail
3. Is personalized for the prospect's industry/title
4. Has a compelling subject line (if optimizing subject)
5. Has clear, concise body with strong CTA

Return JSON with:
- optimizedSubject: Improved subject line
- optimizedBody: Improved email body
- changes: List of specific changes made and why
- predictedImprovement: Estimated improvement percentage
- confidence: 0-100 confidence score
"""
    
    result = await call_ai(prompt)
    
    optimized = {
        "original": {"subject": subject, "body": body},
        "optimized": {"subject": subject, "body": body},
        "changes": [],
        "predictedImprovement": 0,
        "confidence": 50
    }
    
    if result:
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                optimized["optimized"]["subject"] = data.get("optimizedSubject", subject)
                optimized["optimized"]["body"] = data.get("optimizedBody", body)
                optimized["changes"] = data.get("changes", [])
                optimized["predictedImprovement"] = data.get("predictedImprovement", 0)
                optimized["confidence"] = data.get("confidence", 50)
        except (json.JSONDecodeError, ValueError):
            pass
    
    # Log optimization for learning
    await db.optimization_history.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "original": {"subject": subject, "body": body},
        "optimized": optimized["optimized"],
        "changes": optimized["changes"],
        "focus": optimization_focus,
        "prospectContext": {"industry": prospect_industry, "title": prospect_title},
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return optimized


async def get_email_performance_insights(user_id: str, db) -> Dict:
    """Analyze user's email performance data"""
    
    # Get aggregate stats
    pipeline = [
        {"$match": {"userId": user_id}},
        {"$group": {
            "_id": None,
            "totalSent": {"$sum": 1},
            "totalOpened": {"$sum": {"$cond": [{"$ne": ["$openedAt", None]}, 1, 0]}},
            "totalClicked": {"$sum": {"$cond": [{"$ne": ["$clickedAt", None]}, 1, 0]}},
            "totalReplied": {"$sum": {"$cond": [{"$ne": ["$repliedAt", None]}, 1, 0]}}
        }}
    ]
    
    stats = await db.email_sends.aggregate(pipeline).to_list(1)
    
    if not stats:
        return {
            "totalSent": 0,
            "openRate": 0,
            "clickRate": 0,
            "replyRate": 0,
            "insights": ["Not enough data yet. Send more emails to get insights."]
        }
    
    s = stats[0]
    total = s.get("totalSent", 1) or 1
    
    open_rate = s.get("totalOpened", 0) / total * 100
    click_rate = s.get("totalClicked", 0) / total * 100
    reply_rate = s.get("totalReplied", 0) / total * 100
    
    # Generate insights
    insights = []
    
    if open_rate < 20:
        insights.append("Low open rate - focus on subject line optimization")
    elif open_rate > 40:
        insights.append("Good open rate - subject lines are working")
    
    if click_rate < 5:
        insights.append("Low click rate - improve CTA visibility and relevance")
    
    if reply_rate < 2:
        insights.append("Low reply rate - personalize more and reduce email length")
    elif reply_rate > 5:
        insights.append("Great reply rate - current approach is working")
    
    # Best performing day/time
    best_time = await db.email_events.aggregate([
        {"$match": {"userId": user_id, "eventType": "reply"}},
        {"$project": {
            "hour": {"$hour": {"$dateFromString": {"dateString": "$timestamp"}}},
            "dayOfWeek": {"$dayOfWeek": {"$dateFromString": {"dateString": "$timestamp"}}}
        }},
        {"$group": {
            "_id": {"hour": "$hour", "day": "$dayOfWeek"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]).to_list(1)
    
    if best_time:
        bt = best_time[0]["_id"]
        days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        insights.append(f"Best response time: {days[bt.get('day', 0)-1]} around {bt.get('hour', 9)}:00")
    
    return {
        "totalSent": s.get("totalSent", 0),
        "openRate": round(open_rate, 1),
        "clickRate": round(click_rate, 1),
        "replyRate": round(reply_rate, 1),
        "insights": insights
    }


async def analyze_successful_emails(user_id: str, db) -> Dict:
    """Analyze patterns in emails that got replies"""
    
    # Get emails that received replies
    successful_emails = await db.email_sends.find(
        {"userId": user_id, "repliedAt": {"$ne": None}},
        {"_id": 0, "subject": 1, "body": 1, "replySentiment": 1}
    ).limit(50).to_list(50)
    
    if not successful_emails:
        return {
            "patterns": [],
            "avgSubjectLength": 0,
            "avgBodyLength": 0,
            "commonOpenings": [],
            "commonCTAs": []
        }
    
    # Analyze patterns
    subject_lengths = []
    body_lengths = []
    openings = []
    
    for email in successful_emails:
        subj = email.get("subject", "")
        body = email.get("body", "")
        
        subject_lengths.append(len(subj))
        body_lengths.append(len(body.split()))
        
        # Extract opening line
        if body:
            first_line = body.split(".")[0] if "." in body else body[:50]
            openings.append(first_line[:50])
    
    # Count common patterns
    opening_patterns = defaultdict(int)
    for o in openings:
        # Normalize and categorize
        o_lower = o.lower()
        if "noticed" in o_lower or "saw" in o_lower:
            opening_patterns["Observation-based"] += 1
        elif "congrat" in o_lower:
            opening_patterns["Congratulatory"] += 1
        elif "question" in o_lower or "?" in o:
            opening_patterns["Question-based"] += 1
        elif "help" in o_lower:
            opening_patterns["Offer-based"] += 1
        else:
            opening_patterns["Direct"] += 1
    
    return {
        "patterns": [
            {"type": k, "count": v, "percentage": round(v / len(successful_emails) * 100, 1)}
            for k, v in sorted(opening_patterns.items(), key=lambda x: -x[1])
        ],
        "avgSubjectLength": round(sum(subject_lengths) / len(subject_lengths), 0) if subject_lengths else 0,
        "avgBodyLength": round(sum(body_lengths) / len(body_lengths), 0) if body_lengths else 0,
        "sampleCount": len(successful_emails)
    }


@router.get("/insights")
async def get_optimization_insights(
    current_user: dict = Depends(get_current_user)
):
    """Get email optimization insights and recommendations"""
    db = get_db()
    
    performance = await get_email_performance_insights(current_user["id"], db)
    patterns = await analyze_successful_emails(current_user["id"], db)
    
    # Get A/B test learnings
    completed_tests = await db.ab_tests.find(
        {"userId": current_user["id"], "status": "completed"},
        {"_id": 0}
    ).sort("completedAt", -1).limit(10).to_list(10)
    
    test_learnings = []
    for test in completed_tests:
        if test.get("winnerId"):
            winner = next(
                (v for v in test.get("variations", []) if v["id"] == test["winnerId"]),
                None
            )
            if winner:
                test_learnings.append({
                    "testType": test.get("testType"),
                    "winnerApproach": winner.get("name"),
                    "testDate": test.get("completedAt")
                })
    
    # Generate AI recommendations
    recommendations = await generate_recommendations(performance, patterns, test_learnings)
    
    return {
        "performance": performance,
        "successfulPatterns": patterns,
        "abTestLearnings": test_learnings[:5],
        "recommendations": recommendations
    }


async def generate_recommendations(performance: Dict, patterns: Dict, test_learnings: List) -> List[Dict]:
    """Generate AI-powered recommendations based on data"""
    
    recommendations = []
    
    # Based on performance
    if performance.get("openRate", 0) < 25:
        recommendations.append({
            "type": "subject_line",
            "priority": "high",
            "recommendation": "Your open rates suggest subject lines need work. Try: questions, personalization with company name, or curiosity gaps.",
            "action": "Run an A/B test on subject lines"
        })
    
    if performance.get("replyRate", 0) < 3:
        recommendations.append({
            "type": "body_content",
            "priority": "high",
            "recommendation": "Low reply rates indicate emails may be too long or lack clear value proposition. Keep under 100 words with one clear CTA.",
            "action": "Shorten emails and strengthen CTA"
        })
    
    # Based on successful patterns
    if patterns.get("patterns"):
        top_pattern = patterns["patterns"][0]
        recommendations.append({
            "type": "opening_style",
            "priority": "medium",
            "recommendation": f"{top_pattern['type']} openings work best for you ({top_pattern['percentage']}% of successful emails). Use this style more.",
            "action": f"Start more emails with {top_pattern['type'].lower()} approach"
        })
    
    if patterns.get("avgBodyLength"):
        avg_len = patterns["avgBodyLength"]
        recommendations.append({
            "type": "email_length",
            "priority": "medium",
            "recommendation": f"Your successful emails average {avg_len} words. Aim for this length.",
            "action": f"Target {int(avg_len)} words per email"
        })
    
    # Based on A/B test learnings
    if test_learnings:
        winning_approaches = [t["winnerApproach"] for t in test_learnings[:3]]
        if winning_approaches:
            recommendations.append({
                "type": "ab_test_insight",
                "priority": "medium",
                "recommendation": f"Recent A/B test winners: {', '.join(winning_approaches)}. These approaches resonate with your audience.",
                "action": "Apply these winning patterns to new emails"
            })
    
    return recommendations


# ============== AUTONOMOUS INTEGRATION ==============

@router.post("/auto-optimize-draft")
async def auto_optimize_draft(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically optimize an email draft.
    Called by autonomous prospecting system.
    """
    db = get_db()
    
    draft_id = request.get("draftId")
    apply_changes = request.get("applyChanges", False)
    
    # Get draft
    draft = await db.email_drafts.find_one(
        {"id": draft_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Get prospect context
    prospect = None
    if draft.get("prospectId"):
        prospect = await db.prospects.find_one(
            {"id": draft["prospectId"]},
            {"_id": 0}
        )
    
    # Optimize
    optimization = await optimize_email(
        {
            "subject": draft.get("subject", ""),
            "body": draft.get("body", ""),
            "industry": prospect.get("industry", "") if prospect else "",
            "title": prospect.get("title", "") if prospect else "",
            "focus": "all"
        },
        current_user
    )
    
    # Apply changes if requested
    if apply_changes and optimization.get("optimized"):
        await db.email_drafts.update_one(
            {"id": draft_id},
            {"$set": {
                "subject": optimization["optimized"]["subject"],
                "body": optimization["optimized"]["body"],
                "optimized": True,
                "optimizationChanges": optimization.get("changes", []),
                "optimizedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "draftId": draft_id,
        "optimization": optimization,
        "applied": apply_changes
    }


@router.post("/auto-create-test")
async def auto_create_ab_test_from_draft(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Automatically create an A/B test from a draft.
    Called by autonomous prospecting system.
    """
    draft_id = request.get("draftId")
    test_type = request.get("testType", "subject")
    
    result = await create_ab_test(
        {
            "name": f"Auto A/B Test - {test_type}",
            "testType": test_type,
            "draftId": draft_id,
            "variationCount": 3,
            "autoSelectWinner": True,
            "winnerCriteria": "replies",
            "minSampleSize": 10
        },
        current_user
    )
    
    return result


@router.get("/optimization-history")
async def get_optimization_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get history of email optimizations"""
    db = get_db()
    
    history = await db.optimization_history.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return history
