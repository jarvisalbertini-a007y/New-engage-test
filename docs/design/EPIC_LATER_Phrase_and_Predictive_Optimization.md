# EPIC_LATER: Phrase Analytics + Response Prediction (Sales-Only)

## User Flow
- Sales operator opens analytics view to identify high-performing sales phrases from recent email events.
- Sales operator submits draft outreach content to receive a response-probability prediction before send.
- Operator uses rationale and recommended send windows to refine message and timing.

## API Surface (High-Level)
- `GET /api/sales-intelligence/analytics/phrases`
  - Inputs: `window_days`, `min_exposure`, `limit`, `query`
  - Output: ranked phrase effectiveness list with confidence and exposure counts
- `GET /api/sales-intelligence/analytics/phrases/channel-summary`
  - Inputs: `window_days`, `min_exposure`, `limit`, optional `channels`
  - Output: per-channel top phrase summaries
- `POST /api/sales-intelligence/prediction/response`
  - Input: outreach message + optional channel, send time, prospect context
  - Output: response probability, confidence, rationale, recommended send windows
- `POST /api/sales-intelligence/prediction/feedback`
  - Input: predicted probability + observed outcome (+ optional latency/channel)
  - Output: persisted feedback confirmation with normalized label
- `GET /api/sales-intelligence/prediction/performance`
  - Input: `window_days`
  - Output: calibration summary (MAE, positive rate, channel slices)
- `GET /api/sales-intelligence/prediction/performance/report`
  - Input: `window_days`
  - Output: rollout-oriented quality tier, decision, and recommendations
- `GET /api/sales-intelligence/prediction/feedback/history`
  - Input: `window_days`, `limit`
  - Output: time-ordered feedback records for audit and tuning
- `GET /api/sales-intelligence/forecast/pipeline`
  - Input: `window_days`
  - Output: weighted pipeline forecast with confidence interval
- `GET /api/sales-intelligence/conversation/intelligence`
  - Input: `limit`
  - Output: sentiment mix and objection summary for recent communications
- `GET /api/sales-intelligence/engagement/multi-channel`
  - Input: none
  - Output: channel coverage score and engagement recommendations
- `POST/GET /api/sales-intelligence/campaigns` (+ activate/metrics variants)
  - Input: campaign metadata and incremental channel metrics
  - Output: campaign lifecycle state and aggregated delivery/reply counters
- `GET /api/sales-intelligence/campaigns/{campaign_id}/performance`
  - Input: campaign id
  - Output: channel-level and overall open/reply metrics with quality tier
- `GET /api/sales-intelligence/campaigns/performance/portfolio`
  - Input: `window_days`, optional `status`, `limit`
  - Output: ranked campaign performance list and portfolio aggregates
- `GET /api/sales-intelligence/relationships/map`
  - Input: `limit`
  - Output: prospect-company graph with relationship strength stats

## Data Model Changes (High-Level)
- No schema migration required.
- Reuses existing `email_events` collection.
- Computed analytics are generated on request and not persisted in this slice.
- Adds `prediction_feedback` collection for response prediction feedback loop.
- Feedback writes are idempotent when `predictionId` is provided (update-in-place behavior).

## Integration Points
- Auth: existing `get_current_user` dependency (user-scoped analytics only).
- Data source: `email_events` for phrase signals and lightweight historical context.
- Existing sales-intelligence router and API namespace.

## Security/Privacy
- User-scoped queries only; no cross-tenant analytics.
- No secrets read or returned.
- Response payload excludes raw sensitive content logs and focuses on aggregates/rationale.

## Failure Modes, Retries, Idempotency
- Empty/insufficient historical data: endpoint returns low-confidence results with empty or small ranked lists.
- Invalid request payload (missing message): explicit `400`.
- Feature flags off: explicit `503` for controlled rollout.
- Endpoints are read/compute-only and idempotent.
- Campaign metrics endpoint validates non-negative increments and returns `400` on invalid payload.

## Telemetry/Observability
- Existing integration telemetry remains unchanged in this slice.
- Added event types:
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
  - `sales_relationship_map_generated`
  - `sales_campaign_performance_viewed`
  - `sales_campaign_portfolio_viewed`

## Rollout Controls
- Feature flags:
  - `ENABLE_PIPELINE_FORECAST`
  - `ENABLE_CONVERSATION_INTELLIGENCE`
  - `ENABLE_MULTI_CHANNEL_ENGAGEMENT`
  - `ENABLE_SALES_CAMPAIGNS`
  - `ENABLE_RELATIONSHIP_MAP`
  - `ENABLE_PHRASE_ANALYTICS`
  - `ENABLE_RESPONSE_PREDICTION`
  - `ENABLE_RESPONSE_PREDICTION_FEEDBACK`

## Open Questions (for approval)
1. Should phrase analytics include chat transcripts by default or stay email-only for signal quality?
2. Should predicted probabilities be persisted for later outcome calibration?
3. What minimum data threshold should block low-confidence predictions in production UX?
