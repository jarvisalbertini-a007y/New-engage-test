# Predictive Optimization Runbook (Sales-Only)

## Scope
- Phrase-level effectiveness analytics
- Response prediction for outbound sales content
- Pipeline forecast, conversation intelligence, multi-channel engagement, campaign lifecycle, and relationship map controls

## Related Operational Docs
- Connector canary rollout plan: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_CANARY_ROLLOUT.md`
- Connector rollback drill plan: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_ROLLBACK_DRILL.md`
- Connector alert response matrix: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_ALERT_RESPONSE_MATRIX.md`
- Connector release signoff process: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_RELEASE_SIGNOFF.md`

## Feature Flags
- `ENABLE_PHRASE_ANALYTICS` (default enabled if unset)
- `ENABLE_RESPONSE_PREDICTION` (default enabled if unset)
- `ENABLE_RESPONSE_PREDICTION_FEEDBACK` (default enabled if unset)
- `ENABLE_PIPELINE_FORECAST` (default enabled if unset)
- `ENABLE_CONVERSATION_INTELLIGENCE` (default enabled if unset)
- `ENABLE_MULTI_CHANNEL_ENGAGEMENT` (default enabled if unset)
- `ENABLE_SALES_CAMPAIGNS` (default enabled if unset)
- `ENABLE_RELATIONSHIP_MAP` (default enabled if unset)

## Deployment Checklist
1. Confirm baseline gate passes:
   - `npm run test`
   - `npm run typecheck`
   - `npm run verify:baseline:command-aliases`
   - `npm run verify:baseline:command-aliases:artifact:fixtures`
   - `npm run verify:baseline:metrics:artifact:fixtures`
   - `npm run verify:baseline:quick`
   - `npm run verify:baseline`
   - `npm run verify:ci:sales`
2. Confirm sales-only API health:
   - `npm run verify:smoke`
3. Validate sales-intelligence regression tests:
   - `npm run verify:backend:sales`
4. Validate sales dashboard frontend regression tests:
   - `npm run verify:frontend:sales`
   - `npm run verify:smoke:frontend-sales`
   - `npm run verify:smoke:sales-dashboard`
   - `npm run verify:smoke:multi-channel-controls`
   - `npm run verify:smoke:baseline-command-aliases`
   - `npm run verify:smoke:baseline-command-aliases-artifact`
   - `npm run verify:smoke:baseline-metrics-artifact`
   - `npm run verify:smoke:connector-orchestration`
   - `npm run verify:smoke:connector-reliability`
   - `npm run verify:smoke:connector-provider-lookups`
   - `npm run verify:smoke:connector-lookups`
   - `npm run verify:smoke:connector-lookups-ui`
   - `npm run verify:smoke:connector-lookups-export`
5. Validate full sales smoke chain before predictive rollout expansion:
   - `npm run verify:smoke:sales`
   - includes `verify:smoke:sales-dashboard` immediately after `verify:smoke:frontend-sales`, includes `verify:smoke:multi-channel-controls` before `verify:smoke:baseline-command-aliases`, includes `verify:smoke:baseline-command-aliases` before `verify:smoke:baseline-command-aliases-artifact`, includes `verify:smoke:baseline-command-aliases-artifact` before `verify:smoke:campaign`, includes `verify:smoke:runtime-prereqs-artifact` before `verify:smoke:baseline-metrics-artifact`, and includes `verify:smoke:connector-reliability` + `verify:smoke:telemetry-quality` between credential lifecycle and telemetry event-root backfill stages.
   - `verify:smoke:connector-reliability` runs after `verify:smoke:credential-lifecycle` and executes `verify:smoke:connector-orchestration`, `verify:smoke:connector-provider-lookups`, `verify:smoke:connector-lookups`, `verify:smoke:sendgrid-reliability`, and `verify:smoke:credential-freshness`.
   - `verify:smoke:telemetry-quality` runs `verify:smoke:telemetry-status-filter`, `verify:smoke:telemetry-status-counts`, and `verify:smoke:telemetry-export-distribution`.
   - `verify:smoke:connector-lookups` runs after `verify:smoke:connector-provider-lookups` and executes `verify:smoke:connector-lookups-ui` then `verify:smoke:connector-lookups-export`.
6. Validate smoke workflow contract coverage gate before signoff:
   - `npm run verify:smoke:workflow-contracts`

