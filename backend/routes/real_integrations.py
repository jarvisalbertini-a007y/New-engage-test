"""Real World Integrations - Web Search, Web Scraping, SendGrid, Gmail"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Response
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Any, Dict, Callable, Awaitable, Set, Tuple
import os
import json
import re
import asyncio
import httpx
import time
import hashlib
import random
import math
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
INTEGRATION_RETRY_MAX_DELAY_SECONDS = float(
    os.environ.get("INTEGRATION_RETRY_MAX_DELAY_SECONDS", "5.0")
)
INTEGRATION_RETRY_JITTER_SECONDS = float(
    os.environ.get("INTEGRATION_RETRY_JITTER_SECONDS", "0.0")
)
SENDGRID_EVENT_TIMESTAMP_MILLISECONDS_THRESHOLD = 1_000_000_000_000
SENDGRID_WEBHOOK_FUTURE_SKEW_SECONDS = 300
SENDGRID_WEBHOOK_STALE_EVENT_AGE_SECONDS = 86_400
SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_RATE_PCT = 20.0
SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_RATE_PCT = 5.0
SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_COUNT = 10
SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_COUNT = 3
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
    "cookie",
    "set-cookie",
    "session_id",
    "sessionid",
}
EMAIL_LOG_KEYS = {"to", "from", "email", "from_email", "to_email"}
SENSITIVE_LOG_KEY_CANONICAL = {
    "apikey",
    "xapikey",
    "authorization",
    "proxyauthorization",
    "token",
    "refreshtoken",
    "accesstoken",
    "idtoken",
    "password",
    "secret",
    "secretkey",
    "clientsecret",
    "privatekey",
    "rawevent",
    "cookie",
    "setcookie",
    "sessionid",
}
EMAIL_LOG_KEY_CANONICAL = {
    "to",
    "from",
    "email",
    "fromemail",
    "toemail",
    "emailaddress",
}
TRACEABILITY_AUDIT_EVENT_TYPE = "integrations_traceability_status_evaluated"
TRACEABILITY_GOVERNANCE_EVENT_TYPE = (
    "integrations_traceability_snapshot_governance_evaluated"
)
TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE = (
    "integrations_traceability_baseline_governance_evaluated"
)
TRACEABILITY_GOVERNANCE_REPORT_EVENT_TYPE = (
    "integrations_traceability_governance_report_generated"
)
TRACEABILITY_GOVERNANCE_REPORT_EXPORT_EVENT_TYPE = (
    "integrations_traceability_governance_report_exported"
)
TRACEABILITY_GOVERNANCE_REPORT_HISTORY_EVENT_TYPE = (
    "integrations_traceability_governance_report_history_viewed"
)
TRACEABILITY_GOVERNANCE_SCHEMA_EVENT_TYPE = (
    "integrations_traceability_governance_schema_viewed"
)
INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE = "integrations_retry_attempt"
INTEGRATION_RETRY_FAIL_FAST_EVENT_TYPE = "integrations_retry_fail_fast"
INTEGRATION_RETRY_EXHAUSTED_EVENT_TYPE = "integrations_retry_exhausted"
CONNECTOR_CREDENTIAL_SAVED_EVENT_TYPE = "integrations_connector_credential_saved"
CONNECTOR_CREDENTIAL_REMOVED_EVENT_TYPE = "integrations_connector_credential_removed"
CONNECTOR_RATE_LIMIT_EVENT_TYPE = "integrations_connector_rate_limited"
CONNECTOR_INPUT_VALIDATION_FAILED_EVENT_TYPE = (
    "integrations_connector_input_validation_failed"
)
CONNECTOR_RATE_LIMIT_ERROR_CODE = "connector_rate_limited"
CONNECTOR_INPUT_VALIDATION_ERROR_CODE = "invalid_request_bounds"
CONNECTOR_REQUIRED_INPUT_ERROR_CODE = "invalid_request_required_field"
CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_DEFAULT = 60
CONNECTOR_RATE_LIMIT_MAX_REQUESTS_DEFAULT = 30
CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_MIN = 1
CONNECTOR_RATE_LIMIT_MAX_REQUESTS_MIN = 1
CONNECTOR_PERSIST_MAX_BYTES_DEFAULT = 24576
CONNECTOR_PERSIST_MAX_BYTES_MIN = 1024
CONNECTOR_PERSIST_MAX_BYTES_MAX = 2_000_000
CONNECTOR_PERSIST_PREVIEW_CHARS_DEFAULT = 1200
CONNECTOR_PERSIST_PREVIEW_CHARS_MIN = 200
CONNECTOR_CREDENTIAL_MAX_AGE_DAYS_DEFAULT = 180
CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS_DEFAULT = 90
CONNECTOR_CREDENTIAL_AGE_DAYS_MIN = 1
DEFAULT_MAX_RETRY_AUDIT_EVENT_COUNT = 25
DEFAULT_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS = 1.5
RETRY_AUDIT_EVENT_THRESHOLD_MIN = 0
RETRY_AUDIT_EVENT_THRESHOLD_MAX = 5000
RETRY_AUDIT_DELAY_THRESHOLD_MIN = 0.0
RETRY_AUDIT_DELAY_THRESHOLD_MAX = 300.0
DEFAULT_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT = 5
DEFAULT_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT = 25
ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MIN = 0
ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MAX = 5000
ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MIN = 0
ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MAX = 5000
TELEMETRY_SNAPSHOT_PREFIX = "connector-telemetry-summary"
TELEMETRY_SNAPSHOT_DIR = Path(__file__).resolve().parents[1] / "test_reports"
GOVERNANCE_WEEKLY_REPORT_PREFIX = "connector_governance_weekly_report"
GOVERNANCE_WEEKLY_REPORT_DIR = Path(__file__).resolve().parents[1] / "test_reports"
GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1] / "test_reports" / "governance_packet_validation.json"
)
GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS = float(
    os.environ.get("GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS", "168")
)
DEFAULT_GOVERNANCE_EXPORT_SCHEMA_VERSION = 1
SUPPORTED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS = {1}
BASELINE_METRICS_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1] / "test_reports" / "baseline_metrics.json"
)
BASELINE_COMMAND_ALIASES_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1]
    / "test_reports"
    / "sales_baseline_command_aliases.json"
)
BASELINE_ORCHESTRATION_REMEDIATION_COMMAND = (
    "npm run verify:smoke:baseline-orchestration-remediation"
)
BASELINE_GOVERNANCE_DRIFT_COMMAND = "npm run verify:smoke:baseline-governance-drift"
BASELINE_COMMAND_ALIAS_ARTIFACT_COMMAND = (
    "npm run verify:baseline:command-aliases:artifact"
)
BASELINE_COMMAND_ALIAS_ARTIFACT_CONTRACT_COMMAND = (
    "npm run verify:baseline:command-aliases:artifact:contract"
)
BASELINE_COMMAND_ALIAS_ARTIFACT_SMOKE_COMMAND = (
    "npm run verify:smoke:baseline-command-aliases-artifact"
)
BASELINE_COMMAND_ALIAS_ARTIFACT_REMEDIATION_CHAIN = [
    BASELINE_COMMAND_ALIAS_ARTIFACT_COMMAND,
    BASELINE_COMMAND_ALIAS_ARTIFACT_CONTRACT_COMMAND,
    BASELINE_COMMAND_ALIAS_ARTIFACT_SMOKE_COMMAND,
]
BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND = (
    "npm run verify:baseline:runtime-prereqs:artifact"
)
BASELINE_RUNTIME_PREREQS_ARTIFACT_CONTRACT_COMMAND = (
    "npm run verify:baseline:runtime-prereqs:artifact:contract"
)
BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND = "npm run verify:smoke:runtime-prereqs-artifact"
BASELINE_ORCHESTRATION_LEGACY_COMMANDS = {
    "npm run verify:smoke:orchestration-slo-gate",
    "npm run verify:baseline:metrics",
    BASELINE_GOVERNANCE_DRIFT_COMMAND,
}
RELEASE_GATE_ARTIFACT_PATHS = {
    "pass": Path(__file__).resolve().parents[1] / "test_reports" / "connector_release_gate_result.json",
    "hold": Path(__file__).resolve().parents[1] / "test_reports" / "connector_release_gate_result_hold.json",
    "validation-fail": (
        Path(__file__).resolve().parents[1]
        / "test_reports"
        / "connector_release_gate_result_validation_fail.json"
    ),
}
_CONNECTOR_RATE_LIMIT_STATE: Dict[str, List[float]] = {}


def _flag_enabled(flag_name: str, default: str = "false") -> bool:
    return os.environ.get(flag_name, default).strip().lower() in ("1", "true", "yes", "on")


def _resolve_governance_export_schema_version() -> Dict[str, Any]:
    raw_value = os.environ.get("GOVERNANCE_EXPORT_SCHEMA_VERSION")
    if raw_value is None:
        return {
            "activeVersion": DEFAULT_GOVERNANCE_EXPORT_SCHEMA_VERSION,
            "rawValue": None,
            "isSet": False,
            "isValid": True,
            "source": "default",
        }

    normalized = str(raw_value).strip()
    try:
        parsed = int(normalized)
    except (TypeError, ValueError):
        return {
            "activeVersion": DEFAULT_GOVERNANCE_EXPORT_SCHEMA_VERSION,
            "rawValue": normalized,
            "isSet": True,
            "isValid": False,
            "source": "env_invalid_fallback",
        }
    if parsed < 1:
        return {
            "activeVersion": DEFAULT_GOVERNANCE_EXPORT_SCHEMA_VERSION,
            "rawValue": normalized,
            "isSet": True,
            "isValid": False,
            "source": "env_invalid_fallback",
        }
    return {
        "activeVersion": parsed,
        "rawValue": normalized,
        "isSet": True,
        "isValid": True,
        "source": "env_override",
    }


def _build_governance_schema_metadata() -> Dict[str, Any]:
    resolved = _resolve_governance_export_schema_version()
    return {
        "activeVersion": int(resolved["activeVersion"]),
        "defaultVersion": DEFAULT_GOVERNANCE_EXPORT_SCHEMA_VERSION,
        "supportedVersions": sorted(SUPPORTED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS),
        "source": resolved["source"],
        "override": {
            "envVar": "GOVERNANCE_EXPORT_SCHEMA_VERSION",
            "rawValue": resolved["rawValue"],
            "isSet": bool(resolved["isSet"]),
            "isValid": bool(resolved["isValid"]),
        },
    }


def _get_governance_export_schema_version() -> int:
    return int(_resolve_governance_export_schema_version()["activeVersion"])


def _normalize_governance_reason_code(
    trigger: Any,
    fallback: str = "governance_state",
) -> str:
    raw_value = str(trigger or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw_value).strip("_")
    if not normalized:
        normalized = fallback
    if len(normalized) > 64:
        normalized = normalized[:64].rstrip("_")
    return normalized or fallback


def _attach_governance_reason_codes(
    actions: List[Dict[str, Any]],
    fallback: str,
) -> List[str]:
    reason_codes: List[str] = []
    for action in actions:
        reason_code = _normalize_governance_reason_code(action.get("trigger"), fallback)
        action["reasonCode"] = reason_code
        if reason_code not in reason_codes:
            reason_codes.append(reason_code)
    return reason_codes


def _append_ordered_command(commands: List[str], command: Any) -> None:
    if not isinstance(command, str):
        return
    normalized = command.strip()
    if not normalized:
        return
    if normalized in commands:
        return
    commands.append(normalized)


def _normalize_recommended_commands(commands: Any) -> List[str]:
    if not isinstance(commands, list):
        return []
    normalized_commands: List[str] = []
    for command in commands:
        _append_ordered_command(normalized_commands, command)
    return normalized_commands


def _normalize_string_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        candidate = value.strip()
        if not candidate:
            continue
        if candidate not in normalized:
            normalized.append(candidate)
    return normalized


def _normalize_action_reason_codes(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    reason_codes: List[str] = []
    for item in values:
        if not isinstance(item, dict):
            continue
        reason_code = item.get("reasonCode")
        if not isinstance(reason_code, str):
            continue
        candidate = reason_code.strip()
        if not candidate:
            continue
        if candidate not in reason_codes:
            reason_codes.append(candidate)
    return reason_codes


def _normalize_action_labels(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    actions: List[str] = []
    for item in values:
        if isinstance(item, dict):
            action = item.get("action")
            if isinstance(action, str):
                candidate = action.strip()
                if candidate and candidate not in actions:
                    actions.append(candidate)
    return actions


def _list_parity(left: List[str], right: List[str]) -> Optional[bool]:
    if len(left) == 0 and len(right) == 0:
        return None
    return sorted(left) == sorted(right)


def _normalize_optional_owner_role(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized


def _normalize_optional_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    return None


def _normalize_status_token(value: Any) -> str:
    if not isinstance(value, str):
        return "UNKNOWN"
    normalized = re.sub(r"[^A-Z0-9]+", "_", value.strip().upper()).strip("_")
    return normalized or "UNKNOWN"


def _normalize_optional_status_token(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"[^A-Z0-9]+", "_", value.strip().upper()).strip("_")
    return normalized or None


def _normalize_status_token_with_allowlist(
    value: Any,
    allowed_tokens: Set[str],
    *,
    fallback: str = "UNKNOWN",
) -> str:
    normalized = _normalize_status_token(value)
    if normalized in allowed_tokens:
        return normalized
    return fallback


def _normalize_optional_status_query_filter(
    value: Optional[str],
    *,
    field_name: str,
) -> Optional[str]:
    if value is None:
        return None
    normalized = _normalize_optional_status_token(value)
    if normalized is None:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} must be a non-empty status token",
        )
    return normalized


def _is_schema_parity_group_valid(group: Dict[str, Any]) -> bool:
    if not isinstance(group, dict):
        return False
    for value in group.values():
        if value is False:
            return False
    return True


def _build_governance_schema_contract_parity(
    *,
    reason_codes: List[str],
    recommended_commands: List[str],
    handoff: Dict[str, Any],
    rollout_actions: List[Dict[str, Any]],
    governance_export: Dict[str, Any],
    evaluated_at: str,
) -> Dict[str, Any]:
    top_level_reason_codes = _normalize_string_list(reason_codes)
    top_level_commands = _normalize_string_list(recommended_commands)

    rollout_action_reason_codes = _normalize_action_reason_codes(rollout_actions)
    export_action_reason_codes = _normalize_action_reason_codes(
        governance_export.get("actions")
    )
    export_alert_reason_codes = _normalize_action_reason_codes(
        governance_export.get("alerts")
    )
    export_reason_codes = _normalize_string_list(governance_export.get("reasonCodes"))
    export_commands = _normalize_string_list(
        governance_export.get("recommendedCommands")
    )

    handoff_actions = _normalize_string_list(handoff.get("actions"))
    rollout_action_labels = _normalize_action_labels(rollout_actions)

    reason_code_parity = {
        "topLevelVsRolloutActions": _list_parity(
            top_level_reason_codes,
            rollout_action_reason_codes,
        ),
        "topLevelVsExportActions": _list_parity(
            top_level_reason_codes,
            export_action_reason_codes,
        ),
        "topLevelVsExportAlerts": _list_parity(
            top_level_reason_codes,
            export_alert_reason_codes,
        ),
        "topLevelVsExportReasonCodes": _list_parity(
            top_level_reason_codes,
            export_reason_codes,
        ),
    }

    recommended_command_parity = {
        "topLevelVsExport": _list_parity(top_level_commands, export_commands),
    }

    handoff_parity = {
        "rolloutBlockedMatchesExport": (
            _normalize_optional_bool(handoff.get("rolloutBlocked"))
            == _normalize_optional_bool(governance_export.get("rolloutBlocked"))
            if handoff or governance_export
            else None
        ),
        "ownerRoleMatchesExport": (
            _normalize_optional_owner_role(handoff.get("ownerRole"))
            == _normalize_optional_owner_role(governance_export.get("ownerRole"))
            if handoff or governance_export
            else None
        ),
        "handoffActionsMatchRolloutActions": _list_parity(
            handoff_actions,
            rollout_action_labels,
        ),
        "handoffActionCount": len(handoff_actions),
        "rolloutActionCount": len(rollout_action_labels),
    }

    return {
        "reasonCodeCount": len(top_level_reason_codes),
        "recommendedCommandCount": len(top_level_commands),
        "reasonCodeParity": reason_code_parity,
        "recommendedCommandParity": recommended_command_parity,
        "handoffParity": handoff_parity,
        "computedAt": evaluated_at,
    }


def _resolve_governance_schema_event_parity(
    payload: Dict[str, Any]
) -> Dict[str, Optional[bool]]:
    reason_code_parity_ok = _normalize_optional_bool(
        payload.get("reason_code_parity_ok")
    )
    recommended_command_parity_ok = _normalize_optional_bool(
        payload.get("recommended_command_parity_ok")
    )
    handoff_parity_ok = _normalize_optional_bool(payload.get("handoff_parity_ok"))

    parity_values = [
        reason_code_parity_ok,
        recommended_command_parity_ok,
        handoff_parity_ok,
    ]
    all_parity_ok: Optional[bool] = None
    if any(value is False for value in parity_values):
        all_parity_ok = False
    elif all(value is True for value in parity_values):
        all_parity_ok = True

    return {
        "reasonCodeParityOk": reason_code_parity_ok,
        "recommendedCommandParityOk": recommended_command_parity_ok,
        "handoffParityOk": handoff_parity_ok,
        "allParityOk": all_parity_ok,
    }


def _build_baseline_governance_recommended_commands(
    *,
    status: str,
    orchestration_gate_needs_remediation: bool,
    actions: List[Dict[str, Any]],
    artifact_commands: Any = None,
) -> List[str]:
    recommended: List[str] = _normalize_recommended_commands(artifact_commands)
    if (
        BASELINE_ORCHESTRATION_REMEDIATION_COMMAND in recommended
        and BASELINE_GOVERNANCE_DRIFT_COMMAND in recommended
    ):
        recommended = [
            command
            for command in recommended
            if command not in BASELINE_ORCHESTRATION_LEGACY_COMMANDS
        ]
    if orchestration_gate_needs_remediation:
        recommended = [
            command
            for command in recommended
            if command not in BASELINE_ORCHESTRATION_LEGACY_COMMANDS
        ]
        recommended.insert(0, BASELINE_ORCHESTRATION_REMEDIATION_COMMAND)
        recommended = _normalize_recommended_commands(recommended)
    elif status != "PASS":
        recommended.insert(0, BASELINE_GOVERNANCE_DRIFT_COMMAND)
        recommended = _normalize_recommended_commands(recommended)

    for item in actions:
        command = item.get("command")
        if (
            BASELINE_ORCHESTRATION_REMEDIATION_COMMAND in recommended
            and isinstance(command, str)
            and command.strip() in BASELINE_ORCHESTRATION_LEGACY_COMMANDS
        ):
            continue
        _append_ordered_command(recommended, command)

    if BASELINE_ORCHESTRATION_REMEDIATION_COMMAND not in recommended:
        includes_full_legacy_chain = all(
            command in recommended for command in BASELINE_ORCHESTRATION_LEGACY_COMMANDS
        )
        if includes_full_legacy_chain:
            recommended = [
                command
                for command in recommended
                if command not in BASELINE_ORCHESTRATION_LEGACY_COMMANDS
            ]
            recommended.insert(0, BASELINE_ORCHESTRATION_REMEDIATION_COMMAND)
            recommended = _normalize_recommended_commands(recommended)

    if BASELINE_ORCHESTRATION_REMEDIATION_COMMAND in recommended:
        recommended = [
            command
            for command in recommended
            if command not in BASELINE_COMMAND_ALIAS_ARTIFACT_REMEDIATION_CHAIN
        ]
        wrapper_index = recommended.index(BASELINE_ORCHESTRATION_REMEDIATION_COMMAND)
        insertion_index = wrapper_index + 1
        for command in BASELINE_COMMAND_ALIAS_ARTIFACT_REMEDIATION_CHAIN:
            recommended.insert(insertion_index, command)
            insertion_index += 1
        recommended = _normalize_recommended_commands(recommended)
    return _normalize_recommended_commands(recommended)


def _resolve_baseline_command_aliases_summary(
    artifact_payload: Any,
) -> Dict[str, Any]:
    source = "none"
    artifact_path_value: Optional[str] = None
    payload_map = _coerce_payload_map(artifact_payload)

    if payload_map:
        source = "baseline_metrics"
    else:
        artifact_path = BASELINE_COMMAND_ALIASES_ARTIFACT_PATH
        artifact_path_value = str(artifact_path)
        if artifact_path.exists():
            source = "artifact_file"
            try:
                artifact_root = json.loads(artifact_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return {
                    "present": True,
                    "available": False,
                    "source": source,
                    "artifactPath": artifact_path_value,
                    "command": None,
                    "validatedAt": None,
                    "contractValid": False,
                    "valid": None,
                    "gatePassed": False,
                    "missingAliases": [],
                    "missingAliasCount": 0,
                    "mismatchedAliases": [],
                    "mismatchedAliasCount": 0,
                }
            artifact_map = _coerce_payload_map(artifact_root)
            nested_artifact_map = _coerce_payload_map(artifact_map.get("artifact"))
            payload_map = nested_artifact_map or artifact_map
        else:
            return {
                "present": False,
                "available": False,
                "source": source,
                "artifactPath": artifact_path_value,
                "command": None,
                "validatedAt": None,
                "contractValid": None,
                "valid": None,
                "gatePassed": None,
                "missingAliases": [],
                "missingAliasCount": 0,
                "mismatchedAliases": [],
                "mismatchedAliasCount": 0,
            }

    present = True
    available = bool(payload_map)
    if not available:
        return {
            "present": present,
            "available": False,
            "source": source,
            "artifactPath": artifact_path_value,
            "command": None,
            "validatedAt": None,
            "contractValid": False,
            "valid": None,
            "gatePassed": False,
            "missingAliases": [],
            "missingAliasCount": 0,
            "mismatchedAliases": [],
            "mismatchedAliasCount": 0,
        }

    raw_artifact_path = payload_map.get("artifactPath")
    if isinstance(raw_artifact_path, str) and raw_artifact_path.strip():
        artifact_path_value = raw_artifact_path.strip()
    elif source == "artifact_file":
        artifact_path_value = str(BASELINE_COMMAND_ALIASES_ARTIFACT_PATH)

    command = payload_map.get("command")
    if not isinstance(command, str) or not command.strip():
        command = None
    else:
        command = command.strip()

    validated_at = payload_map.get("validatedAt")
    if not isinstance(validated_at, str) or not validated_at.strip():
        validated_at = None
    else:
        validated_at = validated_at.strip()

    valid_value = payload_map.get("valid")
    valid = valid_value if isinstance(valid_value, bool) else None

    missing_aliases_raw = payload_map.get("missingAliases")
    mismatched_aliases_raw = payload_map.get("mismatchedAliases")
    missing_aliases = _normalize_string_list(missing_aliases_raw)
    mismatched_aliases = _normalize_string_list(mismatched_aliases_raw)

    contract_valid = (
        isinstance(payload_map.get("aliasChecks"), dict)
        and isinstance(payload_map.get("requiredAliases"), dict)
        and isinstance(missing_aliases_raw, list)
        and isinstance(mismatched_aliases_raw, list)
        and isinstance(valid, bool)
    )
    gate_passed = (
        contract_valid
        and valid is True
        and len(missing_aliases) == 0
        and len(mismatched_aliases) == 0
    )

    return {
        "present": present,
        "available": True,
        "source": source,
        "artifactPath": artifact_path_value,
        "command": command,
        "validatedAt": validated_at,
        "contractValid": contract_valid,
        "valid": valid,
        "gatePassed": gate_passed,
        "missingAliases": missing_aliases,
        "missingAliasCount": len(missing_aliases),
        "mismatchedAliases": mismatched_aliases,
        "mismatchedAliasCount": len(mismatched_aliases),
    }


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


def _normalize_log_key_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _is_sensitive_log_key(key_name: str) -> bool:
    normalized_key = str(key_name or "").strip().lower()
    if not normalized_key:
        return False
    if normalized_key in SENSITIVE_LOG_KEYS:
        return True
    return _normalize_log_key_name(normalized_key) in SENSITIVE_LOG_KEY_CANONICAL


def _is_email_log_key(key_name: str) -> bool:
    normalized_key = str(key_name or "").strip().lower()
    if not normalized_key:
        return False
    if normalized_key in EMAIL_LOG_KEYS:
        return True
    return _normalize_log_key_name(normalized_key) in EMAIL_LOG_KEY_CANONICAL


def _sanitize_log_payload(value: Any, key_hint: Optional[str] = None) -> Any:
    key_name = str(key_hint or "").strip()
    if _is_sensitive_log_key(key_name):
        return "[redacted]"

    if isinstance(value, dict):
        return {
            key: _sanitize_log_payload(nested_value, key)
            for key, nested_value in value.items()
        }
    if isinstance(value, list):
        return [_sanitize_log_payload(item, key_hint) for item in value]
    if isinstance(value, str):
        if _is_email_log_key(key_name):
            return _mask_email(value)
        if len(value) > 1000:
            return f"{value[:1000]}...<truncated>"
    return value


def _coerce_payload_map(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _coerce_non_negative_int(value: Any, fallback: int = 0) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return fallback
    if normalized < 0:
        return fallback
    return normalized


def _coerce_non_negative_float(
    value: Any,
    fallback: Optional[float] = None,
) -> Optional[float]:
    try:
        normalized = float(value)
    except (TypeError, ValueError):
        return fallback
    if normalized < 0:
        return fallback
    return normalized


def _normalize_connector_rate_limit_endpoint_key(value: Any) -> str:
    raw_value = str(value or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw_value).strip("_")
    return normalized or "unknown"


def _resolve_connector_rate_limit_pressure(
    max_retry_after_seconds: Optional[float],
    avg_reset_in_seconds: Optional[float],
) -> Dict[str, Any]:
    max_retry = (
        max_retry_after_seconds
        if isinstance(max_retry_after_seconds, (int, float))
        else 0.0
    )
    avg_reset = (
        avg_reset_in_seconds
        if isinstance(avg_reset_in_seconds, (int, float))
        else 0.0
    )
    signal_seconds = round(max(float(max_retry), float(avg_reset)), 2)
    if signal_seconds >= 45:
        label = "High"
    elif signal_seconds >= 20:
        label = "Moderate"
    elif signal_seconds > 0:
        label = "Low"
    else:
        label = "Unknown"
    return {
        "label": label,
        "signalSeconds": signal_seconds,
    }


def _coerce_non_negative_int_optional(value: Any) -> Optional[int]:
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return None
    if normalized < 0:
        return None
    return normalized


def _coerce_non_negative_int_optional_strict(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if not re.fullmatch(r"\d+", normalized):
            return None
        return int(normalized)
    return None


def _normalize_connector_rate_limit_endpoint_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for endpoint, count in value.items():
        normalized_count = _coerce_non_negative_int_optional(count)
        if normalized_count is None:
            continue
        endpoint_key = _normalize_connector_rate_limit_endpoint_key(endpoint)
        normalized[endpoint_key] = int(normalized.get(endpoint_key, 0)) + normalized_count
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _normalize_status_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for raw_status, raw_count in value.items():
        status_key = _normalize_optional_status_token(raw_status)
        if status_key is None:
            continue
        normalized_count = _coerce_non_negative_int_optional(raw_count)
        if normalized_count is None:
            continue
        normalized[status_key] = int(normalized.get(status_key, 0)) + normalized_count
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _status_count_maps_equal(left: Any, right: Any) -> bool:
    return _normalize_status_count_map(left) == _normalize_status_count_map(right)


def _build_status_count_map(values: Any) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    if not isinstance(values, list):
        return {}
    for raw_value in values:
        normalized = _normalize_optional_status_token(raw_value)
        if normalized is None:
            continue
        counts[normalized] = int(counts.get(normalized, 0)) + 1
    return {key: counts[key] for key in sorted(counts.keys())}


def _classify_status_count_provenance_posture(
    source: Any,
    mismatch: Any,
) -> Dict[str, Any]:
    normalized_source = str(source).strip().lower()
    mismatch_flag = bool(mismatch)
    if normalized_source == "server" and mismatch_flag:
        return {
            "posture": "server_drift",
            "severity": "warning",
            "requiresInvestigation": True,
        }
    if normalized_source == "server":
        return {
            "posture": "server_consistent",
            "severity": "info",
            "requiresInvestigation": False,
        }
    if mismatch_flag:
        return {
            "posture": "local_drift",
            "severity": "warning",
            "requiresInvestigation": True,
        }
    return {
        "posture": "local_fallback",
        "severity": "info",
        "requiresInvestigation": False,
    }


INTEGRATION_HEALTH_FRESHNESS_STATUS_ORDER: Tuple[str, ...] = (
    "ACTION_REQUIRED",
    "READY",
    "UNKNOWN",
)
INTEGRATION_HEALTH_FRESHNESS_STATUS_ALLOWED: Set[str] = set(
    INTEGRATION_HEALTH_FRESHNESS_STATUS_ORDER
)


def _normalize_integration_health_freshness_status(value: Any) -> str:
    return _normalize_status_token_with_allowlist(
        value,
        INTEGRATION_HEALTH_FRESHNESS_STATUS_ALLOWED,
        fallback="UNKNOWN",
    )


def _normalize_integration_health_freshness_status_count_map(
    value: Any,
    *,
    include_all_statuses: bool = False,
) -> Dict[str, int]:
    normalized: Dict[str, int] = (
        {status: 0 for status in INTEGRATION_HEALTH_FRESHNESS_STATUS_ORDER}
        if include_all_statuses
        else {}
    )
    if isinstance(value, dict):
        for raw_status, raw_count in value.items():
            status_key = _normalize_integration_health_freshness_status(raw_status)
            normalized_count = _coerce_non_negative_int_optional(raw_count)
            if normalized_count is None:
                continue
            normalized[status_key] = int(normalized.get(status_key, 0)) + normalized_count

    ordered: Dict[str, int] = {}
    for status in INTEGRATION_HEALTH_FRESHNESS_STATUS_ORDER:
        if status in normalized:
            ordered[status] = int(normalized[status])
    for status in sorted(normalized.keys()):
        if status not in ordered:
            ordered[status] = int(normalized[status])
    return ordered


def _build_integration_health_freshness_status_count_fallback(
    freshness_by_provider: Any,
) -> Dict[str, int]:
    counts: Dict[str, int] = {
        status: 0 for status in INTEGRATION_HEALTH_FRESHNESS_STATUS_ORDER
    }
    if isinstance(freshness_by_provider, dict):
        for row in freshness_by_provider.values():
            status_value = None
            if isinstance(row, dict):
                status_value = row.get("status")
            status_key = _normalize_integration_health_freshness_status(status_value)
            counts[status_key] = int(counts.get(status_key, 0)) + 1
    return _normalize_integration_health_freshness_status_count_map(
        counts,
        include_all_statuses=True,
    )


def _integration_health_freshness_status_count_maps_match(
    left: Dict[str, int],
    right: Dict[str, int],
) -> bool:
    normalized_left = _normalize_integration_health_freshness_status_count_map(
        left,
        include_all_statuses=True,
    )
    normalized_right = _normalize_integration_health_freshness_status_count_map(
        right,
        include_all_statuses=True,
    )
    return normalized_left == normalized_right


def _normalize_connector_pressure_label(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized or None


def _normalize_sendgrid_timestamp_pressure_label_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for raw_label, raw_count in value.items():
        normalized_count = _coerce_non_negative_int_optional(raw_count)
        if normalized_count is None:
            continue
        normalized_label = _normalize_sendgrid_timestamp_pressure_label(raw_label)
        normalized[normalized_label] = (
            int(normalized.get(normalized_label, 0)) + normalized_count
        )
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _normalize_sendgrid_timestamp_hint_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for raw_hint, raw_count in value.items():
        normalized_count = _coerce_non_negative_int_optional(raw_count)
        if normalized_count is None:
            continue
        normalized_hint = str(raw_hint or "").strip()
        if not normalized_hint:
            normalized_hint = "Timestamp posture not available."
        normalized[normalized_hint] = (
            int(normalized.get(normalized_hint, 0)) + normalized_count
        )
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _normalize_sendgrid_timestamp_bucket_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for raw_bucket, raw_count in value.items():
        normalized_count = _coerce_non_negative_int_optional(raw_count)
        if normalized_count is None:
            continue
        bucket_key = _normalize_sendgrid_timestamp_bucket_key(raw_bucket)
        if bucket_key is None:
            continue
        normalized[bucket_key] = int(normalized.get(bucket_key, 0)) + normalized_count
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _normalize_sendgrid_timestamp_event_type_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for raw_event_type, raw_count in value.items():
        normalized_count = _coerce_non_negative_int_optional(raw_count)
        if normalized_count is None:
            continue
        normalized_event_type = _normalize_sendgrid_event_type(raw_event_type)
        normalized[normalized_event_type] = (
            int(normalized.get(normalized_event_type, 0)) + normalized_count
        )
    return {key: normalized[key] for key in sorted(normalized.keys())}


def _normalize_sendgrid_webhook_timestamp_rollup(value: Any) -> Dict[str, Any]:
    payload = _coerce_payload_map(value)
    latest_event_at = payload.get("latestEventAt")
    if not isinstance(latest_event_at, str) or not latest_event_at.strip():
        latest_event_at = None
    else:
        latest_event_at = latest_event_at.strip()

    return {
        "eventCount": _coerce_non_negative_int(payload.get("eventCount"), fallback=0),
        "pressureLabelCounts": _normalize_sendgrid_timestamp_pressure_label_count_map(
            payload.get("pressureLabelCounts")
        ),
        "pressureHintCounts": _normalize_sendgrid_timestamp_hint_count_map(
            payload.get("pressureHintCounts")
        ),
        "timestampFallbackCount": _coerce_non_negative_int(
            payload.get("timestampFallbackCount"),
            fallback=0,
        ),
        "futureSkewEventCount": _coerce_non_negative_int(
            payload.get("futureSkewEventCount"),
            fallback=0,
        ),
        "staleEventCount": _coerce_non_negative_int(
            payload.get("staleEventCount"),
            fallback=0,
        ),
        "freshEventCount": _coerce_non_negative_int(
            payload.get("freshEventCount"),
            fallback=0,
        ),
        "timestampAnomalyCountTotal": _coerce_non_negative_int(
            payload.get("timestampAnomalyCountTotal"),
            fallback=0,
        ),
        "avgTimestampAnomalyCount": _coerce_non_negative_float(
            payload.get("avgTimestampAnomalyCount"),
            fallback=None,
        ),
        "avgTimestampAnomalyRatePct": _coerce_non_negative_float(
            payload.get("avgTimestampAnomalyRatePct"),
            fallback=None,
        ),
        "maxTimestampAnomalyRatePct": _coerce_non_negative_float(
            payload.get("maxTimestampAnomalyRatePct"),
            fallback=None,
        ),
        "timestampAgeBucketCounts": _normalize_sendgrid_timestamp_bucket_count_map(
            payload.get("timestampAgeBucketCounts")
        ),
        "timestampAnomalyEventTypeCounts": _normalize_sendgrid_timestamp_event_type_count_map(
            payload.get("timestampAnomalyEventTypeCounts")
        ),
        "timestampDominantAnomalyBucketCounts": _normalize_sendgrid_timestamp_bucket_count_map(
            payload.get("timestampDominantAnomalyBucketCounts")
        ),
        "timestampDominantAnomalyEventTypeCounts": _normalize_sendgrid_timestamp_event_type_count_map(
            payload.get("timestampDominantAnomalyEventTypeCounts")
        ),
        "timestampPressureHighAnomalyRatePct": _coerce_non_negative_float(
            payload.get("timestampPressureHighAnomalyRatePct"),
            fallback=None,
        ),
        "timestampPressureModerateAnomalyRatePct": _coerce_non_negative_float(
            payload.get("timestampPressureModerateAnomalyRatePct"),
            fallback=None,
        ),
        "timestampPressureHighAnomalyCount": _coerce_non_negative_int_optional(
            payload.get("timestampPressureHighAnomalyCount")
        ),
        "timestampPressureModerateAnomalyCount": _coerce_non_negative_int_optional(
            payload.get("timestampPressureModerateAnomalyCount")
        ),
        "latestEventAt": latest_event_at,
    }


def _build_connector_pressure_parity(
    top_level_connector: Any,
    nested_connector: Any,
    totals_connector_rate_limit_event_count: Any = None,
) -> Dict[str, Any]:
    top_level_payload = _coerce_payload_map(top_level_connector)
    nested_payload = _coerce_payload_map(nested_connector)

    top_level_event_count = _coerce_non_negative_int_optional(
        top_level_payload.get("eventCount")
    )
    nested_event_count = _coerce_non_negative_int_optional(
        nested_payload.get("eventCount")
    )
    totals_event_count = _coerce_non_negative_int_optional(
        totals_connector_rate_limit_event_count
    )

    top_level_by_endpoint = _normalize_connector_rate_limit_endpoint_map(
        top_level_payload.get("byEndpoint")
    )
    nested_by_endpoint = _normalize_connector_rate_limit_endpoint_map(
        nested_payload.get("byEndpoint")
    )

    top_level_pressure_label = _normalize_connector_pressure_label(
        _coerce_payload_map(top_level_payload.get("pressure")).get("label")
    )
    nested_pressure_label = _normalize_connector_pressure_label(
        _coerce_payload_map(nested_payload.get("pressure")).get("label")
    )

    return {
        "topLevelEventCount": top_level_event_count,
        "nestedEventCount": nested_event_count,
        "totalsEventCount": totals_event_count,
        "eventCountMatchesNested": (
            top_level_event_count == nested_event_count
            if top_level_event_count is not None and nested_event_count is not None
            else None
        ),
        "eventCountMatchesTotals": (
            top_level_event_count == totals_event_count
            if top_level_event_count is not None and totals_event_count is not None
            else None
        ),
        "byEndpointMatchesNested": top_level_by_endpoint == nested_by_endpoint,
        "pressureLabelMatchesNested": (
            top_level_pressure_label == nested_pressure_label
            if top_level_pressure_label and nested_pressure_label
            else None
        ),
        "normalizedTopLevelByEndpoint": top_level_by_endpoint,
        "normalizedNestedByEndpoint": nested_by_endpoint,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def _normalize_sendgrid_timestamp_parity_latest_event_at(value: Any) -> Optional[str]:
    parsed = _parse_iso_datetime(str(value) if value is not None else None)
    if parsed is None:
        return None
    return parsed.isoformat()


def _build_sendgrid_webhook_timestamp_parity(
    top_level_sendgrid: Any,
    nested_sendgrid: Any,
    totals_sendgrid_event_count: Any = None,
    totals_sendgrid_anomaly_count_total: Any = None,
) -> Dict[str, Any]:
    top_level_payload = _normalize_sendgrid_webhook_timestamp_rollup(top_level_sendgrid)
    nested_payload = _normalize_sendgrid_webhook_timestamp_rollup(nested_sendgrid)

    top_level_event_count = _coerce_non_negative_int_optional(
        top_level_payload.get("eventCount")
    )
    nested_event_count = _coerce_non_negative_int_optional(
        nested_payload.get("eventCount")
    )
    totals_event_count = _coerce_non_negative_int_optional(totals_sendgrid_event_count)

    top_level_anomaly_count_total = _coerce_non_negative_int_optional(
        top_level_payload.get("timestampAnomalyCountTotal")
    )
    nested_anomaly_count_total = _coerce_non_negative_int_optional(
        nested_payload.get("timestampAnomalyCountTotal")
    )
    totals_anomaly_count_total = _coerce_non_negative_int_optional(
        totals_sendgrid_anomaly_count_total
    )

    top_level_pressure_label_counts = _normalize_sendgrid_timestamp_pressure_label_count_map(
        top_level_payload.get("pressureLabelCounts")
    )
    nested_pressure_label_counts = _normalize_sendgrid_timestamp_pressure_label_count_map(
        nested_payload.get("pressureLabelCounts")
    )
    top_level_pressure_hint_counts = _normalize_sendgrid_timestamp_hint_count_map(
        top_level_payload.get("pressureHintCounts")
    )
    nested_pressure_hint_counts = _normalize_sendgrid_timestamp_hint_count_map(
        nested_payload.get("pressureHintCounts")
    )
    top_level_age_bucket_counts = _normalize_sendgrid_timestamp_bucket_count_map(
        top_level_payload.get("timestampAgeBucketCounts")
    )
    nested_age_bucket_counts = _normalize_sendgrid_timestamp_bucket_count_map(
        nested_payload.get("timestampAgeBucketCounts")
    )
    top_level_anomaly_event_type_counts = _normalize_sendgrid_timestamp_event_type_count_map(
        top_level_payload.get("timestampAnomalyEventTypeCounts")
    )
    nested_anomaly_event_type_counts = _normalize_sendgrid_timestamp_event_type_count_map(
        nested_payload.get("timestampAnomalyEventTypeCounts")
    )

    normalized_latest_event_at_top_level = _normalize_sendgrid_timestamp_parity_latest_event_at(
        top_level_payload.get("latestEventAt")
    )
    normalized_latest_event_at_nested = _normalize_sendgrid_timestamp_parity_latest_event_at(
        nested_payload.get("latestEventAt")
    )

    return {
        "topLevelEventCount": top_level_event_count,
        "nestedEventCount": nested_event_count,
        "totalsEventCount": totals_event_count,
        "topLevelAnomalyCountTotal": top_level_anomaly_count_total,
        "nestedAnomalyCountTotal": nested_anomaly_count_total,
        "totalsAnomalyCountTotal": totals_anomaly_count_total,
        "eventCountMatchesNested": (
            top_level_event_count == nested_event_count
            if top_level_event_count is not None and nested_event_count is not None
            else None
        ),
        "eventCountMatchesTotals": (
            top_level_event_count == totals_event_count
            if top_level_event_count is not None and totals_event_count is not None
            else None
        ),
        "anomalyCountTotalMatchesNested": (
            top_level_anomaly_count_total == nested_anomaly_count_total
            if top_level_anomaly_count_total is not None
            and nested_anomaly_count_total is not None
            else None
        ),
        "anomalyCountTotalMatchesTotals": (
            top_level_anomaly_count_total == totals_anomaly_count_total
            if top_level_anomaly_count_total is not None
            and totals_anomaly_count_total is not None
            else None
        ),
        "pressureLabelCountsMatchNested": (
            top_level_pressure_label_counts == nested_pressure_label_counts
            if top_level_pressure_label_counts or nested_pressure_label_counts
            else None
        ),
        "pressureHintCountsMatchNested": (
            top_level_pressure_hint_counts == nested_pressure_hint_counts
            if top_level_pressure_hint_counts or nested_pressure_hint_counts
            else None
        ),
        "ageBucketCountsMatchNested": (
            top_level_age_bucket_counts == nested_age_bucket_counts
            if top_level_age_bucket_counts or nested_age_bucket_counts
            else None
        ),
        "anomalyEventTypeCountsMatchNested": (
            top_level_anomaly_event_type_counts == nested_anomaly_event_type_counts
            if top_level_anomaly_event_type_counts or nested_anomaly_event_type_counts
            else None
        ),
        "latestEventAtMatchesNested": (
            normalized_latest_event_at_top_level == normalized_latest_event_at_nested
            if normalized_latest_event_at_top_level and normalized_latest_event_at_nested
            else None
        ),
        "normalizedTopLevelPressureLabelCounts": top_level_pressure_label_counts,
        "normalizedNestedPressureLabelCounts": nested_pressure_label_counts,
        "normalizedTopLevelPressureHintCounts": top_level_pressure_hint_counts,
        "normalizedNestedPressureHintCounts": nested_pressure_hint_counts,
        "normalizedTopLevelAgeBucketCounts": top_level_age_bucket_counts,
        "normalizedNestedAgeBucketCounts": nested_age_bucket_counts,
        "normalizedTopLevelAnomalyEventTypeCounts": top_level_anomaly_event_type_counts,
        "normalizedNestedAnomalyEventTypeCounts": nested_anomaly_event_type_counts,
        "normalizedLatestEventAtTopLevel": normalized_latest_event_at_top_level,
        "normalizedLatestEventAtNested": normalized_latest_event_at_nested,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def _normalize_runtime_prereqs_rollup(
    *,
    payload: Any,
    present: bool,
    fallback_command: Optional[str] = None,
) -> Dict[str, Any]:
    runtime_payload = _coerce_payload_map(payload)
    available = runtime_payload.get("available") is True
    passed_value = runtime_payload.get("passed")
    passed = passed_value if isinstance(passed_value, bool) else None
    contract_valid_value = runtime_payload.get("contractValid")
    contract_valid = (
        contract_valid_value if isinstance(contract_valid_value, bool) else None
    )
    valid_value = runtime_payload.get("valid")
    valid = valid_value if isinstance(valid_value, bool) else None

    command = runtime_payload.get("command")
    if not isinstance(command, str) or not command.strip():
        if isinstance(fallback_command, str) and fallback_command.strip():
            command = fallback_command.strip()
        else:
            command = None
    else:
        command = command.strip()

    artifact_path = runtime_payload.get("artifactPath")
    if not isinstance(artifact_path, str) or not artifact_path.strip():
        artifact_path = None
    else:
        artifact_path = artifact_path.strip()

    generated_at = runtime_payload.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at.strip():
        generated_at = None
    else:
        generated_at = generated_at.strip()

    validated_at = runtime_payload.get("validatedAt")
    if not isinstance(validated_at, str) or not validated_at.strip():
        validated_at = None
    else:
        validated_at = validated_at.strip()

    missing_checks = _coerce_payload_map(runtime_payload.get("missingChecks"))
    missing_commands = _normalize_string_list(missing_checks.get("commands"))
    missing_workspace = _normalize_string_list(missing_checks.get("workspace"))
    missing_check_count = _coerce_non_negative_int(
        runtime_payload.get("missingCheckCount"),
        len(missing_commands) + len(missing_workspace),
    )

    return {
        "present": bool(present),
        "available": available,
        "passed": passed,
        "contractValid": contract_valid,
        "valid": valid,
        "missingCheckCount": missing_check_count,
        "missingChecks": {
            "commands": missing_commands,
            "workspace": missing_workspace,
        },
        "artifactPath": artifact_path,
        "generatedAt": generated_at,
        "validatedAt": validated_at,
        "command": command,
    }


def _runtime_prereqs_needs_remediation(runtime_prereqs: Dict[str, Any]) -> bool:
    if runtime_prereqs.get("present") is not True:
        return False
    if runtime_prereqs.get("available") is not True:
        return True
    if runtime_prereqs.get("passed") is not True:
        return True
    if runtime_prereqs.get("contractValid") is not True:
        return True
    if runtime_prereqs.get("valid") is not True:
        return True
    return (
        _coerce_non_negative_int(runtime_prereqs.get("missingCheckCount"), fallback=0)
        > 0
    )


def _resolve_baseline_runtime_prereqs_rollup() -> Dict[str, Any]:
    artifact_path = BASELINE_METRICS_ARTIFACT_PATH
    fallback_rollup = _normalize_runtime_prereqs_rollup(
        payload={},
        present=False,
        fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
    )
    fallback_rollup["artifactPath"] = str(artifact_path)

    if not artifact_path.exists():
        return fallback_rollup
    try:
        raw_payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback_rollup
    if not isinstance(raw_payload, dict):
        return fallback_rollup

    rollup = _normalize_runtime_prereqs_rollup(
        payload=raw_payload.get("runtimePrereqs"),
        present="runtimePrereqs" in raw_payload,
        fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
    )
    if not rollup.get("artifactPath"):
        rollup["artifactPath"] = str(artifact_path)
    return rollup


def _coerce_int_with_bounds(
    value: Any,
    fallback: int,
    minimum: Optional[int] = None,
    maximum: Optional[int] = None,
) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        normalized = int(fallback)
    if minimum is not None and normalized < minimum:
        normalized = minimum
    if maximum is not None and normalized > maximum:
        normalized = maximum
    return normalized


def _serialize_validation_received(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        if isinstance(value, float):
            if math.isnan(value) or math.isinf(value):
                return str(value)
        return value
    return str(type(value).__name__)


def _build_connector_input_validation_detail(
    field_name: str,
    minimum: int,
    maximum: int,
    raw_value: Any,
    reason: str,
) -> Dict[str, Any]:
    return {
        "errorCode": CONNECTOR_INPUT_VALIDATION_ERROR_CODE,
        "message": f"Invalid {field_name}: expected integer between {minimum} and {maximum}",
        "field": field_name,
        "min": minimum,
        "max": maximum,
        "reason": reason,
        "received": _serialize_validation_received(raw_value),
    }


def _build_connector_required_input_detail(
    field_name: str,
    message: str,
    raw_value: Any = None,
) -> Dict[str, Any]:
    return {
        "errorCode": CONNECTOR_REQUIRED_INPUT_ERROR_CODE,
        "message": message,
        "field": field_name,
        "reason": "required",
        "received": _serialize_validation_received(raw_value),
    }


async def _record_connector_input_validation_failure(
    *,
    db: Any,
    user_id: str,
    provider: str,
    endpoint: str,
    detail: Dict[str, Any],
    request_id: Optional[str],
) -> None:
    payload = {
        "provider": provider,
        "endpoint": endpoint,
        "error_code": detail.get("errorCode"),
        "message": detail.get("message"),
        "field": detail.get("field"),
        "reason": detail.get("reason"),
        "received": detail.get("received"),
        "minimum": detail.get("min"),
        "maximum": detail.get("max"),
    }
    _log_integration_event(
        CONNECTOR_INPUT_VALIDATION_FAILED_EVENT_TYPE,
        payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db,
        CONNECTOR_INPUT_VALIDATION_FAILED_EVENT_TYPE,
        user_id,
        payload,
        request_id=request_id,
    )


def _parse_request_bounded_int(
    request: Dict[str, Any],
    field_name: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw_value = request.get(field_name, default)
    if isinstance(raw_value, bool):
        raise HTTPException(
            status_code=400,
            detail=_build_connector_input_validation_detail(
                field_name=field_name,
                minimum=minimum,
                maximum=maximum,
                raw_value=raw_value,
                reason="type",
            ),
        )
    try:
        normalized = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=_build_connector_input_validation_detail(
                field_name=field_name,
                minimum=minimum,
                maximum=maximum,
                raw_value=raw_value,
                reason="type",
            ),
        ) from exc
    if normalized < minimum or normalized > maximum:
        raise HTTPException(
            status_code=400,
            detail=_build_connector_input_validation_detail(
                field_name=field_name,
                minimum=minimum,
                maximum=maximum,
                raw_value=raw_value,
                reason="range",
            ),
        )
    return normalized


async def _parse_connector_request_bounded_int(
    *,
    db: Any,
    user_id: str,
    provider: str,
    endpoint: str,
    request: Dict[str, Any],
    field_name: str,
    default: int,
    minimum: int,
    maximum: int,
    request_id: Optional[str],
) -> int:
    try:
        return _parse_request_bounded_int(
            request=request,
            field_name=field_name,
            default=default,
            minimum=minimum,
            maximum=maximum,
        )
    except HTTPException as exc:
        if exc.status_code == 400 and isinstance(exc.detail, dict):
            await _record_connector_input_validation_failure(
                db=db,
                user_id=user_id,
                provider=provider,
                endpoint=endpoint,
                detail=exc.detail,
                request_id=request_id,
            )
        raise


async def _raise_connector_required_input_error(
    *,
    db: Any,
    user_id: str,
    provider: str,
    endpoint: str,
    field_name: str,
    message: str,
    request_id: Optional[str],
    raw_value: Any = None,
) -> None:
    detail = _build_connector_required_input_detail(
        field_name=field_name,
        message=message,
        raw_value=raw_value,
    )
    await _record_connector_input_validation_failure(
        db=db,
        user_id=user_id,
        provider=provider,
        endpoint=endpoint,
        detail=detail,
        request_id=request_id,
    )
    raise HTTPException(status_code=400, detail=detail)


def _resolve_connector_rate_limit_policy() -> Dict[str, int]:
    window_seconds = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_RATE_LIMIT_WINDOW_SECONDS"),
        fallback=CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_DEFAULT,
        minimum=CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_MIN,
    )
    max_requests = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_RATE_LIMIT_MAX_REQUESTS"),
        fallback=CONNECTOR_RATE_LIMIT_MAX_REQUESTS_DEFAULT,
        minimum=CONNECTOR_RATE_LIMIT_MAX_REQUESTS_MIN,
    )
    return {
        "windowSeconds": window_seconds,
        "maxRequests": max_requests,
    }


TRACEABILITY_DECISION_ALLOWED_TOKENS = {"HOLD", "PROCEED"}
GOVERNANCE_STATUS_ALLOWED_TOKENS = {"READY", "ACTION_REQUIRED", "PASS", "FAIL"}


def _resolve_connector_persist_policy() -> Dict[str, int]:
    max_bytes = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_PERSIST_MAX_BYTES"),
        fallback=CONNECTOR_PERSIST_MAX_BYTES_DEFAULT,
        minimum=CONNECTOR_PERSIST_MAX_BYTES_MIN,
        maximum=CONNECTOR_PERSIST_MAX_BYTES_MAX,
    )
    preview_chars = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_PERSIST_PREVIEW_CHARS"),
        fallback=CONNECTOR_PERSIST_PREVIEW_CHARS_DEFAULT,
        minimum=CONNECTOR_PERSIST_PREVIEW_CHARS_MIN,
        maximum=max_bytes,
    )
    return {
        "maxBytes": max_bytes,
        "previewChars": preview_chars,
    }


def _storage_payload_bytes(payload: Any) -> int:
    try:
        serialized = json.dumps(payload, default=str, ensure_ascii=False)
    except Exception:
        serialized = json.dumps(str(payload), default=str, ensure_ascii=False)
    return len(serialized.encode("utf-8"))


def _normalize_payload_for_storage(payload: Any) -> Dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        return {"items": payload}
    return {"value": payload}


def _build_storage_payload_preview(value: Any, preview_chars: int) -> str:
    try:
        serialized = json.dumps(value, default=str, ensure_ascii=False)
    except Exception:
        serialized = str(value)
    return serialized[:preview_chars]


def _apply_storage_payload_policy(
    payload: Any,
    max_bytes: int,
    preview_chars: int,
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    normalized_payload = _normalize_payload_for_storage(payload)
    original_bytes = _storage_payload_bytes(normalized_payload)
    if original_bytes <= max_bytes:
        return normalized_payload, {
            "truncated": False,
            "originalBytes": original_bytes,
            "storedBytes": original_bytes,
            "maxBytes": max_bytes,
            "previewChars": preview_chars,
        }

    truncated_payload: Dict[str, Any] = {
        "truncated": True,
        "reason": "max_bytes_exceeded",
        "originalBytes": original_bytes,
        "maxBytes": max_bytes,
        "preview": _build_storage_payload_preview(normalized_payload, preview_chars),
    }
    stored_bytes = _storage_payload_bytes(truncated_payload)
    return truncated_payload, {
        "truncated": True,
        "originalBytes": original_bytes,
        "storedBytes": stored_bytes,
        "maxBytes": max_bytes,
        "previewChars": preview_chars,
    }


def _build_connector_rate_limit_key(user_id: str, endpoint_key: str) -> str:
    normalized_endpoint = _normalize_connector_rate_limit_endpoint_key(endpoint_key)
    return f"{str(user_id).strip()}::{normalized_endpoint}"


def _build_connector_rate_limit_headers(
    *,
    max_requests: int,
    remaining_requests: int,
    window_seconds: int,
    retry_after_seconds: Optional[int] = None,
    reset_in_seconds: Optional[int] = None,
) -> Dict[str, str]:
    headers: Dict[str, str] = {
        "X-RateLimit-Limit": str(max_requests),
        "X-RateLimit-Remaining": str(max(0, remaining_requests)),
        "X-RateLimit-Window-Seconds": str(window_seconds),
    }
    if retry_after_seconds is not None and retry_after_seconds > 0:
        headers["Retry-After"] = str(retry_after_seconds)
    if reset_in_seconds is not None and reset_in_seconds > 0:
        headers["X-RateLimit-Reset-In-Seconds"] = str(reset_in_seconds)
    return headers


def _apply_rate_limit_headers(
    response: Optional[Response],
    rate_limit: Optional[Dict[str, Any]],
) -> None:
    if response is None or not isinstance(rate_limit, dict):
        return
    max_requests = _coerce_int_with_bounds(
        rate_limit.get("limit"),
        fallback=CONNECTOR_RATE_LIMIT_MAX_REQUESTS_DEFAULT,
        minimum=CONNECTOR_RATE_LIMIT_MAX_REQUESTS_MIN,
    )
    remaining_requests = _coerce_non_negative_int(
        rate_limit.get("remaining"),
        fallback=max_requests,
    )
    window_seconds = _coerce_int_with_bounds(
        rate_limit.get("windowSeconds"),
        fallback=CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_DEFAULT,
        minimum=CONNECTOR_RATE_LIMIT_WINDOW_SECONDS_MIN,
    )
    reset_in_seconds = _coerce_non_negative_int(
        rate_limit.get("resetInSeconds"),
        fallback=0,
    )
    for header_name, header_value in _build_connector_rate_limit_headers(
        max_requests=max_requests,
        remaining_requests=remaining_requests,
        window_seconds=window_seconds,
        reset_in_seconds=reset_in_seconds,
    ).items():
        response.headers[header_name] = header_value
    reset_at = rate_limit.get("resetAt")
    if isinstance(reset_at, str) and reset_at.strip():
        response.headers["X-RateLimit-Reset-At"] = reset_at.strip()


def _reset_connector_rate_limit_state() -> None:
    _CONNECTOR_RATE_LIMIT_STATE.clear()


async def _enforce_connector_rate_limit(
    db,
    user_id: str,
    endpoint_key: str,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    normalized_endpoint_key = _normalize_connector_rate_limit_endpoint_key(endpoint_key)
    policy = _resolve_connector_rate_limit_policy()
    window_seconds = policy["windowSeconds"]
    max_requests = policy["maxRequests"]
    state_key = _build_connector_rate_limit_key(user_id, normalized_endpoint_key)
    now_seconds = time.time()
    window_start = now_seconds - float(window_seconds)

    existing = _CONNECTOR_RATE_LIMIT_STATE.get(state_key, [])
    recent = [value for value in existing if value >= window_start]
    if len(recent) >= max_requests:
        oldest = recent[0]
        retry_after_seconds = max(
            1,
            int(round((oldest + float(window_seconds)) - now_seconds)),
        )
        detail_message = (
            f"Connector rate limit exceeded for {normalized_endpoint_key}. "
            f"Retry in {retry_after_seconds} seconds."
        )
        payload = {
            "endpoint": normalized_endpoint_key,
            "window_seconds": window_seconds,
            "max_requests": max_requests,
            "retry_after_seconds": retry_after_seconds,
            "reset_in_seconds": retry_after_seconds,
        }
        _log_integration_event(
            CONNECTOR_RATE_LIMIT_EVENT_TYPE,
            payload,
            request_id=request_id,
        )
        await _record_integration_event(
            db=db,
            event_type=CONNECTOR_RATE_LIMIT_EVENT_TYPE,
            user_id=user_id,
            payload=payload,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=429,
            detail={
                "errorCode": CONNECTOR_RATE_LIMIT_ERROR_CODE,
                "message": detail_message,
                "endpoint": normalized_endpoint_key,
                "retryAfterSeconds": retry_after_seconds,
                "rateLimit": {
                    "windowSeconds": window_seconds,
                    "limit": max_requests,
                    "remaining": 0,
                    "retryAfterSeconds": retry_after_seconds,
                    "resetInSeconds": retry_after_seconds,
                },
            },
            headers=_build_connector_rate_limit_headers(
                max_requests=max_requests,
                remaining_requests=0,
                window_seconds=window_seconds,
                retry_after_seconds=retry_after_seconds,
                reset_in_seconds=retry_after_seconds,
            ),
        )

    recent.append(now_seconds)
    oldest = recent[0]
    reset_at = datetime.fromtimestamp(
        oldest + float(window_seconds),
        tz=timezone.utc,
    )
    reset_in_seconds = max(
        1,
        int(round((oldest + float(window_seconds)) - now_seconds)),
    )
    _CONNECTOR_RATE_LIMIT_STATE[state_key] = recent
    return {
        "windowSeconds": window_seconds,
        "limit": max_requests,
        "remaining": max(0, max_requests - len(recent)),
        "resetAt": reset_at.isoformat(),
        "resetInSeconds": reset_in_seconds,
    }


def _build_company_research_storage_policy(
    company_payload: Any,
    raw_payload: Any,
) -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    persist_policy = _resolve_connector_persist_policy()
    max_bytes = persist_policy["maxBytes"]
    preview_chars = persist_policy["previewChars"]
    stored_company, company_policy = _apply_storage_payload_policy(
        company_payload,
        max_bytes=max_bytes,
        preview_chars=preview_chars,
    )
    stored_raw, raw_policy = _apply_storage_payload_policy(
        raw_payload,
        max_bytes=max_bytes,
        preview_chars=preview_chars,
    )
    storage_policy = {
        "maxBytes": max_bytes,
        "previewChars": preview_chars,
        "enrichedData": company_policy,
        "rawData": raw_policy,
        "truncated": bool(company_policy["truncated"] or raw_policy["truncated"]),
    }
    return stored_company, stored_raw, storage_policy


def _has_packet_validation_marker(payload: Dict[str, Any]) -> bool:
    packet_validation_status = payload.get("governance_packet_validation_status")
    packet_validation_within_freshness = payload.get(
        "governance_packet_validation_within_freshness"
    )
    return _normalize_optional_status_token(packet_validation_status) is not None or isinstance(
        packet_validation_within_freshness, bool
    )


def _resolve_event_schema_version(event: Dict[str, Any], payload: Dict[str, Any]) -> Any:
    event_schema_version = event.get("schemaVersion")
    if event_schema_version is not None:
        return event_schema_version
    return payload.get("schema_version")


def _resolve_event_request_id(
    event: Dict[str, Any],
    payload: Dict[str, Any],
) -> Optional[str]:
    candidate = event.get("requestId")
    if candidate is None:
        candidate = payload.get("request_id")
    if candidate is None:
        return None
    normalized = str(candidate).strip()
    if not normalized:
        return None
    return normalized[:128]


def _resolve_event_governance_status(
    event: Dict[str, Any],
    payload: Dict[str, Any],
) -> Optional[str]:
    normalized = _normalize_optional_status_token(event.get("governanceStatus"))
    if normalized is not None:
        return normalized
    return _normalize_optional_status_token(payload.get("status"))


def _resolve_event_packet_validation_status(
    event: Dict[str, Any],
    payload: Dict[str, Any],
) -> Optional[str]:
    normalized = _normalize_optional_status_token(
        event.get("governancePacketValidationStatus")
    )
    if normalized is not None:
        return normalized
    return _normalize_optional_status_token(
        payload.get("governance_packet_validation_status")
    )


def _resolve_event_packet_validation_within_freshness(
    event: Dict[str, Any],
    payload: Dict[str, Any],
) -> Optional[bool]:
    event_value = event.get("governancePacketValidationWithinFreshness")
    if isinstance(event_value, bool):
        return event_value
    payload_value = payload.get("governance_packet_validation_within_freshness")
    if isinstance(payload_value, bool):
        return payload_value
    return None


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


def _resolve_connector_credential_age_policy() -> Dict[str, int]:
    configured_max_age_days = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS"),
        fallback=CONNECTOR_CREDENTIAL_MAX_AGE_DAYS_DEFAULT,
        minimum=CONNECTOR_CREDENTIAL_AGE_DAYS_MIN,
    )
    rotation_max_age_days = _coerce_int_with_bounds(
        os.environ.get("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS"),
        fallback=CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS_DEFAULT,
        minimum=CONNECTOR_CREDENTIAL_AGE_DAYS_MIN,
    )
    return {
        "configuredMaxAgeDays": configured_max_age_days,
        "rotationMaxAgeDays": rotation_max_age_days,
    }


def _credential_age_days(value: Any, now: datetime) -> Optional[int]:
    parsed = _parse_iso_datetime(str(value) if value is not None else None)
    if parsed is None:
        return None
    delta = now - parsed
    if delta.total_seconds() < 0:
        return 0
    return int(delta.total_seconds() // 86400)


def _load_snapshot_generated_at(path: Path) -> Optional[datetime]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    payload_map = _coerce_payload_map(payload)
    return _parse_iso_datetime(payload_map.get("generatedAt"))


def _load_governance_report_generated_at(path: Path) -> Optional[datetime]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    payload_map = _coerce_payload_map(payload)
    return _parse_iso_datetime(payload_map.get("generatedAt"))


def _load_governance_packet_validation_posture(path: Path, now: datetime) -> Dict[str, Any]:
    posture: Dict[str, Any] = {
        "path": str(path),
        "exists": path.exists(),
        "status": "ACTION_REQUIRED",
        "validatedAt": None,
        "ageHours": None,
        "freshnessWindowHours": GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS,
        "withinFreshnessWindow": False,
        "valid": False,
        "issues": [],
    }

    if not path.exists():
        posture["issues"].append("Governance packet validation artifact is missing.")
        return posture

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        posture["issues"].append("Governance packet validation artifact is not valid JSON.")
        return posture

    if not isinstance(payload, dict):
        posture["issues"].append("Governance packet validation artifact must be a JSON object.")
        return posture

    posture["valid"] = payload.get("valid") is True
    if not posture["valid"]:
        posture["issues"].append(
            "Governance packet validation artifact must indicate valid=true."
        )

    checks = payload.get("checks")
    if not isinstance(checks, dict):
        posture["issues"].append(
            "Governance packet validation artifact is missing checks payload."
        )

    errors = payload.get("errors")
    if not isinstance(errors, list):
        posture["issues"].append(
            "Governance packet validation artifact is missing errors list."
        )
    elif len(errors) > 0:
        posture["issues"].append(
            "Governance packet validation artifact reports validation errors."
        )

    validated_at = _parse_iso_datetime(payload.get("validatedAt"))
    if not validated_at:
        posture["issues"].append(
            "Governance packet validation artifact is missing a valid validatedAt timestamp."
        )
    else:
        posture["validatedAt"] = validated_at.isoformat()
        age_hours = round((now - validated_at).total_seconds() / 3600.0, 3)
        posture["ageHours"] = age_hours
        if age_hours < 0:
            posture["issues"].append(
                "Governance packet validation artifact validatedAt cannot be in the future."
            )
        else:
            posture["withinFreshnessWindow"] = (
                age_hours <= GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS
            )
            if not posture["withinFreshnessWindow"]:
                posture["issues"].append(
                    "Governance packet validation artifact is outside freshness window."
                )

    if len(posture["issues"]) == 0:
        posture["status"] = "READY"

    return posture


def _is_internal_traceability_event(event_type: str) -> bool:
    normalized = str(event_type or "").strip().lower()
    return normalized in {
        TRACEABILITY_AUDIT_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_EVENT_TYPE,
        TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_REPORT_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_REPORT_EXPORT_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_REPORT_HISTORY_EVENT_TYPE,
        TRACEABILITY_GOVERNANCE_SCHEMA_EVENT_TYPE,
    }


def _is_retryable_error(error: Exception) -> bool:
    return _classify_retry_error(error).get("retryable") is True


def _extract_retry_error_status_code(error: Exception) -> Optional[int]:
    if isinstance(error, HTTPException):
        status_code = _coerce_non_negative_int_optional_strict(error.status_code)
        if status_code is not None:
            return status_code
    response = getattr(error, "response", None)
    response_status = getattr(response, "status_code", None)
    status_code = _coerce_non_negative_int_optional_strict(response_status)
    if status_code is not None:
        return status_code

    message = str(error).lower()
    for marker in ["429", "500", "502", "503", "504"]:
        if marker in message:
            return int(marker)
    return None


def _classify_retry_error(error: Exception) -> Dict[str, Any]:
    message = str(error).lower()
    status_code = _extract_retry_error_status_code(error)
    retryable_markers = [
        "timeout",
        "temporarily unavailable",
        "connection reset",
        "too many requests",
        "connection aborted",
        "connection refused",
    ]
    retryable_status_codes = {429, 500, 502, 503, 504}
    retryable = False
    reason_code = "non_retryable_error"
    if status_code in retryable_status_codes:
        retryable = True
        reason_code = f"http_{status_code}"
    elif any(marker in message for marker in retryable_markers):
        retryable = True
        if "timeout" in message:
            reason_code = "timeout"
        elif "too many requests" in message:
            reason_code = "rate_limited"
        elif "connection reset" in message:
            reason_code = "connection_reset"
        elif "temporarily unavailable" in message:
            reason_code = "temporarily_unavailable"
        elif "connection refused" in message:
            reason_code = "connection_refused"
        elif "connection aborted" in message:
            reason_code = "connection_aborted"
        else:
            reason_code = "transient_error"
    elif isinstance(error, HTTPException):
        reason_code = "http_exception"
    elif status_code is not None:
        reason_code = f"http_{status_code}"
    return {
        "retryable": retryable,
        "status_code": status_code,
        "reason_code": reason_code,
        "error_type": type(error).__name__,
    }


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
    max_delay_seconds: float = INTEGRATION_RETRY_MAX_DELAY_SECONDS,
    jitter_seconds: float = INTEGRATION_RETRY_JITTER_SECONDS,
    operation_name: Optional[str] = None,
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    on_retry_attempt: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    on_retry_terminal_event: Optional[
        Callable[[str, Dict[str, Any]], Awaitable[None]]
    ] = None,
):
    last_error: Exception = None
    normalized_operation_name = str(operation_name or "integration_operation").strip()
    if not normalized_operation_name:
        normalized_operation_name = "integration_operation"
    normalized_provider = str(provider or "").strip().lower() or None
    for attempt in range(1, max_attempts + 1):
        try:
            return await operation()
        except Exception as exc:
            last_error = exc
            error_meta = _classify_retry_error(exc)
            retryable_error = error_meta.get("retryable") is True
            if attempt == max_attempts or not retryable_error:
                terminal_event_type = (
                    INTEGRATION_RETRY_EXHAUSTED_EVENT_TYPE
                    if retryable_error
                    else INTEGRATION_RETRY_FAIL_FAST_EVENT_TYPE
                )
                terminal_payload: Dict[str, Any] = {
                    "operation": normalized_operation_name,
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "error": str(exc),
                    "retryable": retryable_error,
                    "final_outcome": (
                        "retry_exhausted" if retryable_error else "fail_fast"
                    ),
                    "error_reason_code": error_meta.get("reason_code"),
                    "error_type": error_meta.get("error_type"),
                }
                status_code = error_meta.get("status_code")
                if isinstance(status_code, int):
                    terminal_payload["error_status_code"] = status_code
                if normalized_provider:
                    terminal_payload["provider"] = normalized_provider
                _log_integration_event(
                    terminal_event_type,
                    terminal_payload,
                    request_id=request_id,
                )
                if on_retry_terminal_event is not None:
                    await on_retry_terminal_event(terminal_event_type, terminal_payload)
                raise
            retry_delay_seconds = _resolve_retry_delay_seconds(
                attempt=attempt,
                base_delay_seconds=base_delay_seconds,
                max_delay_seconds=max_delay_seconds,
                jitter_seconds=jitter_seconds,
            )
            retry_payload: Dict[str, Any] = {
                "operation": normalized_operation_name,
                "attempt": attempt,
                "max_attempts": max_attempts,
                "next_delay_seconds": round(float(retry_delay_seconds), 3),
                "error": str(exc),
            }
            if normalized_provider:
                retry_payload["provider"] = normalized_provider
            _log_integration_event(
                INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE,
                retry_payload,
                request_id=request_id,
            )
            if on_retry_attempt is not None:
                await on_retry_attempt(retry_payload)
            await asyncio.sleep(retry_delay_seconds)
    raise last_error


def _resolve_retry_delay_seconds(
    attempt: int,
    base_delay_seconds: float,
    max_delay_seconds: float,
    jitter_seconds: float,
) -> float:
    normalized_attempt = max(int(attempt), 1)
    normalized_base_delay = max(float(base_delay_seconds), 0.0)
    normalized_max_delay = max(float(max_delay_seconds), 0.0)
    exponential_delay = normalized_base_delay * (2 ** (normalized_attempt - 1))
    delay_seconds = min(exponential_delay, normalized_max_delay)
    normalized_jitter = max(float(jitter_seconds), 0.0)
    if normalized_jitter > 0:
        delay_seconds = min(
            delay_seconds + random.uniform(0.0, normalized_jitter),
            normalized_max_delay,
        )
    return max(delay_seconds, 0.0)


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

    request_id_value = _resolve_event_request_id({}, safe_payload)
    schema_version_value = safe_payload.get("schema_version")
    governance_status_value = _normalize_optional_status_token(safe_payload.get("status"))
    packet_validation_status_value = _normalize_optional_status_token(
        safe_payload.get("governance_packet_validation_status")
    )
    packet_validation_within_freshness_value = safe_payload.get(
        "governance_packet_validation_within_freshness"
    )
    if not isinstance(packet_validation_within_freshness_value, bool):
        packet_validation_within_freshness_value = None

    provider = event_type.split("_", 1)[0] if "_" in event_type else "integration"
    event_doc = {
        "id": str(uuid4()),
        "userId": user_id,
        "provider": provider,
        "eventType": event_type,
        "payload": safe_payload,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "requestId": request_id_value,
        "schemaVersion": schema_version_value,
        "governanceStatus": governance_status_value,
        "governancePacketValidationStatus": packet_validation_status_value,
        "governancePacketValidationWithinFreshness": packet_validation_within_freshness_value,
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


def _normalize_sendgrid_event_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    return normalized if normalized else "unknown"


def _normalize_sendgrid_timestamp_pressure_label(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized == "high":
        return "High"
    if normalized == "moderate":
        return "Moderate"
    if normalized == "low":
        return "Low"
    return "Unknown"


def _normalize_sendgrid_timestamp_bucket_key(value: Any) -> Optional[str]:
    normalized = re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip(
        "_"
    )
    return normalized or None


def _is_sendgrid_update_event_type(event_type: str) -> bool:
    normalized = _normalize_sendgrid_event_type(event_type)
    return normalized in {"open", "click", "delivered", "bounce", "spamreport"}


def _normalize_sendgrid_send_id(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _resolve_sendgrid_send_id(event: Dict[str, Any]) -> Optional[str]:
    event_payload = event if isinstance(event, dict) else {}
    direct_send_id = _normalize_sendgrid_send_id(event_payload.get("send_id"))
    if direct_send_id:
        return direct_send_id
    sg_message_id = _normalize_sendgrid_send_id(event_payload.get("sg_message_id"))
    if not sg_message_id:
        return None
    return _normalize_sendgrid_send_id(sg_message_id.split(".", 1)[0])


def _normalize_sendgrid_event_timestamp(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()

    numeric_value: Optional[float] = None
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        parsed_iso = _parse_iso_datetime(normalized)
        if parsed_iso is not None:
            return parsed_iso.isoformat()
        try:
            numeric_value = float(normalized)
        except ValueError:
            return None
    elif isinstance(value, (int, float)):
        numeric_value = float(value)
    else:
        return None

    if numeric_value is None or math.isnan(numeric_value) or math.isinf(numeric_value):
        return None

    seconds = numeric_value
    if abs(seconds) >= SENDGRID_EVENT_TIMESTAMP_MILLISECONDS_THRESHOLD:
        seconds = seconds / 1000.0
    try:
        parsed = datetime.fromtimestamp(seconds, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None
    return parsed.isoformat()


def _classify_sendgrid_event_timestamp_posture(
    timestamp_iso: Optional[str],
    now: Optional[datetime] = None,
) -> str:
    parsed = _parse_iso_datetime(timestamp_iso)
    if parsed is None:
        return "fallback"
    now_utc = now or datetime.now(timezone.utc)
    future_boundary = now_utc + timedelta(seconds=SENDGRID_WEBHOOK_FUTURE_SKEW_SECONDS)
    if parsed > future_boundary:
        return "future_skew"
    age_seconds = (now_utc - parsed).total_seconds()
    if age_seconds > SENDGRID_WEBHOOK_STALE_EVENT_AGE_SECONDS:
        return "stale"
    if age_seconds < 3600:
        return "fresh_lt_1h"
    return "fresh_1h_to_24h"


def _resolve_dominant_count_entry(
    counts: Dict[str, int],
) -> Tuple[Optional[str], int]:
    filtered = {
        str(key): int(value)
        for key, value in counts.items()
        if isinstance(value, int) and value > 0
    }
    if not filtered:
        return None, 0
    dominant_key, dominant_count = sorted(
        filtered.items(),
        key=lambda item: (-item[1], item[0]),
    )[0]
    return dominant_key, int(dominant_count)


def _resolve_sendgrid_timestamp_pressure_hint(
    label: str,
    anomaly_count: int,
    anomaly_rate_pct: float,
) -> str:
    if label == "High":
        return (
            "Timestamp anomaly pressure is high; investigate sender clock skew, "
            "event replay delay, and webhook ingestion lag before rollout expansion."
        )
    if label == "Moderate":
        return (
            "Timestamp anomaly pressure is moderate; continue rollout in guarded mode "
            "and monitor webhook timestamp drift trends."
        )
    if label == "Low":
        return (
            f"Timestamp anomaly pressure is low ({anomaly_count} anomalies, "
            f"{anomaly_rate_pct:.2f}% of received events)."
        )
    return "No timestamp anomalies detected in received webhook events."


def _resolve_sendgrid_timestamp_pressure(
    received_count: int,
    future_skew_event_count: int,
    stale_event_count: int,
    timestamp_fallback_count: int,
) -> Dict[str, Any]:
    anomalies = max(0, future_skew_event_count) + max(0, stale_event_count) + max(
        0, timestamp_fallback_count
    )
    denominator = max(1, received_count)
    anomaly_rate_pct = round((float(anomalies) * 100.0) / float(denominator), 2)
    if (
        anomalies >= SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_COUNT
        or anomaly_rate_pct >= SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_RATE_PCT
    ):
        label = "High"
    elif (
        anomalies >= SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_COUNT
        or anomaly_rate_pct
        >= SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_RATE_PCT
    ):
        label = "Moderate"
    elif anomalies > 0:
        label = "Low"
    else:
        label = "Unknown"
    return {
        "label": label,
        "anomalyCount": int(anomalies),
        "anomalyRatePct": anomaly_rate_pct,
        "highAnomalyRatePct": SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_RATE_PCT,
        "moderateAnomalyRatePct": (
            SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_RATE_PCT
        ),
        "highAnomalyCount": SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_HIGH_ANOMALY_COUNT,
        "moderateAnomalyCount": (
            SENDGRID_WEBHOOK_TIMESTAMP_PRESSURE_MODERATE_ANOMALY_COUNT
        ),
        "hint": _resolve_sendgrid_timestamp_pressure_hint(
            label,
            int(anomalies),
            anomaly_rate_pct,
        ),
    }


def _build_sendgrid_dedup_key(
    event: Dict[str, Any],
    event_type: Optional[str],
    send_id: Optional[str],
) -> str:
    event_payload = event if isinstance(event, dict) else {}
    normalized_event_type = _normalize_sendgrid_event_type(event_type)
    normalized_send_id = _normalize_sendgrid_send_id(send_id)
    normalized_timestamp = _normalize_sendgrid_event_timestamp(
        event_payload.get("timestamp")
    )
    dedup_payload: Dict[str, Any] = {
        "send_id": normalized_send_id,
        "event_type": normalized_event_type,
        "timestamp": normalized_timestamp,
        "sg_event_id": event_payload.get("sg_event_id"),
        "sg_message_id": event_payload.get("sg_message_id"),
        "email": event_payload.get("email"),
        "recipient": event_payload.get("recipient"),
        "smtp_id": event_payload.get("smtp-id") or event_payload.get("smtp_id"),
    }
    if (
        not dedup_payload.get("send_id")
        and not dedup_payload.get("sg_event_id")
        and dedup_payload.get("timestamp") in (None, "")
    ):
        dedup_payload["event_fingerprint"] = hashlib.sha256(
            json.dumps(event_payload, sort_keys=True, default=str).encode("utf-8")
        ).hexdigest()

    return hashlib.sha256(
        json.dumps(dedup_payload, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()


def _normalize_domain(domain: Optional[str]) -> str:
    if not domain:
        return ""
    normalized = domain.strip().lower()
    normalized = re.sub(r"^https?://", "", normalized)
    normalized = normalized.split("/")[0]
    if normalized.startswith("www."):
        normalized = normalized[4:]
    return normalized


def _normalize_api_key(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _connector_timestamp_fields(provider: str) -> tuple[str, str]:
    normalized_provider = str(provider or "").strip().lower()
    return (
        f"{normalized_provider}_configured_at",
        f"{normalized_provider}_last_rotated_at",
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _save_connector_credential(
    db,
    user_id: str,
    provider: str,
    key_field: str,
    api_key: str,
) -> Dict[str, Any]:
    existing = await db.user_integrations.find_one(
        {"userId": user_id},
        {"_id": 0},
    ) or {}

    configured_at_field, rotated_at_field = _connector_timestamp_fields(provider)
    now_iso = _now_iso()
    existing_api_key = _normalize_api_key(existing.get(key_field))
    key_rotated = existing_api_key != api_key
    configured_at = str(existing.get(configured_at_field) or now_iso)
    last_rotated_at = (
        now_iso if key_rotated else str(existing.get(rotated_at_field) or configured_at)
    )

    await db.user_integrations.update_one(
        {"userId": user_id},
        {
            "$set": {
                "userId": user_id,
                key_field: api_key,
                configured_at_field: configured_at,
                rotated_at_field: last_rotated_at,
                "updatedAt": now_iso,
            }
        },
        upsert=True,
    )

    return {
        "provider": provider,
        "keyRotated": key_rotated,
        "configuredAt": configured_at,
        "lastRotatedAt": last_rotated_at,
    }


async def _remove_connector_credential(
    db,
    user_id: str,
    provider: str,
    key_field: str,
) -> Dict[str, Any]:
    existing = await db.user_integrations.find_one(
        {"userId": user_id},
        {"_id": 0},
    ) or {}

    configured_at_field, rotated_at_field = _connector_timestamp_fields(provider)
    had_key = bool(existing.get(key_field))
    removed_at = _now_iso()

    await db.user_integrations.update_one(
        {"userId": user_id},
        {
            "$unset": {
                key_field: "",
                configured_at_field: "",
                rotated_at_field: "",
            },
            "$set": {
                "updatedAt": removed_at,
            },
        },
    )

    return {
        "provider": provider,
        "hadKey": had_key,
        "removedAt": removed_at,
    }


async def _record_connector_credential_lifecycle(
    db,
    user_id: str,
    provider: str,
    action: str,
    request_id: Optional[str],
    connector_enabled: bool,
    key_rotated: Optional[bool] = None,
    configured_at: Optional[str] = None,
    last_rotated_at: Optional[str] = None,
    removed_at: Optional[str] = None,
    had_key: Optional[bool] = None,
) -> None:
    normalized_action = str(action or "").strip().lower()
    event_type = (
        CONNECTOR_CREDENTIAL_SAVED_EVENT_TYPE
        if normalized_action == "saved"
        else CONNECTOR_CREDENTIAL_REMOVED_EVENT_TYPE
    )
    payload: Dict[str, Any] = {
        "provider": provider,
        "action": normalized_action,
        "connector_enabled": bool(connector_enabled),
    }
    if key_rotated is not None:
        payload["key_rotated"] = bool(key_rotated)
    if configured_at:
        payload["configured_at"] = configured_at
    if last_rotated_at:
        payload["last_rotated_at"] = last_rotated_at
    if removed_at:
        payload["removed_at"] = removed_at
    if had_key is not None:
        payload["had_key"] = bool(had_key)

    _log_integration_event(event_type, payload, request_id=request_id)
    await _record_integration_event(
        db=db,
        event_type=event_type,
        user_id=user_id,
        payload=payload,
        request_id=request_id,
    )


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


def _resolve_retry_audit_slo_thresholds(
    max_retry_audit_event_count: Optional[int],
    max_retry_audit_avg_next_delay_seconds: Optional[float],
) -> tuple[int, float]:
    raw_event_count_threshold = (
        max_retry_audit_event_count
        if max_retry_audit_event_count is not None
        else os.environ.get(
            "INTEGRATION_SLO_MAX_RETRY_AUDIT_EVENT_COUNT",
            str(DEFAULT_MAX_RETRY_AUDIT_EVENT_COUNT),
        )
    )
    try:
        retry_audit_event_threshold = int(raw_event_count_threshold)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="INTEGRATION_SLO_MAX_RETRY_AUDIT_EVENT_COUNT must be an integer",
        )
    if (
        retry_audit_event_threshold < RETRY_AUDIT_EVENT_THRESHOLD_MIN
        or retry_audit_event_threshold > RETRY_AUDIT_EVENT_THRESHOLD_MAX
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_retry_audit_event_count must be between "
                f"{RETRY_AUDIT_EVENT_THRESHOLD_MIN} and {RETRY_AUDIT_EVENT_THRESHOLD_MAX}"
            ),
        )

    raw_avg_delay_threshold = (
        max_retry_audit_avg_next_delay_seconds
        if max_retry_audit_avg_next_delay_seconds is not None
        else os.environ.get(
            "INTEGRATION_SLO_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS",
            str(DEFAULT_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS),
        )
    )
    try:
        retry_audit_avg_delay_threshold = float(raw_avg_delay_threshold)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=(
                "INTEGRATION_SLO_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS must be numeric"
            ),
        )
    if (
        retry_audit_avg_delay_threshold < RETRY_AUDIT_DELAY_THRESHOLD_MIN
        or retry_audit_avg_delay_threshold > RETRY_AUDIT_DELAY_THRESHOLD_MAX
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_retry_audit_avg_next_delay_seconds must be between "
                f"{int(RETRY_AUDIT_DELAY_THRESHOLD_MIN)} and {int(RETRY_AUDIT_DELAY_THRESHOLD_MAX)}"
            ),
        )

    return int(retry_audit_event_threshold), float(retry_audit_avg_delay_threshold)


def _resolve_orchestration_audit_slo_thresholds(
    max_orchestration_attempt_error_count: Optional[int],
    max_orchestration_attempt_skipped_count: Optional[int],
) -> tuple[int, int]:
    raw_error_count_threshold = (
        max_orchestration_attempt_error_count
        if max_orchestration_attempt_error_count is not None
        else os.environ.get(
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT",
            str(DEFAULT_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT),
        )
    )
    try:
        orchestration_error_threshold = int(raw_error_count_threshold)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=(
                "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT must be an integer"
            ),
        )
    if (
        orchestration_error_threshold < ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MIN
        or orchestration_error_threshold > ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MAX
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_orchestration_attempt_error_count must be between "
                f"{ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MIN} "
                f"and {ORCHESTRATION_ATTEMPT_ERROR_THRESHOLD_MAX}"
            ),
        )

    raw_skipped_count_threshold = (
        max_orchestration_attempt_skipped_count
        if max_orchestration_attempt_skipped_count is not None
        else os.environ.get(
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT",
            str(DEFAULT_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT),
        )
    )
    try:
        orchestration_skipped_threshold = int(raw_skipped_count_threshold)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=(
                "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT must be an integer"
            ),
        )
    if (
        orchestration_skipped_threshold < ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MIN
        or orchestration_skipped_threshold > ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MAX
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                f"max_orchestration_attempt_skipped_count must be between "
                f"{ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MIN} "
                f"and {ORCHESTRATION_ATTEMPT_SKIPPED_THRESHOLD_MAX}"
            ),
        )

    return int(orchestration_error_threshold), int(orchestration_skipped_threshold)


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
        elif gate == "retry_audit_volume":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "Integrations Engineer",
                    "action": (
                        "Hold rollout expansion and reduce retry churn by validating "
                        "provider availability and retry policy thresholds."
                    ),
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "retry_audit_delay":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "On-call Engineer",
                    "action": (
                        "Hold rollout expansion and investigate elevated retry delay "
                        "durations before enabling additional tenants."
                    ),
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "orchestration_attempt_error":
            actions.append(
                {
                    "priority": "P2",
                    "ownerRole": "Integrations Engineer",
                    "action": (
                        "Hold rollout expansion, review connector fallback failures, "
                        "and reduce orchestration attempt errors before re-evaluating SLO gates."
                    ),
                    "trigger": alert.get("message"),
                }
            )
        elif gate == "orchestration_attempt_skipped":
            actions.append(
                {
                    "priority": "P3",
                    "ownerRole": "Sales Ops Lead",
                    "action": (
                        "Hold rollout expansion and remediate orchestration skip causes "
                        "(for example missing domain/lookup inputs) before canary growth."
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
        "connector_governance_weekly_report.json",
        "governance_handoff_export.json",
        "governance_history_export.json",
        "governance_packet_validation.json",
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
    normalized, _diagnostics = _normalize_provider_order_with_diagnostics(provider_order)
    return normalized


def _normalize_provider_order_with_diagnostics(
    provider_order: Any,
) -> tuple[List[str], Dict[str, Any]]:
    default_order = ["clearbit", "apollo", "crunchbase"]
    allowed = set(default_order)
    diagnostics: Dict[str, Any] = {
        "defaultApplied": False,
        "duplicatesRemoved": [],
        "ignoredProviders": [],
    }
    if not isinstance(provider_order, list):
        diagnostics["defaultApplied"] = True
        return list(default_order), diagnostics

    normalized: List[str] = []
    for provider in provider_order:
        provider_name = str(provider or "").strip().lower()
        if not provider_name:
            continue
        if provider_name not in allowed:
            if provider_name not in diagnostics["ignoredProviders"]:
                diagnostics["ignoredProviders"].append(provider_name)
            continue
        if provider_name in normalized:
            if provider_name not in diagnostics["duplicatesRemoved"]:
                diagnostics["duplicatesRemoved"].append(provider_name)
            continue
        normalized.append(provider_name)

    if not normalized:
        diagnostics["defaultApplied"] = True
        return list(default_order), diagnostics

    return normalized, diagnostics


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

    return await _retry_with_backoff(
        _request,
        operation_name=f"{provider}_request_json",
        provider=provider,
    )

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

        async def _record_retry_attempt(retry_payload: Dict[str, Any]) -> None:
            await _record_integration_event(
                db,
                INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE,
                current_user["id"],
                retry_payload,
                request_id=request_id,
            )

        async def _record_retry_terminal(
            event_type: str,
            retry_payload: Dict[str, Any],
        ) -> None:
            await _record_integration_event(
                db,
                event_type,
                current_user["id"],
                retry_payload,
                request_id=request_id,
            )

        start = time.perf_counter()
        response = await _retry_with_backoff(
            _send,
            operation_name="sendgrid_send_email",
            provider="sendgrid",
            request_id=request_id,
            on_retry_attempt=_record_retry_attempt,
            on_retry_terminal_event=_record_retry_terminal,
        )
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
    missing_send_id_for_update_count = 0
    event_type_counts: Dict[str, int] = {}
    missing_user_context_count = 0
    user_event_counts: Dict[str, int] = {}
    unknown_event_type_count = 0
    invalid_timestamp_count = 0
    timestamp_fallback_count = 0
    future_skew_event_count = 0
    stale_event_count = 0
    fresh_event_count = 0
    update_eligible_event_count = 0
    unsupported_event_type_count = 0
    unsupported_event_type_counts: Dict[str, int] = {}
    email_update_event_type_counts: Dict[str, int] = {}
    missing_send_id_by_event_type: Dict[str, int] = {}
    deduplicated_event_type_counts: Dict[str, int] = {}
    update_eligible_event_type_counts: Dict[str, int] = {}
    future_skew_event_type_counts: Dict[str, int] = {}
    stale_event_type_counts: Dict[str, int] = {}
    timestamp_fallback_event_type_counts: Dict[str, int] = {}
    timestamp_age_bucket_counts: Dict[str, int] = {
        "future_skew": 0,
        "stale": 0,
        "fresh_lt_1h": 0,
        "fresh_1h_to_24h": 0,
        "fallback": 0,
    }
    now_utc = datetime.now(timezone.utc)

    for event in events:
        event_payload = event if isinstance(event, dict) else {}
        event_type = _normalize_sendgrid_event_type(event_payload.get("event"))
        if event_type == "unknown":
            unknown_event_type_count += 1
        is_update_event_type = _is_sendgrid_update_event_type(event_type)
        send_id = _resolve_sendgrid_send_id(event_payload)
        raw_timestamp = event_payload.get("timestamp")
        timestamp = _normalize_sendgrid_event_timestamp(raw_timestamp)
        timestamp_was_provided = raw_timestamp is not None and (
            not isinstance(raw_timestamp, str) or bool(raw_timestamp.strip())
        )
        if timestamp is None:
            if timestamp_was_provided:
                invalid_timestamp_count += 1
            timestamp_fallback_count += 1
            timestamp = now_utc.isoformat()
            timestamp_posture = "fallback"
        else:
            timestamp_posture = _classify_sendgrid_event_timestamp_posture(
                timestamp,
                now=now_utc,
            )
        timestamp_age_bucket_counts[timestamp_posture] = (
            timestamp_age_bucket_counts.get(timestamp_posture, 0) + 1
        )
        if timestamp_posture == "future_skew":
            future_skew_event_count += 1
            future_skew_event_type_counts[event_type] = (
                future_skew_event_type_counts.get(event_type, 0) + 1
            )
        elif timestamp_posture == "stale":
            stale_event_count += 1
            stale_event_type_counts[event_type] = (
                stale_event_type_counts.get(event_type, 0) + 1
            )
        elif timestamp_posture == "fallback":
            timestamp_fallback_event_type_counts[event_type] = (
                timestamp_fallback_event_type_counts.get(event_type, 0) + 1
            )
        elif timestamp_posture in {"fresh_lt_1h", "fresh_1h_to_24h"}:
            fresh_event_count += 1
        dedup_key = _build_sendgrid_dedup_key(event_payload, event_type, send_id)

        existing_event = await db.integration_event_dedup.find_one({"id": dedup_key}, {"_id": 0})
        if existing_event:
            deduplicated_count += 1
            deduplicated_event_type_counts[event_type] = (
                deduplicated_event_type_counts.get(event_type, 0) + 1
            )
            continue
        await db.integration_event_dedup.insert_one(
            {
                "id": dedup_key,
                "provider": "sendgrid",
                "createdAt": timestamp,
            }
        )
        processed_count += 1
        if is_update_event_type:
            update_eligible_event_count += 1
            update_eligible_event_type_counts[event_type] = (
                update_eligible_event_type_counts.get(event_type, 0) + 1
            )
        else:
            unsupported_event_type_count += 1
            unsupported_event_type_counts[event_type] = (
                unsupported_event_type_counts.get(event_type, 0) + 1
            )
        event_type_key = event_type
        event_type_counts[event_type_key] = event_type_counts.get(event_type_key, 0) + 1
        event_user_id = _extract_sendgrid_user_id(event_payload)
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
        
        if update:
            if send_id:
                update_query: Dict[str, Any] = {"$set": update}
                if event_type == "open":
                    update_query["$inc"] = {"openCount": 1}
                elif event_type == "click":
                    update_query["$inc"] = {"clickCount": 1}

                await db.email_sends.update_one({"id": send_id}, update_query)
                email_update_count += 1
                email_update_event_type_counts[event_type] = (
                    email_update_event_type_counts.get(event_type, 0) + 1
                )
                
                # Log event for A/B testing
                await db.email_events.insert_one({
                    "id": str(uuid4()),
                    "sendId": send_id,
                    "eventType": event_type,
                    "timestamp": timestamp,
                    "rawEvent": event_payload
                })
                event_record_count += 1
            else:
                missing_send_id_for_update_count += 1
                missing_send_id_by_event_type[event_type] = (
                    missing_send_id_by_event_type.get(event_type, 0) + 1
                )

    timestamp_pressure = _resolve_sendgrid_timestamp_pressure(
        received_count=len(events),
        future_skew_event_count=future_skew_event_count,
        stale_event_count=stale_event_count,
        timestamp_fallback_count=timestamp_fallback_count,
    )
    dominant_timestamp_anomaly_bucket, dominant_timestamp_anomaly_bucket_count = (
        _resolve_dominant_count_entry(
            {
                "future_skew": future_skew_event_count,
                "stale": stale_event_count,
                "fallback": timestamp_fallback_count,
            }
        )
    )
    timestamp_anomaly_event_type_counts = {
        **future_skew_event_type_counts,
        **stale_event_type_counts,
    }
    for event_type, count in timestamp_fallback_event_type_counts.items():
        timestamp_anomaly_event_type_counts[event_type] = (
            timestamp_anomaly_event_type_counts.get(event_type, 0) + count
        )
    dominant_timestamp_anomaly_event_type, dominant_timestamp_anomaly_event_type_count = (
        _resolve_dominant_count_entry(timestamp_anomaly_event_type_counts)
    )

    _log_integration_event(
        "sendgrid_webhook_processed",
        {
            "received_count": len(events),
            "processed_count": processed_count,
            "deduplicated_count": deduplicated_count,
            "email_update_count": email_update_count,
            "event_record_count": event_record_count,
            "missing_send_id_for_update_count": missing_send_id_for_update_count,
            "event_type_counts": event_type_counts,
            "update_eligible_event_count": update_eligible_event_count,
            "update_eligible_event_type_counts": update_eligible_event_type_counts,
            "unsupported_event_type_count": unsupported_event_type_count,
            "unsupported_event_type_counts": unsupported_event_type_counts,
            "email_update_event_type_counts": email_update_event_type_counts,
            "missing_send_id_by_event_type": missing_send_id_by_event_type,
            "deduplicated_event_type_counts": deduplicated_event_type_counts,
            "user_context_count": len(user_event_counts),
            "missing_user_context_count": missing_user_context_count,
            "unknown_event_type_count": unknown_event_type_count,
            "invalid_timestamp_count": invalid_timestamp_count,
            "timestamp_fallback_count": timestamp_fallback_count,
            "future_skew_event_count": future_skew_event_count,
            "stale_event_count": stale_event_count,
            "fresh_event_count": fresh_event_count,
            "future_skew_event_type_counts": future_skew_event_type_counts,
            "stale_event_type_counts": stale_event_type_counts,
            "timestamp_fallback_event_type_counts": (
                timestamp_fallback_event_type_counts
            ),
            "timestamp_age_bucket_counts": timestamp_age_bucket_counts,
            "future_skew_threshold_seconds": SENDGRID_WEBHOOK_FUTURE_SKEW_SECONDS,
            "stale_event_age_threshold_seconds": SENDGRID_WEBHOOK_STALE_EVENT_AGE_SECONDS,
            "timestamp_pressure_label": timestamp_pressure["label"],
            "timestamp_pressure_hint": timestamp_pressure["hint"],
            "timestamp_anomaly_count": timestamp_pressure["anomalyCount"],
            "timestamp_anomaly_rate_pct": timestamp_pressure["anomalyRatePct"],
            "timestamp_pressure_high_anomaly_rate_pct": (
                timestamp_pressure["highAnomalyRatePct"]
            ),
            "timestamp_pressure_moderate_anomaly_rate_pct": (
                timestamp_pressure["moderateAnomalyRatePct"]
            ),
            "timestamp_pressure_high_anomaly_count": (
                timestamp_pressure["highAnomalyCount"]
            ),
            "timestamp_pressure_moderate_anomaly_count": (
                timestamp_pressure["moderateAnomalyCount"]
            ),
            "timestamp_anomaly_event_type_counts": timestamp_anomaly_event_type_counts,
            "timestamp_dominant_anomaly_bucket": dominant_timestamp_anomaly_bucket,
            "timestamp_dominant_anomaly_bucket_count": (
                dominant_timestamp_anomaly_bucket_count
            ),
            "timestamp_dominant_anomaly_event_type": (
                dominant_timestamp_anomaly_event_type
            ),
            "timestamp_dominant_anomaly_event_type_count": (
                dominant_timestamp_anomaly_event_type_count
            ),
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
                "missing_send_id_for_update_count": missing_send_id_for_update_count,
                "event_type_counts": event_type_counts,
                "update_eligible_event_count": update_eligible_event_count,
                "update_eligible_event_type_counts": update_eligible_event_type_counts,
                "unsupported_event_type_count": unsupported_event_type_count,
                "unsupported_event_type_counts": unsupported_event_type_counts,
                "email_update_event_type_counts": email_update_event_type_counts,
                "missing_send_id_by_event_type": missing_send_id_by_event_type,
                "deduplicated_event_type_counts": deduplicated_event_type_counts,
                "user_scoped_processed_count": scoped_count,
                "missing_user_context_count": missing_user_context_count,
                "unknown_event_type_count": unknown_event_type_count,
                "invalid_timestamp_count": invalid_timestamp_count,
                "timestamp_fallback_count": timestamp_fallback_count,
                "future_skew_event_count": future_skew_event_count,
                "stale_event_count": stale_event_count,
                "fresh_event_count": fresh_event_count,
                "future_skew_event_type_counts": future_skew_event_type_counts,
                "stale_event_type_counts": stale_event_type_counts,
                "timestamp_fallback_event_type_counts": (
                    timestamp_fallback_event_type_counts
                ),
                "timestamp_age_bucket_counts": timestamp_age_bucket_counts,
                "future_skew_threshold_seconds": SENDGRID_WEBHOOK_FUTURE_SKEW_SECONDS,
                "stale_event_age_threshold_seconds": SENDGRID_WEBHOOK_STALE_EVENT_AGE_SECONDS,
                "timestamp_pressure_label": timestamp_pressure["label"],
                "timestamp_pressure_hint": timestamp_pressure["hint"],
                "timestamp_anomaly_count": timestamp_pressure["anomalyCount"],
                "timestamp_anomaly_rate_pct": timestamp_pressure["anomalyRatePct"],
                "timestamp_pressure_high_anomaly_rate_pct": (
                    timestamp_pressure["highAnomalyRatePct"]
                ),
                "timestamp_pressure_moderate_anomaly_rate_pct": (
                    timestamp_pressure["moderateAnomalyRatePct"]
                ),
                "timestamp_pressure_high_anomaly_count": (
                    timestamp_pressure["highAnomalyCount"]
                ),
                "timestamp_pressure_moderate_anomaly_count": (
                    timestamp_pressure["moderateAnomalyCount"]
                ),
                "timestamp_anomaly_event_type_counts": (
                    timestamp_anomaly_event_type_counts
                ),
                "timestamp_dominant_anomaly_bucket": dominant_timestamp_anomaly_bucket,
                "timestamp_dominant_anomaly_bucket_count": (
                    dominant_timestamp_anomaly_bucket_count
                ),
                "timestamp_dominant_anomaly_event_type": (
                    dominant_timestamp_anomaly_event_type
                ),
                "timestamp_dominant_anomaly_event_type_count": (
                    dominant_timestamp_anomaly_event_type_count
                ),
            },
            request_id=request_id,
        )

    return {
        "received": len(events),
        "processed": processed_count,
        "deduplicated": deduplicated_count,
        "emailUpdates": email_update_count,
        "eventRecords": event_record_count,
        "missingSendIdForUpdate": missing_send_id_for_update_count,
        "eventTypeCounts": event_type_counts,
        "updateEligibleEventCount": update_eligible_event_count,
        "updateEligibleEventTypeCounts": update_eligible_event_type_counts,
        "unsupportedEventTypeCount": unsupported_event_type_count,
        "unsupportedEventTypeCounts": unsupported_event_type_counts,
        "emailUpdateEventTypeCounts": email_update_event_type_counts,
        "missingSendIdByEventType": missing_send_id_by_event_type,
        "deduplicatedEventTypeCounts": deduplicated_event_type_counts,
        "userContexts": len(user_event_counts),
        "missingUserContext": missing_user_context_count,
        "unknownEventTypeCount": unknown_event_type_count,
        "invalidTimestampCount": invalid_timestamp_count,
        "timestampFallbackCount": timestamp_fallback_count,
        "futureSkewEventCount": future_skew_event_count,
        "staleEventCount": stale_event_count,
        "freshEventCount": fresh_event_count,
        "futureSkewEventTypeCounts": future_skew_event_type_counts,
        "staleEventTypeCounts": stale_event_type_counts,
        "timestampFallbackEventTypeCounts": timestamp_fallback_event_type_counts,
        "timestampAgeBucketCounts": timestamp_age_bucket_counts,
        "futureSkewThresholdSeconds": SENDGRID_WEBHOOK_FUTURE_SKEW_SECONDS,
        "staleEventAgeThresholdSeconds": SENDGRID_WEBHOOK_STALE_EVENT_AGE_SECONDS,
        "timestampPressureLabel": timestamp_pressure["label"],
        "timestampPressureHint": timestamp_pressure["hint"],
        "timestampAnomalyCount": timestamp_pressure["anomalyCount"],
        "timestampAnomalyRatePct": timestamp_pressure["anomalyRatePct"],
        "timestampPressureHighAnomalyRatePct": timestamp_pressure["highAnomalyRatePct"],
        "timestampPressureModerateAnomalyRatePct": (
            timestamp_pressure["moderateAnomalyRatePct"]
        ),
        "timestampPressureHighAnomalyCount": timestamp_pressure["highAnomalyCount"],
        "timestampPressureModerateAnomalyCount": (
            timestamp_pressure["moderateAnomalyCount"]
        ),
        "timestampAnomalyEventTypeCounts": timestamp_anomaly_event_type_counts,
        "timestampDominantAnomalyBucket": dominant_timestamp_anomaly_bucket,
        "timestampDominantAnomalyBucketCount": (
            dominant_timestamp_anomaly_bucket_count
        ),
        "timestampDominantAnomalyEventType": dominant_timestamp_anomaly_event_type,
        "timestampDominantAnomalyEventTypeCount": (
            dominant_timestamp_anomaly_event_type_count
        ),
    }


# ============== SALES DATA CONNECTORS (FLAGGED) ==============

@router.post("/providers/apollo/search")
async def apollo_search_prospects(
    request: dict,
    http_request: Request = None,
    response: Response = None,
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
    limit = await _parse_connector_request_bounded_int(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        endpoint="apollo_search",
        request=request,
        field_name="limit",
        default=25,
        minimum=1,
        maximum=100,
        request_id=request_id,
    )
    page = await _parse_connector_request_bounded_int(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        endpoint="apollo_search",
        request=request,
        field_name="page",
        default=1,
        minimum=1,
        maximum=1000,
        request_id=request_id,
    )
    save_results = bool(request.get("saveResults", False))

    if not query and not title and not domain:
        await _raise_connector_required_input_error(
            db=db,
            user_id=current_user["id"],
            provider="apollo",
            endpoint="apollo_search",
            field_name="query|title|domain",
            message="Provide at least one of query, title, or domain",
            request_id=request_id,
            raw_value={"query": query, "title": title, "domain": domain},
        )
    rate_limit = await _enforce_connector_rate_limit(
        db=db,
        user_id=current_user["id"],
        endpoint_key="apollo_search",
        request_id=request_id,
    )
    _apply_rate_limit_headers(response, rate_limit)

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
        "rateLimit": rate_limit,
        "prospects": prospects,
    }


@router.post("/providers/apollo/company")
async def apollo_enrich_company(
    request: dict,
    http_request: Request = None,
    response: Response = None,
    current_user: dict = Depends(get_current_user),
):
    """Search Apollo organizations and return normalized sales company profiles."""
    _require_provider_enabled("Apollo", "ENABLE_APOLLO_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Apollo", "apollo_api_key")
    db = get_db()
    request_id = _extract_request_id(http_request)

    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    limit = await _parse_connector_request_bounded_int(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        endpoint="apollo_company",
        request=request,
        field_name="limit",
        default=10,
        minimum=1,
        maximum=25,
        request_id=request_id,
    )
    save_research = bool(request.get("saveResearch", False))

    if not domain and not company_name:
        await _raise_connector_required_input_error(
            db=db,
            user_id=current_user["id"],
            provider="apollo",
            endpoint="apollo_company",
            field_name="domain|companyName",
            message="Provide domain or companyName",
            request_id=request_id,
            raw_value={"domain": domain, "companyName": company_name},
        )
    rate_limit = await _enforce_connector_rate_limit(
        db=db,
        user_id=current_user["id"],
        endpoint_key="apollo_company",
        request_id=request_id,
    )
    _apply_rate_limit_headers(response, rate_limit)

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
    truncated_records = 0
    truncated_raw_records = 0
    truncated_enriched_records = 0
    persist_policy = _resolve_connector_persist_policy()
    if save_research:
        for company in companies:
            stored_company, stored_raw_data, storage_policy = _build_company_research_storage_policy(
                company_payload=company,
                raw_payload=provider_data,
            )
            if storage_policy.get("truncated"):
                truncated_records += 1
            if storage_policy.get("rawData", {}).get("truncated"):
                truncated_raw_records += 1
            if storage_policy.get("enrichedData", {}).get("truncated"):
                truncated_enriched_records += 1
            doc = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "companyName": company.get("name", ""),
                "domain": company.get("domain", domain),
                "source": "apollo",
                "enrichedData": stored_company,
                "rawData": stored_raw_data,
                "storagePolicy": storage_policy,
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
        "rateLimit": rate_limit,
        "storagePolicy": {
            "maxBytes": persist_policy["maxBytes"],
            "previewChars": persist_policy["previewChars"],
            "truncatedRecordCount": truncated_records,
            "truncatedRawRecordCount": truncated_raw_records,
            "truncatedEnrichedRecordCount": truncated_enriched_records,
        },
        "companies": companies,
    }


@router.post("/providers/clearbit/company")
async def clearbit_enrich_company(
    request: dict,
    http_request: Request = None,
    response: Response = None,
    current_user: dict = Depends(get_current_user),
):
    """Enrich company data via Clearbit with normalized sales output."""
    _require_provider_enabled("Clearbit", "ENABLE_CLEARBIT_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Clearbit", "clearbit_api_key")
    db = get_db()
    request_id = _extract_request_id(http_request)

    domain = _normalize_domain(request.get("domain"))
    save_research = bool(request.get("saveResearch", False))
    persist_policy = _resolve_connector_persist_policy()
    storage_policy_summary = {
        "maxBytes": persist_policy["maxBytes"],
        "previewChars": persist_policy["previewChars"],
        "truncatedRecordCount": 0,
        "truncatedRawRecordCount": 0,
        "truncatedEnrichedRecordCount": 0,
    }
    if not domain:
        await _raise_connector_required_input_error(
            db=db,
            user_id=current_user["id"],
            provider="clearbit",
            endpoint="clearbit_company",
            field_name="domain",
            message="domain is required",
            request_id=request_id,
            raw_value=domain,
        )
    rate_limit = await _enforce_connector_rate_limit(
        db=db,
        user_id=current_user["id"],
        endpoint_key="clearbit_company",
        request_id=request_id,
    )
    _apply_rate_limit_headers(response, rate_limit)

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
            "rateLimit": rate_limit,
            "storagePolicy": storage_policy_summary,
            "company": None,
        }

    company = _normalize_clearbit_company(provider_data)
    if save_research:
        stored_company, stored_raw_data, storage_policy = _build_company_research_storage_policy(
            company_payload=company,
            raw_payload=provider_data,
        )
        if storage_policy.get("truncated"):
            storage_policy_summary["truncatedRecordCount"] = 1
        if storage_policy.get("rawData", {}).get("truncated"):
            storage_policy_summary["truncatedRawRecordCount"] = 1
        if storage_policy.get("enrichedData", {}).get("truncated"):
            storage_policy_summary["truncatedEnrichedRecordCount"] = 1
        doc = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "companyName": company.get("name", ""),
            "domain": company.get("domain", domain),
            "source": "clearbit",
            "enrichedData": stored_company,
            "rawData": stored_raw_data,
            "storagePolicy": storage_policy,
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
        "rateLimit": rate_limit,
        "storagePolicy": storage_policy_summary,
        "company": company,
    }


@router.post("/providers/crunchbase/company")
async def crunchbase_enrich_company(
    request: dict,
    http_request: Request = None,
    response: Response = None,
    current_user: dict = Depends(get_current_user),
):
    """Search Crunchbase organizations and return normalized sales company profiles."""
    _require_provider_enabled("Crunchbase", "ENABLE_CRUNCHBASE_CONNECTOR")
    api_key = await _get_provider_api_key(current_user, "Crunchbase", "crunchbase_api_key")
    db = get_db()
    request_id = _extract_request_id(http_request)

    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    limit = await _parse_connector_request_bounded_int(
        db=db,
        user_id=current_user["id"],
        provider="crunchbase",
        endpoint="crunchbase_company",
        request=request,
        field_name="limit",
        default=10,
        minimum=1,
        maximum=25,
        request_id=request_id,
    )
    save_research = bool(request.get("saveResearch", False))

    if not domain and not company_name:
        await _raise_connector_required_input_error(
            db=db,
            user_id=current_user["id"],
            provider="crunchbase",
            endpoint="crunchbase_company",
            field_name="domain|companyName",
            message="Provide domain or companyName",
            request_id=request_id,
            raw_value={"domain": domain, "companyName": company_name},
        )
    rate_limit = await _enforce_connector_rate_limit(
        db=db,
        user_id=current_user["id"],
        endpoint_key="crunchbase_company",
        request_id=request_id,
    )
    _apply_rate_limit_headers(response, rate_limit)

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
    truncated_records = 0
    truncated_raw_records = 0
    truncated_enriched_records = 0
    persist_policy = _resolve_connector_persist_policy()
    if save_research:
        for company in companies:
            stored_company, stored_raw_data, storage_policy = _build_company_research_storage_policy(
                company_payload=company,
                raw_payload=provider_data,
            )
            if storage_policy.get("truncated"):
                truncated_records += 1
            if storage_policy.get("rawData", {}).get("truncated"):
                truncated_raw_records += 1
            if storage_policy.get("enrichedData", {}).get("truncated"):
                truncated_enriched_records += 1
            doc = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "companyName": company.get("name", ""),
                "domain": company.get("domain", ""),
                "source": "crunchbase",
                "enrichedData": stored_company,
                "rawData": stored_raw_data,
                "storagePolicy": storage_policy,
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
        "rateLimit": rate_limit,
        "storagePolicy": {
            "maxBytes": persist_policy["maxBytes"],
            "previewChars": persist_policy["previewChars"],
            "truncatedRecordCount": truncated_records,
            "truncatedRawRecordCount": truncated_raw_records,
            "truncatedEnrichedRecordCount": truncated_enriched_records,
        },
        "companies": companies,
    }


@router.post("/providers/company-enrichment")
async def enrich_company_with_fallback(
    request: dict,
    http_request: Request = None,
    response: Response = None,
    current_user: dict = Depends(get_current_user),
):
    """Run sales-only company enrichment across enabled providers with fallback."""
    if not _flag_enabled("ENABLE_CONNECTOR_ORCHESTRATION"):
        raise HTTPException(
            status_code=403,
            detail="Connector orchestration is disabled. Enable ENABLE_CONNECTOR_ORCHESTRATION to use this endpoint.",
        )

    db = get_db()
    request_id = _extract_request_id(http_request)
    domain = _normalize_domain(request.get("domain"))
    company_name = (request.get("companyName") or "").strip()
    if not domain and not company_name:
        await _raise_connector_required_input_error(
            db=db,
            user_id=current_user["id"],
            provider="orchestration",
            endpoint="company_enrichment_orchestration",
            field_name="domain|companyName",
            message="Provide domain or companyName",
            request_id=request_id,
            raw_value={"domain": domain, "companyName": company_name},
        )

    limit = await _parse_connector_request_bounded_int(
        db=db,
        user_id=current_user["id"],
        provider="orchestration",
        endpoint="company_enrichment_orchestration",
        request=request,
        field_name="limit",
        default=10,
        minimum=1,
        maximum=25,
        request_id=request_id,
    )
    save_research = bool(request.get("saveResearch", False))
    stop_on_first_match = bool(request.get("stopOnFirstMatch", True))
    provider_order, provider_order_diagnostics = _normalize_provider_order_with_diagnostics(
        request.get("providerOrder")
    )
    rate_limit = await _enforce_connector_rate_limit(
        db=db,
        user_id=current_user["id"],
        endpoint_key="company_enrichment_orchestration",
        request_id=request_id,
    )
    _apply_rate_limit_headers(response, rate_limit)

    attempts: List[Dict[str, Any]] = []
    matched_companies: List[Dict[str, Any]] = []
    selected_provider: Optional[str] = None
    start = time.perf_counter()

    for provider in provider_order:
        provider_start = time.perf_counter()
        try:
            if provider == "apollo":
                provider_response = await apollo_enrich_company(
                    {
                        "domain": domain,
                        "companyName": company_name,
                        "limit": limit,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                companies = provider_response.get("companies", [])
            elif provider == "clearbit":
                if not domain:
                    attempt_latency_ms = round((time.perf_counter() - provider_start) * 1000, 2)
                    attempts.append(
                        {
                            "provider": provider,
                            "status": "skipped",
                            "reasonCode": "domain_required",
                            "reason": "domain_required",
                            "resultCount": 0,
                            "latencyMs": attempt_latency_ms,
                        }
                    )
                    continue
                provider_response = await clearbit_enrich_company(
                    {
                        "domain": domain,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                company = provider_response.get("company")
                companies = [company] if provider_response.get("found") and isinstance(company, dict) else []
            elif provider == "crunchbase":
                provider_response = await crunchbase_enrich_company(
                    {
                        "domain": domain,
                        "companyName": company_name,
                        "limit": limit,
                        "saveResearch": save_research,
                    },
                    http_request=http_request,
                    current_user=current_user,
                )
                companies = provider_response.get("companies", [])
            else:
                attempt_latency_ms = round((time.perf_counter() - provider_start) * 1000, 2)
                attempts.append(
                    {
                        "provider": provider,
                        "status": "skipped",
                        "reasonCode": "unsupported_provider",
                        "reason": "unsupported_provider",
                        "resultCount": 0,
                        "latencyMs": attempt_latency_ms,
                    }
                )
                continue

            result_count = len(companies)
            attempt_latency_ms = round((time.perf_counter() - provider_start) * 1000, 2)
            provider_rate_limit = (
                provider_response.get("rateLimit")
                if isinstance(provider_response, dict)
                else None
            )
            attempts.append(
                {
                    "provider": provider,
                    "status": "success",
                    "reasonCode": "success" if result_count > 0 else "no_results",
                    "resultCount": result_count,
                    "latencyMs": attempt_latency_ms,
                    "rateLimitRemaining": (
                        provider_rate_limit.get("remaining")
                        if isinstance(provider_rate_limit, dict)
                        else None
                    ),
                    "rateLimitResetInSeconds": (
                        provider_rate_limit.get("resetInSeconds")
                        if isinstance(provider_rate_limit, dict)
                        else None
                    ),
                }
            )
            if result_count > 0:
                if not selected_provider:
                    selected_provider = provider
                matched_companies.extend(companies)
                if stop_on_first_match:
                    break
        except HTTPException as exc:
            attempt_latency_ms = round((time.perf_counter() - provider_start) * 1000, 2)
            attempts.append(
                {
                    "provider": provider,
                    "status": "error",
                    "reasonCode": "provider_http_error",
                    "statusCode": exc.status_code,
                    "reason": str(exc.detail),
                    "resultCount": 0,
                    "latencyMs": attempt_latency_ms,
                }
            )
        except Exception as exc:
            attempt_latency_ms = round((time.perf_counter() - provider_start) * 1000, 2)
            attempts.append(
                {
                    "provider": provider,
                    "status": "error",
                    "reasonCode": "provider_runtime_error",
                    "statusCode": 500,
                    "reason": str(exc),
                    "resultCount": 0,
                    "latencyMs": attempt_latency_ms,
                }
            )

    final_companies = matched_companies[:limit]
    latency_ms = round((time.perf_counter() - start) * 1000, 2)
    found = len(final_companies) > 0
    attempt_status_counts = {"success": 0, "skipped": 0, "error": 0}
    attempt_reason_code_counts: Dict[str, int] = {}
    providers_attempted: List[str] = []
    providers_with_results: List[str] = []
    providers_without_results: List[str] = []
    for attempt in attempts:
        provider_name = str(attempt.get("provider") or "").strip().lower()
        status_name = str(attempt.get("status") or "").strip().lower()
        if provider_name and provider_name not in providers_attempted:
            providers_attempted.append(provider_name)
        if status_name in attempt_status_counts:
            attempt_status_counts[status_name] += 1
        reason_code = str(attempt.get("reasonCode") or "").strip().lower()
        if reason_code:
            attempt_reason_code_counts[reason_code] = (
                attempt_reason_code_counts.get(reason_code, 0) + 1
            )
        if status_name == "success" and int(attempt.get("resultCount") or 0) > 0:
            if provider_name and provider_name not in providers_with_results:
                providers_with_results.append(provider_name)
        elif status_name == "success" and provider_name and provider_name not in providers_without_results:
            providers_without_results.append(provider_name)

    _log_integration_event(
        "company_enrichment_orchestrated",
        {
            "user_id": current_user["id"],
            "domain": domain,
            "company_name": company_name[:80],
            "provider_order": provider_order,
            "provider_order_default_applied": provider_order_diagnostics.get("defaultApplied")
            is True,
            "provider_order_ignored_count": len(
                provider_order_diagnostics.get("ignoredProviders") or []
            ),
            "provider_order_duplicate_count": len(
                provider_order_diagnostics.get("duplicatesRemoved") or []
            ),
            "attempt_count": len(attempts),
            "attempt_success_count": attempt_status_counts["success"],
            "attempt_skipped_count": attempt_status_counts["skipped"],
            "attempt_error_count": attempt_status_counts["error"],
            "attempt_reason_codes": attempt_reason_code_counts,
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
            "provider_order_default_applied": provider_order_diagnostics.get("defaultApplied")
            is True,
            "provider_order_ignored_count": len(
                provider_order_diagnostics.get("ignoredProviders") or []
            ),
            "provider_order_duplicate_count": len(
                provider_order_diagnostics.get("duplicatesRemoved") or []
            ),
            "attempt_count": len(attempts),
            "attempt_success_count": attempt_status_counts["success"],
            "attempt_skipped_count": attempt_status_counts["skipped"],
            "attempt_error_count": attempt_status_counts["error"],
            "attempt_reason_codes": attempt_reason_code_counts,
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
            "providerOrderDiagnostics": provider_order_diagnostics,
            "stopOnFirstMatch": stop_on_first_match,
        },
        "attemptSummary": {
            "total": len(attempts),
            "statusCounts": attempt_status_counts,
            "reasonCodeCounts": attempt_reason_code_counts,
            "providersAttempted": providers_attempted,
            "providersWithResults": providers_with_results,
            "providersWithoutResults": providers_without_results,
        },
        "resultCount": len(final_companies),
        "rateLimit": rate_limit,
        "companies": final_companies,
        "attempts": attempts,
    }


async def _health_check_sendgrid(
    api_key: str,
    db=None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
) -> Dict[str, Any]:
    async def _check():
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                "https://api.sendgrid.com/v3/user/profile",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            return response

    async def _record_retry_attempt(retry_payload: Dict[str, Any]) -> None:
        if db is None or not user_id:
            return
        await _record_integration_event(
            db,
            INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE,
            user_id,
            retry_payload,
            request_id=request_id,
        )

    async def _record_retry_terminal(
        event_type: str,
        retry_payload: Dict[str, Any],
    ) -> None:
        if db is None or not user_id:
            return
        await _record_integration_event(
            db,
            event_type,
            user_id,
            retry_payload,
            request_id=request_id,
        )

    retry_callback = _record_retry_attempt if (db is not None and user_id) else None
    retry_terminal_callback = (
        _record_retry_terminal if (db is not None and user_id) else None
    )

    try:
        start = time.perf_counter()
        response = await _retry_with_backoff(
            _check,
            operation_name="sendgrid_health_check",
            provider="sendgrid",
            request_id=request_id,
            on_retry_attempt=retry_callback,
            on_retry_terminal_event=retry_terminal_callback,
        )
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
            "apollo_configured_at": None,
            "apollo_last_rotated_at": None,
            "clearbit_configured_at": None,
            "clearbit_last_rotated_at": None,
            "crunchbase_configured_at": None,
            "crunchbase_last_rotated_at": None,
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
            integrations["apollo_configured_at"] = integrations.get("apollo_configured_at") or integrations.get("updatedAt")
            integrations["apollo_last_rotated_at"] = integrations.get("apollo_last_rotated_at") or integrations.get("updatedAt")
        if integrations.get("clearbit_api_key"):
            integrations["clearbit_configured"] = True
            integrations["clearbit_api_key"] = _mask_secret(integrations["clearbit_api_key"])
            integrations["clearbit_configured_at"] = integrations.get("clearbit_configured_at") or integrations.get("updatedAt")
            integrations["clearbit_last_rotated_at"] = integrations.get("clearbit_last_rotated_at") or integrations.get("updatedAt")
        if integrations.get("crunchbase_api_key"):
            integrations["crunchbase_configured"] = True
            integrations["crunchbase_api_key"] = _mask_secret(integrations["crunchbase_api_key"])
            integrations["crunchbase_configured_at"] = integrations.get("crunchbase_configured_at") or integrations.get("updatedAt")
            integrations["crunchbase_last_rotated_at"] = integrations.get("crunchbase_last_rotated_at") or integrations.get("updatedAt")
        if integrations.get("gmail_refresh_token"):
            integrations["gmail_configured"] = True
            del integrations["gmail_refresh_token"]
    
    return integrations


@router.post("/integrations/sendgrid")
async def save_sendgrid_integration(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Save SendGrid API key"""
    api_key = _normalize_api_key(request.get("api_key"))
    from_email = request.get("from_email")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    status = await _health_check_sendgrid(api_key)
    if not status["healthy"]:
        raise HTTPException(status_code=400, detail="Invalid SendGrid API key or provider unavailable")
    
    db = get_db()
    lifecycle = await _save_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="sendgrid",
        key_field="sendgrid_api_key",
        api_key=api_key,
    )
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$set": {
            "from_email": from_email or current_user.get("email"),
            "sendgrid_last_health": status,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="sendgrid",
        action="saved",
        request_id=request_id,
        connector_enabled=True,
        key_rotated=lifecycle.get("keyRotated"),
        configured_at=lifecycle.get("configuredAt"),
        last_rotated_at=lifecycle.get("lastRotatedAt"),
    )
    return {
        "success": True,
        "message": "SendGrid integration saved",
        "connectorEnabled": True,
        "keyRotated": lifecycle.get("keyRotated"),
        "configuredAt": lifecycle.get("configuredAt"),
        "lastRotatedAt": lifecycle.get("lastRotatedAt"),
    }


