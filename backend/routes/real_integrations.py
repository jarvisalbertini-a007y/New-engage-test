"""Real World Integrations - Web Search, Web Scraping, SendGrid, Gmail"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Any, Dict
import os
import json
import re
import asyncio
import httpx
import time
import hashlib
from pathlib import Path

from database import get_db
from core.integration_slo_policy import (
    DEFAULT_MIN_SCHEMA_V2_SAMPLE_COUNT,
    DEFAULT_MAX_ERROR_RATE_PCT,
    DEFAULT_MIN_SCHEMA_V2_PCT,
    PERCENT_THRESHOLD_MAX,
    PERCENT_THRESHOLD_MIN,
    SAMPLE_THRESHOLD_MAX,
    SAMPLE_THRESHOLD_MIN,
    SLO_QUERY_LIMIT_MAX,
    SLO_QUERY_LIMIT_MIN,
    TELEMETRY_DAYS_MAX,
    TELEMETRY_DAYS_MIN,
    TELEMETRY_SUMMARY_LIMIT_MAX,
    TELEMETRY_SUMMARY_LIMIT_MIN,
)
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
INTEGRATION_RETRY_ATTEMPTS = int(os.environ.get("INTEGRATION_RETRY_ATTEMPTS", "3"))
INTEGRATION_RETRY_BASE_DELAY_SECONDS = float(
    os.environ.get("INTEGRATION_RETRY_BASE_DELAY_SECONDS", "0.5")
)
SENSITIVE_LOG_KEYS = {
    "api_key",
    "authorization",
    "token",
    "refresh_token",
    "access_token",
    "password",
    "secret",
    "raw_event",
    "rawevent",
}
EMAIL_LOG_KEYS = {"to", "from", "email", "from_email", "to_email"}
TRACEABILITY_AUDIT_EVENT_TYPE = "integrations_traceability_status_evaluated"
TRACEABILITY_GOVERNANCE_EVENT_TYPE = (
    "integrations_traceability_snapshot_governance_evaluated"
)
TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE = (
    "integrations_traceability_baseline_governance_evaluated"
)
TELEMETRY_SNAPSHOT_PREFIX = "connector-telemetry-summary"
TELEMETRY_SNAPSHOT_DIR = Path(__file__).resolve().parents[1] / "test_reports"
BASELINE_METRICS_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1] / "test_reports" / "baseline_metrics.json"
)
RELEASE_GATE_ARTIFACT_PATHS = {
    "pass": Path(__file__).resolve().parents[1] / "test_reports" / "connector_release_gate_result.json",
    "hold": Path(__file__).resolve().parents[1] / "test_reports" / "connector_release_gate_result_hold.json",
    "validation-fail": (
        Path(__file__).resolve().parents[1]
        / "test_reports"
        / "connector_release_gate_result_validation_fail.json"
    ),
}


def _flag_enabled(flag_name: str, default: str = "false") -> bool:
    return os.environ.get(flag_name, default).strip().lower() in ("1", "true", "yes", "on")


def _mask_secret(secret: Optional[str]) -> Optional[str]:
    if not secret:
        return None
    if len(secret) < 8:
        return "••••"
    return f"••••••••{secret[-4:]}"


def _mask_email(value: str) -> str:
    if "@" not in value:
        return value
    local_part, _, domain = value.partition("@")
    if not local_part:
        return f"***@{domain}" if domain else "***"
    if len(local_part) <= 2:
        return f"{local_part[0]}***@{domain}" if len(local_part) == 1 else f"{local_part[0]}***@{domain}"
    return f"{local_part[:2]}***@{domain}"


def _sanitize_log_payload(value: Any, key_hint: Optional[str] = None) -> Any:
    key_name = str(key_hint or "").strip().lower()
    if key_name in SENSITIVE_LOG_KEYS:
        return "[redacted]"

    if isinstance(value, dict):
        return {
            key: _sanitize_log_payload(nested_value, key)
            for key, nested_value in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_log_payload(item, key_hint) for item in value]
    if isinstance(value, str):
        if key_name in EMAIL_LOG_KEYS:
            return _mask_email(value)
        if len(value) > 1000:
            return f"{value[:1000]}...<truncated>"
    return value


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


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    normalized = normalized.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_snapshot_generated_at(path: Path) -> Optional[datetime]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return _parse_iso_datetime(payload.get("generatedAt"))


def _is_internal_traceability_event(event_type: str) -> bool:
    normalized = str(event_type or "").strip().lower()
    return normalized in {
        TRACEABILITY_AUDIT_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_EVENT_TYPE,
        TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
    }


def _is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    retryable_markers = [
        "timeout",
        "temporarily unavailable",
        "connection reset",
        "too many requests",
        "429",
        "503",
        "502",
        "504",
    ]
    return any(marker in message for marker in retryable_markers)


def _log_integration_event(
    event_type: str,
    payload: Dict[str, Any],
    request_id: Optional[str] = None,
) -> None:
    safe_payload = _sanitize_log_payload(payload or {})
    if request_id and "request_id" not in safe_payload:
        safe_payload["request_id"] = request_id
    print(
        json.dumps(
            {
                "type": "integration_event",
                "event": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **safe_payload,
            }
        )
    )


async def _retry_with_backoff(
    operation,
    max_attempts: int = INTEGRATION_RETRY_ATTEMPTS,
    base_delay_seconds: float = INTEGRATION_RETRY_BASE_DELAY_SECONDS,
):
    last_error: Exception = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await operation()
        except Exception as exc:
            last_error = exc
            if attempt == max_attempts or not _is_retryable_error(exc):
                raise
            await asyncio.sleep(base_delay_seconds * (2 ** (attempt - 1)))
    raise last_error


async def _record_integration_event(
    db,
    event_type: str,
    user_id: str,
    payload: Dict[str, Any],
    request_id: Optional[str] = None,
) -> None:
    safe_payload = _sanitize_log_payload(payload or {})
    if request_id and "request_id" not in safe_payload:
        safe_payload["request_id"] = request_id

    provider = event_type.split("_", 1)[0] if "_" in event_type else "integration"
    event_doc = {
        "id": str(uuid4()),
        "userId": user_id,
        "provider": provider,
        "eventType": event_type,
        "payload": safe_payload,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.integration_telemetry.insert_one(event_doc)
    except Exception as exc:
        print(f"Telemetry persist error: {exc}")


def _extract_sendgrid_user_id(event: Dict[str, Any]) -> Optional[str]:
    if not isinstance(event, dict):
        return None

    direct = event.get("user_id") or event.get("userId")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    custom_args = event.get("custom_args")
    if isinstance(custom_args, dict):
        candidate = custom_args.get("user_id") or custom_args.get("userId")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    unique_args = event.get("unique_args")
    if isinstance(unique_args, dict):
        candidate = unique_args.get("user_id") or unique_args.get("userId")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return None


def _normalize_domain(domain: Optional[str]) -> str:
    if not domain:
        return ""
    normalized = domain.strip().lower()
    normalized = re.sub(r"^https?://", "", normalized)
    normalized = normalized.split("/")[0]
    if normalized.startswith("www."):
        normalized = normalized[4:]
    return normalized


def _normalize_company_size(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            return stripped
        return ""
    if isinstance(value, int):
        if value <= 10:
            return "1-10"
        if value <= 50:
            return "11-50"
        if value <= 200:
            return "51-200"
        if value <= 500:
            return "201-500"
        return "500+"
    return ""


def _format_location(parts: List[Optional[str]]) -> str:
    return ", ".join([part for part in parts if part and str(part).strip()])


def _extract_list_by_known_keys(payload: Dict[str, Any], keys: List[str]) -> List[Dict[str, Any]]:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = value.get("items")
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
    return []


def _percentile(values: List[float], percentile_rank: float) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    idx = int(round((percentile_rank / 100.0) * (len(ordered) - 1)))
    idx = max(0, min(idx, len(ordered) - 1))
    return float(ordered[idx])


def _get_provider_latency_thresholds() -> Dict[str, float]:
    return {
        "sendgrid": float(os.environ.get("INTEGRATION_SLO_SENDGRID_P95_MS", "2500")),
        "apollo": float(os.environ.get("INTEGRATION_SLO_APOLLO_P95_MS", "4000")),
        "clearbit": float(os.environ.get("INTEGRATION_SLO_CLEARBIT_P95_MS", "4000")),
        "crunchbase": float(os.environ.get("INTEGRATION_SLO_CRUNCHBASE_P95_MS", "4000")),
    }


def _resolve_slo_thresholds(
    max_error_rate_pct: Optional[float],
    min_schema_v2_pct: Optional[float],
    min_schema_v2_sample_count: Optional[int] = None,
) -> tuple[float, float, int]:
    def _parse_env_threshold(env_key: str, default_value: float) -> float:
        raw_value = os.environ.get(env_key, str(default_value))
        try:
            return float(raw_value)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail=f"{env_key} must be numeric",
            )

    error_threshold = (
        max_error_rate_pct
        if max_error_rate_pct is not None
        else _parse_env_threshold("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", DEFAULT_MAX_ERROR_RATE_PCT)
    )
    if error_threshold < PERCENT_THRESHOLD_MIN or error_threshold > PERCENT_THRESHOLD_MAX:
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_error_rate_pct must be between "
                f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
            ),
        )

    schema_v2_threshold = (
        min_schema_v2_pct
        if min_schema_v2_pct is not None
        else _parse_env_threshold("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", DEFAULT_MIN_SCHEMA_V2_PCT)
    )
    if schema_v2_threshold < PERCENT_THRESHOLD_MIN or schema_v2_threshold > PERCENT_THRESHOLD_MAX:
        raise HTTPException(
            status_code=400,
            detail=(
                f"min_schema_v2_pct must be between "
                f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
            ),
        )

    raw_sample_threshold = (
        min_schema_v2_sample_count
        if min_schema_v2_sample_count is not None
        else os.environ.get(
            "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT",
            str(DEFAULT_MIN_SCHEMA_V2_SAMPLE_COUNT),
        )
    )
    try:
        sample_threshold = int(raw_sample_threshold)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT must be an integer",
        )
    if sample_threshold < SAMPLE_THRESHOLD_MIN or sample_threshold > SAMPLE_THRESHOLD_MAX:
        raise HTTPException(
            status_code=400,
            detail=(
                f"min_schema_v2_sample_count must be between "
                f"{SAMPLE_THRESHOLD_MIN} and {SAMPLE_THRESHOLD_MAX}"
            ),
        )

    return float(error_threshold), float(schema_v2_threshold), int(sample_threshold)


def _sales_intelligence_event_family(event_type: str) -> str:
    normalized = str(event_type or "").lower()
    if "forecast" in normalized:
        return "forecast"
    if "conversation" in normalized:
        return "conversation"
    if "multi_channel" in normalized or "channel_summary" in normalized:
        return "engagement"
    if "campaign" in normalized:
        return "campaigns"
    if "relationship" in normalized:
        return "relationships"
    if "phrase" in normalized:
        return "phrases"
    if "prediction" in normalized:
        return "prediction"
    return "other"


def _build_slo_rollout_actions(alerts: List[Dict[str, Any]], overall_passed: bool) -> List[Dict[str, Any]]:
    if overall_passed:
        return [
            {
                "priority": "P3",
                "ownerRole": "Release Manager",
                "action": "Proceed with canary expansion per rollout plan.",
                "trigger": "All SLO gates passed.",
            }
        ]

    actions: List[Dict[str, Any]] = []
    for alert in alerts:
        gate = alert.get("gate")
        provider = alert.get("provider")
        if gate == "error_rate":
            actions.append(
                {
                    "priority": "P1",
                    "ownerRole": "On-call Engineer",
                    "action": "Pause connector rollout and execute rollback drill for affected providers.",
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "provider_latency":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "Integrations Engineer",
                    "action": (
                        f"Disable {provider} connector flag for canary tenants and investigate upstream latency."
                    ),
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "schema_coverage":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "Release Manager",
                    "action": "Hold rollout and remediate telemetry schema-version drift before expansion.",
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "schema_sample_size":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "Sales Ops Lead",
                    "action": (
                        "Hold rollout and collect additional schema-v2 telemetry samples "
                        "until minimum sample threshold is met."
                    ),
                    "trigger": alert.get("message"),
                }
            )

    if not actions:
        actions.append(
            {
                "priority": "P2",
                "ownerRole": "Release Manager",
                "action": "Hold rollout and review telemetry anomalies.",
                "trigger": "Unknown gate failure state",
            }
        )
    return actions


def _build_slo_signoff_requirements(decision: str, alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
    base_evidence = [
        "connector_canary_evidence.json",
        "telemetry_slo_gates_snapshot.json",
        "integration_health_snapshot.json",
    ]
    if decision == "PROCEED":
        return {
            "status": "READY_FOR_APPROVAL",
            "requiredEvidence": base_evidence,
            "requiredApprovals": [
                {"role": "Release Manager", "required": True},
                {"role": "Sales Ops Lead", "required": True},
            ],
        }

    required_roles = [
        {"role": "On-call Engineer", "required": True},
        {"role": "Integrations Engineer", "required": True},
        {"role": "Release Manager", "required": True},
    ]
    if any(alert.get("gate") == "error_rate" for alert in alerts):
        required_roles.append({"role": "Incident Commander", "required": True})
    return {
        "status": "HOLD_REMEDIATION_REQUIRED",
        "requiredEvidence": base_evidence + ["rollback_drill_report.md"],
        "requiredApprovals": required_roles,
    }


def _normalize_apollo_people(payload: Dict[str, Any], max_items: int = 25) -> List[Dict[str, Any]]:
    people = _extract_list_by_known_keys(payload, ["people", "contacts", "results"])
    normalized = []
    for person in people[:max_items]:
        org = person.get("organization") if isinstance(person.get("organization"), dict) else {}
        domain = _normalize_domain(
            person.get("organization_website_url")
            or org.get("website_url")
            or org.get("primary_domain")
            or org.get("domain")
        )
        first_name = person.get("first_name") or person.get("firstName") or ""
        last_name = person.get("last_name") or person.get("lastName") or ""
        normalized.append(
            {
                "id": person.get("id") or str(uuid4()),
                "firstName": first_name,
                "lastName": last_name,
                "fullName": person.get("name") or f"{first_name} {last_name}".strip(),
                "title": person.get("title") or "",
                "email": person.get("email") or "",
                "company": org.get("name") or person.get("organization_name") or "",
                "companyDomain": domain,
                "linkedinUrl": person.get("linkedin_url") or person.get("linkedinUrl") or "",
                "location": person.get("city") or person.get("location") or "",
                "industry": org.get("industry") or person.get("industry") or "",
                "companySize": _normalize_company_size(
                    org.get("estimated_num_employees") or org.get("employee_count")
                ),
                "source": "apollo",
                "confidence": 80,
            }
        )
    return normalized


def _normalize_apollo_company(payload: Dict[str, Any]) -> Dict[str, Any]:
    company = payload
    if isinstance(payload.get("organization"), dict):
        company = payload.get("organization")
    elif isinstance(payload.get("account"), dict):
        company = payload.get("account")
    elif isinstance(payload.get("company"), dict):
        company = payload.get("company")

    location = _format_location(
        [
            company.get("city") or payload.get("city"),
            company.get("state") or payload.get("state"),
            company.get("country") or payload.get("country"),
        ]
    )

    return {
        "name": company.get("name") or payload.get("organization_name") or payload.get("name") or "",
        "domain": _normalize_domain(
            company.get("website_url")
            or company.get("primary_domain")
            or company.get("domain")
            or payload.get("organization_website_url")
            or payload.get("website_url")
            or payload.get("domain")
        ),
        "description": company.get("short_description") or company.get("description") or "",
        "industry": company.get("industry") or payload.get("industry") or "",
        "businessModel": "B2B",
        "targetMarket": "Sales prospects",
        "products": [],
        "companySize": _normalize_company_size(
            company.get("estimated_num_employees")
            or company.get("employee_count")
            or payload.get("estimated_num_employees")
        ),
        "techStack": [],
        "painPoints": [],
        "outreachAngle": "Use Apollo firmographic signals to personalize outreach.",
        "competitorHints": [],
        "fundingStage": company.get("latest_funding_stage") or company.get("funding_stage") or "",
        "contactEmail": "",
        "linkedinUrl": company.get("linkedin_url") or payload.get("linkedin_url") or "",
        "location": location,
        "source": "apollo",
    }


def _normalize_apollo_company_results(payload: Dict[str, Any], max_items: int = 10) -> List[Dict[str, Any]]:
    records = _extract_list_by_known_keys(payload, ["organizations", "accounts", "companies", "results"])
    if not records and isinstance(payload.get("organization"), dict):
        records = [payload]

    normalized: List[Dict[str, Any]] = []
    for record in records[:max_items]:
        company = _normalize_apollo_company(record)
        if company.get("name") or company.get("domain"):
            normalized.append(company)
    return normalized


def _normalize_clearbit_company(payload: Dict[str, Any]) -> Dict[str, Any]:
    metrics = payload.get("metrics", {}) if isinstance(payload.get("metrics"), dict) else {}
    category = payload.get("category", {}) if isinstance(payload.get("category"), dict) else {}
    location = _format_location(
        [payload.get("city"), payload.get("state"), payload.get("country")]
    )
    return {
        "name": payload.get("name") or "",
        "domain": _normalize_domain(payload.get("domain")),
        "description": payload.get("description") or "",
        "industry": category.get("industry") or payload.get("sector") or "",
        "businessModel": "B2B",
        "targetMarket": payload.get("type") or "",
        "products": [],
        "companySize": _normalize_company_size(metrics.get("employees")),
        "techStack": [],
        "painPoints": [],
        "outreachAngle": "Personalized value messaging based on company profile.",
        "competitorHints": [],
        "fundingStage": "",
        "contactEmail": "",
        "linkedinUrl": (payload.get("linkedin", {}) or {}).get("handle", ""),
        "location": location,
        "source": "clearbit",
    }


def _normalize_crunchbase_company(payload: Dict[str, Any]) -> Dict[str, Any]:
    entity = payload.get("entity") if isinstance(payload.get("entity"), dict) else payload
    properties = entity.get("properties") if isinstance(entity.get("properties"), dict) else entity
    location = _format_location(
        [properties.get("city_name"), properties.get("region_name"), properties.get("country_code")]
    )
    return {
        "name": properties.get("name") or "",
        "domain": _normalize_domain(properties.get("website_url") or properties.get("domain")),
        "description": properties.get("short_description") or "",
        "industry": properties.get("category_groups") or "",
        "businessModel": "B2B",
        "targetMarket": "Sales prospects",
        "products": [],
        "companySize": _normalize_company_size(properties.get("num_employees_enum")),
        "techStack": [],
        "painPoints": [],
        "outreachAngle": "Use funding and growth signals to tailor outreach.",
        "competitorHints": [],
        "fundingStage": properties.get("funding_stage") or "",
        "contactEmail": "",
        "linkedinUrl": properties.get("linkedin_url") or "",
        "location": location,
        "source": "crunchbase",
    }


def _normalize_crunchbase_search_results(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    entities = _extract_list_by_known_keys(payload, ["entities", "results", "items"])
    normalized = []
    for item in entities:
        if isinstance(item.get("entity"), dict):
            normalized.append(_normalize_crunchbase_company(item))
        else:
            normalized.append(_normalize_crunchbase_company({"entity": item}))
    return normalized


def _normalize_provider_order(provider_order: Any) -> List[str]:
    default_order = ["clearbit", "apollo", "crunchbase"]
    allowed = set(default_order)
    if not isinstance(provider_order, list):
        return default_order

    normalized: List[str] = []
    for provider in provider_order:
        provider_name = str(provider or "").strip().lower()
        if provider_name in allowed and provider_name not in normalized:
            normalized.append(provider_name)
    return normalized or default_order


def _require_provider_enabled(provider: str, flag_name: str) -> None:
    if not _flag_enabled(flag_name):
        raise HTTPException(
            status_code=403,
            detail=f"{provider} connector is disabled. Enable {flag_name} to use this provider.",
        )


async def _get_provider_api_key(current_user: Dict[str, Any], provider: str, key_name: str) -> str:
    db = get_db()
    integration_settings = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0},
    )
    api_key = integration_settings.get(key_name) if integration_settings else None
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"{provider} API key not configured. Add it in Settings > Integrations.",
        )
    return api_key


async def _provider_request_json(
    provider: str,
    method: str,
    url: str,
    headers: Dict[str, str],
    params: Optional[Dict[str, Any]] = None,
    body: Optional[Dict[str, Any]] = None,
    allow_not_found: bool = False,
) -> Dict[str, Any]:
    async def _request():
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=body,
            )
            if allow_not_found and response.status_code == 404:
                return {}
            if response.status_code in (429, 500, 502, 503, 504):
                raise Exception(f"{provider} temporary failure ({response.status_code})")
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"{provider} request failed with status {response.status_code}",
                )
            try:
                return response.json()
            except ValueError:
                raise HTTPException(status_code=502, detail=f"{provider} returned non-JSON response")

    return await _retry_with_backoff(_request)

# ============== AI-POWERED WEB RESEARCH FOR LEADS ==============

async def search_web(query: str) -> str:
    """Search the web using AI with web search capability"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        search_prompt = f"""Search the internet and find real companies and people matching this criteria: {query}

