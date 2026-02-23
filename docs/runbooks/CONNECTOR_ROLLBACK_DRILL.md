# Connector Rollback Drill (Sales-Only)

## Purpose
Validate fast and safe rollback for provider connectors without impacting core sales email flows.

## Drill Frequency
- Weekly during initial rollout.
- Monthly after steady state.

## Drill Steps
1. Confirm connector flags are enabled for canary tenant.
2. Trigger a known-good connector request for each enabled provider.
3. Disable one provider flag (Apollo, Clearbit, or Crunchbase).
4. Verify expected behavior:
   - endpoint returns explicit disabled/forbidden response
   - SendGrid/email workflows remain unaffected
5. Re-enable flag and re-run same request.
6. Confirm health endpoint reflects state transitions accurately.

## Validation Checklist
- Flag change propagates immediately.
- No credential corruption in `user_integrations`.
- No cross-tenant data leakage.
- Logs clearly show state before/after rollback.

## Failure Handling
- If provider remains active after disable:
  - treat as rollback failure
  - keep provider disabled at infra level
  - open incident and block rollout expansion

## Evidence
- Record:
  - timestamp
  - provider flag toggled
  - response status before/after toggle
  - health endpoint snapshots
  - any alert activity

## Success Criteria
- Rollback completes in under 5 minutes.
- No data integrity issues.
- No user-visible failures outside affected provider endpoint.
