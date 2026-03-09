#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_integration_credential_freshness_smoke.py \
  backend/tests/test_integration_health_and_webhook.py \
  backend/tests/test_integrations_reliability_unittest.py \
  backend/tests/test_retry_resilience_unittest.py \
  backend/tests/test_real_integrations_resilience.py
