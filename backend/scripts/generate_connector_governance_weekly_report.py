#!/usr/bin/env python3
"""Generate a weekly governance trend artifact for rollout signoff packets."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_TELEMETRY_SNAPSHOT_PATH = (
    ROOT_DIR / "backend" / "test_reports" / "connector-telemetry-summary-snapshot.json"
)
DEFAULT_BASELINE_METRICS_PATH = (
    ROOT_DIR / "backend" / "test_reports" / "baseline_metrics.json"
)
DEFAULT_OUTPUT_PATH = (
    ROOT_DIR / "backend" / "test_reports" / "connector_governance_weekly_report.json"
)

GOVERNANCE_STATUS_ALLOWED_TOKENS = {"READY", "ACTION_REQUIRED", "PASS", "FAIL"}
TRACEABILITY_DECISION_ALLOWED_TOKENS = {"PROCEED", "HOLD"}
BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND = (
    "npm run verify:baseline:runtime-prereqs:artifact"
)
BASELINE_RUNTIME_PREREQS_ARTIFACT_CONTRACT_COMMAND = (
    "npm run verify:baseline:runtime-prereqs:artifact:contract"
)
BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND = "npm run verify:smoke:runtime-prereqs-artifact"
BASELINE_COMMAND_ALIASES_ARTIFACT_COMMAND = (
    "npm run verify:baseline:command-aliases:artifact"
)
BASELINE_COMMAND_ALIASES_ARTIFACT_CONTRACT_COMMAND = (
    "npm run verify:baseline:command-aliases:artifact:contract"
)
BASELINE_COMMAND_ALIASES_SMOKE_COMMAND = (
    "npm run verify:smoke:baseline-command-aliases-artifact"
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate weekly governance trend report artifact."
    )
    parser.add_argument(
        "--telemetry-snapshot",
        default=str(DEFAULT_TELEMETRY_SNAPSHOT_PATH),
        help="Path to telemetry summary snapshot JSON.",
    )
    parser.add_argument(
        "--baseline-metrics",
        default=str(DEFAULT_BASELINE_METRICS_PATH),
        help="Path to baseline metrics artifact JSON.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path to output governance report artifact JSON.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=7,
        help="Window days represented by the report artifact.",
    )
    return parser.parse_args()


def _load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise ValueError(f"Artifact does not exist: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Artifact is invalid JSON: {path}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"Artifact root must be an object: {path}")
    return payload


def _build_timeline(telemetry_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    timeline_map: Dict[str, Dict[str, Any]] = {}
    for row in telemetry_payload.get("recentEvents") or []:
        if not isinstance(row, dict):
            continue
        created_at = str(row.get("createdAt") or "")
        day_key = created_at[:10] if len(created_at) >= 10 else "unknown"
        bucket = timeline_map.setdefault(
            day_key,
            {
                "date": day_key,
                "traceabilityEvents": 0,
                "snapshotGovernanceEvents": 0,
                "baselineGovernanceEvents": 0,
                "actionRequiredEvents": 0,
                "holdDecisions": 0,
                "proceedDecisions": 0,
            },
        )

        governance_status = row.get("governanceStatus")
        if governance_status is not None and str(governance_status).strip():
            normalized_governance_status = _normalize_status_token_with_allowlist(
                governance_status,
                GOVERNANCE_STATUS_ALLOWED_TOKENS,
            )
            event_type = str(row.get("eventType") or "")
            if "baseline" in event_type:
                bucket["baselineGovernanceEvents"] += 1
            else:
                bucket["snapshotGovernanceEvents"] += 1
            if normalized_governance_status == "ACTION_REQUIRED":
                bucket["actionRequiredEvents"] += 1

        traceability_decision = row.get("traceabilityDecision")
        if traceability_decision is not None and str(traceability_decision).strip():
            bucket["traceabilityEvents"] += 1
            normalized = _normalize_status_token_with_allowlist(
                traceability_decision,
                TRACEABILITY_DECISION_ALLOWED_TOKENS,
            )
            if normalized == "HOLD":
                bucket["holdDecisions"] += 1
            elif normalized == "PROCEED":
                bucket["proceedDecisions"] += 1

    if timeline_map:
        return [timeline_map[key] for key in sorted(timeline_map.keys())]

    fallback: List[Dict[str, Any]] = []
    for row in telemetry_payload.get("trendByDay") or []:
        if not isinstance(row, dict):
            continue
        day_key = str(row.get("date") or "unknown")
        fallback.append(
            {
                "date": day_key,
                "traceabilityEvents": 0,
                "snapshotGovernanceEvents": 0,
                "baselineGovernanceEvents": 0,
                "actionRequiredEvents": 0,
                "holdDecisions": 0,
                "proceedDecisions": 0,
            }
        )
    return fallback


def _coerce_non_negative_int(value: Any, fallback: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed >= 0 else fallback


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


def _normalize_status_token_with_allowlist(
    value: Any,
    allowed_tokens: set[str],
    fallback: str = "UNKNOWN",
) -> str:
    if isinstance(value, str):
        candidate = value.strip()
    elif value is None:
        candidate = ""
    else:
        candidate = str(value).strip()
    if not candidate:
        return fallback
    normalized = "".join(ch if ch.isalnum() else "_" for ch in candidate.upper())
    normalized = normalized.strip("_")
    if not normalized:
        return fallback
    if normalized not in allowed_tokens:
        return fallback
    return normalized


def _normalize_count_map(raw_counts: Any, allowed_tokens: set[str]) -> Dict[str, int]:
    if not isinstance(raw_counts, dict):
        return {}
    normalized_counts: Dict[str, int] = {}
    for key, value in raw_counts.items():
        normalized_key = _normalize_status_token_with_allowlist(key, allowed_tokens)
        normalized_counts[normalized_key] = (
            int(normalized_counts.get(normalized_key, 0))
            + _coerce_non_negative_int(value, fallback=0)
        )
    return normalized_counts


def _coerce_nullable_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _resolve_connector_rate_limit_pressure(
    max_retry_after_seconds: Any,
    avg_reset_in_seconds: Any,
) -> Dict[str, Any]:
    max_retry = _coerce_nullable_number(max_retry_after_seconds) or 0.0
    avg_reset = _coerce_nullable_number(avg_reset_in_seconds) or 0.0
    signal = round(max(max_retry, avg_reset), 2)
    if signal >= 45:
        label = "High"
    elif signal >= 20:
        label = "Moderate"
    elif signal > 0:
        label = "Low"
    else:
        label = "Unknown"
    return {
        "label": label,
        "signalSeconds": signal,
    }


def _normalize_runtime_prereqs_rollup(payload: Any, present: bool) -> Dict[str, Any]:
    runtime_payload = payload if isinstance(payload, dict) else {}
    missing_checks = runtime_payload.get("missingChecks")
    if not isinstance(missing_checks, dict):
        missing_checks = {}
    missing_commands = _normalize_string_list(missing_checks.get("commands"))
    missing_workspace = _normalize_string_list(missing_checks.get("workspace"))
    missing_check_count = _coerce_non_negative_int(
        runtime_payload.get("missingCheckCount"),
        len(missing_commands) + len(missing_workspace),
    )

    command = runtime_payload.get("command")
    if not isinstance(command, str) or not command.strip():
        command = BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND
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

    passed_value = runtime_payload.get("passed")
    passed = passed_value if isinstance(passed_value, bool) else None
    contract_valid_value = runtime_payload.get("contractValid")
    contract_valid = (
        contract_valid_value if isinstance(contract_valid_value, bool) else None
    )
    valid_value = runtime_payload.get("valid")
    valid = valid_value if isinstance(valid_value, bool) else None

    return {
        "present": bool(present),
        "available": runtime_payload.get("available") is True,
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
    return _coerce_non_negative_int(runtime_prereqs.get("missingCheckCount"), 0) > 0


def _normalize_command_aliases_rollup(payload: Any, present: bool) -> Dict[str, Any]:
    command_aliases_payload = payload if isinstance(payload, dict) else {}
    missing_aliases = _normalize_string_list(command_aliases_payload.get("missingAliases"))
    mismatched_aliases = _normalize_string_list(
        command_aliases_payload.get("mismatchedAliases")
    )
    missing_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("missingAliasCount"),
        len(missing_aliases),
    )
    mismatched_alias_count = _coerce_non_negative_int(
        command_aliases_payload.get("mismatchedAliasCount"),
        len(mismatched_aliases),
    )

    command = command_aliases_payload.get("command")
    if not isinstance(command, str) or not command.strip():
        command = BASELINE_COMMAND_ALIASES_ARTIFACT_COMMAND
    else:
        command = command.strip()

    artifact_path = command_aliases_payload.get("artifactPath")
    if not isinstance(artifact_path, str) or not artifact_path.strip():
        artifact_path = None
    else:
        artifact_path = artifact_path.strip()

    generated_at = command_aliases_payload.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at.strip():
        generated_at = None
    else:
        generated_at = generated_at.strip()

    validated_at = command_aliases_payload.get("validatedAt")
    if not isinstance(validated_at, str) or not validated_at.strip():
        validated_at = None
    else:
        validated_at = validated_at.strip()

    source = command_aliases_payload.get("source")
    if not isinstance(source, str) or not source.strip():
        source = "baseline_metrics"
    else:
        source = source.strip()

    gate_passed_value = command_aliases_payload.get("gatePassed")
    gate_passed = gate_passed_value if isinstance(gate_passed_value, bool) else None
    contract_valid_value = command_aliases_payload.get("contractValid")
    contract_valid = (
        contract_valid_value if isinstance(contract_valid_value, bool) else None
    )
    valid_value = command_aliases_payload.get("valid")
    valid = valid_value if isinstance(valid_value, bool) else None

    return {
        "present": bool(present),
        "available": command_aliases_payload.get("available") is True,
        "source": source,
        "gatePassed": gate_passed,
        "contractValid": contract_valid,
        "valid": valid,
        "missingAliasCount": missing_alias_count,
        "mismatchedAliasCount": mismatched_alias_count,
        "missingAliases": missing_aliases,
        "mismatchedAliases": mismatched_aliases,
        "artifactPath": artifact_path,
        "generatedAt": generated_at,
        "validatedAt": validated_at,
        "command": command,
    }


def _command_aliases_needs_remediation(command_aliases: Dict[str, Any]) -> bool:
    if command_aliases.get("present") is not True:
        return False
    if command_aliases.get("available") is not True:
        return True
    if command_aliases.get("contractValid") is not True:
        return True
    if command_aliases.get("valid") is not True:
        return True
    if command_aliases.get("gatePassed") is not True:
        return True
    if _coerce_non_negative_int(command_aliases.get("missingAliasCount"), 0) > 0:
        return True
    return _coerce_non_negative_int(command_aliases.get("mismatchedAliasCount"), 0) > 0


def build_report(
    telemetry_payload: Dict[str, Any],
    baseline_payload: Dict[str, Any],
    window_days: int,
    telemetry_source: Path,
    baseline_source: Path,
) -> Dict[str, Any]:
    governance_audit = telemetry_payload.get("governanceAudit") or {}
    traceability_audit = telemetry_payload.get("traceabilityAudit") or {}
    governance_status_counts = _normalize_count_map(
        governance_audit.get("statusCounts"),
        GOVERNANCE_STATUS_ALLOWED_TOKENS,
    )
    traceability_decision_counts = _normalize_count_map(
        traceability_audit.get("decisionCounts"),
        TRACEABILITY_DECISION_ALLOWED_TOKENS,
    )

    snapshot_eval_count = int(governance_audit.get("snapshotEvaluationCount") or 0)
    baseline_eval_count = int(governance_audit.get("baselineEvaluationCount") or 0)
    governance_event_count = snapshot_eval_count + baseline_eval_count

    traceability_eval_count = int(
        traceability_audit.get("eventCount")
        or sum(int(value) for value in traceability_decision_counts.values())
    )
    action_required_count = int(governance_status_counts.get("ACTION_REQUIRED") or 0)
    hold_decision_count = int(traceability_decision_counts.get("HOLD") or 0)
    connector_rate_limit = telemetry_payload.get("connectorRateLimit")
    if not isinstance(connector_rate_limit, dict):
        connector_rate_limit = {}
    connector_rate_limit_by_endpoint = connector_rate_limit.get("byEndpoint")
    if not isinstance(connector_rate_limit_by_endpoint, dict):
        connector_rate_limit_by_endpoint = {}
    normalized_connector_rate_limit_by_endpoint = {
        str(endpoint): _coerce_non_negative_int(count)
        for endpoint, count in connector_rate_limit_by_endpoint.items()
        if str(endpoint).strip()
    }
    connector_rate_limit_event_count = _coerce_non_negative_int(
        connector_rate_limit.get("eventCount")
    )
    connector_rate_limit_max_retry = _coerce_nullable_number(
        connector_rate_limit.get("maxRetryAfterSeconds")
    )
    connector_rate_limit_avg_retry = _coerce_nullable_number(
        connector_rate_limit.get("avgRetryAfterSeconds")
    )
    connector_rate_limit_max_reset = _coerce_nullable_number(
        connector_rate_limit.get("maxResetInSeconds")
    )
    connector_rate_limit_avg_reset = _coerce_nullable_number(
        connector_rate_limit.get("avgResetInSeconds")
    )
    connector_rate_limit_pressure = _resolve_connector_rate_limit_pressure(
        connector_rate_limit_max_retry,
        connector_rate_limit_avg_reset,
    )

    baseline_policy = baseline_payload.get("releaseGateFixturePolicy") or {}
    baseline_passed = baseline_policy.get("passed") is True
    missing_profiles = baseline_policy.get("missingProfiles")
    if not isinstance(missing_profiles, list):
        missing_profiles = []
    runtime_prereqs = _normalize_runtime_prereqs_rollup(
        baseline_payload.get("runtimePrereqs"),
        "runtimePrereqs" in baseline_payload,
    )
    runtime_prereqs_needs_remediation = _runtime_prereqs_needs_remediation(
        runtime_prereqs
    )
    command_aliases = _normalize_command_aliases_rollup(
        baseline_payload.get("commandAliases"),
        "commandAliases" in baseline_payload,
    )
    command_aliases_needs_remediation = _command_aliases_needs_remediation(
        command_aliases
    )

    rollout_blocked = (
        action_required_count > 0
        or hold_decision_count > 0
        or not baseline_passed
        or len(missing_profiles) > 0
        or runtime_prereqs_needs_remediation
        or command_aliases_needs_remediation
    )

    owner_action_matrix: List[Dict[str, Any]] = []
    if action_required_count > 0:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_action_required",
                "action": "Run telemetry cleanup-policy checks and resolve stale governance blockers.",
                "command": "npm run verify:telemetry:traceability:cleanup:policy",
            }
        )
    if hold_decision_count > 0:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "On-call Engineer",
                "trigger": "traceability_hold",
                "action": "Run governance handoff smoke and remediate rollout-blocking traceability holds.",
                "command": "npm run verify:smoke:traceability-governance-handoff",
            }
        )
    if (not baseline_passed) or missing_profiles:
        owner_action_matrix.append(
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "QA Engineer",
                "trigger": "baseline_fixture_policy_failure",
                "action": "Run baseline-governance drift smoke and regenerate missing fixture evidence.",
                "command": "npm run verify:smoke:baseline-governance-drift",
            }
        )
    if runtime_prereqs_needs_remediation:
        if runtime_prereqs.get("available") is not True:
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "runtime_prereqs_artifact_missing",
                    "action": "Generate runtime prerequisite artifact evidence before governance weekly signoff.",
                    "command": BASELINE_RUNTIME_PREREQS_ARTIFACT_COMMAND,
                }
            )
        if runtime_prereqs.get("contractValid") is not True:
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "QA Engineer",
                    "trigger": "runtime_prereqs_contract_failed",
                    "action": "Validate runtime prerequisite artifact contract and regenerate failed artifacts.",
                    "command": BASELINE_RUNTIME_PREREQS_ARTIFACT_CONTRACT_COMMAND,
                }
            )
        if (
            runtime_prereqs.get("valid") is not True
            or runtime_prereqs.get("passed") is not True
            or _coerce_non_negative_int(runtime_prereqs.get("missingCheckCount"), 0) > 0
        ):
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "runtime_prereqs_check_failed",
                    "action": "Run runtime prerequisite remediation smoke and verify baseline runtime checks pass.",
                    "command": BASELINE_RUNTIME_PREREQS_SMOKE_COMMAND,
                }
            )
    if command_aliases_needs_remediation:
        if command_aliases.get("available") is not True:
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_command_aliases_artifact_missing",
                    "action": "Generate baseline command-alias artifact evidence before governance weekly signoff.",
                    "command": BASELINE_COMMAND_ALIASES_ARTIFACT_COMMAND,
                }
            )
        if command_aliases.get("contractValid") is not True:
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "QA Engineer",
                    "trigger": "baseline_command_aliases_contract_failed",
                    "action": "Validate baseline command-alias artifact contract and regenerate failed artifacts.",
                    "command": BASELINE_COMMAND_ALIASES_ARTIFACT_CONTRACT_COMMAND,
                }
            )
        if (
            command_aliases.get("gatePassed") is not True
            or command_aliases.get("valid") is not True
            or _coerce_non_negative_int(command_aliases.get("missingAliasCount"), 0) > 0
            or _coerce_non_negative_int(command_aliases.get("mismatchedAliasCount"), 0) > 0
        ):
            owner_action_matrix.append(
                {
                    "priority": "P1",
                    "severity": "high",
                    "ownerRole": "Release Manager",
                    "trigger": "baseline_command_aliases_check_failed",
                    "action": "Run baseline command-alias artifact smoke checks and verify alias parity.",
                    "command": BASELINE_COMMAND_ALIASES_SMOKE_COMMAND,
                }
            )
    if not owner_action_matrix:
        owner_action_matrix.append(
            {
                "priority": "P3",
                "severity": "info",
                "ownerRole": "Release Manager",
                "trigger": "governance_ready",
                "action": "Governance posture is healthy; keep evidence fresh and proceed with signoff review.",
                "command": "npm run verify:ci:sales:extended",
            }
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

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "windowDays": max(window_days, 1),
        "sourceArtifacts": {
            "telemetrySnapshot": str(telemetry_source),
            "baselineMetrics": str(baseline_source),
        },
        "summary": {
            "governanceAudit": {
                "eventCount": int(governance_audit.get("eventCount") or governance_event_count),
                "snapshotEvaluationCount": snapshot_eval_count,
                "baselineEvaluationCount": baseline_eval_count,
                "statusCounts": governance_status_counts,
            },
            "traceabilityAudit": {
                "eventCount": traceability_eval_count,
                "decisionCounts": traceability_decision_counts,
                "readyCount": int(traceability_audit.get("readyCount") or 0),
                "notReadyCount": int(traceability_audit.get("notReadyCount") or 0),
            },
            "connectorRateLimit": {
                "eventCount": connector_rate_limit_event_count,
                "byEndpoint": normalized_connector_rate_limit_by_endpoint,
                "latestEventAt": connector_rate_limit.get("latestEventAt"),
                "maxRetryAfterSeconds": connector_rate_limit_max_retry,
                "avgRetryAfterSeconds": connector_rate_limit_avg_retry,
                "maxResetInSeconds": connector_rate_limit_max_reset,
                "avgResetInSeconds": connector_rate_limit_avg_reset,
                "pressure": connector_rate_limit_pressure,
            },
            "baselinePolicy": {
                "passed": baseline_passed,
                "missingProfiles": missing_profiles,
                "message": baseline_policy.get("message"),
            },
            "runtimePrereqs": runtime_prereqs,
            "commandAliases": command_aliases,
            "rolloutBlocked": rollout_blocked,
        },
        "totals": {
            "governanceEventCount": governance_event_count,
            "traceabilityEvaluationCount": traceability_eval_count,
            "snapshotEvaluationCount": snapshot_eval_count,
            "baselineEvaluationCount": baseline_eval_count,
            "actionRequiredCount": action_required_count,
            "connectorRateLimitEventCount": connector_rate_limit_event_count,
            "runtimePrereqsMissingCheckCount": _coerce_non_negative_int(
                runtime_prereqs.get("missingCheckCount"),
                0,
            ),
            "commandAliasesMissingAliasCount": _coerce_non_negative_int(
                command_aliases.get("missingAliasCount"),
                0,
            ),
            "commandAliasesMismatchedAliasCount": _coerce_non_negative_int(
                command_aliases.get("mismatchedAliasCount"),
                0,
            ),
            "rolloutBlocked": rollout_blocked,
        },
        "timeline": _build_timeline(telemetry_payload),
        "ownerActionMatrix": owner_action_matrix,
        "recommendedCommands": recommended_commands,
        "signoffChecklist": [
            "Review governance status and trend deltas from this artifact.",
            "Run all recommended commands and attach outputs to the release signoff packet.",
            "Confirm rolloutBlocked=false before expansion beyond canary.",
        ],
    }


def main() -> int:
    args = parse_args()
    telemetry_path = Path(args.telemetry_snapshot)
    baseline_path = Path(args.baseline_metrics)
    output_path = Path(args.output)

    try:
        telemetry_payload = _load_json(telemetry_path)
        baseline_payload = _load_json(baseline_path)
    except ValueError as exc:
        print(str(exc))
        return 1

    report = build_report(
        telemetry_payload=telemetry_payload,
        baseline_payload=baseline_payload,
        window_days=args.window_days,
        telemetry_source=telemetry_path,
        baseline_source=baseline_path,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote governance weekly report artifact: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
