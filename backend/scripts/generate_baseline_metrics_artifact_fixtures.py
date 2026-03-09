#!/usr/bin/env python3
"""Generate deterministic baseline metrics artifact fixtures for contract validation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from scripts.collect_baseline_metrics import DEFAULT_STEPS


COMMAND = "collect_baseline_metrics"
SUPPORTED_PROFILES = ("healthy", "step-failure", "orchestration-unavailable")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate deterministic baseline metrics artifact fixtures for "
            "validator contract checks."
        )
    )
    parser.add_argument(
        "--output-dir",
        default="backend/test_reports",
        help="Directory where fixture artifacts are written.",
    )
    parser.add_argument(
        "--prefix",
        default="baseline_metrics",
        help="Filename prefix for generated artifacts.",
    )
    return parser.parse_args()


def _profile_timestamp(profile: str) -> str:
    return {
        "healthy": "2026-03-02T01:00:00+00:00",
        "step-failure": "2026-03-02T01:05:00+00:00",
        "orchestration-unavailable": "2026-03-02T01:10:00+00:00",
    }[profile]


def _build_steps(profile: str, generated_at: str) -> list[Dict[str, Any]]:
    steps: list[Dict[str, Any]] = []
    for step in DEFAULT_STEPS:
        status = "pass"
        return_code = 0
        metrics: Dict[str, Any] = {}
        if profile == "step-failure" and step["label"] == "verify_frontend":
            status = "fail"
            return_code = 1
            metrics = {"frontendSuitesPassed": 0, "frontendSuitesTotal": 4}

        steps.append(
            {
                "label": step["label"],
                "command": " ".join(step["command"]),
                "startedAt": generated_at,
                "durationMs": 250,
                "status": status,
                "returnCode": return_code,
                "logPath": f"backend/test_reports/baseline_logs/{step['label']}.log",
                "metrics": metrics,
            }
        )
    return steps


def build_fixture_payload(profile: str) -> Dict[str, Any]:
    if profile not in SUPPORTED_PROFILES:
        raise ValueError(f"Unsupported profile: {profile}")

    generated_at = _profile_timestamp(profile)
    overall_status = "pass"
    if profile == "step-failure":
        overall_status = "fail"

    orchestration_gate: Dict[str, Any]
    if profile == "orchestration-unavailable":
        orchestration_gate = {
            "available": False,
            "source": "backend/test_reports/connector_canary_evidence.json",
            "reason": "connector_canary_evidence_missing",
        }
    else:
        orchestration_gate = {
            "available": True,
            "decision": "PROCEED",
            "attemptErrorGatePassed": True,
            "attemptSkippedGatePassed": True,
            "maxAttemptErrorCountThreshold": 5,
            "observedAttemptErrorCount": 1,
            "maxAttemptSkippedCountThreshold": 25,
            "observedAttemptSkippedCount": 3,
        }

    payload: Dict[str, Any] = {
        "generatedAt": generated_at,
        "runStartedAt": generated_at,
        "durationMs": 3000,
        "workspace": "/Users/AIL/Documents/EngageAI/EngageAI2",
        "overallStatus": overall_status,
        "schemaAdoption": {
            "available": True,
            "source": "backend/test_reports/connector_canary_evidence.json",
            "salesSchemaV2Pct": 100.0,
            "salesSchemaSampleCount": 30,
            "schemaGatePassed": True,
            "schemaSampleGatePassed": True,
            "schemaThresholdPct": 95,
            "schemaMinSampleCount": 25,
            "schemaObservedSampleCount": 30,
        },
        "runtimePrereqs": {
            "available": True,
            "passed": True,
            "source": "backend/test_reports/sales_runtime_prereqs.json",
            "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
            "generatedAt": generated_at,
            "validatedAt": generated_at,
            "command": "verify_sales_runtime_prereqs",
            "valid": True,
            "contractValid": True,
            "missingChecks": {"commands": [], "workspace": []},
            "missingCheckCount": 0,
        },
        "orchestrationGate": orchestration_gate,
        "releaseGateFixtures": {
            "sourceDir": "backend/test_reports",
            "requiredProfiles": ["pass", "hold", "validation-fail"],
            "profileCount": 3,
            "availableProfileCount": 3,
            "allProfilesAvailable": True,
            "profiles": {
                "pass": {
                    "profile": "pass",
                    "available": True,
                    "source": "backend/test_reports/connector_release_gate_result.json",
                    "approved": True,
                    "decision": "PROCEED",
                    "validationPassed": True,
                    "failedChecks": [],
                },
                "hold": {
                    "profile": "hold",
                    "available": True,
                    "source": "backend/test_reports/connector_release_gate_result_hold.json",
                    "approved": False,
                    "decision": "HOLD",
                    "validationPassed": True,
                    "failedChecks": ["decisionIsProceed"],
                },
                "validation-fail": {
                    "profile": "validation-fail",
                    "available": True,
                    "source": "backend/test_reports/connector_release_gate_result_validation_fail.json",
                    "approved": False,
                    "decision": "HOLD",
                    "validationPassed": False,
                    "failedChecks": ["validationPassed"],
                },
            },
        },
        "releaseGateFixturePolicy": {
            "passed": True,
            "requiredProfiles": ["pass", "hold", "validation-fail"],
            "missingProfiles": [],
            "message": "All required release-gate fixture profiles are present.",
        },
        "steps": _build_steps(profile, generated_at),
        "command": COMMAND,
    }

    return payload


def generate_fixtures(output_dir: str, prefix: str) -> Dict[str, Any]:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    profiles = []

    for profile in SUPPORTED_PROFILES:
        payload = build_fixture_payload(profile)
        artifact_path = output_path / f"{prefix}_{profile}.json"
        artifact_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        profiles.append(
            {
                "profile": profile,
                "overallStatus": payload.get("overallStatus"),
                "artifact": str(artifact_path),
            }
        )

    return {
        "generatedAt": "2026-03-02T01:15:00+00:00",
        "command": "generate_baseline_metrics_artifact_fixtures",
        "outputDir": str(output_path),
        "prefix": prefix,
        "profiles": profiles,
    }


def main() -> int:
    args = parse_args()
    manifest = generate_fixtures(args.output_dir, args.prefix)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
