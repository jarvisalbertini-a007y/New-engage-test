# Integrations Reliability Runbook (Sales-Only)

## Scope
Operational guidance for SendGrid reliability and feature-flagged sales data connectors (Apollo, Clearbit, Crunchbase).

## Endpoints
- `POST /api/integrations/email/send`
- `POST /api/integrations/webhook/sendgrid`
- `GET /api/integrations/integrations`
- `GET /api/integrations/integrations/health`
- `GET /api/integrations/integrations/telemetry/summary`
- `GET /api/integrations/integrations/telemetry/governance-report`
- `GET /api/integrations/integrations/telemetry/governance-report/export`
- `GET /api/integrations/integrations/telemetry/governance-report/history`
- `GET /api/integrations/integrations/telemetry/governance-schema`
- `GET /api/integrations/integrations/telemetry/snapshot-governance`
- `GET /api/integrations/integrations/telemetry/baseline-governance`
- `GET /api/integrations/integrations/telemetry/slo-gates`
- `POST /api/integrations/integrations/{provider}`

## Feature Flags
- `ENABLE_APOLLO_CONNECTOR` (default: false)
- `ENABLE_CLEARBIT_CONNECTOR` (default: false)
- `ENABLE_CRUNCHBASE_CONNECTOR` (default: false)

## Monitoring
- Watch integration structured log events:
  - `sendgrid_send_success`
  - `sendgrid_send_error`
  - `sendgrid_webhook_processed`
  - `integrations_retry_attempt`
  - `integrations_retry_fail_fast`
  - `integrations_retry_exhausted`
  - `integrations_connector_credential_saved`
  - `integrations_connector_credential_removed`
- Track error rate by provider and response status.
- Track latency for SendGrid send and health checks.
- For webhook analytics confidence, track `user_context_count` and `missing_user_context_count`.
- Track webhook update-skip posture via `missingSendIdForUpdate` for update events missing `send_id`.
- Track webhook normalization posture via `unknownEventTypeCount`, `invalidTimestampCount`, and `eventTypeCounts.unknown` to catch malformed event payloads before they distort attribution counters.
- Track webhook attribution triage posture via `updateEligibleEventCount`, `updateEligibleEventTypeCounts`, `unsupportedEventTypeCount`, `unsupportedEventTypeCounts`, `emailUpdateEventTypeCounts`, `missingSendIdByEventType`, and `deduplicatedEventTypeCounts`.
- Track webhook timestamp posture via `timestampFallbackCount`, `futureSkewEventCount`, `staleEventCount`, `freshEventCount`, `futureSkewEventTypeCounts`, `staleEventTypeCounts`, `timestampFallbackEventTypeCounts`, `timestampAgeBucketCounts`, `futureSkewThresholdSeconds`, and `staleEventAgeThresholdSeconds`.
- Track webhook timestamp pressure posture via `timestampPressureLabel`, `timestampPressureHint`, `timestampAnomalyCount`, `timestampAnomalyRatePct`, `timestampAnomalyEventTypeCounts`, `timestampDominantAnomalyBucket`, `timestampDominantAnomalyBucketCount`, `timestampDominantAnomalyEventType`, `timestampDominantAnomalyEventTypeCount`, `timestampPressureHighAnomalyRatePct`, `timestampPressureModerateAnomalyRatePct`, `timestampPressureHighAnomalyCount`, and `timestampPressureModerateAnomalyCount`.
- Track SendGrid timestamp pressure aggregate posture via telemetry summary `sendgridWebhookTimestamp.eventCount`, `sendgridWebhookTimestamp.pressureLabelCounts`, `sendgridWebhookTimestamp.pressureHintCounts`, `sendgridWebhookTimestamp.timestampFallbackCount`, `sendgridWebhookTimestamp.futureSkewEventCount`, `sendgridWebhookTimestamp.staleEventCount`, `sendgridWebhookTimestamp.freshEventCount`, `sendgridWebhookTimestamp.timestampAnomalyCountTotal`, `sendgridWebhookTimestamp.avgTimestampAnomalyRatePct`, `sendgridWebhookTimestamp.maxTimestampAnomalyRatePct`, `sendgridWebhookTimestamp.timestampAgeBucketCounts`, `sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts`, `sendgridWebhookTimestamp.timestampDominantAnomalyBucketCounts`, `sendgridWebhookTimestamp.timestampDominantAnomalyEventTypeCounts`, and `sendgridWebhookTimestamp.latestEventAt`.
- Track SendGrid timestamp pressure recent-event parity via telemetry summary `recentEvents[].timestampPressureLabel`, `recentEvents[].timestampPressureHint`, `recentEvents[].timestampAnomalyCount`, `recentEvents[].timestampAnomalyRatePct`, `recentEvents[].timestampAnomalyEventTypeCounts`, `recentEvents[].timestampDominantAnomalyBucket`, `recentEvents[].timestampDominantAnomalyEventType`, `recentEvents[].timestampAgeBucketCounts`, `recentEvents[].futureSkewThresholdSeconds`, and `recentEvents[].staleEventAgeThresholdSeconds`.
- Track integrations health remediation posture via:
  - `status`
  - `healthyCount`
  - `unhealthyCount`
  - `actionableUnhealthyProviders`
  - `credentialActionRequiredProviders`
  - `credentialConfiguredMaxAgeDays`
  - `credentialRotationMaxAgeDays`
  - `alerts`
  - `recommendedCommands`
- Track retry-attempt observability posture via telemetry summary:
  - `retryAudit.eventCount`
  - `retryAudit.byOperation`
  - `retryAudit.byProvider`
  - `retryAudit.maxNextDelaySeconds`
  - `retryAudit.avgNextDelaySeconds`
  - `retryAudit.latestEventAt`
- Track orchestration attempt posture via telemetry summary:
  - `orchestrationAudit.eventCount`
  - `orchestrationAudit.attemptStatusCounts`
  - `orchestrationAudit.reasonCodeCounts`
  - `orchestrationAudit.maxAttemptCount`
  - `orchestrationAudit.avgAttemptCount`
  - `orchestrationAudit.maxLatencyMs`
  - `orchestrationAudit.avgLatencyMs`
  - `orchestrationAudit.trendByDay`
- Track retry-audit SLO gate posture via SLO payload:
  - `retryAudit.maxEventCountThreshold`
  - `retryAudit.observedEventCount`
  - `retryAudit.maxAvgNextDelaySecondsThreshold`
  - `retryAudit.observedAvgNextDelaySeconds`
  - `retryAudit.observedMaxNextDelaySeconds`
  - `gates.retryAuditVolumePassed`
  - `gates.retryAuditDelayPassed`