## Manual Validation
0. Open the dedicated analytics UI:
   - `/sales-intelligence`
   - Confirm page renders campaign, prediction, and telemetry sections.
   - Use telemetry controls to set `window days` and `event limit`, click `Refresh Telemetry`, and confirm values are bounded to allowed ranges (`days: 1-30`, `limit: 50-5000`).
   - Use recent-event filter controls (`All Events` / `Packet-Validation Events`) and confirm packet-only mode narrows telemetry rows to packet-validation posture events.
   - Confirm Retry Audit panel is visible with operation/provider breakdown when retry telemetry exists.
   - Confirm Orchestration Audit panel is visible with selected-provider and reason-code breakdown when orchestration telemetry exists.
   - Confirm Connector Input-Validation Posture panel is visible with endpoint/provider/field/reason breakdown when connector validation telemetry exists.
   - Confirm Connector Credential Freshness panel is visible with health counts and stale-provider warning context.
   - Confirm connector health panel exposes:
     - `Health Status`
     - `Healthy/Unhealthy`
     - `Freshness ACTION_REQUIRED`
     - `Freshness READY/UNKNOWN`
     - provider status rows for configured connectors.
   - Confirm integrations health payload includes freshness provenance fields:
     - `credentialFreshnessStatusCountsSource`
     - `credentialFreshnessStatusCountsMismatch`
     - `credentialFreshnessStatusCountsServer`
     - `credentialFreshnessStatusCountsFallback`
   - Confirm connector health panel status-count provenance marker is visible:
     - `Freshness status-count source: server|local.`
   - If backend freshness rollups diverge from provider-derived rows, confirm mismatch warning text:
     - `Credential freshness status-count mismatch`
   - If provider freshness rows are absent, confirm fallback message:
     - `No connector freshness telemetry yet.`
   - Export telemetry and prediction JSON snapshots from dashboard controls for rollout evidence.
   - Export telemetry, pipeline forecast, and prediction JSON snapshots from dashboard controls for rollout evidence.
   - Export connector lookup evidence snapshots from Integrations controls (`Export Company Lookup JSON`, `Export Apollo Lookup JSON`) and verify metadata includes `exportSchemaVersion`, `exportGeneratedAt`, and `exportType=connector-company-lookup` / `exportType=connector-apollo-lookup`.
   - Export campaign portfolio and campaign performance JSON snapshots from dashboard controls for rollout evidence.
   - Export conversation, multi-channel, and relationship JSON snapshots from dashboard controls for rollout evidence.
   - Export phrase analytics, phrase channel summary, prediction performance, and prediction feedback history JSON snapshots from dashboard controls for rollout evidence.
   - Use campaign portfolio controls (`Window Days`, `Status`, `Campaign Limit`) and click `Refresh Portfolio`.
   - Confirm campaign portfolio controls are bounded to allowed ranges (`window_days: 14-365`, `portfolio_limit: 5-100`).
   - Confirm campaign portfolio status filter allows `all|active|draft|paused|completed`.
   - Confirm campaign panel metadata shows applied portfolio filters and server-applied status filter.
   - Use campaign performance `Channel Limit` control and click `Refresh Campaign Performance`.
   - Confirm campaign performance channel limit is bounded to allowed range (`channel_limit: 1-20`).
   - Confirm campaign channel metadata shows displayed channels vs total channels with applied limit.
   - Confirm Conversation Intelligence panel is visible and includes:
     - `Records`
     - `Relationship Health`
     - `Sentiment`
     - `Top Objections`
   - Use conversation intelligence controls (`Window Days`, `Event Limit`) and click `Refresh Conversation`.
   - Confirm conversation controls are bounded to allowed ranges (`window_days: 14-365`, `event_limit: 20-1000`).
   - Confirm Multi-Channel Health panel is visible and includes:
     - `Coverage Score`
     - `Active Channels`
     - `Channel Usage`
     - `Recommendations`
   - Use multi-channel controls (`Campaign Limit`, `A/B Test Limit`, `Prospect Limit`) and click `Refresh Multi-Channel`.
   - Confirm multi-channel controls are bounded to allowed ranges (`campaign_limit: 10-5000`, `ab_test_limit: 10-10000`, `prospect_limit: 50-20000`).
   - Confirm Relationship Map Summary panel is visible and includes:
     - `Prospects`
     - `Companies`
     - `Connections`
     - `Avg Relationship Strength`
     - `Node / Edge Count`
   - Use relationship map `Entity Limit` control and click `Refresh Relationship Map`.
   - Confirm relationship map limit is bounded to allowed range (`50-1000`).
   - Confirm Phrase Effectiveness panel is visible and includes:
     - `Tracked Phrases`
     - `Candidate Phrases`
     - `Total Records`
     - `Top Phrases`
   - Confirm Phrase Channel Summary panel is visible and includes:
     - `Channels`
     - `Total Records`
     - `Channel Highlights`
   - Confirm Prediction Feedback Performance panel is visible and includes:
     - `Sample Size`
     - `Positive Rate`
     - `Avg Predicted Probability`
     - `MAE`
     - `By Channel`
   - Confirm Prediction Feedback History panel is visible and includes:
     - `Records`
     - `Recent Outcomes`
   - Use phrase intelligence controls (`Window Days`, `Min Exposure`, `Phrase Limit`, `Channel Limit`) and click `Refresh Phrase Intelligence`.
   - Confirm phrase control values are bounded to allowed ranges (`window_days: 14-365`, `min_exposure: 1-50`, `phrase_limit: 5-100`, `channel_limit: 3-30`).
   - Use prediction feedback controls (`Window Days`, `History Limit`) and click `Refresh Prediction Feedback`.
   - Confirm prediction feedback controls are bounded to allowed ranges (`window_days: 14-365`, `history_limit: 10-500`).
   - Confirm pipeline forecast panel surfaces:
     - `Open Pipeline`
     - `Weighted Pipeline`
     - `Projected Won`
     - `Historical Win Rate`
     - `95% Confidence Band`
     - `Interval Width`
     - `Reliability Tier`
     - `Open / Closed Samples`
   - Confirm forecast export payload includes:
     - `confidenceIntervalWidth`
     - `confidenceIntervalWidthPct`
     - `forecastReliabilityTier`
     - `forecastRecommendation`
   - Use forecast `Window Days` control and click `Refresh Forecast`.
   - Confirm forecast window is bounded to allowed range (`30-365`).
   - Use prediction quality `Window Days` control and click `Refresh Prediction Quality`.
   - Confirm prediction quality window is bounded to allowed range (`14-365`).
   - Export governance schema contract snapshot from dashboard controls:
     - `Export Governance Schema JSON`
     - confirm exported payload includes:
       - `schemaContractParity.reasonCodeCount`
       - `schemaContractParity.recommendedCommandCount`
       - `schemaContractParity.reasonCodeParity.topLevelVsRolloutActions`
       - `schemaContractParity.reasonCodeParity.topLevelVsExportActions`
       - `schemaContractParity.reasonCodeParity.topLevelVsExportAlerts`
       - `schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes`
       - `schemaContractParity.recommendedCommandParity.topLevelVsExport`
       - `schemaContractParity.handoffParity.rolloutBlockedMatchesExport`
       - `schemaContractParity.handoffParity.ownerRoleMatchesExport`
       - `schemaContractParity.handoffParity.handoffActionsMatchRolloutActions`
       - `schemaContractParity.handoffParity.handoffActionCount`
       - `schemaContractParity.handoffParity.rolloutActionCount`
       - `schemaContractParity.computedAt`
      - confirm governance schema card UI shows:
        - `Schema Parity Status: PASS` for parity-true payloads
        - `Failed checks:` warning when any parity check is false
      - confirm telemetry dashboard also shows:
        - `Governance Schema Audit Posture`
        - `Parity posture: PASS` (or `FAIL` when parity drift exists)
   - Export baseline governance snapshot from dashboard controls:
     - `Export Baseline Governance JSON`
   - Copy baseline governance remediation command chain from dashboard controls:
     - `Copy Baseline Governance Commands`
   - When baseline governance status is `FAIL` and backend command recommendations are missing, confirm fallback warning is visible:
     - `Baseline governance is failing and backend recommendedCommands are missing. Using local fallback remediation commands.`
   - Confirm telemetry export payload includes request-context metadata:
     - `exportSchemaVersion`
     - `exportRequestedWindowDays`
     - `exportRequestedLimit`
     - `exportRecentEventsFilter`
     - `exportRecentEventsSelectedFilter`
     - `exportRecentEventsServerFilter`
     - `exportRecentEventsServerFilterRaw`
     - `exportRecentEventsServerFilterRawTrimmed`
     - `exportRecentEventsServerFilterBlank`
     - `exportRecentEventsServerFilterUnsupported`
     - `exportRecentEventsServerFilterEvaluation`
     - `exportRecentEventsServerFilterNormalizationChanged`
     - `exportRecentEventsFilterMismatch`
     - `exportRecentEventsFilterSource`
     - `exportRecentEventsFilterResolution`
     - `exportRecentEventsDisplayedCount`
     - `exportRecentEventsTotalCount`
     - `exportRecentEventsPacketValidationCount`
     - `exportRecentEventsNonPacketCount`
     - `exportConnectorValidationEventCount`
     - `exportConnectorValidationLatestEventAt`
     - `exportConnectorValidationEndpointCount`
     - `exportConnectorValidationProviderCount`
     - `exportConnectorValidationFieldCount`
     - `exportConnectorValidationReasonCount`
     - `exportRetryAuditEventCount`
     - `exportRetryAuditLatestEventAt`
     - `exportRetryAuditMaxNextDelaySeconds`
     - `exportRetryAuditAvgNextDelaySeconds`
     - `exportRetryAuditOperationCount`
     - `exportRetryAuditProviderCount`
     - `exportIntegrationHealthStatus`
     - `exportIntegrationHealthGeneratedAt`
     - `exportIntegrationHealthHealthyCount`
     - `exportIntegrationHealthUnhealthyCount`
     - `exportIntegrationHealthActionableUnhealthyProviders`
     - `exportIntegrationHealthCredentialActionRequiredProviders`
     - `exportIntegrationHealthCredentialConfiguredMaxAgeDays`
     - `exportIntegrationHealthCredentialRotationMaxAgeDays`
     - `exportIntegrationHealthCredentialFreshnessStatusCounts`
     - `exportIntegrationHealthCredentialFreshnessByProvider`
     - `exportIntegrationHealthCredentialFreshnessTotalProviders`
     - `exportIntegrationHealthCredentialFreshnessActionRequiredCount`
     - `exportIntegrationHealthCredentialFreshnessWithinPolicyCount`
     - `exportIntegrationHealthCredentialFreshnessUnknownCount`
     - `exportIntegrationHealthCredentialFreshnessStatusCountsSource`
     - `exportIntegrationHealthCredentialFreshnessStatusCountsMismatch`
     - `exportIntegrationHealthCredentialFreshnessStatusCountsServer`
     - `exportIntegrationHealthCredentialFreshnessStatusCountsFallback`
     - `exportIntegrationHealthRecommendedCommands`
     - `exportOrchestrationAuditEventCount`
     - `exportOrchestrationAuditLatestEventAt`
     - `exportOrchestrationAuditMaxAttemptCount`
     - `exportOrchestrationAuditAvgAttemptCount`
     - `exportOrchestrationAuditProviderCount`
     - `exportOrchestrationAuditReasonCodeCount`
   - Confirm telemetry summary payload includes orchestration telemetry fields:
     - `orchestrationAudit.eventCount`
     - `orchestrationAudit.bySelectedProvider`
     - `orchestrationAudit.attemptStatusCounts`
     - `orchestrationAudit.reasonCodeCounts`
     - `orchestrationAudit.maxAttemptCount`
     - `orchestrationAudit.avgAttemptCount`
     - `orchestrationAudit.latestEventAt`
   - Confirm recent correlated events include orchestration context rows when present:
     - `orchestrationSelectedProvider`
     - `orchestrationAttemptCount`
     - `orchestrationAttemptSuccessCount`
     - `orchestrationAttemptSkippedCount`
     - `orchestrationAttemptErrorCount`
     - `orchestrationAttemptReasonCodes`
     - `orchestrationResultCount`
   - Confirm recent correlated events include connector input-validation context rows when present:
     - `connectorValidationProvider`
     - `connectorValidationEndpoint`
     - `connectorValidationField`
     - `connectorValidationReason`
     - `connectorValidationErrorCode`
     - `connectorValidationReceived`
     - `connectorValidationMinimum`
     - `connectorValidationMaximum`
   - Confirm recent correlated events include governance schema parity context when present:
     - `governanceStatus`
     - `governanceSchemaReasonCodeParityOk`
     - `governanceSchemaRecommendedCommandParityOk`
     - `governanceSchemaHandoffParityOk`
     - `governanceSchemaAllParityOk`
     - `governanceSchemaRolloutBlocked`
     - `governanceSchemaReasonCodeCount`
     - `governanceSchemaRecommendedCommandCount`
   - Confirm telemetry summary payload includes recent-event filter metadata:
     - `recentEventsFilter`
     - `recentEventsGovernanceStatusFilter`
     - `recentEventsPacketValidationStatusFilter`
     - `recentEventsTotalCount`
     - `recentEventsFilteredCount`
     - `recentEventsPacketValidationCount`
     - `recentEventsNonPacketCount`
     - `recentEventsGovernanceStatusCounts`
     - `recentEventsPacketValidationStatusCounts`
     - `recentEventsGovernanceStatusCountsSource`
     - `recentEventsPacketValidationStatusCountsSource`
     - `recentEventsGovernanceStatusCountsMismatch`
     - `recentEventsPacketValidationStatusCountsMismatch`
     - `recentEventsGovernanceStatusCountsServer`
     - `recentEventsPacketValidationStatusCountsServer`
     - `recentEventsGovernanceStatusCountsFallback`
     - `recentEventsPacketValidationStatusCountsFallback`
     - `recentEventsGovernanceStatusCountsPosture`
     - `recentEventsPacketValidationStatusCountsPosture`
     - `recentEventsGovernanceStatusCountsPostureSeverity`
     - `recentEventsPacketValidationStatusCountsPostureSeverity`
     - `recentEventsGovernanceStatusCountsRequiresInvestigation`
     - `recentEventsPacketValidationStatusCountsRequiresInvestigation`
   - Telemetry status-count provenance interpretation matrix:
     - `source=server, mismatch=false`: trust server rollups and continue normal predictive triage.
     - `source=server, mismatch=true`: treat as server/row drift and pause predictive rollout decisions until resolved.
     - `source=local, mismatch=false`: server rollups were unavailable and local row-derived fallback is expected.
     - `source=local, mismatch=true`: backend forced local fallback but preserved drift evidence; escalate and inspect `recentEvents...CountsServer` vs `recentEvents...CountsFallback`.
   - When backend posture metadata is present (`recentEvents...CountsPosture*`), predictive UI posture chips and export posture fields should mirror backend metadata.
   - If backend posture tokens are invalid/unsupported, predictive posture chips and export posture fields must fall back to computed source+mismatch posture defaults.
   - UI posture marker should be visible:
     - `Status-count posture • Governance: SERVER_CONSISTENT|SERVER_DRIFT|LOCAL_FALLBACK|LOCAL_DRIFT • Packet: SERVER_CONSISTENT|SERVER_DRIFT|LOCAL_FALLBACK|LOCAL_DRIFT.`
   - Sales telemetry export parity for provenance matrix:
     - `exportRecentEventsGovernanceStatusCountsSource`
     - `exportRecentEventsPacketValidationStatusCountsSource`
     - `exportRecentEventsGovernanceStatusCountsMismatch`
     - `exportRecentEventsPacketValidationStatusCountsMismatch`
     - `exportRecentEventsGovernanceStatusCountsServer`
     - `exportRecentEventsPacketValidationStatusCountsServer`
     - `exportRecentEventsGovernanceStatusCountsFallback`
     - `exportRecentEventsPacketValidationStatusCountsFallback`
     - `exportRecentEventsGovernanceStatusCountsPosture`
     - `exportRecentEventsPacketValidationStatusCountsPosture`
     - `exportRecentEventsGovernanceStatusCountsPostureSeverity`
     - `exportRecentEventsPacketValidationStatusCountsPostureSeverity`
     - `exportRecentEventsGovernanceStatusCountsRequiresInvestigation`
     - `exportRecentEventsPacketValidationStatusCountsRequiresInvestigation`
   - Supported `recentEventsFilter` values are `all` and `packet`; if response includes unsupported values, treat as fallback to local operator-selected filter.
   - `governancePacketValidationStatus` and `governanceStatus` values should be normalized status tokens (`A-Z0-9` with `_` separators); punctuation-only tokens are treated as absent in recent-event rows and counted as `UNKNOWN` in packet-validation status rollups when freshness markers are present.
   - If `recentEventsTotalCount` or `recentEventsFilteredCount` is malformed (negative/non-numeric/non-finite), confirm UI normalizes counts so `Showing X of Y recent events.` remains bounded by rendered rows.
   - If server-applied `recentEventsFilter` differs from selected UI filter, confirm mismatch notice is shown and exported `exportRecentEventsFilter` matches server-applied filter.
   - In packet-only mode with no packet-validation rows, confirm dashboard shows remediation hint:
     - `No packet-validation events in this telemetry window.`
     - `Increase Window Days or Event Limit`
   - Validate packet-only telemetry API query contract:
     - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=true`
     - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=false`
     - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&governance_status=ACTION_REQUIRED`
     - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_validation_status=READY`
     - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=true&packet_validation_status=READY`
     - blank/punctuation-only status filters return `400` (`governance_status` and `packet_validation_status` must be non-empty status tokens).
   - Validate governance schema preflight endpoint contract:
     - `GET /api/integrations/integrations/telemetry/governance-schema`
     - `schemaMetadata.activeVersion`
     - `schemaMetadata.source`
     - `schemaMetadata.override.isSet`
     - `schemaMetadata.override.isValid`
     - `schemaContractParity.reasonCodeCount`
     - `schemaContractParity.recommendedCommandCount`
     - `schemaContractParity.reasonCodeParity.topLevelVsRolloutActions`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportActions`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportAlerts`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes`
     - `schemaContractParity.recommendedCommandParity.topLevelVsExport`
     - `schemaContractParity.handoffParity.rolloutBlockedMatchesExport`
     - `schemaContractParity.handoffParity.ownerRoleMatchesExport`
     - `schemaContractParity.handoffParity.handoffActionsMatchRolloutActions`
      - `reason_code_parity_ok`
      - `recommended_command_parity_ok`
      - `handoff_parity_ok`
      - `status`
   - Validate telemetry summary governance schema parity rollup:
     - `governanceSchemaAudit.eventCount`
     - `governanceSchemaAudit.statusCounts`
     - `governanceSchemaAudit.reasonCodeParityPassCount`
     - `governanceSchemaAudit.reasonCodeParityFailCount`
     - `governanceSchemaAudit.recommendedCommandParityPassCount`
     - `governanceSchemaAudit.recommendedCommandParityFailCount`
     - `governanceSchemaAudit.handoffParityPassCount`
     - `governanceSchemaAudit.handoffParityFailCount`
     - `governanceSchemaAudit.allParityPassedCount`
     - `governanceSchemaAudit.allParityFailedCount`
     - `governanceSchemaAudit.rolloutBlockedCount`
     - `governanceSchemaAudit.latestEvaluatedAt`
   - Validate governance schema audit UI posture fields:
     - `Governance Schema Audit Posture`
     - `Parity posture: PASS` / `Parity posture: FAIL`
   - Validate weekly governance payload parity used by the Sales Intelligence governance panel:
     - `schemaMetadata`
     - `reasonCodes`
     - `duplicateArtifactNames`
   - Confirm dashboard operation notice can be dismissed and auto-clears after a short timeout.
