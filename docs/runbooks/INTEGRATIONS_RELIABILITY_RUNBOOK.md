# Integrations Reliability Runbook (Sales-Only)

## Scope
Operational guidance for SendGrid reliability and feature-flagged sales data connectors (Apollo, Clearbit, Crunchbase).

## Endpoints
- `POST /api/integrations/email/send`
- `POST /api/integrations/webhook/sendgrid`
- `GET /api/integrations/integrations`
- `GET /api/integrations/integrations/health`
- `GET /api/integrations/integrations/telemetry/summary`
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
- Track error rate by provider and response status.
- Track latency for SendGrid send and health checks.
- For webhook analytics confidence, track `user_context_count` and `missing_user_context_count`.
- Track sales-intelligence event families via telemetry summary `salesIntelligence.byEventFamily`.
- Track telemetry schema adoption via summary `bySchemaVersion` and `salesIntelligence.bySchemaVersion`.
- Track schema rollout safety via SLO payload `schemaCoverage`, `gates.schemaCoveragePassed`, and `gates.schemaSampleSizePassed`.
- Track traceability audit posture via telemetry summary `traceabilityAudit.eventCount`, `traceabilityAudit.decisionCounts`, `traceabilityAudit.readyCount`, and `traceabilityAudit.notReadyCount`.
- Validate traceability telemetry exports with snapshot contract + retention checks before rollout signoff.

## Alert Suggestions
- Trigger warning if SendGrid health checks fail for 3 consecutive checks.
- Trigger critical alert if SendGrid send failure rate exceeds 10% over 5 minutes.
- Trigger warning if webhook dedup cache insert failures appear.

## Operational Verification
1. Configure SendGrid API key using integrations endpoint.
2. Confirm integrations listing returns masked key.
3. Send test email and verify send success log event.
4. Replay same webhook payload twice and verify event is processed once.
5. Confirm health endpoint reports provider status and any disabled connectors.
6. Confirm webhook response contains `processed`, `deduplicated`, `emailUpdates`, and `eventTypeCounts`.
7. Confirm user-context extraction path: webhook payloads with `user_id` or `custom_args/unique_args.user_id` generate user-scoped telemetry records.
8. Confirm telemetry summary includes `salesIntelligence.eventCount` and `salesIntelligence.byEventFamily`.
9. Confirm telemetry summary includes schema-version breakdown fields:
   - `bySchemaVersion`
   - `salesIntelligence.bySchemaVersion`
10. Confirm telemetry summary `recentEvents` rows include correlation and schema metadata:
   - `requestId`
   - `schemaVersion`
   - `traceabilityDecision` (for traceability audit events)
11. Confirm SLO gate response includes schema coverage gate details:
   - `schemaCoverage.thresholdPct`
   - `schemaCoverage.observedPct`
   - `schemaCoverage.minSampleCount`
   - `gates.schemaCoveragePassed`
   - `gates.schemaSampleSizePassed`

## Verification Commands
- Runtime API checks (requires server + dependencies):
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_health_and_webhook.py`
  - `GET /api/integrations/integrations/telemetry/slo-gates?...&min_schema_v2_pct=95&min_schema_v2_sample_count=25`
- Offline reliability checks:
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:ci:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:ci:sales:extended`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:baseline:metrics:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:release-gate:artifact:fixtures`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:fixture`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:contract`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:retention`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:cleanup:dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability:cleanup:policy`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:telemetry:traceability`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:traceability-ci-guard`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:traceability-governance-handoff`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:integrations`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:intelligence`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:docs:sales:connectors`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:docs:sales`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2/backend && python3 -m unittest -q tests/test_integrations_reliability_unittest.py`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2/backend && python3 -m unittest -q tests/test_retry_resilience_unittest.py`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:campaign`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:canary-dry-run`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:schema-gate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:release-gate`
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:sales`

## Evidence Artifacts
- Baseline verification artifact path: `backend/test_reports/baseline_metrics.json`
- Connector canary artifact path: `backend/test_reports/connector_canary_evidence.json`
- Signoff validation artifact path: `backend/test_reports/connector_signoff_validation.json`
- Release gate decision artifact path: `backend/test_reports/connector_release_gate_result.json`
- Release gate hold fixture artifact path: `backend/test_reports/connector_release_gate_result_hold.json`
- Release gate validation-fail fixture artifact path: `backend/test_reports/connector_release_gate_result_validation_fail.json`
- Telemetry summary export artifact path (includes traceability audit counts): `backend/test_reports/connector-telemetry-summary-<timestamp>.json`
- Telemetry summary fixture artifact path (CI contract checks): `backend/test_reports/connector-telemetry-summary-snapshot.json`
- Retain artifacts for at least 14 days for rollout audit and rollback forensics.
- Retain traceability audit telemetry snapshots for at least 30 days for release-governance audit trails.

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
6. Regenerate latest telemetry snapshot evidence:
   - `npm run verify:telemetry:traceability:fixture`
7. Re-validate snapshot contract and retention:
   - `npm run verify:telemetry:traceability:contract`
   - `npm run verify:telemetry:traceability:retention`
8. Run CI guard smokes to ensure invalid snapshot payloads and governance handoff gates fail rollout checks:
   - `npm run verify:smoke:traceability-ci-guard`
   - `npm run verify:smoke:traceability-governance-handoff`
9. Capture incident notes, affected artifact paths, and remediation timestamp in release signoff evidence.

## Rollback
1. Disable connector flags for Apollo/Clearbit/Crunchbase.
2. Revert to prior SendGrid behavior by removing retry logic if required.
3. Keep dedup collection in place (safe backward compatibility).
4. Validate health endpoint returns expected status after rollback.
