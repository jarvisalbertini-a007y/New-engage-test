#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_telemetry_event_root_backfill_artifact_retention_unittest.py \
  backend/tests/test_cleanup_integration_telemetry_event_root_backfill_artifacts_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_artifact_cleanup_policy_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply_unittest.py \
  backend/tests/test_telemetry_event_root_backfill_artifact_cleanup_workflow_contract.py

bash backend/scripts/run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh

"$PYTHON_BIN" backend/scripts/validate_integration_telemetry_event_root_backfill_artifact_retention.py \
  --artifact-dir backend/test_reports \
  --prefix integration_telemetry_event_root_backfill \
  --min-count 3 \
  --max-age-days 30

"$PYTHON_BIN" backend/scripts/cleanup_integration_telemetry_event_root_backfill_artifacts.py \
  --artifact-dir backend/test_reports \
  --prefix integration_telemetry_event_root_backfill \
  --keep-days 30 \
  --keep-min-count 9

"$PYTHON_BIN" backend/scripts/evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy.py \
  --artifact-dir backend/test_reports \
  --prefix integration_telemetry_event_root_backfill \
  --keep-days 30 \
  --keep-min-count 9 \
  --max-apply-candidates 20

"$PYTHON_BIN" backend/scripts/run_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply.py \
  --artifact-dir backend/test_reports \
  --prefix integration_telemetry_event_root_backfill \
  --keep-days 30 \
  --keep-min-count 9 \
  --max-apply-candidates 20