- Track orchestration attempt SLO gate posture via SLO payload:
  - `orchestrationAudit.maxAttemptErrorCountThreshold`
  - `orchestrationAudit.observedAttemptErrorCount`
  - `orchestrationAudit.maxAttemptSkippedCountThreshold`
  - `orchestrationAudit.observedAttemptSkippedCount`
  - `gates.orchestrationAttemptErrorPassed`
  - `gates.orchestrationAttemptSkippedPassed`
- Track baseline-governance orchestration posture via baseline artifact contract:
  - `orchestrationGate.available`
  - `orchestrationGate.decision`
  - `orchestrationGate.attemptErrorGatePassed`
  - `orchestrationGate.attemptSkippedGatePassed`
  - `orchestrationGate.maxAttemptErrorCountThreshold`
  - `orchestrationGate.observedAttemptErrorCount`
  - `orchestrationGate.maxAttemptSkippedCountThreshold`
  - `orchestrationGate.observedAttemptSkippedCount`
  - `recommendedCommands`
  - `governanceExport.recommendedCommands`
- Track sales-intelligence event families via telemetry summary `salesIntelligence.byEventFamily`.
- Track telemetry schema adoption via summary `bySchemaVersion` and `salesIntelligence.bySchemaVersion`.
- Track schema rollout safety via SLO payload `schemaCoverage`, `gates.schemaCoveragePassed`, and `gates.schemaSampleSizePassed`.
- Track traceability audit posture via telemetry summary `traceabilityAudit.eventCount`, `traceabilityAudit.decisionCounts`, `traceabilityAudit.readyCount`, and `traceabilityAudit.notReadyCount`.
- Track governance packet-validation posture via telemetry summary `packetValidationAudit.eventCount`, `packetValidationAudit.statusCounts`, `packetValidationAudit.withinFreshnessCount`, and `packetValidationAudit.outsideFreshnessCount`.
- Track telemetry recent-event filter metadata via summary `recentEventsFilter`, `recentEventsTotalCount`, `recentEventsFilteredCount`, `recentEventsPacketValidationCount`, `recentEventsNonPacketCount`, `recentEventsGovernanceStatusCounts`, and `recentEventsPacketValidationStatusCounts`.
- Track standardized top-level telemetry document fields to avoid payload-shape drift:
  - `requestId`
  - `schemaVersion`
  - `governanceStatus`
  - `governancePacketValidationStatus`
  - `governancePacketValidationWithinFreshness`
- Track telemetry query/index posture for status and correlation filters:
  - `integration_telemetry(userId, governanceStatus, createdAt desc)`
  - `integration_telemetry(userId, governancePacketValidationStatus, createdAt desc)`
  - `integration_telemetry(userId, requestId, createdAt desc)`
  - `integration_telemetry(userId, schemaVersion, createdAt desc)`
- Track connector credential lifecycle posture via summary `connectorLifecycle.eventCount`, `connectorLifecycle.byAction`, and `connectorLifecycle.byProvider`.
- Track connector endpoint throttling posture via:
  - `integrations_connector_rate_limited`
  - `connectorRateLimit.eventCount`
  - `connectorRateLimit.byEndpoint`
  - `connectorRateLimit.latestEventAt`
- Track connector input-validation posture via:
  - `integrations_connector_input_validation_failed`
  - `connectorValidation.eventCount`
  - `connectorValidation.byEndpoint`
  - `connectorValidation.byProvider`
  - `connectorValidation.byField`
  - `connectorValidation.byReason`
  - `connectorValidation.latestEventAt`
- Apply webhook timestamp-pressure thresholds for triage:
  - `High`: `timestampAnomalyCount >= timestampPressureHighAnomalyCount` or `timestampAnomalyRatePct >= timestampPressureHighAnomalyRatePct`
  - `Moderate`: `timestampAnomalyCount >= timestampPressureModerateAnomalyCount` or `timestampAnomalyRatePct >= timestampPressureModerateAnomalyRatePct`
  - `Low`: anomaly count > 0 and below moderate thresholds
  - `Unknown`: no timestamp anomalies observed
- Track connector rate-limit recent-event context fields:
  - `connectorRateLimitEndpoint`
  - `connectorRateLimitRetryAfterSeconds`
  - `connectorRateLimitWindowSeconds`
  - `connectorRateLimitMaxRequests`
- Track connector input-validation recent-event context fields:
  - `connectorValidationProvider`
  - `connectorValidationEndpoint`
  - `connectorValidationField`
  - `connectorValidationReason`
  - `connectorValidationErrorCode`
  - `connectorValidationReceived`
  - `connectorValidationMinimum`
  - `connectorValidationMaximum`
- Track weekly governance trend posture via governance report `totals`, `timeline`, and `recommendedCommands`.
- Track governance report generation telemetry via `integrations_traceability_governance_report_generated`.
- Track governance report export/history telemetry via:
  - `integrations_traceability_governance_report_exported`
  - `integrations_traceability_governance_report_history_viewed`
- Track governance schema metadata posture for packet compatibility:
  - `schemaMetadata.activeVersion`
  - `schemaMetadata.source`
  - `schemaMetadata.override.isSet`
  - `schemaMetadata.override.isValid`
- Track governance schema export parity metadata for operator handoff evidence:
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
- Track governance schema parity telemetry audit fields:
  - `reason_code_parity_ok`
  - `recommended_command_parity_ok`
  - `handoff_parity_ok`
- Track governance schema parity rollup in telemetry summary:
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
- Track governance schema recent-event parity context:
  - `governanceSchemaReasonCodeParityOk`
  - `governanceSchemaRecommendedCommandParityOk`
  - `governanceSchemaHandoffParityOk`
  - `governanceSchemaAllParityOk`
  - `governanceSchemaRolloutBlocked`
  - `governanceSchemaReasonCodeCount`
  - `governanceSchemaRecommendedCommandCount`
- Track normalized governance remediation reasoning:
  - `reasonCodes`
  - `reasonCodeCount`
  - `recommendedCommands`
  - `recommendedCommandCount`
  - `governanceExport.reasonCodes`
  - `governanceExport.reasonCodeCount`
  - `governanceExport.recommendedCommands`
  - `governanceExport.recommendedCommandCount`
  - `governanceExport.alerts[].reasonCode`
- Track governance history schema and lineage integrity:
  - `schemaVersionCounts`
  - `duplicateArtifactNames`
- Track governance handoff/history connector-pressure parity metadata:
  - `connectorPressureParity.eventCountMatchesNested`
  - `connectorPressureParity.eventCountMatchesTotals`
  - `connectorPressureParity.byEndpointMatchesNested`
  - `connectorPressureParity.pressureLabelMatchesNested`
- Track telemetry export context metadata fields for evidence handoff:
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
- Validate traceability telemetry exports with snapshot contract + retention checks before rollout signoff.

## Alert Suggestions
- Trigger warning if SendGrid health checks fail for 3 consecutive checks.
- Trigger critical alert if SendGrid send failure rate exceeds 10% over 5 minutes.
- Trigger warning if webhook dedup cache insert failures appear.
- Trigger warning if connector input-validation failures exceed 5 events in 10 minutes.
- Trigger critical alert if connector input-validation failures exceed 2% of connector lookup requests over 15 minutes.

