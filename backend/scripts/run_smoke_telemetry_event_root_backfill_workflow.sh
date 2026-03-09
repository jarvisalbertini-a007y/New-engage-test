#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_backfill_integration_telemetry_event_root_contract_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_policy_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_guarded_apply_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_artifact_contract_unittest.py \
  backend/tests/test_generate_integration_telemetry_event_root_backfill_artifact_fixtures_unittest.py \
  backend/tests/test_integration_telemetry_event_root_backfill_artifact_fixture_workflow_contract.py

bash backend/scripts/run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_telemetry_summary.py \
  -k "top_level_normalized_contract_fields or prefers_top_level_event_contract_fields_when_payload_is_sparse"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_http_contract.py \
  -k "uses_top_level_telemetry_contract_fields"
