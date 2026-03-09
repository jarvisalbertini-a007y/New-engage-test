#!/usr/bin/env python3
"""
Validate connector canary evidence + signoff artifacts before rollout expansion.

Usage:
  python backend/scripts/validate_connector_signoff_bundle.py \
    --evidence backend/test_reports/connector_canary_evidence.json \
    --signoff backend/test_reports/connector_signoff.md \
    --artifacts-dir backend/test_reports \
    --output backend/test_reports/connector_signoff_validation.json
"""

import argparse
import json
import os
from datetime import datetime, timezone

REQUIRED_SCHEMA_TRACEABILITY_MARKERS = [
    "schemaCoverage.thresholdPct",
    "schemaCoverage.observedPct",
    "schemaCoverage.sampleCount",
    "schemaCoverage.minSampleCount",
    "gates.schemaCoveragePassed",
    "gates.schemaSampleSizePassed",
    "gates.orchestrationAttemptErrorPassed",
    "gates.orchestrationAttemptSkippedPassed",
    "orchestrationAudit.maxAttemptErrorCountThreshold",
    "orchestrationAudit.observedAttemptErrorCount",
    "orchestrationAudit.maxAttemptSkippedCountThreshold",
    "orchestrationAudit.observedAttemptSkippedCount",
]

GOVERNANCE_HANDOFF_EVIDENCE_FILE = "governance_handoff_export.json"
GOVERNANCE_HISTORY_EVIDENCE_FILE = "governance_history_export.json"
GOVERNANCE_PACKET_VALIDATION_EVIDENCE_FILE = "governance_packet_validation.json"
GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS = float(
    os.environ.get("GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS", "168")
)
SUPPORTED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS = {1}
GOVERNANCE_EXPORT_SCHEMA_ENV_VAR = "GOVERNANCE_EXPORT_SCHEMA_VERSION"


def _governance_schema_remediation_hint() -> str:
    return (
        "Regenerate governance packet artifacts with "
        "`npm run verify:governance:packet:fixture` and "
        "`npm run verify:governance:packet:validate`, then run "
        "`npm run verify:governance:schema:preflight`."
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Validate connector signoff bundle")
    parser.add_argument("--evidence", required=True, help="Path to canary evidence JSON")
    parser.add_argument("--signoff", required=True, help="Path to signoff markdown")
    parser.add_argument(
        "--artifacts-dir",
        default="backend/test_reports",
        help="Directory containing evidence/signoff artifacts",
    )
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector_signoff_validation.json",
        help="Path to output validation JSON",
    )
    return parser.parse_args()


def _load_evidence(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_signoff_markdown(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _is_non_empty_string(value):
    return isinstance(value, str) and bool(value.strip())


def _coerce_non_negative_int(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _normalize_reason_code(value):
    if not _is_non_empty_string(value):
        return ""
    normalized = "".join(
        ch if ch.isalnum() else "_" for ch in str(value).strip().lower()
    ).strip("_")
    return normalized


def _normalize_reason_codes(value):
    if not isinstance(value, list):
        return None
    normalized = []
    for item in value:
        reason_code = _normalize_reason_code(item)
        if reason_code and reason_code not in normalized:
            normalized.append(reason_code)
    return normalized


def _normalize_recommended_commands(value):
    if not isinstance(value, list):
        return None
    normalized = []
    for item in value:
        if not _is_non_empty_string(item):
            continue
        command = str(item).strip()
        if command not in normalized:
            normalized.append(command)
    return normalized


def _validate_reason_and_command_parity(payload: dict, evidence_kind: str, context: str):
    context_prefix = f"{context}." if context else ""
    reason_codes = _normalize_reason_codes(payload.get("reasonCodes"))
    if not isinstance(reason_codes, list):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}reasonCodes must be a list",
            None,
            None,
        )
    reason_code_count = _coerce_non_negative_int(payload.get("reasonCodeCount"))
    if reason_code_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}reasonCodeCount must be a non-negative integer",
            None,
            None,
        )
    if reason_code_count != len(reason_codes):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}reasonCodeCount must match len(reasonCodes)",
            None,
            None,
        )

    recommended_commands = _normalize_recommended_commands(payload.get("recommendedCommands"))
    if not isinstance(recommended_commands, list):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}recommendedCommands must be a list",
            None,
            None,
        )
    recommended_command_count = _coerce_non_negative_int(
        payload.get("recommendedCommandCount")
    )
    if recommended_command_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}recommendedCommandCount must be a non-negative integer",
            None,
            None,
        )
    if recommended_command_count != len(recommended_commands):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}recommendedCommandCount must match len(recommendedCommands)",
            None,
            None,
        )

    return True, "", reason_codes, recommended_commands


def _normalize_connector_rate_limit_by_endpoint(value):
    if not isinstance(value, dict):
        return {}
    normalized = {}
    for endpoint, count in value.items():
        endpoint_key = str(endpoint or "").strip().lower()
        if not endpoint_key:
            endpoint_key = "unknown"
        normalized_count = _coerce_non_negative_int(count)
        if normalized_count is None:
            continue
        normalized[endpoint_key] = int(normalized.get(endpoint_key, 0)) + normalized_count
    return normalized


def _normalize_connector_pressure_label(value):
    if not _is_non_empty_string(value):
        return None
    return str(value).strip().lower()


def _is_optional_boolean(value):
    return value is None or isinstance(value, bool)


def _normalize_string_list(value):
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        if not _is_non_empty_string(item):
            continue
        token = str(item).strip()
        if token and token not in normalized:
            normalized.append(token)
    return normalized


def _normalize_optional_string(value):
    if not _is_non_empty_string(value):
        return None
    return str(value).strip()


def _validate_runtime_prereqs_payload(payload: dict, evidence_kind: str, context: str):
    context_prefix = f"{context}." if context else ""
    runtime_payload = payload.get("runtimePrereqs")
    if not isinstance(runtime_payload, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs must be an object",
            None,
        )
    missing_checks = runtime_payload.get("missingChecks")
    if not isinstance(missing_checks, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.missingChecks must be an object",
            None,
        )
    missing_commands_raw = missing_checks.get("commands")
    missing_workspace_raw = missing_checks.get("workspace")
    if not isinstance(missing_commands_raw, list) or not isinstance(missing_workspace_raw, list):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.missingChecks commands/workspace must be lists",
            None,
        )
    missing_commands = _normalize_string_list(missing_commands_raw)
    missing_workspace = _normalize_string_list(missing_workspace_raw)
    missing_check_count = _coerce_non_negative_int(runtime_payload.get("missingCheckCount"))
    if missing_check_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.missingCheckCount must be a non-negative integer",
            None,
        )
    if missing_check_count != len(missing_commands) + len(missing_workspace):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.missingCheckCount must match missingChecks command/workspace totals",
            None,
        )
    if not isinstance(runtime_payload.get("present"), bool):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.present must be boolean",
            None,
        )
    if not isinstance(runtime_payload.get("available"), bool):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.available must be boolean",
            None,
        )
    for field in ["passed", "contractValid", "valid"]:
        if not _is_optional_boolean(runtime_payload.get(field)):
            return (
                False,
                f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.{field} must be boolean or null",
                None,
            )
    command = _normalize_optional_string(runtime_payload.get("command"))
    if not command:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}runtimePrereqs.command must be a non-empty string",
            None,
        )

    return (
        True,
        "",
        {
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
            "artifactPath": _normalize_optional_string(runtime_payload.get("artifactPath")),
            "generatedAt": _normalize_optional_string(runtime_payload.get("generatedAt")),
            "validatedAt": _normalize_optional_string(runtime_payload.get("validatedAt")),
            "command": command,
        },
    )