## Credential Freshness Incident Response
1. Detect stale credentials from health payload:
   - `status=ACTION_REQUIRED`
   - `credentialActionRequiredProviders`
   - `credentialFreshnessActionRequiredCount`
   - `credentialFreshnessStatusCounts`
   - `credentialFreshnessStatusCountsSource`
   - `credentialFreshnessStatusCountsMismatch`
   - `credentialFreshnessStatusCountsServer`
   - `credentialFreshnessStatusCountsFallback`
   - `credentialFreshnessByProvider`
   - provider `credentialStale=true`
   - provider `credentialStaleReasons`
2. Confirm stale-age context is present:
   - `credentialConfiguredMaxAgeDays`
   - `credentialRotationMaxAgeDays`
   - provider `credentialConfiguredAgeDays`
   - provider `credentialRotationAgeDays`
3. Rotate credentials for each stale provider using:
   - `POST /api/integrations/integrations/{provider}`
   - include a fresh provider API key and preserve `X-Request-Id` for audit correlation.
4. Re-run reliability validation commands:
   - `npm run verify:smoke:credential-freshness`
   - `npm run verify:smoke:connector-reliability`
   - `npm run verify:smoke:connector-orchestration`
   - `npm run verify:smoke:connector-provider-lookups`
   - `npm run verify:smoke:connector-lookups`
   - `npm run verify:smoke:connector-lookups-ui`
   - `npm run verify:smoke:connector-lookups-export`
   - `npm run verify:smoke:connector-input-validation`
   - `npm run verify:smoke:sendgrid-reliability`
5. Confirm recovery in health endpoint:
   - `status=READY`
   - `credentialFreshnessActionRequiredCount=0`
   - `credentialActionRequiredProviders=[]`
   - stale provider entries now report `credentialStale=false`.
6. Attach evidence for incident closure:
   - health payload before/after snapshots
   - smoke command pass output
   - telemetry summary `retryAudit` and connector lifecycle deltas for the incident window.

## Operational Verification
1. Configure SendGrid API key using integrations endpoint.
2. Confirm integrations listing returns masked key.
3. Send test email and verify send success log event.
4. Replay same webhook payload twice and verify event is processed once.
   - Connector lookup export contract validation:
     - `npm run verify:smoke:connector-lookups-export`
     - In Integrations UI run `Export Company Lookup JSON` and `Export Apollo Lookup JSON`.
     - Confirm lookup export evidence includes `exportSchemaVersion`, `exportGeneratedAt`, `exportType`, `selectedProvider`, `providerOrder`, and provider rate-limit metadata fields.
5. Confirm health endpoint reports provider status and any disabled connectors.
6. Confirm health payload includes operator-summary posture fields:
   - `status`
   - `healthyCount`
   - `unhealthyCount`
   - `actionableUnhealthyProviders`
   - `credentialActionRequiredProviders`
   - `credentialFreshnessStatusCounts`
   - `credentialFreshnessStatusCountsSource`
   - `credentialFreshnessStatusCountsMismatch`
   - `credentialFreshnessStatusCountsServer`
   - `credentialFreshnessStatusCountsFallback`
   - `credentialFreshnessByProvider`
   - `credentialFreshnessActionRequiredCount`
   - `credentialFreshnessWithinPolicyCount`
   - `credentialFreshnessUnknownCount`
   - `credentialConfiguredMaxAgeDays`
   - `credentialRotationMaxAgeDays`
   - `recommendedCommands`
7. Confirm Integrations page active-connector health summary card renders:
   - `Connector Credential Freshness`
   - `Health Status`
   - `Healthy/Unhealthy`
   - `Freshness ACTION_REQUIRED`
   - `Freshness READY/UNKNOWN`
   - `Freshness status-count source: server|local.`
   - provider-level freshness status rows for configured connectors.
   - If freshness rollups drift from provider-derived rows, warning text includes:
     - `Credential freshness status-count mismatch`
8. If provider freshness status rows are absent, confirm fallback text:
   - `No connector freshness telemetry yet.`
9. Confirm webhook response contains `processed`, `deduplicated`, `emailUpdates`, and `eventTypeCounts`.
10. Confirm webhook response includes `missingSendIdForUpdate` for update events that cannot map to a tracked send.
11. Confirm user-context extraction path: webhook payloads with `user_id` or `custom_args/unique_args.user_id` generate user-scoped telemetry records.
12. Confirm telemetry summary includes `salesIntelligence.eventCount` and `salesIntelligence.byEventFamily`.
13. Confirm connector credential lifecycle telemetry summary fields are present:
   - `connectorLifecycle.eventCount`
   - `connectorLifecycle.byAction`
   - `connectorLifecycle.byProvider`
14. Confirm telemetry summary includes schema-version breakdown fields:
   - `bySchemaVersion`
   - `salesIntelligence.bySchemaVersion`
13. Confirm telemetry summary `recentEvents` rows include correlation and schema metadata:
   - `requestId`
   - `schemaVersion`
   - `traceabilityDecision` (for traceability audit events)
   - `governanceStatus` (normalized governance status token when present)
   - `governancePacketValidationStatus` (for packet-validation posture events)
   - `governancePacketValidationWithinFreshness` (fresh/stale packet marker)
   - `retryOperation`, `retryAttempt`, `retryMaxAttempts`, `retryNextDelaySeconds`, `retryError` (for retry-attempt observability events)
   - `retryFinalOutcome`, `retryRetryable`, `retryErrorType`, `retryErrorStatusCode`, `retryErrorReasonCode` (for retry terminal-failure observability events)
   - `orchestrationSelectedProvider`, `orchestrationAttemptCount`, `orchestrationAttemptSuccessCount`, `orchestrationAttemptSkippedCount`, `orchestrationAttemptErrorCount`, `orchestrationAttemptReasonCodes`, `orchestrationResultCount` (for orchestration telemetry events)
   - `governanceSchemaReasonCodeParityOk`, `governanceSchemaRecommendedCommandParityOk`, `governanceSchemaHandoffParityOk`, `governanceSchemaAllParityOk`, `governanceSchemaRolloutBlocked`, `governanceSchemaReasonCodeCount`, `governanceSchemaRecommendedCommandCount` (for governance schema parity events)
