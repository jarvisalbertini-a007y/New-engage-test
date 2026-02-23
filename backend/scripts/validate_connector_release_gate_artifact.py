#!/usr/bin/env python3
"""Validate connector release gate artifact shape for rollout audit reliability."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List


DEFAULT_ARTIFACT_PATH = Path("backend/test_reports/connector_release_gate_result.json")

REQUIRED_TOP_LEVEL_KEYS = [
    "evaluatedAt",
    "approved",
    "decision",
    "signoffStatus",
    "schemaCoverage",
    "checks",
    "failedChecks",
    "reasons",
]

REQUIRED_SCHEMA_COVERAGE_KEYS = [
    "passed",
    "observedPct",
    "thresholdPct",
    "sampleSizePassed",
    "sampleCount",
    "minSampleCount",
]

REQUIRED_CHECK_KEYS = [
    "validationPassed",
    "decisionIsProceed",
    "signoffReady",
    "noActiveAlerts",
    "schemaCoveragePassed",
    "schemaSampleSizePassed",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate connector release gate artifact contract."
    )
    parser.add_argument(
        "--artifact",
        default=str(DEFAULT_ARTIFACT_PATH),
        help="Path to connector release gate artifact JSON.",
    )
    return parser.parse_args()


def validate_artifact(payload: Dict[str, object]) -> List[str]:
    errors: List[str] = []

    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in payload:
            errors.append(f"Missing top-level key: {key}")

    if not isinstance(payload.get("approved"), bool):
        errors.append("approved must be boolean")

    decision = payload.get("decision")
    if not isinstance(decision, str) or not decision:
        errors.append("decision must be a non-empty string")

    schema_coverage = payload.get("schemaCoverage")
    if not isinstance(schema_coverage, dict):
        errors.append("schemaCoverage must be an object")
    else:
        for key in REQUIRED_SCHEMA_COVERAGE_KEYS:
            if key not in schema_coverage:
                errors.append(f"schemaCoverage missing key: {key}")

    checks = payload.get("checks")
    if not isinstance(checks, dict):
        errors.append("checks must be an object")
    else:
        for key in REQUIRED_CHECK_KEYS:
            if key not in checks:
                errors.append(f"checks missing key: {key}")
            elif not isinstance(checks.get(key), bool):
                errors.append(f"checks.{key} must be boolean")

    failed_checks = payload.get("failedChecks")
    if not isinstance(failed_checks, list):
        errors.append("failedChecks must be a list")

    reasons = payload.get("reasons")
    if not isinstance(reasons, list):
        errors.append("reasons must be a list")

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
        print("Connector release gate artifact validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Connector release gate artifact validation passed: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
