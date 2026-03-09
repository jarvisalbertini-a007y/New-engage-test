#!/usr/bin/env python3
"""Validate governance weekly report artifact contract."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


REQUIRED_TOP_LEVEL_KEYS = [
    "generatedAt",
    "windowDays",
    "sourceArtifacts",
    "summary",
    "totals",
    "timeline",
    "ownerActionMatrix",
    "recommendedCommands",
    "signoffChecklist",
]

REQUIRED_TOTAL_KEYS = [
    "governanceEventCount",
    "traceabilityEvaluationCount",
    "snapshotEvaluationCount",
    "baselineEvaluationCount",
    "actionRequiredCount",
    "connectorRateLimitEventCount",
    "commandAliasesMissingAliasCount",
    "commandAliasesMismatchedAliasCount",
    "rolloutBlocked",
]

REQUIRED_CONNECTOR_RATE_LIMIT_SUMMARY_KEYS = [
    "eventCount",
    "byEndpoint",
    "latestEventAt",
    "maxRetryAfterSeconds",
    "avgRetryAfterSeconds",
    "maxResetInSeconds",
    "avgResetInSeconds",
    "pressure",
]
REQUIRED_RUNTIME_PREREQS_SUMMARY_KEYS = [
    "present",
    "available",
    "passed",
    "contractValid",
    "valid",
    "missingCheckCount",
    "missingChecks",
    "artifactPath",
    "generatedAt",
    "validatedAt",
    "command",
]
REQUIRED_COMMAND_ALIASES_SUMMARY_KEYS = [
    "present",
    "available",
    "source",
    "gatePassed",
    "contractValid",
    "valid",
    "missingAliasCount",
    "mismatchedAliasCount",
    "missingAliases",
    "mismatchedAliases",
    "artifactPath",
    "generatedAt",
    "validatedAt",
    "command",
]

GOVERNANCE_STATUS_ALLOWED_TOKENS = {
    "READY",
    "ACTION_REQUIRED",
    "PASS",
    "FAIL",
    "UNKNOWN",
}
TRACEABILITY_DECISION_ALLOWED_TOKENS = {"PROCEED", "HOLD", "UNKNOWN"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate connector governance weekly report artifact contract."
    )
    parser.add_argument(
        "--artifact",
        default="backend/test_reports/connector_governance_weekly_report.json",
        help="Path to governance weekly report artifact JSON.",
    )
    return parser.parse_args()


def _validate_count_map(
    *,
    field_name: str,
    value: Any,
    allowed_tokens: set[str],
    errors: List[str],
) -> None:
    if not isinstance(value, dict):
        errors.append(f"{field_name} must be an object")
        return
    for token, count in value.items():
        if not isinstance(token, str):
            errors.append(f"{field_name} keys must be strings")
            continue
        if token not in allowed_tokens:
            errors.append(
                f"{field_name}.{token} must be one of: {', '.join(sorted(allowed_tokens))}"
            )
        if not isinstance(count, int) or count < 0:
            errors.append(f"{field_name}.{token} must be a non-negative integer")


def validate_report(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in payload:
            errors.append(f"Missing top-level key: {key}")

    if not isinstance(payload.get("generatedAt"), str):
        errors.append("generatedAt must be a string")
    if not isinstance(payload.get("windowDays"), int):
        errors.append("windowDays must be an integer")

    source_artifacts = payload.get("sourceArtifacts")
    if not isinstance(source_artifacts, dict):
        errors.append("sourceArtifacts must be an object")
    else:
        for field in ("telemetrySnapshot", "baselineMetrics"):
            if not isinstance(source_artifacts.get(field), str):
                errors.append(f"sourceArtifacts.{field} must be a string")

    summary = payload.get("summary")
    if not isinstance(summary, dict):
        errors.append("summary must be an object")
    else:
        governance_audit = summary.get("governanceAudit")
        if not isinstance(governance_audit, dict):
            errors.append("summary.governanceAudit must be an object")
        else:
            _validate_count_map(
                field_name="summary.governanceAudit.statusCounts",
                value=governance_audit.get("statusCounts"),
                allowed_tokens=GOVERNANCE_STATUS_ALLOWED_TOKENS,
                errors=errors,
            )
        traceability_audit = summary.get("traceabilityAudit")
        if not isinstance(traceability_audit, dict):
            errors.append("summary.traceabilityAudit must be an object")
        else:
            _validate_count_map(
                field_name="summary.traceabilityAudit.decisionCounts",
                value=traceability_audit.get("decisionCounts"),
                allowed_tokens=TRACEABILITY_DECISION_ALLOWED_TOKENS,
                errors=errors,
            )
        connector_rate_limit = summary.get("connectorRateLimit")
        if not isinstance(connector_rate_limit, dict):
            errors.append("summary.connectorRateLimit must be an object")
        else:
            for key in REQUIRED_CONNECTOR_RATE_LIMIT_SUMMARY_KEYS:
                if key not in connector_rate_limit:
                    errors.append(f"summary.connectorRateLimit missing key: {key}")
            event_count = connector_rate_limit.get("eventCount")
            if not isinstance(event_count, int):
                errors.append("summary.connectorRateLimit.eventCount must be an integer")
            by_endpoint = connector_rate_limit.get("byEndpoint")
            if not isinstance(by_endpoint, dict):
                errors.append("summary.connectorRateLimit.byEndpoint must be an object")
            else:
                for endpoint, count in by_endpoint.items():
                    if not isinstance(endpoint, str):
                        errors.append(
                            "summary.connectorRateLimit.byEndpoint key must be a string"
                        )
                        break
                    if not isinstance(count, int):
                        errors.append(
                            f"summary.connectorRateLimit.byEndpoint.{endpoint} must be an integer"
                        )
            latest_event_at = connector_rate_limit.get("latestEventAt")
            if latest_event_at is not None and not isinstance(latest_event_at, str):
                errors.append(
                    "summary.connectorRateLimit.latestEventAt must be a string or null"
                )
            for key in (
                "maxRetryAfterSeconds",
                "avgRetryAfterSeconds",
                "maxResetInSeconds",
                "avgResetInSeconds",
            ):
                value = connector_rate_limit.get(key)
                if value is not None and not isinstance(value, (int, float)):
                    errors.append(
                        f"summary.connectorRateLimit.{key} must be a number or null"
                    )
            pressure = connector_rate_limit.get("pressure")
            if not isinstance(pressure, dict):
                errors.append("summary.connectorRateLimit.pressure must be an object")
            else:
                if not isinstance(pressure.get("label"), str):
                    errors.append(
                        "summary.connectorRateLimit.pressure.label must be a string"
                    )
                signal_seconds = pressure.get("signalSeconds")
                if not isinstance(signal_seconds, (int, float)):
                    errors.append(
                        "summary.connectorRateLimit.pressure.signalSeconds must be a number"
                    )
        baseline_policy = summary.get("baselinePolicy")
        if not isinstance(baseline_policy, dict):
            errors.append("summary.baselinePolicy must be an object")
        elif not isinstance(baseline_policy.get("passed"), bool):
            errors.append("summary.baselinePolicy.passed must be a boolean")

        runtime_prereqs = summary.get("runtimePrereqs")
        if not isinstance(runtime_prereqs, dict):
            errors.append("summary.runtimePrereqs must be an object")
        else:
            for key in REQUIRED_RUNTIME_PREREQS_SUMMARY_KEYS:
                if key not in runtime_prereqs:
                    errors.append(f"summary.runtimePrereqs missing key: {key}")
            if not isinstance(runtime_prereqs.get("present"), bool):
                errors.append("summary.runtimePrereqs.present must be a boolean")
            if not isinstance(runtime_prereqs.get("available"), bool):
                errors.append("summary.runtimePrereqs.available must be a boolean")
            for key in ("passed", "contractValid", "valid"):
                value = runtime_prereqs.get(key)
                if value is not None and not isinstance(value, bool):
                    errors.append(f"summary.runtimePrereqs.{key} must be a boolean or null")
            missing_check_count = runtime_prereqs.get("missingCheckCount")
            if not isinstance(missing_check_count, int) or missing_check_count < 0:
                errors.append(
                    "summary.runtimePrereqs.missingCheckCount must be a non-negative integer"
                )
            missing_checks = runtime_prereqs.get("missingChecks")
            if not isinstance(missing_checks, dict):
                errors.append("summary.runtimePrereqs.missingChecks must be an object")
            else:
                for key in ("commands", "workspace"):
                    values = missing_checks.get(key)
                    if not isinstance(values, list):
                        errors.append(
                            f"summary.runtimePrereqs.missingChecks.{key} must be a list"
                        )
                    else:
                        for idx, entry in enumerate(values):
                            if not isinstance(entry, str) or not entry.strip():
                                errors.append(
                                    f"summary.runtimePrereqs.missingChecks.{key}[{idx}] must be a non-empty string"
                                )
            for key in ("artifactPath", "generatedAt", "validatedAt", "command"):
                value = runtime_prereqs.get(key)
                if value is not None and not isinstance(value, str):
                    errors.append(f"summary.runtimePrereqs.{key} must be a string or null")

        command_aliases = summary.get("commandAliases")
        if not isinstance(command_aliases, dict):
            errors.append("summary.commandAliases must be an object")
        else:
            for key in REQUIRED_COMMAND_ALIASES_SUMMARY_KEYS:
                if key not in command_aliases:
                    errors.append(f"summary.commandAliases missing key: {key}")
            if not isinstance(command_aliases.get("present"), bool):
                errors.append("summary.commandAliases.present must be a boolean")
            if not isinstance(command_aliases.get("available"), bool):
                errors.append("summary.commandAliases.available must be a boolean")
            if not isinstance(command_aliases.get("source"), str):
                errors.append("summary.commandAliases.source must be a string")
            for key in ("gatePassed", "contractValid", "valid"):
                value = command_aliases.get(key)
                if value is not None and not isinstance(value, bool):
                    errors.append(f"summary.commandAliases.{key} must be a boolean or null")
            missing_alias_count = command_aliases.get("missingAliasCount")
            if not isinstance(missing_alias_count, int) or missing_alias_count < 0:
                errors.append(
                    "summary.commandAliases.missingAliasCount must be a non-negative integer"
                )
            mismatched_alias_count = command_aliases.get("mismatchedAliasCount")
            if (
                not isinstance(mismatched_alias_count, int)
                or mismatched_alias_count < 0
            ):
                errors.append(
                    "summary.commandAliases.mismatchedAliasCount must be a non-negative integer"
                )
            for key in ("missingAliases", "mismatchedAliases"):
                values = command_aliases.get(key)
                if not isinstance(values, list):
                    errors.append(f"summary.commandAliases.{key} must be a list")
                else:
                    for idx, entry in enumerate(values):
                        if not isinstance(entry, str) or not entry.strip():
                            errors.append(
                                f"summary.commandAliases.{key}[{idx}] must be a non-empty string"
                            )
            for key in ("artifactPath", "generatedAt", "validatedAt", "command"):
                value = command_aliases.get(key)
                if value is not None and not isinstance(value, str):
                    errors.append(f"summary.commandAliases.{key} must be a string or null")
            if (
                isinstance(command_aliases.get("missingAliases"), list)
                and isinstance(command_aliases.get("missingAliasCount"), int)
                and command_aliases.get("missingAliasCount")
                != len(command_aliases.get("missingAliases") or [])
            ):
                errors.append(
                    "summary.commandAliases.missingAliasCount must match len(summary.commandAliases.missingAliases)"
                )
            if (
                isinstance(command_aliases.get("mismatchedAliases"), list)
                and isinstance(command_aliases.get("mismatchedAliasCount"), int)
                and command_aliases.get("mismatchedAliasCount")
                != len(command_aliases.get("mismatchedAliases") or [])
            ):
                errors.append(
                    "summary.commandAliases.mismatchedAliasCount must match len(summary.commandAliases.mismatchedAliases)"
                )

        if not isinstance(summary.get("rolloutBlocked"), bool):
            errors.append("summary.rolloutBlocked must be a boolean")

    totals = payload.get("totals")
    if not isinstance(totals, dict):
        errors.append("totals must be an object")
    else:
        for key in REQUIRED_TOTAL_KEYS:
            if key not in totals:
                errors.append(f"totals missing key: {key}")
        for key in REQUIRED_TOTAL_KEYS:
            if key == "rolloutBlocked":
                if not isinstance(totals.get(key), bool):
                    errors.append("totals.rolloutBlocked must be a boolean")
            elif not isinstance(totals.get(key), int):
                errors.append(f"totals.{key} must be an integer")
            elif int(totals.get(key)) < 0:
                errors.append(f"totals.{key} must be a non-negative integer")

    timeline = payload.get("timeline")
    if not isinstance(timeline, list):
        errors.append("timeline must be a list")
    else:
        for idx, row in enumerate(timeline):
            if not isinstance(row, dict):
                errors.append(f"timeline row {idx} must be an object")
                continue
            for field in (
                "date",
                "traceabilityEvents",
                "snapshotGovernanceEvents",
                "baselineGovernanceEvents",
                "actionRequiredEvents",
                "holdDecisions",
                "proceedDecisions",
            ):
                if field not in row:
                    errors.append(f"timeline row {idx} missing key: {field}")
            if "date" in row and not isinstance(row.get("date"), str):
                errors.append(f"timeline row {idx} field date must be a string")
            for numeric_field in (
                "traceabilityEvents",
                "snapshotGovernanceEvents",
                "baselineGovernanceEvents",
                "actionRequiredEvents",
                "holdDecisions",
                "proceedDecisions",
            ):
                value = row.get(numeric_field)
                if not isinstance(value, int) or value < 0:
                    errors.append(
                        f"timeline row {idx} field {numeric_field} must be a non-negative integer"
                    )

    owner_actions = payload.get("ownerActionMatrix")
    if not isinstance(owner_actions, list):
        errors.append("ownerActionMatrix must be a list")
    elif len(owner_actions) == 0:
        errors.append("ownerActionMatrix must not be empty")
    else:
        for idx, row in enumerate(owner_actions):
            if not isinstance(row, dict):
                errors.append(f"ownerActionMatrix row {idx} must be an object")
                continue
            for field in ("priority", "severity", "ownerRole", "trigger", "action", "command"):
                if not isinstance(row.get(field), str):
                    errors.append(f"ownerActionMatrix row {idx} field {field} must be a string")

    recommended_commands = payload.get("recommendedCommands")
    if not isinstance(recommended_commands, list):
        errors.append("recommendedCommands must be a list")
    elif len(recommended_commands) == 0:
        errors.append("recommendedCommands must not be empty")
    else:
        for idx, command in enumerate(recommended_commands):
            if not isinstance(command, str) or not command.strip():
                errors.append(f"recommendedCommands[{idx}] must be a non-empty string")

    signoff_checklist = payload.get("signoffChecklist")
    if not isinstance(signoff_checklist, list):
        errors.append("signoffChecklist must be a list")
    elif len(signoff_checklist) == 0:
        errors.append("signoffChecklist must not be empty")

    return errors


def main() -> int:
    args = parse_args()
    artifact_path = Path(args.artifact)
    if not artifact_path.exists():
        print(f"Governance report artifact does not exist: {artifact_path}")
        return 1

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"Governance report artifact is invalid JSON: {artifact_path}")
        return 1

    if not isinstance(payload, dict):
        print(f"Governance report artifact root must be an object: {artifact_path}")
        return 1

    errors = validate_report(payload)
    if errors:
        print("Governance weekly report validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Governance weekly report validation passed: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