14. Confirm packet-only recent-event summary filter behavior:
   - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=true`
   - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=false`
   - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&governance_status=ACTION_REQUIRED`
   - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_validation_status=READY`
   - `GET /api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=true&packet_validation_status=READY`
   - response includes `recentEventsFilter=packet`
   - response includes `recentEventsFilter=all` when packet filter is disabled
   - response includes `recentEventsGovernanceStatusFilter` and `recentEventsPacketValidationStatusFilter`
   - response includes `recentEventsTotalCount` and `recentEventsFilteredCount`
   - response includes `recentEventsPacketValidationCount` and `recentEventsNonPacketCount`
   - response includes `recentEventsGovernanceStatusCounts` and `recentEventsPacketValidationStatusCounts`
   - response includes `recentEventsGovernanceStatusCountsSource` and `recentEventsPacketValidationStatusCountsSource`
   - response includes `recentEventsGovernanceStatusCountsMismatch` and `recentEventsPacketValidationStatusCountsMismatch`
   - response includes `recentEventsGovernanceStatusCountsServer` and `recentEventsPacketValidationStatusCountsServer`
   - response includes `recentEventsGovernanceStatusCountsFallback` and `recentEventsPacketValidationStatusCountsFallback`
   - response includes `recentEventsGovernanceStatusCountsPosture` and `recentEventsPacketValidationStatusCountsPosture`
   - response includes `recentEventsGovernanceStatusCountsPostureSeverity` and `recentEventsPacketValidationStatusCountsPostureSeverity`
   - response includes `recentEventsGovernanceStatusCountsRequiresInvestigation` and `recentEventsPacketValidationStatusCountsRequiresInvestigation`
   - Telemetry status-count provenance interpretation matrix:
     - `source=server, mismatch=false`: trust server rollups and no drift remediation is required.
     - `source=server, mismatch=true`: treat as server/row drift and investigate telemetry aggregation before rollout decisions.
     - `source=local, mismatch=false`: server rollups were unavailable and local row-derived fallback is expected.
     - `source=local, mismatch=true`: backend forced local fallback but preserved drift evidence; escalate and inspect `recentEvents...CountsServer` vs `recentEvents...CountsFallback`.
   - When backend posture metadata is present (`recentEvents...CountsPosture*`), UI posture chips and export posture fields should match backend metadata exactly.
   - If backend posture tokens are invalid/unsupported, posture chips and export posture fields must fall back to computed source+mismatch posture defaults.
   - UI posture marker should be visible:
     - `Status-count posture • Governance: SERVER_CONSISTENT|SERVER_DRIFT|LOCAL_FALLBACK|LOCAL_DRIFT • Packet: SERVER_CONSISTENT|SERVER_DRIFT|LOCAL_FALLBACK|LOCAL_DRIFT.`
   - Export parity for provenance matrix:
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
   - blank/punctuation-only status filters are rejected with `400` (`governance_status` / `packet_validation_status` must be non-empty status tokens)
   - supported `recentEventsFilter` values are `all` and `packet`; treat any other value as unsupported and fall back to local operator-selected filter.
   - `governancePacketValidationStatus` and `governanceStatus` values are normalized status tokens (`A-Z0-9` with `_` separators); punctuation-only tokens are treated as absent in `recentEvents` and counted as `UNKNOWN` in `packetValidationAudit.statusCounts` when freshness markers are present.
   - if `recentEventsTotalCount` or `recentEventsFilteredCount` is malformed (negative/non-numeric/non-finite), UI count rendering must normalize to rendered-row bounds (`Showing X of Y recent events.` remains internally consistent).
   - when server-applied `recentEventsFilter` differs from selected UI filter, confirm mismatch notice appears and exported `exportRecentEventsFilter` matches server-applied filter.
   - if packet filter returns zero rows, confirm remediation hint is visible:
     - `No packet-validation events in this telemetry window.`
     - `Increase Window Days or Event Limit`
15. Confirm telemetry summary packet-validation posture fields are present:
   - `packetValidationAudit.eventCount`
   - `packetValidationAudit.statusCounts`
   - `packetValidationAudit.withinFreshnessCount`
   - `packetValidationAudit.outsideFreshnessCount`
   - `packetValidationAudit.missingFreshnessCount`
16. Confirm telemetry summary connector input-validation posture fields are present:
   - `connectorValidation.eventCount`
   - `connectorValidation.byEndpoint`
   - `connectorValidation.byProvider`
   - `connectorValidation.byField`
   - `connectorValidation.byReason`
   - `connectorValidation.latestEventAt`
   - Integrations telemetry dashboard includes `Connector Input-Validation Audits` and `Connector Input-Validation Posture`.
   - recent correlated events include connector-validation detail text with `connectorValidationEndpoint`, `connectorValidationField`, `connectorValidationReason`, `connectorValidationErrorCode`, `connectorValidationReceived`, `connectorValidationMinimum`, and `connectorValidationMaximum`.
17. Confirm SLO gate response includes schema coverage gate details:
   - `schemaCoverage.thresholdPct`
   - `schemaCoverage.observedPct`
   - `schemaCoverage.minSampleCount`
   - `gates.schemaCoveragePassed`
   - `gates.schemaSampleSizePassed`
18. Confirm SLO gate response includes orchestration attempt gate details:
   - `orchestrationAudit.maxAttemptErrorCountThreshold`
   - `orchestrationAudit.observedAttemptErrorCount`
   - `orchestrationAudit.maxAttemptSkippedCountThreshold`
   - `orchestrationAudit.observedAttemptSkippedCount`
   - `gates.orchestrationAttemptErrorPassed`
   - `gates.orchestrationAttemptSkippedPassed`
19. Confirm governance schema metadata endpoint reports valid operator posture:
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
20. Confirm governance schema parity telemetry and UI posture:
   - schema telemetry payload includes:
     - `reason_code_parity_ok`
     - `recommended_command_parity_ok`
     - `handoff_parity_ok`
   - telemetry summary includes:
     - `governanceSchemaAudit.eventCount`
     - `governanceSchemaAudit.reasonCodeParityPassCount`
     - `governanceSchemaAudit.reasonCodeParityFailCount`
     - `governanceSchemaAudit.allParityPassedCount`
     - `governanceSchemaAudit.allParityFailedCount`
   - UI governance schema card shows:
     - `Schema Parity Status: PASS` for parity-true payloads
     - `Failed checks:` warning if any parity field drifts
   - telemetry dashboard shows:
     - `Governance Schema Audits`
     - `Governance Schema Audit Status`
     - `Parity posture: PASS` (or `FAIL` when parity drift is present)
21. Confirm governance history schema-lineage checks:
   - `schemaVersionCounts`
   - `duplicateArtifactNames`
   - `reasonCodes`
   - `reasonCodeCount`
   - `recommendedCommands`
   - `recommendedCommandCount`
19. Confirm governance handoff/history connector-pressure parity metadata fields:
   - `connectorPressureParity.eventCountMatchesNested`
   - `connectorPressureParity.eventCountMatchesTotals`
   - `connectorPressureParity.byEndpointMatchesNested`
   - `connectorPressureParity.pressureLabelMatchesNested`