@router.post("/integrations/apollo")
async def save_apollo_integration(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Save Apollo API key (feature-flagged connector)."""
    api_key = _normalize_api_key(request.get("api_key"))
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    lifecycle = await _save_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        key_field="apollo_api_key",
        api_key=api_key,
    )
    connector_enabled = _flag_enabled("ENABLE_APOLLO_CONNECTOR")
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        action="saved",
        request_id=request_id,
        connector_enabled=connector_enabled,
        key_rotated=lifecycle.get("keyRotated"),
        configured_at=lifecycle.get("configuredAt"),
        last_rotated_at=lifecycle.get("lastRotatedAt"),
    )
    return {
        "success": True,
        "message": "Apollo integration saved",
        "connectorEnabled": connector_enabled,
        "keyRotated": lifecycle.get("keyRotated"),
        "configuredAt": lifecycle.get("configuredAt"),
        "lastRotatedAt": lifecycle.get("lastRotatedAt"),
    }


@router.post("/integrations/clearbit")
async def save_clearbit_integration(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Save Clearbit API key (feature-flagged connector)."""
    api_key = _normalize_api_key(request.get("api_key"))
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    lifecycle = await _save_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="clearbit",
        key_field="clearbit_api_key",
        api_key=api_key,
    )
    connector_enabled = _flag_enabled("ENABLE_CLEARBIT_CONNECTOR")
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="clearbit",
        action="saved",
        request_id=request_id,
        connector_enabled=connector_enabled,
        key_rotated=lifecycle.get("keyRotated"),
        configured_at=lifecycle.get("configuredAt"),
        last_rotated_at=lifecycle.get("lastRotatedAt"),
    )
    return {
        "success": True,
        "message": "Clearbit integration saved",
        "connectorEnabled": connector_enabled,
        "keyRotated": lifecycle.get("keyRotated"),
        "configuredAt": lifecycle.get("configuredAt"),
        "lastRotatedAt": lifecycle.get("lastRotatedAt"),
    }


