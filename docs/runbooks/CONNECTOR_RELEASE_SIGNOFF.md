# Connector Release Signoff

## Purpose
Standardize signoff for connector canary expansion decisions based on SLO gate output.

## Inputs
- Canary evidence JSON generated from:
  - `/Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/collect_connector_canary_evidence.py`
- SLO gate decision endpoint output (`decision`, `alerts`, `rolloutActions`, `signoff`).

## Generate Signoff Template
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/generate_connector_signoff_template.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md`

## Validate Signoff Bundle
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/validate_connector_signoff_bundle.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --signoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md --artifacts-dir /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json`

Governance packet preflight:
- `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/generate_governance_packet_fixture.py --report /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_governance_weekly_report.json --handoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/governance_handoff_export.json --history /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/governance_history_export.json --requested-by u1`
- `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/validate_governance_packet_artifacts.py --handoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/governance_handoff_export.json --history /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/governance_history_export.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/governance_packet_validation.json`
- `npm run verify:governance:schema:preflight`

Validation rule:
- Exit code `0`: required evidence files, required approvals, and schema traceability checklist markers are present.
- Exit code `1`: missing evidence, approvals, or schema traceability checklist markers; rollout must remain blocked.
- Exit code `1`: governance handoff/history `sendgridWebhookTimestamp` or `sendgridWebhookTimestampParity` fields drift from `governanceExport`, totals parity fields, or cross-artifact event/anomaly/map/latest-event consistency checks.

Schema traceability checklist markers (required in signoff markdown):
- `schemaCoverage.thresholdPct`
- `schemaCoverage.observedPct`
- `schemaCoverage.sampleCount`
- `schemaCoverage.minSampleCount`
- `gates.schemaCoveragePassed`
- `gates.schemaSampleSizePassed`
- `gates.orchestrationAttemptErrorPassed`
- `gates.orchestrationAttemptSkippedPassed`
- `orchestrationAudit.maxAttemptErrorCountThreshold`
- `orchestrationAudit.observedAttemptErrorCount`
- `orchestrationAudit.maxAttemptSkippedCountThreshold`
- `orchestrationAudit.observedAttemptSkippedCount`

