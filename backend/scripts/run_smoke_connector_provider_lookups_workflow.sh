#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_http_contract.py -k "apollo_search_success or clearbit_search_success or crunchbase_search_success"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_connector_endpoint_smoke.py

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_provider_contract_fixtures.py