@router.post("/integrations/crunchbase")
async def save_crunchbase_integration(
    request: dict,
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Save Crunchbase API key (feature-flagged connector)."""
    api_key = _normalize_api_key(request.get("api_key"))
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")

    db = get_db()
    lifecycle = await _save_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="crunchbase",
        key_field="crunchbase_api_key",
        api_key=api_key,
    )
    connector_enabled = _flag_enabled("ENABLE_CRUNCHBASE_CONNECTOR")
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="crunchbase",
        action="saved",
        request_id=request_id,
        connector_enabled=connector_enabled,
        key_rotated=lifecycle.get("keyRotated"),
        configured_at=lifecycle.get("configuredAt"),
        last_rotated_at=lifecycle.get("lastRotatedAt"),
    )
    return {
        "success": True,
        "message": "Crunchbase integration saved",
        "connectorEnabled": connector_enabled,
        "keyRotated": lifecycle.get("keyRotated"),
        "configuredAt": lifecycle.get("configuredAt"),
        "lastRotatedAt": lifecycle.get("lastRotatedAt"),
    }


@router.delete("/integrations/sendgrid")
async def remove_sendgrid_integration(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Remove SendGrid integration"""
    db = get_db()
    lifecycle = await _remove_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="sendgrid",
        key_field="sendgrid_api_key",
    )

    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {
            "$unset": {
                "sendgrid_last_health": "",
                "from_email": "",
            },
            "$set": {
                "updatedAt": lifecycle.get("removedAt"),
            },
        },
    )
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="sendgrid",
        action="removed",
        request_id=request_id,
        connector_enabled=True,
        removed_at=lifecycle.get("removedAt"),
        had_key=lifecycle.get("hadKey"),
    )
    return {
        "success": True,
        "message": "SendGrid integration removed",
        "hadKey": lifecycle.get("hadKey"),
        "removedAt": lifecycle.get("removedAt"),
    }