## Enforce Release Gate
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/enforce_connector_release_gate.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --validation /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_release_gate_result.json`

Gate rule:
- Exit code `0`: release can proceed.
- Exit code `1`: release is blocked.

## Required Signatories
- Release Manager
- Integrations Engineer
- Sales Ops Lead
- Incident Commander (required when SLO decision is `HOLD` due error-rate or orchestration-attempt gate failures)

## Signoff Rule
- If `decision=PROCEED`: approvals allow canary expansion.
- If `decision=HOLD`: no expansion is allowed until remediation + rollback drill evidence is attached and approvals are complete.

## Orchestration SLO Remediation Checklist
1. Re-run orchestration SLO hold/proceed smoke before requesting signoff refresh:
   - `npm run verify:smoke:orchestration-slo-gate`
2. Regenerate baseline metrics artifact immediately after orchestration smoke:
   - `npm run verify:baseline:metrics`
3. Re-check baseline-governance drift before signoff artifact regeneration:
   - `npm run verify:smoke:baseline-governance-drift`
4. Optionally run the condensed orchestration baseline remediation chain (same ordered checks in one command):
   - `npm run verify:smoke:baseline-orchestration-remediation`
5. Rebuild baseline command-alias artifact lifecycle evidence before signoff packet regeneration:
   - `npm run verify:baseline:command-aliases:artifact`
   - `npm run verify:baseline:command-aliases:artifact:contract`
   - `npm run verify:smoke:baseline-command-aliases-artifact`
6. For Integrations UI remediation copy/export, treat baseline-governance API `recommendedCommands` as the source-of-truth command order.
   - `recommendedCommands[0]` should be `npm run verify:smoke:baseline-orchestration-remediation` whenever orchestration gate posture is degraded.
   - `recommendedCommands[1]` should be `npm run verify:baseline:command-aliases:artifact`.
   - `recommendedCommands[2]` should be `npm run verify:baseline:command-aliases:artifact:contract`.
   - `recommendedCommands[3]` should be `npm run verify:smoke:baseline-command-aliases-artifact`.
   - `commandAliases.present`, `commandAliases.available`, and `commandAliases.gatePassed` should be reviewed before signoff approval.
   - `commandAliases.missingAliasCount` and `commandAliases.mismatchedAliasCount` should be zero before approving rollout expansion.
   - `governanceExport.commandAliases` should mirror top-level `commandAliases` for packet parity.
   - `governanceExport.recommendedCommands` should mirror `recommendedCommands` for signoff packet parity.
   - `recommendedCommandCount` should equal `len(recommendedCommands)` and match `governanceExport.recommendedCommandCount`.
   - `reasonCodeCount` should equal `len(reasonCodes)` and match `governanceExport.reasonCodeCount`.
7. Confirm SLO payload includes orchestration gate recovery markers:
   - `gates.orchestrationAttemptErrorPassed`
   - `gates.orchestrationAttemptSkippedPassed`
   - `orchestrationAudit.observedAttemptErrorCount`
   - `orchestrationAudit.observedAttemptSkippedCount`
8. If temporary threshold overrides are required for controlled dry-run evidence capture, execute:
   - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/collect_connector_canary_evidence.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 1000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25 --max-orchestration-attempt-error-count 5 --max-orchestration-attempt-skipped-count 25 --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json`
   - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/evaluate_connector_slo_gates.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 2000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25 --max-orchestration-attempt-error-count 5 --max-orchestration-attempt-skipped-count 25`
9. Regenerate signoff evidence and re-run validation/enforcement:
   - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/validate_connector_signoff_bundle.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --signoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md --artifacts-dir /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json`
   - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/enforce_connector_release_gate.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --validation /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_release_gate_result.json`

## Baseline Orchestration Remediation Escalation Matrix
- Integrations Engineer:
  - Trigger: orchestration gate fails (`gates.orchestrationAttemptErrorPassed=false` or `gates.orchestrationAttemptSkippedPassed=false`).
  - Preferred command: `npm run verify:smoke:baseline-orchestration-remediation`.
  - Command chain: `npm run verify:smoke:orchestration-slo-gate`, `npm run verify:baseline:metrics`, `npm run verify:smoke:baseline-governance-drift`, `npm run verify:baseline:command-aliases:artifact`, `npm run verify:baseline:command-aliases:artifact:contract`, `npm run verify:smoke:baseline-command-aliases-artifact`.
- Release Manager:
  - Trigger: baseline-governance remains `FAIL` after one remediation pass.
  - Command chain: `npm run verify:smoke:baseline-orchestration-remediation`, `npm run verify:baseline:command-aliases:artifact`, `npm run verify:baseline:command-aliases:artifact:contract`, `npm run verify:smoke:baseline-command-aliases-artifact`, then `npm run verify:ci:sales:extended`.
- QA Engineer:
  - Trigger: baseline metrics artifact contract drift or missing fixture-profile evidence.
  - Command chain: `npm run verify:baseline:metrics`, `npm run verify:release-gate:artifact:fixtures`, `npm run verify:smoke:baseline-governance-drift`, `npm run verify:baseline:command-aliases:artifact`, `npm run verify:baseline:command-aliases:artifact:contract`.
- Sales Ops Lead:
  - Trigger: signoff packet is pending while governance remains blocked.
  - Command chain: `npm run verify:smoke:baseline-orchestration-remediation`, `npm run verify:smoke:baseline-command-aliases-artifact`, then refresh signoff evidence exports from Integrations UI.

## Governance Weekly Export Packet Checklist
1. Validate governance weekly artifacts and endpoint contracts:
   - `npm run verify:governance:weekly`
   - `npm run verify:governance:weekly:endpoint:contract`
   - `npm run verify:governance:packet:fixture`
   - `npm run verify:governance:packet:validate`
   - `npm run verify:governance:packet:contract`
2. Validate governance history retention and cleanup safety:
   - `npm run verify:governance:weekly:cleanup:policy`
   - `npm run verify:governance:weekly:cleanup:apply:guarded`
   - `npm run verify:smoke:governance-history-retention`
   - `npm run verify:smoke:governance-duplicate-artifact-remediation`
3. Validate governance export failure-path guard:
   - `npm run verify:smoke:governance-export-guard`
   - `npm run verify:smoke:governance-schema-endpoint`
4. Run combined governance packet smoke wrapper:
   - `npm run verify:smoke:governance-packet`
   - `npm run verify:smoke:governance-connector-pressure`
5. Run governance schema/environment preflight consistency:
   - `npm run verify:governance:schema:preflight`
6. Confirm signoff template governance schema preflight checklist markers are present before approvals:
   - `## Governance Schema Preflight Checklist`
   - `governanceSchemaPreflight.isSet`
   - `governanceSchemaPreflight.isValid`
   - `governanceSchemaPreflight.expectedExportSchemaVersion`
   - `governanceSchemaPreflight.detectedExportSchemaVersions`
   - `governanceSchemaPreflight.consistent`
