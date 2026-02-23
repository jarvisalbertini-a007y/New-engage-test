#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

PASS_ARTIFACT="backend/test_reports/connector_release_gate_result.json"
HOLD_ARTIFACT="backend/test_reports/connector_release_gate_result_hold.json"
VALIDATION_FAIL_ARTIFACT="backend/test_reports/connector_release_gate_result_validation_fail.json"

"$PYTHON_BIN" backend/scripts/generate_connector_release_gate_artifact_fixture.py --profile pass --output "$PASS_ARTIFACT"
"$PYTHON_BIN" backend/scripts/validate_connector_release_gate_artifact.py --artifact "$PASS_ARTIFACT"

"$PYTHON_BIN" backend/scripts/generate_connector_release_gate_artifact_fixture.py --profile hold --output "$HOLD_ARTIFACT"
"$PYTHON_BIN" backend/scripts/validate_connector_release_gate_artifact.py --artifact "$HOLD_ARTIFACT"

"$PYTHON_BIN" backend/scripts/generate_connector_release_gate_artifact_fixture.py --profile validation-fail --output "$VALIDATION_FAIL_ARTIFACT"
"$PYTHON_BIN" backend/scripts/validate_connector_release_gate_artifact.py --artifact "$VALIDATION_FAIL_ARTIFACT"