Provide actual company names, real executive names, and realistic contact patterns.
Focus on finding:
- Real company names that exist
- Actual job titles and roles
- LinkedIn profile patterns
- Company websites and domains

Return structured data about 10 real prospects."""

        session_id = f"search-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a B2B sales research assistant."
        )
        
        response = await llm.send_message(UserMessage(text=search_prompt))
        return response
    except Exception as e:
        print(f"Web search error: {e}")
        return None


@router.post("/search-leads")
async def search_real_leads(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Search the web for real leads using AI research"""
    criteria = request.get("criteria", "")
    count = request.get("count", 10)
    
    db = get_db()
    
    # Use AI to search and find real leads
    search_result = await search_web(criteria)
    
    if not search_result:
        raise HTTPException(status_code=500, detail="Web search failed")
    
    # Parse the AI response to extract structured lead data
    leads = await parse_leads_from_search(search_result, criteria, count)
    
    # Save leads to database
    saved_leads = []
    for lead in leads[:count]:
        prospect = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "firstName": lead.get("firstName", ""),
            "lastName": lead.get("lastName", ""),
            "email": lead.get("email", ""),
            "title": lead.get("title", ""),
            "company": lead.get("company", ""),
            "companyDomain": lead.get("domain", ""),
            "linkedinUrl": lead.get("linkedin", ""),
            "industry": lead.get("industry", ""),
            "companySize": lead.get("companySize", ""),
            "location": lead.get("location", ""),
            "source": "web_research",
            "sourceQuery": criteria,
            "confidence": lead.get("confidence", 70),
            "status": "new",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.prospects.insert_one(prospect)
        prospect.pop("_id", None)
        saved_leads.append(prospect)
    
    return {
        "success": True,
        "leadsFound": len(saved_leads),
        "leads": saved_leads,
        "query": criteria
    }


