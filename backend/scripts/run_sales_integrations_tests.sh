#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"

"$PYTHON_BIN" -m pytest -q \
  backend/tests/test_connector_endpoint_smoke.py \
  backend/tests/test_connector_normalization.py \
  backend/tests/test_connector_orchestration_unittest.py \
  backend/tests/test_integration_health_and_webhook.py \
  backend/tests/test_integration_http_contract.py \
  backend/tests/test_integration_logging_contract.py \
  backend/tests/test_integration_telemetry_summary.py \
  backend/tests/test_integrations_reliability_unittest.py \
  backend/tests/test_integrations_reliability_runbook_contract.py \
  backend/tests/test_connector_alert_response_matrix_contract.py \
  backend/tests/test_connector_slo_alerts_contract.py \
  backend/tests/test_connector_slo_script_query_unittest.py \
  backend/tests/test_integration_slo_policy_contract.py \
  backend/tests/test_connector_release_gate_smoke.py \
  backend/tests/test_connector_release_gate_result_contract.py \
  backend/tests/test_baseline_metrics_tooling_unittest.py \
  backend/tests/test_baseline_metrics_artifact_contract_unittest.py \
  backend/tests/test_connector_release_gate_artifact_fixture_unittest.py \
  backend/tests/test_connector_release_gate_artifact_contract_unittest.py \
  backend/tests/test_connector_telemetry_snapshot_fixture_unittest.py \
  backend/tests/test_connector_telemetry_snapshot_contract_unittest.py \
  backend/tests/test_connector_telemetry_snapshot_retention_unittest.py \
  backend/tests/test_cleanup_connector_telemetry_snapshots_unittest.py \
  backend/tests/test_connector_telemetry_cleanup_policy_unittest.py \
  backend/tests/test_traceability_ci_failure_smoke.py \
  backend/tests/test_traceability_governance_handoff_smoke.py \
  backend/tests/test_baseline_command_chain_contract.py \
  backend/tests/test_dev_setup_contract.py \
  backend/tests/test_provider_contract_fixtures.py \
  backend/tests/test_real_integrations_resilience.py \
  backend/tests/test_retry_resilience_unittest.py \
  backend/tests/test_connector_canary_dry_run_smoke.py \
  backend/tests/test_connector_canary_evidence_runbook_contract.py \
  backend/tests/test_connector_runbook_contract.py \
  backend/tests/test_runbook_path_normalization_contract.py \
  backend/tests/test_connector_release_signoff_runbook_contract.py \
  backend/tests/test_signoff_toolchain_unittest.py \
  backend/tests/test_validate_connector_signoff_bundle_unittest.py \
  backend/tests/test_enforce_connector_release_gate_unittest.py
