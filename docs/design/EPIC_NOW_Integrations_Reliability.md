# Design Note: NOW Epic - Sales Integrations Reliability

## Context
The current sales integrations path has partial SendGrid functionality and no consistent reliability framework for transient provider failures. Additional connectors (Apollo, Clearbit, Crunchbase) are required by roadmap but should remain controlled to avoid unsafe rollout.

## User Flow
1. Sales user configures integration credentials in settings.
2. System stores user-scoped credentials securely (masked in responses).
3. User sends outreach email through SendGrid.
4. SendGrid operation retries automatically on transient failures.
5. Webhook events update tracking state idempotently to avoid double counting.
6. User/admin checks `/api/integrations/integrations/health` for provider readiness.

## API Surface (High-Level)
- `POST /api/integrations/integrations/sendgrid`: save SendGrid key with validation.
- `POST /api/integrations/integrations/apollo`: store Apollo key (feature-flagged connector).
- `POST /api/integrations/integrations/clearbit`: store Clearbit key (feature-flagged connector).
- `POST /api/integrations/integrations/crunchbase`: store Crunchbase key (feature-flagged connector).
- `GET /api/integrations/integrations/health`: returns provider health/readiness.
- Existing `POST /api/integrations/email/send`: now includes retry/backoff + structured telemetry.
- Existing `POST /api/integrations/webhook/sendgrid`: now idempotent for duplicate events.
  - Webhook response includes processing summary counters for operations visibility.

## Data Model Changes (High-Level)
- `user_integrations`: store additional provider credentials and last known health metadata.
- `integration_event_dedup`: cache processed webhook signatures (TTL index) to enforce idempotency.
- Additional indexes:
  - `user_integrations.userId` unique
  - `email_sends` and `email_events` telemetry indexes
  - dedup unique + TTL indexes

## Integration Points
- SendGrid: active validation and health check.
- Apollo/Clearbit/Crunchbase: credential persistence and readiness reporting, protected by feature flags for rollout safety.

## Security and Privacy
- Never return raw API keys; always masked.
- Never log raw API keys or provider secrets.
- Keep all credential records user-scoped and authenticated.
- Preserve existing auth middleware and dependency checks.

## Failure Modes and Reliability
- Upstream transient failures: handled with exponential backoff retries.
- Upstream non-retryable failures (for example invalid API key): fail fast.
- Duplicate webhook events: deduplicated through deterministic event key hashing.
- Degraded provider readiness: surfaced via health endpoint with explicit reason.

## Idempotency
- Webhook event processing is idempotent through event signature hash and dedup cache.

## Telemetry and Observability
- Structured integration logs for:
  - send success/failure
  - provider latency and status code
  - health-check outcomes
  - webhook processing counters (`received`, `processed`, `deduplicated`, event type counts)
- Webhook telemetry persistence now captures user-scoped records when webhook payload includes user context (`user_id`, `custom_args`, or `unique_args`).
- No sensitive values in logs.

## Rollout Strategy
- Keep non-SendGrid connectors disabled by default using feature flags:
  - `ENABLE_APOLLO_CONNECTOR=false`
  - `ENABLE_CLEARBIT_CONNECTOR=false`
  - `ENABLE_CRUNCHBASE_CONNECTOR=false`
- Enable one provider at a time after operational verification.

## Open Questions (Virtual Approval)
1. Should Apollo/Clearbit/Crunchbase remain disabled in production until contract tests are added against sandbox provider accounts?
2. Should health checks run only on demand, or also on a schedule with status caching?
3. Should webhook dedup TTL be longer than 7 days for backfilled event replay scenarios?
