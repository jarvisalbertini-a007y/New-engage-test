# Connector Release Signoff

## Purpose
Standardize signoff for connector canary expansion decisions based on SLO gate output.

## Inputs
- Canary evidence JSON generated from:
  - `/Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/collect_connector_canary_evidence.py`
- SLO gate decision endpoint output (`decision`, `alerts`, `rolloutActions`, `signoff`).

## Generate Signoff Template
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/generate_connector_signoff_template.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md`

## Validate Signoff Bundle
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/validate_connector_signoff_bundle.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --signoff /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff.md --artifacts-dir /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json`

Validation rule:
- Exit code `0`: required evidence files, required approvals, and schema traceability checklist markers are present.
- Exit code `1`: missing evidence, approvals, or schema traceability checklist markers; rollout must remain blocked.

Schema traceability checklist markers (required in signoff markdown):
- `schemaCoverage.thresholdPct`
- `schemaCoverage.observedPct`
- `schemaCoverage.sampleCount`
- `schemaCoverage.minSampleCount`
- `gates.schemaCoveragePassed`
- `gates.schemaSampleSizePassed`

## Enforce Release Gate
`python /Users/AIL/Documents/EngageAI/EngageAI2/backend/scripts/enforce_connector_release_gate.py --evidence /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_canary_evidence.json --validation /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_signoff_validation.json --output /Users/AIL/Documents/EngageAI/EngageAI2/backend/test_reports/connector_release_gate_result.json`

Gate rule:
- Exit code `0`: release can proceed.
- Exit code `1`: release is blocked.

## Required Signatories
- Release Manager
- Integrations Engineer
- Sales Ops Lead
- Incident Commander (required when SLO decision is `HOLD` due error-rate gate failures)

## Signoff Rule
- If `decision=PROCEED`: approvals allow canary expansion.
- If `decision=HOLD`: no expansion is allowed until remediation + rollback drill evidence is attached and approvals are complete.
