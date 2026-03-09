#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_server_startup_flags.py \
  backend/tests/test_sales_intelligence_backlog.py \
  backend/tests/test_sales_campaign_smoke.py \
  backend/tests/test_sales_intelligence_http_contract.py \
  backend/tests/test_predictive_runbook_contract.py
