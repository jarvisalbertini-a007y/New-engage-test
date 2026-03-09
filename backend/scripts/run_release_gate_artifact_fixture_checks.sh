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

"$PYTHON_BIN" backend/scripts/validate_connector_release_gate_artifact_retention.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --min-count 3 --max-age-days 30
"$PYTHON_BIN" backend/scripts/cleanup_connector_release_gate_artifacts.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3
"$PYTHON_BIN" backend/scripts/evaluate_connector_release_gate_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3 --max-apply-candidates 20
"$PYTHON_BIN" backend/scripts/run_connector_release_gate_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3 --max-apply-candidates 20