@router.delete("/integrations/apollo")
async def remove_apollo_integration(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    lifecycle = await _remove_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        key_field="apollo_api_key",
    )
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="apollo",
        action="removed",
        request_id=request_id,
        connector_enabled=_flag_enabled("ENABLE_APOLLO_CONNECTOR"),
        removed_at=lifecycle.get("removedAt"),
        had_key=lifecycle.get("hadKey"),
    )
    return {
        "success": True,
        "message": "Apollo integration removed",
        "hadKey": lifecycle.get("hadKey"),
        "removedAt": lifecycle.get("removedAt"),
    }


@router.delete("/integrations/clearbit")
async def remove_clearbit_integration(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    lifecycle = await _remove_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="clearbit",
        key_field="clearbit_api_key",
    )
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="clearbit",
        action="removed",
        request_id=request_id,
        connector_enabled=_flag_enabled("ENABLE_CLEARBIT_CONNECTOR"),
        removed_at=lifecycle.get("removedAt"),
        had_key=lifecycle.get("hadKey"),
    )
    return {
        "success": True,
        "message": "Clearbit integration removed",
        "hadKey": lifecycle.get("hadKey"),
        "removedAt": lifecycle.get("removedAt"),
    }


@router.delete("/integrations/crunchbase")
async def remove_crunchbase_integration(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    lifecycle = await _remove_connector_credential(
        db=db,
        user_id=current_user["id"],
        provider="crunchbase",
        key_field="crunchbase_api_key",
    )
    request_id = _extract_request_id(http_request)
    await _record_connector_credential_lifecycle(
        db=db,
        user_id=current_user["id"],
        provider="crunchbase",
        action="removed",
        request_id=request_id,
        connector_enabled=_flag_enabled("ENABLE_CRUNCHBASE_CONNECTOR"),
        removed_at=lifecycle.get("removedAt"),
        had_key=lifecycle.get("hadKey"),
    )
    return {
        "success": True,
        "message": "Crunchbase integration removed",
        "hadKey": lifecycle.get("hadKey"),
        "removedAt": lifecycle.get("removedAt"),
    }


@router.get("/integrations/health")
async def get_integrations_health(
    http_request: Request = None,
    current_user: dict = Depends(get_current_user)
):
    """Return integration health and readiness across sales connectors."""
    db = get_db()
    integration_settings = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0},
    ) or {}

    request_id = _extract_request_id(http_request)
    checks = []
    if integration_settings.get("sendgrid_api_key"):
        checks.append(
            _health_check_sendgrid(
                integration_settings.get("sendgrid_api_key"),
                db=db,
                user_id=current_user["id"],
                request_id=request_id,
            )
        )
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
    now = datetime.now(timezone.utc)
    credential_age_policy = _resolve_connector_credential_age_policy()
    configured_max_age_days = int(credential_age_policy["configuredMaxAgeDays"])
    rotation_max_age_days = int(credential_age_policy["rotationMaxAgeDays"])
    for provider_health in health_data:
        provider_name = str(provider_health.get("provider") or "").strip().lower()
        if provider_name not in {"sendgrid", "apollo", "clearbit", "crunchbase"}:
            continue
        configured_at_field, rotated_at_field = _connector_timestamp_fields(provider_name)
        configured_at = integration_settings.get(configured_at_field)
        last_rotated_at = integration_settings.get(rotated_at_field)
        provider_health["configuredAt"] = configured_at
        provider_health["lastRotatedAt"] = last_rotated_at
        configured_age_days = _credential_age_days(configured_at, now)
        rotation_age_days = _credential_age_days(last_rotated_at, now)
        stale_reasons: List[str] = []
        if (
            configured_age_days is not None
            and configured_age_days > configured_max_age_days
        ):
            stale_reasons.append("configured_age_exceeded")
        if rotation_age_days is not None and rotation_age_days > rotation_max_age_days:
            stale_reasons.append("rotation_age_exceeded")
        provider_health["credentialConfiguredAgeDays"] = configured_age_days
        provider_health["credentialRotationAgeDays"] = rotation_age_days
        provider_health["credentialStale"] = len(stale_reasons) > 0
        provider_health["credentialStaleReasons"] = stale_reasons

    unhealthy_providers = [
        str(provider.get("provider") or "unknown")
        for provider in health_data
        if not bool(provider.get("healthy"))
    ]
    credential_freshness_status_counts: Dict[str, int] = {
        "ACTION_REQUIRED": 0,
        "READY": 0,
        "UNKNOWN": 0,
    }
    credential_freshness_by_provider: Dict[str, Dict[str, Any]] = {}
    for provider in health_data:
        provider_name = str(provider.get("provider") or "unknown").strip().lower()
        if provider_name not in {"sendgrid", "apollo", "clearbit", "crunchbase"}:
            continue
        configured_age_days = provider.get("credentialConfiguredAgeDays")
        rotation_age_days = provider.get("credentialRotationAgeDays")
        stale_reasons = list(provider.get("credentialStaleReasons") or [])
        is_stale = bool(provider.get("credentialStale"))
        has_age_observability = (
            isinstance(configured_age_days, (int, float))
            or isinstance(rotation_age_days, (int, float))
        )
        freshness_status = (
            "ACTION_REQUIRED"
            if is_stale
            else ("READY" if has_age_observability else "UNKNOWN")
        )
        credential_freshness_status_counts[freshness_status] = (
            credential_freshness_status_counts.get(freshness_status, 0) + 1
        )
        credential_freshness_by_provider[provider_name] = {
            "status": freshness_status,
            "configuredAgeDays": configured_age_days,
            "rotationAgeDays": rotation_age_days,
            "staleReasons": stale_reasons,
        }
    credential_freshness_status_counts_server = (
        _normalize_integration_health_freshness_status_count_map(
            credential_freshness_status_counts,
            include_all_statuses=True,
        )
    )
    credential_freshness_status_counts_fallback = (
        _build_integration_health_freshness_status_count_fallback(
            credential_freshness_by_provider
        )
    )
    has_server_freshness_status_counts = (
        isinstance(credential_freshness_status_counts, dict)
        and len(credential_freshness_status_counts) > 0
    )
    credential_freshness_status_counts_source = (
        "server" if has_server_freshness_status_counts else "local"
    )
    credential_freshness_status_counts_mismatch = (
        not _integration_health_freshness_status_count_maps_match(
            credential_freshness_status_counts_server,
            credential_freshness_status_counts_fallback,
        )
    )
    credential_freshness_status_counts_effective = (
        credential_freshness_status_counts_server
        if credential_freshness_status_counts_source == "server"
        else credential_freshness_status_counts_fallback
    )

    actionable_unhealthy_providers: List[str] = []
    credential_action_required_providers: List[str] = []
    for provider in health_data:
        provider_name = str(provider.get("provider") or "unknown")
        if bool(provider.get("credentialStale")):
            credential_action_required_providers.append(provider_name)
        if bool(provider.get("healthy")):
            continue
        error_message = str(provider.get("error") or "")
        if provider_name == "sendgrid":
            actionable_unhealthy_providers.append(provider_name)
            continue
        if error_message not in {
            "Not configured",
            "Configured but connector disabled by feature flag",
        }:
            actionable_unhealthy_providers.append(provider_name)

    status = (
        "READY"
        if (
            len(actionable_unhealthy_providers) == 0
            and len(credential_action_required_providers) == 0
        )
        else "ACTION_REQUIRED"
    )
    alerts: List[str] = []
    if (
        len(actionable_unhealthy_providers) == 0
        and len(credential_action_required_providers) == 0
    ):
        alerts.append("Integration health checks are stable for required providers.")
    if actionable_unhealthy_providers:
        alerts.append(
            "Integration health check failures detected for required providers: "
            + ", ".join(actionable_unhealthy_providers)
        )
    if credential_action_required_providers:
        alerts.append(
            "Connector credential freshness exceeded policy for: "
            + ", ".join(credential_action_required_providers)
        )
    recommended_commands = [
        "npm run verify:backend:sales:integrations",
        "npm run verify:smoke:sales",
    ]
    if credential_action_required_providers:
        recommended_commands.append("npm run verify:docs:sales:connectors")
    if status == "ACTION_REQUIRED":
        recommended_commands.append("npm run verify:ci:sales")

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "healthyCount": sum(1 for provider in health_data if bool(provider.get("healthy"))),
        "unhealthyCount": len(unhealthy_providers),
        "unhealthyProviders": unhealthy_providers,
        "actionableUnhealthyProviders": actionable_unhealthy_providers,
        "credentialActionRequiredProviders": credential_action_required_providers,
        "credentialConfiguredMaxAgeDays": configured_max_age_days,
        "credentialRotationMaxAgeDays": rotation_max_age_days,
        "credentialFreshnessByProvider": credential_freshness_by_provider,
        "credentialFreshnessStatusCounts": credential_freshness_status_counts_effective,
        "credentialFreshnessStatusCountsSource": (
            credential_freshness_status_counts_source
        ),
        "credentialFreshnessStatusCountsMismatch": (
            credential_freshness_status_counts_mismatch
        ),
        "credentialFreshnessStatusCountsServer": (
            credential_freshness_status_counts_server
        ),
        "credentialFreshnessStatusCountsFallback": (
            credential_freshness_status_counts_fallback
        ),
        "credentialFreshnessTotalProviders": sum(
            credential_freshness_status_counts_effective.values()
        ),
        "credentialFreshnessActionRequiredCount": (
            credential_freshness_status_counts_effective.get(
            "ACTION_REQUIRED", 0
            )
        ),
        "credentialFreshnessWithinPolicyCount": (
            credential_freshness_status_counts_effective.get(
            "READY", 0
            )
        ),
        "credentialFreshnessUnknownCount": (
            credential_freshness_status_counts_effective.get(
            "UNKNOWN", 0
            )
        ),
        "alerts": alerts,
        "recommendedCommands": recommended_commands,
        "providers": health_data,
    }