def _validate_runtime_prereqs_totals_parity(
    payload: dict,
    evidence_kind: str,
    runtime_missing_check_count: int,
):
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing totals.runtimePrereqsMissingCheckCount",
        )
    totals_missing_check_count = _coerce_non_negative_int(
        totals.get("runtimePrereqsMissingCheckCount")
    )
    if totals_missing_check_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.runtimePrereqsMissingCheckCount must be a non-negative integer",
        )
    if totals_missing_check_count != runtime_missing_check_count:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.runtimePrereqsMissingCheckCount must match runtimePrereqs.missingCheckCount",
        )
    return True, ""


def _validate_command_aliases_payload(payload: dict, evidence_kind: str, context: str):
    context_prefix = f"{context}." if context else ""
    command_aliases_payload = payload.get("commandAliases")
    if not isinstance(command_aliases_payload, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases must be an object",
            None,
        )
    missing_aliases_raw = command_aliases_payload.get("missingAliases")
    mismatched_aliases_raw = command_aliases_payload.get("mismatchedAliases")
    if not isinstance(missing_aliases_raw, list) or not isinstance(
        mismatched_aliases_raw, list
    ):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases missing/mismatched aliases must be lists",
            None,
        )
    missing_aliases = _normalize_string_list(missing_aliases_raw)
    mismatched_aliases = _normalize_string_list(mismatched_aliases_raw)
    missing_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("missingAliasCount")
    )
    if missing_alias_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.missingAliasCount must be a non-negative integer",
            None,
        )
    mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("mismatchedAliasCount")
    )
    if mismatched_alias_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.mismatchedAliasCount must be a non-negative integer",
            None,
        )
    if missing_alias_count != len(missing_aliases):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.missingAliasCount must match len(commandAliases.missingAliases)",
            None,
        )
    if mismatched_alias_count != len(mismatched_aliases):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.mismatchedAliasCount must match len(commandAliases.mismatchedAliases)",
            None,
        )
    if not isinstance(command_aliases_payload.get("present"), bool):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.present must be boolean",
            None,
        )
    if not isinstance(command_aliases_payload.get("available"), bool):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.available must be boolean",
            None,
        )
    source = _normalize_optional_string(command_aliases_payload.get("source"))
    if not source:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.source must be a non-empty string",
            None,
        )
    for field in ["gatePassed", "contractValid", "valid"]:
        if not _is_optional_boolean(command_aliases_payload.get(field)):
            return (
                False,
                f"Governance {evidence_kind} evidence {context_prefix}commandAliases.{field} must be boolean or null",
                None,
            )
    command = _normalize_optional_string(command_aliases_payload.get("command"))
    if not command:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}commandAliases.command must be a non-empty string",
            None,
        )

    return (
        True,
        "",
        {
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
            "artifactPath": _normalize_optional_string(
                command_aliases_payload.get("artifactPath")
            ),
            "generatedAt": _normalize_optional_string(
                command_aliases_payload.get("generatedAt")
            ),
            "validatedAt": _normalize_optional_string(
                command_aliases_payload.get("validatedAt")
            ),
            "command": command,
        },
    )


def _validate_command_aliases_totals_parity(
    payload: dict,
    evidence_kind: str,
    command_aliases_summary: dict,
):
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing totals.commandAliasesMissingAliasCount",
        )
    totals_missing_alias_count = _coerce_non_negative_int(
        totals.get("commandAliasesMissingAliasCount")
    )
    if totals_missing_alias_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.commandAliasesMissingAliasCount must be a non-negative integer",
        )
    totals_mismatched_alias_count = _coerce_non_negative_int(
        totals.get("commandAliasesMismatchedAliasCount")
    )
    if totals_mismatched_alias_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.commandAliasesMismatchedAliasCount must be a non-negative integer",
        )
    if totals_missing_alias_count != command_aliases_summary.get("missingAliasCount"):
        return (
            False,
            f"Governance {evidence_kind} evidence totals.commandAliasesMissingAliasCount must match commandAliases.missingAliasCount",
        )
    if totals_mismatched_alias_count != command_aliases_summary.get("mismatchedAliasCount"):
        return (
            False,
            f"Governance {evidence_kind} evidence totals.commandAliasesMismatchedAliasCount must match commandAliases.mismatchedAliasCount",
        )
    return True, ""


def _build_connector_pressure_parity(top_level_connector, nested_connector, totals_event_count):
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


def _validate_connector_pressure_parity(
    payload: dict,
    evidence_kind: str,
    top_level_connector: dict,
    nested_connector: dict,
    totals_event_count: int,
):
    parity = payload.get("connectorPressureParity")
    if not isinstance(parity, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing connectorPressureParity payload",
        )
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
    missing_fields = [field for field in required_fields if field not in parity]
    if missing_fields:
        return (
            False,
            "Governance "
            + evidence_kind
            + " evidence connectorPressureParity is missing required fields: "
            + ", ".join(missing_fields),
        )
    if not _is_non_empty_string(parity.get("computedAt")):
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity.computedAt is missing",
        )
    optional_boolean_fields = [
        "eventCountMatchesNested",
        "eventCountMatchesTotals",
        "byEndpointMatchesNested",
        "pressureLabelMatchesNested",
    ]
    for field in optional_boolean_fields:
        if not _is_optional_boolean(parity.get(field)):
            return (
                False,
                f"Governance {evidence_kind} evidence connectorPressureParity.{field} must be boolean or null",
            )

    expected = _build_connector_pressure_parity(
        top_level_connector,
        nested_connector,
        totals_event_count,
    )
    normalized_top_level = _normalize_connector_rate_limit_by_endpoint(
        parity.get("normalizedTopLevelByEndpoint")
    )
    normalized_nested = _normalize_connector_rate_limit_by_endpoint(
        parity.get("normalizedNestedByEndpoint")
    )

    if (
        _coerce_non_negative_int(parity.get("topLevelEventCount")) != expected["topLevelEventCount"]
        or _coerce_non_negative_int(parity.get("nestedEventCount")) != expected["nestedEventCount"]
        or _coerce_non_negative_int(parity.get("totalsEventCount")) != expected["totalsEventCount"]
        or parity.get("eventCountMatchesNested") != expected["eventCountMatchesNested"]
        or parity.get("eventCountMatchesTotals") != expected["eventCountMatchesTotals"]
        or parity.get("byEndpointMatchesNested") != expected["byEndpointMatchesNested"]
        or parity.get("pressureLabelMatchesNested") != expected["pressureLabelMatchesNested"]
        or normalized_top_level != expected["normalizedTopLevelByEndpoint"]
        or normalized_nested != expected["normalizedNestedByEndpoint"]
    ):
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity fields are inconsistent with connectorRateLimit payload parity",
        )
    if parity.get("eventCountMatchesNested") is not True:
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity.eventCountMatchesNested must be true",
        )
    if parity.get("eventCountMatchesTotals") is not True:
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity.eventCountMatchesTotals must be true",
        )
    if parity.get("byEndpointMatchesNested") is not True:
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity.byEndpointMatchesNested must be true",
        )
    if parity.get("pressureLabelMatchesNested") is not True:
        return (
            False,
            f"Governance {evidence_kind} evidence connectorPressureParity.pressureLabelMatchesNested must be true",
        )
    return True, ""