7. Verify governance schema command-copy/export surfaces in operator UI:
   - `npm run verify:smoke:governance-schema-ui`
8. Export packet payloads from operator UI:
   - `Export Governance Handoff JSON`
   - `Export Governance History JSON`
   - `Export Governance Schema JSON`
9. Attach packet artifacts to signoff bundle:
   - `backend/test_reports/connector_governance_weekly_report.json`
   - governance handoff export JSON
   - governance history export JSON
10. Confirm governance packet schema compatibility before signoff:
   - `exportSchemaVersion` on handoff export payload
   - `governanceExport.exportSchemaVersion` on handoff export payload
   - `exportSchemaVersion` on governance history payload
   - `items[].exportSchemaVersion` on governance history payload
   - `schemaVersionCounts` and `duplicateArtifactNames` on governance history payload
   - handoff/history schema versions must match
   - packet fixture status normalization accepts separator/case variants (for example `action-required`) and emits canonical status tokens (`READY` or `ACTION_REQUIRED`)
   - punctuation-only packet status tokens are invalid and must fail packet validation
   - connector parity endpoint keys are normalized (`apollo search` and `apollo-search` reconcile to `apollo_search`)
   - governance report/export/history `status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
   - governance handoff/history `governanceExport.status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
   - governance history `items[].status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
   - governance report `governanceStatusCounts` keys must be canonical status tokens
   - governance report `traceabilityDecisionCounts` keys must be canonical decision tokens (`PROCEED`, `HOLD`, `UNKNOWN`)
   - malformed or punctuation-only governance/decision tokens should collapse to `UNKNOWN`
   - `npm run verify:governance:weekly:report:contract`
   - `reasonCodeCount` should equal `len(reasonCodes)` in governance report/export/history payloads.
   - `recommendedCommandCount` should equal `len(recommendedCommands)` in governance report/export/history payloads.
   - governance report/export/history `runtimePrereqs.present` should be a boolean and match nested handoff/history export envelopes.
   - governance report/export/history `runtimePrereqs.available`, `runtimePrereqs.passed`, `runtimePrereqs.contractValid`, and `runtimePrereqs.valid` should be coherent for rollout decisions.
   - governance report/export/history `runtimePrereqs.missingCheckCount` should reconcile with `runtimePrereqs.missingChecks.commands` + `runtimePrereqs.missingChecks.workspace`.
   - governance handoff/history `runtimePrereqs.command` should be populated and match `governanceExport.runtimePrereqs.command`.
   - governance handoff/history `governanceExport.runtimePrereqs` should match top-level `runtimePrereqs` fields.
   - governance handoff/history `totals.runtimePrereqsMissingCheckCount` should equal `runtimePrereqs.missingCheckCount`.
   - governance handoff/history `runtimePrereqsMissingCheckCount` should stay consistent between handoff and history artifacts.
   - governance report/export/history `commandAliases.present` should be a boolean and match nested handoff/history export envelopes.
   - governance report/export/history `commandAliases.available`, `commandAliases.gatePassed`, `commandAliases.contractValid`, and `commandAliases.valid` should be coherent for rollout decisions.
   - governance report/export/history `commandAliases.missingAliasCount` should reconcile with `len(commandAliases.missingAliases)`.
   - governance report/export/history `commandAliases.mismatchedAliasCount` should reconcile with `len(commandAliases.mismatchedAliases)`.
   - governance handoff/history `commandAliases.command` should be populated and match `governanceExport.commandAliases.command`.
   - governance handoff/history `governanceExport.commandAliases` should match top-level `commandAliases` fields.
   - governance handoff/history `totals.commandAliasesMissingAliasCount` should equal `commandAliases.missingAliasCount`.
   - governance handoff/history `totals.commandAliasesMismatchedAliasCount` should equal `commandAliases.mismatchedAliasCount`.
   - governance handoff/history `commandAliases` missing/mismatched counts and command should stay consistent between handoff and history artifacts.
   - governance handoff/history `reasonCodeCount` should equal `len(reasonCodes)` and match `governanceExport.reasonCodeCount`.
   - governance handoff/history `recommendedCommandCount` should equal `len(recommendedCommands)` and match `governanceExport.recommendedCommandCount`.
11. Confirm governance connector-pressure posture fields are present before signoff:
   - governance report `totals.connectorRateLimitEventCount`
   - governance report/export/history `connectorRateLimit.eventCount`
   - governance report/export/history `connectorRateLimit.byEndpoint`
   - governance report/export/history `connectorRateLimit.pressure.label`
   - governance handoff/history `governanceExport.connectorRateLimit.pressure.label`
   - governance handoff/history `connectorRateLimit.eventCount` equals `governanceExport.connectorRateLimit.eventCount`
   - governance handoff/history `connectorRateLimit.byEndpoint` equals `governanceExport.connectorRateLimit.byEndpoint`
   - governance handoff/history `connectorRateLimit.pressure.label` equals `governanceExport.connectorRateLimit.pressure.label`
   - governance handoff/history `totals.connectorRateLimitEventCount` equals `connectorRateLimit.eventCount`
   - governance handoff/history `connectorPressureParity.eventCountMatchesNested`
   - governance handoff/history `connectorPressureParity.eventCountMatchesTotals`
   - governance handoff/history `connectorPressureParity.byEndpointMatchesNested`
   - governance handoff/history `connectorPressureParity.pressureLabelMatchesNested`
   - governance report/export/history `sendgridWebhookTimestamp.eventCount`
   - governance report/export/history `sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance report/export/history `sendgridWebhookTimestamp.pressureLabelCounts`
   - governance report/export/history `sendgridWebhookTimestamp.pressureHintCounts`
   - governance report/export/history `sendgridWebhookTimestamp.timestampAgeBucketCounts`
   - governance report/export/history `sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts`
   - governance handoff/history `governanceExport.sendgridWebhookTimestamp.eventCount`
   - governance handoff/history `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance handoff/history `sendgridWebhookTimestamp.eventCount` equals `governanceExport.sendgridWebhookTimestamp.eventCount`
   - governance handoff/history `sendgridWebhookTimestamp.timestampAnomalyCountTotal` equals `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance handoff/history `totals.sendgridWebhookTimestampEventCount` equals `sendgridWebhookTimestamp.eventCount`
   - governance handoff/history `totals.sendgridWebhookTimestampAnomalyCountTotal` equals `sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesNested`
   - governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesTotals`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesTotals`
   - governance handoff/history `sendgridWebhookTimestampParity.pressureLabelCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.pressureHintCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.ageBucketCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyEventTypeCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.latestEventAtMatchesNested`
   - governance handoff/history `runtimePrereqs.present`
   - governance handoff/history `runtimePrereqs.passed`
   - governance handoff/history `runtimePrereqs.contractValid`
   - governance handoff/history `runtimePrereqs.valid`
   - governance handoff/history `runtimePrereqs.missingCheckCount`
   - governance handoff/history `runtimePrereqs.command`
   - governance handoff/history `governanceExport.runtimePrereqs.missingCheckCount`
   - governance handoff/history `governanceExport.runtimePrereqs.command`
   - governance handoff/history `runtimePrereqs` equals `governanceExport.runtimePrereqs`
   - governance handoff/history `totals.runtimePrereqsMissingCheckCount` equals `runtimePrereqs.missingCheckCount`
   - governance history `totals.runtimePrereqsFailingArtifactCount`
   - governance handoff/history `commandAliases.present`
   - governance handoff/history `commandAliases.available`
   - governance handoff/history `commandAliases.gatePassed`
   - governance handoff/history `commandAliases.contractValid`
   - governance handoff/history `commandAliases.valid`
   - governance handoff/history `commandAliases.missingAliasCount`
   - governance handoff/history `commandAliases.mismatchedAliasCount`
   - governance handoff/history `commandAliases.command`
   - governance handoff/history `governanceExport.commandAliases.missingAliasCount`
   - governance handoff/history `governanceExport.commandAliases.mismatchedAliasCount`
   - governance handoff/history `governanceExport.commandAliases.command`
   - governance handoff/history `commandAliases` equals `governanceExport.commandAliases`
   - governance handoff/history `totals.commandAliasesMissingAliasCount` equals `commandAliases.missingAliasCount`
   - governance handoff/history `totals.commandAliasesMismatchedAliasCount` equals `commandAliases.mismatchedAliasCount`
   - governance handoff/history `reasonCodeCount` equals `len(reasonCodes)`
   - governance handoff/history `recommendedCommandCount` equals `len(recommendedCommands)`
   - governance handoff/history `governanceExport.reasonCodeCount` equals `reasonCodeCount`
   - governance handoff/history `governanceExport.recommendedCommandCount` equals `recommendedCommandCount`
