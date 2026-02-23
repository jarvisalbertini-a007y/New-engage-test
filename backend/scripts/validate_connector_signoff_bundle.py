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
]


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


def _contains_approved_role(signoff_md: str, role: str) -> bool:
    approved_markers = [
        f"- [x] {role}",
        f"- [X] {role}",
        f"{role}: APPROVED",
    ]
    return any(marker in signoff_md for marker in approved_markers)


def validate_signoff_bundle(evidence: dict, signoff_md: str, artifacts_dir: str):
    result = {
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "decision": (evidence.get("sloSummary") or {}).get("decision", "UNKNOWN"),
        "errors": [],
        "checks": {
            "requiredEvidenceFiles": [],
            "requiredApprovals": [],
            "schemaTraceability": [],
        },
    }

    slo = evidence.get("sloSummary") or {}
    signoff = slo.get("signoff") or {}
    required_evidence = signoff.get("requiredEvidence") or []
    required_approvals = signoff.get("requiredApprovals") or []

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
