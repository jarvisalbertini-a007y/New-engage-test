#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_connector_runbook_contract.py \
  backend/tests/test_connector_canary_evidence_runbook_contract.py \
  backend/tests/test_connector_release_signoff_runbook_contract.py \
  backend/tests/test_integrations_reliability_runbook_contract.py \
  backend/tests/test_runbook_path_normalization_contract.py