20. Confirm connector rate-limit telemetry rollup and event context fields are present:
   - `connectorRateLimit.eventCount`
   - `connectorRateLimit.byEndpoint`
   - `connectorRateLimit.latestEventAt`
   - `connectorRateLimit.maxRetryAfterSeconds`
   - `connectorRateLimit.avgRetryAfterSeconds`
   - `connectorRateLimit.maxResetInSeconds`
   - `connectorRateLimit.avgResetInSeconds`
   - `recentEvents[].connectorRateLimitEndpoint`
   - `recentEvents[].connectorRateLimitRetryAfterSeconds`
   - `recentEvents[].connectorRateLimitResetInSeconds`
   - Apply pressure thresholds for rollout posture:
     - `High`: `maxRetryAfterSeconds >= 45` or `avgResetInSeconds >= 45` (hold rollout expansion, reduce lookup concurrency)
     - `Moderate`: `20 <= maxRetryAfterSeconds < 45` or `20 <= avgResetInSeconds < 45` (keep rollout guarded, monitor trend)
     - `Low`: below moderate thresholds (continue guarded rollout with normal monitoring)
21. Confirm retry audit telemetry summary fields are present:
   - `retryAudit.eventCount`
   - `retryAudit.byOperation`
   - `retryAudit.byProvider`
   - `retryAudit.maxNextDelaySeconds`
   - `retryAudit.avgNextDelaySeconds`
   - `retryAudit.latestEventAt`
   - retry terminal export parity fields:
     - `exportRetryTerminalEventCount`
     - `exportRetryTerminalOutcomeCounts`
     - `exportRetryTerminalRetryabilityCounts`
     - `exportRetryTerminalErrorTypeCounts`
     - `exportRetryTerminalReasonCodeCounts`
     - `exportRetryTerminalStatusCodeCounts`
     - `exportRetryTerminalPressureLabel`
     - `exportRetryTerminalPressureHint`
     - `exportRetryTerminalPressureSignalCount`
     - `exportRetryTerminalTopOutcome`
     - `exportRetryTerminalTopReasonCode`
     - `exportRetryTerminalTopStatusCode`
21. Confirm connector throttling HTTP responses include operator-ready metadata:
   - `Retry-After` header
   - `X-RateLimit-Limit`
   - `X-RateLimit-Remaining`
   - `X-RateLimit-Window-Seconds`
   - `X-RateLimit-Reset-In-Seconds`
   - `detail.errorCode=connector_rate_limited`
   - `detail.retryAfterSeconds`
   - `detail.rateLimit.limit`
   - `detail.rateLimit.remaining`
   - `detail.rateLimit.windowSeconds`
   - `detail.rateLimit.resetInSeconds`
22. Confirm successful connector lookup responses include reset-window metadata:
   - `rateLimit.resetAt`
   - `rateLimit.resetInSeconds`
   - `X-RateLimit-Reset-At`
   - `X-RateLimit-Reset-In-Seconds`

## Verification Commands
- Runtime API checks (requires server + dependencies):
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_health_and_webhook.py`
  - `GET /api/integrations/integrations/telemetry/slo-gates?...&min_schema_v2_pct=95&min_schema_v2_sample_count=25&max_orchestration_attempt_error_count=5&max_orchestration_attempt_skipped_count=25`
- Offline reliability checks:
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:ci:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:ci:sales:extended`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:command-aliases:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:runtime-prereqs:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run test`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run typecheck`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:quick`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:fixture`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:event-root:backfill:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:report`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:report:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:endpoint:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:fixture`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:validate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:artifact:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:artifact:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:artifact:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:packet:artifact:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:schema:preflight`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly:cleanup:apply:guarded`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:governance:weekly`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-report`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-export-guard`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-history-retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-connector-pressure`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-duplicate-artifact-remediation`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-schema-endpoint`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-schema-ui`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:governance-packet`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:runtime-prereqs-artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:baseline-metrics-artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-packet-filter`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-quality`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-status-filter`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-status-counts`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-event-root-backfill`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-event-root-backfill-artifact-cleanup`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:telemetry-export-distribution`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:traceability-ci-guard`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:traceability-governance-handoff`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:baseline-governance-drift`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:integrations`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:auth:integrations:contracts`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:intelligence`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:docs:sales:connectors`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:docs:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2/backend && python3 -m unittest -q tests/test_integrations_reliability_unittest.py`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2/backend && python3 -m unittest -q tests/test_retry_resilience_unittest.py`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:frontend-sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:multi-channel-controls`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:baseline-command-aliases`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:baseline-command-aliases-artifact`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:campaign`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:canary-dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:credential-lifecycle`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-reliability`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-orchestration`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-provider-lookups`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-lookups`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-lookups-ui`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-lookups-export`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:sendgrid-reliability`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:credential-freshness`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:schema-gate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:orchestration-slo-gate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:release-gate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:workflow-contracts`
  - Combined sales smoke chain stages include `verify:smoke:sales-dashboard` immediately after `verify:smoke:frontend-sales`, `verify:smoke:multi-channel-controls` before `verify:smoke:baseline-command-aliases`, `verify:smoke:baseline-command-aliases` before `verify:smoke:baseline-command-aliases-artifact`, `verify:smoke:baseline-command-aliases-artifact` before `verify:smoke:campaign`, `verify:smoke:runtime-prereqs-artifact` before `verify:smoke:baseline-metrics-artifact`, and include `verify:smoke:connector-reliability` + `verify:smoke:telemetry-quality` between credential lifecycle and telemetry event-root backfill gates.
  - `verify:smoke:connector-reliability` runs after `verify:smoke:credential-lifecycle` and executes `verify:smoke:connector-orchestration`, `verify:smoke:connector-provider-lookups`, `verify:smoke:connector-lookups`, `verify:smoke:sendgrid-reliability`, and `verify:smoke:credential-freshness`.
  - `verify:smoke:telemetry-quality` runs `verify:smoke:telemetry-status-filter`, `verify:smoke:telemetry-status-counts`, and `verify:smoke:telemetry-export-distribution`.
  - `verify:smoke:connector-lookups` wrapper executes immediately after `verify:smoke:connector-provider-lookups` and runs `verify:smoke:connector-lookups-ui` followed by `verify:smoke:connector-lookups-export`.
  - Set `BACKFILL_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded telemetry backfill apply commands.
  - Set `BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded event-root fixture cleanup apply commands.
  - Set `BASELINE_COMMAND_ALIASES_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded baseline command-alias artifact cleanup apply commands.
  - Set `RUNTIME_PREREQS_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded runtime-prereq artifact cleanup apply commands.
  - Set `BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded baseline metrics artifact cleanup apply commands.
  - Set `RELEASE_GATE_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded release-gate artifact cleanup apply commands.
  - Set `GOVERNANCE_PACKET_ARTIFACT_CLEANUP_ALLOW_APPLY=true` only for controlled maintenance windows before running guarded governance packet validation artifact cleanup apply commands.