async def parse_leads_from_search(search_result: str, criteria: str, count: int) -> list:
    """Parse AI search results into structured lead data"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        parse_prompt = f"""Parse this search result into structured lead data:

{search_result}

Extract {count} leads and return as JSON array with these fields for each:
- firstName, lastName (split the name)
- title (job title)
- company (company name)
- domain (company website domain like "company.com")
- email (construct from pattern: firstname.lastname@domain or firstname@domain)
- linkedin (LinkedIn URL pattern: linkedin.com/in/firstname-lastname)
- industry
- companySize (estimate: "1-10", "11-50", "51-200", "201-500", "500+")
- location (city, country)
- confidence (0-100 how confident this is a real lead)

Return ONLY the JSON array, no other text."""

        session_id = f"parse-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a data parsing assistant. Return only JSON."
        )
        
        response = await llm.send_message(UserMessage(text=parse_prompt))
        
        # Extract JSON from response
        content = response
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Parse error: {e}")
    
    return []


# ============== WEB SCRAPING FOR COMPANY RESEARCH ==============

@router.post("/scrape-company")
async def scrape_company_website(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Scrape a company website for business information"""
    domain = request.get("domain", "")
    company_name = request.get("company", "")
    
    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Provide domain or company name")
    
    # If only company name, try to find domain
    if not domain and company_name:
        domain = company_name.lower().replace(" ", "") + ".com"
    
    db = get_db()
    
    # Scrape the website
    scraped_data = await scrape_website(domain)
    
    # Enrich with AI analysis
    enriched_data = await enrich_company_data(scraped_data, company_name or domain)
    
    # Save to database
    research = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "companyName": enriched_data.get("name", company_name),
        "domain": domain,
        "scrapedData": scraped_data,
        "enrichedData": enriched_data,
        "source": "web_scraping",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.company_research.insert_one(research)
    research.pop("_id", None)
    
    return research