12. Confirm connector input-validation conformance before signoff approval:
   - `npm run verify:smoke:connector-input-validation`
   - governance report/export/history `connectorValidation.eventCount`
   - governance report/export/history `connectorValidation.byEndpoint`
   - governance report/export/history `connectorValidation.byProvider`
   - governance report/export/history `connectorValidation.byField`
   - governance report/export/history `connectorValidation.byReason`
   - governance report/export/history `connectorValidation.latestEventAt`
   - governance handoff/history `connectorValidation.eventCount` equals `governanceExport.connectorValidation.eventCount`
   - governance handoff/history `connectorValidation.byEndpoint` equals `governanceExport.connectorValidation.byEndpoint`
   - governance handoff/history `connectorValidation.byProvider` equals `governanceExport.connectorValidation.byProvider`
   - governance handoff/history `connectorValidation.byField` equals `governanceExport.connectorValidation.byField`
   - governance handoff/history `connectorValidation.byReason` equals `governanceExport.connectorValidation.byReason`
   - governance recent-event rows include `connectorValidationEndpoint`, `connectorValidationField`, `connectorValidationReason`, `connectorValidationErrorCode`, `connectorValidationReceived`
   - `connectorValidationErrorCode` values are limited to `invalid_request_bounds` and `invalid_request_required_field`
   - sustained validation-failure posture is acceptable (warning threshold: 5 events/10 minutes, critical threshold: 2% of connector lookup requests over 15 minutes)

