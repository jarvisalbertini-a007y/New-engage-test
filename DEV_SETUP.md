# DEV_SETUP

## Scope
This setup document covers EngageAI2 sales-only implementation work in `/Users/AIL/Documents/EngageAI/EngageAI2`.

## Prerequisites
- Node.js 20+ and `npm`
- Python 3.11+
- Optional local MongoDB for full runtime (`MONGO_URL`, default `mongodb://localhost:27017`)
- Optional env vars:
  - `DB_NAME`
  - `JWT_SECRET`
  - `EMERGENT_LLM_KEY`
  - `ENABLE_APOLLO_CONNECTOR`
  - `ENABLE_CLEARBIT_CONNECTOR`
  - `ENABLE_CRUNCHBASE_CONNECTOR`

## Backend Setup
1. `cd /Users/AIL/Documents/EngageAI/EngageAI2`
2. `python3.11 -m venv .venv311`
3. `.venv311/bin/python -m pip install --upgrade pip`
4. Install backend dependencies:
   - `grep -v '^emergentintegrations==' backend/requirements.txt > /tmp/requirements.no-emergent.txt`
   - `.venv311/bin/pip install -r /tmp/requirements.no-emergent.txt`
5. Run backend locally (normal mode): `npm run dev:backend`

## Frontend Setup
1. `cd /Users/AIL/Documents/EngageAI/EngageAI2`
2. `npm install`
3. `npm run dev`

## Baseline Health Commands (Step 0)
- Lint/static checks: `npm run lint`
- Type checks: `npm run check`
- Build: `npm run build`
- Frontend tests: `npm run verify:frontend`
- Sales-only frontend tests (navigation + integrations + sales intelligence): `npm run verify:frontend:sales`
- Sales Intelligence page-only frontend tests: `npm run verify:frontend:sales:intelligence`
- Backend integrations tests: `npm run verify:backend:sales:integrations`
- Runbook contract tests (connector operations checklist): `npm run verify:docs:sales:runbook`
- Connector runbook contract suite (enrichment + canary + signoff + reliability): `npm run verify:docs:sales:connectors`
- Runbook contract tests (predictive optimization dashboard checklist): `npm run verify:docs:sales:predictive`
- Combined docs contract verification (connectors + predictive): `npm run verify:docs:sales`
- Backend sales-intelligence tests: `npm run verify:backend:sales:intelligence`
- Sales-only backend tests: `npm run verify:backend:sales`
- Release-gate artifact contract validation (requires release artifact present): `npm run verify:release-gate:artifact:contract`
- Release-gate fixture profile validation (pass + hold artifact shapes): `npm run verify:release-gate:artifact:fixtures`
- Traceability telemetry snapshot fixture generation: `npm run verify:telemetry:traceability:fixture`
- Traceability telemetry snapshot contract validation: `npm run verify:telemetry:traceability:contract`
- Traceability telemetry snapshot retention validation: `npm run verify:telemetry:traceability:retention`
- Traceability telemetry snapshot retention cleanup dry-run: `npm run verify:telemetry:traceability:cleanup:dry-run`
- Traceability telemetry snapshot cleanup apply-policy gate (scheduled cleanup safety): `npm run verify:telemetry:traceability:cleanup:policy`
- Combined traceability telemetry verification chain: `npm run verify:telemetry:traceability`
- Traceability CI guard smoke (invalid snapshot must fail contract): `npm run verify:smoke:traceability-ci-guard`
- Traceability governance handoff smoke (ACTION_REQUIRED must block rollout): `npm run verify:smoke:traceability-governance-handoff`
- Baseline metrics artifact generation (counts + durations): `npm run verify:baseline:metrics`
- Baseline metrics artifact contract validation: `npm run verify:baseline:metrics:contract`
- Baseline metrics artifact file: `backend/test_reports/baseline_metrics.json`
- Traceability telemetry snapshot fixture file: `backend/test_reports/connector-telemetry-summary-snapshot.json`
- CI-friendly full sales verification chain: `npm run verify:ci:sales`
- Extended CI sales chain (baseline + docs + canary dry-run + release fixtures + traceability telemetry checks + cleanup policy + traceability smokes): `npm run verify:ci:sales:extended`
- Campaign workflow smoke: `npm run verify:smoke:campaign`
- Connector canary dry-run smoke (schema sample override + evidence contract): `npm run verify:smoke:canary-dry-run`
- Schema-gate hold/proceed smoke: `npm run verify:smoke:schema-gate`
- Release-gate signoff enforcement smoke: `npm run verify:smoke:release-gate`
- Combined sales smoke chain (campaign + canary dry-run + schema gate + release gate + health): `npm run verify:smoke:sales`
- Sales dashboard smoke (page tests + predictive runbook contract): `npm run verify:smoke:sales-dashboard`
- Smoke health (DB-skipped startup for local verification): `npm run verify:smoke`
- Full baseline: `npm run verify:baseline`

## Sales-Only Connector Verification
- `bash backend/scripts/run_sales_only_tests.sh`

## Canary/Signoff Toolchain
- `python3 backend/scripts/collect_connector_canary_evidence.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 1000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25 --output backend/test_reports/connector_canary_evidence.json`
- `python3 backend/scripts/evaluate_connector_slo_gates.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 2000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25`
- `python3 backend/scripts/generate_connector_signoff_template.py --evidence backend/test_reports/connector_canary_evidence.json --output backend/test_reports/connector_signoff.md`
- `python3 backend/scripts/validate_connector_signoff_bundle.py --evidence backend/test_reports/connector_canary_evidence.json --signoff backend/test_reports/connector_signoff.md --artifacts-dir backend/test_reports --output backend/test_reports/connector_signoff_validation.json`
- `python3 backend/scripts/enforce_connector_release_gate.py --evidence backend/test_reports/connector_canary_evidence.json --validation backend/test_reports/connector_signoff_validation.json --output backend/test_reports/connector_release_gate_result.json`
