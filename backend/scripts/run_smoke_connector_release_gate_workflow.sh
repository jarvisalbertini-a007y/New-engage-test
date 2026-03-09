#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_connector_release_gate_smoke.py \
  backend/tests/test_connector_release_gate_artifact_fixture_unittest.py \
  backend/tests/test_connector_release_gate_artifact_contract_unittest.py \
  backend/tests/test_validate_connector_release_gate_artifact_retention_unittest.py \
  backend/tests/test_cleanup_connector_release_gate_artifacts_unittest.py \
  backend/tests/test_connector_release_gate_artifact_cleanup_policy_unittest.py \
  backend/tests/test_connector_release_gate_artifact_cleanup_guarded_apply_unittest.py \
  backend/tests/test_connector_release_gate_artifact_fixture_workflow_contract.py \
  backend/tests/test_connector_release_gate_workflow_contract.py

bash backend/scripts/run_release_gate_artifact_fixture_checks.sh