## Governance Packet Regeneration Escalation Path
1. If signoff validation reports packet evidence drift/staleness, regenerate packet artifacts:
   - `npm run verify:governance:packet:fixture`
   - `npm run verify:governance:packet:validate`
   - `npm run verify:governance:packet:contract`
2. Re-run endpoint and smoke parity checks before reopening signoff:
   - `npm run verify:governance:weekly:endpoint:contract`
   - `npm run verify:smoke:governance-packet`
   - `npm run verify:smoke:governance-connector-pressure`
   - `npm run verify:smoke:traceability-ci-guard`
3. Confirm packet validation artifact freshness and include in signoff evidence:
   - `backend/test_reports/governance_packet_validation.json`
   - Freshness policy env var: `GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS` (default `168`)
4. If packet contract still fails, block rollout and escalate via extended gate:
   - `npm run verify:ci:sales:extended`

## Telemetry Export Consumer Compatibility Check
1. Export telemetry snapshots from Integrations and Sales Intelligence before final signoff:
   - `Export Telemetry JSON` (Integrations)
   - `Export Telemetry JSON` (Sales Intelligence)
2. Validate packet-filter contract and malformed-input guard prior to attachment:
   - `npm run verify:smoke:telemetry-packet-filter`
   - `npm run verify:smoke:telemetry-export-distribution`
   - `npm run verify:smoke:connector-lookups-export`
   - `npm run verify:smoke:connector-input-validation`
