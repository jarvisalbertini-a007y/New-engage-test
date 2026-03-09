#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q backend/tests/test_telemetry_packet_filter_smoke.py

CI=true npm --prefix frontend test -- \
  src/pages/Integrations.test.tsx \
  src/pages/SalesIntelligence.test.tsx \
  --watch=false \
  --testNamePattern="status-filter"