## Evidence Artifacts
- Baseline verification artifact path: `backend/test_reports/baseline_metrics.json`
- Baseline command-alias artifact path: `backend/test_reports/sales_baseline_command_aliases.json`
- Runtime prerequisite artifact path: `backend/test_reports/sales_runtime_prereqs.json`
- Connector canary artifact path: `backend/test_reports/connector_canary_evidence.json`
- Signoff validation artifact path: `backend/test_reports/connector_signoff_validation.json`
- Release gate decision artifact path: `backend/test_reports/connector_release_gate_result.json`
- Release gate hold fixture artifact path: `backend/test_reports/connector_release_gate_result_hold.json`
- Release gate validation-fail fixture artifact path: `backend/test_reports/connector_release_gate_result_validation_fail.json`
- Telemetry summary export artifact path (includes traceability audit counts): `backend/test_reports/connector-telemetry-summary-<timestamp>.json`
- Telemetry summary fixture artifact path (CI contract checks): `backend/test_reports/connector-telemetry-summary-snapshot.json`
- Weekly governance trend report artifact path: `backend/test_reports/connector_governance_weekly_report.json`
- Governance handoff export artifact path: `backend/test_reports/governance_handoff_export.json`
- Governance history export artifact path: `backend/test_reports/governance_history_export.json`
- Governance packet contract artifact path: `backend/test_reports/governance_packet_validation.json`
- Retain artifacts for at least 14 days for rollout audit and rollback forensics.
- Retain traceability audit telemetry snapshots for at least 30 days for release-governance audit trails.

## Telemetry Export Schema (Operator Contract)
- Integrations telemetry export payload (`connector-telemetry-summary-*.json`) should include:
  - `generatedAt`
  - `windowDays`
  - `eventCount`
  - `errorEventCount`
  - `traceabilityAudit`
  - `governanceAudit`
  - `packetValidationAudit`
  - `recentEvents`
  - `recentEventsFilter`
  - `recentEventsTotalCount`
  - `recentEventsFilteredCount`
  - `recentEventsPacketValidationCount`
  - `recentEventsNonPacketCount`
  - `recentEventsGovernanceStatusCounts`
  - `recentEventsPacketValidationStatusCounts`
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
  - `exportRecentEventsGovernanceStatusCountsPosture`
  - `exportRecentEventsPacketValidationStatusCountsPosture`
  - `exportRecentEventsGovernanceStatusCountsPostureSeverity`
  - `exportRecentEventsPacketValidationStatusCountsPostureSeverity`
  - `exportRecentEventsGovernanceStatusCountsRequiresInvestigation`
  - `exportRecentEventsPacketValidationStatusCountsRequiresInvestigation`
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
- `exportRecentEventsFilterSource` should be `server` when response echoes a supported filter token; otherwise `local`.
- `exportRecentEventsFilterResolution` should be:
  - `server_supported`
  - `local_no_server_filter`
  - `local_blank_server_filter`
  - `local_unsupported_server_filter`
- `exportRecentEventsServerFilterBlank` should be `true` when `exportRecentEventsServerFilterRaw` exists but trims to an empty token.
- `exportRecentEventsServerFilterUnsupported` should be `true` when `exportRecentEventsServerFilterRaw` exists but does not normalize to supported values (`all`, `packet`).
- `exportRecentEventsServerFilterEvaluation` should be `supported`, `unsupported`, or `absent` based on server token normalization outcome.
- `exportRecentEventsServerFilterNormalizationChanged` should be `true` when supported server token required casing/whitespace normalization before canonical comparison.
- `exportRecentEventsPacketValidationCount` and `exportRecentEventsNonPacketCount` should reconcile to the telemetry summary recent-event window counts used for rollout evidence context.
- `exportSchemaVersion` should be present and match the current telemetry export contract version for consumer compatibility checks.
- If `exportRecentEventsFilter=packet`, verify recent rows only contain packet-validation posture events before attaching to signoff packets.

## Traceability Snapshot Retention Incident Response
1. Open Integrations telemetry panel and review `Traceability Snapshot Governance` status.
2. Query governance API directly to confirm artifact posture:
   - `GET /api/integrations/integrations/telemetry/snapshot-governance?retention_days=30`
3. If status is `ACTION_REQUIRED`, run snapshot governance command chain:
   - `npm run verify:telemetry:traceability`
4. If stale snapshots exceed retention target, execute cleanup dry-run:
   - `npm run verify:telemetry:traceability:cleanup:dry-run`
5. Evaluate unattended cleanup apply-mode safety policy:
   - `npm run verify:telemetry:traceability:cleanup:policy`
6. If policy reports `ALLOW_APPLY`, execute guarded apply cleanup:
   - `npm run verify:telemetry:traceability:cleanup:apply:guarded`
7. Run baseline-governance drift smoke for missing/invalid/recovery transitions:
   - `npm run verify:smoke:baseline-governance-drift`
8. Run the condensed baseline orchestration remediation smoke chain when repeated manual triage is required:
   - `npm run verify:smoke:baseline-orchestration-remediation`
9. Regenerate latest telemetry snapshot evidence:
   - `npm run verify:telemetry:traceability:fixture`
10. Re-validate snapshot contract and retention:
   - `npm run verify:telemetry:traceability:contract`
   - `npm run verify:telemetry:traceability:retention`
11. Generate and validate weekly governance report artifact for signoff packet:
   - `npm run verify:governance:weekly`
12. Run CI guard smokes to ensure invalid snapshot payloads and governance handoff gates fail rollout checks:
   - `npm run verify:smoke:traceability-ci-guard`
   - `npm run verify:smoke:traceability-governance-handoff`
13. Capture incident notes, affected artifact paths, and remediation timestamp in release signoff evidence.

## Baseline Orchestration Remediation Escalation Matrix
- Integrations Engineer:
  - Trigger: orchestration gate fails (`gates.orchestrationAttemptErrorPassed=false` or `gates.orchestrationAttemptSkippedPassed=false`).
  - Preferred command: `npm run verify:smoke:baseline-orchestration-remediation`.
  - Command chain: `npm run verify:smoke:orchestration-slo-gate`, `npm run verify:baseline:metrics`, `npm run verify:smoke:baseline-governance-drift`.
- Release Manager:
  - Trigger: baseline-governance remains `FAIL` after one remediation pass.
  - Command chain: `npm run verify:smoke:baseline-orchestration-remediation`, then `npm run verify:ci:sales:extended`.
- QA Engineer:
  - Trigger: baseline metrics artifact drift or fixture-profile evidence mismatch.
  - Command chain: `npm run verify:baseline:metrics`, `npm run verify:release-gate:artifact:fixtures`, `npm run verify:smoke:baseline-governance-drift`.
- Sales Ops Lead:
  - Trigger: rollout remains blocked during signoff packet handoff.
  - Command chain: `npm run verify:smoke:baseline-orchestration-remediation`, then refresh governance and baseline export artifacts in operator UI.
