#!/usr/bin/env python3
"""
Enforce connector release gate from canary evidence + signoff validation output.

Usage:
  python backend/scripts/enforce_connector_release_gate.py \
    --evidence backend/test_reports/connector_canary_evidence.json \
    --validation backend/test_reports/connector_signoff_validation.json \
    --output backend/test_reports/connector_release_gate_result.json
"""

import argparse
import json
import os
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser(description="Enforce connector release gate")
    parser.add_argument("--evidence", required=True, help="Path to canary evidence JSON")
    parser.add_argument(
        "--validation",
        required=True,
        help="Path to signoff validation JSON",
    )
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector_release_gate_result.json",
        help="Path to output release gate result JSON",
    )
    return parser.parse_args()


def _load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_release_gate(evidence: dict, validation: dict) -> dict:
    slo = evidence.get("sloSummary") or {}
    decision = slo.get("decision", "UNKNOWN")
    signoff = slo.get("signoff") or {}
    signoff_status = signoff.get("status", "UNKNOWN")
    alerts = slo.get("alerts") or []
    gates = slo.get("gates") or {}
    schema_coverage = slo.get("schemaCoverage") or {}
    schema_gate_passed = bool(gates.get("schemaCoveragePassed", False))
    schema_sample_gate_passed = bool(gates.get("schemaSampleSizePassed", False))
    schema_threshold = schema_coverage.get("thresholdPct")
    schema_observed = schema_coverage.get("observedPct")
    schema_sample_count = schema_coverage.get("sampleCount")
    schema_min_sample_count = schema_coverage.get("minSampleCount")
    orchestration_audit = slo.get("orchestrationAudit") or {}
    orchestration_error_gate_passed = bool(
        gates.get("orchestrationAttemptErrorPassed", False)
    )
    orchestration_skipped_gate_passed = bool(
        gates.get("orchestrationAttemptSkippedPassed", False)
    )
    orchestration_error_threshold = orchestration_audit.get(
        "maxAttemptErrorCountThreshold"
    )
    orchestration_error_observed = orchestration_audit.get(
        "observedAttemptErrorCount"
    )
    orchestration_skipped_threshold = orchestration_audit.get(
        "maxAttemptSkippedCountThreshold"
    )
    orchestration_skipped_observed = orchestration_audit.get(
        "observedAttemptSkippedCount"
    )

    checks = {
        "validationPassed": bool(validation.get("valid")),
        "decisionIsProceed": decision == "PROCEED",
        "signoffReady": signoff_status == "READY_FOR_APPROVAL",
        "noActiveAlerts": len(alerts) == 0,
        "schemaCoveragePassed": schema_gate_passed,
        "schemaSampleSizePassed": schema_sample_gate_passed,
        "orchestrationAttemptErrorPassed": orchestration_error_gate_passed,
        "orchestrationAttemptSkippedPassed": orchestration_skipped_gate_passed,
    }
    failed_checks = [name for name, passed in checks.items() if not passed]
    approved = len(failed_checks) == 0

    reasons = []
    if not checks["validationPassed"]:
        reasons.append("Signoff validation failed.")
    if not checks["decisionIsProceed"]:
        reasons.append(f"SLO decision is {decision}, expected PROCEED.")
    if not checks["signoffReady"]:
        reasons.append(f"Signoff status is {signoff_status}, expected READY_FOR_APPROVAL.")
    if not checks["noActiveAlerts"]:
        reasons.append("SLO alerts are still active.")
    if not checks["schemaCoveragePassed"]:
        if schema_observed is not None and schema_threshold is not None:
            reasons.append(
                f"Schema coverage is {schema_observed}%, below threshold {schema_threshold}%."
            )
        else:
            reasons.append("Schema coverage gate is not passed.")
    if not checks["schemaSampleSizePassed"]:
        if schema_sample_count is not None and schema_min_sample_count is not None:
            reasons.append(
                f"Schema sample size is {schema_sample_count}, below minimum {schema_min_sample_count}."
            )
        else:
            reasons.append("Schema sample size gate is not passed.")
    if not checks["orchestrationAttemptErrorPassed"]:
        if (
            orchestration_error_observed is not None
            and orchestration_error_threshold is not None
        ):
            reasons.append(
                "Orchestration attempt error count is "
                f"{orchestration_error_observed}, above threshold "
                f"{orchestration_error_threshold}."
            )
        else:
            reasons.append("Orchestration attempt error gate is not passed.")
    if not checks["orchestrationAttemptSkippedPassed"]:
        if (
            orchestration_skipped_observed is not None
            and orchestration_skipped_threshold is not None
        ):
            reasons.append(
                "Orchestration attempt skipped count is "
                f"{orchestration_skipped_observed}, above threshold "
                f"{orchestration_skipped_threshold}."
            )
        else:
            reasons.append("Orchestration attempt skipped gate is not passed.")

    return {
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "approved": approved,
        "decision": decision,
        "signoffStatus": signoff_status,
        "schemaCoverage": {
            "passed": schema_gate_passed,
            "observedPct": schema_observed,
            "thresholdPct": schema_threshold,
            "sampleSizePassed": schema_sample_gate_passed,
            "sampleCount": schema_sample_count,
            "minSampleCount": schema_min_sample_count,
        },
        "orchestrationAudit": {
            "attemptErrorPassed": orchestration_error_gate_passed,
            "observedAttemptErrorCount": orchestration_error_observed,
            "maxAttemptErrorCountThreshold": orchestration_error_threshold,
            "attemptSkippedPassed": orchestration_skipped_gate_passed,
            "observedAttemptSkippedCount": orchestration_skipped_observed,
            "maxAttemptSkippedCountThreshold": orchestration_skipped_threshold,
        },
        "checks": checks,
        "failedChecks": failed_checks,
        "reasons": reasons,
    }


def main():
    args = parse_args()
    evidence = _load_json(args.evidence)
    validation = _load_json(args.validation)
    result = evaluate_release_gate(evidence, validation)

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(json.dumps(result, indent=2))
    return 0 if result.get("approved") else 1


if __name__ == "__main__":
    raise SystemExit(main())