1. Call `GET /api/sales-intelligence/analytics/phrases` with authenticated user.
2. Verify payload includes:
   - ranked `phrases`
   - `effectivenessScore`
   - `confidence`
3. Call `GET /api/sales-intelligence/analytics/phrases/channel-summary` for channel-level view.
3. Call `POST /api/sales-intelligence/prediction/response` with sample message/prospect context.
4. Verify payload includes:
   - `responseProbability`
   - `confidence`
   - `rationale`
   - `recommendedSendWindows`
5. Submit feedback:
   - `POST /api/sales-intelligence/prediction/feedback`
   - Verify `success=true` and `feedbackId` present.
6. Fetch calibration summary:
   - `GET /api/sales-intelligence/prediction/performance`
   - Verify `sampleSize`, `meanAbsoluteCalibrationError`, and `byChannel`.
7. Fetch feedback history:
   - `GET /api/sales-intelligence/prediction/feedback/history`
   - Verify records are sorted by `createdAt` descending and respect `limit`.
8. Fetch decision report:
   - `GET /api/sales-intelligence/prediction/performance/report`
   - Verify `qualityTier`, `rolloutDecision`, and `recommendations`.
9. Validate pipeline forecast:
   - `GET /api/sales-intelligence/forecast/pipeline`
   - Verify weighted/projected values and `confidenceInterval`.
   - Verify reliability fields: `confidenceIntervalWidth`, `confidenceIntervalWidthPct`, `forecastReliabilityTier`, `forecastRecommendation`.
   - Verify telemetry event payload includes `confidence_interval_width`, `confidence_interval_width_pct`, and `forecast_reliability_tier`.