- Baseline governance API command contract:
  - Use `recommendedCommands` from `GET /api/integrations/integrations/telemetry/baseline-governance` as the operator/source-of-truth remediation order.
  - When orchestration posture is degraded, `recommendedCommands[0]` should be `npm run verify:smoke:baseline-orchestration-remediation`.
  - Confirm `recommendedCommandCount == len(recommendedCommands)` and `governanceExport.recommendedCommandCount == recommendedCommandCount`.
  - Confirm `reasonCodeCount == len(reasonCodes)` and `governanceExport.reasonCodeCount == reasonCodeCount`.
  - Confirm runtime-prereq governance markers are present and coherent: `runtimePrereqs.passed`, `runtimePrereqs.contractValid`, `runtimePrereqs.missingCheckCount`.
  - Baseline command-alias remediation command chain: `npm run verify:baseline:command-aliases:artifact`, `npm run verify:baseline:command-aliases:artifact:contract`, `npm run verify:smoke:baseline-command-aliases-artifact`.
  - Runtime-prereq remediation command chain: `npm run verify:baseline:runtime-prereqs:artifact`, `npm run verify:baseline:runtime-prereqs:artifact:contract`, `npm run verify:smoke:runtime-prereqs-artifact`.
  - Baseline-metrics remediation command chain: `npm run verify:baseline:metrics:artifact`, `npm run verify:baseline:metrics:artifact:contract`, `npm run verify:smoke:baseline-metrics-artifact`.
  - Legacy command triplets (`verify:smoke:orchestration-slo-gate`, `verify:baseline:metrics`, `verify:smoke:baseline-governance-drift`) may be collapsed to the wrapper command in UI exports.

## Governance Weekly Report Incident Response
1. Query governance trend report API to confirm report generation status:
   - `GET /api/integrations/integrations/telemetry/governance-report?days=7&limit=1000`
   - `GET /api/integrations/integrations/telemetry/governance-report/export?days=7&limit=1000`
   - `GET /api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50`
   - `GET /api/integrations/integrations/telemetry/governance-schema`
   - Confirm connector rollup fields are present in governance responses:
     - `connectorRateLimit.eventCount`
     - `connectorRateLimit.byEndpoint`
     - `connectorRateLimit.maxRetryAfterSeconds`
     - `connectorRateLimit.avgResetInSeconds`
     - `connectorRateLimit.pressure.label`
     - `totals.connectorRateLimitEventCount`
     - `runtimePrereqs.present`
     - `runtimePrereqs.passed`
     - `runtimePrereqs.contractValid`
     - `runtimePrereqs.valid`
     - `runtimePrereqs.missingCheckCount`
     - `reasonCodeCount`
     - `recommendedCommandCount`
2. Regenerate weekly governance report artifact:
   - `npm run verify:governance:weekly:report`
3. Validate governance report contract:
   - `npm run verify:governance:weekly:report:contract`
4. Validate governance report endpoint and export envelope contracts:
   - `npm run verify:governance:weekly:endpoint:contract`
5. Validate governance report retention policy:
   - `npm run verify:governance:weekly:retention`
6. Run governance report cleanup dry-run for stale artifacts:
   - `npm run verify:governance:weekly:cleanup:dry-run`
7. Evaluate cleanup apply-mode policy gate for unattended maintenance:
   - `npm run verify:governance:weekly:cleanup:policy`
8. If policy reports `ALLOW_APPLY`, execute guarded cleanup apply:
   - `npm run verify:governance:weekly:cleanup:apply:guarded`
9. Run governance report smoke to verify end-to-end generation + validation:
   - `npm run verify:smoke:governance-report`
10. Run governance export guard smoke for missing-telemetry/invalid-artifact failure paths:
   - `npm run verify:smoke:governance-export-guard`
11. Run governance schema endpoint smoke to validate schema metadata + audit telemetry contract:
   - `npm run verify:smoke:governance-schema-endpoint`
12. Run governance duplicate-artifact remediation smoke for logical artifact-name collision paths:
   - `npm run verify:smoke:governance-duplicate-artifact-remediation`
13. Run governance schema UI smoke for schema contract operator controls:
   - `npm run verify:smoke:governance-schema-ui`
14. Run governance history retention smoke for stale/invalid artifact edge paths:
   - `npm run verify:smoke:governance-history-retention`
15. Run combined governance packet smoke wrapper:
   - `npm run verify:smoke:governance-packet`
16. Run governance connector-pressure parity smoke for endpoint/export/history alignment:
   - `npm run verify:smoke:governance-connector-pressure`
17. Attach regenerated artifact and smoke output to release signoff packet.

## Governance Packet Fixture Regeneration Incident Response
1. Rebuild weekly governance report artifact before regenerating packet fixtures:
   - `npm run verify:governance:weekly:report`
   - `npm run verify:governance:weekly:report:contract`
2. Regenerate governance handoff/history packet fixtures from weekly report artifact:
   - `npm run verify:governance:packet:fixture`
3. Validate governance packet artifacts and produce packet validation output:
   - `npm run verify:governance:packet:validate`
   - `npm run verify:governance:packet:contract`
   - Freshness policy env var: `GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS` (default `168`)
4. Confirm API envelope parity before signoff attachment export:
   - `npm run verify:governance:weekly:endpoint:contract`
5. Run governance packet smoke wrapper to verify CI-facing failure guards:
   - `npm run verify:smoke:governance-packet`
6. Run governance connector-pressure parity smoke before signoff evidence handoff:
   - `npm run verify:smoke:governance-connector-pressure`
7. Attach refreshed packet artifacts to signoff bundle:
   - `backend/test_reports/governance_handoff_export.json`
   - `backend/test_reports/governance_history_export.json`
   - `backend/test_reports/governance_packet_validation.json`
8. If packet fixture generation or contract validation fails, block rollout and run extended gate:
   - `npm run verify:ci:sales:extended`

## Governance Weekly Export Packet Handoff
1. Generate and validate governance weekly report packet:
   - `npm run verify:governance:weekly`
   - `npm run verify:governance:packet:fixture`
   - `npm run verify:governance:packet:validate`
   - `npm run verify:governance:packet:contract`
2. Fetch compact governance handoff export envelope:
   - `GET /api/integrations/integrations/telemetry/governance-report/export?days=7&limit=1000`
3. Fetch governance artifact history for audit trail:
   - `GET /api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50`
4. Export handoff payload from Integrations or Sales Intelligence dashboards:
   - `Export Governance Handoff JSON`
   - `Export Governance Schema JSON`
   - include `schemaContractParity` block in schema contract export artifacts
5. Attach required packet artifacts:
   - `backend/test_reports/connector_governance_weekly_report.json`
   - governance export JSON envelope
   - governance history JSON envelope
   - if packet fixture source status contains separators/spacing variants (for example `action-required`), ensure generated packet artifacts normalize status to canonical `ACTION_REQUIRED`