async def scrape_website(domain: str) -> dict:
    """Scrape a website for company information"""
    from bs4 import BeautifulSoup
    
    data = {
        "domain": domain,
        "pages_scraped": [],
        "raw_text": "",
        "emails_found": [],
        "phones_found": [],
        "social_links": [],
        "meta_description": "",
        "title": ""
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    pages_to_try = [
        f"https://{domain}",
        f"https://www.{domain}",
        f"https://{domain}/about",
        f"https://{domain}/about-us",
        f"https://{domain}/company",
        f"https://{domain}/contact"
    ]
    
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url in pages_to_try:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data["pages_scraped"].append(url)
                    soup = BeautifulSoup(response.text, "lxml")
                    
                    # Get title
                    if soup.title and not data["title"]:
                        data["title"] = soup.title.string.strip() if soup.title.string else ""
                    
                    # Get meta description
                    meta_desc = soup.find("meta", attrs={"name": "description"})
                    if meta_desc and not data["meta_description"]:
                        data["meta_description"] = meta_desc.get("content", "")
                    
                    # Extract emails
                    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
                    emails = re.findall(email_pattern, response.text)
                    data["emails_found"].extend([e for e in emails if e not in data["emails_found"]])
                    
                    # Extract phone numbers
                    phone_pattern = r'[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}'
                    phones = re.findall(phone_pattern, response.text)
                    data["phones_found"].extend([p for p in phones[:5] if p not in data["phones_found"]])
                    
                    # Extract social links
                    social_patterns = [
                        r'linkedin\.com/company/[\w-]+',
                        r'twitter\.com/[\w]+',
                        r'facebook\.com/[\w]+'
                    ]
                    for pattern in social_patterns:
                        matches = re.findall(pattern, response.text)
                        data["social_links"].extend([m for m in matches if m not in data["social_links"]])
                    
                    # Get main text content (limited)
                    for tag in soup(["script", "style", "nav", "header", "footer"]):
                        tag.decompose()
                    text = soup.get_text(separator=" ", strip=True)
                    data["raw_text"] += text[:3000] + " "
                    
            except Exception as e:
                print(f"Scrape error for {url}: {e}")
                continue
    
    # Limit raw text
    data["raw_text"] = data["raw_text"][:8000]
    data["emails_found"] = list(set(data["emails_found"]))[:10]
    data["phones_found"] = list(set(data["phones_found"]))[:5]
    data["social_links"] = list(set(data["social_links"]))[:10]
    
    return data


async def enrich_company_data(scraped_data: dict, company_name: str) -> dict:
    """Use AI to analyze and enrich scraped company data"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Analyze this scraped company data and provide structured insights:

Company: {company_name}
Domain: {scraped_data.get('domain')}
Title: {scraped_data.get('title')}
Description: {scraped_data.get('meta_description')}
Emails found: {scraped_data.get('emails_found')}
Social links: {scraped_data.get('social_links')}

Raw content excerpt:
{scraped_data.get('raw_text', '')[:4000]}

Provide analysis as JSON with:
- name: Official company name
- description: What the company does (2-3 sentences)
- industry: Primary industry
- businessModel: B2B, B2C, or Both
- targetMarket: Who they sell to
- products: List of main products/services
- companySize: Estimated employee count range
- techStack: Any technologies mentioned
- painPoints: Likely business challenges
- outreachAngle: Best angle for sales outreach
- competitorHints: Any competitors mentioned
- fundingStage: If determinable (seed, series A, etc.)
- contactEmail: Best email for outreach
- linkedinUrl: Company LinkedIn if found

Return ONLY JSON."""

        session_id = f"enrich-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a company research analyst. Return only JSON."
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        
        content = response
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Enrich error: {e}")
    
    return {"name": company_name, "domain": scraped_data.get("domain")}


# ============== SENDGRID EMAIL INTEGRATION ==============

@router.post("/email/send")
async def send_email_sendgrid(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Send email via SendGrid with tracking"""
    db = get_db()
    
    # Get user's SendGrid API key from settings
    user_settings = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    sendgrid_key = user_settings.get("sendgrid_api_key") if user_settings else None
    
    if not sendgrid_key:
        raise HTTPException(
            status_code=400, 
            detail="SendGrid API key not configured. Go to Settings > Integrations to add your key."
        )
    
    to_email = request.get("to")
    subject = request.get("subject")
    html_content = request.get("htmlContent") or request.get("body", "")
    from_email = request.get("from") or user_settings.get("from_email", current_user.get("email"))
    prospect_id = request.get("prospectId")
    
    if not to_email or not subject:
        raise HTTPException(status_code=400, detail="Missing to or subject")
    
    request_id = _extract_request_id(http_request)

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, TrackingSettings, OpenTracking, ClickTracking
        
        # Create message with tracking
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_content if "<" in html_content else f"<p>{html_content}</p>"
        )
        
        # Enable open and click tracking
        tracking_settings = TrackingSettings()
        tracking_settings.open_tracking = OpenTracking(enable=True)
        tracking_settings.click_tracking = ClickTracking(enable=True, enable_text=True)
        message.tracking_settings = tracking_settings
        
        # Add custom tracking ID for webhook correlation
        send_id = str(uuid4())
        message.custom_args = {"send_id": send_id, "user_id": current_user["id"]}
        
        # Send via SendGrid
        async def _send():
            sg = SendGridAPIClient(sendgrid_key)
            return await asyncio.to_thread(sg.send, message)

        start = time.perf_counter()
        response = await _retry_with_backoff(_send)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        
        # Log the send
        send_log = {
            "id": send_id,
            "userId": current_user["id"],
            "prospectId": prospect_id,
            "to": to_email,
            "from": from_email,
            "subject": subject,
            "provider": "sendgrid",
            "status": "sent" if response.status_code in [200, 201, 202] else "failed",
            "statusCode": response.status_code,
            "sentAt": datetime.now(timezone.utc).isoformat(),
            "openedAt": None,
            "clickedAt": None,
            "repliedAt": None
        }
        await db.email_sends.insert_one(send_log)
        _log_integration_event(
            "sendgrid_send_success",
            {
                "user_id": current_user["id"],
                "send_id": send_id,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            },
            request_id=request_id,
        )
        await _record_integration_event(
            db,
            "sendgrid_send_success",
            current_user["id"],
            {
                "send_id": send_id,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            },
            request_id=request_id,
        )
        
        # Update prospect status if provided
        if prospect_id:
            await db.prospects.update_one(
                {"id": prospect_id},
                {"$set": {
                    "status": "contacted",
                    "lastContactedAt": send_log["sentAt"]
                }}
            )
        
        return {
            "success": True,
            "sendId": send_id,
            "status": send_log["status"],
            "message": "Email sent successfully with tracking enabled"
        }
        
    except Exception as e:
        _log_integration_event(
            "sendgrid_send_error",
            {
                "user_id": current_user["id"],
                "error": str(e),
            },
            request_id=request_id,
        )
        await _record_integration_event(
            db,
            "sendgrid_send_error",
            current_user["id"],
            {"error": str(e)},
            request_id=request_id,
        )
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to send email. Check your SendGrid API key."
        }


@router.post("/webhook/sendgrid")
async def sendgrid_webhook(events: List[dict], http_request: Request = None):
    """Handle SendGrid event webhooks for open/click tracking"""
    db = get_db()
    request_id = _extract_request_id(http_request)

    processed_count = 0
    deduplicated_count = 0
    email_update_count = 0
    event_record_count = 0
    event_type_counts: Dict[str, int] = {}
    missing_user_context_count = 0
    user_event_counts: Dict[str, int] = {}

    for event in events:
        event_type = event.get("event")
        send_id = event.get("send_id") or event.get("sg_message_id", "").split(".")[0]
        timestamp = datetime.now(timezone.utc).isoformat()
        dedup_key = hashlib.sha256(
            json.dumps(
                {
                    "send_id": send_id,
                    "event_type": event_type,
                    "ts": event.get("timestamp"),
                    "sg_event_id": event.get("sg_event_id"),
                },
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

        existing_event = await db.integration_event_dedup.find_one({"id": dedup_key}, {"_id": 0})
        if existing_event:
            deduplicated_count += 1
            continue
        await db.integration_event_dedup.insert_one(
            {
                "id": dedup_key,
                "provider": "sendgrid",
                "createdAt": timestamp,
            }
        )
        processed_count += 1
        event_type_key = event_type or "unknown"
        event_type_counts[event_type_key] = event_type_counts.get(event_type_key, 0) + 1
        event_user_id = _extract_sendgrid_user_id(event)
        if event_user_id:
            user_event_counts[event_user_id] = user_event_counts.get(event_user_id, 0) + 1
        else:
            missing_user_context_count += 1
        
        update = {}
        if event_type == "open":
            update = {"openedAt": timestamp}
        elif event_type == "click":
            update = {"clickedAt": timestamp}
        elif event_type == "delivered":
            update = {"deliveredAt": timestamp, "status": "delivered"}
        elif event_type == "bounce":
            update = {"status": "bounced", "bounceReason": event.get("reason")}
        elif event_type == "spamreport":
            update = {"status": "spam"}
        
        if update and send_id:
            update_query: Dict[str, Any] = {"$set": update}
            if event_type == "open":
                update_query["$inc"] = {"openCount": 1}
            elif event_type == "click":
                update_query["$inc"] = {"clickCount": 1}

            await db.email_sends.update_one({"id": send_id}, update_query)
            email_update_count += 1
            
            # Log event for A/B testing
            await db.email_events.insert_one({
                "id": str(uuid4()),
                "sendId": send_id,
                "eventType": event_type,
                "timestamp": timestamp,
                "rawEvent": event
            })
            event_record_count += 1

    _log_integration_event(
        "sendgrid_webhook_processed",
        {
            "received_count": len(events),
            "processed_count": processed_count,
            "deduplicated_count": deduplicated_count,
            "email_update_count": email_update_count,
            "event_record_count": event_record_count,
            "event_type_counts": event_type_counts,
            "user_context_count": len(user_event_counts),
            "missing_user_context_count": missing_user_context_count,
        },
        request_id=request_id,
    )

    for user_id, scoped_count in user_event_counts.items():
        await _record_integration_event(
            db,
            "sendgrid_webhook_processed",
            user_id,
            {
                "received_count": len(events),
                "processed_count": processed_count,
                "deduplicated_count": deduplicated_count,
                "email_update_count": email_update_count,
                "event_record_count": event_record_count,
                "event_type_counts": event_type_counts,
                "user_scoped_processed_count": scoped_count,
                "missing_user_context_count": missing_user_context_count,
            },
            request_id=request_id,
        )

    return {
        "received": len(events),
        "processed": processed_count,
        "deduplicated": deduplicated_count,
        "emailUpdates": email_update_count,
        "eventRecords": event_record_count,
        "eventTypeCounts": event_type_counts,
        "userContexts": len(user_event_counts),
        "missingUserContext": missing_user_context_count,
    }


# ============== SALES DATA CONNECTORS (FLAGGED) ==============

@router.post("/providers/apollo/search")
async def apollo_search_prospects(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Search prospects via Apollo and return normalized sales records."""
    _require_provider_enabled("Apollo", "ENABLE_APOLLO_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Apollo", "apollo_api_key")
    db = get_db()

    request_id = _extract_request_id(http_request)
    query = (request.get("query") or "").strip()
    title = (request.get("title") or "").strip()
    domain = _normalize_domain(request.get("domain"))
    limit = min(max(int(request.get("limit", 25)), 1), 100)
    page = max(int(request.get("page", 1)), 1)
    save_results = bool(request.get("saveResults", False))

    if not query and not title and not domain:
        raise HTTPException(status_code=400, detail="Provide at least one of query, title, or domain")

    base_url = os.environ.get("APOLLO_API_BASE_URL", "https://api.apollo.io/v1").rstrip("/")
    endpoint = f"{base_url}/mixed_people/search"
    payload = {
        "page": page,
        "per_page": limit,
    }
    if query:
        payload["q_keywords"] = query
    if title:
        payload["person_titles"] = [title]
    if domain:
        payload["organization_domains"] = [domain]

    start = time.perf_counter()
    response_data = await _provider_request_json(
        provider="Apollo",
        method="POST",
        url=endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-Api-Key": api_key,
            "Content-Type": "application/json",
        },
        body=payload,
    )
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    prospects = _normalize_apollo_people(response_data, max_items=limit)
    saved_count = 0
    if save_results and prospects:
        for prospect in prospects:
            prospect_doc = {
                "id": prospect.get("id") or str(uuid4()),
                "userId": current_user["id"],
                "firstName": prospect.get("firstName", ""),
                "lastName": prospect.get("lastName", ""),
                "email": prospect.get("email", ""),
                "title": prospect.get("title", ""),
                "company": prospect.get("company", ""),
                "companyDomain": prospect.get("companyDomain", ""),
                "linkedinUrl": prospect.get("linkedinUrl", ""),
                "industry": prospect.get("industry", ""),
                "companySize": prospect.get("companySize", ""),
                "location": prospect.get("location", ""),
                "source": "apollo",
                "sourceQuery": query or title or domain,
                "confidence": prospect.get("confidence", 80),
                "status": "new",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            await db.prospects.update_one(
                {"id": prospect_doc["id"], "userId": current_user["id"]},
                {"$set": prospect_doc},
                upsert=True,
            )
            saved_count += 1

    _log_integration_event(
        "apollo_search_success",
        {
            "user_id": current_user["id"],
            "query": query[:100],
            "title": title[:80],
            "domain": domain,
            "result_count": len(prospects),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        "apollo_search_success",
        current_user["id"],
        {
            "query": query[:100],
            "title": title[:80],
            "domain": domain,
            "result_count": len(prospects),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )

    return {
        "success": True,
        "provider": "apollo",
        "criteria": {"query": query, "title": title, "domain": domain, "page": page, "limit": limit},
        "resultCount": len(prospects),
        "savedCount": saved_count,
        "prospects": prospects,
    }


@router.post("/providers/apollo/company")
async def apollo_enrich_company(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Search Apollo organizations and return normalized sales company profiles."""
    _require_provider_enabled("Apollo", "ENABLE_APOLLO_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Apollo", "apollo_api_key")
    db = get_db()

    request_id = _extract_request_id(http_request)
    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    limit = min(max(int(request.get("limit", 10)), 1), 25)
    save_research = bool(request.get("saveResearch", False))

    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Provide domain or companyName")

    base_url = os.environ.get("APOLLO_API_BASE_URL", "https://api.apollo.io/v1").rstrip("/")
    endpoint = f"{base_url}/mixed_companies/search"
    payload: Dict[str, Any] = {"page": 1, "per_page": limit}
    if domain:
        payload["q_organization_domains"] = [domain]
    if company_name:
        payload["q_organization_name"] = company_name

    start = time.perf_counter()
    provider_data = await _provider_request_json(
        provider="Apollo",
        method="POST",
        url=endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-Api-Key": api_key,
            "Content-Type": "application/json",
        },
        body=payload,
    )
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    companies = _normalize_apollo_company_results(provider_data, max_items=limit)
    saved_count = 0
    if save_research:
        for company in companies:
            doc = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "companyName": company.get("name", ""),
                "domain": company.get("domain", domain),
                "source": "apollo",
                "enrichedData": company,
                "rawData": provider_data,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            await db.company_research.insert_one(doc)
            saved_count += 1

    _log_integration_event(
        "apollo_company_enrichment_success",
        {
            "user_id": current_user["id"],
            "domain": domain,
            "company_name": company_name[:80],
            "result_count": len(companies),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        "apollo_company_enrichment_success",
        current_user["id"],
        {
            "domain": domain,
            "company_name": company_name[:80],
            "result_count": len(companies),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )

    return {
        "success": True,
        "provider": "apollo",
        "criteria": {"domain": domain, "companyName": company_name, "limit": limit},
        "resultCount": len(companies),
        "savedCount": saved_count,
        "companies": companies,
    }


@router.post("/providers/clearbit/company")
async def clearbit_enrich_company(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Enrich company data via Clearbit with normalized sales output."""
    _require_provider_enabled("Clearbit", "ENABLE_CLEARBIT_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Clearbit", "clearbit_api_key")
    db = get_db()

    request_id = _extract_request_id(http_request)
    domain = _normalize_domain(request.get("domain"))
    save_research = bool(request.get("saveResearch", False))
    if not domain:
        raise HTTPException(status_code=400, detail="domain is required")

    base_url = os.environ.get("CLEARBIT_API_BASE_URL", "https://company.clearbit.com/v2").rstrip("/")
    endpoint = f"{base_url}/companies/find"
    start = time.perf_counter()
    provider_data = await _provider_request_json(
        provider="Clearbit",
        method="GET",
        url=endpoint,
        headers={"Authorization": f"Bearer {api_key}"},
        params={"domain": domain},
        allow_not_found=True,
    )
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    if not provider_data:
        return {
            "success": True,
            "provider": "clearbit",
            "requestedDomain": domain,
            "found": False,
            "company": None,
        }

    company = _normalize_clearbit_company(provider_data)
    if save_research:
        doc = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "companyName": company.get("name", ""),
            "domain": company.get("domain", domain),
            "source": "clearbit",
            "enrichedData": company,
            "rawData": provider_data,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await db.company_research.insert_one(doc)

    _log_integration_event(
        "clearbit_enrichment_success",
        {
            "user_id": current_user["id"],
            "domain": domain,
            "latency_ms": latency_ms,
            "found": True,
        },
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        "clearbit_enrichment_success",
        current_user["id"],
        {
            "domain": domain,
            "latency_ms": latency_ms,
            "found": True,
        },
        request_id=request_id,
    )

    return {
        "success": True,
        "provider": "clearbit",
        "requestedDomain": domain,
        "found": True,
        "company": company,
    }


@router.post("/providers/crunchbase/company")
async def crunchbase_enrich_company(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Search Crunchbase organizations and return normalized sales company profiles."""
    _require_provider_enabled("Crunchbase", "ENABLE_CRUNCHBASE_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Crunchbase", "crunchbase_api_key")
    db = get_db()

    request_id = _extract_request_id(http_request)
    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    limit = min(max(int(request.get("limit", 10)), 1), 25)
    save_research = bool(request.get("saveResearch", False))

    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Provide domain or companyName")

    base_url = os.environ.get("CRUNCHBASE_API_BASE_URL", "https://api.crunchbase.com/api/v4").rstrip("/")
    endpoint = f"{base_url}/searches/organizations"
    query_items: List[Dict[str, Any]] = []
    if domain:
        query_items.append({"field_id": "website_url", "operator_id": "includes", "values": [domain]})
    if company_name:
        query_items.append({"field_id": "identifier", "operator_id": "includes", "values": [company_name]})

    start = time.perf_counter()
    provider_data = await _provider_request_json(
        provider="Crunchbase",
        method="POST",
        url=endpoint,
        headers={
            "X-cb-user-key": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body={"field_ids": ["identifier", "short_description", "website_url", "linkedin"], "query": query_items},
    )
    latency_ms = round((time.perf_counter() - start) * 1000, 2)

    companies = _normalize_crunchbase_search_results(provider_data)[:limit]
    saved_count = 0
    if save_research:
        for company in companies:
            doc = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "companyName": company.get("name", ""),
                "domain": company.get("domain", ""),
                "source": "crunchbase",
                "enrichedData": company,
                "rawData": provider_data,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            await db.company_research.insert_one(doc)
            saved_count += 1

    _log_integration_event(
        "crunchbase_enrichment_success",
        {
            "user_id": current_user["id"],
            "domain": domain,
            "company_name": company_name[:80],
            "result_count": len(companies),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        "crunchbase_enrichment_success",
        current_user["id"],
        {
            "domain": domain,
            "company_name": company_name[:80],
            "result_count": len(companies),
            "saved_count": saved_count,
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )

    return {
        "success": True,
        "provider": "crunchbase",
        "criteria": {"domain": domain, "companyName": company_name, "limit": limit},
        "resultCount": len(companies),
        "savedCount": saved_count,
        "companies": companies,
    }


@router.post("/providers/company-enrichment")
async def enrich_company_with_fallback(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user),
):
    """Run sales-only company enrichment across enabled providers with fallback."""
    if not _flag_enabled("ENABLE_CONNECTOR_ORCHESTRATION"):
        raise HTTPException(
            status_code=403,
            detail="Connector orchestration is disabled. Enable ENABLE_CONNECTOR_ORCHESTRATION to use this endpoint.",
        )

    request_id = _extract_request_id(http_request)
    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Provide domain or companyName")

    limit = min(max(int(request.get("limit", 10)), 1), 25)
    save_research = bool(request.get("saveResearch", False))
    stop_on_first_match = bool(request.get("stopOnFirstMatch", True))
    provider_order = _normalize_provider_order(request.get("providerOrder"))

    db = get_db()
    attempts: List[Dict[str, Any]] = []
    matched_companies: List[Dict[str, Any]] = []
    selected_provider: Optional[str] = None
    start = time.perf_counter()

    for provider in provider_order:
        try:
            if provider == "apollo":
                response = await apollo_enrich_company(
                    {
                        "domain": domain,
                        "companyName": company_name,
                        "limit": limit,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                companies = response.get("companies", [])
            elif provider == "clearbit":
                if not domain:
                    attempts.append(
                        {
                            "provider": provider,
                            "status": "skipped",
                            "reason": "domain_required",
                            "resultCount": 0,
                        }
                    )
                    continue
                response = await clearbit_enrich_company(
                    {
                        "domain": domain,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                company = response.get("company")
                companies = [company] if response.get("found") and isinstance(company, dict) else []
            elif provider == "crunchbase":
                response = await crunchbase_enrich_company(
                    {
                        "domain": domain,
                        "companyName": company_name,
                        "limit": limit,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                companies = response.get("companies", [])
            else:
                attempts.append(
                    {
                        "provider": provider,
                        "status": "skipped",
                        "reason": "unsupported_provider",
                        "resultCount": 0,
                    }
                )
                continue

            result_count = len(companies)
            attempts.append(
                {
                    "provider": provider,
                    "status": "success",
                    "resultCount": result_count,
                }
            )
            if result_count > 0:
                if not selected_provider:
                    selected_provider = provider
                matched_companies.extend(companies)
                if stop_on_first_match:
                    break
        except HTTPException as exc:
            attempts.append(
                {
                    "provider": provider,
                    "status": "error",
                    "statusCode": exc.status_code,
                    "reason": str(exc.detail),
                    "resultCount": 0,
                }
            )
        except Exception as exc:
            attempts.append(
                {
                    "provider": provider,
                    "status": "error",
                    "statusCode": 500,
                    "reason": str(exc),
                    "resultCount": 0,
                }
            )

    final_companies = matched_companies[:limit]
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    found = len(final_companies) > 0

    _log_integration_event(
        "company_enrichment_orchestrated",
        {
            "user_id": current_user["id"],
            "domain": domain,
            "company_name": company_name[:80],
            "provider_order": provider_order,
            "attempt_count": len(attempts),
            "selected_provider": selected_provider,
            "result_count": len(final_companies),
            "latency_ms": latency_ms,
        },
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        "company_enrichment_orchestrated",
        current_user["id"],
        {
            "domain": domain,
            "company_name": company_name[:80],
            "provider_order": provider_order,
            "attempt_count": len(attempts),
            "selected_provider": selected_provider,
            "result_count": len(final_companies),
            "latency_ms": latency_ms,
            "found": found,
        },
        request_id=request_id,
    )

    return {
        "success": True,
        "found": found,
        "selectedProvider": selected_provider,
        "criteria": {
            "domain": domain,
            "companyName": company_name,
            "limit": limit,
            "providerOrder": provider_order,
            "stopOnFirstMatch": stop_on_first_match,
        },
        "resultCount": len(final_companies),
        "companies": final_companies,
        "attempts": attempts,
    }


async def _health_check_sendgrid(api_key: str) -> Dict[str, Any]:
    async def _check():
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                "https://api.sendgrid.com/v3/user/profile",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return response

    try:
        start = time.perf_counter()
        response = await _retry_with_backoff(_check)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        healthy = response.status_code in (200, 201)
        return {
            "provider": "sendgrid",
            "healthy": healthy,
            "statusCode": response.status_code,
            "latencyMs": latency_ms,
            "error": None if healthy else "SendGrid responded with non-success status",
        }
    except Exception as exc:
        return {
            "provider": "sendgrid",
            "healthy": False,
            "statusCode": None,
            "latencyMs": None,
            "error": str(exc),
        }


async def _health_check_generic(
    provider: str,
    enabled_flag: str,
    configured_key: Optional[str],
) -> Dict[str, Any]:
    if not configured_key:
        return {
            "provider": provider,
            "healthy": False,
            "statusCode": None,
            "latencyMs": None,
            "error": "Not configured",
        }
    if not _flag_enabled(enabled_flag):
        return {
            "provider": provider,
            "healthy": False,
            "statusCode": None,
            "latencyMs": None,
            "error": "Configured but connector disabled by feature flag",
        }
    return {
        "provider": provider,
        "healthy": True,
        "statusCode": None,
        "latencyMs": None,
        "error": None,
    }


# ============== USER INTEGRATIONS MANAGEMENT ==============

@router.get("/integrations")
async def get_user_integrations(
    current_user: dict = Depends(get_current_user)
):
    """Get user's integration settings"""
    db = get_db()
    
    integrations = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not integrations:
        integrations = {
            "userId": current_user["id"],
            "sendgrid_configured": False,
            "gmail_configured": False,
            "apollo_configured": False,
            "clearbit_configured": False,
            "crunchbase_configured": False,
            "apollo_enabled": _flag_enabled("ENABLE_APOLLO_CONNECTOR"),
            "clearbit_enabled": _flag_enabled("ENABLE_CLEARBIT_CONNECTOR"),
            "crunchbase_enabled": _flag_enabled("ENABLE_CRUNCHBASE_CONNECTOR"),
            "connector_orchestration_enabled": _flag_enabled("ENABLE_CONNECTOR_ORCHESTRATION"),
            "from_email": current_user.get("email")
        }
    else:
        integrations["apollo_enabled"] = _flag_enabled("ENABLE_APOLLO_CONNECTOR")
        integrations["clearbit_enabled"] = _flag_enabled("ENABLE_CLEARBIT_CONNECTOR")
        integrations["crunchbase_enabled"] = _flag_enabled("ENABLE_CRUNCHBASE_CONNECTOR")
        integrations["connector_orchestration_enabled"] = _flag_enabled("ENABLE_CONNECTOR_ORCHESTRATION")

        # Mask API keys
        if integrations.get("sendgrid_api_key"):
            integrations["sendgrid_configured"] = True
            integrations["sendgrid_api_key"] = _mask_secret(integrations["sendgrid_api_key"])
        if integrations.get("apollo_api_key"):
            integrations["apollo_configured"] = True
            integrations["apollo_api_key"] = _mask_secret(integrations["apollo_api_key"])
        if integrations.get("clearbit_api_key"):
            integrations["clearbit_configured"] = True
            integrations["clearbit_api_key"] = _mask_secret(integrations["clearbit_api_key"])
        if integrations.get("crunchbase_api_key"):
            integrations["crunchbase_configured"] = True
            integrations["crunchbase_api_key"] = _mask_secret(integrations["crunchbase_api_key"])
        if integrations.get("gmail_refresh_token"):
            integrations["gmail_configured"] = True
            del integrations["gmail_refresh_token"]
    
    return integrations


@router.post("/integrations/sendgrid")
async def save_sendgrid_integration(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save SendGrid API key"""
    api_key = request.get("api_key")
    from_email = request.get("from_email")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    status = await _health_check_sendgrid(api_key)
    if not status["healthy"]:
        raise HTTPException(status_code=400, detail="Invalid SendGrid API key or provider unavailable")
    
    db = get_db()
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$set": {
            "userId": current_user["id"],
            "sendgrid_api_key": api_key,
            "from_email": from_email or current_user.get("email"),
            "sendgrid_last_health": status,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "SendGrid integration saved"}


@router.post("/integrations/apollo")
async def save_apollo_integration(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save Apollo API key (feature-flagged connector)."""
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "userId": current_user["id"],
                "apollo_api_key": api_key,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {
        "success": True,
        "message": "Apollo integration saved",
        "connectorEnabled": _flag_enabled("ENABLE_APOLLO_CONNECTOR"),
    }


@router.post("/integrations/clearbit")
async def save_clearbit_integration(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save Clearbit API key (feature-flagged connector)."""
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "userId": current_user["id"],
                "clearbit_api_key": api_key,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {
        "success": True,
        "message": "Clearbit integration saved",
        "connectorEnabled": _flag_enabled("ENABLE_CLEARBIT_CONNECTOR"),
    }


@router.post("/integrations/crunchbase")
async def save_crunchbase_integration(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save Crunchbase API key (feature-flagged connector)."""
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {
            "$set": {
                "userId": current_user["id"],
                "crunchbase_api_key": api_key,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    return {
        "success": True,
        "message": "Crunchbase integration saved",
        "connectorEnabled": _flag_enabled("ENABLE_CRUNCHBASE_CONNECTOR"),
    }


@router.delete("/integrations/sendgrid")
async def remove_sendgrid_integration(
    current_user: dict = Depends(get_current_user)
):
    """Remove SendGrid integration"""
    db = get_db()
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"sendgrid_api_key": ""}}
    )
    
    return {"success": True, "message": "SendGrid integration removed"}


@router.delete("/integrations/apollo")
async def remove_apollo_integration(
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"apollo_api_key": ""}},
    )
    return {"success": True, "message": "Apollo integration removed"}


@router.delete("/integrations/clearbit")
async def remove_clearbit_integration(
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"clearbit_api_key": ""}},
    )
    return {"success": True, "message": "Clearbit integration removed"}


@router.delete("/integrations/crunchbase")
async def remove_crunchbase_integration(
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"crunchbase_api_key": ""}},
    )
    return {"success": True, "message": "Crunchbase integration removed"}


@router.get("/integrations/health")
async def get_integrations_health(
    current_user: dict = Depends(get_current_user)
):
    """Return integration health and readiness across sales connectors."""
    db = get_db()
    integration_settings = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0},
    ) or {}

    checks = []
    if integration_settings.get("sendgrid_api_key"):
        checks.append(_health_check_sendgrid(integration_settings.get("sendgrid_api_key")))
    else:
        checks.append(
            _health_check_generic(
                provider="sendgrid",
                enabled_flag="ENABLE_SENDGRID_CONNECTOR",
                configured_key=None,
            )
        )

    checks.append(
        _health_check_generic(
            provider="apollo",
            enabled_flag="ENABLE_APOLLO_CONNECTOR",
            configured_key=integration_settings.get("apollo_api_key"),
        )
    )
    checks.append(
        _health_check_generic(
            provider="clearbit",
            enabled_flag="ENABLE_CLEARBIT_CONNECTOR",
            configured_key=integration_settings.get("clearbit_api_key"),
        )
    )
    checks.append(
        _health_check_generic(
            provider="crunchbase",
            enabled_flag="ENABLE_CRUNCHBASE_CONNECTOR",
            configured_key=integration_settings.get("crunchbase_api_key"),
        )
    )

    health_data = await asyncio.gather(*checks)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "providers": health_data,
    }


