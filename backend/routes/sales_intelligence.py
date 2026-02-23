"""
Sales Intelligence Router

Implements the backlog slice for:
1) Predictive analytics
2) Conversation intelligence
3) Multi-channel engagement
4) Campaign management
5) Relationship mapping
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4
import math
import os
import re
import logging

from database import get_db
from routes.auth import get_current_user

router = APIRouter()
logger = logging.getLogger("engageai.sales_intelligence")

SUPPORTED_CHANNELS = {"email", "linkedin", "phone", "sms"}
SENTIMENT_POSITIVE_TERMS = {
    "great",
    "good",
    "interested",
    "yes",
    "approved",
    "sounds good",
    "let's do it",
    "booked",
    "thanks",
}
SENTIMENT_NEGATIVE_TERMS = {
    "not interested",
    "no",
    "stop",
    "unsubscribe",
    "busy",
    "later",
    "too expensive",
    "budget",
    "competitor",
    "already using",
}
OBJECTION_PATTERNS = {
    "budget": ["budget", "too expensive", "cost", "price"],
    "timing": ["later", "not now", "timing", "next quarter", "next month"],
    "authority": ["not the right person", "decision maker", "my manager", "procurement"],
    "competition": ["competitor", "already using", "current vendor", "alternative"],
}
PHRASE_MIN_TOKEN_LENGTH = 3
MAX_PHRASE_NGRAM = 3
DEFAULT_PHRASE_STOPWORDS = {
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "your",
    "have",
    "will",
    "you",
    "our",
    "are",
    "about",
    "just",
    "into",
    "they",
    "them",
    "their",
    "what",
    "when",
    "where",
    "which",
    "while",
    "could",
    "would",
    "should",
    "been",
    "also",
    "than",
    "then",
    "were",
    "want",
    "need",
}
POSITIVE_EVENT_WEIGHTS = {
    "reply": 1.0,
    "replied": 1.0,
    "meeting_booked": 1.6,
    "demo_booked": 1.6,
    "clicked": 0.7,
    "open": 0.3,
}
NEGATIVE_EVENT_WEIGHTS = {
    "unsubscribe": 1.4,
    "unsubscribed": 1.4,
    "bounce": 1.3,
    "bounced": 1.3,
    "blocked": 1.2,
    "spamreport": 1.8,
    "complaint": 1.8,
    "negative_reply": 1.2,
}
CHANNEL_RESPONSE_FACTOR = {
    "email": 1.0,
    "linkedin": 0.92,
    "phone": 0.8,
    "sms": 0.88,
}
SPAM_RISK_TERMS = {
    "free",
    "urgent",
    "guaranteed",
    "limited time",
    "act now",
    "risk free",
}
CTA_TERMS = {
    "reply",
    "book",
    "schedule",
    "meeting",
    "call",
    "demo",
    "connect",
}
POSITIVE_FEEDBACK_OUTCOMES = {"reply", "replied", "meeting_booked", "demo_booked", "converted", "won"}
NEGATIVE_FEEDBACK_OUTCOMES = {
    "no_reply",
    "no-response",
    "not_interested",
    "lost",
    "unsubscribe",
    "unsubscribed",
    "bounce",
    "bounced",
}
TELEMETRY_SCHEMA_VERSION = 2


def _is_truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _feature_enabled(name: str, default: bool = True) -> bool:
    return _is_truthy(os.getenv(name), default=default)


def _iso_days_ago(days: int) -> str:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return cutoff.isoformat()


def _extract_request_id(http_request: Optional[Request]) -> Optional[str]:
    if not http_request:
        return None
    request_id = (
        http_request.headers.get("x-request-id")
        or http_request.headers.get("x-correlation-id")
    )
    if not request_id:
        return None
    normalized = str(request_id).strip()
    if not normalized:
        return None
    return normalized[:128]


async def _emit_sales_intelligence_telemetry(
    db: Any,
    user_id: str,
    event_type: str,
    payload: Dict[str, Any],
    http_request: Optional[Request] = None,
) -> None:
    safe_payload = dict(payload)
    safe_payload.pop("message", None)
    safe_payload.pop("subject", None)
    safe_payload.pop("raw_text", None)
    safe_payload["schema_version"] = TELEMETRY_SCHEMA_VERSION
    request_id = _extract_request_id(http_request)
    if request_id:
        safe_payload["request_id"] = request_id
    event_doc = {
        "id": str(uuid4()),
        "userId": user_id,
        "provider": "sales_intelligence",
        "eventType": event_type,
        "schemaVersion": TELEMETRY_SCHEMA_VERSION,
        "payload": safe_payload,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.integration_telemetry.insert_one(event_doc)
    except Exception:
        logger.warning("sales_intelligence_telemetry_write_failed", exc_info=True)


def normalize_channel(channel: Optional[str]) -> str:
    raw = (channel or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "inmail": "linkedin",
        "linkedin_message": "linkedin",
        "call": "phone",
        "voice": "phone",
        "text": "sms",
    }
    normalized = aliases.get(raw, raw)
    if normalized in SUPPORTED_CHANNELS:
        return normalized
    if "email" in normalized:
        return "email"
    if "linkedin" in normalized:
        return "linkedin"
    if "phone" in normalized or "call" in normalized or "voice" in normalized:
        return "phone"
    if "sms" in normalized or "text" in normalized:
        return "sms"
    return "email"


def clamp_probability(value: float) -> float:
    return max(0.05, min(0.95, value))


def tokenize_phrase_terms(text: str) -> List[str]:
    terms = re.findall(r"[a-zA-Z0-9']+", (text or "").lower())
    cleaned = [
        token
        for token in terms
        if len(token) >= PHRASE_MIN_TOKEN_LENGTH and token not in DEFAULT_PHRASE_STOPWORDS
    ]
    return cleaned


def extract_phrases(text: str, max_ngram: int = MAX_PHRASE_NGRAM) -> List[str]:
    tokens = tokenize_phrase_terms(text)
    phrases = set()
    for i in range(len(tokens)):
        for n in range(1, max_ngram + 1):
            if i + n <= len(tokens):
                phrases.add(" ".join(tokens[i : i + n]))
    return sorted(phrases)


def _event_weight(event_type: str) -> float:
    event = (event_type or "").strip().lower()
    if event in POSITIVE_EVENT_WEIGHTS:
        return POSITIVE_EVENT_WEIGHTS[event]
    if event in NEGATIVE_EVENT_WEIGHTS:
        return -NEGATIVE_EVENT_WEIGHTS[event]
    return 0.0


def _phrase_confidence(exposure_count: int) -> float:
    if exposure_count <= 0:
        return 0.0
    confidence = 0.38 + (math.log(exposure_count + 1) / 4.8)
    return round(max(0.05, min(0.95, confidence)), 2)


def build_phrase_effectiveness(
    records: List[Dict[str, Any]],
    min_exposure: int = 2,
    top_k: int = 30,
    query: Optional[str] = None,
) -> Dict[str, Any]:
    phrase_stats: Dict[str, Dict[str, Any]] = {}

    for record in records:
        text = str(record.get("text") or "").strip()
        if not text:
            continue

        event_type = str(record.get("eventType") or "unknown").lower()
        weight = _event_weight(event_type)
        phrases = extract_phrases(text)

        for phrase in phrases:
            entry = phrase_stats.setdefault(
                phrase,
                {
                    "phrase": phrase,
                    "exposureCount": 0,
                    "positiveSignals": 0.0,
                    "negativeSignals": 0.0,
                    "weightedSignal": 0.0,
                },
            )
            entry["exposureCount"] += 1
            if weight > 0:
                entry["positiveSignals"] += weight
            elif weight < 0:
                entry["negativeSignals"] += abs(weight)
            entry["weightedSignal"] += weight

    filtered: List[Dict[str, Any]] = []
    for phrase, entry in phrase_stats.items():
        exposure = int(entry["exposureCount"])
        if exposure < min_exposure:
            continue
        if query and query.lower() not in phrase:
            continue

        smoothed_score = ((entry["weightedSignal"] + 0.5) / (exposure + 1.0)) * 100.0
        filtered.append(
            {
                "phrase": phrase,
                "exposureCount": exposure,
                "positiveSignals": round(entry["positiveSignals"], 2),
                "negativeSignals": round(entry["negativeSignals"], 2),
                "effectivenessScore": round(smoothed_score, 2),
                "confidence": _phrase_confidence(exposure),
            }
        )

    filtered.sort(
        key=lambda item: (item["effectivenessScore"], item["confidence"], item["exposureCount"]),
        reverse=True,
    )
    top_phrases = filtered[:top_k]

    return {
        "phrases": top_phrases,
        "summary": {
            "trackedPhrases": len(top_phrases),
            "candidatePhraseCount": len(filtered),
            "minExposure": min_exposure,
            "query": query or "",
        },
    }


def build_phrase_channel_summary(
    records: List[Dict[str, Any]],
    min_exposure: int = 2,
    top_k: int = 10,
    channels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    allowed_channels = None
    if channels:
        allowed_channels = {normalize_channel(channel) for channel in channels}

    by_channel: Dict[str, List[Dict[str, Any]]] = {}
    for record in records:
        channel = normalize_channel(str(record.get("channel") or "email"))
        if allowed_channels and channel not in allowed_channels:
            continue
        by_channel.setdefault(channel, []).append(record)

    channel_summaries: List[Dict[str, Any]] = []
    for channel, channel_records in sorted(by_channel.items(), key=lambda x: x[0]):
        analytics = build_phrase_effectiveness(
            channel_records,
            min_exposure=min_exposure,
            top_k=top_k,
            query=None,
        )
        channel_summaries.append(
            {
                "channel": channel,
                "recordCount": len(channel_records),
                "trackedPhrases": analytics["summary"]["trackedPhrases"],
                "topPhrases": analytics["phrases"],
            }
        )

    return {
        "channels": channel_summaries,
        "channelCount": len(channel_summaries),
        "totalRecords": sum(item["recordCount"] for item in channel_summaries),
    }


def _send_time_factor(send_time: Optional[str]) -> float:
    if not send_time:
        return 1.0
    try:
        dt = datetime.fromisoformat(send_time.replace("Z", "+00:00"))
    except ValueError:
        return 1.0

    hour = dt.hour
    weekday = dt.weekday()

    if weekday >= 5:
        return 0.82
    if 9 <= hour <= 11:
        return 1.12
    if 13 <= hour <= 16:
        return 1.05
    if 18 <= hour <= 22:
        return 0.85
    if 0 <= hour <= 6:
        return 0.72
    return 0.95


def _content_quality_factor(message: str, first_name: str, company_name: str) -> Dict[str, float]:
    text = (message or "").strip()
    lowered = text.lower()
    length = len(text)

    length_factor = 1.0 if 80 <= length <= 260 else 0.88 if 40 <= length <= 360 else 0.72
    personalization_factor = 1.06 if (first_name.lower() in lowered or company_name.lower() in lowered) else 0.94
    cta_factor = 1.08 if any(term in lowered for term in CTA_TERMS) else 0.93
    spam_factor = 0.86 if any(term in lowered for term in SPAM_RISK_TERMS) else 1.0

    return {
        "length": length_factor,
        "personalization": personalization_factor,
        "cta": cta_factor,
        "spam": spam_factor,
    }


def build_response_prediction(payload: Dict[str, Any], recent_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    prospect = payload.get("prospect") or {}
    message = str(payload.get("message") or "")
    channel = normalize_channel(str(payload.get("channel") or "email"))
    send_time = payload.get("sendTime")

    lead_score = float(prospect.get("leadScore") or 50.0)
    engagement = prospect.get("engagement") or {}
    opens = float(engagement.get("opens") or 0.0)
    clicks = float(engagement.get("clicks") or 0.0)
    replies = float(engagement.get("replies") or 0.0)
    total_interactions = max(1.0, opens + clicks + replies)
    engagement_rate = min(1.0, (opens * 0.2 + clicks * 0.35 + replies * 0.6) / total_interactions)

    first_name = str(prospect.get("firstName") or "")
    company_name = str(prospect.get("company") or prospect.get("companyName") or "")
    quality = _content_quality_factor(message, first_name, company_name)
    quality_factor = quality["length"] * quality["personalization"] * quality["cta"] * quality["spam"]

    channel_factor = CHANNEL_RESPONSE_FACTOR.get(channel, 0.9)
    time_factor = _send_time_factor(send_time)

    recent_replies = sum(
        1 for event in recent_events if str(event.get("eventType") or "").lower() in {"reply", "replied"}
    )
    recent_unsubs = sum(
        1
        for event in recent_events
        if str(event.get("eventType") or "").lower() in {"unsubscribe", "unsubscribed", "spamreport"}
    )
    historical_factor = 1.0 + min(0.16, recent_replies * 0.02) - min(0.2, recent_unsubs * 0.04)

    base_probability = 0.12 + (lead_score / 100.0) * 0.38 + engagement_rate * 0.27
    probability = clamp_probability(base_probability * channel_factor * time_factor * quality_factor * historical_factor)

    evidence_points = 0
    evidence_points += 1 if lead_score > 0 else 0
    evidence_points += 1 if total_interactions > 1 else 0
    evidence_points += 1 if message else 0
    evidence_points += 1 if recent_events else 0
    confidence = round(min(0.94, 0.54 + evidence_points * 0.09), 2)

    rationale = [
        f"Lead score contributes {round((lead_score / 100.0) * 100, 1)}% baseline intent.",
        f"{channel.title()} channel factor applied at {round(channel_factor, 2)}.",
        f"Content quality factor evaluated at {round(quality_factor, 2)}.",
    ]
    if send_time:
        rationale.append(f"Send-time factor evaluated at {round(time_factor, 2)}.")
    if recent_replies or recent_unsubs:
        rationale.append(
            f"Recent history adjusted by replies ({recent_replies}) and unsubscribes/spam ({recent_unsubs})."
        )

    recommended_windows = [
        {"day": "Tuesday", "hour": "10:00"},
        {"day": "Wednesday", "hour": "14:00"},
        {"day": "Thursday", "hour": "10:00"},
    ]

    return {
        "responseProbability": round(probability, 4),
        "confidence": confidence,
        "rationale": rationale[:5],
        "recommendedSendWindows": recommended_windows,
        "channel": channel,
    }


def normalize_feedback_outcome(outcome: str) -> Dict[str, Any]:
    normalized = (outcome or "").strip().lower().replace(" ", "_")
    if normalized in POSITIVE_FEEDBACK_OUTCOMES:
        return {"outcome": normalized, "actualLabel": 1}
    if normalized in NEGATIVE_FEEDBACK_OUTCOMES:
        return {"outcome": normalized, "actualLabel": 0}
    raise HTTPException(status_code=400, detail="Unsupported feedback outcome.")


def build_prediction_performance(
    feedback_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not feedback_records:
        return {
            "sampleSize": 0,
            "avgPredictedProbability": 0.0,
            "actualPositiveRate": 0.0,
            "meanAbsoluteCalibrationError": 0.0,
            "byChannel": {},
            "confidenceBuckets": [],
        }

    total = len(feedback_records)
    avg_predicted = sum(float(r.get("predictedProbability", 0.0)) for r in feedback_records) / total
    positive_rate = sum(int(r.get("actualLabel", 0)) for r in feedback_records) / total
    mae = (
        sum(abs(float(r.get("predictedProbability", 0.0)) - int(r.get("actualLabel", 0))) for r in feedback_records)
        / total
    )

    by_channel: Dict[str, Dict[str, Any]] = {}
    for record in feedback_records:
        channel = normalize_channel(str(record.get("channel") or "email"))
        item = by_channel.setdefault(channel, {"count": 0, "positives": 0, "avgPredictedProbability": 0.0})
        item["count"] += 1
        item["positives"] += int(record.get("actualLabel", 0))
        item["avgPredictedProbability"] += float(record.get("predictedProbability", 0.0))

    for channel, item in by_channel.items():
        count = max(1, item["count"])
        item["positiveRate"] = round(item["positives"] / count, 4)
        item["avgPredictedProbability"] = round(item["avgPredictedProbability"] / count, 4)
        del item["positives"]

    buckets = [
        {"name": "low", "min": 0.0, "max": 0.34},
        {"name": "medium", "min": 0.34, "max": 0.67},
        {"name": "high", "min": 0.67, "max": 1.01},
    ]
    confidence_buckets: List[Dict[str, Any]] = []
    for bucket in buckets:
        subset = [
            r
            for r in feedback_records
            if bucket["min"] <= float(r.get("predictedProbability", 0.0)) < bucket["max"]
        ]
        if not subset:
            continue
        bucket_positive_rate = sum(int(r.get("actualLabel", 0)) for r in subset) / len(subset)
        confidence_buckets.append(
            {
                "bucket": bucket["name"],
                "count": len(subset),
                "avgPredictedProbability": round(
                    sum(float(r.get("predictedProbability", 0.0)) for r in subset) / len(subset), 4
                ),
                "actualPositiveRate": round(bucket_positive_rate, 4),
            }
        )

    return {
        "sampleSize": total,
        "avgPredictedProbability": round(avg_predicted, 4),
        "actualPositiveRate": round(positive_rate, 4),
        "meanAbsoluteCalibrationError": round(mae, 4),
        "byChannel": by_channel,
        "confidenceBuckets": confidence_buckets,
    }


def build_prediction_performance_report(performance: Dict[str, Any]) -> Dict[str, Any]:
    sample_size = int(performance.get("sampleSize") or 0)
    mae = float(performance.get("meanAbsoluteCalibrationError") or 0.0)
    avg_pred = float(performance.get("avgPredictedProbability") or 0.0)
    actual_rate = float(performance.get("actualPositiveRate") or 0.0)
    probability_gap = abs(avg_pred - actual_rate)

    if sample_size < 20:
        quality_tier = "insufficient_data"
        rollout_decision = "hold"
        recommendations = [
            "Collect at least 20 feedback records before calibration-based rollout decisions.",
            "Encourage reps to submit prediction outcomes for sent messages.",
        ]
    elif mae <= 0.2 and probability_gap <= 0.08:
        quality_tier = "good"
        rollout_decision = "expand"
        recommendations = [
            "Expand prediction usage to additional sales sequences.",
            "Continue monitoring weekly calibration metrics.",
        ]
    elif mae <= 0.3 and probability_gap <= 0.15:
        quality_tier = "watch"
        rollout_decision = "hold"
        recommendations = [
            "Hold current rollout and tune heuristics on low-performing channels.",
            "Review phrase-level signals for segments with weaker outcomes.",
        ]
    else:
        quality_tier = "poor"
        rollout_decision = "rollback"
        recommendations = [
            "Pause broad rollout and retune scoring factors.",
            "Prioritize channels and segments with the largest calibration error.",
        ]

    return {
        "qualityTier": quality_tier,
        "rolloutDecision": rollout_decision,
        "sampleSize": sample_size,
        "meanAbsoluteCalibrationError": round(mae, 4),
        "probabilityGap": round(probability_gap, 4),
        "recommendations": recommendations[:3],
    }


def estimate_deal_value(prospect: Dict[str, Any]) -> float:
    explicit = prospect.get("dealValue")
    if isinstance(explicit, (int, float)) and explicit > 0:
        return float(explicit)

    company_size = int(prospect.get("companySize") or prospect.get("employeeCount") or 0)
    title = str(prospect.get("title") or "").lower()

    if company_size >= 1000:
        base = 120000.0
    elif company_size >= 200:
        base = 70000.0
    elif company_size >= 50:
        base = 35000.0
    else:
        base = 15000.0

    if "chief" in title or "cxo" in title or "ceo" in title or "cto" in title:
        base *= 1.2
    elif "vp" in title or "vice president" in title:
        base *= 1.1

    return round(base, 2)


def prospect_probability(prospect: Dict[str, Any]) -> float:
    if isinstance(prospect.get("leadScore"), (int, float)):
        return clamp_probability(float(prospect["leadScore"]) / 100.0)

    priority = str(prospect.get("leadPriority") or "").lower()
    by_priority = {"hot": 0.78, "warm": 0.52, "nurture": 0.31, "cold": 0.12}
    if priority in by_priority:
        return clamp_probability(by_priority[priority])
    return 0.25


def build_pipeline_forecast(
    prospects: List[Dict[str, Any]],
    outcomes: List[Dict[str, Any]],
    window_days: int,
) -> Dict[str, Any]:
    open_pipeline_value = 0.0
    weighted_pipeline_value = 0.0

    for prospect in prospects:
        deal_value = estimate_deal_value(prospect)
        probability = prospect_probability(prospect)
        open_pipeline_value += deal_value
        weighted_pipeline_value += deal_value * probability

    wins = [o for o in outcomes if o.get("outcome") == "won"]
    losses = [o for o in outcomes if o.get("outcome") == "lost"]
    closed = len(wins) + len(losses)

    historic_win_rate = len(wins) / closed if closed else 0.25
    horizon_factor = max(0.3, min(2.0, window_days / 90.0))
    projected_won_value = weighted_pipeline_value * historic_win_rate * horizon_factor

    # Wider interval with less data.
    margin = 0.35 if closed < 10 else 0.25 if closed < 30 else 0.18
    confidence_low = projected_won_value * (1.0 - margin)
    confidence_high = projected_won_value * (1.0 + margin)

    return {
        "openPipelineValue": round(open_pipeline_value, 2),
        "weightedPipelineValue": round(weighted_pipeline_value, 2),
        "projectedWonValue": round(projected_won_value, 2),
        "historicalWinRate": round(historic_win_rate * 100, 1),
        "confidenceInterval": {
            "low": round(confidence_low, 2),
            "high": round(confidence_high, 2),
            "confidenceLevel": 95,
        },
        "sampleSize": {"openProspects": len(prospects), "closedOutcomes": closed},
    }


def classify_sentiment(text: str) -> str:
    content = (text or "").lower()
    positive_hits = sum(1 for term in SENTIMENT_POSITIVE_TERMS if term in content)
    negative_hits = sum(1 for term in SENTIMENT_NEGATIVE_TERMS if term in content)
    if positive_hits > negative_hits:
        return "positive"
    if negative_hits > positive_hits:
        return "negative"
    return "neutral"


def extract_objections(text: str) -> List[str]:
    content = (text or "").lower()
    objections: List[str] = []
    for objection, patterns in OBJECTION_PATTERNS.items():
        if any(pattern in content for pattern in patterns):
            objections.append(objection)
    return objections


def build_conversation_intelligence(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    objection_counts: Dict[str, int] = {k: 0 for k in OBJECTION_PATTERNS.keys()}
    channel_counts: Dict[str, int] = {c: 0 for c in sorted(SUPPORTED_CHANNELS)}
    channel_counts["chat"] = 0

    for record in records:
        text = str(record.get("text") or "")
        channel = normalize_channel(record.get("channel"))
        if str(record.get("channel") or "").lower() == "chat":
            channel_counts["chat"] += 1
        else:
            channel_counts[channel] = channel_counts.get(channel, 0) + 1

        sentiment = classify_sentiment(text)
        sentiment_counts[sentiment] += 1

        for objection in extract_objections(text):
            objection_counts[objection] += 1

    top_objections = [
        {"type": key, "count": count}
        for key, count in sorted(objection_counts.items(), key=lambda x: x[1], reverse=True)
        if count > 0
    ]

    total_records = len(records)
    negative_rate = (sentiment_counts["negative"] / max(total_records, 1)) * 100
    health = "at_risk" if negative_rate >= 35 else "watch" if negative_rate >= 20 else "healthy"

    return {
        "totals": {"records": total_records, "channels": channel_counts},
        "sentiment": sentiment_counts,
        "topObjections": top_objections[:5],
        "relationshipHealth": health,
    }


def build_multi_channel_health(
    campaigns: List[Dict[str, Any]],
    ab_tests: List[Dict[str, Any]],
    prospects: List[Dict[str, Any]],
) -> Dict[str, Any]:
    channel_usage: Dict[str, int] = {channel: 0 for channel in sorted(SUPPORTED_CHANNELS)}
    active_channels = set()

    for campaign in campaigns:
        channels = campaign.get("channels") or []
        for channel in channels:
            normalized = normalize_channel(str(channel))
            channel_usage[normalized] += 1
            active_channels.add(normalized)

    for test in ab_tests:
        if str(test.get("testType") or "").lower() == "channel":
            for key in ("channelA", "channelB"):
                if test.get(key):
                    normalized = normalize_channel(str(test[key]))
                    channel_usage[normalized] += 1
                    active_channels.add(normalized)

    for prospect in prospects:
        preferred = prospect.get("preferredChannel") or prospect.get("primaryChannel")
        if preferred:
            normalized = normalize_channel(str(preferred))
            channel_usage[normalized] += 1
            active_channels.add(normalized)

    coverage_score = round((len(active_channels) / len(SUPPORTED_CHANNELS)) * 100, 1)
    recommendations: List[str] = []
    if "email" not in active_channels:
        recommendations.append("Enable email campaigns for baseline sales coverage.")
    if "linkedin" not in active_channels:
        recommendations.append("Add LinkedIn touchpoints for executive buyer outreach.")
    if "phone" not in active_channels:
        recommendations.append("Add phone follow-up stage for high-intent prospects.")
    if "sms" not in active_channels:
        recommendations.append("Use SMS only for late-stage follow-ups with consent.")

    return {
        "activeChannels": sorted(active_channels),
        "coverageScore": coverage_score,
        "channelUsage": channel_usage,
        "recommendations": recommendations[:3],
    }


def calculate_relationship_strength(prospect: Dict[str, Any]) -> float:
    lead_score = float(prospect.get("leadScore") or 0.0)
    engagement = prospect.get("engagement") or {}
    opens = float(engagement.get("opens") or 0.0)
    clicks = float(engagement.get("clicks") or 0.0)
    replies = float(engagement.get("replies") or 0.0)
    engagement_points = min(100.0, opens * 5.0 + clicks * 12.0 + replies * 25.0)
    strength = (lead_score * 0.65) + (engagement_points * 0.35)
    return round(max(0.0, min(100.0, strength)), 1)


def build_relationship_map(
    prospects: List[Dict[str, Any]],
    companies: List[Dict[str, Any]],
    max_nodes: int = 250,
) -> Dict[str, Any]:
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    company_lookup = {company.get("id"): company for company in companies if company.get("id")}
    added_company_nodes = set()

    for prospect in prospects:
        prospect_id = prospect.get("id")
        if not prospect_id:
            continue

        if len(nodes) >= max_nodes:
            break

        nodes.append(
            {
                "id": prospect_id,
                "type": "prospect",
                "label": f"{prospect.get('firstName', '')} {prospect.get('lastName', '')}".strip() or "Unknown Prospect",
                "score": float(prospect.get("leadScore") or 0.0),
            }
        )

        company_id = prospect.get("companyId")
        if not company_id:
            continue

        company = company_lookup.get(company_id)
        company_label = (company or {}).get("name") or prospect.get("company") or "Unknown Company"

        if company_id not in added_company_nodes:
            nodes.append({"id": company_id, "type": "company", "label": company_label})
            added_company_nodes.add(company_id)

        edges.append(
            {
                "source": prospect_id,
                "target": company_id,
                "type": "works_at",
                "relationshipStrength": calculate_relationship_strength(prospect),
            }
        )

    avg_strength = round(
        sum(edge["relationshipStrength"] for edge in edges) / max(len(edges), 1),
        1,
    )
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "prospects": len([n for n in nodes if n["type"] == "prospect"]),
            "companies": len([n for n in nodes if n["type"] == "company"]),
            "connections": len(edges),
            "averageRelationshipStrength": avg_strength,
        },
    }


def build_campaign_performance(campaign: Dict[str, Any]) -> Dict[str, Any]:
    metrics = campaign.get("metrics") or {}
    declared_channels = [normalize_channel(str(channel)) for channel in (campaign.get("channels") or [])]
    metric_channels = [normalize_channel(str(channel)) for channel in metrics.keys()]
    channels = sorted(set(declared_channels + metric_channels))

    by_channel: List[Dict[str, Any]] = []
    total_sent = 0
    total_opened = 0
    total_replied = 0

    for channel in channels:
        channel_metrics = metrics.get(channel) or {}
        sent = max(0, int(channel_metrics.get("sent") or 0))
        opened = max(0, int(channel_metrics.get("opened") or 0))
        replied = max(0, int(channel_metrics.get("replied") or 0))
        total_sent += sent
        total_opened += opened
        total_replied += replied

        by_channel.append(
            {
                "channel": channel,
                "sent": sent,
                "opened": opened,
                "replied": replied,
                "openRate": round((opened / sent) if sent > 0 else 0.0, 4),
                "replyRate": round((replied / sent) if sent > 0 else 0.0, 4),
                "replyToOpenRate": round((replied / opened) if opened > 0 else 0.0, 4),
            }
        )

    overall_open_rate = round((total_opened / total_sent) if total_sent > 0 else 0.0, 4)
    overall_reply_rate = round((total_replied / total_sent) if total_sent > 0 else 0.0, 4)
    overall_reply_to_open_rate = round((total_replied / total_opened) if total_opened > 0 else 0.0, 4)

    quality_tier = "insufficient_data"
    if total_sent >= 20:
        if overall_reply_rate >= 0.12:
            quality_tier = "strong"
        elif overall_reply_rate >= 0.06:
            quality_tier = "watch"
        else:
            quality_tier = "weak"

    recommendations: List[str] = []
    if total_sent < 20:
        recommendations.append("Increase send volume before making channel-level campaign decisions.")
    if overall_open_rate < 0.25:
        recommendations.append("Improve subject lines and targeting to increase opens.")
    if overall_open_rate >= 0.25 and overall_reply_to_open_rate < 0.2:
        recommendations.append("Improve call-to-action clarity to convert opens into replies.")
    if not recommendations:
        recommendations.append("Maintain campaign pacing and continue monitoring conversion trends.")

    return {
        "campaignId": campaign.get("id"),
        "name": campaign.get("name", "Untitled Campaign"),
        "status": campaign.get("status", "draft"),
        "channels": channels,
        "totals": {"sent": total_sent, "opened": total_opened, "replied": total_replied},
        "overall": {
            "openRate": overall_open_rate,
            "replyRate": overall_reply_rate,
            "replyToOpenRate": overall_reply_to_open_rate,
            "qualityTier": quality_tier,
        },
        "byChannel": by_channel,
        "recommendations": recommendations[:3],
        "updatedAt": campaign.get("updatedAt"),
    }


def build_campaign_portfolio(campaigns: List[Dict[str, Any]], top_k: int = 20) -> Dict[str, Any]:
    summaries = [build_campaign_performance(campaign) for campaign in campaigns]
    summaries.sort(
        key=lambda item: (
            item["overall"]["replyRate"],
            item["totals"]["replied"],
            item["totals"]["sent"],
        ),
        reverse=True,
    )
    ranked = summaries[:top_k]

    sent_total = sum(item["totals"]["sent"] for item in ranked)
    opened_total = sum(item["totals"]["opened"] for item in ranked)
    replied_total = sum(item["totals"]["replied"] for item in ranked)
    avg_reply_rate = round(
        sum(item["overall"]["replyRate"] for item in ranked) / max(len(ranked), 1),
        4,
    )
    active_count = len([item for item in ranked if item.get("status") == "active"])

    return {
        "campaignCount": len(ranked),
        "activeCampaignCount": active_count,
        "portfolioTotals": {"sent": sent_total, "opened": opened_total, "replied": replied_total},
        "averageReplyRate": avg_reply_rate,
        "rankedCampaigns": ranked,
    }


@router.get("/forecast/pipeline")
async def get_pipeline_forecast(
    window_days: int = Query(default=90, ge=30, le=365),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_PIPELINE_FORECAST", default=True):
        raise HTTPException(status_code=503, detail="Pipeline forecast is disabled by feature flag.")

    db = get_db()
    prospects = await db.prospects.find(
        {
            "userId": current_user["id"],
            "status": {"$nin": ["closed_won", "closed_lost", "disqualified"]},
        },
        {"_id": 0},
    ).to_list(5000)
    outcomes = await db.lead_score_outcomes.find(
        {"userId": current_user["id"]},
        {"_id": 0, "outcome": 1, "scoreAtOutcome": 1},
    ).to_list(5000)

    forecast = build_pipeline_forecast(prospects, outcomes, window_days)
    forecast["windowDays"] = window_days
    forecast["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_pipeline_forecast_generated",
        {
            "window_days": window_days,
            "open_pipeline_value": forecast.get("openPipelineValue"),
            "weighted_pipeline_value": forecast.get("weightedPipelineValue"),
            "projected_won_value": forecast.get("projectedWonValue"),
            "open_prospect_count": forecast.get("sampleSize", {}).get("openProspects", 0),
            "closed_outcome_count": forecast.get("sampleSize", {}).get("closedOutcomes", 0),
        },
        http_request=http_request,
    )
    return forecast


@router.get("/conversation/intelligence")
async def get_conversation_intelligence(
    limit: int = Query(default=200, ge=20, le=1000),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_CONVERSATION_INTELLIGENCE", default=True):
        raise HTTPException(status_code=503, detail="Conversation intelligence is disabled by feature flag.")

    db = get_db()
    chat_sessions = await db.chat_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0, "message": 1, "response": 1, "timestamp": 1},
    ).limit(limit).to_list(limit)

    email_events = await db.email_events.find(
        {"userId": current_user["id"]},
        {"_id": 0, "eventType": 1, "channel": 1, "metadata": 1, "timestamp": 1},
    ).limit(limit).to_list(limit)

    records: List[Dict[str, Any]] = []
    for session in chat_sessions:
        text = f"{session.get('message', '')} {session.get('response', '')}".strip()
        if text:
            records.append({"text": text, "channel": "chat"})
    for event in email_events:
        metadata = event.get("metadata") or {}
        text = f"{event.get('eventType', '')} {metadata.get('subject', '')} {metadata.get('message', '')}".strip()
        if text:
            records.append({"text": text, "channel": event.get("channel") or "email"})

    intelligence = build_conversation_intelligence(records)
    intelligence["generatedAt"] = datetime.now(timezone.utc).isoformat()
    intelligence["sources"] = {"chatSessions": len(chat_sessions), "emailEvents": len(email_events)}

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_conversation_intelligence_generated",
        {
            "limit": limit,
            "chat_session_count": len(chat_sessions),
            "email_event_count": len(email_events),
            "record_count": intelligence.get("totals", {}).get("records", 0),
            "top_objection_count": len(intelligence.get("topObjections", [])),
        },
        http_request=http_request,
    )
    return intelligence


@router.get("/engagement/multi-channel")
async def get_multi_channel_engagement(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_MULTI_CHANNEL_ENGAGEMENT", default=True):
        raise HTTPException(status_code=503, detail="Multi-channel engagement is disabled by feature flag.")

    db = get_db()
    campaigns = await db.sales_campaigns.find(
        {"userId": current_user["id"]},
        {"_id": 0, "channels": 1, "status": 1},
    ).to_list(1000)
    ab_tests = await db.ab_tests.find(
        {"userId": current_user["id"]},
        {"_id": 0, "testType": 1, "channelA": 1, "channelB": 1},
    ).to_list(2000)
    prospects = await db.prospects.find(
        {"userId": current_user["id"]},
        {"_id": 0, "preferredChannel": 1, "primaryChannel": 1},
    ).to_list(5000)

    health = build_multi_channel_health(campaigns, ab_tests, prospects)
    health["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_multi_channel_engagement_generated",
        {
            "active_channel_count": len(health.get("activeChannels", [])),
            "coverage_score": health.get("coverageScore", 0),
            "campaign_count": len(campaigns),
            "ab_test_count": len(ab_tests),
            "prospect_count": len(prospects),
        },
        http_request=http_request,
    )
    return health


@router.post("/campaigns")
async def create_campaign(
    request: Dict[str, Any],
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    name = str(request.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Campaign name is required")

    channels = request.get("channels") or ["email"]
    if not isinstance(channels, list) or not channels:
        raise HTTPException(status_code=400, detail="At least one channel is required")
    normalized_channels = sorted({normalize_channel(str(channel)) for channel in channels})

    campaign = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": name,
        "objective": str(request.get("objective") or "pipeline_growth"),
        "targetSegment": str(request.get("targetSegment") or "all"),
        "channels": normalized_channels,
        "status": "draft",
        "metrics": {channel: {"sent": 0, "opened": 0, "replied": 0} for channel in normalized_channels},
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    db = get_db()
    await db.sales_campaigns.insert_one(campaign)
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_created",
        {
            "campaign_id": campaign["id"],
            "channel_count": len(campaign["channels"]),
            "status": campaign["status"],
        },
        http_request=http_request,
    )
    return campaign


@router.get("/campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    query: Dict[str, Any] = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    db = get_db()
    campaigns = await db.sales_campaigns.find(query, {"_id": 0}).sort("updatedAt", -1).to_list(1000)
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_list_viewed",
        {
            "status_filter": status or "all",
            "campaign_count": len(campaigns),
        },
        http_request=http_request,
    )
    return campaigns


@router.get("/campaigns/performance/portfolio")
async def get_campaign_portfolio_performance(
    window_days: int = Query(default=90, ge=14, le=365),
    status: Optional[str] = Query(default=None, max_length=32),
    limit: int = Query(default=20, ge=5, le=100),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    cutoff_iso = _iso_days_ago(window_days)
    query: Dict[str, Any] = {"userId": current_user["id"], "updatedAt": {"$gte": cutoff_iso}}
    if status:
        query["status"] = status

    db = get_db()
    campaigns = await db.sales_campaigns.find(query, {"_id": 0}).sort("updatedAt", -1).to_list(5000)
    portfolio = build_campaign_portfolio(campaigns, top_k=limit)
    portfolio["windowDays"] = window_days
    portfolio["statusFilter"] = status or "all"
    portfolio["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_portfolio_viewed",
        {
            "window_days": window_days,
            "status_filter": status or "all",
            "limit": limit,
            "campaign_count": portfolio.get("campaignCount", 0),
            "active_campaign_count": portfolio.get("activeCampaignCount", 0),
            "average_reply_rate": portfolio.get("averageReplyRate", 0.0),
        },
        http_request=http_request,
    )
    return portfolio


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    db = get_db()
    campaign = await db.sales_campaigns.find_one(
        {"id": campaign_id, "userId": current_user["id"]},
        {"_id": 0},
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_viewed",
        {
            "campaign_id": campaign_id,
            "status": campaign.get("status", "unknown"),
            "channel_count": len(campaign.get("channels", [])),
        },
        http_request=http_request,
    )
    return campaign


@router.get("/campaigns/{campaign_id}/performance")
async def get_campaign_performance(
    campaign_id: str,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    db = get_db()
    campaign = await db.sales_campaigns.find_one(
        {"id": campaign_id, "userId": current_user["id"]},
        {"_id": 0},
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    performance = build_campaign_performance(campaign)
    performance["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_performance_viewed",
        {
            "campaign_id": campaign_id,
            "status": performance.get("status", "unknown"),
            "sent": performance.get("totals", {}).get("sent", 0),
            "replied": performance.get("totals", {}).get("replied", 0),
            "reply_rate": performance.get("overall", {}).get("replyRate", 0.0),
            "quality_tier": performance.get("overall", {}).get("qualityTier", "insufficient_data"),
        },
        http_request=http_request,
    )
    return performance


@router.post("/campaigns/{campaign_id}/activate")
async def activate_campaign(
    campaign_id: str,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    db = get_db()
    result = await db.sales_campaigns.update_one(
        {"id": campaign_id, "userId": current_user["id"]},
        {
            "$set": {
                "status": "active",
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign = await db.sales_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_activated",
        {
            "campaign_id": campaign_id,
            "channel_count": len((campaign or {}).get("channels", [])),
        },
        http_request=http_request,
    )
    return campaign


@router.post("/campaigns/{campaign_id}/metrics")
async def record_campaign_metrics(
    campaign_id: str,
    request: Dict[str, Any],
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_SALES_CAMPAIGNS", default=True):
        raise HTTPException(status_code=503, detail="Sales campaigns are disabled by feature flag.")

    channel = normalize_channel(str(request.get("channel") or "email"))
    sent = int(request.get("sent") or 0)
    opened = int(request.get("opened") or 0)
    replied = int(request.get("replied") or 0)

    if sent < 0 or opened < 0 or replied < 0:
        raise HTTPException(status_code=400, detail="Metric increments must be >= 0")

    db = get_db()
    result = await db.sales_campaigns.update_one(
        {"id": campaign_id, "userId": current_user["id"]},
        {
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()},
            "$inc": {
                f"metrics.{channel}.sent": sent,
                f"metrics.{channel}.opened": opened,
                f"metrics.{channel}.replied": replied,
            },
            "$addToSet": {"channels": channel},
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign = await db.sales_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_campaign_metrics_recorded",
        {
            "campaign_id": campaign_id,
            "channel": channel,
            "sent_increment": sent,
            "opened_increment": opened,
            "replied_increment": replied,
        },
        http_request=http_request,
    )
    return campaign


@router.get("/relationships/map")
async def get_relationship_map(
    limit: int = Query(default=250, ge=50, le=1000),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_RELATIONSHIP_MAP", default=True):
        raise HTTPException(status_code=503, detail="Relationship mapping is disabled by feature flag.")

    db = get_db()
    prospects = await db.prospects.find(
        {"userId": current_user["id"]},
        {"_id": 0},
    ).limit(limit).to_list(limit)
    companies = await db.companies.find(
        {"userId": current_user["id"]},
        {"_id": 0},
    ).limit(limit).to_list(limit)

    graph = build_relationship_map(prospects, companies, max_nodes=limit)
    graph["generatedAt"] = datetime.now(timezone.utc).isoformat()
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_relationship_map_generated",
        {
            "limit": limit,
            "node_count": len(graph.get("nodes", [])),
            "edge_count": len(graph.get("edges", [])),
            "prospect_count": graph.get("stats", {}).get("prospects", 0),
            "company_count": graph.get("stats", {}).get("companies", 0),
        },
        http_request=http_request,
    )
    return graph


@router.get("/analytics/phrases")
async def get_phrase_effectiveness_analytics(
    window_days: int = Query(default=60, ge=14, le=365),
    min_exposure: int = Query(default=2, ge=1, le=50),
    limit: int = Query(default=30, ge=5, le=100),
    query: Optional[str] = Query(default=None, max_length=80),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    logger.info(
        "sales_phrase_analytics_requested",
        extra={
            "event": "sales_phrase_analytics_requested",
            "window_days": window_days,
            "min_exposure": min_exposure,
            "limit": limit,
            "query_provided": bool(query),
        },
    )
    if not _feature_enabled("ENABLE_PHRASE_ANALYTICS", default=True):
        raise HTTPException(status_code=503, detail="Phrase analytics is disabled by feature flag.")

    db = get_db()
    cutoff_iso = _iso_days_ago(window_days)
    records = await db.email_events.find(
        {"userId": current_user["id"], "timestamp": {"$gte": cutoff_iso}},
        {"_id": 0, "eventType": 1, "metadata": 1, "timestamp": 1, "channel": 1},
    ).to_list(10000)

    phrase_records: List[Dict[str, Any]] = []
    for record in records:
        metadata = record.get("metadata") or {}
        text = f"{metadata.get('subject', '')} {metadata.get('message', '')}".strip()
        if not text:
            continue
        phrase_records.append(
            {
                "text": text,
                "eventType": record.get("eventType", ""),
                "channel": record.get("channel") or "email",
            }
        )

    result = build_phrase_effectiveness(
        phrase_records,
        min_exposure=min_exposure,
        top_k=limit,
        query=(query or "").lower() or None,
    )
    result["windowDays"] = window_days
    result["generatedAt"] = datetime.now(timezone.utc).isoformat()
    result["totalRecords"] = len(phrase_records)
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_phrase_analytics_generated",
        {
            "window_days": window_days,
            "min_exposure": min_exposure,
            "limit": limit,
            "query_provided": bool(query),
            "tracked_phrases": result["summary"]["trackedPhrases"],
            "candidate_phrase_count": result["summary"]["candidatePhraseCount"],
            "total_records": len(phrase_records),
            "window_start": cutoff_iso,
        },
        http_request=http_request,
    )
    logger.info(
        "sales_phrase_analytics_completed",
        extra={
            "event": "sales_phrase_analytics_completed",
            "tracked_phrases": result["summary"]["trackedPhrases"],
            "candidate_phrase_count": result["summary"]["candidatePhraseCount"],
            "total_records": len(phrase_records),
        },
    )
    return result


@router.get("/analytics/phrases/channel-summary")
async def get_phrase_channel_summary(
    window_days: int = Query(default=60, ge=14, le=365),
    min_exposure: int = Query(default=2, ge=1, le=50),
    limit: int = Query(default=10, ge=3, le=30),
    channels: Optional[str] = Query(default=None, max_length=120),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_PHRASE_ANALYTICS", default=True):
        raise HTTPException(status_code=503, detail="Phrase analytics is disabled by feature flag.")

    db = get_db()
    cutoff_iso = _iso_days_ago(window_days)
    channel_list = None
    if channels:
        channel_list = [item.strip() for item in channels.split(",") if item.strip()]
    records = await db.email_events.find(
        {"userId": current_user["id"], "timestamp": {"$gte": cutoff_iso}},
        {"_id": 0, "eventType": 1, "metadata": 1, "timestamp": 1, "channel": 1},
    ).to_list(10000)

    phrase_records: List[Dict[str, Any]] = []
    for record in records:
        metadata = record.get("metadata") or {}
        text = f"{metadata.get('subject', '')} {metadata.get('message', '')}".strip()
        if not text:
            continue
        phrase_records.append(
            {
                "text": text,
                "eventType": record.get("eventType", ""),
                "channel": record.get("channel") or "email",
            }
        )

    summary = build_phrase_channel_summary(
        phrase_records,
        min_exposure=min_exposure,
        top_k=limit,
        channels=channel_list,
    )
    summary["windowDays"] = window_days
    summary["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_phrase_channel_summary_generated",
        {
            "window_days": window_days,
            "min_exposure": min_exposure,
            "limit": limit,
            "channels_filter": channel_list or [],
            "channel_count": summary["channelCount"],
            "total_records": summary["totalRecords"],
            "window_start": cutoff_iso,
        },
        http_request=http_request,
    )
    return summary


@router.post("/prediction/response")
async def predict_response_outcome(
    request: Dict[str, Any],
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    logger.info(
        "sales_response_prediction_requested",
        extra={"event": "sales_response_prediction_requested"},
    )
    if not _feature_enabled("ENABLE_RESPONSE_PREDICTION", default=True):
        raise HTTPException(status_code=503, detail="Response prediction is disabled by feature flag.")

    message = str(request.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required for response prediction.")

    db = get_db()
    recent_events = await db.email_events.find(
        {"userId": current_user["id"]},
        {"_id": 0, "eventType": 1, "timestamp": 1},
    ).sort("timestamp", -1).limit(200).to_list(200)

    prediction = build_response_prediction(request, recent_events)
    prediction["generatedAt"] = datetime.now(timezone.utc).isoformat()
    prediction["modelVersion"] = "heuristic-v1"
    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_response_prediction_generated",
        {
            "channel": prediction["channel"],
            "response_probability": prediction["responseProbability"],
            "confidence": prediction["confidence"],
            "rationale_count": len(prediction.get("rationale", [])),
            "recommended_windows_count": len(prediction.get("recommendedSendWindows", [])),
            "recent_event_count": len(recent_events),
            "message_length": len(message),
        },
        http_request=http_request,
    )
    logger.info(
        "sales_response_prediction_completed",
        extra={
            "event": "sales_response_prediction_completed",
            "channel": prediction["channel"],
            "confidence": prediction["confidence"],
        },
    )
    return prediction


@router.post("/prediction/feedback")
async def record_prediction_feedback(
    request: Dict[str, Any],
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_RESPONSE_PREDICTION_FEEDBACK", default=True):
        raise HTTPException(status_code=503, detail="Response prediction feedback is disabled by feature flag.")

    if "predictedProbability" not in request:
        raise HTTPException(status_code=400, detail="predictedProbability is required.")

    predicted_probability = float(request.get("predictedProbability"))
    if predicted_probability < 0.0 or predicted_probability > 1.0:
        raise HTTPException(status_code=400, detail="predictedProbability must be between 0 and 1.")

    normalized = normalize_feedback_outcome(str(request.get("outcome") or ""))
    channel = normalize_channel(str(request.get("channel") or "email"))
    response_latency_hours = request.get("responseLatencyHours")
    if response_latency_hours is not None:
        response_latency_hours = float(response_latency_hours)
        if response_latency_hours < 0:
            raise HTTPException(status_code=400, detail="responseLatencyHours must be >= 0.")

    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    prediction_id = str(request.get("predictionId") or "").strip() or None
    feedback_doc = {
        "userId": current_user["id"],
        "predictionId": prediction_id,
        "predictedProbability": round(predicted_probability, 4),
        "outcome": normalized["outcome"],
        "actualLabel": normalized["actualLabel"],
        "channel": channel,
        "responseLatencyHours": response_latency_hours,
        "updatedAt": now_iso,
    }
    existing = None
    if prediction_id:
        existing = await db.prediction_feedback.find_one(
            {"userId": current_user["id"], "predictionId": prediction_id},
            {"_id": 0, "id": 1, "createdAt": 1},
        )

    if existing:
        feedback_id = existing["id"]
        created_at = existing.get("createdAt") or now_iso
        await db.prediction_feedback.update_one(
            {"id": feedback_id, "userId": current_user["id"]},
            {"$set": {**feedback_doc, "createdAt": created_at}},
            upsert=False,
        )
        write_mode = "updated"
    else:
        feedback_id = str(uuid4())
        await db.prediction_feedback.insert_one(
            {
                "id": feedback_id,
                **feedback_doc,
                "createdAt": now_iso,
            }
        )
        write_mode = "created"

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_response_prediction_feedback_recorded",
        {
            "prediction_id_present": bool(prediction_id),
            "predicted_probability": feedback_doc["predictedProbability"],
            "outcome": feedback_doc["outcome"],
            "actual_label": feedback_doc["actualLabel"],
            "channel": feedback_doc["channel"],
            "response_latency_hours": feedback_doc["responseLatencyHours"],
            "write_mode": write_mode,
        },
        http_request=http_request,
    )
    logger.info(
        "sales_response_prediction_feedback_recorded",
        extra={
            "event": "sales_response_prediction_feedback_recorded",
            "outcome": feedback_doc["outcome"],
            "channel": feedback_doc["channel"],
        },
    )
    return {
        "success": True,
        "feedbackId": feedback_id,
        "writeMode": write_mode,
        "outcome": feedback_doc["outcome"],
        "actualLabel": feedback_doc["actualLabel"],
    }


@router.get("/prediction/performance")
async def get_prediction_performance(
    window_days: int = Query(default=90, ge=14, le=365),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_RESPONSE_PREDICTION_FEEDBACK", default=True):
        raise HTTPException(status_code=503, detail="Response prediction feedback is disabled by feature flag.")

    db = get_db()
    cutoff_iso = _iso_days_ago(window_days)
    feedback = await db.prediction_feedback.find(
        {"userId": current_user["id"], "createdAt": {"$gte": cutoff_iso}},
        {"_id": 0},
    ).to_list(10000)
    performance = build_prediction_performance(feedback)
    performance["windowDays"] = window_days
    performance["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_response_prediction_performance_viewed",
        {
            "window_days": window_days,
            "sample_size": performance["sampleSize"],
            "mae": performance["meanAbsoluteCalibrationError"],
            "window_start": cutoff_iso,
        },
        http_request=http_request,
    )
    logger.info(
        "sales_response_prediction_performance_viewed",
        extra={
            "event": "sales_response_prediction_performance_viewed",
            "sample_size": performance["sampleSize"],
            "mae": performance["meanAbsoluteCalibrationError"],
        },
    )
    return performance


@router.get("/prediction/performance/report")
async def get_prediction_performance_report(
    window_days: int = Query(default=90, ge=14, le=365),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_RESPONSE_PREDICTION_FEEDBACK", default=True):
        raise HTTPException(status_code=503, detail="Response prediction feedback is disabled by feature flag.")

    db = get_db()
    cutoff_iso = _iso_days_ago(window_days)
    feedback = await db.prediction_feedback.find(
        {"userId": current_user["id"], "createdAt": {"$gte": cutoff_iso}},
        {"_id": 0},
    ).to_list(10000)
    performance = build_prediction_performance(feedback)
    report = build_prediction_performance_report(performance)
    report["windowDays"] = window_days
    report["generatedAt"] = datetime.now(timezone.utc).isoformat()

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_response_prediction_report_viewed",
        {
            "window_days": window_days,
            "sample_size": report["sampleSize"],
            "quality_tier": report["qualityTier"],
            "rollout_decision": report["rolloutDecision"],
            "window_start": cutoff_iso,
        },
        http_request=http_request,
    )
    return report


@router.get("/prediction/feedback/history")
async def get_prediction_feedback_history(
    window_days: int = Query(default=90, ge=14, le=365),
    limit: int = Query(default=100, ge=10, le=500),
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    if not _feature_enabled("ENABLE_RESPONSE_PREDICTION_FEEDBACK", default=True):
        raise HTTPException(status_code=503, detail="Response prediction feedback is disabled by feature flag.")

    db = get_db()
    cutoff_iso = _iso_days_ago(window_days)
    records = await db.prediction_feedback.find(
        {"userId": current_user["id"], "createdAt": {"$gte": cutoff_iso}},
        {"_id": 0},
    ).sort("createdAt", -1).limit(limit).to_list(limit)

    await _emit_sales_intelligence_telemetry(
        db,
        current_user["id"],
        "sales_response_prediction_feedback_history_viewed",
        {
            "window_days": window_days,
            "limit": limit,
            "result_count": len(records),
            "window_start": cutoff_iso,
        },
        http_request=http_request,
    )

    return {
        "records": records,
        "count": len(records),
        "windowDays": window_days,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
