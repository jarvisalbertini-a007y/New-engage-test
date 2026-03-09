#!/usr/bin/env python3
"""Generate a deterministic release-gate artifact fixture for contract validation."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from scripts.enforce_connector_release_gate import evaluate_release_gate


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate connector release gate artifact fixture."
    )
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector_release_gate_result.json",
        help="Path to output artifact JSON.",
    )
    parser.add_argument(
        "--profile",
        choices=["pass", "hold", "validation-fail"],
        default="pass",
        help="Fixture profile: pass (approved), hold (blocked), or validation-fail (blocked).",
    )
    return parser.parse_args()


def build_fixture_payload(profile: str = "pass"):
    if profile == "validation-fail":
        evidence = {
            "sloSummary": {
                "decision": "PROCEED",
                "alerts": [],
                "gates": {
                    "overallPassed": True,
                    "schemaCoveragePassed": True,
                    "schemaSampleSizePassed": True,
                    "orchestrationAttemptErrorPassed": True,
                    "orchestrationAttemptSkippedPassed": True,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 100.0,
                    "sampleCount": 30,
                    "minSampleCount": 25,
                    "schemaV2Count": 30,
                },
                "orchestrationAudit": {
                    "maxAttemptErrorCountThreshold": 5,
                    "observedAttemptErrorCount": 0,
                    "maxAttemptSkippedCountThreshold": 25,
                    "observedAttemptSkippedCount": 0,
                },
                "signoff": {"status": "READY_FOR_APPROVAL"},
            }
        }
        validation = {"valid": False}
        return evaluate_release_gate(evidence, validation)
    if profile == "hold":
        evidence = {
            "sloSummary": {
                "decision": "HOLD",
                "alerts": [
                    {
                        "gate": "schema_sample_size",
                        "severity": "medium",
                        "message": "Sales schema sample count is below minimum required threshold.",
                    }
                ],
                "gates": {
                    "overallPassed": False,
                    "schemaCoveragePassed": False,
                    "schemaSampleSizePassed": False,
                    "orchestrationAttemptErrorPassed": False,
                    "orchestrationAttemptSkippedPassed": False,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 80.0,
                    "sampleCount": 8,
                    "minSampleCount": 25,
                    "schemaV2Count": 6,
                },
                "orchestrationAudit": {
                    "maxAttemptErrorCountThreshold": 1,
                    "observedAttemptErrorCount": 3,
                    "maxAttemptSkippedCountThreshold": 2,
                    "observedAttemptSkippedCount": 4,
                },
                "signoff": {"status": "HOLD_REMEDIATION_REQUIRED"},
            }
        }
    else:
        evidence = {
            "sloSummary": {
                "decision": "PROCEED",
                "alerts": [],
                "gates": {
                    "overallPassed": True,
                    "schemaCoveragePassed": True,
                    "schemaSampleSizePassed": True,
                    "orchestrationAttemptErrorPassed": True,
                    "orchestrationAttemptSkippedPassed": True,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 100.0,
                    "sampleCount": 30,
                    "minSampleCount": 25,
                    "schemaV2Count": 30,
                },
                "orchestrationAudit": {
                    "maxAttemptErrorCountThreshold": 5,
                    "observedAttemptErrorCount": 0,
                    "maxAttemptSkippedCountThreshold": 25,
                    "observedAttemptSkippedCount": 0,
                },
                "signoff": {"status": "READY_FOR_APPROVAL"},
            }
        }
    validation = {"valid": True}
    return evaluate_release_gate(evidence, validation)


def main():
    args = parse_args()
    payload = build_fixture_payload(profile=args.profile)
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, indent=2)
    print(
        f"Wrote connector release gate artifact fixture ({args.profile}): {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