10. Validate conversation intelligence:
   - `GET /api/sales-intelligence/conversation/intelligence`
   - Verify sentiment mix, objection list, and source counts.
11. Validate multi-channel engagement:
   - `GET /api/sales-intelligence/engagement/multi-channel?campaign_limit=100&ab_test_limit=200&prospect_limit=300`
   - Verify `coverageScore`, recommendations, `sourceCounts`, and `appliedLimits`.
12. Validate campaign lifecycle:
   - Create/list/get/activate/metrics endpoints under `/api/sales-intelligence/campaigns`
   - Verify status and metric increments persist.
13. Validate campaign performance views:
   - `GET /api/sales-intelligence/campaigns/{campaign_id}/performance`
   - `GET /api/sales-intelligence/campaigns/performance/portfolio`
   - Verify quality tier, ranked campaigns, and aggregate reply metrics.
14. Validate relationship map:
   - `GET /api/sales-intelligence/relationships/map`
   - Verify node/edge stats and average relationship strength.
15. Validate request correlation and telemetry schema metadata:
   - Repeat one analytics or prediction request with `X-Request-Id` header set.
   - Verify emitted telemetry payload includes `request_id` and `schema_version`.
   - Verify telemetry record root includes `schemaVersion=2`.
16. Validate connector schema sample gate dependency before predictive rollout expansion:
   - Review latest connector SLO gate snapshot (`connector_canary_evidence.json`).
   - Confirm `gates.schemaSampleSizePassed=true` and `gates.schemaCoveragePassed=true`.
   - Confirm `schemaCoverage.sampleCount >= schemaCoverage.minSampleCount`.
   - If `schemaSampleSizePassed=false`, treat predictive rollout as HOLD until additional schema-v2 telemetry is collected.