def _normalize_sendgrid_timestamp_token(value, fallback: str = "unknown"):
    if not _is_non_empty_string(value):
        return fallback
    normalized = "".join(
        ch if ch.isalnum() else "_" for ch in str(value).strip().lower()
    ).strip("_")
    return normalized or fallback


def _normalize_sendgrid_timestamp_count_map(value):
    if not isinstance(value, dict):
        return {}
    normalized = {}
    for key, count in value.items():
        token = _normalize_sendgrid_timestamp_token(key)
        normalized_count = _coerce_non_negative_int(count)
        if normalized_count is None:
            continue
        normalized[token] = int(normalized.get(token, 0)) + normalized_count
    return normalized


def _normalize_sendgrid_latest_event_at(value):
    if not _is_non_empty_string(value):
        return None
    return str(value).strip()


def _normalize_sendgrid_webhook_timestamp_payload(payload):
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


def _maps_equal_or_none(top_level_map, nested_map):
    if top_level_map or nested_map:
        return top_level_map == nested_map
    return None


def _build_sendgrid_webhook_timestamp_parity(
    top_level_sendgrid,
    nested_sendgrid,
    totals_event_count,
    totals_anomaly_count_total,
):
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


def _validate_sendgrid_webhook_timestamp_payload(payload: dict, evidence_kind: str, context: str):
    context_prefix = f"{context} " if context else ""
    sendgrid_payload = payload.get("sendgridWebhookTimestamp")
    if not isinstance(sendgrid_payload, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}is missing sendgridWebhookTimestamp payload",
            None,
        )
    event_count = _coerce_non_negative_int(sendgrid_payload.get("eventCount"))
    anomaly_count_total = _coerce_non_negative_int(
        sendgrid_payload.get("timestampAnomalyCountTotal")
    )
    pressure_label_counts = sendgrid_payload.get("pressureLabelCounts")
    pressure_hint_counts = sendgrid_payload.get("pressureHintCounts")
    age_bucket_counts = sendgrid_payload.get("timestampAgeBucketCounts")
    anomaly_event_type_counts = sendgrid_payload.get("timestampAnomalyEventTypeCounts")
    latest_event_at = sendgrid_payload.get("latestEventAt")
    if (
        event_count is None
        or anomaly_count_total is None
        or not isinstance(pressure_label_counts, dict)
        or not isinstance(pressure_hint_counts, dict)
        or not isinstance(age_bucket_counts, dict)
        or not isinstance(anomaly_event_type_counts, dict)
        or (
            latest_event_at is not None
            and (
                not isinstance(latest_event_at, str)
                or not latest_event_at.strip()
            )
        )
    ):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}sendgridWebhookTimestamp must include non-negative event/anomaly totals, count-map objects with non-negative counts, and optional latestEventAt string",
            None,
        )
    normalized = _normalize_sendgrid_webhook_timestamp_payload(sendgrid_payload)
    return (
        True,
        "",
        {
            "eventCount": normalized.get("eventCount", 0),
            "timestampAnomalyCountTotal": normalized.get("timestampAnomalyCountTotal", 0),
            "pressureLabelCounts": normalized.get("pressureLabelCounts", {}),
            "pressureHintCounts": normalized.get("pressureHintCounts", {}),
            "timestampAgeBucketCounts": normalized.get("timestampAgeBucketCounts", {}),
            "timestampAnomalyEventTypeCounts": normalized.get(
                "timestampAnomalyEventTypeCounts",
                {},
            ),
            "latestEventAt": normalized.get("latestEventAt"),
        },
    )


def _validate_sendgrid_webhook_timestamp_totals_parity(
    payload: dict,
    evidence_kind: str,
    sendgrid_event_count: int,
    sendgrid_anomaly_count_total: int,
):
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing totals.sendgridWebhookTimestampEventCount",
            None,
            None,
        )
    totals_event_count = _coerce_non_negative_int(
        totals.get("sendgridWebhookTimestampEventCount")
    )
    if totals_event_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.sendgridWebhookTimestampEventCount must be a non-negative integer",
            None,
            None,
        )
    totals_anomaly_count_total = _coerce_non_negative_int(
        totals.get("sendgridWebhookTimestampAnomalyCountTotal")
    )
    if totals_anomaly_count_total is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.sendgridWebhookTimestampAnomalyCountTotal must be a non-negative integer",
            None,
            None,
        )
    if totals_event_count != sendgrid_event_count:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.sendgridWebhookTimestampEventCount must match sendgridWebhookTimestamp.eventCount",
            None,
            None,
        )
    if totals_anomaly_count_total != sendgrid_anomaly_count_total:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.sendgridWebhookTimestampAnomalyCountTotal must match sendgridWebhookTimestamp.timestampAnomalyCountTotal",
            None,
            None,
        )
    return True, "", totals_event_count, totals_anomaly_count_total


