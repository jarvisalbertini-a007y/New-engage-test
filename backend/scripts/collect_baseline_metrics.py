#!/usr/bin/env python3
"""Run baseline verification steps and emit a machine-readable metrics artifact."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_PATH = ROOT_DIR / "backend" / "test_reports" / "baseline_metrics.json"
LOG_DIR = ROOT_DIR / "backend" / "test_reports" / "baseline_logs"
DEFAULT_CANARY_EVIDENCE_PATH = ROOT_DIR / "backend" / "test_reports" / "connector_canary_evidence.json"
DEFAULT_RELEASE_GATE_FIXTURE_PATHS = {
    "pass": ROOT_DIR / "backend" / "test_reports" / "connector_release_gate_result.json",
    "hold": ROOT_DIR / "backend" / "test_reports" / "connector_release_gate_result_hold.json",
    "validation-fail": (
        ROOT_DIR / "backend" / "test_reports" / "connector_release_gate_result_validation_fail.json"
    ),
}

DEFAULT_STEPS = [
    {"label": "lint", "command": ["npm", "run", "lint"]},
    {"label": "build", "command": ["npm", "run", "build"]},
    {"label": "verify_frontend", "command": ["npm", "run", "verify:frontend"]},
    {"label": "verify_backend_sales", "command": ["npm", "run", "verify:backend:sales"]},
    {"label": "verify_smoke_campaign", "command": ["npm", "run", "verify:smoke:campaign"]},
    {"label": "verify_smoke_schema_gate", "command": ["npm", "run", "verify:smoke:schema-gate"]},
    {"label": "verify_smoke_release_gate", "command": ["npm", "run", "verify:smoke:release-gate"]},
    {
        "label": "verify_release_gate_artifact_fixtures",
        "command": ["npm", "run", "verify:release-gate:artifact:fixtures"],
    },
    {
        "label": "verify_release_gate_artifact_contract",
        "command": ["npm", "run", "verify:release-gate:artifact:contract"],
    },
    {"label": "verify_smoke_health", "command": ["npm", "run", "verify:smoke"]},
]


def _parse_test_metrics(output: str) -> Dict[str, object]:
    metrics: Dict[str, object] = {}

    suite_match = re.search(r"Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total", output)
    if suite_match:
        metrics["frontendSuitesPassed"] = int(suite_match.group(1))
        metrics["frontendSuitesTotal"] = int(suite_match.group(2))

    test_match = re.search(r"Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total", output)
    if test_match:
        metrics["frontendTestsPassed"] = int(test_match.group(1))
        metrics["frontendTestsTotal"] = int(test_match.group(2))

    pytest_matches = re.findall(r"(\d+)\s+passed(?:,\s+\d+\s+\w+)?\s+in\s+[\d.]+s", output)
    if pytest_matches:
        metrics["pytestPassedCounts"] = [int(value) for value in pytest_matches]

    health_match = re.search(r'\{"status":"healthy".*\}', output)
    if health_match:
        metrics["healthStatus"] = "healthy"

    return metrics


def _run_step(label: str, command: List[str]) -> Dict[str, object]:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"{label}.log"

    started_at = datetime.now(timezone.utc)
    start_perf = time.perf_counter()
    result = subprocess.run(
        command,
        cwd=ROOT_DIR,
        text=True,
        capture_output=True,
        check=False,
    )
    duration_ms = int((time.perf_counter() - start_perf) * 1000)

    combined_output = f"{result.stdout}\n{result.stderr}".strip()
    log_path.write_text(combined_output, encoding="utf-8")

    step_result: Dict[str, object] = {
        "label": label,
        "command": " ".join(command),
        "startedAt": started_at.isoformat(),
        "durationMs": duration_ms,
        "status": "pass" if result.returncode == 0 else "fail",
        "returnCode": result.returncode,
        "logPath": str(log_path),
        "metrics": _parse_test_metrics(combined_output),
    }
    return step_result


def _extract_schema_adoption(evidence: Dict[str, object]) -> Dict[str, object]:
    telemetry = evidence.get("telemetrySummary") or {}
    slo = evidence.get("sloSummary") or {}
    by_schema = telemetry.get("bySchemaVersion") or {}
    sales_by_schema = (telemetry.get("salesIntelligence") or {}).get("bySchemaVersion") or {}

    sales_total = sum(int(value) for value in sales_by_schema.values())
    sales_v2 = int(sales_by_schema.get("2", 0))
    sales_v2_pct = round((sales_v2 / sales_total * 100.0), 4) if sales_total > 0 else 100.0

    schema_gate = (slo.get("gates") or {}).get("schemaCoveragePassed")
    schema_sample_gate = (slo.get("gates") or {}).get("schemaSampleSizePassed")
    schema_threshold = (slo.get("schemaCoverage") or {}).get("thresholdPct")
    schema_min_sample_count = (slo.get("schemaCoverage") or {}).get("minSampleCount")
    schema_observed_sample_count = (slo.get("schemaCoverage") or {}).get("sampleCount")

    return {
        "available": True,
        "overallBySchemaVersion": by_schema,
        "salesBySchemaVersion": sales_by_schema,
        "salesSchemaV2Pct": sales_v2_pct,
        "salesSchemaSampleCount": sales_total,
        "salesSchemaV2Count": sales_v2,
        "schemaGatePassed": schema_gate,
        "schemaSampleGatePassed": schema_sample_gate,
        "schemaThresholdPct": schema_threshold,
        "schemaMinSampleCount": schema_min_sample_count,
        "schemaObservedSampleCount": schema_observed_sample_count,
    }


def _load_schema_adoption_metrics(path: Path = DEFAULT_CANARY_EVIDENCE_PATH) -> Dict[str, object]:
    if not path.exists():
        return {
            "available": False,
            "source": str(path),
            "reason": "connector_canary_evidence_missing",
        }
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "available": False,
            "source": str(path),
            "reason": "connector_canary_evidence_invalid_json",
        }

    metrics = _extract_schema_adoption(payload)
    metrics["source"] = str(path)
    return metrics


def _extract_release_gate_fixture_profile(
    profile: str, path: Path, payload: Dict[str, object]
) -> Dict[str, object]:
    checks = payload.get("checks") or {}
    failed_checks = payload.get("failedChecks") or []
    return {
        "profile": profile,
        "available": True,
        "source": str(path),
        "approved": payload.get("approved"),
        "decision": payload.get("decision"),
        "validationPassed": checks.get("validationPassed") if isinstance(checks, dict) else None,
        "failedChecks": failed_checks if isinstance(failed_checks, list) else [],
    }


def _load_release_gate_fixture_profiles(
    profile_paths: Dict[str, Path] = DEFAULT_RELEASE_GATE_FIXTURE_PATHS,
) -> Dict[str, object]:
    profiles: Dict[str, object] = {}
    for profile, path in profile_paths.items():
        if not path.exists():
            profiles[profile] = {
                "profile": profile,
                "available": False,
                "source": str(path),
                "reason": "artifact_missing",
            }
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            profiles[profile] = {
                "profile": profile,
                "available": False,
                "source": str(path),
                "reason": "artifact_invalid_json",
            }
            continue
        profiles[profile] = _extract_release_gate_fixture_profile(profile, path, payload)

    available_count = sum(
        1
        for profile in profile_paths.keys()
        if (profiles.get(profile) or {}).get("available") is True
    )
    all_available = available_count == len(profile_paths)
    sample_source = next(iter(profile_paths.values()))
    return {
        "sourceDir": str(sample_source.parent),
        "requiredProfiles": list(profile_paths.keys()),
        "profileCount": len(profile_paths),
        "availableProfileCount": available_count,
        "allProfilesAvailable": all_available,
        "profiles": profiles,
    }


def _evaluate_release_gate_fixture_policy(release_gate_fixtures: Dict[str, object]) -> Dict[str, object]:
    required_profiles = release_gate_fixtures.get("requiredProfiles") or []
    profiles = release_gate_fixtures.get("profiles") or {}
    missing_profiles = [
        profile
        for profile in required_profiles
        if (profiles.get(profile) or {}).get("available") is not True
    ]
    passed = len(missing_profiles) == 0
    return {
        "passed": passed,
        "requiredProfiles": required_profiles,
        "missingProfiles": missing_profiles,
        "message": (
            "All required release-gate fixture profiles are present."
            if passed
            else "Release-gate fixture profile(s) missing during baseline metrics collection."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect baseline verification metrics.")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path for the JSON metrics artifact.",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    run_started_at = datetime.now(timezone.utc)
    start_perf = time.perf_counter()
    steps: List[Dict[str, object]] = []

    for step in DEFAULT_STEPS:
        result = _run_step(step["label"], step["command"])
        steps.append(result)
        if result["status"] != "pass":
            break

    duration_ms = int((time.perf_counter() - start_perf) * 1000)
    steps_passed = all(step["status"] == "pass" for step in steps) and len(steps) == len(DEFAULT_STEPS)
    release_gate_fixtures = _load_release_gate_fixture_profiles()
    release_gate_fixture_policy = _evaluate_release_gate_fixture_policy(release_gate_fixtures)
    overall_status = (
        "pass"
        if steps_passed and release_gate_fixture_policy.get("passed") is True
        else "fail"
    )

    artifact = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runStartedAt": run_started_at.isoformat(),
        "durationMs": duration_ms,
        "workspace": str(ROOT_DIR),
        "overallStatus": overall_status,
        "schemaAdoption": _load_schema_adoption_metrics(),
        "releaseGateFixtures": release_gate_fixtures,
        "releaseGateFixturePolicy": release_gate_fixture_policy,
        "steps": steps,
    }
    output_path.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    print(f"Wrote baseline metrics artifact: {output_path}")

    return 0 if overall_status == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
