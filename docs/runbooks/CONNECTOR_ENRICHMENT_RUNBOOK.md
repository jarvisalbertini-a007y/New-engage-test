# Connector Enrichment Runbook (Apollo, Clearbit, Crunchbase)

## Scope
Operational handling for sales-only data connector endpoints and rollout flags.

## Related Operational Docs
- Canary rollout plan: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_CANARY_ROLLOUT.md`
- Rollback drill plan: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_ROLLBACK_DRILL.md`
- Canary evidence collection: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_CANARY_EVIDENCE.md`
- SLO gates and alerts: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_SLO_ALERTS.md`
- Alert response matrix: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_ALERT_RESPONSE_MATRIX.md`
- Release signoff process: `/Users/AIL/Documents/EngageAI/EngageAI2/docs/runbooks/CONNECTOR_RELEASE_SIGNOFF.md`

## Endpoints
- `POST /api/integrations/providers/apollo/search`
- `POST /api/integrations/providers/apollo/company`
- `POST /api/integrations/providers/clearbit/company`
- `POST /api/integrations/providers/crunchbase/company`
- `POST /api/integrations/providers/company-enrichment` (multi-provider fallback)
- `GET /api/integrations/integrations/health`
- `DELETE /api/integrations/integrations/apollo`
- `DELETE /api/integrations/integrations/clearbit`
- `DELETE /api/integrations/integrations/crunchbase`

## Required Flags
- `ENABLE_APOLLO_CONNECTOR=true` to enable Apollo search
- `ENABLE_CLEARBIT_CONNECTOR=true` to enable Clearbit enrichment
- `ENABLE_CRUNCHBASE_CONNECTOR=true` to enable Crunchbase enrichment
- `ENABLE_CONNECTOR_ORCHESTRATION=true` to enable orchestration fallback endpoint

## Operational Checklist
1. Configure provider keys from the Integrations UI (Data category cards) or API endpoints.
2. Enable only one provider flag at a time.
3. In Integrations UI, run one Company Enrichment lookup from the Connector Enrichment Sandbox.
4. In Integrations UI, run one Apollo Prospect Lookup from the same sandbox.
5. Validate result counts, selected provider, and top-record summaries in UI response cards.
   - Export Company Lookup JSON and verify export payload fields:
     - `exportSchemaVersion`
     - `exportRequestedProvider`
     - `exportRequestedDomain`
     - `exportRequestedCompanyName`
     - `exportRequestedLimit`
     - `exportResultCount`
     - `exportAttemptSummary`
     - `exportProviderOrderDiagnostics`
   - Export Apollo Lookup JSON and verify export payload fields:
     - `exportSchemaVersion`
     - `exportRequestedQuery`
     - `exportRequestedTitle`
     - `exportRequestedDomain`
     - `exportRequestedLimit`
     - `exportResultCount`
     - `exportRateLimit`
     - `exportTopProspect`
6. Confirm optional persistence writes are user-scoped.
7. Verify Integrations UI shows masked keys and connector health status for configured providers.
8. Review Integrations UI `Connector Rollout SLO Gate` card and confirm decision/actions/signoff requirements align with telemetry.
9. Validate `Traceability Readiness` shows `READY` before requesting rollout approval (requires schema coverage gate pass, schema sample gate pass, and non-empty signoff approvals/evidence).
10. If `Traceability Readiness` shows `NOT READY`, complete the remediation checklist items shown in the SLO card before proceeding.
11. Use Integrations UI telemetry controls to refresh the telemetry window and limit, then verify trend rows update.
12. Export both telemetry and SLO JSON snapshots from Integrations UI for release evidence artifacts.
13. Confirm Integrations UI shows success/failure notice banners for lookup/config/export operations.
14. Verify notice banner can be dismissed and that stale notices clear automatically after a short interval.
15. Monitor latency/error logs for 15 minutes before wider rollout.
16. If orchestration is enabled, verify fallback order and first-success stop behavior.
17. Confirm connector responses include `rateLimit` metadata (`limit`, `remaining`, `windowSeconds`, `resetInSeconds`) for operational throttling visibility.
18. Validate `providerOrderDiagnostics` in orchestration responses when duplicate or unsupported providers are submitted.
19. For persistence-enabled enrichment, verify `storagePolicy` metadata and confirm truncation markers appear when payloads exceed configured byte limits.
20. Confirm orchestration response includes attempt diagnostics summary:
    - `attemptSummary.total`
    - `attemptSummary.statusCounts`
    - `attemptSummary.reasonCodeCounts`
    - `attemptSummary.providersAttempted`
    - `attemptSummary.providersWithResults`
    - `attemptSummary.providersWithoutResults`
21. Confirm orchestration `attempts[]` rows include:
    - `reasonCode`
    - `latencyMs`
    - `rateLimitRemaining`
    - `rateLimitResetInSeconds`
22. Confirm orchestration telemetry event payload (`company_enrichment_orchestrated`) includes:
    - `attempt_success_count`
    - `attempt_skipped_count`
    - `attempt_error_count`
    - `attempt_reason_codes`
23. Confirm Integrations telemetry summary includes orchestration audit rollup fields:
    - `orchestrationAudit.eventCount`
    - `orchestrationAudit.bySelectedProvider`
    - `orchestrationAudit.attemptStatusCounts`
    - `orchestrationAudit.reasonCodeCounts`
    - `orchestrationAudit.maxAttemptCount`
    - `orchestrationAudit.avgAttemptCount`
    - `orchestrationAudit.latestEventAt`
24. Confirm recent correlated telemetry rows include orchestration context fields when orchestration events are present:
    - `orchestrationSelectedProvider`
    - `orchestrationAttemptCount`
    - `orchestrationAttemptSuccessCount`
    - `orchestrationAttemptSkippedCount`
    - `orchestrationAttemptErrorCount`
    - `orchestrationAttemptReasonCodes`
    - `orchestrationResultCount`
25. Trigger a connector throttling path and confirm `429` response includes:
    - `Retry-After` response header
    - `X-RateLimit-Limit`
    - `X-RateLimit-Remaining`
    - `X-RateLimit-Window-Seconds`
    - `X-RateLimit-Reset-In-Seconds`
    - `detail.errorCode=connector_rate_limited`
    - `detail.retryAfterSeconds`
    - `detail.rateLimit.limit|remaining|windowSeconds|resetInSeconds`
26. Confirm Integrations UI lookup failure states show retry guidance (`Connector rate limit reached. Retry in <seconds>s.`).
27. Confirm successful connector lookup responses include:
    - `rateLimit.resetAt` payload field
    - `rateLimit.resetInSeconds` payload field
    - `X-RateLimit-Reset-At` response header
    - `X-RateLimit-Reset-In-Seconds` response header
    - Integrations UI lookup cards render `Rate Limit Reset At`.
    - Integrations UI lookup cards render `Rate Limit Reset In`.
28. Validate request-bound guardrails return `400` with explicit messages:
    - Apollo prospect lookup: `limit` must be `1-100`, `page` must be `1-1000`.
    - Apollo company enrichment: `limit` must be `1-25`.
    - Crunchbase company enrichment: `limit` must be `1-25`.
    - Company enrichment orchestration: `limit` must be `1-25`.
    - Invalid payloads return `Invalid <field>: expected integer between <min> and <max>`.
29. Confirm invalid connector payloads do not consume throttling budget:
    - With `CONNECTOR_RATE_LIMIT_MAX_REQUESTS=1`, send one invalid lookup payload.
    - Then send one valid lookup payload and confirm it still succeeds (quota not consumed by invalid payload).
30. Validate structured connector input-validation payload contract on `400` responses:
    - `detail.errorCode=invalid_request_bounds` for bounds/type failures.
    - `detail.errorCode=invalid_request_required_field` for required-field failures.
    - `detail.field`, `detail.min`, `detail.max`, `detail.reason`, and `detail.received` are present when applicable.
31. Confirm telemetry summary includes connector input-validation rollups:
    - `connectorValidation.eventCount`
    - `connectorValidation.byEndpoint`
    - `connectorValidation.byProvider`
    - `connectorValidation.byField`
    - `connectorValidation.byReason`
    - `connectorValidation.latestEventAt`
32. Confirm recent telemetry rows include connector input-validation context fields:
    - `connectorValidationEndpoint`
    - `connectorValidationField`
    - `connectorValidationReason`
    - `connectorValidationErrorCode`
    - `connectorValidationReceived`
33. Alerting threshold guidance for sustained `400` validation failures:
    - Trigger warning if connector validation failures exceed 5 events in 10 minutes.
    - Trigger critical response if connector validation failures exceed 2% of connector lookup traffic over 15 minutes.
34. Run connector input-validation smoke workflow before rollout approval:
    - `npm run verify:smoke:connector-input-validation`

## Verification Commands
- Full connector runtime verification batch (contracts + smoke health):
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:connectors:runtime`
- Contract fixture normalization:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_provider_contract_fixtures.py`
- Endpoint guardrails + smoke:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_endpoint_smoke.py`
- Connector rate-limit guardrail contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_endpoint_smoke.py -k rate_limited`
- Connector structured `429` payload/header contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k rate_limit_returns_429`
- Connector rate-limit success header/reset contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k http_apollo_search_success`
- Connector request-bound validation contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k invalid_limit_returns_400`
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k invalid_page_returns_400`
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k does_not_consume_rate_limit`
- Connector endpoint request-bound smoke checks:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_endpoint_smoke.py -k invalid`
- Connector input-validation workflow smoke wrapper:
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-input-validation`
- Orchestration telemetry summary rollup contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_http_contract.py -k orchestration_audit_rollup`
- Connector storage-policy truncation contract:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_endpoint_smoke.py -k storage_policy`
- Existing connector normalization checks:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_normalization.py`
- Integration health + webhook idempotency checks:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_health_and_webhook.py`
- Integration telemetry log contract checks:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_integration_logging_contract.py`
- Offline orchestration checks (no external provider/runtime dependencies):
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2/backend && python3 -m unittest -q tests/test_connector_orchestration_unittest.py`
- Frontend connector UX + API contract checks:
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && CI=true npm --prefix frontend test -- src/lib/api.test.js src/pages/Integrations.test.tsx --watch=false`
- Connector lookup combined smoke (UI workflow + export workflow):
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:connector-lookups`
- Combined sales smoke checks:
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:smoke:sales`

## Monitoring Signals
- Success events:
  - `apollo_search_success`
  - `apollo_company_enrichment_success`
  - `clearbit_enrichment_success`
  - `crunchbase_enrichment_success`
  - `company_enrichment_orchestrated`
- Error trends:
  - 502 responses from provider endpoints
  - retries due to transient upstream failures
  - 429 responses with `integrations_connector_rate_limited` telemetry events
  - 400 request-validation responses with `integrations_connector_input_validation_failed` telemetry events

## Rollback
1. Set provider flag back to `false`.
2. Keep stored credentials; remove only if incident requires it.
3. Re-run integration health endpoint and confirm provider appears disabled.

## Security Notes
- Never log provider keys.
- Never return raw provider keys in API responses.
- Keep all connector writes constrained to authenticated `userId`.
