# Connector Alert Response Matrix

## Purpose
Map SLO gate alerts to explicit rollback/mitigation actions and owner roles.

## Matrix
- Alert: `error_rate` gate failure  
  Owner: `On-call Engineer`  
  Action: Pause rollout immediately and execute provider rollback drill for affected connectors.
- Alert: `provider_latency` gate failure  
  Owner: `Integrations Engineer`  
  Action: Disable affected provider flag for canary tenants and investigate upstream latency/timeout causes.
- Alert: `schema_coverage` gate failure  
  Owner: `Release Manager`  
  Action: Hold rollout, keep connector expansion frozen, and remediate schema-version drift before retrying canary.
- Alert: `schema_sample_size` gate failure  
  Owner: `Sales Ops Lead`  
  Action: Hold rollout, extend canary observation window, and collect additional schema-v2 telemetry samples before retrying expansion.
- Alert: Unknown gate failure state  
  Owner: `Release Manager`  
  Action: Hold rollout, review telemetry and health snapshots, and require manual approval before resume.

## Decision Policy
- `decision=PROCEED`: rollout can expand according to canary plan.
- `decision=HOLD`: rollout expansion is blocked until corrective action completes and SLO gates pass.

## Evidence Required
- SLO gates response snapshot (`decision`, `alerts`, `rolloutActions`).
- Health endpoint snapshot.
- Telemetry summary snapshot.