17. (Optional) Force stricter canary threshold during dry-run evidence collection:
   - Run connector evidence collection with `--min-schema-v2-sample-count 25`.
   - Confirm resulting `sloSummary.schemaCoverage.minSampleCount` and `sloSummary.gates.schemaSampleSizePassed` values are present in the evidence snapshot.

## Alerting and Risk Signals
- Elevated `5xx` for either endpoint.
- Repeated low-confidence predictions (<0.6) across large user segment.
- Unexpected negative effectiveness dominance in phrase analytics after release.
- Missing telemetry events:
  - `sales_phrase_analytics_generated`
  - `sales_phrase_channel_summary_generated`
  - `sales_response_prediction_generated`
  - `sales_response_prediction_feedback_recorded`
  - `sales_response_prediction_performance_viewed`
  - `sales_response_prediction_feedback_history_viewed`
  - `sales_response_prediction_report_viewed`
  - `sales_pipeline_forecast_generated`
  - `sales_conversation_intelligence_generated`
  - `sales_multi_channel_engagement_generated`
  - `sales_campaign_created`
  - `sales_campaign_list_viewed`
  - `sales_campaign_viewed`
  - `sales_campaign_activated`
  - `sales_campaign_metrics_recorded`
  - `sales_campaign_performance_viewed`
  - `sales_campaign_portfolio_viewed`
  - `sales_relationship_map_generated`

