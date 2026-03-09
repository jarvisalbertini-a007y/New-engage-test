#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_baseline_metrics_tooling_unittest.py \
  backend/tests/test_baseline_metrics_artifact_contract_unittest.py \
  backend/tests/test_generate_baseline_metrics_artifact_fixtures_unittest.py \
  backend/tests/test_validate_baseline_metrics_artifact_retention_unittest.py \
  backend/tests/test_cleanup_baseline_metrics_artifacts_unittest.py \
  backend/tests/test_baseline_metrics_artifact_cleanup_policy_unittest.py \
  backend/tests/test_baseline_metrics_artifact_cleanup_guarded_apply_unittest.py \
  backend/tests/test_baseline_metrics_artifact_fixture_workflow_contract.py \
  backend/tests/test_baseline_metrics_artifact_workflow_contract.py

bash backend/scripts/run_baseline_metrics_artifact_fixture_checks.sh

PREFIX="baseline_metrics_smoke_$(date +%s)"
ARTIFACT_DIR="backend/test_reports"

"$PYTHON_BIN" backend/scripts/generate_baseline_metrics_artifact_fixtures.py \
  --output-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX"

for profile in healthy step-failure orchestration-unavailable; do
  "$PYTHON_BIN" backend/scripts/validate_baseline_metrics_artifact.py \
    --artifact "$ARTIFACT_DIR/${PREFIX}_${profile}.json"
done

"$PYTHON_BIN" backend/scripts/validate_baseline_metrics_artifact_retention.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --min-count 3 \
  --max-age-days 30

"$PYTHON_BIN" backend/scripts/cleanup_baseline_metrics_artifacts.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3

"$PYTHON_BIN" backend/scripts/evaluate_baseline_metrics_artifact_cleanup_policy.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20

"$PYTHON_BIN" backend/scripts/run_baseline_metrics_artifact_cleanup_guarded_apply.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20
