#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_verify_sales_baseline_command_aliases_unittest.py \
  backend/tests/test_baseline_command_aliases_workflow_contract.py \
  backend/tests/test_baseline_command_chain_contract.py

"$PYTHON_BIN" backend/scripts/verify_sales_baseline_command_aliases.py \
  --output backend/test_reports/sales_baseline_command_aliases.json
