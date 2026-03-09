# Connector Canary Rollout (Sales-Only)

## Purpose
Roll out Apollo, Clearbit, and Crunchbase connectors safely with controlled blast radius and measurable gates.

## Preconditions
- Feature flags default to disabled.
- Provider keys configured for canary tenant users only.
- Monitoring active for integration success/error events and latency.

## Rollout Sequence
1. Enable one provider flag for one canary tenant.
2. Run smoke path for that provider:
   - request succeeds
   - normalized payload shape valid
   - optional persistence write succeeds
3. Observe for 15 minutes:
   - success rate
   - 5xx/502 provider proxy errors
   - p95 latency drift
4. If stable, expand to 3 tenants.
5. Repeat sequence for next provider.

## Go/No-Go Gates
- Go if:
  - error rate < 5%
  - no auth/data leakage issues
  - no schema normalization failures
- No-Go if:
  - repeated provider failures after retry
  - malformed normalized records
  - write failures in user-scoped collections

## Evidence Capture
- Store timestamped health snapshots from `/api/integrations/integrations/health`.
- Record event totals from integration logs:
  - `apollo_search_success`
  - `clearbit_enrichment_success`
  - `crunchbase_enrichment_success`

## Exit Criteria
- Canary tenants stable for 24h.
- No Sev1/Sev2 incidents tied to connector flows.
- Rollback drill completed successfully at least once.