## Observability Events
- Provider: `sales_intelligence`
- Event types:
  - `sales_phrase_analytics_generated`
  - `sales_phrase_channel_summary_generated`
  - `sales_response_prediction_generated`
  - `sales_response_prediction_feedback_recorded`
  - `sales_response_prediction_performance_viewed`
  - `sales_response_prediction_feedback_history_viewed`
  - `sales_response_prediction_report_viewed`
  - `sales_pipeline_forecast_generated`
  - `sales_conversation_intelligence_generated`
  - `sales_multi_channel_engagement_generated`
  - `sales_campaign_created`
  - `sales_campaign_list_viewed`
  - `sales_campaign_viewed`
  - `sales_campaign_activated`
  - `sales_campaign_metrics_recorded`
  - `sales_campaign_performance_viewed`
  - `sales_campaign_portfolio_viewed`
  - `sales_relationship_map_generated`
- Sensitive data handling:
  - Raw message/subject text is not persisted in telemetry payload.
  - Store only aggregate metadata (counts, channel, confidence, length).
  - Persist request correlation only as bounded `request_id` metadata.
  - Persist telemetry schema metadata as `schema_version` (payload) and `schemaVersion` (event root).
  - Persist governance-status contract fields at event root for query/index parity:
    - `governanceStatus`
    - `governancePacketValidationStatus`
    - `governancePacketValidationWithinFreshness`

