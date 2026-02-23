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

## Verification Commands
- Full connector runtime verification batch (contracts + smoke health):
  - `cd /Users/AIL/Documents/EngageAI/EngageAI2 && npm run verify:backend:sales:connectors:runtime`
- Contract fixture normalization:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_provider_contract_fixtures.py`
- Endpoint guardrails + smoke:
  - `python3 -m pytest -q /Users/AIL/Documents/EngageAI/EngageAI2/backend/tests/test_connector_endpoint_smoke.py`
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

## Rollback
1. Set provider flag back to `false`.
2. Keep stored credentials; remove only if incident requires it.
3. Re-run integration health endpoint and confirm provider appears disabled.

## Security Notes
- Never log provider keys.
- Never return raw provider keys in API responses.
- Keep all connector writes constrained to authenticated `userId`.
