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
    orchestration_audit = slo.get("orchestrationAudit") or {}
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
    lines.append("## Governance Handoff Export Placeholder")
    lines.append("- [ ] governance_handoff_export.json.status = READY|ACTION_REQUIRED")
    lines.append("- [ ] governance_handoff_export.json.reasonCodes = []")
    lines.append("- [ ] governance_handoff_export.json.reasonCodeCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.recommendedCommands = []")
    lines.append("- [ ] governance_handoff_export.json.recommendedCommandCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.reasonCodeCount equals len(governance_handoff_export.json.reasonCodes)")
    lines.append("- [ ] governance_handoff_export.json.recommendedCommandCount equals len(governance_handoff_export.json.recommendedCommands)")
    lines.append("- [ ] governance_handoff_export.json.totals.connectorRateLimitEventCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.present = true|false")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.available = true|false")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.passed = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.contractValid = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.valid = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.missingChecks.commands = []")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.missingChecks.workspace = []")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.missingCheckCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.command = <command>")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs.missingCheckCount equals len(commands)+len(workspace)")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.present = true|false")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.available = true|false")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.gatePassed = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.contractValid = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.valid = true|false|null")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.source = <source>")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.missingAliases = []")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.mismatchedAliases = []")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.missingAliasCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.mismatchedAliasCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.command = <command>")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.missingAliasCount equals len(commandAliases.missingAliases)")
    lines.append("- [ ] governance_handoff_export.json.commandAliases.mismatchedAliasCount equals len(commandAliases.mismatchedAliases)")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.status = READY|ACTION_REQUIRED")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.rolloutBlocked = true|false")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.ownerRole = Release Manager")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.reasonCodes = []")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.reasonCodeCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.recommendedCommands = []")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.recommendedCommandCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.runtimePrereqs.missingCheckCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.commandAliases.missingAliasCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.commandAliases.mismatchedAliasCount = <int>")
    lines.append("- [ ] governance_handoff_export.json.reasonCodes equals governance_handoff_export.json.governanceExport.reasonCodes")
    lines.append("- [ ] governance_handoff_export.json.recommendedCommands equals governance_handoff_export.json.governanceExport.recommendedCommands")
    lines.append("- [ ] governance_handoff_export.json.reasonCodeCount equals governance_handoff_export.json.governanceExport.reasonCodeCount")
    lines.append("- [ ] governance_handoff_export.json.recommendedCommandCount equals governance_handoff_export.json.governanceExport.recommendedCommandCount")
    lines.append("- [ ] governance_handoff_export.json.runtimePrereqs equals governance_handoff_export.json.governanceExport.runtimePrereqs")
    lines.append("- [ ] governance_handoff_export.json.commandAliases equals governance_handoff_export.json.governanceExport.commandAliases")
    lines.append("- [ ] governance_handoff_export.json.connectorRateLimit.byEndpoint = {}")
    lines.append("- [ ] governance_handoff_export.json.governanceExport.connectorRateLimit.byEndpoint = {}")
    lines.append("- [ ] governance_handoff_export.json.connectorRateLimit.byEndpoint equals governance_handoff_export.json.governanceExport.connectorRateLimit.byEndpoint")
    lines.append("- [ ] governance_handoff_export.json.totals.connectorRateLimitEventCount equals governance_handoff_export.json.connectorRateLimit.eventCount")
    lines.append("- [ ] governance_handoff_export.json.totals.runtimePrereqsMissingCheckCount equals governance_handoff_export.json.runtimePrereqs.missingCheckCount")
    lines.append("- [ ] governance_handoff_export.json.totals.commandAliasesMissingAliasCount equals governance_handoff_export.json.commandAliases.missingAliasCount")
    lines.append("- [ ] governance_handoff_export.json.totals.commandAliasesMismatchedAliasCount equals governance_handoff_export.json.commandAliases.mismatchedAliasCount")
    lines.append("")
    lines.append("## Governance History Export Placeholder")
    lines.append("- [ ] governance_history_export.json.status = READY|ACTION_REQUIRED")
    lines.append("- [ ] governance_history_export.json.reasonCodes = []")
    lines.append("- [ ] governance_history_export.json.reasonCodeCount = <int>")
    lines.append("- [ ] governance_history_export.json.recommendedCommands = []")
    lines.append("- [ ] governance_history_export.json.recommendedCommandCount = <int>")
    lines.append("- [ ] governance_history_export.json.reasonCodeCount equals len(governance_history_export.json.reasonCodes)")
    lines.append("- [ ] governance_history_export.json.recommendedCommandCount equals len(governance_history_export.json.recommendedCommands)")
    lines.append("- [ ] governance_history_export.json.retentionDays = 30")
    lines.append("- [ ] governance_history_export.json.limit = 50")
    lines.append("- [ ] governance_history_export.json.items = []")
    lines.append("- [ ] governance_history_export.json.totals.connectorRateLimitEventCount = <int>")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.present = true|false")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.available = true|false")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.passed = true|false|null")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.contractValid = true|false|null")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.valid = true|false|null")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.missingChecks.commands = []")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.missingChecks.workspace = []")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.missingCheckCount = <int>")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.command = <command>")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs.missingCheckCount equals len(commands)+len(workspace)")
    lines.append("- [ ] governance_history_export.json.commandAliases.present = true|false")
    lines.append("- [ ] governance_history_export.json.commandAliases.available = true|false")
    lines.append("- [ ] governance_history_export.json.commandAliases.gatePassed = true|false|null")
    lines.append("- [ ] governance_history_export.json.commandAliases.contractValid = true|false|null")
    lines.append("- [ ] governance_history_export.json.commandAliases.valid = true|false|null")
    lines.append("- [ ] governance_history_export.json.commandAliases.source = <source>")
    lines.append("- [ ] governance_history_export.json.commandAliases.missingAliases = []")
    lines.append("- [ ] governance_history_export.json.commandAliases.mismatchedAliases = []")
    lines.append("- [ ] governance_history_export.json.commandAliases.missingAliasCount = <int>")
    lines.append("- [ ] governance_history_export.json.commandAliases.mismatchedAliasCount = <int>")
    lines.append("- [ ] governance_history_export.json.commandAliases.command = <command>")
    lines.append("- [ ] governance_history_export.json.commandAliases.missingAliasCount equals len(commandAliases.missingAliases)")
    lines.append("- [ ] governance_history_export.json.commandAliases.mismatchedAliasCount equals len(commandAliases.mismatchedAliases)")
    lines.append("- [ ] governance_history_export.json.governanceExport.status = READY|ACTION_REQUIRED")
    lines.append("- [ ] governance_history_export.json.governanceExport.rolloutBlocked = true|false")
    lines.append("- [ ] governance_history_export.json.governanceExport.reasonCodes = []")
    lines.append("- [ ] governance_history_export.json.governanceExport.reasonCodeCount = <int>")
    lines.append("- [ ] governance_history_export.json.governanceExport.recommendedCommands = []")
    lines.append("- [ ] governance_history_export.json.governanceExport.recommendedCommandCount = <int>")
    lines.append("- [ ] governance_history_export.json.governanceExport.runtimePrereqs.missingCheckCount = <int>")
    lines.append("- [ ] governance_history_export.json.governanceExport.commandAliases.missingAliasCount = <int>")
    lines.append("- [ ] governance_history_export.json.governanceExport.commandAliases.mismatchedAliasCount = <int>")
    lines.append("- [ ] governance_history_export.json.reasonCodes equals governance_history_export.json.governanceExport.reasonCodes")
    lines.append("- [ ] governance_history_export.json.recommendedCommands equals governance_history_export.json.governanceExport.recommendedCommands")
    lines.append("- [ ] governance_history_export.json.reasonCodeCount equals governance_history_export.json.governanceExport.reasonCodeCount")
    lines.append("- [ ] governance_history_export.json.recommendedCommandCount equals governance_history_export.json.governanceExport.recommendedCommandCount")
    lines.append("- [ ] governance_history_export.json.runtimePrereqs equals governance_history_export.json.governanceExport.runtimePrereqs")
    lines.append("- [ ] governance_history_export.json.commandAliases equals governance_history_export.json.governanceExport.commandAliases")
    lines.append("- [ ] governance_history_export.json.connectorRateLimit.byEndpoint = {}")
    lines.append("- [ ] governance_history_export.json.governanceExport.connectorRateLimit.byEndpoint = {}")
    lines.append("- [ ] governance_history_export.json.connectorRateLimit.byEndpoint equals governance_history_export.json.governanceExport.connectorRateLimit.byEndpoint")
    lines.append("- [ ] governance_history_export.json.totals.connectorRateLimitEventCount equals governance_history_export.json.connectorRateLimit.eventCount")
    lines.append("- [ ] governance_history_export.json.totals.runtimePrereqsMissingCheckCount equals governance_history_export.json.runtimePrereqs.missingCheckCount")
    lines.append("- [ ] governance_history_export.json.totals.commandAliasesMissingAliasCount equals governance_history_export.json.commandAliases.missingAliasCount")
    lines.append("- [ ] governance_history_export.json.totals.commandAliasesMismatchedAliasCount equals governance_history_export.json.commandAliases.mismatchedAliasCount")
    lines.append("")
    lines.append("## Governance Schema Preflight Checklist")
    lines.append("- [ ] npm run verify:governance:schema:preflight")
    lines.append("- [ ] governanceSchemaPreflight.isSet = true|false")
    lines.append("- [ ] governanceSchemaPreflight.isValid = true|false")
    lines.append("- [ ] governanceSchemaPreflight.expectedExportSchemaVersion = <int>")
    lines.append("- [ ] governanceSchemaPreflight.detectedExportSchemaVersions = [<int>]")
    lines.append("- [ ] governanceSchemaPreflight.consistent = true")
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
    lines.append(
        f"- [ ] gates.orchestrationAttemptErrorPassed = {gates.get('orchestrationAttemptErrorPassed', 'n/a')}"
    )
    lines.append(
        f"- [ ] gates.orchestrationAttemptSkippedPassed = {gates.get('orchestrationAttemptSkippedPassed', 'n/a')}"
    )
    lines.append(
        "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = "
        + str(orchestration_audit.get("maxAttemptErrorCountThreshold", "n/a"))
    )
    lines.append(
        "- [ ] orchestrationAudit.observedAttemptErrorCount = "
        + str(orchestration_audit.get("observedAttemptErrorCount", "n/a"))
    )
    lines.append(
        "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = "
        + str(orchestration_audit.get("maxAttemptSkippedCountThreshold", "n/a"))
    )
    lines.append(
        "- [ ] orchestrationAudit.observedAttemptSkippedCount = "
        + str(orchestration_audit.get("observedAttemptSkippedCount", "n/a"))
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
