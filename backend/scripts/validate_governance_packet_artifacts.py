#!/usr/bin/env python3
"""
Validate governance handoff/history packet artifacts before release signoff.

Usage:
  python backend/scripts/validate_governance_packet_artifacts.py \
    --handoff backend/test_reports/governance_handoff_export.json \
    --history backend/test_reports/governance_history_export.json \
    --output backend/test_reports/governance_packet_validation.json
"""

import argparse
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

ALLOWED_GOVERNANCE_STATUSES = {"READY", "ACTION_REQUIRED"}
ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS = {1}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate governance handoff/history packet artifacts"
    )
    parser.add_argument("--handoff", required=True, help="Path to governance handoff JSON")
    parser.add_argument("--history", required=True, help="Path to governance history JSON")
    parser.add_argument(
        "--output",
        default="backend/test_reports/governance_packet_validation.json",
        help="Path to output validation JSON",
    )
    return parser.parse_args()


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _coerce_non_negative_int(value: Any) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _normalize_status(value: Any) -> str:
    if not _is_non_empty_string(value):
        return ""
    candidate = str(value).strip().upper()
    normalized = "".join(ch if ch.isalnum() else "_" for ch in candidate).strip("_")
    if not normalized:
        return ""
    return normalized


def _normalize_reason_code(value: Any) -> str:
    if not _is_non_empty_string(value):
        return ""
    normalized = "".join(
        ch if ch.isalnum() else "_" for ch in str(value).strip().lower()
    ).strip("_")
    return normalized


def _normalize_reason_codes(value: Any) -> Optional[List[str]]:
    if not isinstance(value, list):
        return None
    normalized: List[str] = []
    for item in value:
        reason_code = _normalize_reason_code(item)
        if reason_code and reason_code not in normalized:
            normalized.append(reason_code)
    return normalized


def _normalize_recommended_commands(value: Any) -> Optional[List[str]]:
    if not isinstance(value, list):
        return None
    normalized: List[str] = []
    for item in value:
        if not _is_non_empty_string(item):
            continue
        command = str(item).strip()
        if command not in normalized:
            normalized.append(command)
    return normalized


def _status_rollout_consistent(status: str, rollout_blocked: bool) -> bool:
    if status == "READY":
        return rollout_blocked is False
    if status == "ACTION_REQUIRED":
        return rollout_blocked is True
    return True


def _is_supported_export_schema_version(value: Any) -> bool:
    return isinstance(value, int) and value in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS


def _normalize_connector_rate_limit_by_endpoint(value: Any) -> Dict[str, int]:
    if not isinstance(value, dict):
        return {}
    normalized: Dict[str, int] = {}
    for endpoint, count in value.items():
        endpoint_key = "".join(
            ch if ch.isalnum() else "_" for ch in str(endpoint or "").strip().lower()
        ).strip("_")
        if not endpoint_key:
            endpoint_key = "unknown"
        normalized_count = _coerce_non_negative_int(count)
        if normalized_count is None:
            continue
        normalized[endpoint_key] = int(normalized.get(endpoint_key, 0)) + normalized_count
    return normalized


def _normalize_connector_pressure_label(value: Any) -> Optional[str]:
    if not _is_non_empty_string(value):
        return None
    return str(value).strip().lower()


def _build_connector_pressure_parity(
    top_level_connector: Optional[Dict[str, Any]],
    nested_connector: Optional[Dict[str, Any]],
    totals_event_count: Optional[int],
) -> Dict[str, Any]:
    top_level_connector = top_level_connector or {}
    nested_connector = nested_connector or {}

    top_level_event_count = _coerce_non_negative_int(top_level_connector.get("eventCount"))
    nested_event_count = _coerce_non_negative_int(nested_connector.get("eventCount"))
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
        "byEndpointMatchesNested": normalized_top_level == normalized_nested,
        "pressureLabelMatchesNested": (
            top_level_label == nested_label
            if top_level_label and nested_label
            else None
        ),
        "normalizedTopLevelByEndpoint": normalized_top_level,
        "normalizedNestedByEndpoint": normalized_nested,
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
        normalized_count = _coerce_non_negative_int(count)
        if normalized_count is None:
            continue
        normalized[token] = int(normalized.get(token, 0)) + normalized_count
    return normalized


def _normalize_sendgrid_latest_event_at(value: Any) -> Optional[str]:
    if not _is_non_empty_string(value):
        return None
    return str(value).strip()


def _normalize_sendgrid_webhook_timestamp_payload(payload: Any) -> Dict[str, Any]:
    sendgrid_payload = payload if isinstance(payload, dict) else {}
    event_count = _coerce_non_negative_int(sendgrid_payload.get("eventCount"))
    if event_count is None:
        event_count = 0
    anomaly_count_total = _coerce_non_negative_int(
        sendgrid_payload.get("timestampAnomalyCountTotal")
    )
    if anomaly_count_total is None:
        anomaly_count_total = 0
    pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        sendgrid_payload.get("pressureLabelCounts")
    )
    pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        sendgrid_payload.get("pressureHintCounts")
    )
    age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        sendgrid_payload.get("timestampAgeBucketCounts")
    )
    anomaly_event_type_counts = _normalize_sendgrid_timestamp_count_map(
        sendgrid_payload.get("timestampAnomalyEventTypeCounts")
    )
    latest_event_at = _normalize_sendgrid_latest_event_at(
        sendgrid_payload.get("latestEventAt")
    )
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
) -> Optional[bool]:
    if top_level_map or nested_map:
        return top_level_map == nested_map
    return None


def _build_sendgrid_webhook_timestamp_parity(
    top_level_sendgrid: Optional[Dict[str, Any]],
    nested_sendgrid: Optional[Dict[str, Any]],
    totals_event_count: Optional[int],
    totals_anomaly_count_total: Optional[int],
) -> Dict[str, Any]:
    top_level_payload = _normalize_sendgrid_webhook_timestamp_payload(top_level_sendgrid)
    nested_payload = _normalize_sendgrid_webhook_timestamp_payload(nested_sendgrid)

    top_level_event_count = _coerce_non_negative_int(top_level_payload.get("eventCount"))
    nested_event_count = _coerce_non_negative_int(nested_payload.get("eventCount"))
    top_level_anomaly_count_total = _coerce_non_negative_int(
        top_level_payload.get("timestampAnomalyCountTotal")
    )
    nested_anomaly_count_total = _coerce_non_negative_int(
        nested_payload.get("timestampAnomalyCountTotal")
    )
    normalized_top_level_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("pressureLabelCounts")
    )
    normalized_nested_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("pressureLabelCounts")
    )
    normalized_top_level_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("pressureHintCounts")
    )
    normalized_nested_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("pressureHintCounts")
    )
    normalized_top_level_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        top_level_payload.get("timestampAgeBucketCounts")
    )
    normalized_nested_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        nested_payload.get("timestampAgeBucketCounts")
    )
    normalized_top_level_anomaly_event_type_counts = (
        _normalize_sendgrid_timestamp_count_map(
            top_level_payload.get("timestampAnomalyEventTypeCounts")
        )
    )
    normalized_nested_anomaly_event_type_counts = (
        _normalize_sendgrid_timestamp_count_map(
            nested_payload.get("timestampAnomalyEventTypeCounts")
        )
    )
    normalized_latest_event_at_top_level = _normalize_sendgrid_latest_event_at(
        top_level_payload.get("latestEventAt")
    )
    normalized_latest_event_at_nested = _normalize_sendgrid_latest_event_at(
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
        "pressureLabelCountsMatchNested": _maps_equal_or_none(
            normalized_top_level_pressure_label_counts,
            normalized_nested_pressure_label_counts,
        ),
        "pressureHintCountsMatchNested": _maps_equal_or_none(
            normalized_top_level_pressure_hint_counts,
            normalized_nested_pressure_hint_counts,
        ),
        "ageBucketCountsMatchNested": _maps_equal_or_none(
            normalized_top_level_age_bucket_counts,
            normalized_nested_age_bucket_counts,
        ),
        "anomalyEventTypeCountsMatchNested": _maps_equal_or_none(
            normalized_top_level_anomaly_event_type_counts,
            normalized_nested_anomaly_event_type_counts,
        ),
        "latestEventAtMatchesNested": (
            normalized_latest_event_at_top_level == normalized_latest_event_at_nested
            if normalized_latest_event_at_top_level and normalized_latest_event_at_nested
            else None
        ),
        "normalizedTopLevelPressureLabelCounts": normalized_top_level_pressure_label_counts,
        "normalizedNestedPressureLabelCounts": normalized_nested_pressure_label_counts,
        "normalizedTopLevelPressureHintCounts": normalized_top_level_pressure_hint_counts,
        "normalizedNestedPressureHintCounts": normalized_nested_pressure_hint_counts,
        "normalizedTopLevelAgeBucketCounts": normalized_top_level_age_bucket_counts,
        "normalizedNestedAgeBucketCounts": normalized_nested_age_bucket_counts,
        "normalizedTopLevelAnomalyEventTypeCounts": normalized_top_level_anomaly_event_type_counts,
        "normalizedNestedAnomalyEventTypeCounts": normalized_nested_anomaly_event_type_counts,
        "normalizedLatestEventAtTopLevel": normalized_latest_event_at_top_level,
        "normalizedLatestEventAtNested": normalized_latest_event_at_nested,
    }


def _coerce_nullable_non_negative_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    return _coerce_non_negative_int(value)


def _is_optional_boolean(value: Any) -> bool:
    return value is None or isinstance(value, bool)


def _normalize_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    normalized: List[str] = []
    for item in value:
        if not _is_non_empty_string(item):
            continue
        token = str(item).strip()
        if token and token not in normalized:
            normalized.append(token)
    return normalized


