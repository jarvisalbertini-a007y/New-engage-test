#!/usr/bin/env python3
"""
Generate governance handoff/history packet fixtures from weekly report artifacts.

Usage:
  python backend/scripts/generate_governance_packet_fixture.py \
    --report backend/test_reports/connector_governance_weekly_report.json \
    --handoff backend/test_reports/governance_handoff_export.json \
    --history backend/test_reports/governance_history_export.json
"""

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

GOVERNANCE_EXPORT_SCHEMA_VERSION = int(
    os.environ.get("GOVERNANCE_EXPORT_SCHEMA_VERSION", "1")
)
ALLOWED_PACKET_STATUSES = {"READY", "ACTION_REQUIRED"}
DEFAULT_RUNTIME_PREREQS_COMMAND = "npm run verify:baseline:runtime-prereqs:artifact"
DEFAULT_COMMAND_ALIASES_COMMAND = "npm run verify:baseline:command-aliases:artifact"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate governance handoff/history packet fixture artifacts"
    )
    parser.add_argument(
        "--report",
        default="backend/test_reports/connector_governance_weekly_report.json",
        help="Path to weekly governance report artifact",
    )
    parser.add_argument(
        "--handoff",
        default="backend/test_reports/governance_handoff_export.json",
        help="Path to handoff export output artifact",
    )
    parser.add_argument(
        "--history",
        default="backend/test_reports/governance_history_export.json",
        help="Path to history export output artifact",
    )
    parser.add_argument(
        "--requested-by",
        default="u1",
        help="Requested-by user identifier to stamp in generated artifacts",
    )
    return parser.parse_args()


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _normalize_status(value: Any) -> str:
    if not _is_non_empty_string(value):
        return ""
    candidate = str(value).strip().upper()
    normalized = "".join(ch if ch.isalnum() else "_" for ch in candidate).strip("_")
    if not normalized:
        return ""
    return normalized


def _normalize_packet_status(value: Any, fallback: str = "ACTION_REQUIRED") -> str:
    normalized = _normalize_status(value)
    if normalized in ALLOWED_PACKET_STATUSES:
        return normalized
    return fallback


def _normalize_connector_endpoint_key(value: Any) -> str:
    candidate = str(value or "").strip().lower()
    if not candidate:
        return "unknown"
    normalized = "".join(ch if ch.isalnum() else "_" for ch in candidate).strip("_")
    return normalized or "unknown"


def _normalize_reason_code(value: Any) -> str:
    if not _is_non_empty_string(value):
        return ""
    normalized = "".join(
        ch if ch.isalnum() else "_" for ch in str(value).strip().lower()
    ).strip("_")
    return normalized


