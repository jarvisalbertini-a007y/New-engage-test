"""
Campaign A/B Testing Router

Comprehensive A/B testing for sales campaigns across email, timing, and channels.

Features:
- Test email content (subject lines, body, CTAs)
- Test send timing (time of day, day of week)
- Test channels (email, LinkedIn, phone)
- Statistical significance calculation
- Auto-apply winning variants
- Learning integration
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Dict, Any
from enum import Enum
import os
import json
import math
import random

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


def sanitize_mongo_doc(doc):
    """Remove MongoDB _id from document"""
    if isinstance(doc, dict):
        return {k: sanitize_mongo_doc(v) for k, v in doc.items() if k != '_id'}
    elif isinstance(doc, list):
        return [sanitize_mongo_doc(item) for item in doc]
    return doc


# ============== ENUMS ==============

class TestType(str, Enum):
    EMAIL_SUBJECT = "email_subject"
    EMAIL_BODY = "email_body"
    EMAIL_CTA = "email_cta"
    SEND_TIME = "send_time"
    SEND_DAY = "send_day"
    CHANNEL = "channel"
    FULL_TEMPLATE = "full_template"


class TestStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    WINNER_APPLIED = "winner_applied"


class Channel(str, Enum):
    EMAIL = "email"
    LINKEDIN = "linkedin"
    PHONE = "phone"
    SMS = "sms"


# ============== STATISTICAL CALCULATIONS ==============

def calculate_conversion_rate(conversions: int, total: int) -> float:
    """Calculate conversion rate as percentage"""
    if total == 0:
        return 0.0
    return round((conversions / total) * 100, 2)


def calculate_z_score(rate_a: float, rate_b: float, n_a: int, n_b: int) -> float:
    """Calculate Z-score for two proportions"""
    if n_a == 0 or n_b == 0:
        return 0.0
    
    p_a = rate_a / 100
    p_b = rate_b / 100
    
    # Pooled proportion
    p_pool = (p_a * n_a + p_b * n_b) / (n_a + n_b)
    
    if p_pool == 0 or p_pool == 1:
        return 0.0
    
    # Standard error
    se = math.sqrt(p_pool * (1 - p_pool) * (1/n_a + 1/n_b))
    
    if se == 0:
        return 0.0
    
    # Z-score
    z = (p_a - p_b) / se
    
    return round(z, 3)


def z_to_confidence(z: float) -> float:
    """Convert Z-score to confidence level (simplified)"""
    # Using approximate normal distribution lookup
    z_abs = abs(z)
    
    if z_abs >= 2.576:
        return 99
    elif z_abs >= 1.96:
        return 95
    elif z_abs >= 1.645:
        return 90
    elif z_abs >= 1.28:
        return 80
    elif z_abs >= 1.0:
        return 68
    else:
        return round(z_abs * 50, 0)


def calculate_statistical_significance(variant_a: Dict, variant_b: Dict) -> Dict:
    """Calculate statistical significance between two variants"""
    metrics = ["openRate", "clickRate", "replyRate", "conversionRate"]
    
    results = {}
    
    for metric in metrics:
        rate_a = variant_a.get(metric, 0)
        rate_b = variant_b.get(metric, 0)
        n_a = variant_a.get("sent", 0)
        n_b = variant_b.get("sent", 0)
        
        z_score = calculate_z_score(rate_a, rate_b, n_a, n_b)
        confidence = z_to_confidence(z_score)
        
        # Determine winner
        winner = None
        if confidence >= 95:
            winner = "A" if rate_a > rate_b else "B"
        
        results[metric] = {
            "variantA": rate_a,
            "variantB": rate_b,
            "difference": round(rate_a - rate_b, 2),
            "relativeUplift": round((rate_a - rate_b) / max(rate_b, 0.01) * 100, 1) if rate_b > 0 else 0,
            "zScore": z_score,
            "confidence": confidence,
            "significant": confidence >= 95,
            "winner": winner
        }
    
    return results


# ============== API ENDPOINTS ==============

@router.post("/tests")
async def create_ab_test(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new A/B test"""
    db = get_db()
    
    test_type = request.get("testType", TestType.EMAIL_SUBJECT.value)
    
    test = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": request.get("name", f"A/B Test - {datetime.now().strftime('%Y-%m-%d')}"),
        "description": request.get("description", ""),
        "testType": test_type,
        "status": TestStatus.DRAFT.value,
        
        # Variants
        "variantA": {
            "id": "A",
            "name": request.get("variantAName", "Control"),
            "content": request.get("variantAContent", {}),
            "sent": 0,
            "opens": 0,
            "clicks": 0,
            "replies": 0,
            "conversions": 0,
            "openRate": 0,
            "clickRate": 0,
            "replyRate": 0,
            "conversionRate": 0
        },
        "variantB": {
            "id": "B",
            "name": request.get("variantBName", "Challenger"),
            "content": request.get("variantBContent", {}),
            "sent": 0,
            "opens": 0,
            "clicks": 0,
            "replies": 0,
            "conversions": 0,
            "openRate": 0,
            "clickRate": 0,
            "replyRate": 0,
            "conversionRate": 0
        },
        
        # Targeting
        "prospectIds": request.get("prospectIds", []),
        "segmentCriteria": request.get("segmentCriteria", {}),
        "splitRatio": request.get("splitRatio", 50),  # % to variant A
        
        # Success metrics
        "primaryMetric": request.get("primaryMetric", "openRate"),
        "minSampleSize": request.get("minSampleSize", 100),
        "confidenceThreshold": request.get("confidenceThreshold", 95),
        
        # Timing (for send time tests)
        "sendTimeA": request.get("sendTimeA"),
        "sendTimeB": request.get("sendTimeB"),
        "sendDayA": request.get("sendDayA"),
        "sendDayB": request.get("sendDayB"),
        
        # Channel (for channel tests)
        "channelA": request.get("channelA", Channel.EMAIL.value),
        "channelB": request.get("channelB"),
        
        # Results
        "winner": None,
        "winnerConfidence": None,
        "significanceResults": {},
        
        # Auto-apply settings
        "autoApplyWinner": request.get("autoApplyWinner", False),
        "winnerAppliedAt": None,
        
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "startedAt": None,
        "completedAt": None
    }
    
    await db.ab_tests.insert_one(test)
    
    return {"success": True, "test": sanitize_mongo_doc(test)}


