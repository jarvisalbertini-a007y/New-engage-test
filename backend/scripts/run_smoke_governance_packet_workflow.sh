#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_governance_export_schema_version_smoke.py \
  backend/tests/test_governance_weekly_report_smoke.py \
  backend/tests/test_governance_connector_pressure_smoke.py \
  backend/tests/test_governance_packet_status_normalization_smoke.py \
  backend/tests/test_governance_packet_runtime_prereqs_smoke.py \
  backend/tests/test_generate_governance_packet_validation_artifact_fixtures_unittest.py \
  backend/tests/test_validate_governance_packet_validation_artifact_unittest.py \
  backend/tests/test_validate_governance_packet_validation_artifact_retention_unittest.py \
  backend/tests/test_cleanup_governance_packet_validation_artifacts_unittest.py \
  backend/tests/test_governance_packet_validation_artifact_cleanup_policy_unittest.py \
  backend/tests/test_governance_packet_validation_artifact_cleanup_guarded_apply_unittest.py \
  backend/tests/test_governance_packet_artifact_fixture_workflow_contract.py \
  backend/tests/test_governance_export_failure_smoke.py \
  backend/tests/test_governance_history_retention_smoke.py \
  backend/tests/test_governance_packet_workflow_contract.py

bash backend/scripts/run_governance_packet_artifact_fixture_checks.sh