3. Confirm telemetry exports include compatibility fields expected by release consumers:
   - `recentEventsFilter`
   - `recentEventsTotalCount`
   - `recentEventsFilteredCount`
   - `recentEventsPacketValidationCount`
   - `recentEventsNonPacketCount`
   - `exportSchemaVersion`
   - `exportRequestedWindowDays`
   - `exportRequestedLimit`
   - `exportRecentEventsFilter`
   - `exportRecentEventsPacketValidationCount`
   - `exportRecentEventsNonPacketCount`
   - `Export Company Lookup JSON`
   - `Export Apollo Lookup JSON`
   - `exportType=connector-company-lookup`
   - `exportType=connector-apollo-lookup`
   - `selectedProvider`
   - `providerOrder`
   - `storagePolicy`
   - governance handoff/history `exportSchemaVersion`
   - governance handoff/history `governanceExport.exportSchemaVersion`
   - governance report/export/history `connectorRateLimit.pressure.label`
   - governance handoff/history `governanceExport.connectorRateLimit.pressure.label`
   - governance handoff/history `connectorRateLimit.byEndpoint` equals `governanceExport.connectorRateLimit.byEndpoint`
   - governance handoff/history `totals.connectorRateLimitEventCount` equals `connectorRateLimit.eventCount`
   - governance handoff/history `connectorPressureParity.eventCountMatchesNested`
   - governance handoff/history `connectorPressureParity.eventCountMatchesTotals`
   - governance handoff/history `connectorPressureParity.byEndpointMatchesNested`
   - governance handoff/history `connectorPressureParity.pressureLabelMatchesNested`
   - governance handoff/history `sendgridWebhookTimestamp.eventCount` equals `governanceExport.sendgridWebhookTimestamp.eventCount`
   - governance handoff/history `sendgridWebhookTimestamp.timestampAnomalyCountTotal` equals `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance handoff/history `totals.sendgridWebhookTimestampEventCount` equals `sendgridWebhookTimestamp.eventCount`
   - governance handoff/history `totals.sendgridWebhookTimestampAnomalyCountTotal` equals `sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesNested`
   - governance handoff/history `sendgridWebhookTimestampParity.eventCountMatchesTotals`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyCountTotalMatchesTotals`
   - governance handoff/history `sendgridWebhookTimestampParity.pressureLabelCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.pressureHintCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.ageBucketCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.anomalyEventTypeCountsMatchNested`
   - governance handoff/history `sendgridWebhookTimestampParity.latestEventAtMatchesNested`
   - governance handoff/history `runtimePrereqs.present`
   - governance handoff/history `runtimePrereqs.passed`
   - governance handoff/history `runtimePrereqs.contractValid`
   - governance handoff/history `runtimePrereqs.valid`
   - governance handoff/history `runtimePrereqs.missingCheckCount`
   - governance handoff/history `runtimePrereqs.command`
   - governance handoff/history `governanceExport.runtimePrereqs.missingCheckCount`
   - governance handoff/history `governanceExport.runtimePrereqs.command`
   - governance handoff/history `runtimePrereqs` equals `governanceExport.runtimePrereqs`
   - governance handoff/history `totals.runtimePrereqsMissingCheckCount` equals `runtimePrereqs.missingCheckCount`
   - governance history `totals.runtimePrereqsFailingArtifactCount`
   - governance handoff/history `commandAliases.present`
   - governance handoff/history `commandAliases.available`
   - governance handoff/history `commandAliases.gatePassed`
   - governance handoff/history `commandAliases.contractValid`
   - governance handoff/history `commandAliases.valid`
   - governance handoff/history `commandAliases.missingAliasCount`
   - governance handoff/history `commandAliases.mismatchedAliasCount`
   - governance handoff/history `commandAliases.command`
   - governance handoff/history `governanceExport.commandAliases.missingAliasCount`
   - governance handoff/history `governanceExport.commandAliases.mismatchedAliasCount`
   - governance handoff/history `governanceExport.commandAliases.command`
   - governance handoff/history `commandAliases` equals `governanceExport.commandAliases`
   - governance handoff/history `totals.commandAliasesMissingAliasCount` equals `commandAliases.missingAliasCount`
   - governance handoff/history `totals.commandAliasesMismatchedAliasCount` equals `commandAliases.mismatchedAliasCount`
   - governance handoff/history `reasonCodeCount`
   - governance handoff/history `recommendedCommandCount`
   - governance handoff/history `governanceExport.reasonCodeCount`
   - governance handoff/history `governanceExport.recommendedCommandCount`
   - `connectorValidation.eventCount`
   - `connectorValidation.byEndpoint`
   - `connectorValidation.byProvider`
   - `connectorValidation.byField`
   - `connectorValidation.byReason`
   - `connectorValidation.latestEventAt`
   - `connectorValidationEndpoint`
   - `connectorValidationField`
   - `connectorValidationReason`
   - `connectorValidationErrorCode`
   - `connectorValidationReceived`
   - `connectorValidationErrorCode=invalid_request_bounds|invalid_request_required_field`