@router.get("/integrations/telemetry/summary")
async def get_integrations_telemetry_summary(
    days: int = 7,
    limit: int = 1000,
    packet_only_recent_events: bool = False,
    governance_status: Optional[str] = None,
    packet_validation_status: Optional[str] = None,
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
    governance_status_filter = _normalize_optional_status_query_filter(
        governance_status,
        field_name="governance_status",
    )
    packet_validation_status_filter = _normalize_optional_status_query_filter(
        packet_validation_status,
        field_name="packet_validation_status",
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
    governance_status_counts: Dict[str, int] = {}
    governance_snapshot_count = 0
    governance_baseline_count = 0
    latest_governance_created_at: Optional[str] = None
    governance_schema_status_counts: Dict[str, int] = {}
    governance_schema_reason_code_parity_pass_count = 0
    governance_schema_reason_code_parity_fail_count = 0
    governance_schema_recommended_command_parity_pass_count = 0
    governance_schema_recommended_command_parity_fail_count = 0
    governance_schema_handoff_parity_pass_count = 0
    governance_schema_handoff_parity_fail_count = 0
    governance_schema_all_parity_passed_count = 0
    governance_schema_all_parity_failed_count = 0
    governance_schema_rollout_blocked_count = 0
    latest_governance_schema_created_at: Optional[str] = None
    packet_validation_status_counts: Dict[str, int] = {}
    packet_validation_within_freshness_count = 0
    packet_validation_outside_freshness_count = 0
    packet_validation_missing_freshness_count = 0
    latest_packet_validation_created_at: Optional[str] = None
    connector_lifecycle_by_action: Dict[str, int] = {}
    connector_lifecycle_by_provider: Dict[str, Dict[str, int]] = {}
    latest_connector_lifecycle_created_at: Optional[str] = None
    connector_rate_limit_by_endpoint: Dict[str, int] = {}
    connector_rate_limit_retry_after_seconds: List[int] = []
    connector_rate_limit_reset_in_seconds: List[int] = []
    latest_connector_rate_limit_created_at: Optional[str] = None
    sendgrid_webhook_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_counts: List[int] = []
    sendgrid_timestamp_anomaly_rate_pct_values: List[float] = []
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_high_anomaly_count_thresholds: List[int] = []
    sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds: List[int] = []
    latest_sendgrid_webhook_timestamp_created_at: Optional[str] = None
    sendgrid_webhook_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_counts: List[int] = []
    sendgrid_timestamp_anomaly_rate_pct_values: List[float] = []
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_high_anomaly_count_thresholds: List[int] = []
    sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds: List[int] = []
    latest_sendgrid_webhook_timestamp_created_at: Optional[str] = None
    sendgrid_webhook_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_counts: List[int] = []
    sendgrid_timestamp_anomaly_rate_pct_values: List[float] = []
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_high_anomaly_count_thresholds: List[int] = []
    sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds: List[int] = []
    latest_sendgrid_webhook_timestamp_created_at: Optional[str] = None
    connector_validation_by_endpoint: Dict[str, int] = {}
    connector_validation_by_provider: Dict[str, int] = {}
    connector_validation_by_field: Dict[str, int] = {}
    connector_validation_by_reason: Dict[str, int] = {}
    latest_connector_validation_created_at: Optional[str] = None
    sendgrid_webhook_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_counts: List[int] = []
    sendgrid_timestamp_anomaly_rate_pct_values: List[float] = []
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_high_anomaly_count_thresholds: List[int] = []
    sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds: List[int] = []
    latest_sendgrid_webhook_timestamp_created_at: Optional[str] = None
    retry_audit_by_operation: Dict[str, int] = {}
    retry_audit_by_provider: Dict[str, int] = {}
    retry_audit_next_delay_seconds: List[float] = []
    latest_retry_audit_created_at: Optional[str] = None
    orchestration_audit_by_selected_provider: Dict[str, int] = {}
    orchestration_attempt_status_counts: Dict[str, int] = {
        "success": 0,
        "skipped": 0,
        "error": 0,
    }
    orchestration_attempt_reason_code_counts: Dict[str, int] = {}
    orchestration_attempt_counts: List[int] = []
    orchestration_latency_ms: List[float] = []
    orchestration_trend_by_day_map: Dict[str, Dict[str, Any]] = {}
    latest_orchestration_created_at: Optional[str] = None
    error_events = 0

    for event in events:
        event_type = event.get("eventType", "unknown")
        provider = event.get("provider", "unknown")
        created_at = str(event.get("createdAt") or "")
        day_key = created_at[:10] if len(created_at) >= 10 else "unknown"
        summary_by_event[event_type] = summary_by_event.get(event_type, 0) + 1
        summary_by_provider[provider] = summary_by_provider.get(provider, 0) + 1
        payload = _coerce_payload_map(event.get("payload"))
        schema_version = _resolve_event_schema_version(event, payload)
        schema_key = str(schema_version) if schema_version is not None else "unknown"
        summary_by_schema_version[schema_key] = summary_by_schema_version.get(schema_key, 0) + 1
        if event_type in {
            CONNECTOR_CREDENTIAL_SAVED_EVENT_TYPE,
            CONNECTOR_CREDENTIAL_REMOVED_EVENT_TYPE,
        }:
            action = (
                "saved"
                if event_type == CONNECTOR_CREDENTIAL_SAVED_EVENT_TYPE
                else "removed"
            )
            connector_lifecycle_by_action[action] = (
                connector_lifecycle_by_action.get(action, 0) + 1
            )
            provider_name = str(payload.get("provider") or provider or "unknown").strip().lower()
            if not provider_name:
                provider_name = "unknown"
            provider_bucket = connector_lifecycle_by_provider.setdefault(
                provider_name,
                {"saved": 0, "removed": 0},
            )
            provider_bucket[action] = int(provider_bucket.get(action, 0)) + 1
            if created_at and (
                latest_connector_lifecycle_created_at is None
                or created_at > latest_connector_lifecycle_created_at
            ):
                latest_connector_lifecycle_created_at = created_at
        if event_type == CONNECTOR_RATE_LIMIT_EVENT_TYPE:
            endpoint = _normalize_connector_rate_limit_endpoint_key(
                payload.get("endpoint")
            )
            connector_rate_limit_by_endpoint[endpoint] = (
                connector_rate_limit_by_endpoint.get(endpoint, 0) + 1
            )
            retry_after_seconds = _coerce_non_negative_int(
                payload.get("retry_after_seconds"),
                fallback=0,
            )
            if retry_after_seconds > 0:
                connector_rate_limit_retry_after_seconds.append(retry_after_seconds)
            reset_in_seconds = _coerce_non_negative_int(
                payload.get("reset_in_seconds"),
                fallback=retry_after_seconds,
            )
            if reset_in_seconds > 0:
                connector_rate_limit_reset_in_seconds.append(reset_in_seconds)
            if created_at and (
                latest_connector_rate_limit_created_at is None
                or created_at > latest_connector_rate_limit_created_at
            ):
                latest_connector_rate_limit_created_at = created_at
        if event_type == CONNECTOR_INPUT_VALIDATION_FAILED_EVENT_TYPE:
            endpoint = _normalize_connector_rate_limit_endpoint_key(payload.get("endpoint"))
            connector_validation_by_endpoint[endpoint] = (
                connector_validation_by_endpoint.get(endpoint, 0) + 1
            )
            validation_provider = str(payload.get("provider") or provider or "unknown").strip().lower()
            if not validation_provider:
                validation_provider = "unknown"
            connector_validation_by_provider[validation_provider] = (
                connector_validation_by_provider.get(validation_provider, 0) + 1
            )
            field_name = re.sub(
                r"[^a-z0-9]+",
                "_",
                str(payload.get("field") or "").strip().lower(),
            ).strip("_")
            if not field_name:
                field_name = "unknown"
            connector_validation_by_field[field_name] = (
                connector_validation_by_field.get(field_name, 0) + 1
            )
            reason_name = re.sub(
                r"[^a-z0-9]+",
                "_",
                str(payload.get("reason") or "").strip().lower(),
            ).strip("_")
            if not reason_name:
                reason_name = "unknown"
            connector_validation_by_reason[reason_name] = (
                connector_validation_by_reason.get(reason_name, 0) + 1
            )
            if created_at and (
                latest_connector_validation_created_at is None
                or created_at > latest_connector_validation_created_at
            ):
                latest_connector_validation_created_at = created_at
        if event_type == "sendgrid_webhook_processed":
            sendgrid_webhook_timestamp_event_count += 1
            pressure_label = _normalize_sendgrid_timestamp_pressure_label(
                payload.get("timestamp_pressure_label")
            )
            sendgrid_timestamp_pressure_label_counts[pressure_label] = (
                sendgrid_timestamp_pressure_label_counts.get(pressure_label, 0) + 1
            )
            pressure_hint = str(payload.get("timestamp_pressure_hint") or "").strip()
            if not pressure_hint:
                pressure_hint = "Timestamp posture not available."
            sendgrid_timestamp_pressure_hint_counts[pressure_hint] = (
                sendgrid_timestamp_pressure_hint_counts.get(pressure_hint, 0) + 1
            )

            anomaly_count = _coerce_non_negative_int_optional(
                payload.get("timestamp_anomaly_count")
            )
            if anomaly_count is not None:
                sendgrid_timestamp_anomaly_counts.append(anomaly_count)
            anomaly_rate_pct = _coerce_non_negative_float(
                payload.get("timestamp_anomaly_rate_pct"),
                fallback=None,
            )
            if anomaly_rate_pct is not None:
                sendgrid_timestamp_anomaly_rate_pct_values.append(anomaly_rate_pct)

            high_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                payload.get("timestamp_pressure_high_anomaly_rate_pct"),
                fallback=None,
            )
            if high_anomaly_rate_pct_threshold is not None:
                sendgrid_timestamp_pressure_high_anomaly_rate_thresholds.append(
                    high_anomaly_rate_pct_threshold
                )
            moderate_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                payload.get("timestamp_pressure_moderate_anomaly_rate_pct"),
                fallback=None,
            )
            if moderate_anomaly_rate_pct_threshold is not None:
                sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds.append(
                    moderate_anomaly_rate_pct_threshold
                )
            high_anomaly_count_threshold = _coerce_non_negative_int_optional(
                payload.get("timestamp_pressure_high_anomaly_count")
            )
            if high_anomaly_count_threshold is not None:
                sendgrid_timestamp_pressure_high_anomaly_count_thresholds.append(
                    high_anomaly_count_threshold
                )
            moderate_anomaly_count_threshold = _coerce_non_negative_int_optional(
                payload.get("timestamp_pressure_moderate_anomaly_count")
            )
            if moderate_anomaly_count_threshold is not None:
                sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds.append(
                    moderate_anomaly_count_threshold
                )

            fallback_count = _coerce_non_negative_int_optional(
                payload.get("timestamp_fallback_count")
            )
            if fallback_count is not None:
                sendgrid_timestamp_fallback_count_total += fallback_count
            future_skew_count = _coerce_non_negative_int_optional(
                payload.get("future_skew_event_count")
            )
            if future_skew_count is not None:
                sendgrid_timestamp_future_skew_event_count_total += future_skew_count
            stale_event_count = _coerce_non_negative_int_optional(
                payload.get("stale_event_count")
            )
            if stale_event_count is not None:
                sendgrid_timestamp_stale_event_count_total += stale_event_count
            fresh_event_count = _coerce_non_negative_int_optional(
                payload.get("fresh_event_count")
            )
            if fresh_event_count is not None:
                sendgrid_timestamp_fresh_event_count_total += fresh_event_count

            age_bucket_counts = payload.get("timestamp_age_bucket_counts")
            if isinstance(age_bucket_counts, dict):
                for raw_bucket, raw_count in age_bucket_counts.items():
                    bucket_key = _normalize_sendgrid_timestamp_bucket_key(raw_bucket)
                    normalized_count = _coerce_non_negative_int_optional(raw_count)
                    if bucket_key is None or normalized_count is None:
                        continue
                    sendgrid_timestamp_age_bucket_counts[bucket_key] = (
                        sendgrid_timestamp_age_bucket_counts.get(bucket_key, 0)
                        + normalized_count
                    )

            anomaly_event_type_counts = payload.get("timestamp_anomaly_event_type_counts")
            if isinstance(anomaly_event_type_counts, dict):
                for raw_event_type, raw_count in anomaly_event_type_counts.items():
                    normalized_count = _coerce_non_negative_int_optional(raw_count)
                    if normalized_count is None:
                        continue
                    normalized_event_type = _normalize_sendgrid_event_type(raw_event_type)
                    sendgrid_timestamp_anomaly_event_type_counts[normalized_event_type] = (
                        sendgrid_timestamp_anomaly_event_type_counts.get(
                            normalized_event_type, 0
                        )
                        + normalized_count
                    )

            dominant_bucket = _normalize_sendgrid_timestamp_bucket_key(
                payload.get("timestamp_dominant_anomaly_bucket")
            )
            if dominant_bucket is not None:
                sendgrid_timestamp_dominant_anomaly_bucket_counts[dominant_bucket] = (
                    sendgrid_timestamp_dominant_anomaly_bucket_counts.get(
                        dominant_bucket, 0
                    )
                    + 1
                )

            dominant_event_type_raw = str(
                payload.get("timestamp_dominant_anomaly_event_type") or ""
            ).strip()
            if dominant_event_type_raw:
                dominant_event_type = _normalize_sendgrid_event_type(
                    dominant_event_type_raw
                )
                sendgrid_timestamp_dominant_anomaly_event_type_counts[
                    dominant_event_type
                ] = (
                    sendgrid_timestamp_dominant_anomaly_event_type_counts.get(
                        dominant_event_type, 0
                    )
                    + 1
                )

            if created_at and (
                latest_sendgrid_webhook_timestamp_created_at is None
                or created_at > latest_sendgrid_webhook_timestamp_created_at
            ):
                latest_sendgrid_webhook_timestamp_created_at = created_at
        if event_type == INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE:
            operation_name = str(
                payload.get("operation") or "integration_operation"
            ).strip()
            if not operation_name:
                operation_name = "integration_operation"
            retry_audit_by_operation[operation_name] = (
                retry_audit_by_operation.get(operation_name, 0) + 1
            )
            retry_provider = str(payload.get("provider") or provider or "unknown").strip().lower()
            if not retry_provider:
                retry_provider = "unknown"
            retry_audit_by_provider[retry_provider] = (
                retry_audit_by_provider.get(retry_provider, 0) + 1
            )
            next_delay_seconds = _coerce_non_negative_float(
                payload.get("next_delay_seconds"),
                fallback=None,
            )
            if next_delay_seconds is not None:
                retry_audit_next_delay_seconds.append(next_delay_seconds)
            if created_at and (
                latest_retry_audit_created_at is None
                or created_at > latest_retry_audit_created_at
            ):
                latest_retry_audit_created_at = created_at
        if event_type == "company_enrichment_orchestrated":
            selected_provider = str(
                payload.get("selected_provider") or "none"
            ).strip().lower()
            if not selected_provider:
                selected_provider = "none"
            orchestration_audit_by_selected_provider[selected_provider] = (
                orchestration_audit_by_selected_provider.get(selected_provider, 0) + 1
            )

            success_count = _coerce_non_negative_int(
                payload.get("attempt_success_count"),
                fallback=0,
            )
            skipped_count = _coerce_non_negative_int(
                payload.get("attempt_skipped_count"),
                fallback=0,
            )
            error_count = _coerce_non_negative_int(
                payload.get("attempt_error_count"),
                fallback=0,
            )
            orchestration_attempt_status_counts["success"] += success_count
            orchestration_attempt_status_counts["skipped"] += skipped_count
            orchestration_attempt_status_counts["error"] += error_count
            status_total = success_count + skipped_count + error_count

            attempt_count = _coerce_non_negative_int(
                payload.get("attempt_count"),
                fallback=status_total,
            )
            if attempt_count == 0 and status_total > 0:
                attempt_count = status_total
            orchestration_attempt_counts.append(attempt_count)

            reason_codes = payload.get("attempt_reason_codes")
            if isinstance(reason_codes, dict):
                for reason_code, count in reason_codes.items():
                    normalized_reason_code = str(reason_code or "").strip().lower()
                    if not normalized_reason_code:
                        continue
                    normalized_count = _coerce_non_negative_int_optional(count)
                    if normalized_count is None:
                        continue
                    orchestration_attempt_reason_code_counts[normalized_reason_code] = (
                        orchestration_attempt_reason_code_counts.get(normalized_reason_code, 0)
                        + normalized_count
                    )

            latency_ms = _coerce_non_negative_float(
                payload.get("latency_ms"),
                fallback=None,
            )
            if latency_ms is not None:
                orchestration_latency_ms.append(latency_ms)

            orchestration_day_bucket = orchestration_trend_by_day_map.setdefault(
                day_key,
                {
                    "date": day_key,
                    "events": 0,
                    "attemptSuccessCount": 0,
                    "attemptSkippedCount": 0,
                    "attemptErrorCount": 0,
                },
            )
            orchestration_day_bucket["events"] += 1
            orchestration_day_bucket["attemptSuccessCount"] += success_count
            orchestration_day_bucket["attemptSkippedCount"] += skipped_count
            orchestration_day_bucket["attemptErrorCount"] += error_count

            if created_at and (
                latest_orchestration_created_at is None
                or created_at > latest_orchestration_created_at
            ):
                latest_orchestration_created_at = created_at
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
        if event_type in {
            TRACEABILITY_GOVERNANCE_EVENT_TYPE,
            TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
        }:
            governance_status = _normalize_status_token(
                _resolve_event_governance_status(event, payload)
            )
            governance_status_counts[governance_status] = (
                governance_status_counts.get(governance_status, 0) + 1
            )
            if event_type == TRACEABILITY_GOVERNANCE_EVENT_TYPE:
                governance_snapshot_count += 1
            else:
                governance_baseline_count += 1
            if created_at and (
                latest_governance_created_at is None
                or created_at > latest_governance_created_at
            ):
                latest_governance_created_at = created_at
        if event_type == TRACEABILITY_GOVERNANCE_SCHEMA_EVENT_TYPE:
            governance_schema_status = _normalize_status_token(payload.get("status"))
            governance_schema_status_counts[governance_schema_status] = (
                governance_schema_status_counts.get(governance_schema_status, 0) + 1
            )
            schema_parity = _resolve_governance_schema_event_parity(payload)
            if schema_parity.get("reasonCodeParityOk") is True:
                governance_schema_reason_code_parity_pass_count += 1
            elif schema_parity.get("reasonCodeParityOk") is False:
                governance_schema_reason_code_parity_fail_count += 1
            if schema_parity.get("recommendedCommandParityOk") is True:
                governance_schema_recommended_command_parity_pass_count += 1
            elif schema_parity.get("recommendedCommandParityOk") is False:
                governance_schema_recommended_command_parity_fail_count += 1
            if schema_parity.get("handoffParityOk") is True:
                governance_schema_handoff_parity_pass_count += 1
            elif schema_parity.get("handoffParityOk") is False:
                governance_schema_handoff_parity_fail_count += 1
            if schema_parity.get("allParityOk") is True:
                governance_schema_all_parity_passed_count += 1
            elif schema_parity.get("allParityOk") is False:
                governance_schema_all_parity_failed_count += 1
            if payload.get("rollout_blocked") is True:
                governance_schema_rollout_blocked_count += 1
            if created_at and (
                latest_governance_schema_created_at is None
                or created_at > latest_governance_schema_created_at
            ):
                latest_governance_schema_created_at = created_at
        normalized_packet_validation_status = _resolve_event_packet_validation_status(
            event,
            payload,
        )
        packet_validation_within_freshness = _resolve_event_packet_validation_within_freshness(
            event,
            payload,
        )
        has_packet_status = normalized_packet_validation_status is not None
        has_packet_freshness = isinstance(packet_validation_within_freshness, bool)
        if has_packet_status or has_packet_freshness:
            normalized_packet_status = (
                normalized_packet_validation_status or "UNKNOWN"
            )
            packet_validation_status_counts[normalized_packet_status] = (
                packet_validation_status_counts.get(normalized_packet_status, 0) + 1
            )
            if packet_validation_within_freshness is True:
                packet_validation_within_freshness_count += 1
            elif packet_validation_within_freshness is False:
                packet_validation_outside_freshness_count += 1
            else:
                packet_validation_missing_freshness_count += 1
            if created_at and (
                latest_packet_validation_created_at is None
                or created_at > latest_packet_validation_created_at
            ):
                latest_packet_validation_created_at = created_at
        day_bucket = trend_by_day_map.setdefault(
            day_key,
            {
                "date": day_key,
                "events": 0,
                "errors": 0,
                "salesIntelligenceEvents": 0,
                "orchestrationEvents": 0,
            },
        )
        day_bucket["events"] += 1
        if event_type == "company_enrichment_orchestrated":
            day_bucket["orchestrationEvents"] += 1
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

    recent_events_source = events
    if packet_only_recent_events:
        filtered_events = []
        for event in events:
            payload = _coerce_payload_map(event.get("payload"))
            if (
                _resolve_event_packet_validation_status(event, payload) is not None
                or isinstance(
                    _resolve_event_packet_validation_within_freshness(event, payload),
                    bool,
                )
            ):
                filtered_events.append(event)
        recent_events_source = filtered_events
    if (
        governance_status_filter is not None
        or packet_validation_status_filter is not None
    ):
        filtered_events = []
        for event in recent_events_source:
            payload = _coerce_payload_map(event.get("payload"))
            normalized_governance_status = _resolve_event_governance_status(
                event,
                payload,
            )
            normalized_packet_status = _resolve_event_packet_validation_status(
                event,
                payload,
            )
            if (
                governance_status_filter is not None
                and normalized_governance_status != governance_status_filter
            ):
                continue
            if (
                packet_validation_status_filter is not None
                and normalized_packet_status != packet_validation_status_filter
            ):
                continue
            filtered_events.append(event)
        recent_events_source = filtered_events

    recent_events_capped_source = events[:50]
    recent_events_total_count = len(recent_events_capped_source)
    recent_events_packet_validation_count = 0
    for event in recent_events_capped_source:
        payload = _coerce_payload_map(event.get("payload"))
        if (
            _resolve_event_packet_validation_status(event, payload) is not None
            or isinstance(
                _resolve_event_packet_validation_within_freshness(event, payload),
                bool,
            )
        ):
            recent_events_packet_validation_count += 1
    recent_events_non_packet_count = max(
        0, recent_events_total_count - recent_events_packet_validation_count
    )

    recent_events = []
    recent_events_governance_status_counts: Dict[str, int] = {}
    recent_events_packet_validation_status_counts: Dict[str, int] = {}
    for event in recent_events_source[:50]:
        payload = _coerce_payload_map(event.get("payload"))
        schema_parity = _resolve_governance_schema_event_parity(payload)
        normalized_governance_status = _resolve_event_governance_status(
            event,
            payload,
        )
        normalized_packet_validation_status = _resolve_event_packet_validation_status(
            event,
            payload,
        )
        if normalized_governance_status is not None:
            recent_events_governance_status_counts[normalized_governance_status] = (
                recent_events_governance_status_counts.get(normalized_governance_status, 0)
                + 1
            )
        if normalized_packet_validation_status is not None:
            recent_events_packet_validation_status_counts[
                normalized_packet_validation_status
            ] = (
                recent_events_packet_validation_status_counts.get(
                    normalized_packet_validation_status, 0
                )
                + 1
            )
        recent_events.append(
            {
                "eventType": event.get("eventType"),
                "provider": event.get("provider"),
                "createdAt": event.get("createdAt"),
                "schemaVersion": _resolve_event_schema_version(event, payload),
                "requestId": _resolve_event_request_id(event, payload),
                "statusCode": payload.get("status_code"),
                "latencyMs": payload.get("latency_ms"),
                "resultCount": payload.get("result_count"),
                "savedCount": payload.get("saved_count"),
                "error": payload.get("error"),
                "traceabilityDecision": payload.get("decision"),
                "traceabilityReady": payload.get("traceability_ready"),
                "governanceStatus": normalized_governance_status,
                "governanceSchemaReasonCodeParityOk": schema_parity.get(
                    "reasonCodeParityOk"
                ),
                "governanceSchemaRecommendedCommandParityOk": schema_parity.get(
                    "recommendedCommandParityOk"
                ),
                "governanceSchemaHandoffParityOk": schema_parity.get("handoffParityOk"),
                "governanceSchemaAllParityOk": schema_parity.get("allParityOk"),
                "governanceSchemaRolloutBlocked": _normalize_optional_bool(
                    payload.get("rollout_blocked")
                ),
                "governanceSchemaReasonCodeCount": _coerce_non_negative_int_optional_strict(
                    payload.get("reason_code_count")
                ),
                "governanceSchemaRecommendedCommandCount": (
                    _coerce_non_negative_int_optional_strict(
                        payload.get("recommended_command_count")
                    )
                ),
                "governancePacketValidationStatus": normalized_packet_validation_status,
                "governancePacketValidationWithinFreshness": (
                    _resolve_event_packet_validation_within_freshness(event, payload)
                ),
                "connectorCredentialProvider": payload.get("provider"),
                "connectorCredentialAction": payload.get("action"),
                "connectorKeyRotated": payload.get("key_rotated"),
                "connectorRateLimitEndpoint": payload.get("endpoint"),
                "connectorRateLimitRetryAfterSeconds": payload.get("retry_after_seconds"),
                "connectorRateLimitResetInSeconds": payload.get("reset_in_seconds"),
                "connectorRateLimitWindowSeconds": payload.get("window_seconds"),
                "connectorRateLimitMaxRequests": payload.get("max_requests"),
                "connectorValidationProvider": payload.get("provider"),
                "connectorValidationEndpoint": payload.get("endpoint"),
                "connectorValidationField": payload.get("field"),
                "connectorValidationReason": payload.get("reason"),
                "connectorValidationErrorCode": payload.get("error_code"),
                "connectorValidationReceived": payload.get("received"),
                "connectorValidationMinimum": payload.get("minimum"),
                "connectorValidationMaximum": payload.get("maximum"),
                "timestampFallbackCount": payload.get("timestamp_fallback_count"),
                "futureSkewEventCount": payload.get("future_skew_event_count"),
                "staleEventCount": payload.get("stale_event_count"),
                "freshEventCount": payload.get("fresh_event_count"),
                "futureSkewEventTypeCounts": payload.get("future_skew_event_type_counts"),
                "staleEventTypeCounts": payload.get("stale_event_type_counts"),
                "timestampFallbackEventTypeCounts": payload.get(
                    "timestamp_fallback_event_type_counts"
                ),
                "timestampAgeBucketCounts": payload.get("timestamp_age_bucket_counts"),
                "futureSkewThresholdSeconds": payload.get(
                    "future_skew_threshold_seconds"
                ),
                "staleEventAgeThresholdSeconds": payload.get(
                    "stale_event_age_threshold_seconds"
                ),
                "timestampPressureLabel": payload.get("timestamp_pressure_label"),
                "timestampPressureHint": payload.get("timestamp_pressure_hint"),
                "timestampAnomalyCount": payload.get("timestamp_anomaly_count"),
                "timestampAnomalyRatePct": payload.get("timestamp_anomaly_rate_pct"),
                "timestampPressureHighAnomalyRatePct": payload.get(
                    "timestamp_pressure_high_anomaly_rate_pct"
                ),
                "timestampPressureModerateAnomalyRatePct": payload.get(
                    "timestamp_pressure_moderate_anomaly_rate_pct"
                ),
                "timestampPressureHighAnomalyCount": payload.get(
                    "timestamp_pressure_high_anomaly_count"
                ),
                "timestampPressureModerateAnomalyCount": payload.get(
                    "timestamp_pressure_moderate_anomaly_count"
                ),
                "timestampAnomalyEventTypeCounts": payload.get(
                    "timestamp_anomaly_event_type_counts"
                ),
                "timestampDominantAnomalyBucket": payload.get(
                    "timestamp_dominant_anomaly_bucket"
                ),
                "timestampDominantAnomalyBucketCount": payload.get(
                    "timestamp_dominant_anomaly_bucket_count"
                ),
                "timestampDominantAnomalyEventType": payload.get(
                    "timestamp_dominant_anomaly_event_type"
                ),
                "timestampDominantAnomalyEventTypeCount": payload.get(
                    "timestamp_dominant_anomaly_event_type_count"
                ),
                "retryOperation": payload.get("operation"),
                "retryAttempt": payload.get("attempt"),
                "retryMaxAttempts": payload.get("max_attempts"),
                "retryNextDelaySeconds": payload.get("next_delay_seconds"),
                "retryError": payload.get("error"),
                "retryFinalOutcome": payload.get("final_outcome"),
                "retryRetryable": payload.get("retryable"),
                "retryErrorType": payload.get("error_type"),
                "retryErrorStatusCode": payload.get("error_status_code"),
                "retryErrorReasonCode": payload.get("error_reason_code"),
                "orchestrationSelectedProvider": payload.get("selected_provider"),
                "orchestrationAttemptCount": payload.get("attempt_count"),
                "orchestrationAttemptSuccessCount": payload.get("attempt_success_count"),
                "orchestrationAttemptSkippedCount": payload.get("attempt_skipped_count"),
                "orchestrationAttemptErrorCount": payload.get("attempt_error_count"),
                "orchestrationAttemptReasonCodes": payload.get("attempt_reason_codes"),
                "orchestrationResultCount": payload.get("result_count"),
            }
        )

    recent_events_governance_status_counts_server = _normalize_status_count_map(
        recent_events_governance_status_counts
    )
    recent_events_packet_validation_status_counts_server = _normalize_status_count_map(
        recent_events_packet_validation_status_counts
    )
    recent_events_governance_status_counts_fallback = _build_status_count_map(
        [row.get("governanceStatus") for row in recent_events]
    )
    recent_events_packet_validation_status_counts_fallback = _build_status_count_map(
        [row.get("governancePacketValidationStatus") for row in recent_events]
    )
    recent_events_governance_status_counts_source = (
        "server"
        if len(recent_events_governance_status_counts_server) > 0
        else "local"
    )
    recent_events_packet_validation_status_counts_source = (
        "server"
        if len(recent_events_packet_validation_status_counts_server) > 0
        else "local"
    )
    recent_events_governance_status_counts_mismatch = (
        recent_events_governance_status_counts_source == "server"
        and not _status_count_maps_equal(
            recent_events_governance_status_counts_server,
            recent_events_governance_status_counts_fallback,
        )
    )
    recent_events_packet_validation_status_counts_mismatch = (
        recent_events_packet_validation_status_counts_source == "server"
        and not _status_count_maps_equal(
            recent_events_packet_validation_status_counts_server,
            recent_events_packet_validation_status_counts_fallback,
        )
    )
    recent_events_governance_status_counts_effective = (
        recent_events_governance_status_counts_server
        if recent_events_governance_status_counts_source == "server"
        else recent_events_governance_status_counts_fallback
    )
    recent_events_packet_validation_status_counts_effective = (
        recent_events_packet_validation_status_counts_server
        if recent_events_packet_validation_status_counts_source == "server"
        else recent_events_packet_validation_status_counts_fallback
    )
    recent_events_governance_status_counts_posture = (
        _classify_status_count_provenance_posture(
            recent_events_governance_status_counts_source,
            recent_events_governance_status_counts_mismatch,
        )
    )
    recent_events_packet_validation_status_counts_posture = (
        _classify_status_count_provenance_posture(
            recent_events_packet_validation_status_counts_source,
            recent_events_packet_validation_status_counts_mismatch,
        )
    )

    trend_by_day = sorted(trend_by_day_map.values(), key=lambda entry: entry["date"])
    sendgrid_timestamp_pressure_label_counts_sorted = {
        key: sendgrid_timestamp_pressure_label_counts[key]
        for key in sorted(sendgrid_timestamp_pressure_label_counts.keys())
    }
    sendgrid_timestamp_pressure_hint_counts_sorted = {
        key: sendgrid_timestamp_pressure_hint_counts[key]
        for key in sorted(sendgrid_timestamp_pressure_hint_counts.keys())
    }
    sendgrid_timestamp_age_bucket_counts_sorted = {
        key: sendgrid_timestamp_age_bucket_counts[key]
        for key in sorted(sendgrid_timestamp_age_bucket_counts.keys())
    }
    sendgrid_timestamp_anomaly_event_type_counts_sorted = {
        key: sendgrid_timestamp_anomaly_event_type_counts[key]
        for key in sorted(sendgrid_timestamp_anomaly_event_type_counts.keys())
    }
    sendgrid_timestamp_dominant_anomaly_bucket_counts_sorted = {
        key: sendgrid_timestamp_dominant_anomaly_bucket_counts[key]
        for key in sorted(sendgrid_timestamp_dominant_anomaly_bucket_counts.keys())
    }
    sendgrid_timestamp_dominant_anomaly_event_type_counts_sorted = {
        key: sendgrid_timestamp_dominant_anomaly_event_type_counts[key]
        for key in sorted(sendgrid_timestamp_dominant_anomaly_event_type_counts.keys())
    }
    sendgrid_timestamp_anomaly_count_total = sum(sendgrid_timestamp_anomaly_counts)
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
        "governanceAudit": {
            "eventCount": governance_snapshot_count + governance_baseline_count,
            "snapshotEvaluationCount": governance_snapshot_count,
            "baselineEvaluationCount": governance_baseline_count,
            "statusCounts": governance_status_counts,
            "latestEvaluatedAt": latest_governance_created_at,
        },
        "governanceSchemaAudit": {
            "eventCount": sum(governance_schema_status_counts.values()),
            "statusCounts": governance_schema_status_counts,
            "reasonCodeParityPassCount": governance_schema_reason_code_parity_pass_count,
            "reasonCodeParityFailCount": governance_schema_reason_code_parity_fail_count,
            "recommendedCommandParityPassCount": (
                governance_schema_recommended_command_parity_pass_count
            ),
            "recommendedCommandParityFailCount": (
                governance_schema_recommended_command_parity_fail_count
            ),
            "handoffParityPassCount": governance_schema_handoff_parity_pass_count,
            "handoffParityFailCount": governance_schema_handoff_parity_fail_count,
            "allParityPassedCount": governance_schema_all_parity_passed_count,
            "allParityFailedCount": governance_schema_all_parity_failed_count,
            "rolloutBlockedCount": governance_schema_rollout_blocked_count,
            "latestEvaluatedAt": latest_governance_schema_created_at,
        },
        "packetValidationAudit": {
            "eventCount": sum(packet_validation_status_counts.values()),
            "statusCounts": packet_validation_status_counts,
            "withinFreshnessCount": packet_validation_within_freshness_count,
            "outsideFreshnessCount": packet_validation_outside_freshness_count,
            "missingFreshnessCount": packet_validation_missing_freshness_count,
            "latestEvaluatedAt": latest_packet_validation_created_at,
        },
        "connectorLifecycle": {
            "eventCount": sum(connector_lifecycle_by_action.values()),
            "byAction": connector_lifecycle_by_action,
            "byProvider": connector_lifecycle_by_provider,
            "latestEventAt": latest_connector_lifecycle_created_at,
        },
        "connectorRateLimit": {
            "eventCount": sum(connector_rate_limit_by_endpoint.values()),
            "byEndpoint": connector_rate_limit_by_endpoint,
            "maxRetryAfterSeconds": (
                max(connector_rate_limit_retry_after_seconds)
                if connector_rate_limit_retry_after_seconds
                else None
            ),
            "avgRetryAfterSeconds": (
                round(
                    sum(connector_rate_limit_retry_after_seconds)
                    / len(connector_rate_limit_retry_after_seconds),
                    2,
                )
                if connector_rate_limit_retry_after_seconds
                else None
            ),
            "maxResetInSeconds": (
                max(connector_rate_limit_reset_in_seconds)
                if connector_rate_limit_reset_in_seconds
                else None
            ),
            "avgResetInSeconds": (
                round(
                    sum(connector_rate_limit_reset_in_seconds)
                    / len(connector_rate_limit_reset_in_seconds),
                    2,
                )
                if connector_rate_limit_reset_in_seconds
                else None
            ),
            "latestEventAt": latest_connector_rate_limit_created_at,
        },
        "connectorValidation": {
            "eventCount": sum(connector_validation_by_endpoint.values()),
            "byEndpoint": connector_validation_by_endpoint,
            "byProvider": connector_validation_by_provider,
            "byField": connector_validation_by_field,
            "byReason": connector_validation_by_reason,
            "latestEventAt": latest_connector_validation_created_at,
        },
        "sendgridWebhookTimestamp": {
            "eventCount": sendgrid_webhook_timestamp_event_count,
            "pressureLabelCounts": sendgrid_timestamp_pressure_label_counts_sorted,
            "pressureHintCounts": sendgrid_timestamp_pressure_hint_counts_sorted,
            "timestampFallbackCount": sendgrid_timestamp_fallback_count_total,
            "futureSkewEventCount": sendgrid_timestamp_future_skew_event_count_total,
            "staleEventCount": sendgrid_timestamp_stale_event_count_total,
            "freshEventCount": sendgrid_timestamp_fresh_event_count_total,
            "timestampAnomalyCountTotal": sendgrid_timestamp_anomaly_count_total,
            "avgTimestampAnomalyCount": (
                round(
                    sendgrid_timestamp_anomaly_count_total
                    / len(sendgrid_timestamp_anomaly_counts),
                    2,
                )
                if sendgrid_timestamp_anomaly_counts
                else None
            ),
            "avgTimestampAnomalyRatePct": (
                round(
                    sum(sendgrid_timestamp_anomaly_rate_pct_values)
                    / len(sendgrid_timestamp_anomaly_rate_pct_values),
                    2,
                )
                if sendgrid_timestamp_anomaly_rate_pct_values
                else None
            ),
            "maxTimestampAnomalyRatePct": (
                round(max(sendgrid_timestamp_anomaly_rate_pct_values), 2)
                if sendgrid_timestamp_anomaly_rate_pct_values
                else None
            ),
            "timestampAgeBucketCounts": sendgrid_timestamp_age_bucket_counts_sorted,
            "timestampAnomalyEventTypeCounts": (
                sendgrid_timestamp_anomaly_event_type_counts_sorted
            ),
            "timestampDominantAnomalyBucketCounts": (
                sendgrid_timestamp_dominant_anomaly_bucket_counts_sorted
            ),
            "timestampDominantAnomalyEventTypeCounts": (
                sendgrid_timestamp_dominant_anomaly_event_type_counts_sorted
            ),
            "timestampPressureHighAnomalyRatePct": (
                max(sendgrid_timestamp_pressure_high_anomaly_rate_thresholds)
                if sendgrid_timestamp_pressure_high_anomaly_rate_thresholds
                else None
            ),
            "timestampPressureModerateAnomalyRatePct": (
                max(sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds)
                if sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds
                else None
            ),
            "timestampPressureHighAnomalyCount": (
                max(sendgrid_timestamp_pressure_high_anomaly_count_thresholds)
                if sendgrid_timestamp_pressure_high_anomaly_count_thresholds
                else None
            ),
            "timestampPressureModerateAnomalyCount": (
                max(sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds)
                if sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds
                else None
            ),
            "latestEventAt": latest_sendgrid_webhook_timestamp_created_at,
        },
        "retryAudit": {
            "eventCount": sum(retry_audit_by_operation.values()),
            "byOperation": retry_audit_by_operation,
            "byProvider": retry_audit_by_provider,
            "maxNextDelaySeconds": (
                round(max(retry_audit_next_delay_seconds), 3)
                if retry_audit_next_delay_seconds
                else None
            ),
            "avgNextDelaySeconds": (
                round(
                    sum(retry_audit_next_delay_seconds)
                    / len(retry_audit_next_delay_seconds),
                    3,
                )
                if retry_audit_next_delay_seconds
                else None
            ),
            "latestEventAt": latest_retry_audit_created_at,
        },
        "orchestrationAudit": {
            "eventCount": sum(orchestration_audit_by_selected_provider.values()),
            "bySelectedProvider": {
                key: orchestration_audit_by_selected_provider[key]
                for key in sorted(orchestration_audit_by_selected_provider.keys())
            },
            "attemptStatusCounts": orchestration_attempt_status_counts,
            "reasonCodeCounts": {
                key: orchestration_attempt_reason_code_counts[key]
                for key in sorted(orchestration_attempt_reason_code_counts.keys())
            },
            "maxAttemptCount": (
                max(orchestration_attempt_counts)
                if orchestration_attempt_counts
                else None
            ),
            "avgAttemptCount": (
                round(
                    sum(orchestration_attempt_counts)
                    / len(orchestration_attempt_counts),
                    2,
                )
                if orchestration_attempt_counts
                else None
            ),
            "maxLatencyMs": (
                round(max(orchestration_latency_ms), 2)
                if orchestration_latency_ms
                else None
            ),
            "avgLatencyMs": (
                round(
                    sum(orchestration_latency_ms)
                    / len(orchestration_latency_ms),
                    2,
                )
                if orchestration_latency_ms
                else None
            ),
            "trendByDay": [
                orchestration_trend_by_day_map[trend_day_key]
                for trend_day_key in sorted(orchestration_trend_by_day_map.keys())
            ],
            "latestEventAt": latest_orchestration_created_at,
        },
        "recentEventsFilter": "packet" if packet_only_recent_events else "all",
        "recentEventsGovernanceStatusFilter": governance_status_filter,
        "recentEventsPacketValidationStatusFilter": packet_validation_status_filter,
        "recentEventsTotalCount": recent_events_total_count,
        "recentEventsFilteredCount": len(recent_events),
        "recentEventsPacketValidationCount": recent_events_packet_validation_count,
        "recentEventsNonPacketCount": recent_events_non_packet_count,
        "recentEventsGovernanceStatusCounts": (
            recent_events_governance_status_counts_effective
        ),
        "recentEventsPacketValidationStatusCounts": (
            recent_events_packet_validation_status_counts_effective
        ),
        "recentEventsGovernanceStatusCountsSource": (
            recent_events_governance_status_counts_source
        ),
        "recentEventsPacketValidationStatusCountsSource": (
            recent_events_packet_validation_status_counts_source
        ),
        "recentEventsGovernanceStatusCountsMismatch": (
            recent_events_governance_status_counts_mismatch
        ),
        "recentEventsPacketValidationStatusCountsMismatch": (
            recent_events_packet_validation_status_counts_mismatch
        ),
        "recentEventsGovernanceStatusCountsServer": (
            recent_events_governance_status_counts_server
        ),
        "recentEventsPacketValidationStatusCountsServer": (
            recent_events_packet_validation_status_counts_server
        ),
        "recentEventsGovernanceStatusCountsFallback": (
            recent_events_governance_status_counts_fallback
        ),
        "recentEventsPacketValidationStatusCountsFallback": (
            recent_events_packet_validation_status_counts_fallback
        ),
        "recentEventsGovernanceStatusCountsPosture": (
            recent_events_governance_status_counts_posture.get("posture")
        ),
        "recentEventsPacketValidationStatusCountsPosture": (
            recent_events_packet_validation_status_counts_posture.get("posture")
        ),
        "recentEventsGovernanceStatusCountsPostureSeverity": (
            recent_events_governance_status_counts_posture.get("severity")
        ),
        "recentEventsPacketValidationStatusCountsPostureSeverity": (
            recent_events_packet_validation_status_counts_posture.get("severity")
        ),
        "recentEventsGovernanceStatusCountsRequiresInvestigation": (
            recent_events_governance_status_counts_posture.get(
                "requiresInvestigation"
            )
        ),
        "recentEventsPacketValidationStatusCountsRequiresInvestigation": (
            recent_events_packet_validation_status_counts_posture.get(
                "requiresInvestigation"
            )
        ),
        "recentEvents": recent_events,
    }