def _validate_sendgrid_webhook_timestamp_parity(
    payload: dict,
    evidence_kind: str,
    top_level_sendgrid: dict,
    nested_sendgrid: dict,
    totals_event_count: int,
    totals_anomaly_count_total: int,
):
    parity = payload.get("sendgridWebhookTimestampParity")
    if not isinstance(parity, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing sendgridWebhookTimestampParity payload",
        )
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
    missing_fields = [field for field in required_fields if field not in parity]
    if missing_fields:
        return (
            False,
            "Governance "
            + evidence_kind
            + " evidence sendgridWebhookTimestampParity is missing required fields: "
            + ", ".join(missing_fields),
        )
    if not _is_non_empty_string(parity.get("computedAt")):
        return (
            False,
            f"Governance {evidence_kind} evidence sendgridWebhookTimestampParity.computedAt is missing",
        )
    optional_boolean_fields = [
        "eventCountMatchesNested",
        "eventCountMatchesTotals",
        "anomalyCountTotalMatchesNested",
        "anomalyCountTotalMatchesTotals",
        "pressureLabelCountsMatchNested",
        "pressureHintCountsMatchNested",
        "ageBucketCountsMatchNested",
        "anomalyEventTypeCountsMatchNested",
        "latestEventAtMatchesNested",
    ]
    for field in optional_boolean_fields:
        if not _is_optional_boolean(parity.get(field)):
            return (
                False,
                f"Governance {evidence_kind} evidence sendgridWebhookTimestampParity.{field} must be boolean or null",
            )

    expected = _build_sendgrid_webhook_timestamp_parity(
        top_level_sendgrid,
        nested_sendgrid,
        totals_event_count,
        totals_anomaly_count_total,
    )

    if (
        _coerce_non_negative_int(parity.get("topLevelEventCount")) != expected["topLevelEventCount"]
        or _coerce_non_negative_int(parity.get("nestedEventCount")) != expected["nestedEventCount"]
        or _coerce_non_negative_int(parity.get("totalsEventCount")) != expected["totalsEventCount"]
        or _coerce_non_negative_int(parity.get("topLevelAnomalyCountTotal"))
        != expected["topLevelAnomalyCountTotal"]
        or _coerce_non_negative_int(parity.get("nestedAnomalyCountTotal"))
        != expected["nestedAnomalyCountTotal"]
        or _coerce_non_negative_int(parity.get("totalsAnomalyCountTotal"))
        != expected["totalsAnomalyCountTotal"]
        or parity.get("eventCountMatchesNested") != expected["eventCountMatchesNested"]
        or parity.get("eventCountMatchesTotals") != expected["eventCountMatchesTotals"]
        or parity.get("anomalyCountTotalMatchesNested")
        != expected["anomalyCountTotalMatchesNested"]
        or parity.get("anomalyCountTotalMatchesTotals")
        != expected["anomalyCountTotalMatchesTotals"]
        or parity.get("pressureLabelCountsMatchNested")
        != expected["pressureLabelCountsMatchNested"]
        or parity.get("pressureHintCountsMatchNested")
        != expected["pressureHintCountsMatchNested"]
        or parity.get("ageBucketCountsMatchNested") != expected["ageBucketCountsMatchNested"]
        or parity.get("anomalyEventTypeCountsMatchNested")
        != expected["anomalyEventTypeCountsMatchNested"]
        or parity.get("latestEventAtMatchesNested") != expected["latestEventAtMatchesNested"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedTopLevelPressureLabelCounts")
        )
        != expected["normalizedTopLevelPressureLabelCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedNestedPressureLabelCounts")
        )
        != expected["normalizedNestedPressureLabelCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedTopLevelPressureHintCounts")
        )
        != expected["normalizedTopLevelPressureHintCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedNestedPressureHintCounts")
        )
        != expected["normalizedNestedPressureHintCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedTopLevelAgeBucketCounts")
        )
        != expected["normalizedTopLevelAgeBucketCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedNestedAgeBucketCounts")
        )
        != expected["normalizedNestedAgeBucketCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedTopLevelAnomalyEventTypeCounts")
        )
        != expected["normalizedTopLevelAnomalyEventTypeCounts"]
        or _normalize_sendgrid_timestamp_count_map(
            parity.get("normalizedNestedAnomalyEventTypeCounts")
        )
        != expected["normalizedNestedAnomalyEventTypeCounts"]
        or _normalize_sendgrid_latest_event_at(parity.get("normalizedLatestEventAtTopLevel"))
        != expected["normalizedLatestEventAtTopLevel"]
        or _normalize_sendgrid_latest_event_at(parity.get("normalizedLatestEventAtNested"))
        != expected["normalizedLatestEventAtNested"]
    ):
        return (
            False,
            f"Governance {evidence_kind} evidence sendgridWebhookTimestampParity fields are inconsistent with sendgridWebhookTimestamp payload parity",
        )
    required_true_fields = [
        "eventCountMatchesNested",
        "eventCountMatchesTotals",
        "anomalyCountTotalMatchesNested",
        "anomalyCountTotalMatchesTotals",
        "pressureLabelCountsMatchNested",
        "pressureHintCountsMatchNested",
        "ageBucketCountsMatchNested",
        "anomalyEventTypeCountsMatchNested",
    ]
    for field in required_true_fields:
        if parity.get(field) is not True:
            return (
                False,
                f"Governance {evidence_kind} evidence sendgridWebhookTimestampParity.{field} must be true",
            )
    return True, ""


def _contains_approved_role(signoff_md: str, role: str) -> bool:
    approved_markers = [
        f"- [x] {role}",
        f"- [X] {role}",
        f"{role}: APPROVED",
    ]
    return any(marker in signoff_md for marker in approved_markers)


def _validate_connector_rate_limit_payload(payload: dict, evidence_kind: str, context: str):
    context_prefix = f"{context} " if context else ""
    connector_rate_limit = payload.get("connectorRateLimit")
    if not isinstance(connector_rate_limit, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}is missing connectorRateLimit payload",
            None,
        )
    event_count = connector_rate_limit.get("eventCount")
    if not isinstance(event_count, int) or event_count < 0:
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}connectorRateLimit.eventCount must be a non-negative integer",
            None,
        )
    by_endpoint = connector_rate_limit.get("byEndpoint")
    if not isinstance(by_endpoint, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}connectorRateLimit.byEndpoint must be an object",
            None,
        )
    for count in by_endpoint.values():
        if _coerce_non_negative_int(count) is None:
            return (
                False,
                f"Governance {evidence_kind} evidence {context_prefix}connectorRateLimit.byEndpoint must include non-negative integer counts",
                None,
            )
    pressure = connector_rate_limit.get("pressure")
    pressure_label = pressure.get("label") if isinstance(pressure, dict) else None
    if not _is_non_empty_string(pressure_label):
        return (
            False,
            f"Governance {evidence_kind} evidence {context_prefix}connectorRateLimit.pressure.label is missing",
            None,
        )
    return True, "", connector_rate_limit


def _validate_connector_rate_limit_totals_parity(
    payload: dict,
    evidence_kind: str,
    connector_event_count: int,
):
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing totals.connectorRateLimitEventCount",
            None,
        )
    totals_event_count = _coerce_non_negative_int(totals.get("connectorRateLimitEventCount"))
    if totals_event_count is None:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.connectorRateLimitEventCount must be a non-negative integer",
            None,
        )
    if totals_event_count != connector_event_count:
        return (
            False,
            f"Governance {evidence_kind} evidence totals.connectorRateLimitEventCount must match connectorRateLimit.eventCount",
            totals_event_count,
        )
    return True, "", totals_event_count


