#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_telemetry_summary.py -k "status_count_provenance" \
  backend/tests/test_integration_http_contract.py -k "status_count_provenance" \
  backend/tests/test_telemetry_status_count_posture_unittest.py \
  backend/tests/test_telemetry_packet_filter_smoke.py \
  backend/tests/test_telemetry_export_distribution_smoke.py

CI=true npm --prefix frontend test -- \
  src/lib/telemetryStatus.test.ts \
  src/lib/api.test.js \
  --watch=false \
  --runInBand \
  --testNamePattern="status-count provenance|classifyTelemetryStatusCountProvenance|resolveTelemetryStatusCountPosture|telemetry status-count provenance and posture payload fields unchanged"

CI=true npm --prefix frontend test -- \
  src/pages/Integrations.test.tsx \
  src/pages/SalesIntelligence.test.tsx \
  --watch=false \
  --testNamePattern="status-count|invalid posture metadata"
