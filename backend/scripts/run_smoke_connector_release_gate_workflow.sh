#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q backend/tests/test_connector_release_gate_smoke.py
"$PYTHON_BIN" backend/scripts/generate_connector_release_gate_artifact_fixture.py --output backend/test_reports/connector_release_gate_result.json
