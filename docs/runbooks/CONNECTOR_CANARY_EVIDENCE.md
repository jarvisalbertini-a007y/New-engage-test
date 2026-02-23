# Connector Canary Evidence Collection

## Purpose
Capture repeatable, timestamped evidence for connector rollout health and telemetry during canary phases.

## Script
- `/Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/collect_connector_canary_evidence.py`

## Inputs
- Backend base URL (for staging or canary environment).
- Auth bearer token for a canary user.
- Time window (`days`) and event limit (`limit`).

## Command
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/collect_connector_canary_evidence.py --base-url http://127.0.0.1:8000 --token <token> --days 7 --limit 1000 --min-schema-v2-sample-count 25 --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json`

## Output
- JSON evidence file containing:
  - telemetry summary
  - integration health summary
  - SLO gate summary (`decision`, `alerts`, `rolloutActions`)
  - schema gate status (`gates.schemaCoveragePassed`, `gates.schemaSampleSizePassed`)
  - schema sample requirements (`schemaCoverage.sampleCount`, `schemaCoverage.minSampleCount`)
  - collection timestamp
  - query window metadata

## Recommended Cadence
- Every 15 minutes during active canary rollout.
- At least once before and after rollback drill execution.

## Post-Collection
- Generate signoff markdown from evidence:
  - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/generate_connector_signoff_template.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md`
- Validate signoff bundle before expansion:
  - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/validate_connector_signoff_bundle.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --signoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md --artifacts-dir /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json`
- Enforce release gate:
  - `python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/enforce_connector_release_gate.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --validation /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_release_gate_result.json`

## Pass Criteria
- Error event ratio remains below agreed threshold.
- Provider health states align with active flags.
- No unexpected provider events during disabled phases.