@router.get("/tests")
async def list_ab_tests(
    status: Optional[str] = None,
    test_type: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List A/B tests"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    if test_type:
        query["testType"] = test_type
    
    tests = await db.ab_tests.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return tests


@router.get("/tests/{test_id}")
async def get_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get A/B test details with current statistics"""
    db = get_db()
    
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Calculate current significance if test is running
    if test["status"] == TestStatus.RUNNING.value:
        test["significanceResults"] = calculate_statistical_significance(
            test["variantA"],
            test["variantB"]
        )
    
    return test


@router.post("/tests/{test_id}/start")
async def start_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start an A/B test"""
    db = get_db()
    
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    if test["status"] != TestStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Test is not in draft status")
    
    # Assign prospects to variants
    prospect_ids = test.get("prospectIds", [])
    split_ratio = test.get("splitRatio", 50)
    
    random.shuffle(prospect_ids)
    split_index = int(len(prospect_ids) * split_ratio / 100)
    
    variant_a_prospects = prospect_ids[:split_index]
    variant_b_prospects = prospect_ids[split_index:]
    
    await db.ab_tests.update_one(
        {"id": test_id},
        {
            "$set": {
                "status": TestStatus.RUNNING.value,
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "variantA.prospectIds": variant_a_prospects,
                "variantB.prospectIds": variant_b_prospects
            }
        }
    )
    
    return {
        "success": True,
        "message": "Test started",
        "variantASample": len(variant_a_prospects),
        "variantBSample": len(variant_b_prospects)
    }


@router.post("/tests/{test_id}/pause")
async def pause_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause a running A/B test"""
    db = get_db()
    
    result = await db.ab_tests.update_one(
        {"id": test_id, "userId": current_user["id"], "status": TestStatus.RUNNING.value},
        {"$set": {"status": TestStatus.PAUSED.value}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Test not found or not running")
    
    return {"success": True, "message": "Test paused"}


@router.post("/tests/{test_id}/resume")
async def resume_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resume a paused A/B test"""
    db = get_db()
    
    result = await db.ab_tests.update_one(
        {"id": test_id, "userId": current_user["id"], "status": TestStatus.PAUSED.value},
        {"$set": {"status": TestStatus.RUNNING.value}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Test not found or not paused")
    
    return {"success": True, "message": "Test resumed"}


@router.post("/tests/{test_id}/complete")
async def complete_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark test as complete and determine winner"""
    db = get_db()
    
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Calculate final significance
    significance = calculate_statistical_significance(
        test["variantA"],
        test["variantB"]
    )
    
    # Determine winner based on primary metric
    primary_metric = test.get("primaryMetric", "openRate")
    primary_result = significance.get(primary_metric, {})
    
    winner = primary_result.get("winner")
    confidence = primary_result.get("confidence", 0)
    
    await db.ab_tests.update_one(
        {"id": test_id},
        {
            "$set": {
                "status": TestStatus.COMPLETED.value,
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "significanceResults": significance,
                "winner": winner,
                "winnerConfidence": confidence
            }
        }
    )
    
    # Auto-apply winner if configured
    if test.get("autoApplyWinner") and winner:
        await apply_winner(test_id, current_user, db)
    
    return {
        "success": True,
        "winner": winner,
        "confidence": confidence,
        "significanceResults": significance
    }


async def apply_winner(test_id: str, current_user: dict, db):
    """Apply winning variant to future outreach"""
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not test or not test.get("winner"):
        return
    
    winner_variant = test["variantA"] if test["winner"] == "A" else test["variantB"]
    
    # Record the learning
    learning = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "testId": test_id,
        "testType": test["testType"],
        "winningVariant": winner_variant,
        "improvement": test.get("significanceResults", {}).get(test.get("primaryMetric", "openRate"), {}).get("relativeUplift", 0),
        "appliedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ab_test_learnings.insert_one(learning)
    
    # Update test
    await db.ab_tests.update_one(
        {"id": test_id},
        {
            "$set": {
                "status": TestStatus.WINNER_APPLIED.value,
                "winnerAppliedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )


@router.post("/tests/{test_id}/record-event")
async def record_test_event(
    test_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Record an event (open, click, reply, conversion) for a test"""
    db = get_db()
    
    variant = request.get("variant")  # A or B
    event_type = request.get("eventType")  # sent, open, click, reply, conversion
    prospect_id = request.get("prospectId")
    
    if variant not in ["A", "B"]:
        raise HTTPException(status_code=400, detail="Invalid variant")
    
    if event_type not in ["sent", "open", "click", "reply", "conversion"]:
        raise HTTPException(status_code=400, detail="Invalid event type")
    
    # Map event to field
    event_field_map = {
        "sent": "sent",
        "open": "opens",
        "click": "clicks",
        "reply": "replies",
        "conversion": "conversions"
    }
    
    field = event_field_map[event_type]
    variant_field = f"variant{variant}"
    
    # Increment counter
    await db.ab_tests.update_one(
        {"id": test_id, "userId": current_user["id"]},
        {"$inc": {f"{variant_field}.{field}": 1}}
    )
    
    # Recalculate rates
    test = await db.ab_tests.find_one(
        {"id": test_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if test:
        for v in ["variantA", "variantB"]:
            variant_data = test[v]
            sent = variant_data.get("sent", 0)
            
            if sent > 0:
                rates = {
                    "openRate": calculate_conversion_rate(variant_data.get("opens", 0), sent),
                    "clickRate": calculate_conversion_rate(variant_data.get("clicks", 0), sent),
                    "replyRate": calculate_conversion_rate(variant_data.get("replies", 0), sent),
                    "conversionRate": calculate_conversion_rate(variant_data.get("conversions", 0), sent)
                }
                
                await db.ab_tests.update_one(
                    {"id": test_id},
                    {"$set": {f"{v}.openRate": rates["openRate"],
                              f"{v}.clickRate": rates["clickRate"],
                              f"{v}.replyRate": rates["replyRate"],
                              f"{v}.conversionRate": rates["conversionRate"]}}
                )
    
    return {"success": True, "message": f"Event recorded: {event_type} for variant {variant}"}


@router.delete("/tests/{test_id}")
async def delete_ab_test(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an A/B test"""
    db = get_db()
    
    result = await db.ab_tests.delete_one(
        {"id": test_id, "userId": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return {"success": True, "message": "Test deleted"}


@router.get("/analytics/summary")
async def get_ab_testing_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Get A/B testing analytics summary"""
    db = get_db()
    
    total_tests = await db.ab_tests.count_documents({"userId": current_user["id"]})
    completed_tests = await db.ab_tests.count_documents({
        "userId": current_user["id"],
        "status": {"$in": [TestStatus.COMPLETED.value, TestStatus.WINNER_APPLIED.value]}
    })
    running_tests = await db.ab_tests.count_documents({
        "userId": current_user["id"],
        "status": TestStatus.RUNNING.value
    })
    
    # Tests with clear winners
    tests_with_winner = await db.ab_tests.count_documents({
        "userId": current_user["id"],
        "winner": {"$ne": None}
    })
    
    # Get learnings
    learnings = await db.ab_test_learnings.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("appliedAt", -1).limit(10).to_list(10)
    
    # Average improvement from winners
    improvements = [l.get("improvement", 0) for l in learnings if l.get("improvement")]
    avg_improvement = sum(improvements) / max(len(improvements), 1)
    
    # By test type
    by_type = {}
    for test_type in TestType:
        count = await db.ab_tests.count_documents({
            "userId": current_user["id"],
            "testType": test_type.value
        })
        by_type[test_type.value] = count
    
    return {
        "totalTests": total_tests,
        "completedTests": completed_tests,
        "runningTests": running_tests,
        "testsWithWinner": tests_with_winner,
        "winRate": round(tests_with_winner / max(completed_tests, 1) * 100, 1),
        "avgImprovement": round(avg_improvement, 1),
        "byType": by_type,
        "recentLearnings": learnings
    }


@router.get("/learnings")
async def get_ab_learnings(
    test_type: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get learnings from completed A/B tests"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if test_type:
        query["testType"] = test_type
    
    learnings = await db.ab_test_learnings.find(
        query,
        {"_id": 0}
    ).sort("appliedAt", -1).limit(limit).to_list(limit)
    
    return learnings


@router.post("/suggest-test")
async def suggest_ab_test(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered A/B test suggestions based on past performance"""
    db = get_db()
    
    goal = request.get("goal", "improve_open_rates")
    
    suggestions = []
    
    if goal in ["improve_open_rates", "all"]:
        # Subject line test suggestion
        suggestions.append({
            "testType": TestType.EMAIL_SUBJECT.value,
            "name": "Subject Line Optimization",
            "description": "Test personalized vs. benefit-driven subject lines",
            "variantA": {
                "name": "Personalized",
                "example": "{{firstName}}, quick question about {{company}}"
            },
            "variantB": {
                "name": "Benefit-driven",
                "example": "Cut your sales cycle by 40%"
            },
            "expectedImpact": "10-25% improvement in open rates"
        })
        
        # Send time test
        suggestions.append({
            "testType": TestType.SEND_TIME.value,
            "name": "Send Time Optimization",
            "description": "Test morning vs. afternoon send times",
            "variantA": {
                "name": "Morning (9 AM)",
                "sendTime": "09:00"
            },
            "variantB": {
                "name": "Afternoon (2 PM)",
                "sendTime": "14:00"
            },
            "expectedImpact": "5-15% improvement in open rates"
        })
    
    if goal in ["improve_replies", "all"]:
        # CTA test
        suggestions.append({
            "testType": TestType.EMAIL_CTA.value,
            "name": "CTA Optimization",
            "description": "Test soft vs. direct call-to-action",
            "variantA": {
                "name": "Soft CTA",
                "example": "Would love to hear your thoughts"
            },
            "variantB": {
                "name": "Direct CTA",
                "example": "Let's schedule a 15-min call this week"
            },
            "expectedImpact": "15-30% improvement in reply rates"
        })
    
    if goal in ["improve_conversions", "all"]:
        # Channel test
        suggestions.append({
            "testType": TestType.CHANNEL.value,
            "name": "Channel Optimization",
            "description": "Test email vs. LinkedIn outreach",
            "variantA": {
                "name": "Email",
                "channel": Channel.EMAIL.value
            },
            "variantB": {
                "name": "LinkedIn",
                "channel": Channel.LINKEDIN.value
            },
            "expectedImpact": "Varies by audience, typically 10-40% difference"
        })
    
    return {
        "goal": goal,
        "suggestions": suggestions,
        "count": len(suggestions)
    }


@router.post("/quick-create")
async def quick_create_test(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Quick create an A/B test from a suggestion"""
    db = get_db()
    
    suggestion_type = request.get("suggestionType")
    prospect_ids = request.get("prospectIds", [])
    
    test_config = {
        "prospectIds": prospect_ids,
        "splitRatio": 50,
        "minSampleSize": max(len(prospect_ids) // 2, 50),
        "confidenceThreshold": 95,
        "autoApplyWinner": request.get("autoApplyWinner", True)
    }
    
    if suggestion_type == "subject_line":
        test_config.update({
            "name": "Subject Line A/B Test",
            "testType": TestType.EMAIL_SUBJECT.value,
            "primaryMetric": "openRate",
            "variantAName": "Personalized",
            "variantAContent": {"subjectLine": request.get("subjectA", "{{firstName}}, quick question")},
            "variantBName": "Benefit-driven",
            "variantBContent": {"subjectLine": request.get("subjectB", "Increase your sales by 40%")}
        })
    
    elif suggestion_type == "send_time":
        test_config.update({
            "name": "Send Time A/B Test",
            "testType": TestType.SEND_TIME.value,
            "primaryMetric": "openRate",
            "variantAName": "Morning",
            "variantAContent": {},
            "sendTimeA": request.get("timeA", "09:00"),
            "variantBName": "Afternoon",
            "variantBContent": {},
            "sendTimeB": request.get("timeB", "14:00")
        })
    
    elif suggestion_type == "cta":
        test_config.update({
            "name": "CTA A/B Test",
            "testType": TestType.EMAIL_CTA.value,
            "primaryMetric": "replyRate",
            "variantAName": "Soft CTA",
            "variantAContent": {"cta": request.get("ctaA", "Would love to hear your thoughts")},
            "variantBName": "Direct CTA",
            "variantBContent": {"cta": request.get("ctaB", "Let's schedule a call")}
        })
    
    elif suggestion_type == "channel":
        test_config.update({
            "name": "Channel A/B Test",
            "testType": TestType.CHANNEL.value,
            "primaryMetric": "conversionRate",
            "variantAName": "Email",
            "variantAContent": {},
            "channelA": Channel.EMAIL.value,
            "variantBName": "LinkedIn",
            "variantBContent": {},
            "channelB": Channel.LINKEDIN.value
        })
    
    else:
        raise HTTPException(status_code=400, detail="Invalid suggestion type")
    
    # Create the test
    return await create_ab_test(test_config, current_user)