@router.get("/integrations/telemetry/summary")
async def get_integrations_telemetry_summary(
    days: int = 7,
    limit: int = 1000,
    current_user: dict = Depends(get_current_user),
):
    """Summarize connector telemetry for rollout validation."""
    if days < TELEMETRY_DAYS_MIN or days > TELEMETRY_DAYS_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"days must be between {TELEMETRY_DAYS_MIN} and {TELEMETRY_DAYS_MAX}",
        )
    if limit < TELEMETRY_SUMMARY_LIMIT_MIN or limit > TELEMETRY_SUMMARY_LIMIT_MAX:
        raise HTTPException(
            status_code=400,
            detail=(
                f"limit must be between {TELEMETRY_SUMMARY_LIMIT_MIN} "
                f"and {TELEMETRY_SUMMARY_LIMIT_MAX}"
            ),
        )

    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    events = await db.integration_telemetry.find(
        {
            "userId": current_user["id"],
            "createdAt": {"$gte": cutoff.isoformat()},
        },
        {"_id": 0},
    ).sort("createdAt", -1).limit(limit).to_list(limit)

    summary_by_event: Dict[str, int] = {}
    summary_by_provider: Dict[str, int] = {}
    summary_by_schema_version: Dict[str, int] = {}
    sales_intelligence_by_type: Dict[str, int] = {}
    sales_intelligence_by_family: Dict[str, int] = {}
    sales_intelligence_by_schema_version: Dict[str, int] = {}
    trend_by_day_map: Dict[str, Dict[str, Any]] = {}
    sales_intelligence_trend_by_day_map: Dict[str, Dict[str, Any]] = {}
    sales_intelligence_families = set()
    traceability_decision_counts: Dict[str, int] = {}
    traceability_ready_count = 0
    traceability_not_ready_count = 0
    latest_traceability_created_at: Optional[str] = None
    error_events = 0

    for event in events:
        event_type = event.get("eventType", "unknown")
        provider = event.get("provider", "unknown")
        created_at = str(event.get("createdAt") or "")
        day_key = created_at[:10] if len(created_at) >= 10 else "unknown"
        summary_by_event[event_type] = summary_by_event.get(event_type, 0) + 1
        summary_by_provider[provider] = summary_by_provider.get(provider, 0) + 1
        payload = event.get("payload") or {}
        schema_version = event.get("schemaVersion") or payload.get("schema_version")
        schema_key = str(schema_version) if schema_version is not None else "unknown"
        summary_by_schema_version[schema_key] = summary_by_schema_version.get(schema_key, 0) + 1
        if event_type == TRACEABILITY_AUDIT_EVENT_TYPE:
            decision = str(payload.get("decision") or "UNKNOWN").upper()
            traceability_decision_counts[decision] = traceability_decision_counts.get(decision, 0) + 1
            if payload.get("traceability_ready") is True:
                traceability_ready_count += 1
            elif payload.get("traceability_ready") is False:
                traceability_not_ready_count += 1
            if created_at and (
                latest_traceability_created_at is None
                or created_at > latest_traceability_created_at
            ):
                latest_traceability_created_at = created_at
        day_bucket = trend_by_day_map.setdefault(
            day_key,
            {"date": day_key, "events": 0, "errors": 0, "salesIntelligenceEvents": 0},
        )
        day_bucket["events"] += 1
        if provider == "sales_intelligence" or str(event_type).startswith("sales_"):
            sales_intelligence_by_type[event_type] = sales_intelligence_by_type.get(event_type, 0) + 1
            sales_intelligence_by_schema_version[schema_key] = (
                sales_intelligence_by_schema_version.get(schema_key, 0) + 1
            )
            family = _sales_intelligence_event_family(event_type)
            sales_intelligence_by_family[family] = sales_intelligence_by_family.get(family, 0) + 1
            sales_intelligence_families.add(family)
            day_bucket["salesIntelligenceEvents"] += 1
            family_day_bucket = sales_intelligence_trend_by_day_map.setdefault(day_key, {"date": day_key})
            family_day_bucket[family] = int(family_day_bucket.get(family, 0)) + 1
        if "error" in event_type.lower():
            error_events += 1
            day_bucket["errors"] += 1

    recent_events = []
    for event in events[:50]:
        payload = event.get("payload") or {}
        recent_events.append(
            {
                "eventType": event.get("eventType"),
                "provider": event.get("provider"),
                "createdAt": event.get("createdAt"),
                "schemaVersion": event.get("schemaVersion") or payload.get("schema_version"),
                "requestId": payload.get("request_id"),
                "statusCode": payload.get("status_code"),
                "latencyMs": payload.get("latency_ms"),
                "resultCount": payload.get("result_count"),
                "savedCount": payload.get("saved_count"),
                "error": payload.get("error"),
                "traceabilityDecision": payload.get("decision"),
                "traceabilityReady": payload.get("traceability_ready"),
            }
        )

    trend_by_day = sorted(trend_by_day_map.values(), key=lambda entry: entry["date"])
    sales_intelligence_trend_by_day = []
    for day_key in sorted(sales_intelligence_trend_by_day_map.keys()):
        bucket = sales_intelligence_trend_by_day_map[day_key]
        row = {"date": day_key}
        for family in sorted(sales_intelligence_families):
            row[family] = int(bucket.get(family, 0))
        sales_intelligence_trend_by_day.append(row)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": days,
        "eventCount": len(events),
        "errorEventCount": error_events,
        "byProvider": summary_by_provider,
        "byEventType": summary_by_event,
        "bySchemaVersion": summary_by_schema_version,
        "trendByDay": trend_by_day,
        "salesIntelligence": {
            "eventCount": sum(sales_intelligence_by_type.values()),
            "byEventFamily": sales_intelligence_by_family,
            "byEventType": sales_intelligence_by_type,
            "bySchemaVersion": sales_intelligence_by_schema_version,
            "trendByDay": sales_intelligence_trend_by_day,
        },
        "traceabilityAudit": {
            "eventCount": sum(traceability_decision_counts.values()),
            "decisionCounts": traceability_decision_counts,
            "readyCount": traceability_ready_count,
            "notReadyCount": traceability_not_ready_count,
            "latestEvaluatedAt": latest_traceability_created_at,
        },
        "recentEvents": recent_events,
    }