@router.get("/integrations/telemetry/governance-schema")
async def get_integrations_governance_schema_metadata(
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return governance export schema metadata for operator preflight checks."""
    db = get_db()
    schema_metadata = _build_governance_schema_metadata()
    override_metadata = schema_metadata.get("override", {})
    override_is_set = bool(override_metadata.get("isSet"))
    override_is_valid = bool(override_metadata.get("isValid"))
    status = "READY" if (not override_is_set or override_is_valid) else "ACTION_REQUIRED"
    rollout_blocked = status == "ACTION_REQUIRED"
    alerts: List[str] = []
    if status == "ACTION_REQUIRED":
        alerts.append(
            "GOVERNANCE_EXPORT_SCHEMA_VERSION is invalid and default fallback is active."
        )
    owner_action_matrix: List[Dict[str, Any]] = []
    if status == "ACTION_REQUIRED":
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_schema_invalid_override",
                "action": "Schema override is invalid. Correct the override and rerun the extended sales verification chain.",
                "command": "npm run verify:ci:sales:extended",
            }
        )
    if not owner_action_matrix:
        owner_action_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "governance_schema_ready",
                "action": "Schema metadata is healthy. Continue schema and packet contract checks.",
                "command": "npm run verify:governance:schema:preflight",
            }
        )

    reason_codes = _attach_governance_reason_codes(
        owner_action_matrix,
        fallback="governance_schema",
    )
    recommended_commands = _normalize_recommended_commands(
        [item.get("command") for item in owner_action_matrix]
        + [
            "npm run verify:governance:schema:preflight",
            "npm run verify:governance:weekly:endpoint:contract",
            "npm run verify:governance:packet:contract",
            "npm run verify:smoke:governance-packet",
        ]
    )

    now = datetime.now(timezone.utc)
    governance_export = {
        "governanceType": "schema_metadata",
        "status": status,
        "rolloutBlocked": rollout_blocked,
        "ownerRole": "Release Manager",
        "schemaMetadata": schema_metadata,
        "alerts": [
            {
                "severity": item.get("severity", "info"),
                "ownerRole": item.get("ownerRole", "Release Manager"),
                "message": item.get("action"),
                "trigger": item.get("trigger"),
                "command": item.get("command"),
                "reasonCode": item.get("reasonCode"),
            }
            for item in owner_action_matrix
        ],
        "actions": owner_action_matrix,
        "reasonCodes": reason_codes,
        "recommendedCommands": recommended_commands,
        "evaluatedAt": now.isoformat(),
        "requestedBy": current_user.get("id"),
    }
    handoff_payload = {
        "rolloutBlocked": rollout_blocked,
        "ownerRole": "Release Manager",
        "actions": [item.get("action") for item in owner_action_matrix if item.get("action")],
    }
    schema_contract_parity = _build_governance_schema_contract_parity(
        reason_codes=reason_codes,
        recommended_commands=recommended_commands,
        handoff=handoff_payload,
        rollout_actions=owner_action_matrix,
        governance_export=governance_export,
        evaluated_at=now.isoformat(),
    )
    reason_code_parity_ok = _is_schema_parity_group_valid(
        schema_contract_parity.get("reasonCodeParity", {})
    )
    recommended_command_parity_ok = _is_schema_parity_group_valid(
        schema_contract_parity.get("recommendedCommandParity", {})
    )
    handoff_parity_payload = schema_contract_parity.get("handoffParity", {})
    handoff_parity_ok = _is_schema_parity_group_valid(
        {
            "rolloutBlockedMatchesExport": handoff_parity_payload.get(
                "rolloutBlockedMatchesExport"
            ),
            "ownerRoleMatchesExport": handoff_parity_payload.get(
                "ownerRoleMatchesExport"
            ),
            "handoffActionsMatchRolloutActions": handoff_parity_payload.get(
                "handoffActionsMatchRolloutActions"
            ),
        }
    )

    response_payload = {
        "generatedAt": now.isoformat(),
        "governanceType": "schema_metadata",
        "status": status,
        "schemaMetadata": schema_metadata,
        "alerts": alerts,
        "reasonCodes": reason_codes,
        "handoff": handoff_payload,
        "rolloutActions": owner_action_matrix,
        "recommendedCommands": recommended_commands,
        "schemaContractParity": schema_contract_parity,
        "governanceExport": governance_export,
        "requestedBy": current_user.get("id"),
    }
    schema_event_payload = {
        "status": status,
        "rollout_blocked": rollout_blocked,
        "schema_metadata_source": schema_metadata.get("source"),
        "active_version": schema_metadata.get("activeVersion"),
        "default_version": schema_metadata.get("defaultVersion"),
        "supported_versions": schema_metadata.get("supportedVersions"),
        "override_is_set": override_is_set,
        "override_is_valid": override_is_valid,
        "reason_codes": reason_codes,
        "reason_code_count": len(reason_codes),
        "recommended_commands": recommended_commands,
        "recommended_command_count": len(recommended_commands),
        "reason_code_parity_ok": reason_code_parity_ok,
        "recommended_command_parity_ok": recommended_command_parity_ok,
        "handoff_parity_ok": handoff_parity_ok,
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_GOVERNANCE_SCHEMA_EVENT_TYPE,
        schema_event_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=db,
        event_type=TRACEABILITY_GOVERNANCE_SCHEMA_EVENT_TYPE,
        user_id=current_user["id"],
        payload=schema_event_payload,
        request_id=request_id,
    )
    return response_payload


@router.get("/integrations/telemetry/governance-report")
async def get_integrations_governance_report(
    days: int = 7,
    limit: int = 1000,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return weekly governance trend report for rollout-signoff evidence."""
    governance_export_schema_version = _get_governance_export_schema_version()
    schema_metadata = _build_governance_schema_metadata()
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

    governance_status_counts: Dict[str, int] = {}
    traceability_decision_counts: Dict[str, int] = {}
    timeline_map: Dict[str, Dict[str, Any]] = {}
    latest_events: List[Dict[str, Any]] = []
    snapshot_evaluation_count = 0
    baseline_evaluation_count = 0
    action_required_count = 0
    rollout_blocked_count = 0
    connector_rate_limit_by_endpoint: Dict[str, int] = {}
    connector_rate_limit_retry_after_seconds: List[int] = []
    connector_rate_limit_reset_in_seconds: List[int] = []
    latest_connector_rate_limit_created_at: Optional[str] = None
    sendgrid_webhook_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_counts: List[int] = []
    sendgrid_timestamp_anomaly_rate_pct_values: List[float] = []
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds: List[float] = []
    sendgrid_timestamp_pressure_high_anomaly_count_thresholds: List[int] = []
    sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds: List[int] = []
    latest_sendgrid_webhook_timestamp_created_at: Optional[str] = None

    for event in events:
        event_type = str(event.get("eventType") or "")
        payload = _coerce_payload_map(event.get("payload"))
        created_at = str(event.get("createdAt") or "")
        if event_type == CONNECTOR_RATE_LIMIT_EVENT_TYPE:
            endpoint = _normalize_connector_rate_limit_endpoint_key(
                payload.get("endpoint")
            )
            connector_rate_limit_by_endpoint[endpoint] = (
                connector_rate_limit_by_endpoint.get(endpoint, 0) + 1
            )
            retry_after_seconds = _coerce_non_negative_int(
                payload.get("retry_after_seconds"),
                fallback=0,
            )
            if retry_after_seconds > 0:
                connector_rate_limit_retry_after_seconds.append(retry_after_seconds)
            reset_in_seconds = _coerce_non_negative_int(
                payload.get("reset_in_seconds"),
                fallback=retry_after_seconds,
            )
            if reset_in_seconds > 0:
                connector_rate_limit_reset_in_seconds.append(reset_in_seconds)
            if created_at and (
                latest_connector_rate_limit_created_at is None
                or created_at > latest_connector_rate_limit_created_at
            ):
                latest_connector_rate_limit_created_at = created_at
            continue
        if event_type == "sendgrid_webhook_processed":
            sendgrid_webhook_timestamp_event_count += 1
            pressure_label = _normalize_sendgrid_timestamp_pressure_label(
                payload.get("timestamp_pressure_label")
            )
            sendgrid_timestamp_pressure_label_counts[pressure_label] = (
                sendgrid_timestamp_pressure_label_counts.get(pressure_label, 0) + 1
            )
            pressure_hint = str(payload.get("timestamp_pressure_hint") or "").strip()
            if not pressure_hint:
                pressure_hint = "Timestamp posture not available."
            sendgrid_timestamp_pressure_hint_counts[pressure_hint] = (
                sendgrid_timestamp_pressure_hint_counts.get(pressure_hint, 0) + 1
            )

            anomaly_count = _coerce_non_negative_int_optional(
                payload.get("timestamp_anomaly_count")
            )
            if anomaly_count is not None:
                sendgrid_timestamp_anomaly_counts.append(anomaly_count)
            anomaly_rate_pct = _coerce_non_negative_float(
                payload.get("timestamp_anomaly_rate_pct"),
                fallback=None,
            )
            if anomaly_rate_pct is not None:
                sendgrid_timestamp_anomaly_rate_pct_values.append(anomaly_rate_pct)

            high_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                payload.get("timestamp_pressure_high_anomaly_rate_pct"),
                fallback=None,
            )
            if high_anomaly_rate_pct_threshold is not None:
                sendgrid_timestamp_pressure_high_anomaly_rate_thresholds.append(
                    high_anomaly_rate_pct_threshold
                )
            moderate_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                payload.get("timestamp_pressure_moderate_anomaly_rate_pct"),
                fallback=None,
            )
            if moderate_anomaly_rate_pct_threshold is not None:
                sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds.append(
                    moderate_anomaly_rate_pct_threshold
                )
            high_anomaly_count_threshold = _coerce_non_negative_int_optional(
                payload.get("timestamp_pressure_high_anomaly_count")
            )
            if high_anomaly_count_threshold is not None:
                sendgrid_timestamp_pressure_high_anomaly_count_thresholds.append(
                    high_anomaly_count_threshold
                )
            moderate_anomaly_count_threshold = _coerce_non_negative_int_optional(
                payload.get("timestamp_pressure_moderate_anomaly_count")
            )
            if moderate_anomaly_count_threshold is not None:
                sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds.append(
                    moderate_anomaly_count_threshold
                )

            fallback_count = _coerce_non_negative_int_optional(
                payload.get("timestamp_fallback_count")
            )
            if fallback_count is not None:
                sendgrid_timestamp_fallback_count_total += fallback_count
            future_skew_count = _coerce_non_negative_int_optional(
                payload.get("future_skew_event_count")
            )
            if future_skew_count is not None:
                sendgrid_timestamp_future_skew_event_count_total += future_skew_count
            stale_event_count = _coerce_non_negative_int_optional(
                payload.get("stale_event_count")
            )
            if stale_event_count is not None:
                sendgrid_timestamp_stale_event_count_total += stale_event_count
            fresh_event_count = _coerce_non_negative_int_optional(
                payload.get("fresh_event_count")
            )
            if fresh_event_count is not None:
                sendgrid_timestamp_fresh_event_count_total += fresh_event_count

            age_bucket_counts = payload.get("timestamp_age_bucket_counts")
            if isinstance(age_bucket_counts, dict):
                for raw_bucket, raw_count in age_bucket_counts.items():
                    bucket_key = _normalize_sendgrid_timestamp_bucket_key(raw_bucket)
                    normalized_count = _coerce_non_negative_int_optional(raw_count)
                    if bucket_key is None or normalized_count is None:
                        continue
                    sendgrid_timestamp_age_bucket_counts[bucket_key] = (
                        sendgrid_timestamp_age_bucket_counts.get(bucket_key, 0)
                        + normalized_count
                    )

            anomaly_event_type_counts = payload.get("timestamp_anomaly_event_type_counts")
            if isinstance(anomaly_event_type_counts, dict):
                for raw_event_type, raw_count in anomaly_event_type_counts.items():
                    normalized_count = _coerce_non_negative_int_optional(raw_count)
                    if normalized_count is None:
                        continue
                    normalized_event_type = _normalize_sendgrid_event_type(raw_event_type)
                    sendgrid_timestamp_anomaly_event_type_counts[normalized_event_type] = (
                        sendgrid_timestamp_anomaly_event_type_counts.get(
                            normalized_event_type, 0
                        )
                        + normalized_count
                    )

            dominant_bucket = _normalize_sendgrid_timestamp_bucket_key(
                payload.get("timestamp_dominant_anomaly_bucket")
            )
            if dominant_bucket is not None:
                sendgrid_timestamp_dominant_anomaly_bucket_counts[dominant_bucket] = (
                    sendgrid_timestamp_dominant_anomaly_bucket_counts.get(
                        dominant_bucket, 0
                    )
                    + 1
                )

            dominant_event_type_raw = str(
                payload.get("timestamp_dominant_anomaly_event_type") or ""
            ).strip()
            if dominant_event_type_raw:
                dominant_event_type = _normalize_sendgrid_event_type(
                    dominant_event_type_raw
                )
                sendgrid_timestamp_dominant_anomaly_event_type_counts[
                    dominant_event_type
                ] = (
                    sendgrid_timestamp_dominant_anomaly_event_type_counts.get(
                        dominant_event_type, 0
                    )
                    + 1
                )

            if created_at and (
                latest_sendgrid_webhook_timestamp_created_at is None
                or created_at > latest_sendgrid_webhook_timestamp_created_at
            ):
                latest_sendgrid_webhook_timestamp_created_at = created_at
            continue
        if event_type not in {
            TRACEABILITY_AUDIT_EVENT_TYPE,
            TRACEABILITY_GOVERNANCE_EVENT_TYPE,
            TRACEABILITY_BASELINE_GOVERNANCE_EVENT_TYPE,
        }:
            continue

        day_key = created_at[:10] if len(created_at) >= 10 else "unknown"
        day_bucket = timeline_map.setdefault(
            day_key,
            {
                "date": day_key,
                "traceabilityEvents": 0,
                "snapshotGovernanceEvents": 0,
                "baselineGovernanceEvents": 0,
                "actionRequiredEvents": 0,
                "holdDecisions": 0,
                "proceedDecisions": 0,
                "statusCounts": {},
            },
        )
        request_id = _resolve_event_request_id(event, payload)

        if event_type == TRACEABILITY_AUDIT_EVENT_TYPE:
            decision = _normalize_status_token_with_allowlist(
                event.get("traceabilityDecision") or payload.get("decision"),
                TRACEABILITY_DECISION_ALLOWED_TOKENS,
            )
            traceability_decision_counts[decision] = (
                traceability_decision_counts.get(decision, 0) + 1
            )
            day_bucket["traceabilityEvents"] += 1
            if decision == "HOLD":
                day_bucket["holdDecisions"] += 1
                rollout_blocked_count += 1
            elif decision == "PROCEED":
                day_bucket["proceedDecisions"] += 1
            latest_events.append(
                {
                    "createdAt": created_at,
                    "eventType": event_type,
                    "governanceType": "traceability",
                    "status": None,
                    "decision": decision,
                    "requestId": request_id,
                    "rolloutBlocked": decision == "HOLD",
                }
            )
            continue

        status = _normalize_status_token_with_allowlist(
            _resolve_event_governance_status(event, payload),
            GOVERNANCE_STATUS_ALLOWED_TOKENS,
        )
        governance_status_counts[status] = governance_status_counts.get(status, 0) + 1
        day_bucket["statusCounts"][status] = (
            int(day_bucket["statusCounts"].get(status, 0)) + 1
        )
        governance_type = "snapshot"
        if event_type == TRACEABILITY_GOVERNANCE_EVENT_TYPE:
            snapshot_evaluation_count += 1
            day_bucket["snapshotGovernanceEvents"] += 1
        else:
            governance_type = "baseline"
            baseline_evaluation_count += 1
            day_bucket["baselineGovernanceEvents"] += 1

        if status == "ACTION_REQUIRED":
            action_required_count += 1
            day_bucket["actionRequiredEvents"] += 1

        rollout_blocked = bool(
            _normalize_optional_bool(event.get("governanceSchemaRolloutBlocked"))
            if event.get("governanceSchemaRolloutBlocked") is not None
            else payload.get("rollout_blocked")
        ) or status in {
            "ACTION_REQUIRED",
            "FAIL",
        }
        if rollout_blocked:
            rollout_blocked_count += 1

        latest_events.append(
            {
                "createdAt": created_at,
                "eventType": event_type,
                "governanceType": governance_type,
                "status": status,
                "decision": None,
                "requestId": request_id,
                "rolloutBlocked": rollout_blocked,
            }
        )

    timeline = [timeline_map[key] for key in sorted(timeline_map.keys())]
    latest_events = latest_events[:20]
    governance_event_count = snapshot_evaluation_count + baseline_evaluation_count
    traceability_evaluation_count = sum(traceability_decision_counts.values())
    connector_rate_limit_event_count = sum(connector_rate_limit_by_endpoint.values())
    connector_rate_limit_max_retry = (
        float(max(connector_rate_limit_retry_after_seconds))
        if connector_rate_limit_retry_after_seconds
        else None
    )
    connector_rate_limit_avg_retry = (
        round(
            sum(connector_rate_limit_retry_after_seconds)
            / len(connector_rate_limit_retry_after_seconds),
            2,
        )
        if connector_rate_limit_retry_after_seconds
        else None
    )
    connector_rate_limit_max_reset = (
        float(max(connector_rate_limit_reset_in_seconds))
        if connector_rate_limit_reset_in_seconds
        else None
    )
    connector_rate_limit_avg_reset = (
        round(
            sum(connector_rate_limit_reset_in_seconds)
            / len(connector_rate_limit_reset_in_seconds),
            2,
        )
        if connector_rate_limit_reset_in_seconds
        else None
    )
    connector_rate_limit_rollup = {
        "eventCount": connector_rate_limit_event_count,
        "byEndpoint": connector_rate_limit_by_endpoint,
        "latestEventAt": latest_connector_rate_limit_created_at,
        "maxRetryAfterSeconds": connector_rate_limit_max_retry,
        "avgRetryAfterSeconds": connector_rate_limit_avg_retry,
        "maxResetInSeconds": connector_rate_limit_max_reset,
        "avgResetInSeconds": connector_rate_limit_avg_reset,
        "pressure": _resolve_connector_rate_limit_pressure(
            connector_rate_limit_max_retry,
            connector_rate_limit_avg_reset,
        ),
    }
    sendgrid_webhook_timestamp_rollup = _normalize_sendgrid_webhook_timestamp_rollup(
        {
            "eventCount": sendgrid_webhook_timestamp_event_count,
            "pressureLabelCounts": sendgrid_timestamp_pressure_label_counts,
            "pressureHintCounts": sendgrid_timestamp_pressure_hint_counts,
            "timestampFallbackCount": sendgrid_timestamp_fallback_count_total,
            "futureSkewEventCount": sendgrid_timestamp_future_skew_event_count_total,
            "staleEventCount": sendgrid_timestamp_stale_event_count_total,
            "freshEventCount": sendgrid_timestamp_fresh_event_count_total,
            "timestampAnomalyCountTotal": sum(sendgrid_timestamp_anomaly_counts),
            "avgTimestampAnomalyCount": (
                round(
                    sum(sendgrid_timestamp_anomaly_counts)
                    / len(sendgrid_timestamp_anomaly_counts),
                    2,
                )
                if sendgrid_timestamp_anomaly_counts
                else None
            ),
            "avgTimestampAnomalyRatePct": (
                round(
                    sum(sendgrid_timestamp_anomaly_rate_pct_values)
                    / len(sendgrid_timestamp_anomaly_rate_pct_values),
                    2,
                )
                if sendgrid_timestamp_anomaly_rate_pct_values
                else None
            ),
            "maxTimestampAnomalyRatePct": (
                round(max(sendgrid_timestamp_anomaly_rate_pct_values), 2)
                if sendgrid_timestamp_anomaly_rate_pct_values
                else None
            ),
            "timestampAgeBucketCounts": sendgrid_timestamp_age_bucket_counts,
            "timestampAnomalyEventTypeCounts": (
                sendgrid_timestamp_anomaly_event_type_counts
            ),
            "timestampDominantAnomalyBucketCounts": (
                sendgrid_timestamp_dominant_anomaly_bucket_counts
            ),
            "timestampDominantAnomalyEventTypeCounts": (
                sendgrid_timestamp_dominant_anomaly_event_type_counts
            ),
            "timestampPressureHighAnomalyRatePct": (
                max(sendgrid_timestamp_pressure_high_anomaly_rate_thresholds)
                if sendgrid_timestamp_pressure_high_anomaly_rate_thresholds
                else None
            ),
            "timestampPressureModerateAnomalyRatePct": (
                max(sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds)
                if sendgrid_timestamp_pressure_moderate_anomaly_rate_thresholds
                else None
            ),
            "timestampPressureHighAnomalyCount": (
                max(sendgrid_timestamp_pressure_high_anomaly_count_thresholds)
                if sendgrid_timestamp_pressure_high_anomaly_count_thresholds
                else None
            ),
            "timestampPressureModerateAnomalyCount": (
                max(sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds)
                if sendgrid_timestamp_pressure_moderate_anomaly_count_thresholds
                else None
            ),
            "latestEventAt": latest_sendgrid_webhook_timestamp_created_at,
        }
    )
    runtime_prereqs_rollup = _resolve_baseline_runtime_prereqs_rollup()
    runtime_prereqs_needs_remediation = _runtime_prereqs_needs_remediation(
        runtime_prereqs_rollup
    )
    runtime_prereqs_missing_checks = _coerce_payload_map(
        runtime_prereqs_rollup.get("missingChecks")
    )
    runtime_prereqs_missing_commands = _normalize_string_list(
        runtime_prereqs_missing_checks.get("commands")
    )
    runtime_prereqs_missing_workspace = _normalize_string_list(
        runtime_prereqs_missing_checks.get("workspace")
    )
    runtime_prereqs_missing_check_count = _coerce_non_negative_int(
        runtime_prereqs_rollup.get("missingCheckCount"),
        len(runtime_prereqs_missing_commands) + len(runtime_prereqs_missing_workspace),
    )
    has_governance_telemetry_evidence = (
        governance_event_count + traceability_evaluation_count
    ) > 0

    owner_action_matrix: List[Dict[str, Any]] = []
    if not has_governance_telemetry_evidence:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_telemetry_missing",
                "action": "No governance telemetry evidence was found for the selected window. Regenerate weekly governance evidence artifacts.",
                "command": "npm run verify:governance:weekly",
            }
        )
    if action_required_count > 0:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_action_required",
                "action": "Run traceability cleanup policy checks and resolve stale snapshot governance blockers.",
                "command": "npm run verify:telemetry:traceability:cleanup:policy",
            }
        )
    if governance_status_counts.get("FAIL", 0) > 0:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "QA Engineer",
                "trigger": "baseline_governance_fail",
                "action": "Run baseline-governance drift smoke and recover baseline metrics artifact integrity.",
                "command": "npm run verify:smoke:baseline-governance-drift",
            }
        )
    if runtime_prereqs_needs_remediation:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_runtime_prereqs_failed",
                "action": "Run runtime prerequisite remediation checks and restore baseline runtime artifact readiness.",
                "command": BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND,
            }
        )
    if traceability_decision_counts.get("HOLD", 0) > 0:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "On-call Engineer",
                "trigger": "traceability_hold",
                "action": "Run governance handoff smoke and resolve rollout-blocking traceability alerts.",
                "command": "npm run verify:smoke:traceability-governance-handoff",
            }
        )
    if not owner_action_matrix:
        owner_action_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "governance_ready",
                "action": "Governance trend is healthy; keep evidence current and continue rollout signoff review.",
                "command": "npm run verify:ci:sales:extended",
            }
        )
    reason_codes = _attach_governance_reason_codes(
        owner_action_matrix,
        fallback="governance_report",
    )

    recommended_commands: List[str] = []
    for item in owner_action_matrix:
        command = str(item.get("command") or "").strip()
        if command and command not in recommended_commands:
            recommended_commands.append(command)
    if "npm run verify:governance:weekly:report" not in recommended_commands:
        recommended_commands.append("npm run verify:governance:weekly:report")
    if "npm run verify:ci:sales:extended" not in recommended_commands:
        recommended_commands.append("npm run verify:ci:sales:extended")
    recommended_commands = _normalize_recommended_commands(recommended_commands)

    governance_status = "READY"
    if (
        not has_governance_telemetry_evidence
        or action_required_count > 0
        or governance_status_counts.get("FAIL", 0) > 0
        or runtime_prereqs_needs_remediation
    ):
        governance_status = "ACTION_REQUIRED"
    if traceability_decision_counts.get("HOLD", 0) > 0:
        governance_status = "ACTION_REQUIRED"

    rollout_blocked = governance_status == "ACTION_REQUIRED"
    alerts: List[str] = []
    if not has_governance_telemetry_evidence:
        alerts.append(
            "No governance telemetry events were captured in the selected window."
        )
    if action_required_count > 0:
        alerts.append("Snapshot governance contains ACTION_REQUIRED evaluations.")
    if governance_status_counts.get("FAIL", 0) > 0:
        alerts.append("Baseline governance includes FAIL evaluations.")
    if runtime_prereqs_needs_remediation:
        if runtime_prereqs_rollup.get("available") is not True:
            alerts.append("Runtime prerequisite artifact evidence is unavailable.")
        if runtime_prereqs_rollup.get("contractValid") is not True:
            alerts.append("Runtime prerequisite artifact contract is invalid or missing.")
        if (
            runtime_prereqs_rollup.get("valid") is not True
            or runtime_prereqs_rollup.get("passed") is not True
            or runtime_prereqs_missing_check_count > 0
        ):
            missing_components: List[str] = []
            if runtime_prereqs_missing_commands:
                missing_components.append(
                    "commands: " + ", ".join(runtime_prereqs_missing_commands)
                )
            if runtime_prereqs_missing_workspace:
                missing_components.append(
                    "workspace: " + ", ".join(runtime_prereqs_missing_workspace)
                )
            detail_suffix = (
                f" ({'; '.join(missing_components)})" if missing_components else ""
            )
            alerts.append(
                "Runtime prerequisite checks failed or are incomplete." + detail_suffix
            )
    if traceability_decision_counts.get("HOLD", 0) > 0:
        alerts.append("Traceability HOLD decisions are blocking rollout progression.")
    if not alerts:
        alerts.append("Governance weekly rollup is healthy.")

    handoff = {
        "rolloutBlocked": rollout_blocked,
        "ownerRole": "Release Manager",
        "actions": [item.get("action") for item in owner_action_matrix if item.get("action")],
    }
    governance_export = {
        "governanceType": "weekly_report",
        "exportSchemaVersion": governance_export_schema_version,
        "status": governance_status,
        "rolloutBlocked": rollout_blocked,
        "ownerRole": handoff["ownerRole"],
        "connectorRateLimit": connector_rate_limit_rollup,
        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp_rollup,
        "runtimePrereqs": runtime_prereqs_rollup,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "alerts": [
            {
                "severity": item.get("severity", "info"),
                "ownerRole": item.get("ownerRole", "Release Manager"),
                "message": item.get("action"),
                "trigger": item.get("trigger"),
                "command": item.get("command"),
                "reasonCode": item.get("reasonCode"),
            }
            for item in owner_action_matrix
        ],
        "actions": owner_action_matrix,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "requestedBy": current_user.get("id"),
        "schemaMetadata": schema_metadata,
    }
    connector_pressure_parity = _build_connector_pressure_parity(
        connector_rate_limit_rollup,
        governance_export.get("connectorRateLimit"),
        connector_rate_limit_event_count,
    )
    sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        sendgrid_webhook_timestamp_rollup,
        governance_export.get("sendgridWebhookTimestamp"),
        sendgrid_webhook_timestamp_rollup.get("eventCount"),
        sendgrid_webhook_timestamp_rollup.get("timestampAnomalyCountTotal"),
    )
    governance_export["sendgridWebhookTimestampParity"] = (
        sendgrid_webhook_timestamp_parity
    )

    response_payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "governanceType": "weekly_report",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "windowDays": days,
        "eventLimit": limit,
        "status": governance_status,
        "alerts": alerts,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "handoff": handoff,
        "connectorRateLimit": connector_rate_limit_rollup,
        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp_rollup,
        "runtimePrereqs": runtime_prereqs_rollup,
        "connectorPressureParity": connector_pressure_parity,
        "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
        "totals": {
            "governanceEventCount": governance_event_count,
            "traceabilityEvaluationCount": traceability_evaluation_count,
            "snapshotEvaluationCount": snapshot_evaluation_count,
            "baselineEvaluationCount": baseline_evaluation_count,
            "actionRequiredCount": action_required_count,
            "connectorRateLimitEventCount": connector_rate_limit_event_count,
            "sendgridWebhookTimestampEventCount": sendgrid_webhook_timestamp_rollup[
                "eventCount"
            ],
            "sendgridWebhookTimestampAnomalyCountTotal": (
                sendgrid_webhook_timestamp_rollup["timestampAnomalyCountTotal"]
            ),
            "runtimePrereqsMissingCheckCount": runtime_prereqs_missing_check_count,
            "rolloutBlockedCount": rollout_blocked_count,
        },
        "governanceStatusCounts": governance_status_counts,
        "traceabilityDecisionCounts": traceability_decision_counts,
        "timeline": timeline,
        "latestEvents": latest_events,
        "ownerActionMatrix": owner_action_matrix,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "governanceExport": governance_export,
        "requestedBy": current_user.get("id"),
    }

    governance_report_payload = {
        "export_schema_version": governance_export_schema_version,
        "window_days": days,
        "event_limit": limit,
        "governance_event_count": governance_event_count,
        "traceability_evaluation_count": traceability_evaluation_count,
        "action_required_count": action_required_count,
        "connector_rate_limit_event_count": connector_rate_limit_event_count,
        "connector_rate_limit_pressure_label": connector_rate_limit_rollup["pressure"][
            "label"
        ],
        "sendgrid_webhook_timestamp_event_count": sendgrid_webhook_timestamp_rollup[
            "eventCount"
        ],
        "sendgrid_webhook_timestamp_anomaly_count_total": (
            sendgrid_webhook_timestamp_rollup["timestampAnomalyCountTotal"]
        ),
        "sendgrid_webhook_timestamp_max_anomaly_rate_pct": (
            sendgrid_webhook_timestamp_rollup["maxTimestampAnomalyRatePct"]
        ),
        "sendgrid_webhook_timestamp_latest_event_at": (
            sendgrid_webhook_timestamp_rollup["latestEventAt"]
        ),
        "sendgrid_webhook_timestamp_pressure_label_counts": (
            sendgrid_webhook_timestamp_rollup["pressureLabelCounts"]
        ),
        "connector_pressure_parity_event_count_matches_nested": connector_pressure_parity.get(
            "eventCountMatchesNested"
        ),
        "connector_pressure_parity_event_count_matches_totals": connector_pressure_parity.get(
            "eventCountMatchesTotals"
        ),
        "connector_pressure_parity_by_endpoint_matches_nested": connector_pressure_parity.get(
            "byEndpointMatchesNested"
        ),
        "connector_pressure_parity_pressure_label_matches_nested": connector_pressure_parity.get(
            "pressureLabelMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_totals": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesTotals"
        ),
        "sendgrid_webhook_timestamp_parity_anomaly_count_total_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "anomalyCountTotalMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_pressure_label_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "pressureLabelCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_age_bucket_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "ageBucketCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_latest_event_at_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "latestEventAtMatchesNested"
        ),
        "rollout_blocked_count": rollout_blocked_count,
        "runtime_prereqs_present": runtime_prereqs_rollup.get("present") is True,
        "runtime_prereqs_available": runtime_prereqs_rollup.get("available") is True,
        "runtime_prereqs_passed": runtime_prereqs_rollup.get("passed"),
        "runtime_prereqs_contract_valid": runtime_prereqs_rollup.get("contractValid"),
        "runtime_prereqs_valid": runtime_prereqs_rollup.get("valid"),
        "runtime_prereqs_missing_check_count": runtime_prereqs_missing_check_count,
        "runtime_prereqs_missing_commands": runtime_prereqs_missing_commands,
        "runtime_prereqs_missing_workspace": runtime_prereqs_missing_workspace,
        "runtime_prereqs_command": runtime_prereqs_rollup.get("command"),
        "reason_codes": reason_codes,
        "reason_code_count": len(reason_codes),
        "recommended_commands": recommended_commands,
        "recommended_command_count": len(recommended_commands),
        "schema_metadata_source": schema_metadata.get("source"),
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_GOVERNANCE_REPORT_EVENT_TYPE,
        governance_report_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=db,
        event_type=TRACEABILITY_GOVERNANCE_REPORT_EVENT_TYPE,
        user_id=current_user["id"],
        payload=governance_report_payload,
        request_id=request_id,
    )

    return response_payload


