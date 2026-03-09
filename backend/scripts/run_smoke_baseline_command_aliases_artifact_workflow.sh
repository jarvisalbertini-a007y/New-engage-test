#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_validate_sales_baseline_command_aliases_artifact_unittest.py \
  backend/tests/test_generate_sales_baseline_command_aliases_artifact_fixtures_unittest.py \
  backend/tests/test_baseline_command_aliases_artifact_fixture_workflow_contract.py \
  backend/tests/test_validate_sales_baseline_command_aliases_artifact_retention_unittest.py \
  backend/tests/test_cleanup_sales_baseline_command_aliases_artifacts_unittest.py \
  backend/tests/test_sales_baseline_command_aliases_artifact_cleanup_policy_unittest.py \
  backend/tests/test_sales_baseline_command_aliases_artifact_cleanup_guarded_apply_unittest.py \
  backend/tests/test_baseline_command_aliases_artifact_workflow_contract.py

bash backend/scripts/run_sales_baseline_command_aliases_artifact_fixture_checks.sh

PREFIX="sales_baseline_command_aliases_smoke_$(date +%s)"
ARTIFACT_DIR="backend/test_reports"

"$PYTHON_BIN" backend/scripts/verify_sales_baseline_command_aliases.py \
  --output "$ARTIFACT_DIR/${PREFIX}_a.json"
"$PYTHON_BIN" backend/scripts/verify_sales_baseline_command_aliases.py \
  --output "$ARTIFACT_DIR/${PREFIX}_b.json"
"$PYTHON_BIN" backend/scripts/verify_sales_baseline_command_aliases.py \
  --output "$ARTIFACT_DIR/${PREFIX}_c.json"

"$PYTHON_BIN" backend/scripts/validate_sales_baseline_command_aliases_artifact.py \
  --artifact "$ARTIFACT_DIR/${PREFIX}_a.json"
"$PYTHON_BIN" backend/scripts/validate_sales_baseline_command_aliases_artifact.py \
  --artifact "$ARTIFACT_DIR/${PREFIX}_b.json"
"$PYTHON_BIN" backend/scripts/validate_sales_baseline_command_aliases_artifact.py \
  --artifact "$ARTIFACT_DIR/${PREFIX}_c.json"

"$PYTHON_BIN" backend/scripts/validate_sales_baseline_command_aliases_artifact_retention.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --min-count 3 \
  --max-age-days 30

"$PYTHON_BIN" backend/scripts/cleanup_sales_baseline_command_aliases_artifacts.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3

"$PYTHON_BIN" backend/scripts/evaluate_sales_baseline_command_aliases_artifact_cleanup_policy.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20

"$PYTHON_BIN" backend/scripts/run_sales_baseline_command_aliases_artifact_cleanup_guarded_apply.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20