def _validate_runtime_prereqs_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    checks_prefix: str,
    errors: List[str],
) -> Optional[Dict[str, Any]]:
    present_key = f"{checks_prefix}Present"
    shape_key = f"{checks_prefix}ShapeValid"
    missing_check_parity_key = f"{checks_prefix}MissingCheckParity"

    checks_bucket[present_key] = isinstance(payload, dict)
    if not checks_bucket[present_key]:
        checks_bucket[shape_key] = False
        checks_bucket[missing_check_parity_key] = False
        return None

    runtime_payload = payload
    missing_checks_payload = (
        runtime_payload.get("missingChecks")
        if isinstance(runtime_payload.get("missingChecks"), dict)
        else {}
    )
    missing_commands = _normalize_string_list(missing_checks_payload.get("commands"))
    missing_workspace = _normalize_string_list(missing_checks_payload.get("workspace"))
    missing_check_count = _coerce_non_negative_int(runtime_payload.get("missingCheckCount"))

    shape_valid = (
        isinstance(runtime_payload.get("present"), bool)
        and isinstance(runtime_payload.get("available"), bool)
        and _is_optional_boolean(runtime_payload.get("passed"))
        and _is_optional_boolean(runtime_payload.get("contractValid"))
        and _is_optional_boolean(runtime_payload.get("valid"))
        and missing_check_count is not None
        and isinstance(runtime_payload.get("missingChecks"), dict)
        and isinstance((runtime_payload.get("missingChecks") or {}).get("commands", []), list)
        and isinstance((runtime_payload.get("missingChecks") or {}).get("workspace", []), list)
    )
    checks_bucket[shape_key] = shape_valid
    if not shape_valid:
        checks_bucket[missing_check_parity_key] = False
        errors.append(
            f"{label} runtimePrereqs must include present/available booleans, nullable gate booleans, missingCheckCount, and missingChecks command/workspace lists"
        )
        return None

    expected_missing_check_count = len(missing_commands) + len(missing_workspace)
    missing_check_parity = missing_check_count == expected_missing_check_count
    checks_bucket[missing_check_parity_key] = missing_check_parity
    if not missing_check_parity:
        errors.append(
            f"{label} runtimePrereqs missingCheckCount does not match missingChecks command/workspace totals"
        )

    command = runtime_payload.get("command")
    if not _is_non_empty_string(command):
        command = None
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
        "present": bool(runtime_payload.get("present")),
        "available": bool(runtime_payload.get("available")),
        "passed": runtime_payload.get("passed")
        if isinstance(runtime_payload.get("passed"), bool)
        else None,
        "contractValid": runtime_payload.get("contractValid")
        if isinstance(runtime_payload.get("contractValid"), bool)
        else None,
        "valid": runtime_payload.get("valid")
        if isinstance(runtime_payload.get("valid"), bool)
        else None,
        "missingCheckCount": int(missing_check_count),
        "missingChecks": {
            "commands": missing_commands,
            "workspace": missing_workspace,
        },
        "artifactPath": artifact_path,
        "generatedAt": generated_at,
        "validatedAt": validated_at,
        "command": command,
    }


def _validate_command_aliases_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    checks_prefix: str,
    errors: List[str],
) -> Optional[Dict[str, Any]]:
    present_key = f"{checks_prefix}Present"
    shape_key = f"{checks_prefix}ShapeValid"
    count_parity_key = f"{checks_prefix}CountParity"

    checks_bucket[present_key] = isinstance(payload, dict)
    if not checks_bucket[present_key]:
        checks_bucket[shape_key] = False
        checks_bucket[count_parity_key] = False
        return None

    command_aliases_payload = payload
    missing_aliases = _normalize_string_list(command_aliases_payload.get("missingAliases"))
    mismatched_aliases = _normalize_string_list(
        command_aliases_payload.get("mismatchedAliases")
    )
    missing_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("missingAliasCount")
    )
    mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("mismatchedAliasCount")
    )

    shape_valid = (
        isinstance(command_aliases_payload.get("present"), bool)
        and isinstance(command_aliases_payload.get("available"), bool)
        and _is_optional_boolean(command_aliases_payload.get("gatePassed"))
        and _is_optional_boolean(command_aliases_payload.get("contractValid"))
        and _is_optional_boolean(command_aliases_payload.get("valid"))
        and isinstance(command_aliases_payload.get("source"), str)
        and missing_alias_count is not None
        and mismatched_alias_count is not None
        and isinstance(command_aliases_payload.get("missingAliases"), list)
        and isinstance(command_aliases_payload.get("mismatchedAliases"), list)
    )
    checks_bucket[shape_key] = shape_valid
    if not shape_valid:
        checks_bucket[count_parity_key] = False
        errors.append(
            f"{label} commandAliases must include present/available booleans, nullable gate booleans, source string, missing/mismatched alias counts, and alias lists"
        )
        return None

    count_parity = (
        missing_alias_count == len(missing_aliases)
        and mismatched_alias_count == len(mismatched_aliases)
    )
    checks_bucket[count_parity_key] = count_parity
    if not count_parity:
        errors.append(
            f"{label} commandAliases missing/mismatched alias counts do not match alias list lengths"
        )

    command = command_aliases_payload.get("command")
    if not _is_non_empty_string(command):
        command = None
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

    source = str(command_aliases_payload.get("source") or "").strip()
    if not source:
        source = "unknown"

    return {
        "present": bool(command_aliases_payload.get("present")),
        "available": bool(command_aliases_payload.get("available")),
        "source": source,
        "gatePassed": command_aliases_payload.get("gatePassed")
        if isinstance(command_aliases_payload.get("gatePassed"), bool)
        else None,
        "contractValid": command_aliases_payload.get("contractValid")
        if isinstance(command_aliases_payload.get("contractValid"), bool)
        else None,
        "valid": command_aliases_payload.get("valid")
        if isinstance(command_aliases_payload.get("valid"), bool)
        else None,
        "missingAliasCount": int(missing_alias_count),
        "mismatchedAliasCount": int(mismatched_alias_count),
        "missingAliases": missing_aliases,
        "mismatchedAliases": mismatched_aliases,
        "artifactPath": artifact_path,
        "generatedAt": generated_at,
        "validatedAt": validated_at,
        "command": command,
    }


def _validate_connector_pressure_parity_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    errors: List[str],
    top_level_connector: Optional[Dict[str, Any]],
    nested_connector: Optional[Dict[str, Any]],
    totals_event_count: Optional[int],
) -> None:
    checks_bucket["connectorPressureParityPresent"] = isinstance(payload, dict)
    if not checks_bucket["connectorPressureParityPresent"]:
        checks_bucket["connectorPressureParityShapeValid"] = False
        checks_bucket["connectorPressureParityConsistency"] = False
        errors.append(f"{label} is missing connectorPressureParity payload")
        return

    required_fields = [
        "topLevelEventCount",
        "nestedEventCount",
        "totalsEventCount",
        "eventCountMatchesNested",
        "eventCountMatchesTotals",
        "byEndpointMatchesNested",
        "pressureLabelMatchesNested",
        "normalizedTopLevelByEndpoint",
        "normalizedNestedByEndpoint",
        "computedAt",
    ]
    missing_fields = [field for field in required_fields if field not in payload]
    shape_valid = not missing_fields
    if missing_fields:
        errors.append(
            f"{label} connectorPressureParity is missing required fields: {', '.join(missing_fields)}"
        )

    if shape_valid:
        shape_valid = (
            _coerce_nullable_non_negative_int(payload.get("topLevelEventCount")) is not None
            or payload.get("topLevelEventCount") is None
        )
        shape_valid = shape_valid and (
            _coerce_nullable_non_negative_int(payload.get("nestedEventCount")) is not None
            or payload.get("nestedEventCount") is None
        )
        shape_valid = shape_valid and (
            _coerce_nullable_non_negative_int(payload.get("totalsEventCount")) is not None
            or payload.get("totalsEventCount") is None
        )
        shape_valid = shape_valid and _is_optional_boolean(
            payload.get("eventCountMatchesNested")
        )
        shape_valid = shape_valid and _is_optional_boolean(
            payload.get("eventCountMatchesTotals")
        )
        shape_valid = shape_valid and _is_optional_boolean(
            payload.get("byEndpointMatchesNested")
        )
        shape_valid = shape_valid and _is_optional_boolean(
            payload.get("pressureLabelMatchesNested")
        )
        shape_valid = shape_valid and isinstance(
            payload.get("normalizedTopLevelByEndpoint"), dict
        )
        shape_valid = shape_valid and isinstance(
            payload.get("normalizedNestedByEndpoint"), dict
        )
        shape_valid = shape_valid and _is_non_empty_string(payload.get("computedAt"))
        if not shape_valid:
            errors.append(
                f"{label} connectorPressureParity fields must use nullable parity booleans, nullable non-negative counts, endpoint objects, and computedAt"
            )

    checks_bucket["connectorPressureParityShapeValid"] = shape_valid
    if not shape_valid:
        checks_bucket["connectorPressureParityConsistency"] = False
        return

    expected = _build_connector_pressure_parity(
        top_level_connector,
        nested_connector,
        totals_event_count,
    )
    normalized_top_level = _normalize_connector_rate_limit_by_endpoint(
        payload.get("normalizedTopLevelByEndpoint")
    )
    normalized_nested = _normalize_connector_rate_limit_by_endpoint(
        payload.get("normalizedNestedByEndpoint")
    )
    consistency = (
        _coerce_nullable_non_negative_int(payload.get("topLevelEventCount"))
        == expected.get("topLevelEventCount")
        and _coerce_nullable_non_negative_int(payload.get("nestedEventCount"))
        == expected.get("nestedEventCount")
        and _coerce_nullable_non_negative_int(payload.get("totalsEventCount"))
        == expected.get("totalsEventCount")
        and payload.get("eventCountMatchesNested")
        == expected.get("eventCountMatchesNested")
        and payload.get("eventCountMatchesTotals")
        == expected.get("eventCountMatchesTotals")
        and payload.get("byEndpointMatchesNested")
        == expected.get("byEndpointMatchesNested")
        and payload.get("pressureLabelMatchesNested")
        == expected.get("pressureLabelMatchesNested")
        and normalized_top_level == expected.get("normalizedTopLevelByEndpoint")
        and normalized_nested == expected.get("normalizedNestedByEndpoint")
    )
    checks_bucket["connectorPressureParityConsistency"] = consistency
    if not consistency:
        errors.append(
            f"{label} connectorPressureParity fields are inconsistent with connectorRateLimit parity expectations"
        )


