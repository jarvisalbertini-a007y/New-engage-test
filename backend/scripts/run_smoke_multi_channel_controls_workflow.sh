#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q backend/tests/test_sales_intelligence_http_contract.py -k "multi_channel or relationship_map"

CI=true npm --prefix frontend test -- \
  src/pages/SalesIntelligence.test.tsx \
  --watch=false \
  --runInBand \
  --testNamePattern="multi-channel|conversation and relationship controls|exports conversation, multi-channel, relationship"
