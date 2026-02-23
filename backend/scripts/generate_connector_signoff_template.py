#!/usr/bin/env python3
"""
Generate a connector rollout signoff markdown template from canary evidence JSON.

Usage:
  python backend/scripts/generate_connector_signoff_template.py \
    --evidence backend/test_reports/connector_canary_evidence.json \
    --output backend/test_reports/connector_signoff.md
"""

import argparse
import json
import os
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser(description="Generate connector signoff template")
    parser.add_argument("--evidence", required=True, help="Path to canary evidence JSON")
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector_signoff.md",
        help="Path to output markdown file",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    with open(args.evidence, "r", encoding="utf-8") as f:
        evidence = json.load(f)

    slo = evidence.get("sloSummary") or {}
    signoff = slo.get("signoff") or {}
    decision = slo.get("decision", "UNKNOWN")
    alerts = slo.get("alerts") or []
    actions = slo.get("rolloutActions") or []
    gates = slo.get("gates") or {}
    schema_coverage = slo.get("schemaCoverage") or {}
    required_approvals = signoff.get("requiredApprovals") or []
    required_evidence = signoff.get("requiredEvidence") or []

    lines = []
    lines.append("# Connector Rollout Signoff")
    lines.append("")
    lines.append(f"- Generated at: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"- Decision: {decision}")
    lines.append(f"- Signoff status: {signoff.get('status', 'UNKNOWN')}")
    lines.append("")
    lines.append("## Required Evidence")
    for item in required_evidence:
        lines.append(f"- [ ] {item}")
    if not required_evidence:
        lines.append("- [ ] No required evidence listed")
    lines.append("")
    lines.append("## Schema Evidence Traceability")
    lines.append(
        f"- [ ] schemaCoverage.thresholdPct = {schema_coverage.get('thresholdPct', 'n/a')}"
    )
    lines.append(
        f"- [ ] schemaCoverage.observedPct = {schema_coverage.get('observedPct', 'n/a')}"
    )
    lines.append(
        f"- [ ] schemaCoverage.sampleCount = {schema_coverage.get('sampleCount', 'n/a')}"
    )
    lines.append(
        f"- [ ] schemaCoverage.minSampleCount = {schema_coverage.get('minSampleCount', 'n/a')}"
    )
    lines.append(
        f"- [ ] gates.schemaCoveragePassed = {gates.get('schemaCoveragePassed', 'n/a')}"
    )
    lines.append(
        f"- [ ] gates.schemaSampleSizePassed = {gates.get('schemaSampleSizePassed', 'n/a')}"
    )
    lines.append("")
    lines.append("## Required Approvals")
    for approval in required_approvals:
        role = approval.get("role", "Unknown Role")
        lines.append(f"- [ ] {role}")
    if not required_approvals:
        lines.append("- [ ] No required approvals listed")
    lines.append("")
    lines.append("## Active Alerts")
    if alerts:
        for alert in alerts:
            lines.append(f"- {alert.get('gate', 'unknown')}: {alert.get('message', '')}")
    else:
        lines.append("- None")
    lines.append("")
    lines.append("## Rollout Actions")
    if actions:
        for action in actions:
            lines.append(
                f"- {action.get('priority', '')} | {action.get('ownerRole', '')}: {action.get('action', '')}"
            )
    else:
        lines.append("- None")
    lines.append("")
    lines.append("## Approval Signatures")
    lines.append("- Release Manager: ____________________")
    lines.append("- Integrations Engineer: ____________________")
    lines.append("- Sales Ops Lead: ____________________")
    lines.append("- Date: ____________________")

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Signoff template written to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