def _normalize_reason_codes(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    for value in values:
        reason_code = _normalize_reason_code(value)
        if reason_code and reason_code not in normalized:
            normalized.append(reason_code)
    return normalized


def _normalize_recommended_commands(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    for value in values:
        if not _is_non_empty_string(value):
            continue
        command = str(value).strip()
        if command not in normalized:
            normalized.append(command)
    return normalized


def _status_to_rollout_blocked(status: str) -> bool:
    return status == "ACTION_REQUIRED"


def _coerce_non_negative_int(value: Any, fallback: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed >= 0 else fallback


def _coerce_non_negative_float(value: Any, fallback: Any = None) -> Any:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed >= 0 else fallback


def _normalize_string_list(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    for value in values:
        if not _is_non_empty_string(value):
            continue
        token = str(value).strip()
        if token and token not in normalized:
            normalized.append(token)
    return normalized


def _coerce_optional_bool(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    return None


def _normalize_runtime_prereqs_rollup(
    payload: Any,
    *,
    present: bool,
    fallback_command: str,
) -> Dict[str, Any]:
    runtime_payload = payload if isinstance(payload, dict) else {}
    missing_checks_payload = (
        runtime_payload.get("missingChecks")
        if isinstance(runtime_payload.get("missingChecks"), dict)
        else {}
    )
    missing_commands = _normalize_string_list(missing_checks_payload.get("commands"))
    missing_workspace = _normalize_string_list(missing_checks_payload.get("workspace"))
    missing_check_count = _coerce_non_negative_int(
        runtime_payload.get("missingCheckCount"),
        fallback=len(missing_commands) + len(missing_workspace),
    )

    command = runtime_payload.get("command")
    if not _is_non_empty_string(command):
        command = fallback_command
    else:
        command = str(command).strip()

    artifact_path = runtime_payload.get("artifactPath")
    if not _is_non_empty_string(artifact_path):
        artifact_path = None
    else:
        artifact_path = str(artifact_path).strip()

    generated_at = runtime_payload.get("generatedAt")
    if not _is_non_empty_string(generated_at):
        generated_at = None
    else:
        generated_at = str(generated_at).strip()

    validated_at = runtime_payload.get("validatedAt")
    if not _is_non_empty_string(validated_at):
        validated_at = None
    else:
        validated_at = str(validated_at).strip()

    return {
        "present": bool(present),
        "available": bool(runtime_payload.get("available")),
        "passed": _coerce_optional_bool(runtime_payload.get("passed")),
        "contractValid": _coerce_optional_bool(runtime_payload.get("contractValid")),
        "valid": _coerce_optional_bool(runtime_payload.get("valid")),
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


def _normalize_command_aliases_rollup(
    payload: Any,
    *,
    present: bool,
    fallback_command: str,
) -> Dict[str, Any]:
    command_aliases_payload = payload if isinstance(payload, dict) else {}
    missing_aliases = _normalize_string_list(command_aliases_payload.get("missingAliases"))
    mismatched_aliases = _normalize_string_list(
        command_aliases_payload.get("mismatchedAliases")
    )
    missing_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("missingAliasCount"),
        fallback=len(missing_aliases),
    )
    mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("mismatchedAliasCount"),
        fallback=len(mismatched_aliases),
    )

    command = command_aliases_payload.get("command")
    if not _is_non_empty_string(command):
        command = fallback_command
    else:
        command = str(command).strip()

    artifact_path = command_aliases_payload.get("artifactPath")
    if not _is_non_empty_string(artifact_path):
        artifact_path = None
    else:
        artifact_path = str(artifact_path).strip()

    generated_at = command_aliases_payload.get("generatedAt")
    if not _is_non_empty_string(generated_at):
        generated_at = None
    else:
        generated_at = str(generated_at).strip()

    validated_at = command_aliases_payload.get("validatedAt")
    if not _is_non_empty_string(validated_at):
        validated_at = None
    else:
        validated_at = str(validated_at).strip()

    source = command_aliases_payload.get("source")
    if not _is_non_empty_string(source):
        source = "governance_weekly_report"
    else:
        source = str(source).strip()

    return {
        "present": bool(present),
        "available": bool(command_aliases_payload.get("available")),
        "source": source,
        "gatePassed": _coerce_optional_bool(command_aliases_payload.get("gatePassed")),
        "contractValid": _coerce_optional_bool(command_aliases_payload.get("contractValid")),
        "valid": _coerce_optional_bool(command_aliases_payload.get("valid")),
        "missingAliasCount": missing_alias_count,
        "mismatchedAliasCount": mismatched_alias_count,
        "missingAliases": missing_aliases,
        "mismatchedAliases": mismatched_aliases,
        "artifactPath": artifact_path,
        "generatedAt": generated_at,
        "validatedAt": validated_at,
        "command": command,
    }


def _resolve_connector_rate_limit_pressure(
    max_retry_after_seconds: Any,
    avg_reset_in_seconds: Any,
) -> Dict[str, Any]:
    signal = max(
        _coerce_non_negative_float(max_retry_after_seconds, fallback=0.0) or 0.0,
        _coerce_non_negative_float(avg_reset_in_seconds, fallback=0.0) or 0.0,
    )
    if signal >= 45:
        return {
            "label": "High",
            "hint": "Connector throttling pressure is high; prioritize cooldown and queue pacing before rollout expansion.",
            "signalSeconds": signal,
            "thresholdSeconds": 45,
        }
    if signal >= 20:
        return {
            "label": "Moderate",
            "hint": "Connector throttling pressure is moderate; monitor cooldowns and retry pacing during rollout.",
            "signalSeconds": signal,
            "thresholdSeconds": 20,
        }
    if signal > 0:
        return {
            "label": "Low",
            "hint": "Connector throttling pressure is low and within expected operating range.",
            "signalSeconds": signal,
            "thresholdSeconds": 20,
        }
    return {
        "label": "Unknown",
        "hint": "No connector throttling pressure data is available in the selected evidence window.",
        "signalSeconds": 0.0,
        "thresholdSeconds": 20,
    }


def _normalize_connector_rate_limit_payload(value: Any) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    by_endpoint: Dict[str, int] = {}
    if isinstance(payload.get("byEndpoint"), dict):
        for endpoint, count in payload.get("byEndpoint", {}).items():
            endpoint_key = _normalize_connector_endpoint_key(endpoint)
            by_endpoint[endpoint_key] = (
                int(by_endpoint.get(endpoint_key, 0))
                + _coerce_non_negative_int(count, fallback=0)
            )
    event_count = _coerce_non_negative_int(payload.get("eventCount"), fallback=0)
    if event_count == 0 and by_endpoint:
        event_count = sum(by_endpoint.values())

    latest_event_at = payload.get("latestEventAt")
    if not isinstance(latest_event_at, str) or not latest_event_at.strip():
        latest_event_at = None

    max_retry = _coerce_non_negative_float(
        payload.get("maxRetryAfterSeconds"),
        fallback=None,
    )
    avg_retry = _coerce_non_negative_float(
        payload.get("avgRetryAfterSeconds"),
        fallback=None,
    )
    max_reset = _coerce_non_negative_float(
        payload.get("maxResetInSeconds"),
        fallback=None,
    )
    avg_reset = _coerce_non_negative_float(
        payload.get("avgResetInSeconds"),
        fallback=None,
    )

    return {
        "eventCount": event_count,
        "byEndpoint": by_endpoint,
        "latestEventAt": latest_event_at,
        "maxRetryAfterSeconds": max_retry,
        "avgRetryAfterSeconds": avg_retry,
        "maxResetInSeconds": max_reset,
        "avgResetInSeconds": avg_reset,
        "pressure": _resolve_connector_rate_limit_pressure(max_retry, avg_reset),
    }


def _normalize_connector_rate_limit_by_endpoint(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for endpoint, count in value.items():
        endpoint_key = _normalize_connector_endpoint_key(endpoint)
        normalized_count = _coerce_non_negative_int(count, fallback=0)
        normalized[endpoint_key] = int(normalized.get(endpoint_key, 0)) + normalized_count
    return normalized


def _normalize_connector_pressure_label(value: Any) -> Any:
    if not _is_non_empty_string(value):
        return None
    return str(value).strip().lower()


def _build_connector_pressure_parity(
    top_level_connector: Dict[str, Any],
    nested_connector: Dict[str, Any],
    totals_event_count: Any,
) -> Dict[str, Any]:
    top_level_event_count = _coerce_non_negative_int(
        top_level_connector.get("eventCount"), fallback=0
    )
    nested_event_count = _coerce_non_negative_int(
        nested_connector.get("eventCount"), fallback=0
    )
    normalized_top_level = _normalize_connector_rate_limit_by_endpoint(
        top_level_connector.get("byEndpoint")
    )
    normalized_nested = _normalize_connector_rate_limit_by_endpoint(
        nested_connector.get("byEndpoint")
    )
    top_level_label = _normalize_connector_pressure_label(
        (top_level_connector.get("pressure") or {}).get("label")
        if isinstance(top_level_connector.get("pressure"), dict)
        else None
    )
    nested_label = _normalize_connector_pressure_label(
        (nested_connector.get("pressure") or {}).get("label")
        if isinstance(nested_connector.get("pressure"), dict)
        else None
    )
    return {
        "topLevelEventCount": top_level_event_count,
        "nestedEventCount": nested_event_count,
        "totalsEventCount": _coerce_non_negative_int(totals_event_count, fallback=0),
        "eventCountMatchesNested": top_level_event_count == nested_event_count,
        "eventCountMatchesTotals": top_level_event_count
        == _coerce_non_negative_int(totals_event_count, fallback=0),
        "byEndpointMatchesNested": normalized_top_level == normalized_nested,
        "pressureLabelMatchesNested": top_level_label == nested_label,
        "normalizedTopLevelByEndpoint": normalized_top_level,
        "normalizedNestedByEndpoint": normalized_nested,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def _normalize_sendgrid_timestamp_token(value: Any, fallback: str = "unknown") -> str:
    if not _is_non_empty_string(value):
        return fallback
    normalized = "".join(
        ch if ch.isalnum() else "_" for ch in str(value).strip().lower()
    ).strip("_")
    return normalized or fallback


def _normalize_sendgrid_timestamp_count_map(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for key, count in value.items():
        token = _normalize_sendgrid_timestamp_token(key)
        normalized_count = _coerce_non_negative_int(count, fallback=0)
        normalized[token] = int(normalized.get(token, 0)) + normalized_count
    return normalized


def _normalize_sendgrid_webhook_timestamp_payload(value: Any) -> Dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("pressureLabelCounts")
    )
    pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("pressureHintCounts")
    )
    age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("timestampAgeBucketCounts")
    )
    anomaly_event_type_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("timestampAnomalyEventTypeCounts")
    )

    event_count = _coerce_non_negative_int(payload.get("eventCount"), fallback=0)
    if event_count == 0 and pressure_label_counts:
        event_count = sum(pressure_label_counts.values())

    anomaly_count_total = _coerce_non_negative_int(
        payload.get("timestampAnomalyCountTotal"),
        fallback=0,
    )
    if anomaly_count_total == 0 and anomaly_event_type_counts:
        anomaly_count_total = sum(anomaly_event_type_counts.values())

    latest_event_at = payload.get("latestEventAt")
    if not _is_non_empty_string(latest_event_at):
        latest_event_at = None
    else:
        latest_event_at = str(latest_event_at).strip()

    return {
        "eventCount": event_count,
        "timestampAnomalyCountTotal": anomaly_count_total,
        "pressureLabelCounts": pressure_label_counts,
        "pressureHintCounts": pressure_hint_counts,
        "timestampAgeBucketCounts": age_bucket_counts,
        "timestampAnomalyEventTypeCounts": anomaly_event_type_counts,
        "latestEventAt": latest_event_at,
    }


def _maps_equal_or_none(
    top_level_map: Dict[str, int],
    nested_map: Dict[str, int],
) -> Any:
    if top_level_map or nested_map:
        return top_level_map == nested_map
    return None


def _build_sendgrid_webhook_timestamp_parity(
    top_level_sendgrid: Dict[str, Any],
    nested_sendgrid: Dict[str, Any],
    totals_sendgrid_event_count: Any,
    totals_sendgrid_anomaly_count_total: Any,
) -> Dict[str, Any]:
    top_level_payload = _normalize_sendgrid_webhook_timestamp_payload(top_level_sendgrid)
    nested_payload = _normalize_sendgrid_webhook_timestamp_payload(nested_sendgrid)

    top_level_event_count = _coerce_non_negative_int(
        top_level_payload.get("eventCount"),
        fallback=0,
    )
    nested_event_count = _coerce_non_negative_int(
        nested_payload.get("eventCount"),
        fallback=0,
    )
    totals_event_count = _coerce_non_negative_int(
        totals_sendgrid_event_count,
        fallback=top_level_event_count,
    )

    top_level_anomaly_total = _coerce_non_negative_int(
        top_level_payload.get("timestampAnomalyCountTotal"),
        fallback=0,
    )
    nested_anomaly_total = _coerce_non_negative_int(
        nested_payload.get("timestampAnomalyCountTotal"),
        fallback=0,
    )
    totals_anomaly_total = _coerce_non_negative_int(
        totals_sendgrid_anomaly_count_total,
        fallback=top_level_anomaly_total,
    )

    top_level_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("pressureLabelCounts")
    )
    nested_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("pressureLabelCounts")
    )
    top_level_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("pressureHintCounts")
    )
    nested_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("pressureHintCounts")
    )
    top_level_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("timestampAgeBucketCounts")
    )
    nested_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("timestampAgeBucketCounts")
    )
    top_level_anomaly_event_type_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("timestampAnomalyEventTypeCounts")
    )
    nested_anomaly_event_type_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("timestampAnomalyEventTypeCounts")
    )

    top_level_latest_event_at = top_level_payload.get("latestEventAt")
    nested_latest_event_at = nested_payload.get("latestEventAt")

    return {
        "topLevelEventCount": top_level_event_count,
        "nestedEventCount": nested_event_count,
        "totalsEventCount": totals_event_count,
        "topLevelAnomalyCountTotal": top_level_anomaly_total,
        "nestedAnomalyCountTotal": nested_anomaly_total,
        "totalsAnomalyCountTotal": totals_anomaly_total,
        "eventCountMatchesNested": top_level_event_count == nested_event_count,
        "eventCountMatchesTotals": top_level_event_count == totals_event_count,
        "anomalyCountTotalMatchesNested": top_level_anomaly_total == nested_anomaly_total,
        "anomalyCountTotalMatchesTotals": top_level_anomaly_total == totals_anomaly_total,
        "pressureLabelCountsMatchNested": _maps_equal_or_none(
            top_level_pressure_label_counts,
            nested_pressure_label_counts,
        ),
        "pressureHintCountsMatchNested": _maps_equal_or_none(
            top_level_pressure_hint_counts,
            nested_pressure_hint_counts,
        ),
        "ageBucketCountsMatchNested": _maps_equal_or_none(
            top_level_age_bucket_counts,
            nested_age_bucket_counts,
        ),
        "anomalyEventTypeCountsMatchNested": _maps_equal_or_none(
            top_level_anomaly_event_type_counts,
            nested_anomaly_event_type_counts,
        ),
        "latestEventAtMatchesNested": (
            top_level_latest_event_at == nested_latest_event_at
            if top_level_latest_event_at and nested_latest_event_at
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
        "normalizedLatestEventAtTopLevel": top_level_latest_event_at,
        "normalizedLatestEventAtNested": nested_latest_event_at,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def _coerce_alerts(alerts: Any, owner_role: str) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(alerts, list):
        return normalized
    for item in alerts:
        if isinstance(item, dict):
            reason_code = (
                _normalize_reason_code(item.get("reasonCode"))
                or _normalize_reason_code(item.get("trigger"))
                or "governance_alert"
            )
            normalized.append(
                {
                    "severity": item.get("severity") or "medium",
                    "ownerRole": item.get("ownerRole") or owner_role,
                    "message": item.get("message") or str(item),
                    "trigger": item.get("trigger"),
                    "command": item.get("command"),
                    "reasonCode": reason_code,
                }
            )
        else:
            normalized.append(
                {
                    "severity": "medium",
                    "ownerRole": owner_role,
                    "message": str(item),
                    "reasonCode": "governance_alert",
                }
            )
    return normalized


def _coerce_actions(actions: Any, owner_role: str) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(actions, list):
        return normalized
    for item in actions:
        if isinstance(item, dict):
            reason_code = (
                _normalize_reason_code(item.get("reasonCode"))
                or _normalize_reason_code(item.get("trigger"))
                or "governance_action"
            )
            normalized.append(
                {
                    "priority": item.get("priority") or "P3",
                    "severity": item.get("severity") or "info",
                    "ownerRole": item.get("ownerRole") or owner_role,
                    "action": item.get("action") or "",
                    "trigger": item.get("trigger") or "",
                    "command": item.get("command"),
                    "reasonCode": reason_code,
                }
            )
    return normalized


def _load_report(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, dict):
        raise ValueError("Weekly governance report artifact must be a JSON object")
    return payload


def _build_packet_payloads(report: Dict[str, Any], report_path: Path, requested_by: str):
    report_status = _normalize_packet_status(
        report.get("status")
        or (report.get("governanceExport") or {}).get("status")
    )

    report_governance_export = (
        report.get("governanceExport")
        if isinstance(report.get("governanceExport"), dict)
        else {}
    )
    report_handoff = report.get("handoff") if isinstance(report.get("handoff"), dict) else {}

    owner_role = (
        report_governance_export.get("ownerRole")
        or report_handoff.get("ownerRole")
        or "Release Manager"
    )
    rollout_blocked = bool(
        report_governance_export.get("rolloutBlocked")
        if isinstance(report_governance_export.get("rolloutBlocked"), bool)
        else _status_to_rollout_blocked(report_status)
    )
    if _status_to_rollout_blocked(report_status):
        rollout_blocked = True
    if rollout_blocked and report_status == "READY":
        report_status = "ACTION_REQUIRED"
    generated_at = (
        report.get("generatedAt")
        if _is_non_empty_string(report.get("generatedAt"))
        else datetime.now(timezone.utc).isoformat()
    )
    report_export_schema_version = (
        report.get("exportSchemaVersion")
        if isinstance(report.get("exportSchemaVersion"), int)
        else report_governance_export.get("exportSchemaVersion")
    )
    if not isinstance(report_export_schema_version, int):
        report_export_schema_version = GOVERNANCE_EXPORT_SCHEMA_VERSION
    window_days = int(report.get("windowDays") or 7)
    event_limit = int(report.get("eventLimit") or 1000)
    report_summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    report_runtime_prereqs_present = (
        "runtimePrereqs" in report
        or "runtimePrereqs" in report_summary
        or "runtimePrereqs" in report_governance_export
    )
    report_runtime_prereqs_payload = report.get("runtimePrereqs")
    if not isinstance(report_runtime_prereqs_payload, dict):
        report_runtime_prereqs_payload = report_summary.get("runtimePrereqs")
    if not isinstance(report_runtime_prereqs_payload, dict):
        report_runtime_prereqs_payload = report_governance_export.get("runtimePrereqs")
    runtime_prereqs_rollup = _normalize_runtime_prereqs_rollup(
        report_runtime_prereqs_payload,
        present=report_runtime_prereqs_present,
        fallback_command=DEFAULT_RUNTIME_PREREQS_COMMAND,
    )
    runtime_prereqs_missing_check_count = _coerce_non_negative_int(
        runtime_prereqs_rollup.get("missingCheckCount"),
        fallback=0,
    )
    report_command_aliases_present = (
        "commandAliases" in report
        or "commandAliases" in report_summary
        or "commandAliases" in report_governance_export
    )
    report_command_aliases_payload = report.get("commandAliases")
    if not isinstance(report_command_aliases_payload, dict):
        report_command_aliases_payload = report_summary.get("commandAliases")
    if not isinstance(report_command_aliases_payload, dict):
        report_command_aliases_payload = report_governance_export.get("commandAliases")
    command_aliases_rollup = _normalize_command_aliases_rollup(
        report_command_aliases_payload,
        present=report_command_aliases_present,
        fallback_command=DEFAULT_COMMAND_ALIASES_COMMAND,
    )
    command_aliases_missing_alias_count = _coerce_non_negative_int(
        command_aliases_rollup.get("missingAliasCount"),
        fallback=0,
    )
    command_aliases_mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_rollup.get("mismatchedAliasCount"),
        fallback=0,
    )
    connector_rate_limit = _normalize_connector_rate_limit_payload(
        report.get("connectorRateLimit")
        if isinstance(report.get("connectorRateLimit"), dict)
        else report_summary.get("connectorRateLimit")
    )
    connector_rate_limit_event_count = _coerce_non_negative_int(
        connector_rate_limit.get("eventCount"), fallback=0
    )
    report_sendgrid_webhook_timestamp = _normalize_sendgrid_webhook_timestamp_payload(
        report.get("sendgridWebhookTimestamp")
        if isinstance(report.get("sendgridWebhookTimestamp"), dict)
        else report_summary.get("sendgridWebhookTimestamp")
        if isinstance(report_summary.get("sendgridWebhookTimestamp"), dict)
        else report_governance_export.get("sendgridWebhookTimestamp")
    )
    sendgrid_webhook_timestamp_event_count = _coerce_non_negative_int(
        report_sendgrid_webhook_timestamp.get("eventCount"),
        fallback=0,
    )
    sendgrid_webhook_timestamp_anomaly_count_total = _coerce_non_negative_int(
        report_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal"),
        fallback=0,
    )

    alerts = _coerce_alerts(report_governance_export.get("alerts") or report.get("alerts"), owner_role)
    actions = _coerce_actions(
        report_governance_export.get("actions") or report.get("ownerActionMatrix"),
        owner_role,
    )
    reason_codes = _normalize_reason_codes(
        report.get("reasonCodes")
        if isinstance(report.get("reasonCodes"), list)
        else report_governance_export.get("reasonCodes")
    )
    for action in actions:
        reason_code = _normalize_reason_code(action.get("reasonCode"))
        if reason_code and reason_code not in reason_codes:
            reason_codes.append(reason_code)
    for alert in alerts:
        reason_code = _normalize_reason_code(alert.get("reasonCode"))
        if reason_code and reason_code not in reason_codes:
            reason_codes.append(reason_code)
    recommended_commands = _normalize_recommended_commands(
        report.get("recommendedCommands")
        if isinstance(report.get("recommendedCommands"), list)
        else report_governance_export.get("recommendedCommands")
    )
    for action in actions:
        command = action.get("command")
        if _is_non_empty_string(command):
            normalized_command = str(command).strip()
            if normalized_command not in recommended_commands:
                recommended_commands.append(normalized_command)
    for default_command in [
        "npm run verify:governance:weekly",
        "npm run verify:governance:packet:contract",
        "npm run verify:smoke:governance-packet",
    ]:
        if default_command not in recommended_commands:
            recommended_commands.append(default_command)
    reason_code_count = len(reason_codes)
    recommended_command_count = len(recommended_commands)

    handoff_export = {
        "governanceType": "weekly_report",
        "exportSchemaVersion": report_export_schema_version,
        "status": report_status,
        "rolloutBlocked": rollout_blocked,
        "ownerRole": owner_role,
        "connectorRateLimit": connector_rate_limit,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "alerts": alerts,
        "actions": actions,
        "reasonCodes": reason_codes,
        "reasonCodeCount": reason_code_count,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": recommended_command_count,
        "runtimePrereqs": runtime_prereqs_rollup,
        "commandAliases": command_aliases_rollup,
        "evaluatedAt": generated_at,
        "requestedBy": requested_by,
    }
    handoff_connector_pressure_parity = _build_connector_pressure_parity(
        connector_rate_limit,
        handoff_export["connectorRateLimit"],
        connector_rate_limit_event_count,
    )
    handoff_sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        report_sendgrid_webhook_timestamp,
        handoff_export["sendgridWebhookTimestamp"],
        sendgrid_webhook_timestamp_event_count,
        sendgrid_webhook_timestamp_anomaly_count_total,
    )
    handoff_payload = {
        "governanceType": "weekly_report",
        "exportSchemaVersion": report_export_schema_version,
        "generatedAt": generated_at,
        "windowDays": window_days,
        "eventLimit": event_limit,
        "status": report_status,
        "reasonCodes": reason_codes,
        "reasonCodeCount": reason_code_count,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": recommended_command_count,
        "totals": {
            "connectorRateLimitEventCount": connector_rate_limit_event_count,
            "sendgridWebhookTimestampEventCount": sendgrid_webhook_timestamp_event_count,
            "sendgridWebhookTimestampAnomalyCountTotal": sendgrid_webhook_timestamp_anomaly_count_total,
            "runtimePrereqsMissingCheckCount": runtime_prereqs_missing_check_count,
            "commandAliasesMissingAliasCount": command_aliases_missing_alias_count,
            "commandAliasesMismatchedAliasCount": command_aliases_mismatched_alias_count,
        },
        "runtimePrereqs": runtime_prereqs_rollup,
        "commandAliases": command_aliases_rollup,
        "connectorRateLimit": connector_rate_limit,
        "connectorPressureParity": handoff_connector_pressure_parity,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "sendgridWebhookTimestampParity": handoff_sendgrid_webhook_timestamp_parity,
        "sourceReport": {
            "path": str(report_path),
            "name": report_path.name,
            "generatedAt": generated_at,
            "status": report_status,
            "runtimePrereqsMissingCheckCount": runtime_prereqs_missing_check_count,
            "runtimePrereqsCommand": runtime_prereqs_rollup.get("command"),
            "commandAliasesMissingAliasCount": command_aliases_missing_alias_count,
            "commandAliasesMismatchedAliasCount": command_aliases_mismatched_alias_count,
            "commandAliasesCommand": command_aliases_rollup.get("command"),
        },
        "governanceExport": handoff_export,
        "requestedBy": requested_by,
    }

    report_name = report_path.name
    history_status = "ACTION_REQUIRED" if rollout_blocked else "READY"
    history_export = {
        "governanceType": "weekly_report_history",
        "exportSchemaVersion": report_export_schema_version,
        "status": history_status,
        "rolloutBlocked": rollout_blocked,
        "ownerRole": owner_role,
        "connectorRateLimit": connector_rate_limit,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "reasonCodes": reason_codes,
        "reasonCodeCount": reason_code_count,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": recommended_command_count,
        "runtimePrereqs": runtime_prereqs_rollup,
        "commandAliases": command_aliases_rollup,
    }
    history_connector_pressure_parity = _build_connector_pressure_parity(
        connector_rate_limit,
        history_export["connectorRateLimit"],
        connector_rate_limit_event_count,
    )
    history_sendgrid_webhook_timestamp_parity = _build_sendgrid_webhook_timestamp_parity(
        report_sendgrid_webhook_timestamp,
        history_export["sendgridWebhookTimestamp"],
        sendgrid_webhook_timestamp_event_count,
        sendgrid_webhook_timestamp_anomaly_count_total,
    )
    history_payload = {
        "governanceType": "weekly_report_history",
        "exportSchemaVersion": report_export_schema_version,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "retentionDays": 30,
        "limit": 50,
        "artifactDirectory": str(report_path.parent),
        "artifactPrefix": "connector_governance_weekly_report",
        "artifactCount": 1,
        "staleCount": 0,
        "rolloutBlockedCount": 1 if rollout_blocked else 0,
        "reasonCodes": reason_codes,
        "reasonCodeCount": reason_code_count,
        "recommendedCommands": recommended_commands,
        "recommendedCommandCount": recommended_command_count,
        "totals": {
            "connectorRateLimitEventCount": connector_rate_limit_event_count,
            "sendgridWebhookTimestampEventCount": sendgrid_webhook_timestamp_event_count,
            "sendgridWebhookTimestampAnomalyCountTotal": sendgrid_webhook_timestamp_anomaly_count_total,
            "runtimePrereqsMissingCheckCount": runtime_prereqs_missing_check_count,
            "commandAliasesMissingAliasCount": command_aliases_missing_alias_count,
            "commandAliasesMismatchedAliasCount": command_aliases_mismatched_alias_count,
        },
        "runtimePrereqs": runtime_prereqs_rollup,
        "commandAliases": command_aliases_rollup,
        "connectorRateLimit": connector_rate_limit,
        "connectorPressureParity": history_connector_pressure_parity,
        "sendgridWebhookTimestamp": report_sendgrid_webhook_timestamp,
        "sendgridWebhookTimestampParity": history_sendgrid_webhook_timestamp_parity,
        "latestArtifact": {
            "name": report_name,
            "exportSchemaVersion": report_export_schema_version,
            "generatedAt": generated_at,
            "status": history_status,
            "rolloutBlocked": rollout_blocked,
        },
        "items": [
            {
                "name": report_name,
                "exportSchemaVersion": report_export_schema_version,
                "generatedAt": generated_at,
                "withinRetention": True,
                "status": history_status,
                "rolloutBlocked": rollout_blocked,
            }
        ],
        "status": history_status,
        "alerts": [] if history_status == "READY" else ["Governance report indicates rollout blockers."],
        "governanceExport": history_export,
        "sourceReport": {
            "path": str(report_path),
            "name": report_path.name,
            "generatedAt": generated_at,
            "status": report_status,
            "exportSchemaVersion": report_export_schema_version,
            "runtimePrereqsMissingCheckCount": runtime_prereqs_missing_check_count,
            "runtimePrereqsCommand": runtime_prereqs_rollup.get("command"),
            "commandAliasesMissingAliasCount": command_aliases_missing_alias_count,
            "commandAliasesMismatchedAliasCount": command_aliases_mismatched_alias_count,
            "commandAliasesCommand": command_aliases_rollup.get("command"),
        },
        "requestedBy": requested_by,
    }

    return handoff_payload, history_payload


def _write_json(path: Path, payload: Dict[str, Any]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def main():
    args = parse_args()
    report_path = Path(args.report)
    handoff_path = Path(args.handoff)
    history_path = Path(args.history)

    try:
        report_payload = _load_report(report_path)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Failed to load governance report artifact: {exc}")
        return 1

    handoff_payload, history_payload = _build_packet_payloads(
        report_payload, report_path, args.requested_by
    )

    _write_json(handoff_path, handoff_payload)
    _write_json(history_path, history_payload)

    summary = {
        "report": str(report_path),
        "handoff": str(handoff_path),
        "history": str(history_path),
        "status": handoff_payload.get("status"),
        "rolloutBlocked": (handoff_payload.get("governanceExport") or {}).get("rolloutBlocked"),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