def _validate_sendgrid_webhook_timestamp_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    checks_prefix: str,
    errors: List[str],
) -> Optional[Dict[str, Any]]:
    present_key = f"{checks_prefix}Present"
    shape_key = f"{checks_prefix}ShapeValid"

    checks_bucket[present_key] = isinstance(payload, dict)
    if not checks_bucket[present_key]:
        checks_bucket[shape_key] = False
        errors.append(f"{label} is missing sendgridWebhookTimestamp payload")
        return None

    sendgrid_payload = payload
    event_count = _coerce_non_negative_int(sendgrid_payload.get("eventCount"))
    anomaly_count_total = _coerce_non_negative_int(
        sendgrid_payload.get("timestampAnomalyCountTotal")
    )
    pressure_label_counts = sendgrid_payload.get("pressureLabelCounts")
    pressure_hint_counts = sendgrid_payload.get("pressureHintCounts")
    age_bucket_counts = sendgrid_payload.get("timestampAgeBucketCounts")
    anomaly_event_type_counts = sendgrid_payload.get("timestampAnomalyEventTypeCounts")
    latest_event_at = sendgrid_payload.get("latestEventAt")

    count_map_values_valid = all(
        isinstance(count_map, dict)
        and all(_coerce_non_negative_int(count) is not None for count in count_map.values())
        for count_map in [
            pressure_label_counts,
            pressure_hint_counts,
            age_bucket_counts,
            anomaly_event_type_counts,
        ]
    )
    latest_event_at_valid = latest_event_at is None or _is_non_empty_string(latest_event_at)
    shape_valid = (
        event_count is not None
        and anomaly_count_total is not None
        and count_map_values_valid
        and latest_event_at_valid
    )
    checks_bucket[shape_key] = shape_valid
    if not shape_valid:
        errors.append(
            f"{label} sendgridWebhookTimestamp must include non-negative event/anomaly totals, count-map objects with non-negative counts, and optional latestEventAt string"
        )
        return None

    normalized = _normalize_sendgrid_webhook_timestamp_payload(sendgrid_payload)
    return {
        "eventCount": int(event_count),
        "timestampAnomalyCountTotal": int(anomaly_count_total),
        "pressureLabelCounts": normalized.get("pressureLabelCounts", {}),
        "pressureHintCounts": normalized.get("pressureHintCounts", {}),
        "timestampAgeBucketCounts": normalized.get("timestampAgeBucketCounts", {}),
        "timestampAnomalyEventTypeCounts": normalized.get(
            "timestampAnomalyEventTypeCounts",
            {},
        ),
        "latestEventAt": normalized.get("latestEventAt"),
    }


def _validate_sendgrid_webhook_timestamp_parity_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    errors: List[str],
    top_level_sendgrid: Optional[Dict[str, Any]],
    nested_sendgrid: Optional[Dict[str, Any]],
    totals_event_count: Optional[int],
    totals_anomaly_count_total: Optional[int],
) -> None:
    checks_bucket["sendgridWebhookTimestampParityPresent"] = isinstance(payload, dict)
    if not checks_bucket["sendgridWebhookTimestampParityPresent"]:
        checks_bucket["sendgridWebhookTimestampParityShapeValid"] = False
        checks_bucket["sendgridWebhookTimestampParityConsistency"] = False
        errors.append(f"{label} is missing sendgridWebhookTimestampParity payload")
        return

    required_fields = [
        "topLevelEventCount",
        "nestedEventCount",
        "totalsEventCount",
        "topLevelAnomalyCountTotal",
        "nestedAnomalyCountTotal",
        "totalsAnomalyCountTotal",
        "eventCountMatchesNested",
        "eventCountMatchesTotals",
        "anomalyCountTotalMatchesNested",
        "anomalyCountTotalMatchesTotals",
        "pressureLabelCountsMatchNested",
        "pressureHintCountsMatchNested",
        "ageBucketCountsMatchNested",
        "anomalyEventTypeCountsMatchNested",
        "latestEventAtMatchesNested",
        "normalizedTopLevelPressureLabelCounts",
        "normalizedNestedPressureLabelCounts",
        "normalizedTopLevelPressureHintCounts",
        "normalizedNestedPressureHintCounts",
        "normalizedTopLevelAgeBucketCounts",
        "normalizedNestedAgeBucketCounts",
        "normalizedTopLevelAnomalyEventTypeCounts",
        "normalizedNestedAnomalyEventTypeCounts",
        "normalizedLatestEventAtTopLevel",
        "normalizedLatestEventAtNested",
        "computedAt",
    ]
    missing_fields = [field for field in required_fields if field not in payload]
    shape_valid = not missing_fields
    if missing_fields:
        errors.append(
            f"{label} sendgridWebhookTimestampParity is missing required fields: {', '.join(missing_fields)}"
        )

    if shape_valid:
        shape_valid = (
            (_coerce_nullable_non_negative_int(payload.get("topLevelEventCount")) is not None)
            or payload.get("topLevelEventCount") is None
        )
        shape_valid = shape_valid and (
            (_coerce_nullable_non_negative_int(payload.get("nestedEventCount")) is not None)
            or payload.get("nestedEventCount") is None
        )
        shape_valid = shape_valid and (
            (_coerce_nullable_non_negative_int(payload.get("totalsEventCount")) is not None)
            or payload.get("totalsEventCount") is None
        )
        shape_valid = shape_valid and (
            (
                _coerce_nullable_non_negative_int(
                    payload.get("topLevelAnomalyCountTotal")
                )
                is not None
            )
            or payload.get("topLevelAnomalyCountTotal") is None
        )
        shape_valid = shape_valid and (
            (
                _coerce_nullable_non_negative_int(payload.get("nestedAnomalyCountTotal"))
                is not None
            )
            or payload.get("nestedAnomalyCountTotal") is None
        )
        shape_valid = shape_valid and (
            (
                _coerce_nullable_non_negative_int(payload.get("totalsAnomalyCountTotal"))
                is not None
            )
            or payload.get("totalsAnomalyCountTotal") is None
        )
        for field in [
            "eventCountMatchesNested",
            "eventCountMatchesTotals",
            "anomalyCountTotalMatchesNested",
            "anomalyCountTotalMatchesTotals",
            "pressureLabelCountsMatchNested",
            "pressureHintCountsMatchNested",
            "ageBucketCountsMatchNested",
            "anomalyEventTypeCountsMatchNested",
            "latestEventAtMatchesNested",
        ]:
            shape_valid = shape_valid and _is_optional_boolean(payload.get(field))
        for field in [
            "normalizedTopLevelPressureLabelCounts",
            "normalizedNestedPressureLabelCounts",
            "normalizedTopLevelPressureHintCounts",
            "normalizedNestedPressureHintCounts",
            "normalizedTopLevelAgeBucketCounts",
            "normalizedNestedAgeBucketCounts",
            "normalizedTopLevelAnomalyEventTypeCounts",
            "normalizedNestedAnomalyEventTypeCounts",
        ]:
            shape_valid = shape_valid and isinstance(payload.get(field), dict)
        latest_top_level = payload.get("normalizedLatestEventAtTopLevel")
        latest_nested = payload.get("normalizedLatestEventAtNested")
        shape_valid = shape_valid and (
            latest_top_level is None or _is_non_empty_string(latest_top_level)
        )
        shape_valid = shape_valid and (
            latest_nested is None or _is_non_empty_string(latest_nested)
        )
        shape_valid = shape_valid and _is_non_empty_string(payload.get("computedAt"))
        if not shape_valid:
            errors.append(
                f"{label} sendgridWebhookTimestampParity fields must use nullable parity booleans, nullable non-negative counts, normalized count-map objects, and computedAt"
            )

    checks_bucket["sendgridWebhookTimestampParityShapeValid"] = shape_valid
    if not shape_valid:
        checks_bucket["sendgridWebhookTimestampParityConsistency"] = False
        return

    expected = _build_sendgrid_webhook_timestamp_parity(
        top_level_sendgrid,
        nested_sendgrid,
        totals_event_count,
        totals_anomaly_count_total,
    )
    normalized_top_level_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedTopLevelPressureLabelCounts")
    )
    normalized_nested_pressure_label_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedNestedPressureLabelCounts")
    )
    normalized_top_level_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedTopLevelPressureHintCounts")
    )
    normalized_nested_pressure_hint_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedNestedPressureHintCounts")
    )
    normalized_top_level_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedTopLevelAgeBucketCounts")
    )
    normalized_nested_age_bucket_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedNestedAgeBucketCounts")
    )
    normalized_top_level_anomaly_event_type_counts = (
        _normalize_sendgrid_timestamp_count_map(
            payload.get("normalizedTopLevelAnomalyEventTypeCounts")
        )
    )
    normalized_nested_anomaly_event_type_counts = _normalize_sendgrid_timestamp_count_map(
        payload.get("normalizedNestedAnomalyEventTypeCounts")
    )
    consistency = (
        _coerce_nullable_non_negative_int(payload.get("topLevelEventCount"))
        == expected.get("topLevelEventCount")
        and _coerce_nullable_non_negative_int(payload.get("nestedEventCount"))
        == expected.get("nestedEventCount")
        and _coerce_nullable_non_negative_int(payload.get("totalsEventCount"))
        == expected.get("totalsEventCount")
        and _coerce_nullable_non_negative_int(payload.get("topLevelAnomalyCountTotal"))
        == expected.get("topLevelAnomalyCountTotal")
        and _coerce_nullable_non_negative_int(payload.get("nestedAnomalyCountTotal"))
        == expected.get("nestedAnomalyCountTotal")
        and _coerce_nullable_non_negative_int(payload.get("totalsAnomalyCountTotal"))
        == expected.get("totalsAnomalyCountTotal")
        and payload.get("eventCountMatchesNested")
        == expected.get("eventCountMatchesNested")
        and payload.get("eventCountMatchesTotals")
        == expected.get("eventCountMatchesTotals")
        and payload.get("anomalyCountTotalMatchesNested")
        == expected.get("anomalyCountTotalMatchesNested")
        and payload.get("anomalyCountTotalMatchesTotals")
        == expected.get("anomalyCountTotalMatchesTotals")
        and payload.get("pressureLabelCountsMatchNested")
        == expected.get("pressureLabelCountsMatchNested")
        and payload.get("pressureHintCountsMatchNested")
        == expected.get("pressureHintCountsMatchNested")
        and payload.get("ageBucketCountsMatchNested")
        == expected.get("ageBucketCountsMatchNested")
        and payload.get("anomalyEventTypeCountsMatchNested")
        == expected.get("anomalyEventTypeCountsMatchNested")
        and payload.get("latestEventAtMatchesNested")
        == expected.get("latestEventAtMatchesNested")
        and normalized_top_level_pressure_label_counts
        == expected.get("normalizedTopLevelPressureLabelCounts")
        and normalized_nested_pressure_label_counts
        == expected.get("normalizedNestedPressureLabelCounts")
        and normalized_top_level_pressure_hint_counts
        == expected.get("normalizedTopLevelPressureHintCounts")
        and normalized_nested_pressure_hint_counts
        == expected.get("normalizedNestedPressureHintCounts")
        and normalized_top_level_age_bucket_counts
        == expected.get("normalizedTopLevelAgeBucketCounts")
        and normalized_nested_age_bucket_counts
        == expected.get("normalizedNestedAgeBucketCounts")
        and normalized_top_level_anomaly_event_type_counts
        == expected.get("normalizedTopLevelAnomalyEventTypeCounts")
        and normalized_nested_anomaly_event_type_counts
        == expected.get("normalizedNestedAnomalyEventTypeCounts")
        and _normalize_sendgrid_latest_event_at(payload.get("normalizedLatestEventAtTopLevel"))
        == expected.get("normalizedLatestEventAtTopLevel")
        and _normalize_sendgrid_latest_event_at(payload.get("normalizedLatestEventAtNested"))
        == expected.get("normalizedLatestEventAtNested")
    )
    checks_bucket["sendgridWebhookTimestampParityConsistency"] = consistency
    if not consistency:
        errors.append(
            f"{label} sendgridWebhookTimestampParity fields are inconsistent with sendgridWebhookTimestamp parity expectations"
        )