## Rollback
1. Disable `ENABLE_PHRASE_ANALYTICS`.
2. Disable `ENABLE_RESPONSE_PREDICTION`.
3. Disable `ENABLE_RESPONSE_PREDICTION_FEEDBACK`.
4. Disable `ENABLE_PIPELINE_FORECAST`.
5. Disable `ENABLE_CONVERSATION_INTELLIGENCE`.
6. Disable `ENABLE_MULTI_CHANNEL_ENGAGEMENT`.
7. Disable `ENABLE_SALES_CAMPAIGNS`.
8. Disable `ENABLE_RELATIONSHIP_MAP`.
9. Re-run smoke and sales-only tests.
10. Communicate rollback and open follow-up issue for model/rule tuning.

## Rollback Evidence Artifacts
- `backend/test_reports/connector_canary_evidence.json`
- `backend/test_reports/connector_signoff_validation.json`
- `backend/test_reports/connector_release_gate_result.json`
- Incident summary with impacted sales segments/channels and mitigation timeline

## Evidence Artifact Retention
- Baseline metrics artifact: `backend/test_reports/baseline_metrics.json`
- Retain predictive and connector rollout evidence artifacts for at least 14 days.

## Telemetry Export Schema (Sales Intelligence)
- Sales telemetry export payload (`sales-telemetry-summary-*.json`) should include:
  - `generatedAt`
  - `windowDays`
  - `eventCount`
  - `errorEventCount`
  - `salesIntelligence.byEventFamily`
  - `packetValidationAudit`
  - `recentEvents`
  - `recentEventsFilter`
  - `recentEventsTotalCount`
  - `recentEventsFilteredCount`
  - `recentEventsPacketValidationCount`
  - `recentEventsNonPacketCount`
  - `recentEventsGovernanceStatusCounts`
  - `recentEventsPacketValidationStatusCounts`
  - `recentEventsGovernanceStatusCountsSource`
  - `recentEventsPacketValidationStatusCountsSource`
  - `recentEventsGovernanceStatusCountsMismatch`
  - `recentEventsPacketValidationStatusCountsMismatch`
  - `recentEventsGovernanceStatusCountsServer`
  - `recentEventsPacketValidationStatusCountsServer`
  - `recentEventsGovernanceStatusCountsFallback`
  - `recentEventsPacketValidationStatusCountsFallback`
  - `exportRecentEventsGovernanceStatusCountsPosture`
  - `exportRecentEventsPacketValidationStatusCountsPosture`
  - `exportRecentEventsGovernanceStatusCountsPostureSeverity`
  - `exportRecentEventsPacketValidationStatusCountsPostureSeverity`
  - `exportRecentEventsGovernanceStatusCountsRequiresInvestigation`
  - `exportRecentEventsPacketValidationStatusCountsRequiresInvestigation`
  - `exportRequestedWindowDays`
  - `exportRequestedLimit`
  - `exportSchemaVersion`
  - `exportRecentEventsFilter`
  - `exportRecentEventsSelectedFilter`
  - `exportRecentEventsServerFilter`
  - `exportRecentEventsServerFilterRaw`
  - `exportRecentEventsServerFilterRawTrimmed`
  - `exportRecentEventsServerFilterBlank`
  - `exportRecentEventsServerFilterUnsupported`
  - `exportRecentEventsServerFilterEvaluation`
  - `exportRecentEventsServerFilterNormalizationChanged`
  - `exportRecentEventsFilterMismatch`
  - `exportRecentEventsFilterSource`
  - `exportRecentEventsFilterResolution`
  - `exportRecentEventsDisplayedCount`
  - `exportRecentEventsTotalCount`
  - `exportRecentEventsPacketValidationCount`
  - `exportRecentEventsNonPacketCount`
  - `exportRecentEventsGovernanceStatusCounts`
  - `exportRecentEventsPacketValidationStatusCounts`
  - `exportRetryAuditEventCount`
  - `exportRetryAuditLatestEventAt`
  - `exportRetryAuditMaxNextDelaySeconds`
  - `exportRetryAuditAvgNextDelaySeconds`
  - `exportRetryAuditOperationCount`
  - `exportRetryAuditProviderCount`
  - `exportOrchestrationAuditEventCount`
  - `exportOrchestrationAuditLatestEventAt`
  - `exportOrchestrationAuditMaxAttemptCount`
  - `exportOrchestrationAuditAvgAttemptCount`
  - `exportOrchestrationAuditProviderCount`
  - `exportOrchestrationAuditReasonCodeCount`
- `exportRecentEventsFilterSource` should be `server` when response echoes a supported filter token; otherwise `local`.
- `exportRecentEventsFilterResolution` should be:
  - `server_supported`
  - `local_no_server_filter`
  - `local_blank_server_filter`
  - `local_unsupported_server_filter`
