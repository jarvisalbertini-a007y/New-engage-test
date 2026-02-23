# Connector SLO Gates and Alerts

## Purpose
Define rollout safety gates for connector telemetry and standard alert conditions.

## SLO Gates
- Overall gate passes only when:
  - Error-rate gate passes.
  - Provider latency gate passes.
  - Sales schema-coverage gate passes.
  - Sales schema sample-size gate passes.

## Default Thresholds
- Max error rate: `INTEGRATION_SLO_MAX_ERROR_RATE_PCT=5`
- Min sales schema v2 coverage: `INTEGRATION_SLO_MIN_SCHEMA_V2_PCT=95`
- Min sales schema v2 sample size: `INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT=25`
- SendGrid p95 latency: `INTEGRATION_SLO_SENDGRID_P95_MS=2500`
- Apollo p95 latency: `INTEGRATION_SLO_APOLLO_P95_MS=4000`
- Clearbit p95 latency: `INTEGRATION_SLO_CLEARBIT_P95_MS=4000`
- Crunchbase p95 latency: `INTEGRATION_SLO_CRUNCHBASE_P95_MS=4000`

## Evaluation Endpoint
- `GET /api/integrations/integrations/telemetry/slo-gates`
- Query params:
  - `days` (1-30)
  - `limit` (100-5000)
  - `max_error_rate_pct` (optional override, 0-100)
  - `min_schema_v2_pct` (optional override, 0-100)
  - `min_schema_v2_sample_count` (optional override, 1-5000)
- Response highlights:
  - `decision` (`PROCEED` or `HOLD`)
  - `alerts` (triggered gate alerts)
  - `rolloutActions` (owner-role mapped response actions)
  - `schemaCoverage` (`thresholdPct`, `observedPct`, `sampleCount`, `minSampleCount`, `schemaV2Count`)
  - `gates.schemaCoveragePassed`
  - `gates.schemaSampleSizePassed`

## Response Matrix
- `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_ALERT_RESPONSE_MATRIX.md`

## Automation Command
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/evaluate_connector_slo_gates.py --base-url http://127.0.0.1:8000 --token <token> --days 7 --limit 2000 --max-error-rate-pct 5 --min-schema-v2-sample-count 25`

## Alert Rules
1. High severity:
   - error rate above threshold
2. Medium severity:
   - any provider p95 above threshold
   - sales schema v2 coverage below threshold
   - sales schema sample size below minimum threshold
3. Informational:
   - insufficient telemetry sample count for provider latency

## Rollout Policy
- Do not expand canary when overall gate is false.
- If gate fails:
  - halt rollout
  - run rollback drill for affected provider flags
  - capture evidence snapshot before and after rollback
