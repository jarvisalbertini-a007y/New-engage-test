from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_RELEASE_SIGNOFF.md"
)


def _text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_connector_release_signoff_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_connector_release_signoff_runbook_includes_schema_traceability_contract():
    content = _text()
    required_fragments = [
        "required evidence files, required approvals, and schema traceability checklist markers are present",
        "schemaCoverage.thresholdPct",
        "schemaCoverage.observedPct",
        "schemaCoverage.sampleCount",
        "schemaCoverage.minSampleCount",
        "gates.schemaCoveragePassed",
        "gates.schemaSampleSizePassed",
        "gates.orchestrationAttemptErrorPassed",
        "gates.orchestrationAttemptSkippedPassed",
        "orchestrationAudit.maxAttemptErrorCountThreshold",
        "orchestrationAudit.observedAttemptErrorCount",
        "orchestrationAudit.maxAttemptSkippedCountThreshold",
        "orchestrationAudit.observedAttemptSkippedCount",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_includes_governance_weekly_export_packet_checklist():
    content = _text()
    required_fragments = [
        "Governance Weekly Export Packet Checklist",
        "npm run verify:governance:weekly",
        "npm run verify:governance:weekly:endpoint:contract",
        "npm run verify:governance:packet:fixture",
        "npm run verify:governance:packet:validate",
        "npm run verify:governance:packet:contract",
        "npm run verify:governance:schema:preflight",
        "npm run verify:governance:weekly:cleanup:policy",
        "npm run verify:governance:weekly:cleanup:apply:guarded",
        "npm run verify:smoke:governance-export-guard",
        "npm run verify:smoke:governance-schema-endpoint",
        "npm run verify:smoke:governance-history-retention",
        "npm run verify:smoke:governance-connector-pressure",
        "npm run verify:smoke:governance-duplicate-artifact-remediation",
        "npm run verify:smoke:governance-packet",
        "npm run verify:smoke:governance-schema-ui",
        "Export Governance Handoff JSON",
        "Export Governance History JSON",
        "Export Governance Schema JSON",
        "## Governance Schema Preflight Checklist",
        "governanceSchemaPreflight.isSet",
        "governanceSchemaPreflight.isValid",
        "governanceSchemaPreflight.expectedExportSchemaVersion",
        "governanceSchemaPreflight.detectedExportSchemaVersions",
        "governanceSchemaPreflight.consistent",
        "exportSchemaVersion",
        "governanceExport.exportSchemaVersion",
        "items[].exportSchemaVersion",
        "governance report/export/history `status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`",
        "governance handoff/history `governanceExport.status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`",
        "governance history `items[].status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`",
        "governance report `governanceStatusCounts` keys must be canonical status tokens",
        "governance report `traceabilityDecisionCounts` keys must be canonical decision tokens (`PROCEED`, `HOLD`, `UNKNOWN`)",
        "malformed or punctuation-only governance/decision tokens should collapse to `UNKNOWN`",
        "npm run verify:governance:weekly:report:contract",
        "packet fixture status normalization accepts separator/case variants (for example `action-required`) and emits canonical status tokens (`READY` or `ACTION_REQUIRED`)",
        "punctuation-only packet status tokens are invalid and must fail packet validation",
        "connector parity endpoint keys are normalized (`apollo search` and `apollo-search` reconcile to `apollo_search`)",
        "reasonCodeCount` should equal `len(reasonCodes)` in governance report/export/history payloads",
        "recommendedCommandCount` should equal `len(recommendedCommands)` in governance report/export/history payloads",
        "governance report/export/history `runtimePrereqs.present` should be a boolean and match nested handoff/history export envelopes",
        "governance report/export/history `runtimePrereqs.available`, `runtimePrereqs.passed`, `runtimePrereqs.contractValid`, and `runtimePrereqs.valid` should be coherent for rollout decisions",
        "governance report/export/history `runtimePrereqs.missingCheckCount` should reconcile with `runtimePrereqs.missingChecks.commands` + `runtimePrereqs.missingChecks.workspace`",
        "governance handoff/history `runtimePrereqs.command` should be populated and match `governanceExport.runtimePrereqs.command`",
        "governance handoff/history `governanceExport.runtimePrereqs` should match top-level `runtimePrereqs` fields",
        "governance handoff/history `totals.runtimePrereqsMissingCheckCount` should equal `runtimePrereqs.missingCheckCount`",
        "governance handoff/history `runtimePrereqsMissingCheckCount` should stay consistent between handoff and history artifacts",
        "governance report/export/history `commandAliases.present` should be a boolean and match nested handoff/history export envelopes",
        "governance report/export/history `commandAliases.available`, `commandAliases.gatePassed`, `commandAliases.contractValid`, and `commandAliases.valid` should be coherent for rollout decisions",
        "governance report/export/history `commandAliases.missingAliasCount` should reconcile with `len(commandAliases.missingAliases)`",
        "governance report/export/history `commandAliases.mismatchedAliasCount` should reconcile with `len(commandAliases.mismatchedAliases)`",
        "governance handoff/history `commandAliases.command` should be populated and match `governanceExport.commandAliases.command`",
        "governance handoff/history `governanceExport.commandAliases` should match top-level `commandAliases` fields",
        "governance handoff/history `totals.commandAliasesMissingAliasCount` should equal `commandAliases.missingAliasCount`",
        "governance handoff/history `totals.commandAliasesMismatchedAliasCount` should equal `commandAliases.mismatchedAliasCount`",
        "governance handoff/history `commandAliases` missing/mismatched counts and command should stay consistent between handoff and history artifacts",
        "governance handoff/history `reasonCodeCount` should equal `len(reasonCodes)` and match `governanceExport.reasonCodeCount`",
        "governance handoff/history `recommendedCommandCount` should equal `len(recommendedCommands)` and match `governanceExport.recommendedCommandCount`",
        "schemaVersionCounts",
        "duplicateArtifactNames",
        "totals.connectorRateLimitEventCount",
        "connectorRateLimit.eventCount",
        "connectorRateLimit.byEndpoint",
        "connectorRateLimit.pressure.label",
        "governanceExport.connectorRateLimit.pressure.label",
        "connectorRateLimit.eventCount` equals `governanceExport.connectorRateLimit.eventCount",
        "connectorRateLimit.byEndpoint` equals `governanceExport.connectorRateLimit.byEndpoint",
        "connectorRateLimit.pressure.label` equals `governanceExport.connectorRateLimit.pressure.label",
        "totals.connectorRateLimitEventCount` equals `connectorRateLimit.eventCount",
        "connectorPressureParity.eventCountMatchesNested",
        "connectorPressureParity.eventCountMatchesTotals",
        "connectorPressureParity.byEndpointMatchesNested",
        "connectorPressureParity.pressureLabelMatchesNested",
        "sendgridWebhookTimestamp.eventCount",
        "sendgridWebhookTimestamp.timestampAnomalyCountTotal",
        "sendgridWebhookTimestamp.pressureLabelCounts",
        "sendgridWebhookTimestamp.pressureHintCounts",
        "sendgridWebhookTimestamp.timestampAgeBucketCounts",
        "sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts",
        "governanceExport.sendgridWebhookTimestamp.eventCount",
        "governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal",
        "sendgridWebhookTimestamp.eventCount` equals `governanceExport.sendgridWebhookTimestamp.eventCount",
        "sendgridWebhookTimestamp.timestampAnomalyCountTotal` equals `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal",
        "totals.sendgridWebhookTimestampEventCount` equals `sendgridWebhookTimestamp.eventCount",
        "totals.sendgridWebhookTimestampAnomalyCountTotal` equals `sendgridWebhookTimestamp.timestampAnomalyCountTotal",
        "sendgridWebhookTimestampParity.eventCountMatchesNested",
        "sendgridWebhookTimestampParity.eventCountMatchesTotals",
        "sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested",
        "sendgridWebhookTimestampParity.anomalyCountTotalMatchesTotals",
        "sendgridWebhookTimestampParity.pressureLabelCountsMatchNested",
        "sendgridWebhookTimestampParity.pressureHintCountsMatchNested",
        "sendgridWebhookTimestampParity.ageBucketCountsMatchNested",
        "sendgridWebhookTimestampParity.anomalyEventTypeCountsMatchNested",
        "sendgridWebhookTimestampParity.latestEventAtMatchesNested",
        "runtimePrereqs.present",
        "runtimePrereqs.passed",
        "runtimePrereqs.contractValid",
        "runtimePrereqs.valid",
        "runtimePrereqs.missingCheckCount",
        "runtimePrereqs.command",
        "commandAliases.present",
        "commandAliases.available",
        "commandAliases.gatePassed",
        "commandAliases.contractValid",
        "commandAliases.valid",
        "commandAliases.missingAliasCount",
        "commandAliases.mismatchedAliasCount",
        "commandAliases.command",
        "governanceExport.commandAliases.missingAliasCount",
        "governanceExport.commandAliases.mismatchedAliasCount",
        "governanceExport.commandAliases.command",
        "commandAliases` equals `governanceExport.commandAliases",
        "totals.commandAliasesMissingAliasCount` equals `commandAliases.missingAliasCount",
        "totals.commandAliasesMismatchedAliasCount` equals `commandAliases.mismatchedAliasCount",
        "governanceExport.runtimePrereqs.missingCheckCount",
        "governanceExport.runtimePrereqs.command",
        "runtimePrereqs` equals `governanceExport.runtimePrereqs",
        "totals.runtimePrereqsMissingCheckCount` equals `runtimePrereqs.missingCheckCount",
        "totals.runtimePrereqsFailingArtifactCount",
        "reasonCodeCount` equals `len(reasonCodes)`",
        "recommendedCommandCount` equals `len(recommendedCommands)`",
        "governanceExport.reasonCodeCount` equals `reasonCodeCount`",
        "governanceExport.recommendedCommandCount` equals `recommendedCommandCount`",
        "npm run verify:smoke:connector-input-validation",
        "connectorValidation.eventCount",
        "connectorValidation.byEndpoint",
        "connectorValidation.byProvider",
        "connectorValidation.byField",
        "connectorValidation.byReason",
        "connectorValidation.latestEventAt",
        "governance handoff/history `connectorValidation.eventCount` equals `governanceExport.connectorValidation.eventCount`",
        "governance handoff/history `connectorValidation.byEndpoint` equals `governanceExport.connectorValidation.byEndpoint`",
        "governance handoff/history `connectorValidation.byProvider` equals `governanceExport.connectorValidation.byProvider`",
        "governance handoff/history `connectorValidation.byField` equals `governanceExport.connectorValidation.byField`",
        "governance handoff/history `connectorValidation.byReason` equals `governanceExport.connectorValidation.byReason`",
        "connectorValidationEndpoint",
        "connectorValidationField",
        "connectorValidationReason",
        "connectorValidationErrorCode",
        "connectorValidationReceived",
        "`connectorValidationErrorCode` values are limited to `invalid_request_bounds` and `invalid_request_required_field`",
        "backend/test_reports/connector_governance_weekly_report.json",
        "generate_governance_packet_fixture.py",
        "validate_governance_packet_artifacts.py",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_includes_governance_packet_regeneration_escalation_path():
    content = _text()
    required_fragments = [
        "Governance Packet Regeneration Escalation Path",
        "npm run verify:governance:packet:fixture",
        "npm run verify:governance:packet:validate",
        "npm run verify:governance:packet:contract",
        "npm run verify:governance:weekly:endpoint:contract",
        "npm run verify:smoke:governance-packet",
        "npm run verify:smoke:governance-connector-pressure",
        "npm run verify:smoke:traceability-ci-guard",
        "backend/test_reports/governance_packet_validation.json",
        "GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS",
        "npm run verify:ci:sales:extended",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_includes_telemetry_export_consumer_compatibility_check():
    content = _text()
    required_fragments = [
        "Telemetry Export Consumer Compatibility Check",
        "npm run verify:smoke:telemetry-packet-filter",
        "npm run verify:smoke:telemetry-export-distribution",
        "npm run verify:smoke:connector-lookups-export",
        "npm run verify:smoke:connector-input-validation",
        "recentEventsFilter",
        "recentEventsTotalCount",
        "recentEventsFilteredCount",
        "recentEventsPacketValidationCount",
        "recentEventsNonPacketCount",
        "exportSchemaVersion",
        "exportRequestedWindowDays",
        "exportRequestedLimit",
        "exportRecentEventsFilter",
        "exportRecentEventsPacketValidationCount",
        "exportRecentEventsNonPacketCount",
        "Export Company Lookup JSON",
        "Export Apollo Lookup JSON",
        "exportType=connector-company-lookup",
        "exportType=connector-apollo-lookup",
        "selectedProvider",
        "providerOrder",
        "storagePolicy",
        "governance handoff/history `exportSchemaVersion`",
        "governance handoff/history `governanceExport.exportSchemaVersion`",
        "governance report/export/history `connectorRateLimit.pressure.label`",
        "governance handoff/history `governanceExport.connectorRateLimit.pressure.label`",
        "governance handoff/history `connectorRateLimit.byEndpoint` equals `governanceExport.connectorRateLimit.byEndpoint`",
        "governance handoff/history `totals.connectorRateLimitEventCount` equals `connectorRateLimit.eventCount`",
        "governance handoff/history `connectorRateLimit.eventCount` equals `governanceExport.connectorRateLimit.eventCount`",
        "governance handoff/history `connectorRateLimit.pressure.label` equals `governanceExport.connectorRateLimit.pressure.label`",
        "governance handoff/history `connectorPressureParity.eventCountMatchesNested`",
        "governance handoff/history `connectorPressureParity.eventCountMatchesTotals`",
        "governance handoff/history `connectorPressureParity.byEndpointMatchesNested`",
        "governance handoff/history `connectorPressureParity.pressureLabelMatchesNested`",
        "governance handoff/history `sendgridWebhookTimestamp.eventCount` equals `governanceExport.sendgridWebhookTimestamp.eventCount`",
        "governance handoff/history `sendgridWebhookTimestamp.timestampAnomalyCountTotal` equals `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal`",
        "governance handoff/history `totals.sendgridWebhookTimestampEventCount` equals `sendgridWebhookTimestamp.eventCount`",
        "governance handoff/history `totals.sendgridWebhookTimestampAnomalyCountTotal` equals `sendgridWebhookTimestamp.timestampAnomalyCountTotal`",
        "governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesTotals`",
        "governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesTotals`",
        "governance handoff/history `sendgridWebhookTimestampParity.pressureLabelCountsMatchNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.pressureHintCountsMatchNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.ageBucketCountsMatchNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.anomalyEventTypeCountsMatchNested`",
        "governance handoff/history `sendgridWebhookTimestampParity.latestEventAtMatchesNested`",
        "governance handoff/history `runtimePrereqs.present`",
        "governance handoff/history `runtimePrereqs.passed`",
        "governance handoff/history `runtimePrereqs.contractValid`",
        "governance handoff/history `runtimePrereqs.valid`",
        "governance handoff/history `runtimePrereqs.missingCheckCount`",
        "governance handoff/history `runtimePrereqs.command`",
        "governance handoff/history `governanceExport.runtimePrereqs.missingCheckCount`",
        "governance handoff/history `governanceExport.runtimePrereqs.command`",
        "governance handoff/history `runtimePrereqs` equals `governanceExport.runtimePrereqs`",
        "governance handoff/history `totals.runtimePrereqsMissingCheckCount` equals `runtimePrereqs.missingCheckCount`",
        "governance history `totals.runtimePrereqsFailingArtifactCount`",
        "governance handoff/history `commandAliases.present`",
        "governance handoff/history `commandAliases.available`",
        "governance handoff/history `commandAliases.gatePassed`",
        "governance handoff/history `commandAliases.contractValid`",
        "governance handoff/history `commandAliases.valid`",
        "governance handoff/history `commandAliases.missingAliasCount`",
        "governance handoff/history `commandAliases.mismatchedAliasCount`",
        "governance handoff/history `commandAliases.command`",
        "governance handoff/history `governanceExport.commandAliases.missingAliasCount`",
        "governance handoff/history `governanceExport.commandAliases.mismatchedAliasCount`",
        "governance handoff/history `governanceExport.commandAliases.command`",
        "governance handoff/history `commandAliases` equals `governanceExport.commandAliases`",
        "governance handoff/history `totals.commandAliasesMissingAliasCount` equals `commandAliases.missingAliasCount`",
        "governance handoff/history `totals.commandAliasesMismatchedAliasCount` equals `commandAliases.mismatchedAliasCount`",
        "governance handoff/history `reasonCodeCount`",
        "governance handoff/history `recommendedCommandCount`",
        "governance handoff/history `governanceExport.reasonCodeCount`",
        "governance handoff/history `governanceExport.recommendedCommandCount`",
        "connectorValidation.eventCount",
        "connectorValidation.byEndpoint",
        "connectorValidation.byProvider",
        "connectorValidation.byField",
        "connectorValidation.byReason",
        "connectorValidation.latestEventAt",
        "connectorValidationEndpoint",
        "connectorValidationField",
        "connectorValidationReason",
        "connectorValidationErrorCode",
        "connectorValidationReceived",
        "connectorValidationErrorCode=invalid_request_bounds|invalid_request_required_field",
        "exportRecentEventsPacketValidationCount + exportRecentEventsNonPacketCount",
        "npm run verify:governance:weekly:endpoint:contract",
        "npm run verify:ci:sales:extended",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_includes_orchestration_slo_remediation_commands():
    content = _text()
    required_fragments = [
        "Orchestration SLO Remediation Checklist",
        "npm run verify:smoke:orchestration-slo-gate",
        "npm run verify:baseline:metrics",
        "npm run verify:smoke:baseline-governance-drift",
        "npm run verify:smoke:baseline-orchestration-remediation",
        "npm run verify:baseline:command-aliases:artifact",
        "npm run verify:baseline:command-aliases:artifact:contract",
        "npm run verify:smoke:baseline-command-aliases-artifact",
        "recommendedCommands",
        "governanceExport.recommendedCommands",
        "recommendedCommands[0]",
        "recommendedCommands[1]",
        "recommendedCommands[2]",
        "recommendedCommands[3]",
        "commandAliases.present",
        "commandAliases.available",
        "commandAliases.gatePassed",
        "commandAliases.missingAliasCount",
        "commandAliases.mismatchedAliasCount",
        "governanceExport.commandAliases",
        "recommendedCommandCount",
        "governanceExport.recommendedCommandCount",
        "reasonCodeCount",
        "governanceExport.reasonCodeCount",
        "--max-orchestration-attempt-error-count",
        "--max-orchestration-attempt-skipped-count",
        "gates.orchestrationAttemptErrorPassed",
        "gates.orchestrationAttemptSkippedPassed",
        "orchestrationAudit.observedAttemptErrorCount",
        "orchestrationAudit.observedAttemptSkippedCount",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_includes_multi_channel_rollback_checklist():
    content = _text()
    required_fragments = [
        "Sales Dashboard Multi-Channel Rollback Checklist",
        "npm run verify:smoke:multi-channel-controls",
        "npm run verify:smoke:sales-dashboard",
        "exportRequestedWindowDays",
        "exportRequestedCampaignLimit",
        "exportRequestedAbTestLimit",
        "exportRequestedProspectLimit",
        "exportAppliedWindowDays",
        "exportAppliedCampaignLimit",
        "exportAppliedAbTestLimit",
        "exportAppliedProspectLimit",
        "exportRequestedLimit",
        "npm run verify:frontend:sales",
        "npm run verify:smoke:sales",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_connector_release_signoff_runbook_documents_orchestration_baseline_command_chain_order():
    content = _text()
    orchestration_index = content.index("npm run verify:smoke:orchestration-slo-gate")
    baseline_metrics_index = content.index("npm run verify:baseline:metrics")
    baseline_drift_index = content.index("npm run verify:smoke:baseline-governance-drift")
    assert orchestration_index < baseline_metrics_index < baseline_drift_index


def test_connector_release_signoff_runbook_includes_baseline_orchestration_remediation_escalation_matrix():
    content = _text()
    required_fragments = [
        "Baseline Orchestration Remediation Escalation Matrix",
        "Integrations Engineer",
        "Release Manager",
        "QA Engineer",
        "Sales Ops Lead",
        "npm run verify:smoke:baseline-orchestration-remediation",
        "npm run verify:smoke:orchestration-slo-gate",
        "npm run verify:baseline:metrics",
        "npm run verify:smoke:baseline-governance-drift",
        "npm run verify:baseline:command-aliases:artifact",
        "npm run verify:baseline:command-aliases:artifact:contract",
        "npm run verify:smoke:baseline-command-aliases-artifact",
    ]
    for fragment in required_fragments:
        assert fragment in content