4. Reconcile exported recent-event distribution counts before signoff attachment:
   - `exportRecentEventsPacketValidationCount + exportRecentEventsNonPacketCount` should align with export recent-event window totals used for review context.
   - If reconciliation fails, hold rollout and regenerate telemetry evidence.
5. If export consumers report schema mismatch, block rollout and re-run:
   - `npm run verify:governance:weekly:endpoint:contract`
   - `npm run verify:ci:sales:extended`

## Sales Dashboard Multi-Channel Rollback Checklist
1. Re-run dashboard control regressions before approving rollback or forward-fix:
   - `npm run verify:smoke:multi-channel-controls`
   - `npm run verify:smoke:sales-dashboard`
2. Confirm multi-channel export evidence contains both requested and server-applied control metadata:
   - `exportRequestedWindowDays`
   - `exportRequestedCampaignLimit`
   - `exportRequestedAbTestLimit`
   - `exportRequestedProspectLimit`
   - `exportAppliedWindowDays`
   - `exportAppliedCampaignLimit`
   - `exportAppliedAbTestLimit`
   - `exportAppliedProspectLimit`
3. Confirm relationship export evidence includes requested and applied window metadata:
   - `exportRequestedWindowDays`
   - `exportRequestedLimit`
   - `exportAppliedWindowDays`
4. If requested/applied metadata diverges unexpectedly, hold rollout and run:
   - `npm run verify:frontend:sales`
   - `npm run verify:smoke:sales`
