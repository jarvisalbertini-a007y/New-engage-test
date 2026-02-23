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
   - `npm run verify:baseline`
   - `npm run verify:ci:sales`
2. Confirm sales-only API health:
   - `npm run verify:smoke`
3. Validate sales-intelligence regression tests:
   - `npm run verify:backend:sales`
4. Validate sales dashboard frontend regression tests:
   - `npm run verify:frontend:sales`

## Manual Validation
0. Open the dedicated analytics UI:
   - `/sales-intelligence`
   - Confirm page renders campaign, prediction, and telemetry sections.
   - Use telemetry controls to set `window days` and `event limit`, click `Refresh Telemetry`, and confirm values are bounded to allowed ranges (`days: 1-30`, `limit: 50-5000`).
   - Export telemetry and prediction JSON snapshots from dashboard controls for rollout evidence.
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
10. Validate conversation intelligence:
   - `GET /api/sales-intelligence/conversation/intelligence`
   - Verify sentiment mix, objection list, and source counts.
11. Validate multi-channel engagement:
   - `GET /api/sales-intelligence/engagement/multi-channel`
   - Verify `coverageScore` and recommendations.
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

## Data Quality Notes
- `window_days` filters are applied to phrase analytics and performance/history endpoints.
- When `predictionId` is provided, feedback writes are idempotent (same record updated, not duplicated).