def _validate_governance_attachment(file_path: str, evidence_kind: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return False, f"Governance {evidence_kind} evidence is not valid JSON", None
    if not isinstance(payload, dict):
        return False, f"Governance {evidence_kind} evidence must be a JSON object", None
    if not isinstance(payload.get("status"), str) or not payload.get("status", "").strip():
        return False, f"Governance {evidence_kind} evidence is missing status", None

    schema_version = payload.get("exportSchemaVersion")
    if not isinstance(schema_version, int):
        return (
            False,
            f"Governance {evidence_kind} evidence is missing exportSchemaVersion. {_governance_schema_remediation_hint()}",
            None,
        )
    if schema_version not in SUPPORTED_GOVERNANCE_EXPORT_SCHEMA_VERSIONS:
        return (
            False,
            f"Governance {evidence_kind} evidence exportSchemaVersion={schema_version} is unsupported. {_governance_schema_remediation_hint()}",
            None,
        )
    (
        parity_valid,
        parity_message,
        top_level_reason_codes,
        top_level_recommended_commands,
    ) = _validate_reason_and_command_parity(payload, evidence_kind, "")
    if not parity_valid:
        return False, parity_message, None
    valid, message, top_level_connector = _validate_connector_rate_limit_payload(
        payload,
        evidence_kind,
        "",
    )
    if not valid:
        return False, message, None
    top_level_event_count = top_level_connector.get("eventCount")
    totals_valid, totals_message, totals_event_count = _validate_connector_rate_limit_totals_parity(
        payload,
        evidence_kind,
        top_level_event_count,
    )
    if not totals_valid:
        return False, totals_message, None
    (
        sendgrid_valid,
        sendgrid_message,
        top_level_sendgrid_webhook_timestamp,
    ) = _validate_sendgrid_webhook_timestamp_payload(
        payload,
        evidence_kind,
        "",
    )
    if not sendgrid_valid:
        return False, sendgrid_message, None
    (
        sendgrid_totals_valid,
        sendgrid_totals_message,
        sendgrid_totals_event_count,
        sendgrid_totals_anomaly_count_total,
    ) = _validate_sendgrid_webhook_timestamp_totals_parity(
        payload,
        evidence_kind,
        top_level_sendgrid_webhook_timestamp.get("eventCount"),
        top_level_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal"),
    )
    if not sendgrid_totals_valid:
        return False, sendgrid_totals_message, None

    if evidence_kind == "handoff":
        nested_connector = None
        governance_export = payload.get("governanceExport")
        if not isinstance(governance_export, dict):
            return (
                False,
                "Governance handoff evidence is missing governanceExport payload",
                None,
            )
        nested_schema_version = governance_export.get("exportSchemaVersion")
        if not isinstance(nested_schema_version, int):
            return (
                False,
                f"Governance handoff evidence governanceExport is missing exportSchemaVersion. {_governance_schema_remediation_hint()}",
                None,
            )
        if nested_schema_version != schema_version:
            return (
                False,
                f"Governance handoff evidence exportSchemaVersion mismatch ({schema_version} != {nested_schema_version}). {_governance_schema_remediation_hint()}",
                None,
            )
        (
            nested_parity_valid,
            nested_parity_message,
            nested_reason_codes,
            nested_recommended_commands,
        ) = _validate_reason_and_command_parity(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_parity_valid:
            return False, nested_parity_message, None
        if top_level_reason_codes != nested_reason_codes:
            return (
                False,
                "Governance handoff evidence reasonCodes must match governanceExport.reasonCodes",
                None,
            )
        if top_level_recommended_commands != nested_recommended_commands:
            return (
                False,
                "Governance handoff evidence recommendedCommands must match governanceExport.recommendedCommands",
                None,
            )
        valid, message, nested_connector = _validate_connector_rate_limit_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not valid:
            return False, message, None
        if top_level_connector.get("eventCount") != nested_connector.get("eventCount"):
            return (
                False,
                "Governance handoff evidence connectorRateLimit.eventCount must match governanceExport.connectorRateLimit.eventCount",
                None,
            )
        top_level_pressure = top_level_connector.get("pressure")
        nested_pressure = nested_connector.get("pressure")
        top_level_label = (
            top_level_pressure.get("label")
            if isinstance(top_level_pressure, dict)
            else None
        )
        nested_label = (
            nested_pressure.get("label") if isinstance(nested_pressure, dict) else None
        )
        if top_level_label != nested_label:
            return (
                False,
                "Governance handoff evidence connectorRateLimit.pressure.label must match governanceExport.connectorRateLimit.pressure.label",
                None,
            )
        if _normalize_connector_rate_limit_by_endpoint(
            top_level_connector.get("byEndpoint")
        ) != _normalize_connector_rate_limit_by_endpoint(
            nested_connector.get("byEndpoint")
        ):
            return (
                False,
                "Governance handoff evidence connectorRateLimit.byEndpoint must match governanceExport.connectorRateLimit.byEndpoint",
                None,
            )
        parity_valid, parity_message = _validate_connector_pressure_parity(
            payload,
            evidence_kind,
            top_level_connector,
            nested_connector,
            totals_event_count,
        )
        if not parity_valid:
            return False, parity_message, None
        (
            runtime_valid,
            runtime_message,
            top_level_runtime_prereqs,
        ) = _validate_runtime_prereqs_payload(payload, evidence_kind, "")
        if not runtime_valid:
            return False, runtime_message, None
        runtime_totals_valid, runtime_totals_message = _validate_runtime_prereqs_totals_parity(
            payload,
            evidence_kind,
            top_level_runtime_prereqs.get("missingCheckCount"),
        )
        if not runtime_totals_valid:
            return False, runtime_totals_message, None
        (
            command_aliases_valid,
            command_aliases_message,
            top_level_command_aliases,
        ) = _validate_command_aliases_payload(payload, evidence_kind, "")
        if not command_aliases_valid:
            return False, command_aliases_message, None
        command_aliases_totals_valid, command_aliases_totals_message = (
            _validate_command_aliases_totals_parity(
                payload,
                evidence_kind,
                top_level_command_aliases,
            )
        )
        if not command_aliases_totals_valid:
            return False, command_aliases_totals_message, None
        (
            nested_runtime_valid,
            nested_runtime_message,
            nested_runtime_prereqs,
        ) = _validate_runtime_prereqs_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_runtime_valid:
            return False, nested_runtime_message, None
        if top_level_runtime_prereqs != nested_runtime_prereqs:
            return (
                False,
                "Governance handoff evidence runtimePrereqs must match governanceExport.runtimePrereqs",
                None,
            )
        (
            nested_command_aliases_valid,
            nested_command_aliases_message,
            nested_command_aliases,
        ) = _validate_command_aliases_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_command_aliases_valid:
            return False, nested_command_aliases_message, None
        if top_level_command_aliases != nested_command_aliases:
            return (
                False,
                "Governance handoff evidence commandAliases must match governanceExport.commandAliases",
                None,
            )
        (
            nested_sendgrid_valid,
            nested_sendgrid_message,
            nested_sendgrid_webhook_timestamp,
        ) = _validate_sendgrid_webhook_timestamp_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_sendgrid_valid:
            return False, nested_sendgrid_message, None
        if (
            top_level_sendgrid_webhook_timestamp.get("eventCount")
            != nested_sendgrid_webhook_timestamp.get("eventCount")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.eventCount must match governanceExport.sendgridWebhookTimestamp.eventCount",
                None,
            )
        if (
            top_level_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
            != nested_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.timestampAnomalyCountTotal must match governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.pressureLabelCounts must match governanceExport.sendgridWebhookTimestamp.pressureLabelCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("pressureHintCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("pressureHintCounts")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.pressureHintCounts must match governanceExport.sendgridWebhookTimestamp.pressureHintCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.timestampAgeBucketCounts must match governanceExport.sendgridWebhookTimestamp.timestampAgeBucketCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("timestampAnomalyEventTypeCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("timestampAnomalyEventTypeCounts")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts must match governanceExport.sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts",
                None,
            )
        if _normalize_sendgrid_latest_event_at(
            top_level_sendgrid_webhook_timestamp.get("latestEventAt")
        ) != _normalize_sendgrid_latest_event_at(
            nested_sendgrid_webhook_timestamp.get("latestEventAt")
        ):
            return (
                False,
                "Governance handoff evidence sendgridWebhookTimestamp.latestEventAt must match governanceExport.sendgridWebhookTimestamp.latestEventAt",
                None,
            )
        sendgrid_parity_valid, sendgrid_parity_message = (
            _validate_sendgrid_webhook_timestamp_parity(
                payload,
                evidence_kind,
                top_level_sendgrid_webhook_timestamp,
                nested_sendgrid_webhook_timestamp,
                sendgrid_totals_event_count,
                sendgrid_totals_anomaly_count_total,
            )
        )
        if not sendgrid_parity_valid:
            return False, sendgrid_parity_message, None
    if evidence_kind == "history":
        nested_connector = None
        governance_export = payload.get("governanceExport")
        if not isinstance(governance_export, dict):
            return (
                False,
                "Governance history evidence is missing governanceExport payload",
                None,
            )
        nested_schema_version = governance_export.get("exportSchemaVersion")
        if not isinstance(nested_schema_version, int):
            return (
                False,
                f"Governance history evidence governanceExport is missing exportSchemaVersion. {_governance_schema_remediation_hint()}",
                None,
            )
        if nested_schema_version != schema_version:
            return (
                False,
                f"Governance history evidence exportSchemaVersion mismatch ({schema_version} != {nested_schema_version}). {_governance_schema_remediation_hint()}",
                None,
            )
        (
            nested_parity_valid,
            nested_parity_message,
            nested_reason_codes,
            nested_recommended_commands,
        ) = _validate_reason_and_command_parity(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_parity_valid:
            return False, nested_parity_message, None
        if top_level_reason_codes != nested_reason_codes:
            return (
                False,
                "Governance history evidence reasonCodes must match governanceExport.reasonCodes",
                None,
            )
        if top_level_recommended_commands != nested_recommended_commands:
            return (
                False,
                "Governance history evidence recommendedCommands must match governanceExport.recommendedCommands",
                None,
            )
        valid, message, nested_connector = _validate_connector_rate_limit_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not valid:
            return False, message, None
        if top_level_connector.get("eventCount") != nested_connector.get("eventCount"):
            return (
                False,
                "Governance history evidence connectorRateLimit.eventCount must match governanceExport.connectorRateLimit.eventCount",
                None,
            )
        top_level_pressure = top_level_connector.get("pressure")
        nested_pressure = nested_connector.get("pressure")
        top_level_label = (
            top_level_pressure.get("label")
            if isinstance(top_level_pressure, dict)
            else None
        )
        nested_label = (
            nested_pressure.get("label")
            if isinstance(nested_pressure, dict)
            else None
        )
        if top_level_label != nested_label:
            return (
                False,
                "Governance history evidence connectorRateLimit.pressure.label must match governanceExport.connectorRateLimit.pressure.label",
                None,
            )
        if _normalize_connector_rate_limit_by_endpoint(
            top_level_connector.get("byEndpoint")
        ) != _normalize_connector_rate_limit_by_endpoint(
            nested_connector.get("byEndpoint")
        ):
            return (
                False,
                "Governance history evidence connectorRateLimit.byEndpoint must match governanceExport.connectorRateLimit.byEndpoint",
                None,
            )
        parity_valid, parity_message = _validate_connector_pressure_parity(
            payload,
            evidence_kind,
            top_level_connector,
            nested_connector,
            totals_event_count,
        )
        if not parity_valid:
            return False, parity_message, None
        (
            runtime_valid,
            runtime_message,
            top_level_runtime_prereqs,
        ) = _validate_runtime_prereqs_payload(payload, evidence_kind, "")
        if not runtime_valid:
            return False, runtime_message, None
        runtime_totals_valid, runtime_totals_message = _validate_runtime_prereqs_totals_parity(
            payload,
            evidence_kind,
            top_level_runtime_prereqs.get("missingCheckCount"),
        )
        if not runtime_totals_valid:
            return False, runtime_totals_message, None
        (
            command_aliases_valid,
            command_aliases_message,
            top_level_command_aliases,
        ) = _validate_command_aliases_payload(payload, evidence_kind, "")
        if not command_aliases_valid:
            return False, command_aliases_message, None
        command_aliases_totals_valid, command_aliases_totals_message = (
            _validate_command_aliases_totals_parity(
                payload,
                evidence_kind,
                top_level_command_aliases,
            )
        )
        if not command_aliases_totals_valid:
            return False, command_aliases_totals_message, None
        (
            nested_runtime_valid,
            nested_runtime_message,
            nested_runtime_prereqs,
        ) = _validate_runtime_prereqs_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_runtime_valid:
            return False, nested_runtime_message, None
        if top_level_runtime_prereqs != nested_runtime_prereqs:
            return (
                False,
                "Governance history evidence runtimePrereqs must match governanceExport.runtimePrereqs",
                None,
            )
        (
            nested_command_aliases_valid,
            nested_command_aliases_message,
            nested_command_aliases,
        ) = _validate_command_aliases_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_command_aliases_valid:
            return False, nested_command_aliases_message, None
        if top_level_command_aliases != nested_command_aliases:
            return (
                False,
                "Governance history evidence commandAliases must match governanceExport.commandAliases",
                None,
            )
        (
            nested_sendgrid_valid,
            nested_sendgrid_message,
            nested_sendgrid_webhook_timestamp,
        ) = _validate_sendgrid_webhook_timestamp_payload(
            governance_export,
            evidence_kind,
            "governanceExport",
        )
        if not nested_sendgrid_valid:
            return False, nested_sendgrid_message, None
        if (
            top_level_sendgrid_webhook_timestamp.get("eventCount")
            != nested_sendgrid_webhook_timestamp.get("eventCount")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.eventCount must match governanceExport.sendgridWebhookTimestamp.eventCount",
                None,
            )
        if (
            top_level_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
            != nested_sendgrid_webhook_timestamp.get("timestampAnomalyCountTotal")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.timestampAnomalyCountTotal must match governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("pressureLabelCounts")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.pressureLabelCounts must match governanceExport.sendgridWebhookTimestamp.pressureLabelCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("pressureHintCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("pressureHintCounts")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.pressureHintCounts must match governanceExport.sendgridWebhookTimestamp.pressureHintCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("timestampAgeBucketCounts")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.timestampAgeBucketCounts must match governanceExport.sendgridWebhookTimestamp.timestampAgeBucketCounts",
                None,
            )
        if _normalize_sendgrid_timestamp_count_map(
            top_level_sendgrid_webhook_timestamp.get("timestampAnomalyEventTypeCounts")
        ) != _normalize_sendgrid_timestamp_count_map(
            nested_sendgrid_webhook_timestamp.get("timestampAnomalyEventTypeCounts")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts must match governanceExport.sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts",
                None,
            )
        if _normalize_sendgrid_latest_event_at(
            top_level_sendgrid_webhook_timestamp.get("latestEventAt")
        ) != _normalize_sendgrid_latest_event_at(
            nested_sendgrid_webhook_timestamp.get("latestEventAt")
        ):
            return (
                False,
                "Governance history evidence sendgridWebhookTimestamp.latestEventAt must match governanceExport.sendgridWebhookTimestamp.latestEventAt",
                None,
            )
        sendgrid_parity_valid, sendgrid_parity_message = (
            _validate_sendgrid_webhook_timestamp_parity(
                payload,
                evidence_kind,
                top_level_sendgrid_webhook_timestamp,
                nested_sendgrid_webhook_timestamp,
                sendgrid_totals_event_count,
                sendgrid_totals_anomaly_count_total,
            )
        )
        if not sendgrid_parity_valid:
            return False, sendgrid_parity_message, None
        if not isinstance(payload.get("items"), list):
            return False, "Governance history evidence is missing items list", None
        for item in payload.get("items") or []:
            if not isinstance(item, dict):
                continue
            item_schema_version = item.get("exportSchemaVersion")
            if not isinstance(item_schema_version, int):
                return (
                    False,
                    f"Governance history evidence item is missing exportSchemaVersion. {_governance_schema_remediation_hint()}",
                    None,
                )
            if item_schema_version != schema_version:
                return (
                    False,
                    f"Governance history evidence item exportSchemaVersion mismatch ({schema_version} != {item_schema_version}). {_governance_schema_remediation_hint()}",
                    None,
                )
    return True, "", schema_version


def _extract_runtime_prereqs_summary(file_path: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    runtime_payload = payload.get("runtimePrereqs")
    if not isinstance(runtime_payload, dict):
        return None
    missing_check_count = _coerce_non_negative_int(runtime_payload.get("missingCheckCount"))
    if missing_check_count is None:
        return None
    command = _normalize_optional_string(runtime_payload.get("command"))
    return {
        "missingCheckCount": int(missing_check_count),
        "command": command,
    }


def _extract_command_aliases_summary(file_path: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    command_aliases_payload = payload.get("commandAliases")
    if not isinstance(command_aliases_payload, dict):
        return None
    missing_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("missingAliasCount")
    )
    mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("mismatchedAliasCount")
    )
    if missing_alias_count is None or mismatched_alias_count is None:
        return None
    command = _normalize_optional_string(command_aliases_payload.get("command"))
    return {
        "missingAliasCount": int(missing_alias_count),
        "mismatchedAliasCount": int(mismatched_alias_count),
        "command": command,
    }


def _extract_sendgrid_webhook_timestamp_summary(file_path: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    sendgrid_payload = payload.get("sendgridWebhookTimestamp")
    if not isinstance(sendgrid_payload, dict):
        return None
    event_count = _coerce_non_negative_int(sendgrid_payload.get("eventCount"))
    anomaly_count_total = _coerce_non_negative_int(
        sendgrid_payload.get("timestampAnomalyCountTotal")
    )
    if event_count is None or anomaly_count_total is None:
        return None
    return {
        "eventCount": int(event_count),
        "timestampAnomalyCountTotal": int(anomaly_count_total),
        "pressureLabelCounts": _normalize_sendgrid_timestamp_count_map(
            sendgrid_payload.get("pressureLabelCounts")
        ),
        "pressureHintCounts": _normalize_sendgrid_timestamp_count_map(
            sendgrid_payload.get("pressureHintCounts")
        ),
        "timestampAgeBucketCounts": _normalize_sendgrid_timestamp_count_map(
            sendgrid_payload.get("timestampAgeBucketCounts")
        ),
        "timestampAnomalyEventTypeCounts": _normalize_sendgrid_timestamp_count_map(
            sendgrid_payload.get("timestampAnomalyEventTypeCounts")
        ),
        "latestEventAt": _normalize_sendgrid_latest_event_at(
            sendgrid_payload.get("latestEventAt")
        ),
    }


def _validate_governance_packet_validation(file_path: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except (OSError, json.JSONDecodeError):
        return False, "Governance packet validation artifact is not valid JSON"

    if not isinstance(payload, dict):
        return False, "Governance packet validation artifact must be a JSON object"
    if payload.get("valid") is not True:
        return False, "Governance packet validation artifact must indicate valid=true"
    if not isinstance(payload.get("checks"), dict):
        return False, "Governance packet validation artifact is missing checks payload"
    if not isinstance(payload.get("errors"), list):
        return False, "Governance packet validation artifact is missing errors list"

    validated_at_raw = payload.get("validatedAt")
    if not isinstance(validated_at_raw, str) or not validated_at_raw.strip():
        return False, "Governance packet validation artifact is missing validatedAt timestamp"
    normalized = validated_at_raw.strip().replace("Z", "+00:00")
    try:
        validated_at = datetime.fromisoformat(normalized)
    except ValueError:
        return False, "Governance packet validation artifact validatedAt is not a valid ISO timestamp"
    if validated_at.tzinfo is None:
        validated_at = validated_at.replace(tzinfo=timezone.utc)
    validated_at = validated_at.astimezone(timezone.utc)
    age_hours = (datetime.now(timezone.utc) - validated_at).total_seconds() / 3600.0
    if age_hours < 0:
        return False, "Governance packet validation artifact validatedAt cannot be in the future"
    if age_hours > GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS:
        return (
            False,
            f"Governance packet validation artifact is stale (> {GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS:g}h)",
        )
    return True, ""


def _resolve_governance_env_schema_version():
    raw_value = os.environ.get(GOVERNANCE_EXPORT_SCHEMA_ENV_VAR)
    if raw_value is None:
        return {
            "isSet": False,
            "rawValue": None,
            "isValid": True,
            "expectedExportSchemaVersion": None,
        }
    normalized = str(raw_value).strip()
    try:
        parsed = int(normalized)
    except (TypeError, ValueError):
        return {
            "isSet": True,
            "rawValue": normalized,
            "isValid": False,
            "expectedExportSchemaVersion": None,
        }
    if parsed < 1:
        return {
            "isSet": True,
            "rawValue": normalized,
            "isValid": False,
            "expectedExportSchemaVersion": None,
        }
    return {
        "isSet": True,
        "rawValue": normalized,
        "isValid": True,
        "expectedExportSchemaVersion": parsed,
    }


def validate_signoff_bundle(evidence: dict, signoff_md: str, artifacts_dir: str):
    result = {
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "decision": (evidence.get("sloSummary") or {}).get("decision", "UNKNOWN"),
        "errors": [],
        "checks": {
            "requiredEvidenceFiles": [],
            "requiredApprovals": [],
            "schemaTraceability": [],
            "governanceEvidence": [],
            "governanceSchemaPreflight": {},
        },
    }

    slo = evidence.get("sloSummary") or {}
    signoff = slo.get("signoff") or {}
    required_evidence = signoff.get("requiredEvidence") or []
    required_approvals = signoff.get("requiredApprovals") or []
    governance_schema_versions = {}
    governance_runtime_prereqs = {}
    governance_command_aliases = {}
    governance_sendgrid_webhook_timestamp = {}

    for file_name in required_evidence:
        file_path = os.path.join(artifacts_dir, file_name)
        exists = os.path.exists(file_path)
        result["checks"]["requiredEvidenceFiles"].append(
            {
                "file": file_name,
                "path": file_path,
                "exists": exists,
            }
        )
        if not exists:
            result["errors"].append(f"Missing required evidence file: {file_name}")
            continue

        if file_name == GOVERNANCE_HANDOFF_EVIDENCE_FILE:
            valid, message, schema_version = _validate_governance_attachment(
                file_path, "handoff"
            )
            result["checks"]["governanceEvidence"].append(
                {
                    "file": file_name,
                    "kind": "handoff",
                    "valid": valid,
                    "exportSchemaVersion": schema_version,
                }
            )
            if not valid:
                result["errors"].append(message)
            else:
                governance_schema_versions["handoff"] = schema_version
                runtime_summary = _extract_runtime_prereqs_summary(file_path)
                if isinstance(runtime_summary, dict):
                    governance_runtime_prereqs["handoff"] = runtime_summary
                command_aliases_summary = _extract_command_aliases_summary(file_path)
                if isinstance(command_aliases_summary, dict):
                    governance_command_aliases["handoff"] = command_aliases_summary
                sendgrid_summary = _extract_sendgrid_webhook_timestamp_summary(file_path)
                if isinstance(sendgrid_summary, dict):
                    governance_sendgrid_webhook_timestamp["handoff"] = sendgrid_summary
        if file_name == GOVERNANCE_HISTORY_EVIDENCE_FILE:
            valid, message, schema_version = _validate_governance_attachment(
                file_path, "history"
            )
            result["checks"]["governanceEvidence"].append(
                {
                    "file": file_name,
                    "kind": "history",
                    "valid": valid,
                    "exportSchemaVersion": schema_version,
                }
            )
            if not valid:
                result["errors"].append(message)
            else:
                governance_schema_versions["history"] = schema_version
                runtime_summary = _extract_runtime_prereqs_summary(file_path)
                if isinstance(runtime_summary, dict):
                    governance_runtime_prereqs["history"] = runtime_summary
                command_aliases_summary = _extract_command_aliases_summary(file_path)
                if isinstance(command_aliases_summary, dict):
                    governance_command_aliases["history"] = command_aliases_summary
                sendgrid_summary = _extract_sendgrid_webhook_timestamp_summary(file_path)
                if isinstance(sendgrid_summary, dict):
                    governance_sendgrid_webhook_timestamp["history"] = sendgrid_summary
        if file_name == GOVERNANCE_PACKET_VALIDATION_EVIDENCE_FILE:
            valid, message = _validate_governance_packet_validation(file_path)
            result["checks"]["governanceEvidence"].append(
                {
                    "file": file_name,
                    "kind": "packet_validation",
                    "valid": valid,
                }
            )
            if not valid:
                result["errors"].append(message)

    if (
        "handoff" in governance_schema_versions
        and "history" in governance_schema_versions
        and governance_schema_versions["handoff"]
        != governance_schema_versions["history"]
    ):
        result["errors"].append(
            "Governance handoff/history exportSchemaVersion values are inconsistent "
            f"({governance_schema_versions['handoff']} != {governance_schema_versions['history']}). "
            + _governance_schema_remediation_hint()
        )
    if (
        "handoff" in governance_runtime_prereqs
        and "history" in governance_runtime_prereqs
        and governance_runtime_prereqs["handoff"].get("missingCheckCount")
        != governance_runtime_prereqs["history"].get("missingCheckCount")
    ):
        result["errors"].append(
            "Governance handoff/history runtimePrereqs.missingCheckCount values are inconsistent"
        )
    if (
        "handoff" in governance_runtime_prereqs
        and "history" in governance_runtime_prereqs
        and _is_non_empty_string(governance_runtime_prereqs["handoff"].get("command"))
        and _is_non_empty_string(governance_runtime_prereqs["history"].get("command"))
        and governance_runtime_prereqs["handoff"].get("command")
        != governance_runtime_prereqs["history"].get("command")
    ):
        result["errors"].append(
            "Governance handoff/history runtimePrereqs.command values are inconsistent"
        )
    if (
        "handoff" in governance_command_aliases
        and "history" in governance_command_aliases
        and governance_command_aliases["handoff"].get("missingAliasCount")
        != governance_command_aliases["history"].get("missingAliasCount")
    ):
        result["errors"].append(
            "Governance handoff/history commandAliases.missingAliasCount values are inconsistent"
        )
    if (
        "handoff" in governance_command_aliases
        and "history" in governance_command_aliases
        and governance_command_aliases["handoff"].get("mismatchedAliasCount")
        != governance_command_aliases["history"].get("mismatchedAliasCount")
    ):
        result["errors"].append(
            "Governance handoff/history commandAliases.mismatchedAliasCount values are inconsistent"
        )
    if (
        "handoff" in governance_command_aliases
        and "history" in governance_command_aliases
        and _is_non_empty_string(governance_command_aliases["handoff"].get("command"))
        and _is_non_empty_string(governance_command_aliases["history"].get("command"))
        and governance_command_aliases["handoff"].get("command")
        != governance_command_aliases["history"].get("command")
    ):
        result["errors"].append(
            "Governance handoff/history commandAliases.command values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("eventCount")
        != governance_sendgrid_webhook_timestamp["history"].get("eventCount")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.eventCount values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("timestampAnomalyCountTotal")
        != governance_sendgrid_webhook_timestamp["history"].get("timestampAnomalyCountTotal")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.timestampAnomalyCountTotal values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("pressureLabelCounts")
        != governance_sendgrid_webhook_timestamp["history"].get("pressureLabelCounts")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.pressureLabelCounts values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("pressureHintCounts")
        != governance_sendgrid_webhook_timestamp["history"].get("pressureHintCounts")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.pressureHintCounts values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("timestampAgeBucketCounts")
        != governance_sendgrid_webhook_timestamp["history"].get("timestampAgeBucketCounts")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.timestampAgeBucketCounts values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("timestampAnomalyEventTypeCounts")
        != governance_sendgrid_webhook_timestamp["history"].get("timestampAnomalyEventTypeCounts")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts values are inconsistent"
        )
    if (
        "handoff" in governance_sendgrid_webhook_timestamp
        and "history" in governance_sendgrid_webhook_timestamp
        and governance_sendgrid_webhook_timestamp["handoff"].get("latestEventAt")
        != governance_sendgrid_webhook_timestamp["history"].get("latestEventAt")
    ):
        result["errors"].append(
            "Governance handoff/history sendgridWebhookTimestamp.latestEventAt values are inconsistent"
        )

    env_schema = _resolve_governance_env_schema_version()
    detected_versions = sorted(
        {
            int(schema_version)
            for schema_version in governance_schema_versions.values()
            if isinstance(schema_version, int)
        }
    )
    expected_schema_version = env_schema.get("expectedExportSchemaVersion")
    consistent_with_env = True
    if env_schema.get("isSet") and not env_schema.get("isValid"):
        consistent_with_env = False
    if (
        env_schema.get("isSet")
        and env_schema.get("isValid")
        and isinstance(expected_schema_version, int)
        and detected_versions
        and any(version != expected_schema_version for version in detected_versions)
    ):
        consistent_with_env = False

    result["checks"]["governanceSchemaPreflight"] = {
        "envVar": GOVERNANCE_EXPORT_SCHEMA_ENV_VAR,
        "isSet": bool(env_schema.get("isSet")),
        "rawValue": env_schema.get("rawValue"),
        "isValid": bool(env_schema.get("isValid")),
        "expectedExportSchemaVersion": expected_schema_version,
        "detectedExportSchemaVersions": detected_versions,
        "consistent": consistent_with_env,
    }

    if env_schema.get("isSet") and not env_schema.get("isValid"):
        result["errors"].append(
            f"{GOVERNANCE_EXPORT_SCHEMA_ENV_VAR} is invalid in current runtime. "
            + _governance_schema_remediation_hint()
        )
    elif (
        env_schema.get("isSet")
        and env_schema.get("isValid")
        and isinstance(expected_schema_version, int)
        and detected_versions
        and any(version != expected_schema_version for version in detected_versions)
    ):
        result["errors"].append(
            "Governance artifact exportSchemaVersion values do not match "
            f"{GOVERNANCE_EXPORT_SCHEMA_ENV_VAR}={expected_schema_version}. "
            + _governance_schema_remediation_hint()
        )

    for approval in required_approvals:
        role = approval.get("role", "")
        if not role:
            continue
        approved = _contains_approved_role(signoff_md, role)
        result["checks"]["requiredApprovals"].append(
            {
                "role": role,
                "approved": approved,
            }
        )
        if approval.get("required", True) and not approved:
            result["errors"].append(f"Missing required approval: {role}")

    for marker in REQUIRED_SCHEMA_TRACEABILITY_MARKERS:
        present = marker in signoff_md
        result["checks"]["schemaTraceability"].append(
            {
                "marker": marker,
                "present": present,
            }
        )
        if not present:
            result["errors"].append(
                f"Missing schema traceability checklist item: {marker}"
            )

    result["valid"] = len(result["errors"]) == 0
    return result


def main():
    args = parse_args()
    evidence = _load_evidence(args.evidence)
    signoff_md = _load_signoff_markdown(args.signoff)
    validation = validate_signoff_bundle(evidence, signoff_md, args.artifacts_dir)

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(validation, f, indent=2)

    print(json.dumps(validation, indent=2))
    return 0 if validation.get("valid") else 1


if __name__ == "__main__":
    raise SystemExit(main())
