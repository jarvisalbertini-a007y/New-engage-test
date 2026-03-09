# DEV_SETUP

## Scope
This setup document covers EngageAI2 sales-only implementation work in `/Users/AIL/Documents/EngageAI/EngageAI2`.

## Prerequisites
- Node.js 20+ and `npm`
- `git`
- Python 3.11+
- Optional local MongoDB for full runtime (`MONGO_URL`, default `mongodb://localhost:27017`)
- Optional env vars:
  - `DB_NAME`
  - `JWT_SECRET`
  - `EMERGENT_LLM_KEY`
  - `ENABLE_APOLLO_CONNECTOR`
  - `ENABLE_CLEARBIT_CONNECTOR`
  - `ENABLE_CRUNCHBASE_CONNECTOR`
  - `BACKFILL_ALLOW_APPLY` (set to `true` only for controlled telemetry backfill apply runs)
  - `BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled event-root fixture cleanup apply runs)
  - `BASELINE_COMMAND_ALIASES_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled baseline command-alias artifact cleanup apply runs)
  - `RUNTIME_PREREQS_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled runtime-prereq artifact cleanup apply runs)
  - `BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled baseline metrics artifact cleanup apply runs)
  - `RELEASE_GATE_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled release-gate artifact cleanup apply runs)
  - `GOVERNANCE_PACKET_ARTIFACT_CLEANUP_ALLOW_APPLY` (set to `true` only for controlled governance packet validation artifact cleanup apply runs)
  - `GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS` (default `168`; controls stale packet-validation cutoff)

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
- Runtime prerequisite guard (tooling + workspace layout): `npm run verify:baseline:runtime-prereqs`
- Baseline command alias guard (`test`/`typecheck`/sales smoke wrapper parity): `npm run verify:baseline:command-aliases`
- Baseline command-alias artifact generation (persist alias-parity artifact): `npm run verify:baseline:command-aliases:artifact`
- Baseline command-alias artifact contract validation: `npm run verify:baseline:command-aliases:artifact:contract`
- Baseline command-alias artifact retention validation: `npm run verify:baseline:command-aliases:artifact:retention`
- Baseline command-alias artifact deterministic fixture generation + contract checks: `npm run verify:baseline:command-aliases:artifact:fixtures`
- Baseline command-alias artifact cleanup dry-run: `npm run verify:baseline:command-aliases:artifact:cleanup:dry-run`
- Baseline command-alias artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:baseline:command-aliases:artifact:cleanup:policy`
- Baseline command-alias artifact cleanup guarded apply (runs only when policy allows): `npm run verify:baseline:command-aliases:artifact:cleanup:apply:guarded`
- Runtime prerequisite artifact generation (persist baseline-check artifact): `npm run verify:baseline:runtime-prereqs:artifact`
- Runtime prerequisite artifact contract validation: `npm run verify:baseline:runtime-prereqs:artifact:contract`
- Runtime prerequisite artifact retention validation: `npm run verify:baseline:runtime-prereqs:artifact:retention`
- Runtime prerequisite artifact deterministic fixture generation + contract checks: `npm run verify:baseline:runtime-prereqs:artifact:fixtures`
- Runtime prerequisite artifact cleanup dry-run: `npm run verify:baseline:runtime-prereqs:artifact:cleanup:dry-run`
- Runtime prerequisite artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:baseline:runtime-prereqs:artifact:cleanup:policy`
- Runtime prerequisite artifact cleanup guarded apply (runs only when policy allows): `npm run verify:baseline:runtime-prereqs:artifact:cleanup:apply:guarded`
- Baseline metrics artifact generation (persist baseline verification metrics artifact): `npm run verify:baseline:metrics:artifact`
- Baseline metrics artifact contract validation: `npm run verify:baseline:metrics:artifact:contract`
- Baseline metrics artifact retention validation: `npm run verify:baseline:metrics:artifact:retention`
- Baseline metrics artifact deterministic fixture generation + contract checks: `npm run verify:baseline:metrics:artifact:fixtures`
- Baseline metrics artifact cleanup dry-run: `npm run verify:baseline:metrics:artifact:cleanup:dry-run`
- Baseline metrics artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:baseline:metrics:artifact:cleanup:policy`
- Baseline metrics artifact cleanup guarded apply (runs only when policy allows): `npm run verify:baseline:metrics:artifact:cleanup:apply:guarded`
- Canonical backend test command alias: `npm run test`
- Lint/static checks: `npm run lint`
- Canonical typecheck alias: `npm run typecheck`
- Type checks: `npm run check`
- Build: `npm run build`
- Frontend tests: `npm run verify:frontend`
- Sales-only frontend tests (navigation + integrations + sales intelligence, run-in-band for deterministic CI): `npm run verify:frontend:sales`
- Sales Intelligence page-only frontend tests: `npm run verify:frontend:sales:intelligence`
- Backend integrations tests: `npm run verify:backend:sales:integrations`
- Integrations auth contract tests (protected endpoint deny-path checks): `npm run verify:auth:integrations:contracts`
- Runbook contract tests (connector operations checklist): `npm run verify:docs:sales:runbook`
- Connector runbook contract suite (enrichment + canary + signoff + reliability): `npm run verify:docs:sales:connectors`
- Runbook contract tests (predictive optimization dashboard checklist): `npm run verify:docs:sales:predictive`
- Combined docs contract verification (connectors + predictive): `npm run verify:docs:sales`
- Backend sales-intelligence tests: `npm run verify:backend:sales:intelligence`
- Sales-only backend tests: `npm run verify:backend:sales`
- Release-gate artifact contract validation (requires release artifact present): `npm run verify:release-gate:artifact:contract`
- Release-gate fixture profile validation (pass + hold artifact shapes): `npm run verify:release-gate:artifact:fixtures`
- Release-gate artifact retention validation: `npm run verify:release-gate:artifact:retention`
- Release-gate artifact cleanup dry-run: `npm run verify:release-gate:artifact:cleanup:dry-run`
- Release-gate artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:release-gate:artifact:cleanup:policy`
- Release-gate artifact cleanup guarded apply (runs only when policy allows): `npm run verify:release-gate:artifact:cleanup:apply:guarded`
- Traceability telemetry snapshot fixture generation: `npm run verify:telemetry:traceability:fixture`
- Traceability telemetry snapshot contract validation: `npm run verify:telemetry:traceability:contract`
- Traceability telemetry snapshot retention validation: `npm run verify:telemetry:traceability:retention`
- Traceability telemetry snapshot retention cleanup dry-run: `npm run verify:telemetry:traceability:cleanup:dry-run`
- Traceability telemetry snapshot cleanup apply-policy gate (scheduled cleanup safety): `npm run verify:telemetry:traceability:cleanup:policy`
- Traceability telemetry snapshot guarded apply cleanup (runs only when policy allows): `npm run verify:telemetry:traceability:cleanup:apply:guarded`
- Telemetry event-root backfill dry-run (request/schema/governance root-field normalization candidates): `npm run verify:telemetry:event-root:backfill:dry-run`
- Telemetry event-root backfill apply-policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:telemetry:event-root:backfill:policy`
- Telemetry event-root backfill guarded apply (runs only when policy allows): `npm run verify:telemetry:event-root:backfill:apply:guarded`
- Telemetry event-root backfill artifact contract checks (policy/guarded parity + count invariants): `npm run verify:telemetry:event-root:backfill:artifact:contract`
- Telemetry event-root backfill artifact fixture checks (deterministic policy/guarded artifact generation + validation): `npm run verify:telemetry:event-root:backfill:artifact:fixtures`
- Telemetry event-root backfill artifact retention validation: `npm run verify:telemetry:event-root:backfill:artifact:retention`
- Telemetry event-root backfill artifact cleanup dry-run: `npm run verify:telemetry:event-root:backfill:artifact:cleanup:dry-run`
- Telemetry event-root backfill artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:telemetry:event-root:backfill:artifact:cleanup:policy`
- Telemetry event-root backfill artifact cleanup guarded apply (runs only when policy allows): `npm run verify:telemetry:event-root:backfill:artifact:cleanup:apply:guarded`
- Combined traceability telemetry verification chain: `npm run verify:telemetry:traceability`
- Weekly governance report artifact generation: `npm run verify:governance:weekly:report`
- Weekly governance report artifact contract validation: `npm run verify:governance:weekly:report:contract`
- Weekly governance API endpoint export/shape contract validation: `npm run verify:governance:weekly:endpoint:contract`
- Governance packet fixture generation (handoff + history): `npm run verify:governance:packet:fixture`
- Governance packet artifact validation (explicit packet-validation step): `npm run verify:governance:packet:validate`
- Governance packet handoff/history contract validation: `npm run verify:governance:packet:contract`
- Governance packet validation artifact fixture checks (deterministic READY/ACTION_REQUIRED/validation-fail packet validation fixtures): `npm run verify:governance:packet:artifact:fixtures`
- Governance packet validation artifact retention validation: `npm run verify:governance:packet:artifact:retention`
- Governance packet validation artifact cleanup dry-run: `npm run verify:governance:packet:artifact:cleanup:dry-run`
- Governance packet validation artifact cleanup policy gate (`ALLOW_APPLY`/threshold safety): `npm run verify:governance:packet:artifact:cleanup:policy`
- Governance packet validation artifact cleanup guarded apply (runs only when policy allows): `npm run verify:governance:packet:artifact:cleanup:apply:guarded`
- Governance schema/env preflight check: `npm run verify:governance:schema:preflight`
- Weekly governance report artifact retention validation: `npm run verify:governance:weekly:retention`
- Weekly governance report cleanup dry-run (retention hygiene): `npm run verify:governance:weekly:cleanup:dry-run`
- Weekly governance report cleanup apply-policy gate (ALLOW_APPLY/SKIP_APPLY/ACTION_REQUIRED): `npm run verify:governance:weekly:cleanup:policy`
- Weekly governance report guarded apply cleanup (runs only when policy allows): `npm run verify:governance:weekly:cleanup:apply:guarded`
- Combined weekly governance report verification chain: `npm run verify:governance:weekly`
- Weekly governance report smoke (generator + validator end-to-end): `npm run verify:smoke:governance-report`
- Weekly governance export guard smoke (missing telemetry + invalid artifact contract failure mode): `npm run verify:smoke:governance-export-guard`
- Weekly governance history retention smoke (artifact stale/invalid/blocked edge paths): `npm run verify:smoke:governance-history-retention`
- Combined governance packet smoke (weekly report + export guard + history retention): `npm run verify:smoke:governance-packet`
- Governance connector-pressure parity smoke (endpoint/export/history contract alignment): `npm run verify:smoke:governance-connector-pressure`
- Governance duplicate-artifact remediation smoke (logical-name duplication guardrails): `npm run verify:smoke:governance-duplicate-artifact-remediation`
- Governance schema endpoint smoke (schema metadata endpoint + audit telemetry contract): `npm run verify:smoke:governance-schema-endpoint`
- Governance schema UI smoke (Integrations + Sales schema command surfaces): `npm run verify:smoke:governance-schema-ui`
- Baseline command-alias artifact smoke (fixtures + artifact contract/retention/policy workflow): `npm run verify:smoke:baseline-command-aliases-artifact`
- Runtime prerequisite artifact smoke (fixture generation + artifact generation + contract + retention/policy workflow): `npm run verify:smoke:runtime-prereqs-artifact`
- Baseline metrics artifact smoke (fixture generation + artifact contract/retention/policy workflow): `npm run verify:smoke:baseline-metrics-artifact`
- Telemetry packet-filter smoke (packet-only recency filtering + governance/packet status token safeguards): `npm run verify:smoke:telemetry-packet-filter`
- Telemetry quality smoke wrapper (status-filter + status-count + export-distribution telemetry quality checks): `npm run verify:smoke:telemetry-quality`
- Telemetry status-filter smoke (backend status-filter contracts + Integrations/Sales UI status-filter regression checks): `npm run verify:smoke:telemetry-status-filter`
- Telemetry status-count smoke (backend provenance contracts + frontend helper/API provenance contracts + Integrations/Sales UI status-count mismatch/export regressions): `npm run verify:smoke:telemetry-status-counts`
- Telemetry status-count provenance matrix verification:
  - `recentEventsGovernanceStatusCountsSource` / `recentEventsPacketValidationStatusCountsSource`
  - `recentEventsGovernanceStatusCountsMismatch` / `recentEventsPacketValidationStatusCountsMismatch`
  - `recentEventsGovernanceStatusCountsServer` / `recentEventsPacketValidationStatusCountsServer`
  - `recentEventsGovernanceStatusCountsFallback` / `recentEventsPacketValidationStatusCountsFallback`
  - `recentEventsGovernanceStatusCountsPosture` / `recentEventsPacketValidationStatusCountsPosture`
  - `recentEventsGovernanceStatusCountsPostureSeverity` / `recentEventsPacketValidationStatusCountsPostureSeverity`
  - `recentEventsGovernanceStatusCountsRequiresInvestigation` / `recentEventsPacketValidationStatusCountsRequiresInvestigation`
  - when backend posture tokens are invalid/unsupported, UI/export posture metadata must fall back to computed source+mismatch posture defaults.
  - `exportRecentEventsGovernanceStatusCountsPosture` / `exportRecentEventsPacketValidationStatusCountsPosture`
  - `exportRecentEventsGovernanceStatusCountsPostureSeverity` / `exportRecentEventsPacketValidationStatusCountsPostureSeverity`
  - `exportRecentEventsGovernanceStatusCountsRequiresInvestigation` / `exportRecentEventsPacketValidationStatusCountsRequiresInvestigation`
  - source+mismatch interpretation checkpoints:
    - `source=server, mismatch=false`
    - `source=server, mismatch=true`
    - `source=local, mismatch=false`
    - `source=local, mismatch=true`
- Telemetry event-root backfill smoke (backfill tooling unit contracts + top-level telemetry contract API projections): `npm run verify:smoke:telemetry-event-root-backfill`
- Telemetry event-root backfill artifact cleanup smoke (fixture retention/cleanup unit contracts + policy/guarded workflow checks): `npm run verify:smoke:telemetry-event-root-backfill-artifact-cleanup`
- Telemetry export distribution smoke (recent-event packet/non-packet contract guard): `npm run verify:smoke:telemetry-export-distribution`
- Traceability CI guard smoke (invalid snapshot must fail contract): `npm run verify:smoke:traceability-ci-guard`
- Traceability governance handoff smoke (ACTION_REQUIRED must block rollout): `npm run verify:smoke:traceability-governance-handoff`
- Baseline governance drift smoke (missing/invalid/recovered artifact transitions): `npm run verify:smoke:baseline-governance-drift`
- Baseline orchestration remediation smoke chain (orchestration SLO smoke + baseline metrics generation + baseline drift smoke): `npm run verify:smoke:baseline-orchestration-remediation`
- Baseline governance API remediation contract: `recommendedCommands` and `governanceExport.recommendedCommands` should prefer the wrapper command first when orchestration posture is degraded. Include runtime-prereq posture markers in governance evidence payloads: `runtimePrereqs.present`, `runtimePrereqs.available`, `runtimePrereqs.passed`, `runtimePrereqs.contractValid`, `runtimePrereqs.valid`, `runtimePrereqs.missingCheckCount`, `governanceExport.runtimePrereqs`, `totals.runtimePrereqsMissingCheckCount`, `runtimePrereqsParity.matchesNested`, `runtimePrereqsCommand`.
- Baseline metrics artifact generation (counts + durations): `npm run verify:baseline:metrics`
- Baseline metrics artifact contract validation: `npm run verify:baseline:metrics:contract`
- Baseline metrics artifact file: `backend/test_reports/baseline_metrics.json`
- Runtime prerequisite artifact file: `backend/test_reports/sales_runtime_prereqs.json`
- Traceability telemetry snapshot fixture file: `backend/test_reports/connector-telemetry-summary-snapshot.json`
- Weekly governance report artifact file: `backend/test_reports/connector_governance_weekly_report.json`
- Governance handoff export artifact file: `backend/test_reports/governance_handoff_export.json`
- Governance history export artifact file: `backend/test_reports/governance_history_export.json`
- Governance packet validation artifact file: `backend/test_reports/governance_packet_validation.json`
- CI-friendly full sales verification chain: `npm run verify:ci:sales`
- Extended CI sales chain (baseline + docs + frontend-sales smoke + sales-dashboard smoke + multi-channel controls smoke + baseline command-alias smoke + baseline command-alias artifact fixtures + baseline command-alias artifact smoke + runtime-prereq artifact fixtures + runtime-prereq artifact smoke + baseline metrics artifact fixtures + baseline metrics artifact smoke + canary dry-run + credential lifecycle smoke + connector reliability smoke + telemetry quality smoke + release fixtures + traceability telemetry checks + cleanup policy + weekly governance report + governance report/export-guard/history-retention smokes + governance packet smoke + governance duplicate-artifact remediation smoke + governance schema endpoint smoke + governance schema UI smoke + telemetry packet-filter smoke + telemetry event-root backfill smoke + telemetry event-root fixture cleanup smoke + traceability smokes + baseline orchestration remediation smoke + smoke workflow contract coverage gate): `npm run verify:ci:sales:extended`
- Campaign workflow smoke: `npm run verify:smoke:campaign`
- Connector canary dry-run smoke (schema sample override + evidence contract): `npm run verify:smoke:canary-dry-run`
- Connector credential lifecycle smoke (save/remove lifecycle metadata + telemetry summary transitions): `npm run verify:smoke:credential-lifecycle`
- Connector orchestration smoke (provider-order diagnostics + orchestration API contract): `npm run verify:smoke:connector-orchestration`
- Connector reliability smoke (orchestration + provider lookups + combined lookup smoke + SendGrid reliability + credential freshness): `npm run verify:smoke:connector-reliability`
- Connector provider lookup smoke (Apollo/Clearbit/Crunchbase endpoint contracts + normalization fixtures): `npm run verify:smoke:connector-provider-lookups`
- Connector lookup combined smoke (UI and export workflow wrappers in deterministic order): `npm run verify:smoke:connector-lookups`
- Connector lookup UI smoke (Integrations lookup controls + diagnostics/rate-limit messaging contracts): `npm run verify:smoke:connector-lookups-ui`
- Connector lookup export smoke (Integrations lookup export metadata contracts for company and Apollo snapshots): `npm run verify:smoke:connector-lookups-export`
- SendGrid reliability smoke (retry backoff + dedup + health posture): `npm run verify:smoke:sendgrid-reliability`
- Credential-freshness health transition smoke (`READY` <-> `ACTION_REQUIRED`): `npm run verify:smoke:credential-freshness`
- Schema-gate hold/proceed smoke: `npm run verify:smoke:schema-gate`
- Orchestration-attempt SLO hold/proceed smoke: `npm run verify:smoke:orchestration-slo-gate`
- Release-gate signoff enforcement smoke: `npm run verify:smoke:release-gate`
- Frontend sales smoke (sales page regression suite + predictive runbook contract): `npm run verify:smoke:frontend-sales`
- Combined sales smoke chain (frontend-sales + sales-dashboard + multi-channel controls + baseline command aliases + baseline command-alias artifact + campaign + runtime-prereq artifact + baseline metrics artifact + canary dry-run + credential lifecycle + connector reliability + telemetry quality + telemetry event-root backfill + telemetry event-root fixture cleanup + schema gate + orchestration SLO gate + release gate + health): `npm run verify:smoke:sales`
- Combined sales smoke chain executes `verify:smoke:connector-reliability` after `verify:smoke:credential-lifecycle` and before telemetry quality checks; the wrapper runs `verify:smoke:connector-orchestration`, `verify:smoke:connector-provider-lookups`, `verify:smoke:connector-lookups`, `verify:smoke:sendgrid-reliability`, and `verify:smoke:credential-freshness`.
- `verify:smoke:telemetry-quality` runs `verify:smoke:telemetry-status-filter`, `verify:smoke:telemetry-status-counts`, and `verify:smoke:telemetry-export-distribution`.
- `verify:smoke:connector-lookups` executes after `verify:smoke:connector-provider-lookups` and runs `verify:smoke:connector-lookups-ui` then `verify:smoke:connector-lookups-export`.
- Sales dashboard smoke (page tests + predictive runbook contract): `npm run verify:smoke:sales-dashboard`
- Multi-channel controls smoke (backend window/limit contract + dashboard control/export regressions): `npm run verify:smoke:multi-channel-controls`
- Baseline command alias smoke (validator unit/workflow/package-chain contract + artifact generation): `npm run verify:smoke:baseline-command-aliases`
- Baseline command-alias artifact file: `backend/test_reports/sales_baseline_command_aliases.json`
- Smoke workflow contract coverage gate (ensures each `run_smoke_*_workflow.sh` script has a matching `test_*_workflow_contract.py` suite): `npm run verify:smoke:workflow-contracts`
- Smoke health (DB-skipped startup for local verification): `npm run verify:smoke`
- Quick baseline verification chain (lint + typecheck + build + backend sales tests + combined sales smoke): `npm run verify:baseline:quick`
- Full baseline: `npm run verify:baseline`

## Sales-Only Connector Verification
- `bash backend/scripts/run_sales_only_tests.sh`

## Canary/Signoff Toolchain
- `python3 backend/scripts/collect_connector_canary_evidence.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 1000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25 --max-orchestration-attempt-error-count 5 --max-orchestration-attempt-skipped-count 25 --output backend/test_reports/connector_canary_evidence.json`
- `python3 backend/scripts/evaluate_connector_slo_gates.py --base-url http://127.0.0.1:8001 --token <token> --days 7 --limit 2000 --max-error-rate-pct 5 --min-schema-v2-pct 95 --min-schema-v2-sample-count 25 --max-orchestration-attempt-error-count 5 --max-orchestration-attempt-skipped-count 25`
- `python3 backend/scripts/generate_connector_signoff_template.py --evidence backend/test_reports/connector_canary_evidence.json --output backend/test_reports/connector_signoff.md`
- `python3 backend/scripts/validate_connector_signoff_bundle.py --evidence backend/test_reports/connector_canary_evidence.json --signoff backend/test_reports/connector_signoff.md --artifacts-dir backend/test_reports --output backend/test_reports/connector_signoff_validation.json`
- `python3 backend/scripts/generate_governance_packet_fixture.py --report backend/test_reports/connector_governance_weekly_report.json --handoff backend/test_reports/governance_handoff_export.json --history backend/test_reports/governance_history_export.json --requested-by u1`
- `python3 backend/scripts/validate_governance_packet_artifacts.py --handoff backend/test_reports/governance_handoff_export.json --history backend/test_reports/governance_history_export.json --output backend/test_reports/governance_packet_validation.json`
- `npm run verify:governance:schema:preflight`
- `export GOVERNANCE_PACKET_VALIDATION_MAX_AGE_HOURS=168` (override only for controlled remediation windows; default is 168)
- `python3 backend/scripts/enforce_connector_release_gate.py --evidence backend/test_reports/connector_canary_evidence.json --validation backend/test_reports/connector_signoff_validation.json --output backend/test_reports/connector_release_gate_result.json`
