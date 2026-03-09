#!/usr/bin/env python3
"""Validate telemetry event-root backfill policy + guarded-apply artifact contracts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Tuple


EXPECTED_POLICY_COMMAND = "evaluate_integration_telemetry_event_root_backfill_policy"
EXPECTED_GUARDED_COMMAND = "run_integration_telemetry_event_root_backfill_guarded_apply"
EXPECTED_ALLOW_APPLY_ENV_VAR = "BACKFILL_ALLOW_APPLY"
ALLOWED_DECISIONS = {"SKIP_APPLY", "ACTION_REQUIRED", "ALLOW_APPLY"}


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Validate policy + guarded-apply telemetry event-root backfill artifacts for "
            "decision/count parity and schema contract compliance."
        )
    )
    parser.add_argument(
        "--policy-artifact",
        required=True,
        help="Path to policy artifact JSON output.",
    )
    parser.add_argument(
        "--guarded-artifact",
        required=True,
        help="Path to guarded apply artifact JSON output.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output path for validation result JSON.",
    )
    return parser.parse_args()


def _load_json(path: str, *, label: str) -> Dict[str, Any]:
    artifact_path = Path(path)
    if not artifact_path.exists():
        raise ValueError(f"{label} artifact does not exist: {artifact_path}")
    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{label} artifact is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{label} artifact must decode to a JSON object")
    return payload


def _is_iso_datetime(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    normalized = value.strip().replace("Z", "+00:00")
    try:
        datetime.fromisoformat(normalized)
        return True
    except ValueError:
        return False


def _non_negative_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    return None


def _is_bool(value: Any) -> bool:
    return isinstance(value, bool)


def validate_policy_artifact(payload: Dict[str, Any]) -> Tuple[list[str], Dict[str, Any]]:
    errors: list[str] = []
    checks: Dict[str, Any] = {
        "generatedAtIso": True,
        "commandMatch": True,
        "decisionAllowed": True,
        "candidateCountPresent": True,
        "maxApplyCandidatesPresent": True,
        "allowApplyEnvVarMatch": True,
        "allowApplyFlagBool": True,
        "dryRunSummaryPresent": True,
        "dryRunMode": True,
        "candidateCountParity": True,
        "recommendedCommandExpectation": True,
    }

    if not _is_iso_datetime(payload.get("generatedAt")):
        checks["generatedAtIso"] = False
        errors.append("Policy artifact generatedAt must be ISO-8601.")

    if payload.get("command") != EXPECTED_POLICY_COMMAND:
        checks["commandMatch"] = False
        errors.append("Policy artifact command marker is invalid.")

    decision = payload.get("decision")
    if decision not in ALLOWED_DECISIONS:
        checks["decisionAllowed"] = False
        errors.append("Policy artifact decision must be one of SKIP_APPLY/ACTION_REQUIRED/ALLOW_APPLY.")

    candidate_count = _non_negative_int(payload.get("candidateCount"))
    if candidate_count is None:
        checks["candidateCountPresent"] = False
        errors.append("Policy artifact candidateCount must be a non-negative integer.")

    max_apply_candidates = _non_negative_int(payload.get("maxApplyCandidates"))
    if max_apply_candidates is None or max_apply_candidates < 1:
        checks["maxApplyCandidatesPresent"] = False
        errors.append("Policy artifact maxApplyCandidates must be an integer >= 1.")

    if payload.get("allowApplyEnvVar") != EXPECTED_ALLOW_APPLY_ENV_VAR:
        checks["allowApplyEnvVarMatch"] = False
        errors.append("Policy artifact allowApplyEnvVar must match BACKFILL_ALLOW_APPLY.")

    if not _is_bool(payload.get("allowApplyFlag")):
        checks["allowApplyFlagBool"] = False
        errors.append("Policy artifact allowApplyFlag must be boolean.")

    dry_run_summary = payload.get("dryRunSummary")
    if not isinstance(dry_run_summary, dict):
        checks["dryRunSummaryPresent"] = False
        errors.append("Policy artifact dryRunSummary must be an object.")
    else:
        if dry_run_summary.get("mode") != "dry-run":
            checks["dryRunMode"] = False
            errors.append("Policy artifact dryRunSummary.mode must be dry-run.")
        dry_run_candidate_count = _non_negative_int(dry_run_summary.get("candidateCount"))
        if (
            candidate_count is not None
            and dry_run_candidate_count is not None
            and dry_run_candidate_count != candidate_count
        ):
            checks["candidateCountParity"] = False
            errors.append("Policy artifact candidateCount must match dryRunSummary.candidateCount.")

    recommended_command = payload.get("recommendedCommand")
    if decision == "SKIP_APPLY":
        if recommended_command is not None:
            checks["recommendedCommandExpectation"] = False
            errors.append("Policy artifact recommendedCommand must be null for SKIP_APPLY.")
    elif decision in {"ACTION_REQUIRED", "ALLOW_APPLY"}:
        if not isinstance(recommended_command, str) or not recommended_command.strip():
            checks["recommendedCommandExpectation"] = False
            errors.append("Policy artifact recommendedCommand must be non-empty for actionable decisions.")

    return errors, checks


def validate_guarded_artifact(payload: Dict[str, Any]) -> Tuple[list[str], Dict[str, Any]]:
    errors: list[str] = []
    checks: Dict[str, Any] = {
        "generatedAtIso": True,
        "commandMatch": True,
        "policyPresent": True,
        "decisionAllowed": True,
        "applyPresenceExpectation": True,
        "applyMode": True,
        "applyUpdatedCountPresent": True,
    }

    if not _is_iso_datetime(payload.get("generatedAt")):
        checks["generatedAtIso"] = False
        errors.append("Guarded artifact generatedAt must be ISO-8601.")

    if payload.get("command") != EXPECTED_GUARDED_COMMAND:
        checks["commandMatch"] = False
        errors.append("Guarded artifact command marker is invalid.")

    policy = payload.get("policy")
    if not isinstance(policy, dict):
        checks["policyPresent"] = False
        errors.append("Guarded artifact policy payload must be an object.")
        return errors, checks

    decision = policy.get("decision")
    if decision not in ALLOWED_DECISIONS:
        checks["decisionAllowed"] = False
        errors.append("Guarded artifact policy decision must be allowed.")

    apply_payload = payload.get("apply")
    if decision in {"SKIP_APPLY", "ACTION_REQUIRED"}:
        if apply_payload is not None:
            checks["applyPresenceExpectation"] = False
            errors.append("Guarded artifact apply payload must be absent unless decision is ALLOW_APPLY.")
    elif decision == "ALLOW_APPLY":
        if not isinstance(apply_payload, dict):
            checks["applyPresenceExpectation"] = False
            errors.append("Guarded artifact apply payload must be present for ALLOW_APPLY.")
        else:
            if apply_payload.get("mode") != "apply":
                checks["applyMode"] = False
                errors.append("Guarded artifact apply.mode must equal apply.")
            updated_count = _non_negative_int(apply_payload.get("updatedCount"))
            if updated_count is None:
                checks["applyUpdatedCountPresent"] = False
                errors.append("Guarded artifact apply.updatedCount must be a non-negative integer.")

    return errors, checks


def validate_cross_artifacts(
    policy_payload: Dict[str, Any], guarded_payload: Dict[str, Any]
) -> Tuple[list[str], Dict[str, Any]]:
    errors: list[str] = []
    checks: Dict[str, Any] = {
        "decisionParity": True,
        "candidateCountParity": True,
        "maxApplyCandidatesParity": True,
        "allowApplyEnvVarParity": True,
        "applyCountWithinCandidates": True,
    }

    guarded_policy = guarded_payload.get("policy")
    if not isinstance(guarded_policy, dict):
        checks["decisionParity"] = False
        checks["candidateCountParity"] = False
        checks["maxApplyCandidatesParity"] = False
        checks["allowApplyEnvVarParity"] = False
        errors.append("Guarded artifact policy payload is missing for cross-artifact validation.")
        return errors, checks

    if policy_payload.get("decision") != guarded_policy.get("decision"):
        checks["decisionParity"] = False
        errors.append("Policy and guarded artifacts must have matching decision values.")

    if policy_payload.get("candidateCount") != guarded_policy.get("candidateCount"):
        checks["candidateCountParity"] = False
        errors.append("Policy and guarded artifacts must have matching candidateCount values.")

    if policy_payload.get("maxApplyCandidates") != guarded_policy.get("maxApplyCandidates"):
        checks["maxApplyCandidatesParity"] = False
        errors.append("Policy and guarded artifacts must have matching maxApplyCandidates values.")

    if policy_payload.get("allowApplyEnvVar") != guarded_policy.get("allowApplyEnvVar"):
        checks["allowApplyEnvVarParity"] = False
        errors.append("Policy and guarded artifacts must report the same allowApplyEnvVar value.")

    if guarded_policy.get("decision") == "ALLOW_APPLY":
        apply_payload = guarded_payload.get("apply")
        candidate_count = _non_negative_int(guarded_policy.get("candidateCount"))
        updated_count = (
            _non_negative_int(apply_payload.get("updatedCount"))
            if isinstance(apply_payload, dict)
            else None
        )
        if (
            candidate_count is not None
            and updated_count is not None
            and updated_count > candidate_count
        ):
            checks["applyCountWithinCandidates"] = False
            errors.append("Guarded artifact apply.updatedCount cannot exceed candidateCount.")

    return errors, checks


def _write_output(path: str | None, payload: Dict[str, Any]) -> None:
    if not path:
        return
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def validate_artifacts(policy_artifact: str, guarded_artifact: str) -> Dict[str, Any]:
    policy_payload = _load_json(policy_artifact, label="Policy")
    guarded_payload = _load_json(guarded_artifact, label="Guarded")

    policy_errors, policy_checks = validate_policy_artifact(policy_payload)
    guarded_errors, guarded_checks = validate_guarded_artifact(guarded_payload)
    cross_errors, cross_checks = validate_cross_artifacts(policy_payload, guarded_payload)

    errors = [*policy_errors, *guarded_errors, *cross_errors]
    return {
        "status": "pass" if not errors else "fail",
        "policyArtifact": policy_artifact,
        "guardedArtifact": guarded_artifact,
        "checks": {
            "policy": policy_checks,
            "guarded": guarded_checks,
            "cross": cross_checks,
        },
        "errorCount": len(errors),
        "errors": errors,
    }


def main() -> int:
    args = parse_args()
    try:
        result = validate_artifacts(args.policy_artifact, args.guarded_artifact)
    except ValueError as exc:
        print(str(exc))
        return 1

    _write_output(args.output, result)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
