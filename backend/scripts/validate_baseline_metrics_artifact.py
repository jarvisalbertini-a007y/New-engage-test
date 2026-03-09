#!/usr/bin/env python3
"""Validate baseline metrics artifact shape for CI/reporting reliability."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from scripts.collect_baseline_metrics import DEFAULT_OUTPUT_PATH, DEFAULT_STEPS


REQUIRED_TOP_LEVEL_KEYS = [
    "generatedAt",
    "runStartedAt",
    "durationMs",
    "workspace",
    "overallStatus",
    "schemaAdoption",
    "runtimePrereqs",
    "orchestrationGate",
    "releaseGateFixtures",
    "releaseGateFixturePolicy",
    "steps",
]

REQUIRED_STEP_KEYS = [
    "label",
    "command",
    "startedAt",
    "durationMs",
    "status",
    "returnCode",
    "logPath",
    "metrics",
]


def _is_non_negative_int(value: object) -> bool:
    return isinstance(value, int) and value >= 0


def _is_string_list(value: object) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def parse_args():
    parser = argparse.ArgumentParser(description="Validate baseline metrics artifact contract.")
    parser.add_argument(
        "--artifact",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path to baseline metrics JSON artifact.",
    )
    return parser.parse_args()


def validate_artifact(payload: Dict[str, object]) -> List[str]:
    errors: List[str] = []

    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in payload:
            errors.append(f"Missing top-level key: {key}")

    overall_status = payload.get("overallStatus")
    if overall_status not in {"pass", "fail"}:
        errors.append("overallStatus must be pass or fail")

    runtime_prereqs = payload.get("runtimePrereqs")
    if not isinstance(runtime_prereqs, dict):
        errors.append("runtimePrereqs must be an object")
    else:
        if not isinstance(runtime_prereqs.get("available"), bool):
            errors.append("runtimePrereqs.available must be a boolean")
        if runtime_prereqs.get("available") is not True:
            errors.append("runtimePrereqs.available must be true")

        if not isinstance(runtime_prereqs.get("passed"), bool):
            errors.append("runtimePrereqs.passed must be a boolean")
        elif runtime_prereqs.get("passed") is not True:
            errors.append("runtimePrereqs.passed must be true")

        if not isinstance(runtime_prereqs.get("contractValid"), bool):
            errors.append("runtimePrereqs.contractValid must be a boolean")
        elif runtime_prereqs.get("contractValid") is not True:
            errors.append("runtimePrereqs.contractValid must be true")

        if not isinstance(runtime_prereqs.get("valid"), bool):
            errors.append("runtimePrereqs.valid must be a boolean")
        elif runtime_prereqs.get("valid") is not True:
            errors.append("runtimePrereqs.valid must be true")

        command = runtime_prereqs.get("command")
        if not isinstance(command, str) or not command:
            errors.append("runtimePrereqs.command must be a non-empty string")

        missing_checks = runtime_prereqs.get("missingChecks")
        if not isinstance(missing_checks, dict):
            errors.append("runtimePrereqs.missingChecks must be an object")
        else:
            if not _is_string_list(missing_checks.get("commands")):
                errors.append("runtimePrereqs.missingChecks.commands must be a list of strings")
            if not _is_string_list(missing_checks.get("workspace")):
                errors.append("runtimePrereqs.missingChecks.workspace must be a list of strings")
            if _is_string_list(missing_checks.get("commands")) and missing_checks.get("commands"):
                errors.append("runtimePrereqs.missingChecks.commands must be empty")
            if _is_string_list(missing_checks.get("workspace")) and missing_checks.get("workspace"):
                errors.append("runtimePrereqs.missingChecks.workspace must be empty")

        missing_check_count = runtime_prereqs.get("missingCheckCount")
        if not _is_non_negative_int(missing_check_count):
            errors.append("runtimePrereqs.missingCheckCount must be a non-negative integer")
        elif missing_check_count != 0:
            errors.append("runtimePrereqs.missingCheckCount must be 0")

    orchestration_gate = payload.get("orchestrationGate")
    if not isinstance(orchestration_gate, dict):
        errors.append("orchestrationGate must be an object")
    else:
        if "available" not in orchestration_gate:
            errors.append("orchestrationGate missing key: available")
        elif not isinstance(orchestration_gate.get("available"), bool):
            errors.append("orchestrationGate.available must be a boolean")

        if orchestration_gate.get("available") is True:
            required_keys = [
                "decision",
                "attemptErrorGatePassed",
                "attemptSkippedGatePassed",
                "maxAttemptErrorCountThreshold",
                "observedAttemptErrorCount",
                "maxAttemptSkippedCountThreshold",
                "observedAttemptSkippedCount",
            ]
            for key in required_keys:
                if key not in orchestration_gate:
                    errors.append(f"orchestrationGate missing key: {key}")

            if not isinstance(orchestration_gate.get("decision"), str):
                errors.append("orchestrationGate.decision must be a string when available=true")
            if not isinstance(orchestration_gate.get("attemptErrorGatePassed"), bool):
                errors.append(
                    "orchestrationGate.attemptErrorGatePassed must be a boolean when available=true"
                )
            if not isinstance(orchestration_gate.get("attemptSkippedGatePassed"), bool):
                errors.append(
                    "orchestrationGate.attemptSkippedGatePassed must be a boolean when available=true"
                )

            count_fields = [
                "maxAttemptErrorCountThreshold",
                "observedAttemptErrorCount",
                "maxAttemptSkippedCountThreshold",
                "observedAttemptSkippedCount",
            ]
            for field in count_fields:
                if not _is_non_negative_int(orchestration_gate.get(field)):
                    errors.append(
                        f"orchestrationGate.{field} must be a non-negative integer when available=true"
                    )

    release_gate_fixtures = payload.get("releaseGateFixtures")
    if not isinstance(release_gate_fixtures, dict):
        errors.append("releaseGateFixtures must be an object")
    else:
        profiles = release_gate_fixtures.get("profiles")
        if not isinstance(profiles, dict):
            errors.append("releaseGateFixtures.profiles must be an object")
        else:
            required_profiles = ["pass", "hold", "validation-fail"]
            for profile in required_profiles:
                value = profiles.get(profile)
                if not isinstance(value, dict):
                    errors.append(
                        f"releaseGateFixtures.profiles.{profile} must be an object"
                    )
                    continue
                if "available" not in value:
                    errors.append(
                        f"releaseGateFixtures.profiles.{profile} missing key: available"
                    )
                if "source" not in value:
                    errors.append(
                        f"releaseGateFixtures.profiles.{profile} missing key: source"
                    )
        if release_gate_fixtures.get("allProfilesAvailable") is not True:
            errors.append("releaseGateFixtures.allProfilesAvailable must be true")

    fixture_policy = payload.get("releaseGateFixturePolicy")
    if not isinstance(fixture_policy, dict):
        errors.append("releaseGateFixturePolicy must be an object")
    else:
        if fixture_policy.get("passed") is not True:
            errors.append("releaseGateFixturePolicy.passed must be true")
        missing_profiles = fixture_policy.get("missingProfiles")
        if not isinstance(missing_profiles, list):
            errors.append("releaseGateFixturePolicy.missingProfiles must be a list")
        elif len(missing_profiles) > 0:
            errors.append("releaseGateFixturePolicy.missingProfiles must be empty")

    steps = payload.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("steps must be a non-empty list")
        return errors

    required_labels = [step["label"] for step in DEFAULT_STEPS]
    actual_labels = [step.get("label") for step in steps if isinstance(step, dict)]
    if actual_labels != required_labels:
        errors.append(
            "step labels/order mismatch: "
            f"expected {required_labels}, got {actual_labels}"
        )

    for idx, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"step[{idx}] must be an object")
            continue
        for key in REQUIRED_STEP_KEYS:
            if key not in step:
                errors.append(f"step[{idx}] missing key: {key}")

        status = step.get("status")
        if status not in {"pass", "fail"}:
            errors.append(f"step[{idx}] has invalid status: {status}")

    return errors


def main() -> int:
    args = parse_args()
    artifact_path = Path(args.artifact)
    if not artifact_path.exists():
        print(f"Artifact does not exist: {artifact_path}")
        return 1

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"Artifact is not valid JSON: {artifact_path}")
        return 1

    errors = validate_artifact(payload)
    if errors:
        print("Baseline metrics artifact validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Baseline metrics artifact validation passed: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