6. Confirm governance export schema compatibility before attachment:
   - top-level `exportSchemaVersion`
   - `governanceExport.exportSchemaVersion`
   - `items[].exportSchemaVersion` in governance history payload
   - ensure handoff/history `exportSchemaVersion` values are consistent
   - ensure schema contract export parity indicators are all `true` for handoff-ready posture:
     - `schemaContractParity.reasonCodeParity.topLevelVsRolloutActions`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportActions`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportAlerts`
     - `schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes`
     - `schemaContractParity.recommendedCommandParity.topLevelVsExport`
     - `schemaContractParity.handoffParity.rolloutBlockedMatchesExport`
     - `schemaContractParity.handoffParity.ownerRoleMatchesExport`
     - `schemaContractParity.handoffParity.handoffActionsMatchRolloutActions`
   - ensure packet status tokens are canonical in packet fixtures and validator output:
     - top-level and nested packet statuses must be `READY` or `ACTION_REQUIRED`
     - packet validator accepts normalized status variants (for example `action-required`) but rejects punctuation-only tokens
     - packet connector endpoint keys in parity checks are normalized (`apollo search` and `apollo-search` collapse to `apollo_search`)
     - packet reason-code and recommended-command counts are present and match list sizes:
       - `reasonCodeCount == len(reasonCodes)`
       - `recommendedCommandCount == len(recommendedCommands)`
       - `governanceExport.reasonCodeCount == reasonCodeCount`
       - `governanceExport.recommendedCommandCount == recommendedCommandCount`
   - ensure governance weekly status tokens are normalized before attachment:
     - governance report/export/history `status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
     - governance handoff/history `governanceExport.status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
     - governance history `items[].status` values must be one of `READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`
     - governance report `governanceStatusCounts` keys must be canonical status tokens (`READY`, `ACTION_REQUIRED`, `PASS`, `FAIL`, `UNKNOWN`)
     - governance report `traceabilityDecisionCounts` keys must be canonical decision tokens (`PROCEED`, `HOLD`, `UNKNOWN`)
     - malformed or punctuation-only governance/decision tokens should collapse to `UNKNOWN`
     - run `npm run verify:governance:weekly:report:contract` before attaching artifacts
   - ensure governance packet runtime-prereq parity markers are coherent before attachment:
     - `runtimePrereqs.present`
     - `runtimePrereqs.available`
     - `runtimePrereqs.passed`
     - `runtimePrereqs.contractValid`
     - `runtimePrereqs.valid`
     - `runtimePrereqs.missingCheckCount == len(runtimePrereqs.missingChecks.commands) + len(runtimePrereqs.missingChecks.workspace)`
     - `governanceExport.runtimePrereqs == runtimePrereqs`
     - `totals.runtimePrereqsMissingCheckCount == runtimePrereqs.missingCheckCount`
     - exported handoff/history metadata includes `runtimePrereqsPresent`, `runtimePrereqsMissingCheckCount`, `runtimePrereqsCommand`, and `runtimePrereqsParity.matchesNested`
7. Confirm connector-pressure rollout posture metadata is included in governance packet artifacts:
   - `connectorRateLimit.eventCount` on governance report/export/history payloads
   - `connectorRateLimit.byEndpoint` on governance report/export/history payloads
   - `connectorRateLimit.pressure.label` on governance report/export/history payloads
   - `governanceExport.connectorRateLimit.pressure.label` on governance handoff/history payloads
   - handoff/history `connectorRateLimit.eventCount` equals `governanceExport.connectorRateLimit.eventCount`
   - handoff/history `connectorRateLimit.byEndpoint` equals `governanceExport.connectorRateLimit.byEndpoint`
   - handoff/history `connectorRateLimit.pressure.label` equals `governanceExport.connectorRateLimit.pressure.label`
   - `totals.connectorRateLimitEventCount` on governance report/export payloads
   - handoff/history `totals.connectorRateLimitEventCount` equals `connectorRateLimit.eventCount`
   - `sendgridWebhookTimestamp.eventCount` on governance report/export/history payloads
   - `sendgridWebhookTimestamp.timestampAnomalyCountTotal` on governance report/export/history payloads
   - `governanceExport.sendgridWebhookTimestamp.eventCount` on governance handoff/history payloads
   - `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal` on governance handoff/history payloads
   - handoff/history `sendgridWebhookTimestamp.eventCount` equals `governanceExport.sendgridWebhookTimestamp.eventCount`
   - handoff/history `sendgridWebhookTimestamp.timestampAnomalyCountTotal` equals `governanceExport.sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - `totals.sendgridWebhookTimestampEventCount` on governance report/export payloads
   - `totals.sendgridWebhookTimestampAnomalyCountTotal` on governance report/export payloads
   - handoff/history `totals.sendgridWebhookTimestampEventCount` equals `sendgridWebhookTimestamp.eventCount`
   - handoff/history `totals.sendgridWebhookTimestampAnomalyCountTotal` equals `sendgridWebhookTimestamp.timestampAnomalyCountTotal`
   - `sendgridWebhookTimestampParity.eventCountMatchesNested`
   - `sendgridWebhookTimestampParity.eventCountMatchesTotals`
   - `sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested`
   - `sendgridWebhookTimestampParity.anomalyCountTotalMatchesTotals`
   - `sendgridWebhookTimestampParity.pressureLabelCountsMatchNested`
   - `sendgridWebhookTimestampParity.latestEventAtMatchesNested`
   - `sendgridWebhookTimestampParity.pressureHintCountsMatchNested`
   - `sendgridWebhookTimestampParity.ageBucketCountsMatchNested`
   - `sendgridWebhookTimestampParity.anomalyEventTypeCountsMatchNested`
8. For telemetry summary exports attached to signoff packets, confirm payload includes:
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
9. If handoff status is `ACTION_REQUIRED`, run remediation command chain before signoff:
   - `npm run verify:governance:weekly:cleanup:policy`
   - `npm run verify:governance:weekly:cleanup:apply:guarded`
   - `npm run verify:smoke:governance-export-guard`
   - `npm run verify:smoke:governance-schema-endpoint`
   - `npm run verify:smoke:governance-duplicate-artifact-remediation`
   - `npm run verify:smoke:governance-history-retention`
   - `npm run verify:smoke:governance-connector-pressure`
   - `npm run verify:smoke:governance-schema-ui`
   - `npm run verify:smoke:governance-packet`
   - `npm run verify:ci:sales:extended`

## Rollback
1. Disable connector flags for Apollo/Clearbit/Crunchbase.
2. Revert to prior SendGrid behavior by removing retry logic if required.
3. Keep dedup collection in place (safe backward compatibility).
4. Validate health endpoint returns expected status after rollback.
