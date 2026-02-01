"""
Predictive Lead Scoring Router

AI-powered lead scoring with customizable factors and learning from results.

Features:
- Multi-factor scoring (ICP fit, engagement, company size, industry, budget signals)
- User-customizable factor weights
- Auto-scoring on prospect creation/update
- Learning from results (won/lost deals)
- Score explanations and priority recommendations
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import math

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


# ============== DEFAULT SCORING MODEL ==============

DEFAULT_SCORING_FACTORS = {
    "company_size": {
        "weight": 15,
        "description": "Company employee count",
        "scoring": {
            "enterprise": {"min": 1000, "score": 100},
            "mid_market": {"min": 100, "max": 999, "score": 80},
            "smb": {"min": 20, "max": 99, "score": 60},
            "startup": {"min": 1, "max": 19, "score": 40}
        }
    },
    "industry_fit": {
        "weight": 20,
        "description": "Industry alignment with ICP",
        "scoring": {
            "perfect_match": 100,
            "good_match": 80,
            "partial_match": 50,
            "no_match": 20
        }
    },
    "job_title": {
        "weight": 20,
        "description": "Decision-maker seniority",
        "scoring": {
            "c_level": {"titles": ["ceo", "cto", "cfo", "coo", "cmo", "cio"], "score": 100},
            "vp": {"titles": ["vp", "vice president", "svp"], "score": 90},
            "director": {"titles": ["director", "head of"], "score": 75},
            "manager": {"titles": ["manager", "lead"], "score": 55},
            "individual": {"titles": [], "score": 30}
        }
    },
    "engagement_score": {
        "weight": 25,
        "description": "Email opens, clicks, replies",
        "scoring": {
            "high": {"min_actions": 5, "score": 100},
            "medium": {"min_actions": 2, "max_actions": 4, "score": 70},
            "low": {"min_actions": 1, "max_actions": 1, "score": 40},
            "none": {"max_actions": 0, "score": 10}
        }
    },
    "budget_signals": {
        "weight": 10,
        "description": "Budget indicators from research",
        "scoring": {
            "confirmed": 100,
            "likely": 75,
            "possible": 50,
            "unknown": 25
        }
    },
    "timing": {
        "weight": 10,
        "description": "Purchase timeline signals",
        "scoring": {
            "immediate": {"months": 0, "max_months": 3, "score": 100},
            "near_term": {"months": 3, "max_months": 6, "score": 75},
            "future": {"months": 6, "max_months": 12, "score": 50},
            "no_timeline": {"score": 25}
        }
    }
}

# ICP Industry matching
ICP_INDUSTRIES = {
    "perfect": ["technology", "saas", "software", "fintech", "enterprise software"],
    "good": ["finance", "healthcare tech", "e-commerce", "digital media"],
    "partial": ["manufacturing", "retail", "professional services", "logistics"],
    "other": []
}


# ============== SCORING ENGINE ==============

class LeadScoringEngine:
    """Calculates lead scores based on configurable factors"""
    
    def __init__(self, factors: Dict = None):
        self.factors = factors or DEFAULT_SCORING_FACTORS
    
    def score_prospect(self, prospect: Dict, user_config: Dict = None) -> Dict:
        """Calculate comprehensive lead score for a prospect"""
        
        # Merge user config with defaults
        scoring_config = {**self.factors}
        if user_config and user_config.get("factors"):
            for factor, config in user_config["factors"].items():
                if factor in scoring_config:
                    scoring_config[factor]["weight"] = config.get("weight", scoring_config[factor]["weight"])
        
        # Calculate individual factor scores
        factor_scores = {}
        breakdown = []
        total_weight = sum(f["weight"] for f in scoring_config.values())
        
        # Company Size Score
        company_size = prospect.get("companySize") or prospect.get("employeeCount") or 0
        size_score = self._score_company_size(company_size, scoring_config["company_size"])
        factor_scores["company_size"] = size_score
        breakdown.append({
            "factor": "Company Size",
            "score": size_score,
            "weight": scoring_config["company_size"]["weight"],
            "reason": self._explain_company_size(company_size)
        })
        
        # Industry Fit Score
        industry = (prospect.get("industry") or prospect.get("company", {}).get("industry") or "").lower()
        industry_score = self._score_industry(industry, scoring_config["industry_fit"])
        factor_scores["industry_fit"] = industry_score
        breakdown.append({
            "factor": "Industry Fit",
            "score": industry_score,
            "weight": scoring_config["industry_fit"]["weight"],
            "reason": self._explain_industry(industry)
        })
        
        # Job Title Score
        title = (prospect.get("title") or prospect.get("jobTitle") or "").lower()
        title_score = self._score_title(title, scoring_config["job_title"])
        factor_scores["job_title"] = title_score
        breakdown.append({
            "factor": "Job Title",
            "score": title_score,
            "weight": scoring_config["job_title"]["weight"],
            "reason": self._explain_title(title)
        })
        
        # Engagement Score
        engagement = prospect.get("engagement", {})
        opens = engagement.get("opens", 0)
        clicks = engagement.get("clicks", 0)
        replies = engagement.get("replies", 0)
        total_actions = opens + clicks * 2 + replies * 3
        engagement_score = self._score_engagement(total_actions, scoring_config["engagement_score"])
        factor_scores["engagement_score"] = engagement_score
        breakdown.append({
            "factor": "Engagement",
            "score": engagement_score,
            "weight": scoring_config["engagement_score"]["weight"],
            "reason": f"{opens} opens, {clicks} clicks, {replies} replies"
        })
        
        # Budget Signals Score
        budget_signal = prospect.get("budgetSignal", "unknown").lower()
        budget_score = scoring_config["budget_signals"]["scoring"].get(budget_signal, 25)
        factor_scores["budget_signals"] = budget_score
        breakdown.append({
            "factor": "Budget Signals",
            "score": budget_score,
            "weight": scoring_config["budget_signals"]["weight"],
            "reason": f"Budget signal: {budget_signal}"
        })
        
        # Timing Score
        timeline_months = prospect.get("timelineMonths")
        timing_score = self._score_timing(timeline_months, scoring_config["timing"])
        factor_scores["timing"] = timing_score
        breakdown.append({
            "factor": "Timing",
            "score": timing_score,
            "weight": scoring_config["timing"]["weight"],
            "reason": self._explain_timing(timeline_months)
        })
        
        # Calculate weighted total
        weighted_total = sum(
            factor_scores[factor] * (scoring_config[factor]["weight"] / total_weight)
            for factor in factor_scores
        )
        
        final_score = round(weighted_total, 1)
        
        # Determine priority level
        if final_score >= 80:
            priority = "hot"
            recommendation = "Prioritize immediate outreach"
        elif final_score >= 60:
            priority = "warm"
            recommendation = "Good prospect, follow up within 2 days"
        elif final_score >= 40:
            priority = "nurture"
            recommendation = "Add to nurture campaign"
        else:
            priority = "cold"
            recommendation = "Low priority, may need more qualification"
        
        return {
            "score": final_score,
            "priority": priority,
            "recommendation": recommendation,
            "factorScores": factor_scores,
            "breakdown": breakdown,
            "scoredAt": datetime.now(timezone.utc).isoformat()
        }
    
    def _score_company_size(self, size: int, config: Dict) -> int:
        scoring = config["scoring"]
        if size >= scoring["enterprise"]["min"]:
            return scoring["enterprise"]["score"]
        elif size >= scoring["mid_market"]["min"]:
            return scoring["mid_market"]["score"]
        elif size >= scoring["smb"]["min"]:
            return scoring["smb"]["score"]
        elif size >= scoring["startup"]["min"]:
            return scoring["startup"]["score"]
        return 20
    
    def _explain_company_size(self, size: int) -> str:
        if size >= 1000:
            return f"Enterprise ({size:,} employees)"
        elif size >= 100:
            return f"Mid-market ({size:,} employees)"
        elif size >= 20:
            return f"SMB ({size:,} employees)"
        elif size > 0:
            return f"Startup ({size:,} employees)"
        return "Unknown company size"
    
    def _score_industry(self, industry: str, config: Dict) -> int:
        if any(ind in industry for ind in ICP_INDUSTRIES["perfect"]):
            return config["scoring"]["perfect_match"]
        elif any(ind in industry for ind in ICP_INDUSTRIES["good"]):
            return config["scoring"]["good_match"]
        elif any(ind in industry for ind in ICP_INDUSTRIES["partial"]):
            return config["scoring"]["partial_match"]
        return config["scoring"]["no_match"]
    
    def _explain_industry(self, industry: str) -> str:
        if any(ind in industry for ind in ICP_INDUSTRIES["perfect"]):
            return f"Perfect ICP match: {industry}"
        elif any(ind in industry for ind in ICP_INDUSTRIES["good"]):
            return f"Good industry fit: {industry}"
        elif any(ind in industry for ind in ICP_INDUSTRIES["partial"]):
            return f"Partial match: {industry}"
        return f"Outside typical ICP: {industry or 'Unknown'}"
    
    def _score_title(self, title: str, config: Dict) -> int:
        scoring = config["scoring"]
        if any(t in title for t in scoring["c_level"]["titles"]):
            return scoring["c_level"]["score"]
        elif any(t in title for t in scoring["vp"]["titles"]):
            return scoring["vp"]["score"]
        elif any(t in title for t in scoring["director"]["titles"]):
            return scoring["director"]["score"]
        elif any(t in title for t in scoring["manager"]["titles"]):
            return scoring["manager"]["score"]
        return scoring["individual"]["score"]
    
    def _explain_title(self, title: str) -> str:
        title_lower = title.lower()
        if any(t in title_lower for t in ["ceo", "cto", "cfo", "coo", "cmo", "cio"]):
            return f"C-Level executive: {title}"
        elif any(t in title_lower for t in ["vp", "vice president", "svp"]):
            return f"VP-level: {title}"
        elif any(t in title_lower for t in ["director", "head of"]):
            return f"Director-level: {title}"
        elif any(t in title_lower for t in ["manager", "lead"]):
            return f"Manager-level: {title}"
        return f"Individual contributor: {title or 'Unknown'}"
    
    def _score_engagement(self, total_actions: int, config: Dict) -> int:
        scoring = config["scoring"]
        if total_actions >= scoring["high"]["min_actions"]:
            return scoring["high"]["score"]
        elif total_actions >= scoring["medium"]["min_actions"]:
            return scoring["medium"]["score"]
        elif total_actions >= scoring["low"]["min_actions"]:
            return scoring["low"]["score"]
        return scoring["none"]["score"]
    
    def _score_timing(self, months: Optional[int], config: Dict) -> int:
        scoring = config["scoring"]
        if months is None:
            return scoring["no_timeline"]["score"]
        if months <= 3:
            return scoring["immediate"]["score"]
        elif months <= 6:
            return scoring["near_term"]["score"]
        elif months <= 12:
            return scoring["future"]["score"]
        return scoring["no_timeline"]["score"]
    
    def _explain_timing(self, months: Optional[int]) -> str:
        if months is None:
            return "No timeline specified"
        if months <= 3:
            return f"Immediate need ({months} months)"
        elif months <= 6:
            return f"Near-term ({months} months)"
        elif months <= 12:
            return f"Future consideration ({months} months)"
        return f"Long-term ({months} months)"


scoring_engine = LeadScoringEngine()


# ============== API ENDPOINTS ==============

@router.post("/score")
async def score_prospect(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Score a single prospect"""
    db = get_db()
    
    prospect = request.get("prospect", {})
    prospect_id = request.get("prospectId")
    
    # If prospect_id provided, fetch from DB
    if prospect_id and not prospect:
        db_prospect = await db.prospects.find_one(
            {"id": prospect_id, "userId": current_user["id"]},
            {"_id": 0}
        )
        if db_prospect:
            prospect = db_prospect
    
    if not prospect:
        raise HTTPException(status_code=400, detail="Prospect data required")
    
    # Get user's scoring config
    user_config = await db.lead_scoring_config.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    # Score the prospect
    score_result = scoring_engine.score_prospect(prospect, user_config)
    
    # If prospect_id, save score to DB
    if prospect_id:
        await db.prospects.update_one(
            {"id": prospect_id, "userId": current_user["id"]},
            {
                "$set": {
                    "leadScore": score_result["score"],
                    "leadPriority": score_result["priority"],
                    "scoreBreakdown": score_result["breakdown"],
                    "lastScoredAt": score_result["scoredAt"]
                }
            }
        )
        
        # Record scoring event
        await db.lead_score_history.insert_one({
            "id": str(uuid4()),
            "userId": current_user["id"],
            "prospectId": prospect_id,
            "score": score_result["score"],
            "priority": score_result["priority"],
            "breakdown": score_result["breakdown"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    return score_result


@router.post("/score-batch")
async def score_prospects_batch(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Score multiple prospects"""
    db = get_db()
    
    prospect_ids = request.get("prospectIds", [])
    
    if not prospect_ids:
        # Score all unscored prospects
        unscored = await db.prospects.find(
            {
                "userId": current_user["id"],
                "$or": [
                    {"leadScore": {"$exists": False}},
                    {"leadScore": None}
                ]
            },
            {"_id": 0}
        ).limit(100).to_list(100)
        prospect_ids = [p["id"] for p in unscored]
    
    # Get user's scoring config
    user_config = await db.lead_scoring_config.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    results = []
    
    for prospect_id in prospect_ids:
        prospect = await db.prospects.find_one(
            {"id": prospect_id, "userId": current_user["id"]},
            {"_id": 0}
        )
        
        if prospect:
            score_result = scoring_engine.score_prospect(prospect, user_config)
            
            await db.prospects.update_one(
                {"id": prospect_id},
                {
                    "$set": {
                        "leadScore": score_result["score"],
                        "leadPriority": score_result["priority"],
                        "scoreBreakdown": score_result["breakdown"],
                        "lastScoredAt": score_result["scoredAt"]
                    }
                }
            )
            
            results.append({
                "prospectId": prospect_id,
                "score": score_result["score"],
                "priority": score_result["priority"]
            })
    
    return {
        "success": True,
        "scored": len(results),
        "results": results
    }


@router.get("/config")
async def get_scoring_config(
    current_user: dict = Depends(get_current_user)
):
    """Get user's lead scoring configuration"""
    db = get_db()
    
    config = await db.lead_scoring_config.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not config:
        # Return defaults
        return {
            "userId": current_user["id"],
            "factors": DEFAULT_SCORING_FACTORS,
            "icpIndustries": ICP_INDUSTRIES,
            "autoScore": True,
            "scoreOnCreate": True,
            "scoreOnUpdate": True
        }
    
    return config


@router.put("/config")
async def update_scoring_config(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update lead scoring configuration"""
    db = get_db()
    
    config = {
        "userId": current_user["id"],
        "factors": request.get("factors", DEFAULT_SCORING_FACTORS),
        "icpIndustries": request.get("icpIndustries", ICP_INDUSTRIES),
        "autoScore": request.get("autoScore", True),
        "scoreOnCreate": request.get("scoreOnCreate", True),
        "scoreOnUpdate": request.get("scoreOnUpdate", True),
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.lead_scoring_config.update_one(
        {"userId": current_user["id"]},
        {"$set": config},
        upsert=True
    )
    
    return {"success": True, "message": "Scoring config updated"}


@router.put("/config/factor/{factor_name}")
async def update_factor_weight(
    factor_name: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a single factor's weight"""
    db = get_db()
    
    if factor_name not in DEFAULT_SCORING_FACTORS:
        raise HTTPException(status_code=400, detail=f"Invalid factor: {factor_name}")
    
    weight = request.get("weight")
    if weight is None or weight < 0 or weight > 100:
        raise HTTPException(status_code=400, detail="Weight must be between 0 and 100")
    
    await db.lead_scoring_config.update_one(
        {"userId": current_user["id"]},
        {"$set": {f"factors.{factor_name}.weight": weight}},
        upsert=True
    )
    
    return {"success": True, "factor": factor_name, "weight": weight}


@router.get("/top-leads")
async def get_top_leads(
    limit: int = 10,
    min_score: int = 60,
    current_user: dict = Depends(get_current_user)
):
    """Get top scored leads (hot leads)"""
    db = get_db()
    
    top_leads = await db.prospects.find(
        {
            "userId": current_user["id"],
            "leadScore": {"$gte": min_score}
        },
        {"_id": 0}
    ).sort("leadScore", -1).limit(limit).to_list(limit)
    
    return {
        "topLeads": top_leads,
        "count": len(top_leads),
        "minScore": min_score
    }


@router.get("/distribution")
async def get_score_distribution(
    current_user: dict = Depends(get_current_user)
):
    """Get distribution of lead scores"""
    db = get_db()
    
    hot = await db.prospects.count_documents({
        "userId": current_user["id"],
        "leadScore": {"$gte": 80}
    })
    
    warm = await db.prospects.count_documents({
        "userId": current_user["id"],
        "leadScore": {"$gte": 60, "$lt": 80}
    })
    
    nurture = await db.prospects.count_documents({
        "userId": current_user["id"],
        "leadScore": {"$gte": 40, "$lt": 60}
    })
    
    cold = await db.prospects.count_documents({
        "userId": current_user["id"],
        "leadScore": {"$lt": 40}
    })
    
    unscored = await db.prospects.count_documents({
        "userId": current_user["id"],
        "$or": [
            {"leadScore": {"$exists": False}},
            {"leadScore": None}
        ]
    })
    
    total = hot + warm + nurture + cold + unscored
    
    return {
        "distribution": {
            "hot": {"count": hot, "percentage": round(hot / max(total, 1) * 100, 1)},
            "warm": {"count": warm, "percentage": round(warm / max(total, 1) * 100, 1)},
            "nurture": {"count": nurture, "percentage": round(nurture / max(total, 1) * 100, 1)},
            "cold": {"count": cold, "percentage": round(cold / max(total, 1) * 100, 1)},
            "unscored": {"count": unscored, "percentage": round(unscored / max(total, 1) * 100, 1)}
        },
        "total": total
    }


@router.post("/learn")
async def record_outcome(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Record deal outcome to improve scoring model"""
    db = get_db()
    
    prospect_id = request.get("prospectId")
    outcome = request.get("outcome")  # won, lost, disqualified
    deal_value = request.get("dealValue")
    notes = request.get("notes", "")
    
    if not prospect_id or not outcome:
        raise HTTPException(status_code=400, detail="prospectId and outcome required")
    
    if outcome not in ["won", "lost", "disqualified"]:
        raise HTTPException(status_code=400, detail="outcome must be won, lost, or disqualified")
    
    # Get prospect and their score at the time
    prospect = await db.prospects.find_one(
        {"id": prospect_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Record the outcome for learning
    learning_record = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "prospectId": prospect_id,
        "outcome": outcome,
        "dealValue": deal_value,
        "scoreAtOutcome": prospect.get("leadScore"),
        "factorScoresAtOutcome": prospect.get("scoreBreakdown", []),
        "notes": notes,
        "prospectData": {
            "industry": prospect.get("industry"),
            "companySize": prospect.get("companySize"),
            "title": prospect.get("title"),
            "engagement": prospect.get("engagement", {})
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.lead_score_outcomes.insert_one(learning_record)
    
    # Update prospect status
    await db.prospects.update_one(
        {"id": prospect_id},
        {
            "$set": {
                "status": "closed_won" if outcome == "won" else "closed_lost" if outcome == "lost" else "disqualified",
                "dealValue": deal_value,
                "outcomeRecordedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": f"Outcome recorded: {outcome}",
        "learningId": learning_record["id"]
    }


@router.get("/model-accuracy")
async def get_model_accuracy(
    current_user: dict = Depends(get_current_user)
):
    """Get scoring model accuracy based on outcomes"""
    db = get_db()
    
    # Get all recorded outcomes
    outcomes = await db.lead_score_outcomes.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).to_list(500)
    
    if not outcomes:
        return {
            "message": "Not enough data to calculate accuracy",
            "totalOutcomes": 0
        }
    
    # Calculate accuracy metrics
    total = len(outcomes)
    wins = [o for o in outcomes if o["outcome"] == "won"]
    losses = [o for o in outcomes if o["outcome"] == "lost"]
    
    # Check if high-scored leads converted at higher rate
    high_score_wins = [o for o in wins if (o.get("scoreAtOutcome") or 0) >= 70]
    high_score_losses = [o for o in losses if (o.get("scoreAtOutcome") or 0) >= 70]
    
    low_score_wins = [o for o in wins if (o.get("scoreAtOutcome") or 0) < 50]
    low_score_losses = [o for o in losses if (o.get("scoreAtOutcome") or 0) < 50]
    
    # Calculate precision
    high_score_total = len(high_score_wins) + len(high_score_losses)
    high_score_precision = len(high_score_wins) / max(high_score_total, 1) * 100
    
    # Average score for wins vs losses
    avg_win_score = sum(o.get("scoreAtOutcome") or 0 for o in wins) / max(len(wins), 1)
    avg_loss_score = sum(o.get("scoreAtOutcome") or 0 for o in losses) / max(len(losses), 1)
    
    return {
        "totalOutcomes": total,
        "wins": len(wins),
        "losses": len(losses),
        "highScorePrecision": round(high_score_precision, 1),
        "avgWinScore": round(avg_win_score, 1),
        "avgLossScore": round(avg_loss_score, 1),
        "scoreDifferential": round(avg_win_score - avg_loss_score, 1),
        "modelHealth": "good" if avg_win_score > avg_loss_score + 10 else "needs_tuning"
    }


@router.get("/recommendations")
async def get_scoring_recommendations(
    current_user: dict = Depends(get_current_user)
):
    """Get AI recommendations for scoring model improvement"""
    db = get_db()
    
    # Get outcomes to analyze
    outcomes = await db.lead_score_outcomes.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).to_list(200)
    
    recommendations = []
    
    if len(outcomes) < 10:
        recommendations.append({
            "type": "data_needed",
            "message": "Record more deal outcomes to improve scoring accuracy",
            "priority": "high"
        })
    else:
        wins = [o for o in outcomes if o["outcome"] == "won"]
        losses = [o for o in outcomes if o["outcome"] == "lost"]
        
        # Analyze which factors correlate with wins
        if wins:
            # Check industry patterns
            winning_industries = [o.get("prospectData", {}).get("industry", "") for o in wins]
            industry_counts = {}
            for ind in winning_industries:
                if ind:
                    industry_counts[ind] = industry_counts.get(ind, 0) + 1
            
            if industry_counts:
                top_industry = max(industry_counts, key=industry_counts.get)
                recommendations.append({
                    "type": "factor_insight",
                    "factor": "industry_fit",
                    "message": f"'{top_industry}' industry has highest win rate. Consider prioritizing this industry.",
                    "priority": "medium"
                })
        
        # Check if engagement correlates with wins
        avg_win_engagement = sum(
            sum((o.get("prospectData", {}).get("engagement", {})).values()) 
            for o in wins
        ) / max(len(wins), 1)
        
        avg_loss_engagement = sum(
            sum((o.get("prospectData", {}).get("engagement", {})).values()) 
            for o in losses
        ) / max(len(losses), 1)
        
        if avg_win_engagement > avg_loss_engagement * 1.5:
            recommendations.append({
                "type": "weight_adjustment",
                "factor": "engagement_score",
                "message": "High engagement strongly correlates with wins. Consider increasing engagement weight.",
                "priority": "high"
            })
    
    # Get top leads that need attention
    hot_leads = await db.prospects.find(
        {
            "userId": current_user["id"],
            "leadScore": {"$gte": 75},
            "status": {"$nin": ["closed_won", "closed_lost", "disqualified"]}
        },
        {"_id": 0}
    ).sort("leadScore", -1).limit(5).to_list(5)
    
    if hot_leads:
        recommendations.append({
            "type": "action_needed",
            "message": f"You have {len(hot_leads)} hot leads that need immediate attention",
            "leads": [{"id": l["id"], "name": f"{l.get('firstName', '')} {l.get('lastName', '')}", "score": l.get("leadScore")} for l in hot_leads],
            "priority": "high"
        })
    
    return {
        "recommendations": recommendations,
        "totalRecommendations": len(recommendations)
    }