@router.get("/integrations/telemetry/snapshot-governance")
async def get_integrations_telemetry_snapshot_governance(
    retention_days: int = 30,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return operator-facing telemetry snapshot governance and retention status."""
    if retention_days < 1 or retention_days > 365:
        raise HTTPException(
            status_code=400,
            detail="retention_days must be between 1 and 365",
        )

    snapshot_dir = TELEMETRY_SNAPSHOT_DIR
    snapshot_files = (
        sorted(snapshot_dir.glob(f"{TELEMETRY_SNAPSHOT_PREFIX}*.json"))
        if snapshot_dir.exists()
        else []
    )
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=retention_days)

    latest_snapshot_path: Optional[Path] = None
    latest_generated_at: Optional[datetime] = None
    stale_snapshot_count = 0
    for path in snapshot_files:
        generated_at = _load_snapshot_generated_at(path)
        if generated_at and generated_at < threshold:
            stale_snapshot_count += 1
        if generated_at and (latest_generated_at is None or generated_at > latest_generated_at):
            latest_generated_at = generated_at
            latest_snapshot_path = path
        elif latest_generated_at is None and latest_snapshot_path is None:
            latest_snapshot_path = path

    age_days: Optional[float] = None
    within_retention = False
    if latest_generated_at:
        age_days = round((now - latest_generated_at).total_seconds() / 86400.0, 3)
        within_retention = latest_generated_at >= threshold

    release_profiles: Dict[str, Dict[str, Any]] = {}
    missing_profiles: List[str] = []
    for profile, path in RELEASE_GATE_ARTIFACT_PATHS.items():
        exists = path.exists()
        release_profiles[profile] = {
            "path": str(path),
            "available": exists,
        }
        if not exists:
            missing_profiles.append(profile)

    all_profiles_available = len(missing_profiles) == 0
    status = (
        "READY"
        if latest_snapshot_path is not None and within_retention and all_profiles_available
        else "ACTION_REQUIRED"
    )
    alerts: List[str] = []
    if latest_snapshot_path is None:
        alerts.append("Telemetry snapshot artifact is missing.")
    elif not within_retention:
        alerts.append("Latest telemetry snapshot is outside retention threshold.")
    if missing_profiles:
        alerts.append(
            "Release-gate fixture profile(s) missing: "
            + ", ".join(missing_profiles)
        )
    handoff_actions: List[str] = (
        [
            "Run telemetry traceability verification chain.",
            "Run cleanup dry-run and regenerate snapshot artifact.",
            "Re-run traceability CI guard before rollout.",
        ]
        if status == "ACTION_REQUIRED"
        else ["Continue rollout readiness review."]
    )
    handoff = {
        "rolloutBlocked": status == "ACTION_REQUIRED",
        "ownerRole": "Release Manager",
        "actions": handoff_actions,
    }
    governance_payload = {
        "status": status,
        "retention_days": retention_days,
        "snapshot_file_count": len(snapshot_files),
        "stale_count": stale_snapshot_count,
        "within_retention": within_retention,
        "all_fixture_profiles_available": all_profiles_available,
        "missing_fixture_profiles": missing_profiles,
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_GOVERNANCE_EVENT_TYPE,
        governance_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=get_db(),
        event_type=TRACEABILITY_GOVERNANCE_EVENT_TYPE,
        user_id=current_user["id"],
        payload=governance_payload,
        request_id=request_id,
    )

    return {
        "generatedAt": now.isoformat(),
        "retentionDays": retention_days,
        "status": status,
        "snapshot": {
            "directory": str(snapshot_dir),
            "prefix": TELEMETRY_SNAPSHOT_PREFIX,
            "fileCount": len(snapshot_files),
            "latestFile": str(latest_snapshot_path) if latest_snapshot_path else None,
            "latestGeneratedAt": latest_generated_at.isoformat() if latest_generated_at else None,
            "ageDays": age_days,
            "withinRetention": within_retention,
            "staleCount": stale_snapshot_count,
        },
        "releaseGateFixtures": {
            "profiles": release_profiles,
            "allProfilesAvailable": all_profiles_available,
            "missingProfiles": missing_profiles,
        },
        "alerts": alerts,
        "handoff": handoff,
        "requestedBy": current_user.get("id"),
    }


@router.get("/integrations/telemetry/baseline-governance")
async def get_integrations_baseline_governance(
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return baseline artifact policy posture for release-fixture governance."""
    artifact_path = BASELINE_METRICS_ARTIFACT_PATH
    if not artifact_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Baseline metrics artifact not found: {artifact_path}",
        )
    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=422,
            detail=f"Baseline metrics artifact is invalid JSON: {artifact_path}",
        )

    fixture_policy = payload.get("releaseGateFixturePolicy") or {}
    fixture_status = payload.get("releaseGateFixtures") or {}
    missing_profiles = fixture_policy.get("missingProfiles")
    if not isinstance(missing_profiles, list):
        missing_profiles = []

    policy_passed = fixture_policy.get("passed") is True
    status = "PASS" if policy_passed else "FAIL"
    response_payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "artifactGeneratedAt": payload.get("generatedAt"),
        "artifactPath": str(artifact_path),
        "overallStatus": payload.get("overallStatus"),
        "status": status,
        "releaseGateFixturePolicy": {
            "passed": policy_passed,
            "requiredProfiles": fixture_policy.get("requiredProfiles") or [],
            "missingProfiles": missing_profiles,
            "message": fixture_policy.get("message"),
        },
        "releaseGateFixtures": {
            "allProfilesAvailable": fixture_status.get("allProfilesAvailable") is True,
            "availableProfileCount": fixture_status.get("availableProfileCount"),
            "profileCount": fixture_status.get("profileCount"),
        },
        "requestedBy": current_user.get("id"),
    }
    governance_payload = {
        "status": status,
        "overall_status": payload.get("overallStatus"),
        "policy_passed": policy_passed,
        "all_profiles_available": response_payload["releaseGateFixtures"][
            "allProfilesAvailable"
        ],
        "missing_profiles": missing_profiles,
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
        governance_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=get_db(),
        event_type=TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
        user_id=current_user["id"],
        payload=governance_payload,
        request_id=request_id,
    )
    return response_payload


