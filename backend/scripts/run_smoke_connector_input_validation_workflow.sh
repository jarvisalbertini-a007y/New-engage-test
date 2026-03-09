#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q backend/tests/test_integrations_reliability_unittest.py -k parse_request_bounded_int
"$PYTHON_BIN" -m pytest -q backend/tests/test_integration_http_contract.py -k "invalid_limit_returns_400 or invalid_page_returns_400 or does_not_consume_rate_limit"
"$PYTHON_BIN" -m pytest -q backend/tests/test_connector_endpoint_smoke.py -k invalid
"$PYTHON_BIN" -m pytest -q backend/tests/test_integration_telemetry_summary.py -k connector_input_validation_failures
CI=true npm --prefix frontend test -- src/pages/Integrations.test.tsx src/pages/SalesIntelligence.test.tsx --watch=false --runInBand --testNamePattern="renders campaign and telemetry summaries when data is available|exports telemetry and SLO snapshots through UI actions|exports telemetry snapshot with non-default window metadata and supports notice dismissal|renders high connector throttle pressure and exports connector pressure metadata|classifies connector throttle pressure as moderate at threshold and exports threshold state"