def _validate_connector_rate_limit_payload(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    checks_prefix: str,
    errors: List[str],
) -> Optional[Dict[str, Any]]:
    present_key = f"{checks_prefix}Present"
    shape_key = f"{checks_prefix}ShapeValid"
    pressure_key = f"{checks_prefix}PressureLabelPresent"

    checks_bucket[present_key] = isinstance(payload, dict)
    if not checks_bucket[present_key]:
        checks_bucket[shape_key] = False
        checks_bucket[pressure_key] = False
        errors.append(f"{label} is missing connectorRateLimit payload")
        return None

    connector_rate_limit = payload
    event_count = connector_rate_limit.get("eventCount")
    by_endpoint = connector_rate_limit.get("byEndpoint")
    by_endpoint_values_valid = isinstance(by_endpoint, dict) and all(
        _coerce_non_negative_int(count) is not None
        for count in by_endpoint.values()
    )
    pressure_payload = connector_rate_limit.get("pressure")
    pressure_label = (
        pressure_payload.get("label") if isinstance(pressure_payload, dict) else None
    )

    checks_bucket[shape_key] = (
        isinstance(event_count, int)
        and event_count >= 0
        and by_endpoint_values_valid
    )
    if not checks_bucket[shape_key]:
        errors.append(
            f"{label} connectorRateLimit must include non-negative eventCount and byEndpoint object"
        )

    checks_bucket[pressure_key] = _is_non_empty_string(pressure_label)
    if not checks_bucket[pressure_key]:
        errors.append(f"{label} connectorRateLimit.pressure.label is missing")

    return connector_rate_limit


def _validate_reason_and_command_parity(
    payload: Any,
    label: str,
    checks_bucket: Dict[str, Any],
    errors: List[str],
    *,
    is_export: bool = False,
) -> Dict[str, Optional[List[str]]]:
    if is_export:
        reason_codes_present_key = "governanceExportReasonCodesPresent"
        reason_code_count_present_key = "governanceExportReasonCodeCountPresent"
        reason_code_count_parity_key = "governanceExportReasonCodeCountParity"
        recommended_commands_present_key = "governanceExportRecommendedCommandsPresent"
        recommended_command_count_present_key = (
            "governanceExportRecommendedCommandCountPresent"
        )
        recommended_command_count_parity_key = (
            "governanceExportRecommendedCommandCountParity"
        )
    else:
        reason_codes_present_key = "reasonCodesPresent"
        reason_code_count_present_key = "reasonCodeCountPresent"
        reason_code_count_parity_key = "reasonCodeCountParity"
        recommended_commands_present_key = "recommendedCommandsPresent"
        recommended_command_count_present_key = "recommendedCommandCountPresent"
        recommended_command_count_parity_key = "recommendedCommandCountParity"

    normalized_reason_codes = _normalize_reason_codes(
        payload.get("reasonCodes") if isinstance(payload, dict) else None
    )
    checks_bucket[reason_codes_present_key] = isinstance(normalized_reason_codes, list)
    if not checks_bucket[reason_codes_present_key]:
        errors.append(f"{label} is missing reasonCodes list")
    reason_code_count = (
        _coerce_non_negative_int(payload.get("reasonCodeCount"))
        if isinstance(payload, dict)
        else None
    )
    checks_bucket[reason_code_count_present_key] = reason_code_count is not None
    if not checks_bucket[reason_code_count_present_key]:
        errors.append(f"{label} is missing reasonCodeCount")
    checks_bucket[reason_code_count_parity_key] = (
        isinstance(normalized_reason_codes, list)
        and reason_code_count is not None
        and reason_code_count == len(normalized_reason_codes)
    )
    if checks_bucket[reason_codes_present_key] and checks_bucket[reason_code_count_present_key]:
        if not checks_bucket[reason_code_count_parity_key]:
            errors.append(f"{label} reasonCodeCount does not match len(reasonCodes)")

    normalized_recommended_commands = _normalize_recommended_commands(
        payload.get("recommendedCommands") if isinstance(payload, dict) else None
    )
    checks_bucket[recommended_commands_present_key] = isinstance(
        normalized_recommended_commands, list
    )
    if not checks_bucket[recommended_commands_present_key]:
        errors.append(f"{label} is missing recommendedCommands list")
    recommended_command_count = (
        _coerce_non_negative_int(payload.get("recommendedCommandCount"))
        if isinstance(payload, dict)
        else None
    )
    checks_bucket[recommended_command_count_present_key] = (
        recommended_command_count is not None
    )
    if not checks_bucket[recommended_command_count_present_key]:
        errors.append(f"{label} is missing recommendedCommandCount")
    checks_bucket[recommended_command_count_parity_key] = (
        isinstance(normalized_recommended_commands, list)
        and recommended_command_count is not None
        and recommended_command_count == len(normalized_recommended_commands)
    )
    if (
        checks_bucket[recommended_commands_present_key]
        and checks_bucket[recommended_command_count_present_key]
        and not checks_bucket[recommended_command_count_parity_key]
    ):
        errors.append(
            f"{label} recommendedCommandCount does not match len(recommendedCommands)"
        )

    return {
        "reasonCodes": normalized_reason_codes,
        "recommendedCommands": normalized_recommended_commands,
    }


def _load_json_object(path: str, label: str, errors: List[str]) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except OSError:
        errors.append(f"{label} artifact is missing or unreadable")
        return None
    except json.JSONDecodeError:
        errors.append(f"{label} artifact is not valid JSON")
        return None

    if not isinstance(payload, dict):
        errors.append(f"{label} artifact must be a JSON object")
        return None
    return payload


