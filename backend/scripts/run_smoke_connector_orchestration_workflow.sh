#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_http_contract.py::test_http_orchestration_returns_provider_order_diagnostics

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_connector_orchestration_unittest.py