- `exportRecentEventsServerFilterBlank` should be `true` when `exportRecentEventsServerFilterRaw` exists but trims to an empty token.
- `exportRecentEventsServerFilterUnsupported` should be `true` when `exportRecentEventsServerFilterRaw` exists but does not normalize to supported values (`all`, `packet`).
- `exportRecentEventsPacketValidationCount` and `exportRecentEventsNonPacketCount` should reconcile to telemetry recent-event window distribution context in exported evidence.
- `exportSchemaVersion` should be present and match the current telemetry export contract version for consumer compatibility checks.
- `exportRecentEventsServerFilterEvaluation` should be `supported`, `unsupported`, or `absent` based on server token normalization outcome.
- `exportRecentEventsServerFilterNormalizationChanged` should be `true` when supported server token required casing/whitespace normalization before canonical comparison.
- Before release signoff attachment, confirm export context matches operator intent:
  - non-default windows (`exportRequestedWindowDays`/`exportRequestedLimit`)
  - packet-only event review (`exportRecentEventsFilter=packet`)

## Campaign Portfolio/Performance Export Schema (Sales Intelligence)
- Sales campaign portfolio export payload (`sales-campaign-portfolio-*.json`) should include:
  - `campaignCount`
  - `activeCampaignCount`
  - `portfolioTotals.sent`
  - `portfolioTotals.opened`
  - `portfolioTotals.replied`
  - `averageReplyRate`
  - `rankedCampaigns`
  - `windowDays`
  - `statusFilter`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedStatus`
  - `exportRequestedLimit`
  - `exportServerStatusFilter`
- Sales campaign performance export payload (`sales-campaign-performance-*.json`) should include:
  - `campaignId`
  - `status`
  - `totals.sent`
  - `totals.opened`
  - `totals.replied`
  - `overall.replyRate`
  - `byChannel`
  - `channelCount`
  - `displayedChannelCount`
  - `appliedChannelLimit`
  - `channelsTruncated`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedStatus`
  - `exportRequestedLimit`
  - `exportRequestedChannelLimit`
  - `exportDisplayedChannelCount`
  - `exportSelectedCampaignId`
  - `exportPortfolioServerStatusFilter`

## Pipeline Forecast Export Schema (Sales Intelligence)
- Sales pipeline forecast export payload (`sales-pipeline-forecast-*.json`) should include:
  - `openPipelineValue`
  - `weightedPipelineValue`
  - `projectedWonValue`
  - `historicalWinRate`
  - `confidenceInterval.low`
  - `confidenceInterval.high`
  - `confidenceIntervalWidth`
  - `confidenceIntervalWidthPct`
  - `forecastReliabilityTier`
  - `forecastRecommendation`
  - `sampleSize.openProspects`
  - `sampleSize.closedOutcomes`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`

## Prediction Quality Export Schema (Sales Intelligence)
- Sales prediction quality export payload (`sales-prediction-report-*.json`) should include:
  - `qualityTier`
  - `rolloutDecision`
  - `sampleSize`
  - `meanAbsoluteCalibrationError`
  - `recommendations`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`

## Conversation Intelligence Export Schema (Sales Intelligence)
- Sales conversation export payload (`sales-conversation-intelligence-*.json`) should include:
  - `totals.records`
  - `totals.channels`
  - `sentiment`
  - `topObjections`
  - `relationshipHealth`
  - `sources.chatSessions`
  - `sources.emailEvents`
  - `windowDays`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedLimit`

## Multi-Channel and Relationship Export Schema (Sales Intelligence)
- Sales multi-channel export payload (`sales-multi-channel-health-*.json`) should include:
  - `activeChannels`
  - `coverageScore`
  - `channelUsage`
  - `recommendations`
  - `sourceCounts`
  - `appliedLimits`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedCampaignLimit`
  - `exportRequestedAbTestLimit`
  - `exportRequestedProspectLimit`
- Sales relationship export payload (`sales-relationship-map-*.json`) should include:
  - `stats.prospects`
  - `stats.companies`
  - `stats.connections`
  - `stats.averageRelationshipStrength`
  - `nodes`
  - `edges`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedLimit`

## Phrase Analytics Export Schema (Sales Intelligence)
- Sales phrase analytics export payload (`sales-phrase-analytics-*.json`) should include:
  - `phrases`
  - `summary.trackedPhrases`
  - `summary.candidatePhraseCount`
  - `totalRecords`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedMinExposure`
  - `exportRequestedLimit`

## Phrase Channel Summary Export Schema (Sales Intelligence)
- Sales phrase channel summary export payload (`sales-phrase-channel-summary-*.json`) should include:
  - `channels`
  - `channelCount`
  - `totalRecords`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedMinExposure`
  - `exportRequestedLimit`

## Prediction Feedback Performance Export Schema (Sales Intelligence)
- Sales prediction performance export payload (`sales-prediction-performance-*.json`) should include:
  - `sampleSize`
  - `positiveRate`
  - `averagePredictedProbability`
  - `meanAbsoluteCalibrationError`
  - `byChannel`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`

## Prediction Feedback History Export Schema (Sales Intelligence)
- Sales prediction feedback history export payload (`sales-prediction-feedback-history-*.json`) should include:
  - `records`
  - `count`
  - `windowDays`
  - `generatedAt`
  - `exportSchemaVersion`
  - `exportGeneratedAt`
  - `exportRequestedWindowDays`
  - `exportRequestedLimit`

## Data Quality Notes
- `window_days` filters are applied to phrase analytics and performance/history endpoints.
- When `predictionId` is provided, feedback writes are idempotent (same record updated, not duplicated).