@router.get("/integrations/telemetry/slo-gates")
async def evaluate_integrations_slo_gates(
    days: int = 7,
    limit: int = 2000,
    max_error_rate_pct: Optional[float] = None,
    min_schema_v2_pct: Optional[float] = None,
    min_schema_v2_sample_count: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Evaluate connector telemetry against rollout SLO gates."""
    if days < TELEMETRY_DAYS_MIN or days > TELEMETRY_DAYS_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"days must be between {TELEMETRY_DAYS_MIN} and {TELEMETRY_DAYS_MAX}",
        )
    if limit < SLO_QUERY_LIMIT_MIN or limit > SLO_QUERY_LIMIT_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"limit must be between {SLO_QUERY_LIMIT_MIN} and {SLO_QUERY_LIMIT_MAX}",
        )

    error_threshold, schema_v2_threshold, schema_v2_sample_threshold = _resolve_slo_thresholds(
        max_error_rate_pct=max_error_rate_pct,
        min_schema_v2_pct=min_schema_v2_pct,
        min_schema_v2_sample_count=min_schema_v2_sample_count,
    )

    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    events = await db.integration_telemetry.find(
        {"userId": current_user["id"], "createdAt": {"$gte": cutoff.isoformat()}},
        {"_id": 0},
    ).sort("createdAt", -1).limit(limit).to_list(limit)

    provider_thresholds = _get_provider_latency_thresholds()
    provider_latencies: Dict[str, List[float]] = {provider: [] for provider in provider_thresholds}
    sales_event_count = 0
    sales_schema_v2_count = 0
    request_id = _extract_request_id(http_request)

    error_events = 0
    considered_events = 0
    for event in events:
        event_type = str(event.get("eventType", "")).lower()
        if _is_internal_traceability_event(event_type):
            continue
        considered_events += 1
        provider = str(event.get("provider", ""))
        payload = event.get("payload") or {}
        if "error" in event_type:
            error_events += 1
        if provider == "sales_intelligence" or event_type.startswith("sales_"):
            sales_event_count += 1
            schema_version = event.get("schemaVersion") or payload.get("schema_version")
            if str(schema_version) == "2":
                sales_schema_v2_count += 1
        latency = payload.get("latency_ms")
        if provider in provider_latencies and isinstance(latency, (int, float)):
            provider_latencies[provider].append(float(latency))

    total_events = considered_events
    error_rate_pct = (error_events / total_events * 100.0) if total_events > 0 else 0.0
    error_gate_passed = error_rate_pct <= error_threshold
    schema_coverage_pct = (
        (sales_schema_v2_count / sales_event_count * 100.0) if sales_event_count > 0 else 100.0
    )
    schema_gate_passed = schema_coverage_pct >= schema_v2_threshold
    schema_sample_gate_passed = sales_event_count >= schema_v2_sample_threshold

    provider_results = {}
    latency_gate_passed = True
    for provider, threshold_ms in provider_thresholds.items():
        p95 = _percentile(provider_latencies.get(provider, []), 95.0)
        passed = (p95 is None) or (p95 <= threshold_ms)
        if not passed:
            latency_gate_passed = False
        provider_results[provider] = {
            "thresholdP95Ms": threshold_ms,
            "observedP95Ms": p95,
            "sampleCount": len(provider_latencies.get(provider, [])),
            "passed": passed,
        }

    overall_passed = (
        error_gate_passed
        and latency_gate_passed
        and schema_gate_passed
        and schema_sample_gate_passed
    )

    alerts = []
    if not error_gate_passed:
        alerts.append(
            {
                "gate": "error_rate",
                "severity": "high",
                "message": f"Error rate {round(error_rate_pct, 2)}% exceeds threshold {error_threshold}%",
            }
        )
    for provider, result in provider_results.items():
        if not result["passed"]:
            alerts.append(
                {
                    "gate": "provider_latency",
                    "severity": "medium",
                    "provider": provider,
                    "message": (
                        f"P95 latency {round(result['observedP95Ms'], 2)}ms exceeds "
                        f"threshold {result['thresholdP95Ms']}ms"
                    ),
                }
            )
    if not schema_gate_passed:
        alerts.append(
            {
                "gate": "schema_coverage",
                "severity": "medium",
                "message": (
                    f"Sales schema v2 coverage {round(schema_coverage_pct, 2)}% is below "
                    f"threshold {schema_v2_threshold}%"
                ),
            }
        )
    if not schema_sample_gate_passed:
        alerts.append(
            {
                "gate": "schema_sample_size",
                "severity": "medium",
                "message": (
                    f"Sales schema sample count {sales_event_count} is below "
                    f"minimum required {schema_v2_sample_threshold}"
                ),
            }
        )

    rollout_actions = _build_slo_rollout_actions(alerts, overall_passed)
    decision = "PROCEED" if overall_passed else "HOLD"
    signoff = _build_slo_signoff_requirements(decision, alerts)
    traceability_ready = (
        bool(schema_gate_passed)
        and bool(schema_sample_gate_passed)
        and signoff.get("status") == "READY_FOR_APPROVAL"
        and len(signoff.get("requiredApprovals") or []) > 0
        and len(signoff.get("requiredEvidence") or []) > 0
    )
    traceability_payload = {
        "user_id": current_user["id"],
        "request_id": request_id,
        "decision": decision,
        "event_count": total_events,
        "alerts_count": len(alerts),
        "schema_coverage_passed": schema_gate_passed,
        "schema_sample_size_passed": schema_sample_gate_passed,
        "signoff_status": signoff.get("status"),
        "required_approvals_count": len(signoff.get("requiredApprovals") or []),
        "required_evidence_count": len(signoff.get("requiredEvidence") or []),
        "traceability_ready": traceability_ready,
    }
    _log_integration_event(
        TRACEABILITY_AUDIT_EVENT_TYPE,
        traceability_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=db,
        event_type=TRACEABILITY_AUDIT_EVENT_TYPE,
        user_id=current_user["id"],
        payload=traceability_payload,
        request_id=request_id,
    )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": days,
        "eventCount": total_events,
        "decision": decision,
        "gates": {
            "overallPassed": overall_passed,
            "errorRatePassed": error_gate_passed,
            "latencyPassed": latency_gate_passed,
            "schemaCoveragePassed": schema_gate_passed,
            "schemaSampleSizePassed": schema_sample_gate_passed,
        },
        "errorRate": {
            "thresholdPct": error_threshold,
            "observedPct": round(error_rate_pct, 4),
            "errorEvents": error_events,
        },
        "schemaCoverage": {
            "thresholdPct": schema_v2_threshold,
            "observedPct": round(schema_coverage_pct, 4),
            "sampleCount": sales_event_count,
            "minSampleCount": schema_v2_sample_threshold,
            "schemaV2Count": sales_schema_v2_count,
        },
        "providerLatency": provider_results,
        "alerts": alerts,
        "rolloutActions": rollout_actions,
        "signoff": signoff,
    }


# ============== EMAIL ANALYTICS ==============

@router.get("/email/analytics")
async def get_email_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get email sending analytics"""
    db = get_db()
    
    # Get all sends
    sends = await db.email_sends.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("sentAt", -1).limit(500).to_list(500)
    
    total = len(sends)
    delivered = len([s for s in sends if s.get("status") == "delivered"])
    opened = len([s for s in sends if s.get("openedAt")])
    clicked = len([s for s in sends if s.get("clickedAt")])
    bounced = len([s for s in sends if s.get("status") == "bounced"])
    
    return {
        "total": total,
        "delivered": delivered,
        "opened": opened,
        "clicked": clicked,
        "bounced": bounced,
        "openRate": (opened / total * 100) if total > 0 else 0,
        "clickRate": (clicked / total * 100) if total > 0 else 0,
        "bounceRate": (bounced / total * 100) if total > 0 else 0,
        "recentSends": sends[:20]
    }