def validate_governance_packet_artifacts(
    handoff_payload: Optional[Dict[str, Any]],
    history_payload: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    errors: List[str] = []
    checks: Dict[str, Any] = {
        "handoff": {
            "statusPresent": False,
            "statusSupported": False,
            "reasonCodesPresent": False,
            "reasonCodeCountPresent": False,
            "reasonCodeCountParity": False,
            "recommendedCommandsPresent": False,
            "recommendedCommandCountPresent": False,
            "recommendedCommandCountParity": False,
            "exportSchemaVersionPresent": False,
            "exportSchemaVersionSupported": False,
            "governanceExportPresent": False,
            "governanceExportStatusPresent": False,
            "governanceExportStatusSupported": False,
            "governanceExportReasonCodesPresent": False,
            "governanceExportReasonCodeCountPresent": False,
            "governanceExportReasonCodeCountParity": False,
            "governanceExportRecommendedCommandsPresent": False,
            "governanceExportRecommendedCommandCountPresent": False,
            "governanceExportRecommendedCommandCountParity": False,
            "governanceExportSchemaVersionPresent": False,
            "governanceExportSchemaVersionSupported": False,
            "governanceExportRolloutBlockedPresent": False,
            "governanceExportOwnerRolePresent": False,
            "runtimePrereqsPresent": False,
            "runtimePrereqsShapeValid": False,
            "runtimePrereqsMissingCheckParity": False,
            "governanceExportRuntimePrereqsPresent": False,
            "governanceExportRuntimePrereqsShapeValid": False,
            "governanceExportRuntimePrereqsMissingCheckParity": False,
            "commandAliasesPresent": False,
            "commandAliasesShapeValid": False,
            "commandAliasesCountParity": False,
            "governanceExportCommandAliasesPresent": False,
            "governanceExportCommandAliasesShapeValid": False,
            "governanceExportCommandAliasesCountParity": False,
            "connectorRateLimitPresent": False,
            "connectorRateLimitShapeValid": False,
            "connectorRateLimitPressureLabelPresent": False,
            "governanceExportConnectorRateLimitPresent": False,
            "governanceExportConnectorRateLimitShapeValid": False,
            "governanceExportConnectorRateLimitPressureLabelPresent": False,
            "connectorRateLimitConsistency": True,
            "connectorRateLimitByEndpointConsistency": True,
            "runtimePrereqsConsistency": True,
            "commandAliasesConsistency": True,
            "connectorPressureParityPresent": False,
            "connectorPressureParityShapeValid": False,
            "connectorPressureParityConsistency": False,
            "sendgridWebhookTimestampPresent": False,
            "sendgridWebhookTimestampShapeValid": False,
            "governanceExportSendgridWebhookTimestampPresent": False,
            "governanceExportSendgridWebhookTimestampShapeValid": False,
            "sendgridWebhookTimestampConsistency": True,
            "sendgridWebhookTimestampParityPresent": False,
            "sendgridWebhookTimestampParityShapeValid": False,
            "sendgridWebhookTimestampParityConsistency": False,
            "reasonCodesConsistency": True,
            "recommendedCommandsConsistency": True,
            "statusConsistency": True,
            "exportSchemaVersionConsistency": True,
            "statusRolloutConsistency": True,
        },
        "history": {
            "statusPresent": False,
            "statusSupported": False,
            "reasonCodesPresent": False,
            "reasonCodeCountPresent": False,
            "reasonCodeCountParity": False,
            "recommendedCommandsPresent": False,
            "recommendedCommandCountPresent": False,
            "recommendedCommandCountParity": False,
            "exportSchemaVersionPresent": False,
            "exportSchemaVersionSupported": False,
            "itemsPresent": False,
            "governanceExportPresent": False,
            "governanceExportStatusPresent": False,
            "governanceExportStatusSupported": False,
            "governanceExportReasonCodesPresent": False,
            "governanceExportReasonCodeCountPresent": False,
            "governanceExportReasonCodeCountParity": False,
            "governanceExportRecommendedCommandsPresent": False,
            "governanceExportRecommendedCommandCountPresent": False,
            "governanceExportRecommendedCommandCountParity": False,
            "governanceExportSchemaVersionPresent": False,
            "governanceExportSchemaVersionSupported": False,
            "governanceExportRolloutBlockedPresent": False,
            "governanceExportOwnerRolePresent": False,
            "runtimePrereqsPresent": False,
            "runtimePrereqsShapeValid": False,
            "runtimePrereqsMissingCheckParity": False,
            "governanceExportRuntimePrereqsPresent": False,
            "governanceExportRuntimePrereqsShapeValid": False,
            "governanceExportRuntimePrereqsMissingCheckParity": False,
            "commandAliasesPresent": False,
            "commandAliasesShapeValid": False,
            "commandAliasesCountParity": False,
            "governanceExportCommandAliasesPresent": False,
            "governanceExportCommandAliasesShapeValid": False,
            "governanceExportCommandAliasesCountParity": False,
            "connectorRateLimitPresent": False,
            "connectorRateLimitShapeValid": False,
            "connectorRateLimitPressureLabelPresent": False,
            "governanceExportConnectorRateLimitPresent": False,
            "governanceExportConnectorRateLimitShapeValid": False,
            "governanceExportConnectorRateLimitPressureLabelPresent": False,
            "connectorRateLimitConsistency": True,
            "connectorRateLimitByEndpointConsistency": True,
            "runtimePrereqsConsistency": True,
            "commandAliasesConsistency": True,
            "connectorPressureParityPresent": False,
            "connectorPressureParityShapeValid": False,
            "connectorPressureParityConsistency": False,
            "sendgridWebhookTimestampPresent": False,
            "sendgridWebhookTimestampShapeValid": False,
            "governanceExportSendgridWebhookTimestampPresent": False,
            "governanceExportSendgridWebhookTimestampShapeValid": False,
            "sendgridWebhookTimestampConsistency": True,
            "sendgridWebhookTimestampParityPresent": False,
            "sendgridWebhookTimestampParityShapeValid": False,
            "sendgridWebhookTimestampParityConsistency": False,
            "itemsShapeValid": True,
            "itemSchemaVersionPresent": True,
            "itemSchemaVersionSupported": True,
            "itemSchemaVersionConsistency": True,
            "itemStatusSupported": True,
            "itemStatusRolloutConsistency": True,
            "duplicateArtifactNames": True,
            "duplicateArtifactNameCount": 0,
            "reasonCodesConsistency": True,
            "recommendedCommandsConsistency": True,
            "statusConsistency": True,
            "exportSchemaVersionConsistency": True,
            "statusRolloutConsistency": True,
        },
        "crossArtifact": {
            "statusConsistency": True,
            "rolloutBlockedConsistency": True,
            "exportSchemaVersionConsistency": True,
            "reasonCodeCountConsistency": True,
            "recommendedCommandCountConsistency": True,
            "runtimePrereqsMissingCheckCountConsistency": True,
            "commandAliasesMissingAliasCountConsistency": True,
            "commandAliasesMismatchedAliasCountConsistency": True,
            "commandAliasesCommandConsistency": True,
            "sendgridWebhookTimestampEventCountConsistency": True,
            "sendgridWebhookTimestampAnomalyCountConsistency": True,
        },
    }

    handoff_status = ""
    handoff_export_schema_version: Optional[int] = None
    handoff_export_status = ""
    handoff_export_rollout_blocked: Optional[bool] = None
    handoff_runtime_prereqs: Optional[Dict[str, Any]] = None
    handoff_export_runtime_prereqs: Optional[Dict[str, Any]] = None
    handoff_command_aliases: Optional[Dict[str, Any]] = None
    handoff_export_command_aliases: Optional[Dict[str, Any]] = None
    handoff_connector_rate_limit: Optional[Dict[str, Any]] = None
    handoff_export_connector_rate_limit: Optional[Dict[str, Any]] = None
    handoff_sendgrid_webhook_timestamp: Optional[Dict[str, Any]] = None
    handoff_export_sendgrid_webhook_timestamp: Optional[Dict[str, Any]] = None
    handoff_reason_codes: Optional[List[str]] = None
    handoff_recommended_commands: Optional[List[str]] = None
    handoff_export_reason_codes: Optional[List[str]] = None
    handoff_export_recommended_commands: Optional[List[str]] = None
    history_status = ""
    history_export_schema_version: Optional[int] = None
    history_export_status = ""
    history_export_rollout_blocked: Optional[bool] = None
    history_runtime_prereqs: Optional[Dict[str, Any]] = None
    history_export_runtime_prereqs: Optional[Dict[str, Any]] = None
    history_command_aliases: Optional[Dict[str, Any]] = None
    history_export_command_aliases: Optional[Dict[str, Any]] = None
    history_connector_rate_limit: Optional[Dict[str, Any]] = None
    history_export_connector_rate_limit: Optional[Dict[str, Any]] = None
    history_sendgrid_webhook_timestamp: Optional[Dict[str, Any]] = None
    history_export_sendgrid_webhook_timestamp: Optional[Dict[str, Any]] = None
    history_reason_codes: Optional[List[str]] = None
    history_recommended_commands: Optional[List[str]] = None
    history_export_reason_codes: Optional[List[str]] = None
    history_export_recommended_commands: Optional[List[str]] = None

    if isinstance(handoff_payload, dict):
        handoff_connector_rate_limit = _validate_connector_rate_limit_payload(
            handoff_payload.get("connectorRateLimit"),
            "Governance handoff artifact",
            checks["handoff"],
            "connectorRateLimit",
            errors,
        )
        handoff_sendgrid_webhook_timestamp = _validate_sendgrid_webhook_timestamp_payload(
            handoff_payload.get("sendgridWebhookTimestamp"),
            "Governance handoff artifact",
            checks["handoff"],
            "sendgridWebhookTimestamp",
            errors,
        )
        handoff_parity_fields = _validate_reason_and_command_parity(
            handoff_payload,
            "Governance handoff artifact",
            checks["handoff"],
            errors,
        )
        handoff_reason_codes = handoff_parity_fields.get("reasonCodes")
        handoff_recommended_commands = handoff_parity_fields.get("recommendedCommands")
        handoff_status = _normalize_status(handoff_payload.get("status"))
        checks["handoff"]["statusPresent"] = bool(handoff_status)
        if not checks["handoff"]["statusPresent"]:
            errors.append("Governance handoff artifact is missing status")
        else:
            checks["handoff"]["statusSupported"] = (
                handoff_status in ALLOWED_GOVERNANCE_STATUSES
            )
            if not checks["handoff"]["statusSupported"]:
                errors.append(
                    "Governance handoff artifact status must be READY or ACTION_REQUIRED"
                )
        handoff_schema_version = handoff_payload.get("exportSchemaVersion")
        checks["handoff"]["exportSchemaVersionPresent"] = isinstance(
            handoff_schema_version, int
        )
        if not checks["handoff"]["exportSchemaVersionPresent"]:
            errors.append("Governance handoff artifact is missing exportSchemaVersion")
        else:
            handoff_export_schema_version = int(handoff_schema_version)
            checks["handoff"]["exportSchemaVersionSupported"] = (
                handoff_export_schema_version
                in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS
            )
            if not checks["handoff"]["exportSchemaVersionSupported"]:
                errors.append(
                    "Governance handoff artifact exportSchemaVersion is unsupported"
                )
        handoff_runtime_prereqs = _validate_runtime_prereqs_payload(
            handoff_payload.get("runtimePrereqs"),
            "Governance handoff artifact",
            checks["handoff"],
            "runtimePrereqs",
            errors,
        )
        handoff_command_aliases = _validate_command_aliases_payload(
            handoff_payload.get("commandAliases"),
            "Governance handoff artifact",
            checks["handoff"],
            "commandAliases",
            errors,
        )

        handoff_export = handoff_payload.get("governanceExport")
        checks["handoff"]["governanceExportPresent"] = isinstance(handoff_export, dict)
        if not checks["handoff"]["governanceExportPresent"]:
            errors.append("Governance handoff artifact is missing governanceExport payload")
        else:
            handoff_export_parity_fields = _validate_reason_and_command_parity(
                handoff_export,
                "Governance handoff artifact governanceExport",
                checks["handoff"],
                errors,
                is_export=True,
            )
            handoff_export_reason_codes = handoff_export_parity_fields.get("reasonCodes")
            handoff_export_recommended_commands = handoff_export_parity_fields.get(
                "recommendedCommands"
            )
            handoff_export_status = _normalize_status(handoff_export.get("status"))
            checks["handoff"]["governanceExportStatusPresent"] = bool(handoff_export_status)
            if not checks["handoff"]["governanceExportStatusPresent"]:
                errors.append(
                    "Governance handoff artifact governanceExport is missing status"
                )
            else:
                checks["handoff"]["governanceExportStatusSupported"] = (
                    handoff_export_status in ALLOWED_GOVERNANCE_STATUSES
                )
                if not checks["handoff"]["governanceExportStatusSupported"]:
                    errors.append(
                        "Governance handoff artifact governanceExport.status must be READY or ACTION_REQUIRED"
                    )
            handoff_export_schema = handoff_export.get("exportSchemaVersion")
            checks["handoff"]["governanceExportSchemaVersionPresent"] = isinstance(
                handoff_export_schema, int
            )
            if not checks["handoff"]["governanceExportSchemaVersionPresent"]:
                errors.append(
                    "Governance handoff artifact governanceExport is missing exportSchemaVersion"
                )
            else:
                checks["handoff"]["governanceExportSchemaVersionSupported"] = (
                    int(handoff_export_schema)
                    in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS
                )
                if not checks["handoff"]["governanceExportSchemaVersionSupported"]:
                    errors.append(
                        "Governance handoff artifact governanceExport.exportSchemaVersion is unsupported"
                    )
                if (
                    handoff_export_schema_version is not None
                    and int(handoff_export_schema) != handoff_export_schema_version
                ):
                    checks["handoff"]["exportSchemaVersionConsistency"] = False
                    errors.append(
                        "Governance handoff artifact exportSchemaVersion does not match governanceExport.exportSchemaVersion"
                    )

            checks["handoff"]["governanceExportRolloutBlockedPresent"] = isinstance(
                handoff_export.get("rolloutBlocked"), bool
            )
            if not checks["handoff"]["governanceExportRolloutBlockedPresent"]:
                errors.append(
                    "Governance handoff artifact governanceExport is missing rolloutBlocked boolean"
                )

            checks["handoff"]["governanceExportOwnerRolePresent"] = _is_non_empty_string(
                handoff_export.get("ownerRole")
            )
            if not checks["handoff"]["governanceExportOwnerRolePresent"]:
                errors.append(
                    "Governance handoff artifact governanceExport is missing ownerRole"
                )
            else:
                handoff_export_rollout_blocked = bool(handoff_export.get("rolloutBlocked"))
            handoff_export_runtime_prereqs = _validate_runtime_prereqs_payload(
                handoff_export.get("runtimePrereqs"),
                "Governance handoff artifact governanceExport",
                checks["handoff"],
                "governanceExportRuntimePrereqs",
                errors,
            )
            handoff_export_command_aliases = _validate_command_aliases_payload(
                handoff_export.get("commandAliases"),
                "Governance handoff artifact governanceExport",
                checks["handoff"],
                "governanceExportCommandAliases",
                errors,
            )
            if (
                isinstance(handoff_reason_codes, list)
                and isinstance(handoff_export_reason_codes, list)
                and handoff_reason_codes != handoff_export_reason_codes
            ):
                checks["handoff"]["reasonCodesConsistency"] = False
                errors.append(
                    "Governance handoff artifact reasonCodes does not match governanceExport.reasonCodes"
                )
            if (
                isinstance(handoff_recommended_commands, list)
                and isinstance(handoff_export_recommended_commands, list)
                and handoff_recommended_commands != handoff_export_recommended_commands
            ):
                checks["handoff"]["recommendedCommandsConsistency"] = False
                errors.append(
                    "Governance handoff artifact recommendedCommands does not match governanceExport.recommendedCommands"
                )
            handoff_export_connector_rate_limit = _validate_connector_rate_limit_payload(
                handoff_export.get("connectorRateLimit"),
                "Governance handoff artifact governanceExport",
                checks["handoff"],
                "governanceExportConnectorRateLimit",
                errors,
            )
            handoff_export_sendgrid_webhook_timestamp = (
                _validate_sendgrid_webhook_timestamp_payload(
                    handoff_export.get("sendgridWebhookTimestamp"),
                    "Governance handoff artifact governanceExport",
                    checks["handoff"],
                    "governanceExportSendgridWebhookTimestamp",
                    errors,
                )
            )

        if (
            isinstance(handoff_connector_rate_limit, dict)
            and isinstance(handoff_export_connector_rate_limit, dict)
        ):
            handoff_event_count = handoff_connector_rate_limit.get("eventCount")
            handoff_export_event_count = handoff_export_connector_rate_limit.get(
                "eventCount"
            )
            handoff_pressure_payload = handoff_connector_rate_limit.get("pressure")
            handoff_export_pressure_payload = handoff_export_connector_rate_limit.get(
                "pressure"
            )
            handoff_pressure_label = (
                handoff_pressure_payload.get("label")
                if isinstance(handoff_pressure_payload, dict)
                else None
            )
            handoff_export_pressure_label = (
                handoff_export_pressure_payload.get("label")
                if isinstance(handoff_export_pressure_payload, dict)
                else None
            )
            if handoff_event_count != handoff_export_event_count:
                checks["handoff"]["connectorRateLimitConsistency"] = False
                errors.append(
                    "Governance handoff artifact connectorRateLimit.eventCount does not match governanceExport.connectorRateLimit.eventCount"
                )
            if handoff_pressure_label != handoff_export_pressure_label:
                checks["handoff"]["connectorRateLimitConsistency"] = False
                errors.append(
                    "Governance handoff artifact connectorRateLimit.pressure.label does not match governanceExport.connectorRateLimit.pressure.label"
                )
            if _normalize_connector_rate_limit_by_endpoint(
                handoff_connector_rate_limit.get("byEndpoint")
            ) != _normalize_connector_rate_limit_by_endpoint(
                handoff_export_connector_rate_limit.get("byEndpoint")
            ):
                checks["handoff"]["connectorRateLimitConsistency"] = False
                checks["handoff"]["connectorRateLimitByEndpointConsistency"] = False
                errors.append(
                    "Governance handoff artifact connectorRateLimit.byEndpoint does not match governanceExport.connectorRateLimit.byEndpoint"
                )
        if (
            isinstance(handoff_sendgrid_webhook_timestamp, dict)
            and isinstance(handoff_export_sendgrid_webhook_timestamp, dict)
        ):
            if (
                handoff_sendgrid_webhook_timestamp.get("eventCount")
                != handoff_export_sendgrid_webhook_timestamp.get("eventCount")
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.eventCount does not match governanceExport.sendgridWebhookTimestamp.eventCount"
                )
            if (
                handoff_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
                != handoff_export_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyCountTotal"
                )
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.timestampAnomalyCountTotal does not match governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal"
                )
            if _normalize_sendgrid_timestamp_count_map(
                handoff_sendgrid_webhook_timestamp.get("pressureLabelCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                handoff_export_sendgrid_webhook_timestamp.get("pressureLabelCounts")
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.pressureLabelCounts does not match governanceExport.sendgridWebhookTimestamp.pressureLabelCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                handoff_sendgrid_webhook_timestamp.get("pressureHintCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                handoff_export_sendgrid_webhook_timestamp.get("pressureHintCounts")
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.pressureHintCounts does not match governanceExport.sendgridWebhookTimestamp.pressureHintCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                handoff_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                handoff_export_sendgrid_webhook_timestamp.get(
                    "timestampAgeBucketCounts"
                )
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.timestampAgeBucketCounts does not match governanceExport.sendgridWebhookTimestamp.timestampAgeBucketCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                handoff_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyEventTypeCounts"
                )
            ) != _normalize_sendgrid_timestamp_count_map(
                handoff_export_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyEventTypeCounts"
                )
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts does not match governanceExport.sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts"
                )
            if _normalize_sendgrid_latest_event_at(
                handoff_sendgrid_webhook_timestamp.get("latestEventAt")
            ) != _normalize_sendgrid_latest_event_at(
                handoff_export_sendgrid_webhook_timestamp.get("latestEventAt")
            ):
                checks["handoff"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance handoff artifact sendgridWebhookTimestamp.latestEventAt does not match governanceExport.sendgridWebhookTimestamp.latestEventAt"
                )
        handoff_runtime_prereqs_present = checks["handoff"]["runtimePrereqsPresent"]
        handoff_export_runtime_prereqs_present = checks["handoff"][
            "governanceExportRuntimePrereqsPresent"
        ]
        if handoff_runtime_prereqs_present != handoff_export_runtime_prereqs_present:
            checks["handoff"]["runtimePrereqsConsistency"] = False
            errors.append(
                "Governance handoff artifact runtimePrereqs presence does not match governanceExport.runtimePrereqs"
            )
        elif (
            handoff_runtime_prereqs_present
            and handoff_export_runtime_prereqs_present
            and isinstance(handoff_runtime_prereqs, dict)
            and isinstance(handoff_export_runtime_prereqs, dict)
            and handoff_runtime_prereqs != handoff_export_runtime_prereqs
        ):
            checks["handoff"]["runtimePrereqsConsistency"] = False
            errors.append(
                "Governance handoff artifact runtimePrereqs does not match governanceExport.runtimePrereqs"
            )
        handoff_command_aliases_present = checks["handoff"]["commandAliasesPresent"]
        handoff_export_command_aliases_present = checks["handoff"][
            "governanceExportCommandAliasesPresent"
        ]
        if handoff_command_aliases_present != handoff_export_command_aliases_present:
            checks["handoff"]["commandAliasesConsistency"] = False
            errors.append(
                "Governance handoff artifact commandAliases presence does not match governanceExport.commandAliases"
            )
        elif (
            handoff_command_aliases_present
            and handoff_export_command_aliases_present
            and isinstance(handoff_command_aliases, dict)
            and isinstance(handoff_export_command_aliases, dict)
            and handoff_command_aliases != handoff_export_command_aliases
        ):
            checks["handoff"]["commandAliasesConsistency"] = False
            errors.append(
                "Governance handoff artifact commandAliases does not match governanceExport.commandAliases"
            )

        if handoff_status and handoff_export_status and handoff_status != handoff_export_status:
            checks["handoff"]["statusConsistency"] = False
            errors.append(
                "Governance handoff artifact status does not match governanceExport.status"
            )

        if (
            handoff_export_rollout_blocked is not None
            and handoff_export_status
            and not _status_rollout_consistent(handoff_export_status, handoff_export_rollout_blocked)
        ):
            checks["handoff"]["statusRolloutConsistency"] = False
            errors.append(
                "Governance handoff artifact governanceExport rolloutBlocked is inconsistent with status"
            )
        handoff_totals_event_count = None
        handoff_totals = handoff_payload.get("totals")
        handoff_totals_sendgrid_event_count = None
        handoff_totals_sendgrid_anomaly_count_total = None
        if isinstance(handoff_totals, dict):
            handoff_totals_event_count = _coerce_non_negative_int(
                handoff_totals.get("connectorRateLimitEventCount")
            )
            handoff_totals_sendgrid_event_count = _coerce_non_negative_int(
                handoff_totals.get("sendgridWebhookTimestampEventCount")
            )
            handoff_totals_sendgrid_anomaly_count_total = _coerce_non_negative_int(
                handoff_totals.get("sendgridWebhookTimestampAnomalyCountTotal")
            )
        _validate_connector_pressure_parity_payload(
            handoff_payload.get("connectorPressureParity"),
            "Governance handoff artifact",
            checks["handoff"],
            errors,
            handoff_connector_rate_limit,
            handoff_export_connector_rate_limit,
            handoff_totals_event_count,
        )
        _validate_sendgrid_webhook_timestamp_parity_payload(
            handoff_payload.get("sendgridWebhookTimestampParity"),
            "Governance handoff artifact",
            checks["handoff"],
            errors,
            handoff_sendgrid_webhook_timestamp,
            handoff_export_sendgrid_webhook_timestamp,
            handoff_totals_sendgrid_event_count,
            handoff_totals_sendgrid_anomaly_count_total,
        )

    if isinstance(history_payload, dict):
        history_connector_rate_limit = _validate_connector_rate_limit_payload(
            history_payload.get("connectorRateLimit"),
            "Governance history artifact",
            checks["history"],
            "connectorRateLimit",
            errors,
        )
        history_sendgrid_webhook_timestamp = _validate_sendgrid_webhook_timestamp_payload(
            history_payload.get("sendgridWebhookTimestamp"),
            "Governance history artifact",
            checks["history"],
            "sendgridWebhookTimestamp",
            errors,
        )
        history_parity_fields = _validate_reason_and_command_parity(
            history_payload,
            "Governance history artifact",
            checks["history"],
            errors,
        )
        history_reason_codes = history_parity_fields.get("reasonCodes")
        history_recommended_commands = history_parity_fields.get("recommendedCommands")
        history_status = _normalize_status(history_payload.get("status"))
        checks["history"]["statusPresent"] = bool(history_status)
        if not checks["history"]["statusPresent"]:
            errors.append("Governance history artifact is missing status")
        else:
            checks["history"]["statusSupported"] = (
                history_status in ALLOWED_GOVERNANCE_STATUSES
            )
            if not checks["history"]["statusSupported"]:
                errors.append(
                    "Governance history artifact status must be READY or ACTION_REQUIRED"
                )
        history_schema_version = history_payload.get("exportSchemaVersion")
        checks["history"]["exportSchemaVersionPresent"] = isinstance(
            history_schema_version, int
        )
        if not checks["history"]["exportSchemaVersionPresent"]:
            errors.append("Governance history artifact is missing exportSchemaVersion")
        else:
            history_export_schema_version = int(history_schema_version)
            checks["history"]["exportSchemaVersionSupported"] = (
                history_export_schema_version
                in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS
            )
            if not checks["history"]["exportSchemaVersionSupported"]:
                errors.append(
                    "Governance history artifact exportSchemaVersion is unsupported"
                )
        history_runtime_prereqs = _validate_runtime_prereqs_payload(
            history_payload.get("runtimePrereqs"),
            "Governance history artifact",
            checks["history"],
            "runtimePrereqs",
            errors,
        )
        history_command_aliases = _validate_command_aliases_payload(
            history_payload.get("commandAliases"),
            "Governance history artifact",
            checks["history"],
            "commandAliases",
            errors,
        )

        items = history_payload.get("items")
        checks["history"]["itemsPresent"] = isinstance(items, list)
        if not checks["history"]["itemsPresent"]:
            errors.append("Governance history artifact is missing items list")
        else:
            item_name_counts: Dict[str, int] = {}
            for item in items:
                if not isinstance(item, dict):
                    checks["history"]["itemsShapeValid"] = False
                    continue
                item_name = item.get("name")
                if not _is_non_empty_string(item_name):
                    checks["history"]["itemsShapeValid"] = False
                else:
                    normalized_name = str(item_name).strip()
                    item_name_counts[normalized_name] = (
                        int(item_name_counts.get(normalized_name, 0)) + 1
                    )
                item_status = _normalize_status(item.get("status"))
                if not item_status:
                    checks["history"]["itemsShapeValid"] = False
                if not isinstance(item.get("withinRetention"), bool):
                    checks["history"]["itemsShapeValid"] = False
                if not isinstance(item.get("rolloutBlocked"), bool):
                    checks["history"]["itemsShapeValid"] = False
                item_export_schema = item.get("exportSchemaVersion")
                if not isinstance(item_export_schema, int):
                    checks["history"]["itemSchemaVersionPresent"] = False
                else:
                    if (
                        item_export_schema
                        not in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS
                    ):
                        checks["history"]["itemSchemaVersionSupported"] = False
                    if (
                        history_export_schema_version is not None
                        and item_export_schema != history_export_schema_version
                    ):
                        checks["history"]["itemSchemaVersionConsistency"] = False
                if item_status and item_status not in ALLOWED_GOVERNANCE_STATUSES:
                    checks["history"]["itemStatusSupported"] = False
                if (
                    item_status
                    and isinstance(item.get("rolloutBlocked"), bool)
                    and not _status_rollout_consistent(item_status, bool(item.get("rolloutBlocked")))
                ):
                    checks["history"]["itemStatusRolloutConsistency"] = False
            if not checks["history"]["itemsShapeValid"]:
                errors.append(
                    "Governance history artifact items must include name/status/withinRetention/rolloutBlocked"
                )
            if not checks["history"]["itemStatusSupported"]:
                errors.append(
                    "Governance history artifact item status must be READY or ACTION_REQUIRED"
                )
            if not checks["history"]["itemStatusRolloutConsistency"]:
                errors.append(
                    "Governance history artifact item rolloutBlocked values are inconsistent with item status"
                )
            if not checks["history"]["itemSchemaVersionPresent"]:
                errors.append(
                    "Governance history artifact items must include exportSchemaVersion"
                )
            if not checks["history"]["itemSchemaVersionSupported"]:
                errors.append(
                    "Governance history artifact item exportSchemaVersion is unsupported"
                )
            if not checks["history"]["itemSchemaVersionConsistency"]:
                errors.append(
                    "Governance history artifact item exportSchemaVersion values are inconsistent with history exportSchemaVersion"
                )
            duplicate_names = sorted(
                [name for name, count in item_name_counts.items() if count > 1]
            )
            checks["history"]["duplicateArtifactNameCount"] = len(duplicate_names)
            if duplicate_names:
                checks["history"]["duplicateArtifactNames"] = False
                errors.append(
                    "Governance history artifact contains duplicate item names: "
                    + ", ".join(duplicate_names)
                )

        history_export = history_payload.get("governanceExport")
        checks["history"]["governanceExportPresent"] = isinstance(history_export, dict)
        if not checks["history"]["governanceExportPresent"]:
            errors.append("Governance history artifact is missing governanceExport payload")
        else:
            history_export_parity_fields = _validate_reason_and_command_parity(
                history_export,
                "Governance history artifact governanceExport",
                checks["history"],
                errors,
                is_export=True,
            )
            history_export_reason_codes = history_export_parity_fields.get("reasonCodes")
            history_export_recommended_commands = history_export_parity_fields.get(
                "recommendedCommands"
            )
            history_export_status = _normalize_status(history_export.get("status"))
            checks["history"]["governanceExportStatusPresent"] = bool(history_export_status)
            if not checks["history"]["governanceExportStatusPresent"]:
                errors.append(
                    "Governance history artifact governanceExport is missing status"
                )
            else:
                checks["history"]["governanceExportStatusSupported"] = (
                    history_export_status in ALLOWED_GOVERNANCE_STATUSES
                )
                if not checks["history"]["governanceExportStatusSupported"]:
                    errors.append(
                        "Governance history artifact governanceExport.status must be READY or ACTION_REQUIRED"
                    )
            history_export_schema = history_export.get("exportSchemaVersion")
            checks["history"]["governanceExportSchemaVersionPresent"] = isinstance(
                history_export_schema, int
            )
            if not checks["history"]["governanceExportSchemaVersionPresent"]:
                errors.append(
                    "Governance history artifact governanceExport is missing exportSchemaVersion"
                )
            else:
                checks["history"]["governanceExportSchemaVersionSupported"] = (
                    int(history_export_schema)
                    in ALLOWED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS
                )
                if not checks["history"]["governanceExportSchemaVersionSupported"]:
                    errors.append(
                        "Governance history artifact governanceExport.exportSchemaVersion is unsupported"
                    )
                if (
                    history_export_schema_version is not None
                    and int(history_export_schema) != history_export_schema_version
                ):
                    checks["history"]["exportSchemaVersionConsistency"] = False
                    errors.append(
                        "Governance history artifact exportSchemaVersion does not match governanceExport.exportSchemaVersion"
                    )

            checks["history"]["governanceExportRolloutBlockedPresent"] = isinstance(
                history_export.get("rolloutBlocked"), bool
            )
            if not checks["history"]["governanceExportRolloutBlockedPresent"]:
                errors.append(
                    "Governance history artifact governanceExport is missing rolloutBlocked boolean"
                )

            checks["history"]["governanceExportOwnerRolePresent"] = _is_non_empty_string(
                history_export.get("ownerRole")
            )
            if not checks["history"]["governanceExportOwnerRolePresent"]:
                errors.append(
                    "Governance history artifact governanceExport is missing ownerRole"
                )
            else:
                history_export_rollout_blocked = bool(history_export.get("rolloutBlocked"))
            history_export_runtime_prereqs = _validate_runtime_prereqs_payload(
                history_export.get("runtimePrereqs"),
                "Governance history artifact governanceExport",
                checks["history"],
                "governanceExportRuntimePrereqs",
                errors,
            )
            history_export_command_aliases = _validate_command_aliases_payload(
                history_export.get("commandAliases"),
                "Governance history artifact governanceExport",
                checks["history"],
                "governanceExportCommandAliases",
                errors,
            )
            if (
                isinstance(history_reason_codes, list)
                and isinstance(history_export_reason_codes, list)
                and history_reason_codes != history_export_reason_codes
            ):
                checks["history"]["reasonCodesConsistency"] = False
                errors.append(
                    "Governance history artifact reasonCodes does not match governanceExport.reasonCodes"
                )
            if (
                isinstance(history_recommended_commands, list)
                and isinstance(history_export_recommended_commands, list)
                and history_recommended_commands != history_export_recommended_commands
            ):
                checks["history"]["recommendedCommandsConsistency"] = False
                errors.append(
                    "Governance history artifact recommendedCommands does not match governanceExport.recommendedCommands"
                )
            history_export_connector_rate_limit = _validate_connector_rate_limit_payload(
                history_export.get("connectorRateLimit"),
                "Governance history artifact governanceExport",
                checks["history"],
                "governanceExportConnectorRateLimit",
                errors,
            )
            history_export_sendgrid_webhook_timestamp = (
                _validate_sendgrid_webhook_timestamp_payload(
                    history_export.get("sendgridWebhookTimestamp"),
                    "Governance history artifact governanceExport",
                    checks["history"],
                    "governanceExportSendgridWebhookTimestamp",
                    errors,
                )
            )

        if (
            isinstance(history_connector_rate_limit, dict)
            and isinstance(history_export_connector_rate_limit, dict)
        ):
            history_event_count = history_connector_rate_limit.get("eventCount")
            history_export_event_count = history_export_connector_rate_limit.get(
                "eventCount"
            )
            history_pressure_payload = history_connector_rate_limit.get("pressure")
            history_export_pressure_payload = history_export_connector_rate_limit.get(
                "pressure"
            )
            history_pressure_label = (
                history_pressure_payload.get("label")
                if isinstance(history_pressure_payload, dict)
                else None
            )
            history_export_pressure_label = (
                history_export_pressure_payload.get("label")
                if isinstance(history_export_pressure_payload, dict)
                else None
            )
            if history_event_count != history_export_event_count:
                checks["history"]["connectorRateLimitConsistency"] = False
                errors.append(
                    "Governance history artifact connectorRateLimit.eventCount does not match governanceExport.connectorRateLimit.eventCount"
                )
            if history_pressure_label != history_export_pressure_label:
                checks["history"]["connectorRateLimitConsistency"] = False
                errors.append(
                    "Governance history artifact connectorRateLimit.pressure.label does not match governanceExport.connectorRateLimit.pressure.label"
                )
            if _normalize_connector_rate_limit_by_endpoint(
                history_connector_rate_limit.get("byEndpoint")
            ) != _normalize_connector_rate_limit_by_endpoint(
                history_export_connector_rate_limit.get("byEndpoint")
            ):
                checks["history"]["connectorRateLimitConsistency"] = False
                checks["history"]["connectorRateLimitByEndpointConsistency"] = False
                errors.append(
                    "Governance history artifact connectorRateLimit.byEndpoint does not match governanceExport.connectorRateLimit.byEndpoint"
                )
        if (
            isinstance(history_sendgrid_webhook_timestamp, dict)
            and isinstance(history_export_sendgrid_webhook_timestamp, dict)
        ):
            if (
                history_sendgrid_webhook_timestamp.get("eventCount")
                != history_export_sendgrid_webhook_timestamp.get("eventCount")
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.eventCount does not match governanceExport.sendgridWebhookTimestamp.eventCount"
                )
            if (
                history_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
                != history_export_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyCountTotal"
                )
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.timestampAnomalyCountTotal does not match governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal"
                )
            if _normalize_sendgrid_timestamp_count_map(
                history_sendgrid_webhook_timestamp.get("pressureLabelCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                history_export_sendgrid_webhook_timestamp.get("pressureLabelCounts")
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.pressureLabelCounts does not match governanceExport.sendgridWebhookTimestamp.pressureLabelCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                history_sendgrid_webhook_timestamp.get("pressureHintCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                history_export_sendgrid_webhook_timestamp.get("pressureHintCounts")
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.pressureHintCounts does not match governanceExport.sendgridWebhookTimestamp.pressureHintCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                history_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
            ) != _normalize_sendgrid_timestamp_count_map(
                history_export_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.timestampAgeBucketCounts does not match governanceExport.sendgridWebhookTimestamp.timestampAgeBucketCounts"
                )
            if _normalize_sendgrid_timestamp_count_map(
                history_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyEventTypeCounts"
                )
            ) != _normalize_sendgrid_timestamp_count_map(
                history_export_sendgrid_webhook_timestamp.get(
                    "timestampAnomalyEventTypeCounts"
                )
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts does not match governanceExport.sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts"
                )
            if _normalize_sendgrid_latest_event_at(
                history_sendgrid_webhook_timestamp.get("latestEventAt")
            ) != _normalize_sendgrid_latest_event_at(
                history_export_sendgrid_webhook_timestamp.get("latestEventAt")
            ):
                checks["history"]["sendgridWebhookTimestampConsistency"] = False
                errors.append(
                    "Governance history artifact sendgridWebhookTimestamp.latestEventAt does not match governanceExport.sendgridWebhookTimestamp.latestEventAt"
                )
        history_runtime_prereqs_present = checks["history"]["runtimePrereqsPresent"]
        history_export_runtime_prereqs_present = checks["history"][
            "governanceExportRuntimePrereqsPresent"
        ]
        if history_runtime_prereqs_present != history_export_runtime_prereqs_present:
            checks["history"]["runtimePrereqsConsistency"] = False
            errors.append(
                "Governance history artifact runtimePrereqs presence does not match governanceExport.runtimePrereqs"
            )
        elif (
            history_runtime_prereqs_present
            and history_export_runtime_prereqs_present
            and isinstance(history_runtime_prereqs, dict)
            and isinstance(history_export_runtime_prereqs, dict)
            and history_runtime_prereqs != history_export_runtime_prereqs
        ):
            checks["history"]["runtimePrereqsConsistency"] = False
            errors.append(
                "Governance history artifact runtimePrereqs does not match governanceExport.runtimePrereqs"
            )
        history_command_aliases_present = checks["history"]["commandAliasesPresent"]
        history_export_command_aliases_present = checks["history"][
            "governanceExportCommandAliasesPresent"
        ]
        if history_command_aliases_present != history_export_command_aliases_present:
            checks["history"]["commandAliasesConsistency"] = False
            errors.append(
                "Governance history artifact commandAliases presence does not match governanceExport.commandAliases"
            )
        elif (
            history_command_aliases_present
            and history_export_command_aliases_present
            and isinstance(history_command_aliases, dict)
            and isinstance(history_export_command_aliases, dict)
            and history_command_aliases != history_export_command_aliases
        ):
            checks["history"]["commandAliasesConsistency"] = False
            errors.append(
                "Governance history artifact commandAliases does not match governanceExport.commandAliases"
            )

        if history_status and history_export_status and history_status != history_export_status:
            checks["history"]["statusConsistency"] = False
            errors.append(
                "Governance history artifact status does not match governanceExport.status"
            )

        if (
            history_export_rollout_blocked is not None
            and history_export_status
            and not _status_rollout_consistent(history_export_status, history_export_rollout_blocked)
        ):
            checks["history"]["statusRolloutConsistency"] = False
            errors.append(
                "Governance history artifact governanceExport rolloutBlocked is inconsistent with status"
            )
        history_totals_event_count = None
        history_totals = history_payload.get("totals")
        history_totals_sendgrid_event_count = None
        history_totals_sendgrid_anomaly_count_total = None
        if isinstance(history_totals, dict):
            history_totals_event_count = _coerce_non_negative_int(
                history_totals.get("connectorRateLimitEventCount")
            )
            history_totals_sendgrid_event_count = _coerce_non_negative_int(
                history_totals.get("sendgridWebhookTimestampEventCount")
            )
            history_totals_sendgrid_anomaly_count_total = _coerce_non_negative_int(
                history_totals.get("sendgridWebhookTimestampAnomalyCountTotal")
            )
        _validate_connector_pressure_parity_payload(
            history_payload.get("connectorPressureParity"),
            "Governance history artifact",
            checks["history"],
            errors,
            history_connector_rate_limit,
            history_export_connector_rate_limit,
            history_totals_event_count,
        )
        _validate_sendgrid_webhook_timestamp_parity_payload(
            history_payload.get("sendgridWebhookTimestampParity"),
            "Governance history artifact",
            checks["history"],
            errors,
            history_sendgrid_webhook_timestamp,
            history_export_sendgrid_webhook_timestamp,
            history_totals_sendgrid_event_count,
            history_totals_sendgrid_anomaly_count_total,
        )

    if handoff_export_status and history_export_status and handoff_export_status != history_export_status:
        checks["crossArtifact"]["statusConsistency"] = False
        errors.append(
            "Governance handoff/history export statuses are inconsistent"
        )

    if (
        handoff_export_rollout_blocked is not None
        and history_export_rollout_blocked is not None
        and handoff_export_rollout_blocked != history_export_rollout_blocked
    ):
        checks["crossArtifact"]["rolloutBlockedConsistency"] = False
        errors.append(
            "Governance handoff/history rolloutBlocked values are inconsistent"
        )
    if (
        handoff_export_schema_version is not None
        and history_export_schema_version is not None
        and handoff_export_schema_version != history_export_schema_version
    ):
        checks["crossArtifact"]["exportSchemaVersionConsistency"] = False
        errors.append(
            "Governance handoff/history exportSchemaVersion values are inconsistent"
        )
    if (
        isinstance(handoff_reason_codes, list)
        and isinstance(history_reason_codes, list)
        and len(handoff_reason_codes) != len(history_reason_codes)
    ):
        checks["crossArtifact"]["reasonCodeCountConsistency"] = False
        errors.append(
            "Governance handoff/history reasonCodeCount values are inconsistent"
        )
    if (
        isinstance(handoff_recommended_commands, list)
        and isinstance(history_recommended_commands, list)
        and len(handoff_recommended_commands) != len(history_recommended_commands)
    ):
        checks["crossArtifact"]["recommendedCommandCountConsistency"] = False
        errors.append(
            "Governance handoff/history recommendedCommandCount values are inconsistent"
        )
    if (
        isinstance(handoff_runtime_prereqs, dict)
        and isinstance(history_runtime_prereqs, dict)
        and handoff_runtime_prereqs.get("missingCheckCount")
        != history_runtime_prereqs.get("missingCheckCount")
    ):
        checks["crossArtifact"]["runtimePrereqsMissingCheckCountConsistency"] = False
        errors.append(
            "Governance handoff/history runtimePrereqs missingCheckCount values are inconsistent"
        )
    if (
        isinstance(handoff_command_aliases, dict)
        and isinstance(history_command_aliases, dict)
        and handoff_command_aliases.get("missingAliasCount")
        != history_command_aliases.get("missingAliasCount")
    ):
        checks["crossArtifact"]["commandAliasesMissingAliasCountConsistency"] = False
        errors.append(
            "Governance handoff/history commandAliases missingAliasCount values are inconsistent"
        )
    if (
        isinstance(handoff_command_aliases, dict)
        and isinstance(history_command_aliases, dict)
        and handoff_command_aliases.get("mismatchedAliasCount")
        != history_command_aliases.get("mismatchedAliasCount")
    ):
        checks["crossArtifact"]["commandAliasesMismatchedAliasCountConsistency"] = False
        errors.append(
            "Governance handoff/history commandAliases mismatchedAliasCount values are inconsistent"
        )
    if (
        isinstance(handoff_command_aliases, dict)
        and isinstance(history_command_aliases, dict)
        and _is_non_empty_string(handoff_command_aliases.get("command"))
        and _is_non_empty_string(history_command_aliases.get("command"))
        and handoff_command_aliases.get("command")
        != history_command_aliases.get("command")
    ):
        checks["crossArtifact"]["commandAliasesCommandConsistency"] = False
        errors.append(
            "Governance handoff/history commandAliases.command values are inconsistent"
        )
    if (
        isinstance(handoff_sendgrid_webhook_timestamp, dict)
        and isinstance(history_sendgrid_webhook_timestamp, dict)
        and handoff_sendgrid_webhook_timestamp.get("eventCount")
        != history_sendgrid_webhook_timestamp.get("eventCount")
    ):
        checks["crossArtifact"]["sendgridWebhookTimestampEventCountConsistency"] = False
        errors.append(
            "Governance handoff/history sendgridWebhookTimestamp.eventCount values are inconsistent"
        )
    if (
        isinstance(handoff_sendgrid_webhook_timestamp, dict)
        and isinstance(history_sendgrid_webhook_timestamp, dict)
        and handoff_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
        != history_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
    ):
        checks["crossArtifact"]["sendgridWebhookTimestampAnomalyCountConsistency"] = False
        errors.append(
            "Governance handoff/history sendgridWebhookTimestamp.timestampAnomalyCountTotal values are inconsistent"
        )

    return {
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "errors": errors,
        "valid": len(errors) == 0,
    }


def main():
    args = parse_args()
    load_errors: List[str] = []
    handoff_payload = _load_json_object(args.handoff, "Governance handoff", load_errors)
    history_payload = _load_json_object(args.history, "Governance history", load_errors)

    validation = validate_governance_packet_artifacts(handoff_payload, history_payload)
    validation["errors"] = load_errors + validation.get("errors", [])
    validation["valid"] = len(validation.get("errors", [])) == 0

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(validation, f, indent=2)

    print(json.dumps(validation, indent=2))
    return 0 if validation.get("valid") else 1


if __name__ == "__main__":
    raise SystemExit(main())
