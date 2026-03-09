# Design Note: NEXT Epic - Sales Data Connector Normalization

## Objective
Deliver sales-only connector flows for Apollo, Clearbit, and Crunchbase that return a consistent response model and can be safely rolled out via feature flags.

## User Flow
1. Sales user adds provider API key in integrations settings.
2. Admin enables provider flag in environment when ready.
3. User runs provider search/enrichment from sales workflows.
4. API returns normalized prospect/company data for downstream use.
5. Optional persistence stores data in user-scoped collections for later workflows.

## API Surface (High-Level)
- `POST /api/integrations/providers/apollo/search`
- `POST /api/integrations/providers/apollo/company`
- `POST /api/integrations/providers/clearbit/company`
- `POST /api/integrations/providers/crunchbase/company`
- `POST /api/integrations/providers/company-enrichment` (feature-flagged orchestration fallback)
- `DELETE /api/integrations/integrations/{apollo|clearbit|crunchbase}`

## Data Model (High-Level)
- Reuse existing `prospects` collection for normalized Apollo results.
- Reuse `company_research` for normalized company enrichment results.
- Preserve user-level scoping on all writes.

## Security and Privacy
- Provider keys remain user-scoped and masked in read paths.
- Provider endpoints require authenticated user context.
- Logs include metadata only; no secret values.

## Failure and Retry
- Provider requests use shared retry/backoff for transient failures.
- Non-retryable provider errors fail fast with gateway error response.
- Disabled flags return explicit, safe rejection.
- Orchestration endpoint records per-provider attempt status (`success|skipped|error`) and can short-circuit on first successful provider.

## Observability
- Structured log events:
  - `apollo_search_success`
  - `apollo_company_enrichment_success`
  - `clearbit_enrichment_success`
  - `crunchbase_enrichment_success`
  - `company_enrichment_orchestrated`
- Include request criteria, result counts, and latency.

## Rollout
- Default flags remain disabled:
  - `ENABLE_APOLLO_CONNECTOR=false`
  - `ENABLE_CLEARBIT_CONNECTOR=false`
  - `ENABLE_CRUNCHBASE_CONNECTOR=false`
  - `ENABLE_CONNECTOR_ORCHESTRATION=false`
- Enable one provider at a time after runtime verification.

## Open Questions
1. Which provider-specific schema contract tests should be mandatory before enabling each flag in production?
2. Do we want per-tenant rate limits for connector endpoints before broad rollout?
3. Should persisted enrichment payloads be truncated for storage cost control?