@router.get("/integrations/telemetry/governance-report/export")
async def get_integrations_governance_report_export(
    days: int = 7,
    limit: int = 1000,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return a compact export envelope for weekly governance rollout handoff."""
    governance_export_schema_version = _get_governance_export_schema_version()
    schema_metadata = _build_governance_schema_metadata()
    report_payload = await get_integrations_governance_report(
        days=days,
        limit=limit,
        current_user=current_user,
        http_request=http_request,
    )
    report_reason_codes = report_payload.get("reasonCodes")
    if not isinstance(report_reason_codes, list):
        report_reason_codes = []
    report_connector_rate_limit = report_payload.get("connectorRateLimit")
    if not isinstance(report_connector_rate_limit, dict):
        report_connector_rate_limit = {
            "eventCount": 0,
            "byEndpoint": {},
            "latestEventAt": None,
            "maxRetryAfterSeconds": None,
            "avgRetryAfterSeconds": None,
            "maxResetInSeconds": None,
            "avgResetInSeconds": None,
            "pressure": _resolve_connector_rate_limit_pressure(None, None),
        }
    report_governance_export = report_payload.get("governanceExport")
    if not isinstance(report_governance_export, dict):
        report_governance_export = {}
    report_sendgrid_webhook_timestamp = _normalize_sendgrid_webhook_timestamp_rollup(
        (
            report_payload.get("sendgridWebhookTimestamp")
            if "sendgridWebhookTimestamp" in report_payload
            else report_governance_export.get("sendgridWebhookTimestamp")
        )
    )
    report_runtime_prereqs = _normalize_runtime_prereqs_rollup(
        payload=report_payload.get("runtimePrereqs"),
        present="runtimePrereqs" in report_payload,
        fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
    )
    if (
        report_runtime_prereqs.get("present") is not True
        and "runtimePrereqs" in report_governance_export
    ):
        report_runtime_prereqs = _normalize_runtime_prereqs_rollup(
            payload=report_governance_export.get("runtimePrereqs"),
            present=True,
            fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
        )
    report_recommended_commands = _normalize_recommended_commands(
        report_payload.get("recommendedCommands")
    )
    report_governance_export_recommended_commands = _normalize_recommended_commands(
        report_governance_export.get("recommendedCommands")
    )
    if report_recommended_commands:
        normalized_recommended_commands = report_recommended_commands
    elif report_governance_export_recommended_commands:
        normalized_recommended_commands = report_governance_export_recommended_commands
    else:
        normalized_recommended_commands = []
    report_governance_export_with_connector = {
        **report_governance_export,
        "status": _normalize_status_token_with_allowlist(
            report_governance_export.get("status"),
            GOVERNANCE_STATUS_ALLOWED_TOKENS,
        ),
        "reasonCodes": report_reason_codes,
        "reasonCodeCount": len(report_reason_codes),
        "connectorRateLimit": report_connector_rate_limit,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "runtimePrereqs": report_runtime_prereqs,
        "recommendedCommands": normalized_recommended_commands,
        "recommendedCommandCount": len(normalized_recommended_commands),
    }
    report_totals = report_payload.get("totals")
    if not isinstance(report_totals, dict):
        report_totals = {}
    connector_pressure_parity = _build_connector_pressure_parity(
        report_connector_rate_limit,
        report_governance_export_with_connector.get("connectorRateLimit"),
        report_totals.get("connectorRateLimitEventCount"),
    )
    sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        report_sendgrid_webhook_timestamp,
        report_governance_export_with_connector.get("sendgridWebhookTimestamp"),
        report_totals.get("sendgridWebhookTimestampEventCount"),
        report_totals.get("sendgridWebhookTimestampAnomalyCountTotal"),
    )
    report_governance_export_with_connector["sendgridWebhookTimestampParity"] = (
        sendgrid_webhook_timestamp_parity
    )
    export_response = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "governanceType": "weekly_report",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": report_payload.get("schemaMetadata") or schema_metadata,
        "windowDays": report_payload.get("windowDays", days),
        "eventLimit": report_payload.get("eventLimit", limit),
        "status": _normalize_status_token_with_allowlist(
            report_payload.get("status"),
            GOVERNANCE_STATUS_ALLOWED_TOKENS,
        ),
        "reasonCodes": report_reason_codes,
        "reasonCodeCount": len(report_reason_codes),
        "totals": report_payload.get("totals") or {},
        "connectorRateLimit": report_connector_rate_limit,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "runtimePrereqs": report_runtime_prereqs,
        "connectorPressureParity": connector_pressure_parity,
        "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
        "recommendedCommands": normalized_recommended_commands,
        "recommendedCommandCount": len(normalized_recommended_commands),
        "governanceExport": report_governance_export_with_connector,
        "requestedBy": current_user.get("id"),
    }

    export_event_payload = {
        "export_schema_version": governance_export_schema_version,
        "window_days": export_response["windowDays"],
        "event_limit": export_response["eventLimit"],
        "status": _normalize_status_token_with_allowlist(
            export_response.get("status"),
            GOVERNANCE_STATUS_ALLOWED_TOKENS,
        ),
        "reason_codes": report_reason_codes,
        "reason_code_count": len(report_reason_codes),
        "recommended_commands": normalized_recommended_commands,
        "recommended_command_count": len(normalized_recommended_commands),
        "connector_rate_limit_event_count": _coerce_non_negative_int(
            report_connector_rate_limit.get("eventCount"),
            fallback=0,
        ),
        "connector_rate_limit_pressure_label": str(
            (
                _coerce_payload_map(report_connector_rate_limit.get("pressure")).get(
                    "label"
                )
                or "Unknown"
            )
        ),
        "sendgrid_webhook_timestamp_event_count": _coerce_non_negative_int(
            report_sendgrid_webhook_timestamp.get("eventCount"),
            fallback=0,
        ),
        "sendgrid_webhook_timestamp_anomaly_count_total": _coerce_non_negative_int(
            report_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal"),
            fallback=0,
        ),
        "sendgrid_webhook_timestamp_max_anomaly_rate_pct": _coerce_non_negative_float(
            report_sendgrid_webhook_timestamp.get("maxTimestampAnomalyRatePct"),
            fallback=None,
        ),
        "sendgrid_webhook_timestamp_latest_event_at": report_sendgrid_webhook_timestamp.get(
            "latestEventAt"
        ),
        "sendgrid_webhook_timestamp_pressure_label_counts": _normalize_sendgrid_timestamp_pressure_label_count_map(
            report_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ),
        "runtime_prereqs_present": report_runtime_prereqs.get("present") is True,
        "runtime_prereqs_available": report_runtime_prereqs.get("available") is True,
        "runtime_prereqs_passed": report_runtime_prereqs.get("passed"),
        "runtime_prereqs_contract_valid": report_runtime_prereqs.get("contractValid"),
        "runtime_prereqs_valid": report_runtime_prereqs.get("valid"),
        "runtime_prereqs_missing_check_count": _coerce_non_negative_int(
            report_runtime_prereqs.get("missingCheckCount"),
            fallback=0,
        ),
        "runtime_prereqs_missing_commands": _normalize_string_list(
            _coerce_payload_map(report_runtime_prereqs.get("missingChecks")).get(
                "commands"
            )
        ),
        "runtime_prereqs_missing_workspace": _normalize_string_list(
            _coerce_payload_map(report_runtime_prereqs.get("missingChecks")).get(
                "workspace"
            )
        ),
        "runtime_prereqs_command": report_runtime_prereqs.get("command"),
        "connector_pressure_parity_event_count_matches_nested": connector_pressure_parity.get(
            "eventCountMatchesNested"
        ),
        "connector_pressure_parity_event_count_matches_totals": connector_pressure_parity.get(
            "eventCountMatchesTotals"
        ),
        "connector_pressure_parity_by_endpoint_matches_nested": connector_pressure_parity.get(
            "byEndpointMatchesNested"
        ),
        "connector_pressure_parity_pressure_label_matches_nested": connector_pressure_parity.get(
            "pressureLabelMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_totals": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesTotals"
        ),
        "sendgrid_webhook_timestamp_parity_anomaly_count_total_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "anomalyCountTotalMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_pressure_label_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "pressureLabelCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_age_bucket_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "ageBucketCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_latest_event_at_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "latestEventAtMatchesNested"
        ),
        "rollout_blocked": bool(
            (export_response.get("governanceExport") or {}).get("rolloutBlocked")
        ),
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_GOVERNANCE_REPORT_EXPORT_EVENT_TYPE,
        export_event_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=get_db(),
        event_type=TRACEABILITY_GOVERNANCE_REPORT_EXPORT_EVENT_TYPE,
        user_id=current_user["id"],
        payload=export_event_payload,
        request_id=request_id,
    )
    return export_response


@router.get("/integrations/telemetry/governance-report/history")
async def get_integrations_governance_report_history(
    retention_days: int = 30,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return governance weekly report artifact history for audit retrieval."""
    governance_export_schema_version = _get_governance_export_schema_version()
    schema_metadata = _build_governance_schema_metadata()
    if retention_days < 1 or retention_days > 365:
        raise HTTPException(
            status_code=400,
            detail="retention_days must be between 1 and 365",
        )
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 500",
        )

    artifact_dir = GOVERNANCE_WEEKLY_REPORT_DIR
    artifact_files = (
        sorted(artifact_dir.glob(f"{GOVERNANCE_WEEKLY_REPORT_PREFIX}*.json"))
        if artifact_dir.exists()
        else []
    )
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=retention_days)

    items: List[Dict[str, Any]] = []
    connector_rate_limit_by_endpoint: Dict[str, int] = {}
    connector_rate_limit_retry_weighted_sum = 0.0
    connector_rate_limit_retry_weighted_count = 0
    connector_rate_limit_reset_weighted_sum = 0.0
    connector_rate_limit_reset_weighted_count = 0
    connector_rate_limit_max_retry: Optional[float] = None
    connector_rate_limit_max_reset: Optional[float] = None
    latest_connector_rate_limit_event_at: Optional[str] = None
    sendgrid_timestamp_event_count = 0
    sendgrid_timestamp_pressure_label_counts: Dict[str, int] = {}
    sendgrid_timestamp_pressure_hint_counts: Dict[str, int] = {}
    sendgrid_timestamp_age_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_bucket_counts: Dict[str, int] = {}
    sendgrid_timestamp_dominant_anomaly_event_type_counts: Dict[str, int] = {}
    sendgrid_timestamp_anomaly_count_total = 0
    sendgrid_timestamp_anomaly_count_weighted_sum = 0.0
    sendgrid_timestamp_anomaly_count_weighted_count = 0
    sendgrid_timestamp_anomaly_rate_pct_weighted_sum = 0.0
    sendgrid_timestamp_anomaly_rate_pct_weighted_count = 0
    sendgrid_timestamp_max_anomaly_rate_pct: Optional[float] = None
    sendgrid_timestamp_fallback_count_total = 0
    sendgrid_timestamp_future_skew_event_count_total = 0
    sendgrid_timestamp_stale_event_count_total = 0
    sendgrid_timestamp_fresh_event_count_total = 0
    sendgrid_timestamp_pressure_high_anomaly_rate_pct: Optional[float] = None
    sendgrid_timestamp_pressure_moderate_anomaly_rate_pct: Optional[float] = None
    sendgrid_timestamp_pressure_high_anomaly_count: Optional[int] = None
    sendgrid_timestamp_pressure_moderate_anomaly_count: Optional[int] = None
    latest_sendgrid_timestamp_event_at: Optional[str] = None
    runtime_prereqs_present_count = 0
    runtime_prereqs_available_all = True
    runtime_prereqs_passed_all = True
    runtime_prereqs_contract_valid_all = True
    runtime_prereqs_valid_all = True
    runtime_prereqs_missing_check_count = 0
    runtime_prereqs_missing_commands: List[str] = []
    runtime_prereqs_missing_workspace: List[str] = []
    runtime_prereqs_latest_generated_at: Optional[str] = None
    runtime_prereqs_latest_validated_at: Optional[str] = None
    runtime_prereqs_latest_artifact_path: Optional[str] = None
    runtime_prereqs_command: Optional[str] = None
    runtime_prereqs_failure_count = 0
    for path in artifact_files:
        generated_at = _load_governance_report_generated_at(path)
        payload: Dict[str, Any] = {}
        status = "UNKNOWN"
        rollout_blocked = False
        requested_by = None
        artifact_name = path.name
        export_schema_version: Optional[int] = None
        try:
            raw_payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            status = "INVALID"
            rollout_blocked = True
        else:
            if not isinstance(raw_payload, dict):
                status = "INVALID"
                rollout_blocked = True
            else:
                payload = raw_payload
                governance_export = payload.get("governanceExport")
                raw_artifact_name = payload.get("artifactName")
                if isinstance(raw_artifact_name, str) and raw_artifact_name.strip():
                    artifact_name = raw_artifact_name.strip()
                if isinstance(governance_export, dict):
                    status = _normalize_status_token_with_allowlist(
                        governance_export.get("status") or status,
                        GOVERNANCE_STATUS_ALLOWED_TOKENS,
                    )
                    rollout_blocked = bool(governance_export.get("rolloutBlocked"))
                    requested_by = governance_export.get("requestedBy")
                elif "governanceExport" in payload:
                    status = "INVALID"
                    rollout_blocked = True
                raw_export_schema_version = payload.get("exportSchemaVersion")
                if isinstance(raw_export_schema_version, int):
                    export_schema_version = raw_export_schema_version
                elif isinstance(governance_export, dict):
                    nested_export_schema_version = governance_export.get(
                        "exportSchemaVersion"
                    )
                    if isinstance(nested_export_schema_version, int):
                        export_schema_version = nested_export_schema_version
                if status == "UNKNOWN":
                    summary = payload.get("summary")
                    if isinstance(summary, dict):
                        rollout_blocked = bool(summary.get("rolloutBlocked"))
                        status = "ACTION_REQUIRED" if rollout_blocked else "READY"
                    else:
                        status = "READY"
                summary_payload = payload.get("summary")
                connector_rate_limit_payload = None
                if isinstance(summary_payload, dict) and isinstance(
                    summary_payload.get("connectorRateLimit"), dict
                ):
                    connector_rate_limit_payload = summary_payload.get(
                        "connectorRateLimit"
                    )
                elif isinstance(payload.get("connectorRateLimit"), dict):
                    connector_rate_limit_payload = payload.get("connectorRateLimit")
                if isinstance(connector_rate_limit_payload, dict):
                    connector_event_count = _coerce_non_negative_int(
                        connector_rate_limit_payload.get("eventCount"),
                        fallback=0,
                    )
                    connector_by_endpoint_total = 0
                    connector_by_endpoint = connector_rate_limit_payload.get(
                        "byEndpoint"
                    )
                    if isinstance(connector_by_endpoint, dict):
                        for endpoint, endpoint_count in connector_by_endpoint.items():
                            endpoint_key = _normalize_connector_rate_limit_endpoint_key(
                                endpoint
                            )
                            normalized_endpoint_count = _coerce_non_negative_int(
                                endpoint_count, fallback=0
                            )
                            connector_by_endpoint_total += normalized_endpoint_count
                            connector_rate_limit_by_endpoint[endpoint_key] = (
                                int(
                                    connector_rate_limit_by_endpoint.get(
                                        endpoint_key, 0
                                    )
                                )
                                + normalized_endpoint_count
                            )
                    if connector_event_count == 0 and connector_by_endpoint_total > 0:
                        connector_event_count = connector_by_endpoint_total
                    latest_connector_event = connector_rate_limit_payload.get(
                        "latestEventAt"
                    )
                    if (
                        isinstance(latest_connector_event, str)
                        and latest_connector_event
                        and (
                            latest_connector_rate_limit_event_at is None
                            or latest_connector_event
                            > latest_connector_rate_limit_event_at
                        )
                    ):
                        latest_connector_rate_limit_event_at = latest_connector_event
                    max_retry = _coerce_non_negative_float(
                        connector_rate_limit_payload.get("maxRetryAfterSeconds"),
                        fallback=None,
                    )
                    if max_retry is not None:
                        if (
                            connector_rate_limit_max_retry is None
                            or max_retry > connector_rate_limit_max_retry
                        ):
                            connector_rate_limit_max_retry = max_retry
                    max_reset = _coerce_non_negative_float(
                        connector_rate_limit_payload.get("maxResetInSeconds"),
                        fallback=None,
                    )
                    if max_reset is not None:
                        if (
                            connector_rate_limit_max_reset is None
                            or max_reset > connector_rate_limit_max_reset
                        ):
                            connector_rate_limit_max_reset = max_reset
                    avg_retry = _coerce_non_negative_float(
                        connector_rate_limit_payload.get("avgRetryAfterSeconds"),
                        fallback=None,
                    )
                    if avg_retry is not None and connector_event_count > 0:
                        connector_rate_limit_retry_weighted_sum += (
                            avg_retry * connector_event_count
                        )
                        connector_rate_limit_retry_weighted_count += (
                            connector_event_count
                        )
                    avg_reset = _coerce_non_negative_float(
                        connector_rate_limit_payload.get("avgResetInSeconds"),
                        fallback=None,
                    )
                    if avg_reset is not None and connector_event_count > 0:
                        connector_rate_limit_reset_weighted_sum += (
                            avg_reset * connector_event_count
                        )
                        connector_rate_limit_reset_weighted_count += (
                            connector_event_count
                        )
                sendgrid_timestamp_payload: Any = None
                if isinstance(summary_payload, dict) and "sendgridWebhookTimestamp" in summary_payload:
                    sendgrid_timestamp_payload = summary_payload.get(
                        "sendgridWebhookTimestamp"
                    )
                elif "sendgridWebhookTimestamp" in payload:
                    sendgrid_timestamp_payload = payload.get(
                        "sendgridWebhookTimestamp"
                    )
                elif isinstance(governance_export, dict) and "sendgridWebhookTimestamp" in governance_export:
                    sendgrid_timestamp_payload = governance_export.get(
                        "sendgridWebhookTimestamp"
                    )
                if sendgrid_timestamp_payload is not None:
                    normalized_sendgrid_rollup = _normalize_sendgrid_webhook_timestamp_rollup(
                        sendgrid_timestamp_payload
                    )
                    sendgrid_event_count = _coerce_non_negative_int(
                        normalized_sendgrid_rollup.get("eventCount"),
                        fallback=0,
                    )
                    sendgrid_timestamp_event_count += sendgrid_event_count
                    sendgrid_timestamp_anomaly_count_total += _coerce_non_negative_int(
                        normalized_sendgrid_rollup.get("timestampAnomalyCountTotal"),
                        fallback=0,
                    )
                    sendgrid_timestamp_fallback_count_total += _coerce_non_negative_int(
                        normalized_sendgrid_rollup.get("timestampFallbackCount"),
                        fallback=0,
                    )
                    sendgrid_timestamp_future_skew_event_count_total += (
                        _coerce_non_negative_int(
                            normalized_sendgrid_rollup.get("futureSkewEventCount"),
                            fallback=0,
                        )
                    )
                    sendgrid_timestamp_stale_event_count_total += _coerce_non_negative_int(
                        normalized_sendgrid_rollup.get("staleEventCount"),
                        fallback=0,
                    )
                    sendgrid_timestamp_fresh_event_count_total += _coerce_non_negative_int(
                        normalized_sendgrid_rollup.get("freshEventCount"),
                        fallback=0,
                    )

                    avg_timestamp_anomaly_count = _coerce_non_negative_float(
                        normalized_sendgrid_rollup.get("avgTimestampAnomalyCount"),
                        fallback=None,
                    )
                    if avg_timestamp_anomaly_count is not None and sendgrid_event_count > 0:
                        sendgrid_timestamp_anomaly_count_weighted_sum += (
                            avg_timestamp_anomaly_count * sendgrid_event_count
                        )
                        sendgrid_timestamp_anomaly_count_weighted_count += sendgrid_event_count

                    avg_timestamp_anomaly_rate_pct = _coerce_non_negative_float(
                        normalized_sendgrid_rollup.get("avgTimestampAnomalyRatePct"),
                        fallback=None,
                    )
                    if (
                        avg_timestamp_anomaly_rate_pct is not None
                        and sendgrid_event_count > 0
                    ):
                        sendgrid_timestamp_anomaly_rate_pct_weighted_sum += (
                            avg_timestamp_anomaly_rate_pct * sendgrid_event_count
                        )
                        sendgrid_timestamp_anomaly_rate_pct_weighted_count += (
                            sendgrid_event_count
                        )

                    max_timestamp_anomaly_rate_pct = _coerce_non_negative_float(
                        normalized_sendgrid_rollup.get("maxTimestampAnomalyRatePct"),
                        fallback=None,
                    )
                    if max_timestamp_anomaly_rate_pct is not None:
                        if (
                            sendgrid_timestamp_max_anomaly_rate_pct is None
                            or max_timestamp_anomaly_rate_pct
                            > sendgrid_timestamp_max_anomaly_rate_pct
                        ):
                            sendgrid_timestamp_max_anomaly_rate_pct = (
                                max_timestamp_anomaly_rate_pct
                            )

                    high_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                        normalized_sendgrid_rollup.get(
                            "timestampPressureHighAnomalyRatePct"
                        ),
                        fallback=None,
                    )
                    if high_anomaly_rate_pct_threshold is not None:
                        if (
                            sendgrid_timestamp_pressure_high_anomaly_rate_pct is None
                            or high_anomaly_rate_pct_threshold
                            > sendgrid_timestamp_pressure_high_anomaly_rate_pct
                        ):
                            sendgrid_timestamp_pressure_high_anomaly_rate_pct = (
                                high_anomaly_rate_pct_threshold
                            )

                    moderate_anomaly_rate_pct_threshold = _coerce_non_negative_float(
                        normalized_sendgrid_rollup.get(
                            "timestampPressureModerateAnomalyRatePct"
                        ),
                        fallback=None,
                    )
                    if moderate_anomaly_rate_pct_threshold is not None:
                        if (
                            sendgrid_timestamp_pressure_moderate_anomaly_rate_pct
                            is None
                            or moderate_anomaly_rate_pct_threshold
                            > sendgrid_timestamp_pressure_moderate_anomaly_rate_pct
                        ):
                            sendgrid_timestamp_pressure_moderate_anomaly_rate_pct = (
                                moderate_anomaly_rate_pct_threshold
                            )

                    high_anomaly_count_threshold = _coerce_non_negative_int_optional(
                        normalized_sendgrid_rollup.get("timestampPressureHighAnomalyCount")
                    )
                    if high_anomaly_count_threshold is not None:
                        if (
                            sendgrid_timestamp_pressure_high_anomaly_count is None
                            or high_anomaly_count_threshold
                            > sendgrid_timestamp_pressure_high_anomaly_count
                        ):
                            sendgrid_timestamp_pressure_high_anomaly_count = (
                                high_anomaly_count_threshold
                            )

                    moderate_anomaly_count_threshold = _coerce_non_negative_int_optional(
                        normalized_sendgrid_rollup.get(
                            "timestampPressureModerateAnomalyCount"
                        )
                    )
                    if moderate_anomaly_count_threshold is not None:
                        if (
                            sendgrid_timestamp_pressure_moderate_anomaly_count is None
                            or moderate_anomaly_count_threshold
                            > sendgrid_timestamp_pressure_moderate_anomaly_count
                        ):
                            sendgrid_timestamp_pressure_moderate_anomaly_count = (
                                moderate_anomaly_count_threshold
                            )

                    for label, count in _normalize_sendgrid_timestamp_pressure_label_count_map(
                        normalized_sendgrid_rollup.get("pressureLabelCounts")
                    ).items():
                        sendgrid_timestamp_pressure_label_counts[label] = (
                            int(sendgrid_timestamp_pressure_label_counts.get(label, 0))
                            + count
                        )
                    for hint, count in _normalize_sendgrid_timestamp_hint_count_map(
                        normalized_sendgrid_rollup.get("pressureHintCounts")
                    ).items():
                        sendgrid_timestamp_pressure_hint_counts[hint] = (
                            int(sendgrid_timestamp_pressure_hint_counts.get(hint, 0))
                            + count
                        )
                    for bucket, count in _normalize_sendgrid_timestamp_bucket_count_map(
                        normalized_sendgrid_rollup.get("timestampAgeBucketCounts")
                    ).items():
                        sendgrid_timestamp_age_bucket_counts[bucket] = (
                            int(sendgrid_timestamp_age_bucket_counts.get(bucket, 0))
                            + count
                        )
                    for event_type_key, count in _normalize_sendgrid_timestamp_event_type_count_map(
                        normalized_sendgrid_rollup.get(
                            "timestampAnomalyEventTypeCounts"
                        )
                    ).items():
                        sendgrid_timestamp_anomaly_event_type_counts[event_type_key] = (
                            int(
                                sendgrid_timestamp_anomaly_event_type_counts.get(
                                    event_type_key, 0
                                )
                            )
                            + count
                        )
                    for bucket, count in _normalize_sendgrid_timestamp_bucket_count_map(
                        normalized_sendgrid_rollup.get(
                            "timestampDominantAnomalyBucketCounts"
                        )
                    ).items():
                        sendgrid_timestamp_dominant_anomaly_bucket_counts[bucket] = (
                            int(
                                sendgrid_timestamp_dominant_anomaly_bucket_counts.get(
                                    bucket, 0
                                )
                            )
                            + count
                        )
                    for event_type_key, count in _normalize_sendgrid_timestamp_event_type_count_map(
                        normalized_sendgrid_rollup.get(
                            "timestampDominantAnomalyEventTypeCounts"
                        )
                    ).items():
                        sendgrid_timestamp_dominant_anomaly_event_type_counts[
                            event_type_key
                        ] = (
                            int(
                                sendgrid_timestamp_dominant_anomaly_event_type_counts.get(
                                    event_type_key, 0
                                )
                            )
                            + count
                        )

                    latest_sendgrid_event = normalized_sendgrid_rollup.get(
                        "latestEventAt"
                    )
                    if (
                        isinstance(latest_sendgrid_event, str)
                        and latest_sendgrid_event
                        and (
                            latest_sendgrid_timestamp_event_at is None
                            or latest_sendgrid_event > latest_sendgrid_timestamp_event_at
                        )
                    ):
                        latest_sendgrid_timestamp_event_at = latest_sendgrid_event
                runtime_prereqs_source_payload: Any = None
                runtime_prereqs_present = False
                if isinstance(summary_payload, dict) and "runtimePrereqs" in summary_payload:
                    runtime_prereqs_source_payload = summary_payload.get(
                        "runtimePrereqs"
                    )
                    runtime_prereqs_present = True
                elif "runtimePrereqs" in payload:
                    runtime_prereqs_source_payload = payload.get("runtimePrereqs")
                    runtime_prereqs_present = True
                elif isinstance(governance_export, dict) and "runtimePrereqs" in governance_export:
                    runtime_prereqs_source_payload = governance_export.get(
                        "runtimePrereqs"
                    )
                    runtime_prereqs_present = True
                if runtime_prereqs_present:
                    runtime_prereqs_rollup_for_item = _normalize_runtime_prereqs_rollup(
                        payload=runtime_prereqs_source_payload,
                        present=True,
                        fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
                    )
                    runtime_prereqs_present_count += 1
                    runtime_prereqs_available_all = (
                        runtime_prereqs_available_all
                        and runtime_prereqs_rollup_for_item.get("available") is True
                    )
                    runtime_prereqs_passed_all = (
                        runtime_prereqs_passed_all
                        and runtime_prereqs_rollup_for_item.get("passed") is True
                    )
                    runtime_prereqs_contract_valid_all = (
                        runtime_prereqs_contract_valid_all
                        and runtime_prereqs_rollup_for_item.get("contractValid") is True
                    )
                    runtime_prereqs_valid_all = (
                        runtime_prereqs_valid_all
                        and runtime_prereqs_rollup_for_item.get("valid") is True
                    )
                    runtime_prereqs_missing_check_count += _coerce_non_negative_int(
                        runtime_prereqs_rollup_for_item.get("missingCheckCount"),
                        fallback=0,
                    )
                    runtime_item_missing_checks = _coerce_payload_map(
                        runtime_prereqs_rollup_for_item.get("missingChecks")
                    )
                    for missing_command in _normalize_string_list(
                        runtime_item_missing_checks.get("commands")
                    ):
                        if missing_command not in runtime_prereqs_missing_commands:
                            runtime_prereqs_missing_commands.append(missing_command)
                    for missing_workspace_entry in _normalize_string_list(
                        runtime_item_missing_checks.get("workspace")
                    ):
                        if (
                            missing_workspace_entry
                            not in runtime_prereqs_missing_workspace
                        ):
                            runtime_prereqs_missing_workspace.append(
                                missing_workspace_entry
                            )
                    if _runtime_prereqs_needs_remediation(runtime_prereqs_rollup_for_item):
                        runtime_prereqs_failure_count += 1

                    runtime_generated_at = runtime_prereqs_rollup_for_item.get(
                        "generatedAt"
                    )
                    if (
                        isinstance(runtime_generated_at, str)
                        and runtime_generated_at
                        and (
                            runtime_prereqs_latest_generated_at is None
                            or runtime_generated_at > runtime_prereqs_latest_generated_at
                        )
                    ):
                        runtime_prereqs_latest_generated_at = runtime_generated_at

                    runtime_validated_at = runtime_prereqs_rollup_for_item.get(
                        "validatedAt"
                    )
                    if (
                        isinstance(runtime_validated_at, str)
                        and runtime_validated_at
                        and (
                            runtime_prereqs_latest_validated_at is None
                            or runtime_validated_at > runtime_prereqs_latest_validated_at
                        )
                    ):
                        runtime_prereqs_latest_validated_at = runtime_validated_at

                    runtime_artifact_path = runtime_prereqs_rollup_for_item.get(
                        "artifactPath"
                    )
                    if (
                        isinstance(runtime_artifact_path, str)
                        and runtime_artifact_path
                        and runtime_prereqs_latest_artifact_path is None
                    ):
                        runtime_prereqs_latest_artifact_path = runtime_artifact_path
                    runtime_command_candidate = runtime_prereqs_rollup_for_item.get(
                        "command"
                    )
                    if (
                        isinstance(runtime_command_candidate, str)
                        and runtime_command_candidate
                        and runtime_prereqs_command is None
                    ):
                        runtime_prereqs_command = runtime_command_candidate

        within_retention = bool(generated_at and generated_at >= threshold)
        age_days = (
            round((now - generated_at).total_seconds() / 86400.0, 3)
            if generated_at
            else None
        )
        items.append(
            {
                "file": str(path),
                "name": artifact_name,
                "exportSchemaVersion": (
                    export_schema_version
                    if isinstance(export_schema_version, int)
                    else governance_export_schema_version
                ),
                "generatedAt": generated_at.isoformat() if generated_at else None,
                "ageDays": age_days,
                "withinRetention": within_retention,
                "sizeBytes": path.stat().st_size if path.exists() else 0,
                "status": status,
                "rolloutBlocked": rollout_blocked,
                "requestedBy": requested_by,
            }
        )

    items.sort(
        key=lambda item: (
            item.get("generatedAt") or "",
            item.get("name") or "",
        ),
        reverse=True,
    )
    items = items[:limit]
    artifact_count = len(items)
    stale_count = sum(1 for item in items if not item.get("withinRetention"))
    blocked_count = sum(1 for item in items if item.get("rolloutBlocked"))
    schema_version_counts: Dict[str, int] = {}
    item_name_counts: Dict[str, int] = {}
    for item in items:
        schema_version_key = str(item.get("exportSchemaVersion", "unknown"))
        schema_version_counts[schema_version_key] = (
            int(schema_version_counts.get(schema_version_key, 0)) + 1
        )
        item_name = str(item.get("name") or "").strip()
        if item_name:
            item_name_counts[item_name] = int(item_name_counts.get(item_name, 0)) + 1
    duplicate_artifact_names = sorted(
        [name for name, count in item_name_counts.items() if count > 1]
    )
    connector_rate_limit_event_count = sum(connector_rate_limit_by_endpoint.values())
    connector_rate_limit_avg_retry = (
        round(
            connector_rate_limit_retry_weighted_sum
            / connector_rate_limit_retry_weighted_count,
            2,
        )
        if connector_rate_limit_retry_weighted_count > 0
        else None
    )
    connector_rate_limit_avg_reset = (
        round(
            connector_rate_limit_reset_weighted_sum
            / connector_rate_limit_reset_weighted_count,
            2,
        )
        if connector_rate_limit_reset_weighted_count > 0
        else None
    )
    connector_rate_limit_rollup = {
        "eventCount": connector_rate_limit_event_count,
        "byEndpoint": connector_rate_limit_by_endpoint,
        "latestEventAt": latest_connector_rate_limit_event_at,
        "maxRetryAfterSeconds": connector_rate_limit_max_retry,
        "avgRetryAfterSeconds": connector_rate_limit_avg_retry,
        "maxResetInSeconds": connector_rate_limit_max_reset,
        "avgResetInSeconds": connector_rate_limit_avg_reset,
        "pressure": _resolve_connector_rate_limit_pressure(
            connector_rate_limit_max_retry,
            connector_rate_limit_avg_reset,
        ),
    }
    sendgrid_webhook_timestamp_rollup = _normalize_sendgrid_webhook_timestamp_rollup(
        {
            "eventCount": sendgrid_timestamp_event_count,
            "pressureLabelCounts": sendgrid_timestamp_pressure_label_counts,
            "pressureHintCounts": sendgrid_timestamp_pressure_hint_counts,
            "timestampFallbackCount": sendgrid_timestamp_fallback_count_total,
            "futureSkewEventCount": sendgrid_timestamp_future_skew_event_count_total,
            "staleEventCount": sendgrid_timestamp_stale_event_count_total,
            "freshEventCount": sendgrid_timestamp_fresh_event_count_total,
            "timestampAnomalyCountTotal": sendgrid_timestamp_anomaly_count_total,
            "avgTimestampAnomalyCount": (
                round(
                    sendgrid_timestamp_anomaly_count_weighted_sum
                    / sendgrid_timestamp_anomaly_count_weighted_count,
                    2,
                )
                if sendgrid_timestamp_anomaly_count_weighted_count > 0
                else None
            ),
            "avgTimestampAnomalyRatePct": (
                round(
                    sendgrid_timestamp_anomaly_rate_pct_weighted_sum
                    / sendgrid_timestamp_anomaly_rate_pct_weighted_count,
                    2,
                )
                if sendgrid_timestamp_anomaly_rate_pct_weighted_count > 0
                else None
            ),
            "maxTimestampAnomalyRatePct": sendgrid_timestamp_max_anomaly_rate_pct,
            "timestampAgeBucketCounts": sendgrid_timestamp_age_bucket_counts,
            "timestampAnomalyEventTypeCounts": (
                sendgrid_timestamp_anomaly_event_type_counts
            ),
            "timestampDominantAnomalyBucketCounts": (
                sendgrid_timestamp_dominant_anomaly_bucket_counts
            ),
            "timestampDominantAnomalyEventTypeCounts": (
                sendgrid_timestamp_dominant_anomaly_event_type_counts
            ),
            "timestampPressureHighAnomalyRatePct": (
                sendgrid_timestamp_pressure_high_anomaly_rate_pct
            ),
            "timestampPressureModerateAnomalyRatePct": (
                sendgrid_timestamp_pressure_moderate_anomaly_rate_pct
            ),
            "timestampPressureHighAnomalyCount": (
                sendgrid_timestamp_pressure_high_anomaly_count
            ),
            "timestampPressureModerateAnomalyCount": (
                sendgrid_timestamp_pressure_moderate_anomaly_count
            ),
            "latestEventAt": latest_sendgrid_timestamp_event_at,
        }
    )
    if runtime_prereqs_present_count > 0:
        runtime_prereqs_rollup = {
            "present": True,
            "available": runtime_prereqs_available_all,
            "passed": runtime_prereqs_passed_all,
            "contractValid": runtime_prereqs_contract_valid_all,
            "valid": runtime_prereqs_valid_all,
            "missingCheckCount": runtime_prereqs_missing_check_count,
            "missingChecks": {
                "commands": sorted(runtime_prereqs_missing_commands),
                "workspace": sorted(runtime_prereqs_missing_workspace),
            },
            "artifactPath": runtime_prereqs_latest_artifact_path,
            "generatedAt": runtime_prereqs_latest_generated_at,
            "validatedAt": runtime_prereqs_latest_validated_at,
            "command": runtime_prereqs_command
            or BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
            "historyArtifactCount": runtime_prereqs_present_count,
            "failingArtifactCount": runtime_prereqs_failure_count,
        }
    else:
        runtime_prereqs_rollup = _normalize_runtime_prereqs_rollup(
            payload={},
            present=False,
            fallback_command=BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
        )
        runtime_prereqs_rollup["historyArtifactCount"] = 0
        runtime_prereqs_rollup["failingArtifactCount"] = 0

    latest_item = items[0] if items else None
    packet_validation_posture = _load_governance_packet_validation_posture(
        GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH,
        now,
    )

    history_status = "READY"
    alerts: List[str] = []
    action_matrix: List[Dict[str, Any]] = []
    if artifact_count == 0:
        history_status = "ACTION_REQUIRED"
        alerts.append("No governance weekly report artifacts were found.")
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_artifacts_missing",
                "action": "Generate governance weekly report artifacts for release signoff evidence.",
                "command": "npm run verify:governance:weekly:report",
            }
        )
    if stale_count > 0:
        history_status = "ACTION_REQUIRED"
        alerts.append("One or more governance weekly report artifacts are outside retention threshold.")
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_artifacts_stale",
                "action": "Evaluate cleanup policy and regenerate governance weekly report artifacts.",
                "command": "npm run verify:governance:weekly:cleanup:policy",
            }
        )
    if blocked_count > 0:
        history_status = "ACTION_REQUIRED"
        alerts.append("Recent governance weekly artifacts indicate rollout-blocked status.")
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "On-call Engineer",
                "trigger": "governance_rollout_blocked",
                "action": "Run governance export failure guard and remediate rollout blockers.",
                "command": "npm run verify:smoke:governance-export-guard",
            }
        )
    if _runtime_prereqs_needs_remediation(runtime_prereqs_rollup):
        history_status = "ACTION_REQUIRED"
        alerts.append(
            "Runtime prerequisite checks are failing in one or more governance weekly artifacts."
        )
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_runtime_prereqs_failed",
                "action": "Run runtime prerequisite remediation checks and update baseline runtime artifacts.",
                "command": BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND,
            }
        )
    if duplicate_artifact_names:
        history_status = "ACTION_REQUIRED"
        alerts.append(
            "Governance history contains duplicate artifact names; export lineage is ambiguous."
        )
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_history_duplicate_artifacts",
                "action": "Remove duplicate governance weekly artifacts and regenerate a single canonical packet.",
                "command": "npm run verify:governance:weekly:cleanup:policy",
            }
        )
    if packet_validation_posture.get("status") != "READY":
        history_status = "ACTION_REQUIRED"
        alerts.append("Governance packet validation artifact is missing, invalid, or stale.")
        action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_packet_validation_not_ready",
                "action": "Regenerate and validate governance packet artifact before release signoff.",
                "command": "npm run verify:governance:packet:contract",
            }
        )
    if not alerts:
        alerts.append("Governance weekly report artifact history is healthy.")
    if not action_matrix:
        action_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "governance_history_ready",
                "action": "History is healthy; continue release signoff review.",
                "command": "npm run verify:ci:sales:extended",
            }
        )
    reason_codes = _attach_governance_reason_codes(
        action_matrix,
        fallback="governance_history",
    )
    recommended_commands = _normalize_recommended_commands(
        [item.get("command") for item in action_matrix]
        + ["npm run verify:governance:weekly:endpoint:contract"]
    )

    governance_export = {
        "governanceType": "weekly_report_history",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "status": history_status,
        "rolloutBlocked": history_status == "ACTION_REQUIRED",
        "ownerRole": "Release Manager",
        "connectorRateLimit": connector_rate_limit_rollup,
        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp_rollup,
        "runtimePrereqs": runtime_prereqs_rollup,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "alerts": [
            {
                "severity": item.get("severity", "info"),
                "ownerRole": item.get("ownerRole", "Release Manager"),
                "message": item.get("action"),
                "trigger": item.get("trigger"),
                "command": item.get("command"),
                "reasonCode": item.get("reasonCode"),
            }
            for item in action_matrix
        ],
        "actions": action_matrix,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "evaluatedAt": now.isoformat(),
        "requestedBy": current_user.get("id"),
    }
    connector_pressure_parity = _build_connector_pressure_parity(
        connector_rate_limit_rollup,
        governance_export.get("connectorRateLimit"),
        connector_rate_limit_event_count,
    )
    sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        sendgrid_webhook_timestamp_rollup,
        governance_export.get("sendgridWebhookTimestamp"),
        sendgrid_webhook_timestamp_rollup.get("eventCount"),
        sendgrid_webhook_timestamp_rollup.get("timestampAnomalyCountTotal"),
    )
    governance_export["sendgridWebhookTimestampParity"] = (
        sendgrid_webhook_timestamp_parity
    )

    response_payload = {
        "generatedAt": now.isoformat(),
        "governanceType": "weekly_report_history",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "retentionDays": retention_days,
        "limit": limit,
        "artifactDirectory": str(artifact_dir),
        "artifactPrefix": GOVERNANCE_WEEKLY_REPORT_PREFIX,
        "artifactCount": artifact_count,
        "staleCount": stale_count,
        "rolloutBlockedCount": blocked_count,
        "duplicateArtifactNames": duplicate_artifact_names,
        "schemaVersionCounts": schema_version_counts,
        "totals": {
            "connectorRateLimitEventCount": connector_rate_limit_event_count,
            "sendgridWebhookTimestampEventCount": sendgrid_webhook_timestamp_rollup[
                "eventCount"
            ],
            "sendgridWebhookTimestampAnomalyCountTotal": (
                sendgrid_webhook_timestamp_rollup["timestampAnomalyCountTotal"]
            ),
            "runtimePrereqsFailingArtifactCount": runtime_prereqs_failure_count,
        },
        "connectorRateLimit": connector_rate_limit_rollup,
        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp_rollup,
        "runtimePrereqs": runtime_prereqs_rollup,
        "connectorPressureParity": connector_pressure_parity,
        "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
        "latestArtifact": latest_item,
        "items": items,
        "governancePacketValidation": packet_validation_posture,
        "status": history_status,
        "alerts": alerts,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "handoff": {
            "rolloutBlocked": history_status == "ACTION_REQUIRED",
            "ownerRole": "Release Manager",
            "actions": [item.get("action") for item in action_matrix if item.get("action")],
        },
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "governanceExport": governance_export,
        "requestedBy": current_user.get("id"),
    }

    history_event_payload = {
        "export_schema_version": governance_export_schema_version,
        "retention_days": retention_days,
        "limit": limit,
        "artifact_count": artifact_count,
        "stale_count": stale_count,
        "rollout_blocked_count": blocked_count,
        "connector_rate_limit_event_count": connector_rate_limit_event_count,
        "connector_rate_limit_pressure_label": connector_rate_limit_rollup["pressure"][
            "label"
        ],
        "sendgrid_webhook_timestamp_event_count": sendgrid_webhook_timestamp_rollup[
            "eventCount"
        ],
        "sendgrid_webhook_timestamp_anomaly_count_total": (
            sendgrid_webhook_timestamp_rollup["timestampAnomalyCountTotal"]
        ),
        "sendgrid_webhook_timestamp_max_anomaly_rate_pct": (
            sendgrid_webhook_timestamp_rollup["maxTimestampAnomalyRatePct"]
        ),
        "sendgrid_webhook_timestamp_latest_event_at": (
            sendgrid_webhook_timestamp_rollup["latestEventAt"]
        ),
        "sendgrid_webhook_timestamp_pressure_label_counts": (
            sendgrid_webhook_timestamp_rollup["pressureLabelCounts"]
        ),
        "runtime_prereqs_present_count": runtime_prereqs_present_count,
        "runtime_prereqs_failure_count": runtime_prereqs_failure_count,
        "runtime_prereqs_available": runtime_prereqs_rollup.get("available") is True,
        "runtime_prereqs_passed": runtime_prereqs_rollup.get("passed"),
        "runtime_prereqs_contract_valid": runtime_prereqs_rollup.get("contractValid"),
        "runtime_prereqs_valid": runtime_prereqs_rollup.get("valid"),
        "runtime_prereqs_missing_check_count": runtime_prereqs_missing_check_count,
        "runtime_prereqs_missing_commands": sorted(runtime_prereqs_missing_commands),
        "runtime_prereqs_missing_workspace": sorted(runtime_prereqs_missing_workspace),
        "runtime_prereqs_command": runtime_prereqs_rollup.get("command"),
        "connector_pressure_parity_event_count_matches_nested": connector_pressure_parity.get(
            "eventCountMatchesNested"
        ),
        "connector_pressure_parity_event_count_matches_totals": connector_pressure_parity.get(
            "eventCountMatchesTotals"
        ),
        "connector_pressure_parity_by_endpoint_matches_nested": connector_pressure_parity.get(
            "byEndpointMatchesNested"
        ),
        "connector_pressure_parity_pressure_label_matches_nested": connector_pressure_parity.get(
            "pressureLabelMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_totals": sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesTotals"
        ),
        "sendgrid_webhook_timestamp_parity_anomaly_count_total_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "anomalyCountTotalMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_pressure_label_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "pressureLabelCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_age_bucket_counts_match_nested": sendgrid_webhook_timestamp_parity.get(
            "ageBucketCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_latest_event_at_matches_nested": sendgrid_webhook_timestamp_parity.get(
            "latestEventAtMatchesNested"
        ),
        "duplicate_artifact_name_count": len(duplicate_artifact_names),
        "reason_codes": reason_codes,
        "reason_code_count": len(reason_codes),
        "recommended_commands": recommended_commands,
        "recommended_command_count": len(recommended_commands),
        "schema_metadata_source": schema_metadata.get("source"),
        "governance_packet_validation_status": _normalize_status_token(
            packet_validation_posture.get("status")
        ),
        "governance_packet_validation_within_freshness": bool(
            packet_validation_posture.get("withinFreshnessWindow")
        ),
        "status": _normalize_status_token_with_allowlist(
            history_status,
            GOVERNANCE_STATUS_ALLOWED_TOKENS,
        ),
    }
    request_id = _extract_request_id(http_request)
    _log_integration_event(
        TRACEABILITY_GOVERNANCE_REPORT_HISTORY_EVENT_TYPE,
        history_event_payload,
        request_id=request_id,
    )
    await _record_integration_event(
        db=get_db(),
        event_type=TRACEABILITY_GOVERNANCE_REPORT_HISTORY_EVENT_TYPE,
        user_id=current_user["id"],
        payload=history_event_payload,
        request_id=request_id,
    )

    return response_payload


@router.get("/integrations/telemetry/snapshot-governance")
async def get_integrations_telemetry_snapshot_governance(
    retention_days: int = 30,
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return operator-facing telemetry snapshot governance and retention status."""
    governance_export_schema_version = _get_governance_export_schema_version()
    schema_metadata = _build_governance_schema_metadata()
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
    latest_snapshot_sendgrid_webhook_timestamp = _normalize_sendgrid_webhook_timestamp_rollup(
        {}
    )
    latest_snapshot_sendgrid_webhook_timestamp_present = False
    if latest_snapshot_path and latest_snapshot_path.exists():
        try:
            latest_snapshot_payload = json.loads(
                latest_snapshot_path.read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            latest_snapshot_payload = {}
        if isinstance(latest_snapshot_payload, dict):
            latest_snapshot_summary = _coerce_payload_map(
                latest_snapshot_payload.get("summary")
            )
            sendgrid_snapshot_payload: Any = None
            if "sendgridWebhookTimestamp" in latest_snapshot_payload:
                sendgrid_snapshot_payload = latest_snapshot_payload.get(
                    "sendgridWebhookTimestamp"
                )
            elif "sendgridWebhookTimestamp" in latest_snapshot_summary:
                sendgrid_snapshot_payload = latest_snapshot_summary.get(
                    "sendgridWebhookTimestamp"
                )
            if sendgrid_snapshot_payload is not None:
                latest_snapshot_sendgrid_webhook_timestamp_present = True
                latest_snapshot_sendgrid_webhook_timestamp = (
                    _normalize_sendgrid_webhook_timestamp_rollup(
                        sendgrid_snapshot_payload
                    )
                )

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
    alert_response_matrix: List[Dict[str, Any]] = []
    if latest_snapshot_path is None:
        alerts.append("Telemetry snapshot artifact is missing.")
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "snapshot_missing",
                "action": "Generate latest telemetry snapshot artifact and re-run governance checks.",
                "command": "npm run verify:telemetry:traceability:fixture",
            }
        )
    elif not within_retention:
        alerts.append("Latest telemetry snapshot is outside retention threshold.")
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "snapshot_stale",
                "action": "Execute retention cleanup and regenerate telemetry snapshot before rollout review.",
                "command": "npm run verify:telemetry:traceability:cleanup:policy",
            }
        )
    if missing_profiles:
        alerts.append(
            "Release-gate fixture profile(s) missing: "
            + ", ".join(missing_profiles)
        )
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "QA Engineer",
                "trigger": "fixture_profiles_missing",
                "action": "Regenerate missing release-gate fixture profiles and re-run fixture contract checks.",
                "command": "npm run verify:release-gate:artifact:fixtures",
            }
        )
    if not alert_response_matrix:
        alert_response_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "governance_ready",
                "action": "Continue rollout readiness review and preserve governance evidence artifacts.",
                "command": "npm run verify:ci:sales:extended",
            }
        )
    reason_codes = _attach_governance_reason_codes(
        alert_response_matrix,
        fallback="governance_snapshot",
    )
    recommended_commands = _normalize_recommended_commands(
        [item.get("command") for item in alert_response_matrix]
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
    snapshot_sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        latest_snapshot_sendgrid_webhook_timestamp,
        latest_snapshot_sendgrid_webhook_timestamp,
        latest_snapshot_sendgrid_webhook_timestamp.get("eventCount"),
        latest_snapshot_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal"),
    )
    governance_payload = {
        "status": status,
        "retention_days": retention_days,
        "snapshot_file_count": len(snapshot_files),
        "stale_count": stale_snapshot_count,
        "within_retention": within_retention,
        "all_fixture_profiles_available": all_profiles_available,
        "missing_fixture_profiles": missing_profiles,
        "sendgrid_webhook_timestamp_present": (
            latest_snapshot_sendgrid_webhook_timestamp_present
        ),
        "sendgrid_webhook_timestamp_event_count": (
            latest_snapshot_sendgrid_webhook_timestamp.get("eventCount")
        ),
        "sendgrid_webhook_timestamp_anomaly_count_total": (
            latest_snapshot_sendgrid_webhook_timestamp.get(
                "timestampAnomalyCountTotal"
            )
        ),
        "sendgrid_webhook_timestamp_latest_event_at": (
            latest_snapshot_sendgrid_webhook_timestamp.get("latestEventAt")
        ),
        "sendgrid_webhook_timestamp_pressure_label_counts": (
            latest_snapshot_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_nested": snapshot_sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_event_count_matches_totals": snapshot_sendgrid_webhook_timestamp_parity.get(
            "eventCountMatchesTotals"
        ),
        "sendgrid_webhook_timestamp_parity_anomaly_count_total_matches_nested": snapshot_sendgrid_webhook_timestamp_parity.get(
            "anomalyCountTotalMatchesNested"
        ),
        "sendgrid_webhook_timestamp_parity_pressure_label_counts_match_nested": snapshot_sendgrid_webhook_timestamp_parity.get(
            "pressureLabelCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_age_bucket_counts_match_nested": snapshot_sendgrid_webhook_timestamp_parity.get(
            "ageBucketCountsMatchNested"
        ),
        "sendgrid_webhook_timestamp_parity_latest_event_at_matches_nested": snapshot_sendgrid_webhook_timestamp_parity.get(
            "latestEventAtMatchesNested"
        ),
        "reason_codes": reason_codes,
        "reason_code_count": len(reason_codes),
        "recommended_commands": recommended_commands,
        "recommended_command_count": len(recommended_commands),
        "schema_metadata_source": schema_metadata.get("source"),
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

    governance_export = {
        "governanceType": "snapshot",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "status": status,
        "rolloutBlocked": handoff["rolloutBlocked"],
        "ownerRole": handoff["ownerRole"],
        "sendgridWebhookTimestamp": latest_snapshot_sendgrid_webhook_timestamp,
        "sendgridWebhookTimestampParity": snapshot_sendgrid_webhook_timestamp_parity,
        "alerts": [
            {
                "severity": item.get("severity", "info"),
                "ownerRole": item.get("ownerRole", "Release Manager"),
                "message": item.get("action"),
                "trigger": item.get("trigger"),
                "command": item.get("command"),
                "reasonCode": item.get("reasonCode"),
            }
            for item in alert_response_matrix
        ],
        "actions": alert_response_matrix,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "evaluatedAt": now.isoformat(),
        "requestedBy": current_user.get("id"),
    }
    return {
        "generatedAt": now.isoformat(),
        "governanceType": "snapshot",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "retentionDays": retention_days,
        "status": status,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
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
        "sendgridWebhookTimestamp": latest_snapshot_sendgrid_webhook_timestamp,
        "sendgridWebhookTimestampParity": snapshot_sendgrid_webhook_timestamp_parity,
        "releaseGateFixtures": {
            "profiles": release_profiles,
            "allProfilesAvailable": all_profiles_available,
            "missingProfiles": missing_profiles,
        },
        "alerts": alerts,
        "handoff": handoff,
        "rolloutActions": alert_response_matrix,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "governanceExport": governance_export,
        "requestedBy": current_user.get("id"),
    }


@router.get("/integrations/telemetry/baseline-governance")
async def get_integrations_baseline_governance(
    current_user: dict = Depends(get_current_user),
    http_request: Request = None,
):
    """Return baseline artifact policy posture for release-fixture governance."""
    governance_export_schema_version = _get_governance_export_schema_version()
    schema_metadata = _build_governance_schema_metadata()
    artifact_path = BASELINE_METRICS_ARTIFACT_PATH
    if not artifact_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Baseline metrics artifact not found: {artifact_path}",
        )
    try:
        raw_payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(
            status_code=422,
            detail=f"Baseline metrics artifact is invalid JSON: {artifact_path}",
        )
    if not isinstance(raw_payload, dict):
        raise HTTPException(
            status_code=422,
            detail=f"Baseline metrics artifact must be a JSON object: {artifact_path}",
        )
    payload = raw_payload

    fixture_policy = _coerce_payload_map(payload.get("releaseGateFixturePolicy"))
    fixture_status = _coerce_payload_map(payload.get("releaseGateFixtures"))
    orchestration_gate_payload = _coerce_payload_map(payload.get("orchestrationGate"))
    missing_profiles = fixture_policy.get("missingProfiles")
    if not isinstance(missing_profiles, list):
        missing_profiles = []
    required_profiles = fixture_policy.get("requiredProfiles")
    if not isinstance(required_profiles, list):
        required_profiles = []

    policy_passed = fixture_policy.get("passed") is True
    all_profiles_available = fixture_status.get("allProfilesAvailable") is True
    available_profile_count = _coerce_non_negative_int(
        fixture_status.get("availableProfileCount"),
        0,
    )
    profile_count = _coerce_non_negative_int(
        fixture_status.get("profileCount"),
        0,
    )
    orchestration_gate_available = orchestration_gate_payload.get("available") is True
    orchestration_gate_decision = orchestration_gate_payload.get("decision")
    if not isinstance(orchestration_gate_decision, str) or not orchestration_gate_decision:
        orchestration_gate_decision = None

    orchestration_attempt_error_gate_passed_value = orchestration_gate_payload.get(
        "attemptErrorGatePassed"
    )
    orchestration_attempt_error_gate_passed = (
        orchestration_attempt_error_gate_passed_value
        if isinstance(orchestration_attempt_error_gate_passed_value, bool)
        else None
    )
    orchestration_attempt_skipped_gate_passed_value = orchestration_gate_payload.get(
        "attemptSkippedGatePassed"
    )
    orchestration_attempt_skipped_gate_passed = (
        orchestration_attempt_skipped_gate_passed_value
        if isinstance(orchestration_attempt_skipped_gate_passed_value, bool)
        else None
    )
    orchestration_max_attempt_error_count_threshold = _coerce_non_negative_int_optional_strict(
        orchestration_gate_payload.get("maxAttemptErrorCountThreshold")
    )
    orchestration_observed_attempt_error_count = _coerce_non_negative_int_optional_strict(
        orchestration_gate_payload.get("observedAttemptErrorCount")
    )
    orchestration_max_attempt_skipped_count_threshold = _coerce_non_negative_int_optional_strict(
        orchestration_gate_payload.get("maxAttemptSkippedCountThreshold")
    )
    orchestration_observed_attempt_skipped_count = _coerce_non_negative_int_optional_strict(
        orchestration_gate_payload.get("observedAttemptSkippedCount")
    )
    orchestration_gate_passed = (
        orchestration_gate_available
        and orchestration_attempt_error_gate_passed is True
        and orchestration_attempt_skipped_gate_passed is True
    )
    orchestration_gate_needs_remediation = (
        not orchestration_gate_available
        or orchestration_attempt_error_gate_passed is not True
        or orchestration_attempt_skipped_gate_passed is not True
    )

    runtime_prereqs_present = "runtimePrereqs" in payload
    runtime_prereqs_payload = _coerce_payload_map(payload.get("runtimePrereqs"))
    runtime_prereqs_available = runtime_prereqs_payload.get("available") is True
    runtime_prereqs_passed_value = runtime_prereqs_payload.get("passed")
    runtime_prereqs_passed = (
        runtime_prereqs_passed_value
        if isinstance(runtime_prereqs_passed_value, bool)
        else None
    )
    runtime_prereqs_contract_valid_value = runtime_prereqs_payload.get("contractValid")
    runtime_prereqs_contract_valid = (
        runtime_prereqs_contract_valid_value
        if isinstance(runtime_prereqs_contract_valid_value, bool)
        else None
    )
    runtime_prereqs_valid_value = runtime_prereqs_payload.get("valid")
    runtime_prereqs_valid = (
        runtime_prereqs_valid_value
        if isinstance(runtime_prereqs_valid_value, bool)
        else None
    )
    runtime_prereqs_command = runtime_prereqs_payload.get("command")
    if not isinstance(runtime_prereqs_command, str) or not runtime_prereqs_command.strip():
        runtime_prereqs_command = None
    else:
        runtime_prereqs_command = runtime_prereqs_command.strip()
    runtime_prereqs_artifact_path = runtime_prereqs_payload.get("artifactPath")
    if not isinstance(runtime_prereqs_artifact_path, str) or not runtime_prereqs_artifact_path.strip():
        runtime_prereqs_artifact_path = None
    else:
        runtime_prereqs_artifact_path = runtime_prereqs_artifact_path.strip()
    runtime_prereqs_generated_at = runtime_prereqs_payload.get("generatedAt")
    if not isinstance(runtime_prereqs_generated_at, str) or not runtime_prereqs_generated_at.strip():
        runtime_prereqs_generated_at = None
    else:
        runtime_prereqs_generated_at = runtime_prereqs_generated_at.strip()
    runtime_prereqs_validated_at = runtime_prereqs_payload.get("validatedAt")
    if not isinstance(runtime_prereqs_validated_at, str) or not runtime_prereqs_validated_at.strip():
        runtime_prereqs_validated_at = None
    else:
        runtime_prereqs_validated_at = runtime_prereqs_validated_at.strip()

    runtime_prereqs_missing_checks = _coerce_payload_map(
        runtime_prereqs_payload.get("missingChecks")
    )
    runtime_prereqs_missing_commands = _normalize_string_list(
        runtime_prereqs_missing_checks.get("commands")
    )
    runtime_prereqs_missing_workspace = _normalize_string_list(
        runtime_prereqs_missing_checks.get("workspace")
    )
    runtime_prereqs_missing_check_count = _coerce_non_negative_int(
        runtime_prereqs_payload.get("missingCheckCount"),
        len(runtime_prereqs_missing_commands) + len(runtime_prereqs_missing_workspace),
    )
    runtime_prereqs_gate_passed = (
        runtime_prereqs_passed is True if runtime_prereqs_present else True
    )
    runtime_prereqs_needs_remediation = runtime_prereqs_present and not runtime_prereqs_gate_passed
    command_aliases_summary = _resolve_baseline_command_aliases_summary(
        payload.get("commandAliases")
    )
    command_aliases_needs_remediation = (
        command_aliases_summary.get("present") is True
        and command_aliases_summary.get("gatePassed") is False
    )

    status = (
        "PASS"
        if (
            policy_passed
            and all_profiles_available
            and orchestration_gate_passed
            and runtime_prereqs_gate_passed
        )
        else "FAIL"
    )
    alerts: List[str] = []
    alert_response_matrix: List[Dict[str, Any]] = []
    if not policy_passed:
        alerts.append("Baseline fixture governance policy failed.")
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "baseline_policy_failed",
                "action": "Re-run baseline metrics collection and verify fixture policy compliance.",
                "command": "npm run verify:baseline:metrics",
            }
        )
    if not all_profiles_available:
        alerts.append("Baseline fixture availability status is incomplete or failed.")
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "QA Engineer",
                "trigger": "baseline_fixture_availability_failed",
                "action": "Regenerate release-gate fixture profiles and verify fixture availability metadata.",
                "command": "npm run verify:release-gate:artifact:fixtures",
            }
        )
    if missing_profiles:
        alerts.append(
            "Missing release-gate fixture profile(s): " + ", ".join(missing_profiles)
        )
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "QA Engineer",
                "trigger": "baseline_missing_profiles",
                "action": "Generate missing release-gate fixture profiles and re-run fixture checks.",
                "command": "npm run verify:release-gate:artifact:fixtures",
            }
        )
    if not orchestration_gate_available:
        alerts.append("Baseline orchestration gate evidence is unavailable.")
        alert_response_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "baseline_orchestration_gate_unavailable",
                "action": (
                    "Run baseline orchestration remediation workflow to regenerate orchestration evidence "
                    "and baseline governance posture."
                ),
                "command": BASELINE_ORCHESTRATION_REMEDIATION_COMMAND,
            }
        )
    else:
        if orchestration_attempt_error_gate_passed is not True:
            alerts.append(
                "Baseline orchestration gate failed: attempt error threshold exceeded or missing."
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Integrations Engineer",
                    "trigger": "baseline_orchestration_attempt_error_failed",
                    "action": (
                        "Reduce orchestration attempt errors and run baseline orchestration remediation workflow."
                    ),
                    "command": BASELINE_ORCHESTRATION_REMEDIATION_COMMAND,
                }
            )
        if orchestration_attempt_skipped_gate_passed is not True:
            alerts.append(
                "Baseline orchestration gate failed: skipped-attempt threshold exceeded or missing."
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Integrations Engineer",
                    "trigger": "baseline_orchestration_attempt_skipped_failed",
                    "action": (
                        "Resolve orchestration skipped-attempt causes (for example missing domains) and run "
                        "baseline orchestration remediation workflow."
                    ),
                    "command": BASELINE_ORCHESTRATION_REMEDIATION_COMMAND,
                }
            )
    if runtime_prereqs_needs_remediation:
        if not runtime_prereqs_available:
            alerts.append("Baseline runtime prerequisite artifact evidence is unavailable.")
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_runtime_prereqs_artifact_missing",
                    "action": (
                        "Generate runtime prerequisite artifact evidence before baseline governance "
                        "review."
                    ),
                    "command": BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
                }
            )
        if runtime_prereqs_contract_valid is not True:
            alerts.append(
                "Baseline runtime prerequisite artifact contract is invalid or missing."
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "QA Engineer",
                    "trigger": "baseline_runtime_prereqs_contract_failed",
                    "action": (
                        "Validate runtime prerequisite artifact contract and regenerate artifact "
                        "if needed."
                    ),
                    "command": BASELINE_RUNTIME_PREREQS_ARTIFACT_CONTRACT_COMMAND,
                }
            )
        if runtime_prereqs_valid is not True or runtime_prereqs_missing_check_count > 0:
            missing_components: List[str] = []
            if runtime_prereqs_missing_commands:
                missing_components.append(
                    "commands: " + ", ".join(runtime_prereqs_missing_commands)
                )
            if runtime_prereqs_missing_workspace:
                missing_components.append(
                    "workspace: " + ", ".join(runtime_prereqs_missing_workspace)
                )
            detail_suffix = (
                f" ({'; '.join(missing_components)})" if missing_components else ""
            )
            alerts.append(
                "Baseline runtime prerequisite checks failed or are incomplete."
                + detail_suffix
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_runtime_prereqs_check_failed",
                    "action": (
                        "Run runtime prerequisite remediation smoke and verify runtime baseline "
                        "artifact checks pass."
                    ),
                    "command": BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND,
                }
            )
    if command_aliases_needs_remediation:
        if command_aliases_summary.get("available") is not True:
            alerts.append("Baseline command-alias artifact evidence is unavailable.")
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_command_aliases_artifact_missing",
                    "action": (
                        "Generate baseline command-alias artifact evidence before rollout review."
                    ),
                    "command": BASELINE_COMMAND_ALIAS_ARTIFACT_COMMAND,
                }
            )
        if command_aliases_summary.get("contractValid") is not True:
            alerts.append(
                "Baseline command-alias artifact contract is invalid or missing required fields."
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "QA Engineer",
                    "trigger": "baseline_command_aliases_artifact_contract_failed",
                    "action": (
                        "Validate baseline command-alias artifact contract and regenerate artifact "
                        "if needed."
                    ),
                    "command": BASELINE_COMMAND_ALIAS_ARTIFACT_CONTRACT_COMMAND,
                }
            )
        if (
            command_aliases_summary.get("valid") is not True
            or int(command_aliases_summary.get("missingAliasCount") or 0) > 0
            or int(command_aliases_summary.get("mismatchedAliasCount") or 0) > 0
        ):
            detail_components: List[str] = []
            if command_aliases_summary.get("missingAliases"):
                detail_components.append(
                    "missing: " + ", ".join(command_aliases_summary["missingAliases"])
                )
            if command_aliases_summary.get("mismatchedAliases"):
                detail_components.append(
                    "mismatched: "
                    + ", ".join(command_aliases_summary["mismatchedAliases"])
                )
            detail_suffix = (
                f" ({'; '.join(detail_components)})" if detail_components else ""
            )
            alerts.append(
                "Baseline command-alias checks failed or are incomplete."
                + detail_suffix
            )
            alert_response_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_command_aliases_checks_failed",
                    "action": (
                        "Run baseline command-alias artifact smoke checks and verify alias "
                        "mapping parity."
                    ),
                    "command": BASELINE_COMMAND_ALIAS_ARTIFACT_SMOKE_COMMAND,
                }
            )
    if not alert_response_matrix:
        alert_response_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "baseline_governance_ready",
                "action": "Baseline governance is healthy; proceed with signoff evidence review.",
                "command": "npm run verify:ci:sales:extended",
            }
        )
    reason_codes = _attach_governance_reason_codes(
        alert_response_matrix,
        fallback="governance_baseline",
    )
    handoff = {
        "rolloutBlocked": status != "PASS",
        "ownerRole": "Release Manager",
        "actions": [item["action"] for item in alert_response_matrix],
    }
    recommended_commands = _build_baseline_governance_recommended_commands(
        status=status,
        orchestration_gate_needs_remediation=orchestration_gate_needs_remediation,
        actions=alert_response_matrix,
        artifact_commands=payload.get("recommendedCommands"),
    )
    governance_export = {
        "governanceType": "baseline",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "status": status,
        "rolloutBlocked": handoff["rolloutBlocked"],
        "ownerRole": handoff["ownerRole"],
        "alerts": [
            {
                "severity": item.get("severity", "info"),
                "ownerRole": item.get("ownerRole", "Release Manager"),
                "message": item.get("action"),
                "trigger": item.get("trigger"),
                "command": item.get("command"),
                "reasonCode": item.get("reasonCode"),
            }
            for item in alert_response_matrix
        ],
        "actions": alert_response_matrix,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "orchestrationGate": {
            "available": orchestration_gate_available,
            "decision": orchestration_gate_decision,
            "attemptErrorGatePassed": orchestration_attempt_error_gate_passed,
            "attemptSkippedGatePassed": orchestration_attempt_skipped_gate_passed,
            "maxAttemptErrorCountThreshold": orchestration_max_attempt_error_count_threshold,
            "observedAttemptErrorCount": orchestration_observed_attempt_error_count,
            "maxAttemptSkippedCountThreshold": orchestration_max_attempt_skipped_count_threshold,
            "observedAttemptSkippedCount": orchestration_observed_attempt_skipped_count,
        },
        "runtimePrereqs": {
            "present": runtime_prereqs_present,
            "available": runtime_prereqs_available,
            "passed": runtime_prereqs_passed,
            "contractValid": runtime_prereqs_contract_valid,
            "valid": runtime_prereqs_valid,
            "missingCheckCount": runtime_prereqs_missing_check_count,
            "missingChecks": {
                "commands": runtime_prereqs_missing_commands,
                "workspace": runtime_prereqs_missing_workspace,
            },
            "artifactPath": runtime_prereqs_artifact_path,
            "generatedAt": runtime_prereqs_generated_at,
            "validatedAt": runtime_prereqs_validated_at,
            "command": runtime_prereqs_command,
        },
        "commandAliases": command_aliases_summary,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "requestedBy": current_user.get("id"),
    }
    response_payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "governanceType": "baseline",
        "exportSchemaVersion": governance_export_schema_version,
        "schemaMetadata": schema_metadata,
        "artifactGeneratedAt": payload.get("generatedAt"),
        "artifactPath": str(artifact_path),
        "overallStatus": payload.get("overallStatus"),
        "status": status,
        "reasonCodes": reason_codes,
        "reasonCodeCount": len(reason_codes),
        "releaseGateFixturePolicy": {
            "passed": policy_passed,
            "requiredProfiles": required_profiles,
            "missingProfiles": missing_profiles,
            "message": fixture_policy.get("message"),
        },
        "releaseGateFixtures": {
            "allProfilesAvailable": all_profiles_available,
            "availableProfileCount": available_profile_count,
            "profileCount": profile_count,
        },
        "orchestrationGate": {
            "available": orchestration_gate_available,
            "decision": orchestration_gate_decision,
            "attemptErrorGatePassed": orchestration_attempt_error_gate_passed,
            "attemptSkippedGatePassed": orchestration_attempt_skipped_gate_passed,
            "maxAttemptErrorCountThreshold": orchestration_max_attempt_error_count_threshold,
            "observedAttemptErrorCount": orchestration_observed_attempt_error_count,
            "maxAttemptSkippedCountThreshold": orchestration_max_attempt_skipped_count_threshold,
            "observedAttemptSkippedCount": orchestration_observed_attempt_skipped_count,
        },
        "runtimePrereqs": {
            "present": runtime_prereqs_present,
            "available": runtime_prereqs_available,
            "passed": runtime_prereqs_passed,
            "contractValid": runtime_prereqs_contract_valid,
            "valid": runtime_prereqs_valid,
            "missingCheckCount": runtime_prereqs_missing_check_count,
            "missingChecks": {
                "commands": runtime_prereqs_missing_commands,
                "workspace": runtime_prereqs_missing_workspace,
            },
            "artifactPath": runtime_prereqs_artifact_path,
            "generatedAt": runtime_prereqs_generated_at,
            "validatedAt": runtime_prereqs_validated_at,
            "command": runtime_prereqs_command,
        },
        "commandAliases": command_aliases_summary,
        "alerts": alerts,
        "handoff": handoff,
        "rolloutActions": alert_response_matrix,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": len(recommended_commands),
        "governanceExport": governance_export,
        "requestedBy": current_user.get("id"),
    }
    governance_payload = {
        "status": status,
        "overall_status": payload.get("overallStatus"),
        "policy_passed": policy_passed,
        "all_profiles_available": response_payload["releaseGateFixtures"][
            "allProfilesAvailable"
        ],
        "orchestration_gate_available": orchestration_gate_available,
        "orchestration_attempt_error_gate_passed": orchestration_attempt_error_gate_passed,
        "orchestration_attempt_skipped_gate_passed": orchestration_attempt_skipped_gate_passed,
        "orchestration_attempt_error_observed_count": orchestration_observed_attempt_error_count,
        "orchestration_attempt_skipped_observed_count": orchestration_observed_attempt_skipped_count,
        "orchestration_decision": orchestration_gate_decision,
        "runtime_prereqs_present": runtime_prereqs_present,
        "runtime_prereqs_available": runtime_prereqs_available,
        "runtime_prereqs_passed": runtime_prereqs_passed,
        "runtime_prereqs_contract_valid": runtime_prereqs_contract_valid,
        "runtime_prereqs_valid": runtime_prereqs_valid,
        "runtime_prereqs_missing_check_count": runtime_prereqs_missing_check_count,
        "runtime_prereqs_missing_commands": runtime_prereqs_missing_commands,
        "runtime_prereqs_missing_workspace": runtime_prereqs_missing_workspace,
        "command_aliases_present": command_aliases_summary.get("present"),
        "command_aliases_available": command_aliases_summary.get("available"),
        "command_aliases_contract_valid": command_aliases_summary.get("contractValid"),
        "command_aliases_valid": command_aliases_summary.get("valid"),
        "command_aliases_gate_passed": command_aliases_summary.get("gatePassed"),
        "command_aliases_missing_alias_count": command_aliases_summary.get(
            "missingAliasCount"
        ),
        "command_aliases_mismatched_alias_count": command_aliases_summary.get(
            "mismatchedAliasCount"
        ),
        "command_aliases_missing_aliases": command_aliases_summary.get(
            "missingAliases"
        ),
        "command_aliases_mismatched_aliases": command_aliases_summary.get(
            "mismatchedAliases"
        ),
        "command_aliases_source": command_aliases_summary.get("source"),
        "missing_profiles": missing_profiles,
        "reason_codes": reason_codes,
        "reason_code_count": len(reason_codes),
        "recommended_commands": recommended_commands,
        "recommended_command_count": len(recommended_commands),
        "schema_metadata_source": schema_metadata.get("source"),
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
    max_retry_audit_event_count: Optional[int] = None,
    max_retry_audit_avg_next_delay_seconds: Optional[float] = None,
    max_orchestration_attempt_error_count: Optional[int] = None,
    max_orchestration_attempt_skipped_count: Optional[int] = None,
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
    retry_audit_event_threshold, retry_audit_avg_delay_threshold = (
        _resolve_retry_audit_slo_thresholds(
            max_retry_audit_event_count=max_retry_audit_event_count,
            max_retry_audit_avg_next_delay_seconds=max_retry_audit_avg_next_delay_seconds,
        )
    )
    orchestration_error_threshold, orchestration_skipped_threshold = (
        _resolve_orchestration_audit_slo_thresholds(
            max_orchestration_attempt_error_count=max_orchestration_attempt_error_count,
            max_orchestration_attempt_skipped_count=max_orchestration_attempt_skipped_count,
        )
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
    retry_audit_event_count = 0
    retry_audit_next_delay_seconds: List[float] = []
    orchestration_attempt_error_count = 0
    orchestration_attempt_skipped_count = 0
    for event in events:
        event_type = str(event.get("eventType", "")).lower()
        if _is_internal_traceability_event(event_type):
            continue
        considered_events += 1
        provider = str(event.get("provider", ""))
        payload = _coerce_payload_map(event.get("payload"))
        if "error" in event_type:
            error_events += 1
        if event_type == INTEGRATION_RETRY_ATTEMPT_EVENT_TYPE:
            retry_audit_event_count += 1
            next_delay_seconds = _coerce_non_negative_float(
                payload.get("next_delay_seconds"),
                fallback=None,
            )
            if next_delay_seconds is not None:
                retry_audit_next_delay_seconds.append(next_delay_seconds)
        if event_type == "company_enrichment_orchestrated":
            orchestration_attempt_error_count += _coerce_non_negative_int(
                payload.get("attempt_error_count"),
                fallback=0,
            )
            orchestration_attempt_skipped_count += _coerce_non_negative_int(
                payload.get("attempt_skipped_count"),
                fallback=0,
            )
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
    retry_audit_avg_next_delay_seconds = (
        sum(retry_audit_next_delay_seconds) / len(retry_audit_next_delay_seconds)
        if retry_audit_next_delay_seconds
        else 0.0
    )
    retry_audit_max_next_delay_seconds = (
        max(retry_audit_next_delay_seconds)
        if retry_audit_next_delay_seconds
        else None
    )
    retry_audit_volume_passed = retry_audit_event_count <= retry_audit_event_threshold
    retry_audit_delay_passed = (
        retry_audit_avg_next_delay_seconds <= retry_audit_avg_delay_threshold
    )
    orchestration_attempt_error_passed = (
        orchestration_attempt_error_count <= orchestration_error_threshold
    )
    orchestration_attempt_skipped_passed = (
        orchestration_attempt_skipped_count <= orchestration_skipped_threshold
    )

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
        and retry_audit_volume_passed
        and retry_audit_delay_passed
        and orchestration_attempt_error_passed
        and orchestration_attempt_skipped_passed
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
    if not retry_audit_volume_passed:
        alerts.append(
            {
                "gate": "retry_audit_volume",
                "severity": "medium",
                "message": (
                    f"Retry audit event count {retry_audit_event_count} exceeds "
                    f"threshold {retry_audit_event_threshold}"
                ),
            }
        )
    if not retry_audit_delay_passed:
        alerts.append(
            {
                "gate": "retry_audit_delay",
                "severity": "medium",
                "message": (
                    "Retry audit average next delay "
                    f"{round(retry_audit_avg_next_delay_seconds, 4)}s exceeds "
                    f"threshold {retry_audit_avg_delay_threshold}s"
                ),
            }
        )
    if not orchestration_attempt_error_passed:
        alerts.append(
            {
                "gate": "orchestration_attempt_error",
                "severity": "medium",
                "message": (
                    f"Orchestration attempt error count {orchestration_attempt_error_count} exceeds "
                    f"threshold {orchestration_error_threshold}"
                ),
            }
        )
    if not orchestration_attempt_skipped_passed:
        alerts.append(
            {
                "gate": "orchestration_attempt_skipped",
                "severity": "low",
                "message": (
                    f"Orchestration attempt skipped count {orchestration_attempt_skipped_count} exceeds "
                    f"threshold {orchestration_skipped_threshold}"
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
        "retry_audit_event_count": retry_audit_event_count,
        "retry_audit_volume_passed": retry_audit_volume_passed,
        "retry_audit_delay_passed": retry_audit_delay_passed,
        "orchestration_attempt_error_count": orchestration_attempt_error_count,
        "orchestration_attempt_skipped_count": orchestration_attempt_skipped_count,
        "orchestration_attempt_error_passed": orchestration_attempt_error_passed,
        "orchestration_attempt_skipped_passed": orchestration_attempt_skipped_passed,
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
            "retryAuditVolumePassed": retry_audit_volume_passed,
            "retryAuditDelayPassed": retry_audit_delay_passed,
            "orchestrationAttemptErrorPassed": orchestration_attempt_error_passed,
            "orchestrationAttemptSkippedPassed": orchestration_attempt_skipped_passed,
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
        "retryAudit": {
            "maxEventCountThreshold": retry_audit_event_threshold,
            "observedEventCount": retry_audit_event_count,
            "maxAvgNextDelaySecondsThreshold": retry_audit_avg_delay_threshold,
            "observedAvgNextDelaySeconds": round(retry_audit_avg_next_delay_seconds, 4),
            "observedMaxNextDelaySeconds": (
                round(retry_audit_max_next_delay_seconds, 4)
                if retry_audit_max_next_delay_seconds is not None
                else None
            ),
        },
        "orchestrationAudit": {
            "maxAttemptErrorCountThreshold": orchestration_error_threshold,
            "observedAttemptErrorCount": orchestration_attempt_error_count,
            "maxAttemptSkippedCountThreshold": orchestration_skipped_threshold,
            "observedAttemptSkippedCount": orchestration_attempt_skipped_count,
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
