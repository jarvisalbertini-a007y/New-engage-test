import json
from pathlib import Path


PACKAGE_JSON_PATH = Path(__file__).resolve().parents[2] / "package.json"


def _scripts():
    payload = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
    return payload.get("scripts", {})


def test_package_json_exists():
    assert PACKAGE_JSON_PATH.exists()


def test_lint_script_is_defined_for_baseline_gate():
    scripts = _scripts()
    assert scripts.get("lint") == "npm run check"


def test_test_and_typecheck_aliases_are_defined_for_baseline_gate():
    scripts = _scripts()
    assert scripts.get("test") == "npm run verify:backend:sales"
    assert scripts.get("typecheck") == "npm run check"


def test_verify_baseline_quick_wrapper_is_defined():
    scripts = _scripts()
    assert (
        scripts.get("verify:baseline:quick")
        == "bash backend/scripts/run_baseline_quick_workflow.sh"
    )


def test_verify_baseline_command_chain_includes_required_stages_in_order():
    scripts = _scripts()
    baseline_cmd = scripts.get("verify:baseline")
    assert baseline_cmd is not None

    segments = [segment.strip() for segment in baseline_cmd.split("&&")]
    assert segments == [
        "npm run verify:baseline:runtime-prereqs",
        "npm run verify:baseline:command-aliases",
        "npm run lint",
        "npm run build",
        "npm run verify:frontend",
        "npm run verify:backend:sales",
        "npm run verify:smoke:campaign",
        "npm run verify:smoke:schema-gate",
        "npm run verify:smoke:orchestration-slo-gate",
        "npm run verify:smoke:release-gate",
        "npm run verify:release-gate:artifact:contract",
        "npm run verify:smoke",
    ]
    assert (
        scripts.get("verify:baseline:command-aliases")
        == ".venv311/bin/python backend/scripts/verify_sales_baseline_command_aliases.py"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact")
        == ".venv311/bin/python backend/scripts/verify_sales_baseline_command_aliases.py --output backend/test_reports/sales_baseline_command_aliases.json"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:contract")
        == ".venv311/bin/python backend/scripts/validate_sales_baseline_command_aliases_artifact.py --artifact backend/test_reports/sales_baseline_command_aliases.json"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_sales_baseline_command_aliases_artifact_retention.py --artifact-dir backend/test_reports --prefix sales_baseline_command_aliases --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_sales_baseline_command_aliases_artifacts.py --artifact-dir backend/test_reports --prefix sales_baseline_command_aliases --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_sales_baseline_command_aliases_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix sales_baseline_command_aliases --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_sales_baseline_command_aliases_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix sales_baseline_command_aliases --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:baseline:command-aliases:artifact:fixtures")
        == "bash backend/scripts/run_sales_baseline_command_aliases_artifact_fixture_checks.sh"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs")
        == ".venv311/bin/python backend/scripts/verify_sales_runtime_prereqs.py"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact")
        == ".venv311/bin/python backend/scripts/verify_sales_runtime_prereqs.py --output backend/test_reports/sales_runtime_prereqs.json"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:contract")
        == ".venv311/bin/python backend/scripts/validate_sales_runtime_prereqs_artifact.py --artifact backend/test_reports/sales_runtime_prereqs.json"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_sales_runtime_prereqs_artifact_retention.py --artifact-dir backend/test_reports --prefix sales_runtime_prereqs --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_sales_runtime_prereqs_artifacts.py --artifact-dir backend/test_reports --prefix sales_runtime_prereqs --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_sales_runtime_prereqs_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix sales_runtime_prereqs --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_sales_runtime_prereqs_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix sales_runtime_prereqs --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:baseline:runtime-prereqs:artifact:fixtures")
        == "bash backend/scripts/run_sales_runtime_prereqs_artifact_fixture_checks.sh"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact")
        == ".venv311/bin/python backend/scripts/collect_baseline_metrics.py --output backend/test_reports/baseline_metrics.json"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:contract")
        == ".venv311/bin/python backend/scripts/validate_baseline_metrics_artifact.py --artifact backend/test_reports/baseline_metrics.json"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_baseline_metrics_artifact_retention.py --artifact-dir backend/test_reports --prefix baseline_metrics --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:fixtures")
        == "bash backend/scripts/run_baseline_metrics_artifact_fixture_checks.sh"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_baseline_metrics_artifacts.py --artifact-dir backend/test_reports --prefix baseline_metrics --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_baseline_metrics_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix baseline_metrics --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:baseline:metrics:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_baseline_metrics_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix baseline_metrics --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )


def test_verify_ci_sales_chain_includes_baseline_and_metrics_contract():
    scripts = _scripts()
    assert (
        scripts.get("verify:ci:sales")
        == "npm run verify:baseline && npm run verify:auth:integrations:contracts && npm run verify:baseline:metrics"
    )


def test_package_scripts_include_sales_backend_wrapper_mappings():
    scripts = _scripts()
    assert (
        scripts.get("verify:backend:sales:integrations")
        == "bash backend/scripts/run_sales_integrations_tests.sh"
    )
    assert (
        scripts.get("verify:backend:sales:intelligence")
        == "bash backend/scripts/run_sales_intelligence_tests.sh"
    )
    assert (
        scripts.get("verify:backend:sales")
        == "bash backend/scripts/run_sales_only_tests.sh"
    )


def test_package_scripts_include_connector_docs_and_canary_dry_run_wrappers():
    scripts = _scripts()
    assert (
        scripts.get("verify:frontend:sales")
        == "CI=true npm --prefix frontend test -- src/App.test.tsx src/components/Layout.test.tsx src/pages/Integrations.test.tsx src/pages/SalesIntelligence.test.tsx --watch=false --runInBand"
    )
    assert scripts.get("verify:docs:sales:connectors") == "bash backend/scripts/run_docs_connector_runbook_contracts.sh"
    assert (
        scripts.get("verify:docs:sales")
        == "npm run verify:docs:sales:connectors && npm run verify:docs:sales:predictive"
    )
    assert (
        scripts.get("verify:smoke:canary-dry-run")
        == "bash backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:credential-lifecycle")
        == "bash backend/scripts/run_smoke_connector_credential_lifecycle_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-orchestration")
        == "bash backend/scripts/run_smoke_connector_orchestration_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-reliability")
        == "bash backend/scripts/run_smoke_connector_reliability_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-provider-lookups")
        == "bash backend/scripts/run_smoke_connector_provider_lookups_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-lookups")
        == "bash backend/scripts/run_smoke_connector_lookups_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-lookups-ui")
        == "bash backend/scripts/run_smoke_connector_lookups_ui_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-lookups-export")
        == "bash backend/scripts/run_smoke_connector_lookups_export_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:connector-input-validation")
        == "bash backend/scripts/run_smoke_connector_input_validation_workflow.sh"
    )


def test_package_scripts_include_sales_smoke_and_extended_ci_wrappers():
    scripts = _scripts()
    assert scripts.get("verify:smoke:sales") == "bash backend/scripts/run_smoke_sales_suite.sh"
    assert (
        scripts.get("verify:smoke:orchestration-slo-gate")
        == "bash backend/scripts/run_smoke_orchestration_slo_gate_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:baseline-orchestration-remediation")
        == "bash backend/scripts/run_smoke_baseline_orchestration_remediation_workflow.sh"
    )
    assert (
        scripts.get("verify:ci:sales:extended")
        == "npm run verify:ci:sales && npm run verify:docs:sales && npm run verify:smoke:frontend-sales && npm run verify:smoke:sales-dashboard && npm run verify:smoke:multi-channel-controls && npm run verify:smoke:baseline-command-aliases && npm run verify:baseline:command-aliases:artifact:fixtures && npm run verify:smoke:baseline-command-aliases-artifact && npm run verify:baseline:runtime-prereqs:artifact:fixtures && npm run verify:smoke:runtime-prereqs-artifact && npm run verify:baseline:metrics:artifact:fixtures && npm run verify:smoke:baseline-metrics-artifact && npm run verify:smoke:canary-dry-run && npm run verify:smoke:credential-lifecycle && npm run verify:smoke:connector-reliability && npm run verify:smoke:telemetry-quality && npm run verify:release-gate:artifact:fixtures && npm run verify:telemetry:traceability && npm run verify:telemetry:traceability:cleanup:policy && npm run verify:governance:weekly && npm run verify:smoke:governance-report && npm run verify:smoke:governance-export-guard && npm run verify:smoke:governance-history-retention && npm run verify:smoke:governance-packet && npm run verify:smoke:governance-connector-pressure && npm run verify:smoke:governance-duplicate-artifact-remediation && npm run verify:smoke:governance-schema-endpoint && npm run verify:smoke:governance-schema-ui && npm run verify:smoke:telemetry-packet-filter && npm run verify:smoke:telemetry-event-root-backfill && npm run verify:smoke:telemetry-event-root-backfill-artifact-cleanup && npm run verify:smoke:traceability-ci-guard && npm run verify:smoke:traceability-governance-handoff && npm run verify:smoke:baseline-orchestration-remediation && npm run verify:smoke:baseline-governance-drift && npm run verify:smoke:workflow-contracts"
    )
    assert (
        scripts.get("verify:smoke:frontend-sales")
        == "bash backend/scripts/run_smoke_frontend_sales_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:sales-dashboard")
        == "bash backend/scripts/run_smoke_sales_dashboard_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:multi-channel-controls")
        == "bash backend/scripts/run_smoke_multi_channel_controls_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:baseline-command-aliases")
        == "bash backend/scripts/run_smoke_baseline_command_aliases_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:baseline-command-aliases-artifact")
        == "bash backend/scripts/run_smoke_baseline_command_aliases_artifact_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:baseline-metrics-artifact")
        == "bash backend/scripts/run_smoke_baseline_metrics_artifact_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:workflow-contracts")
        == "bash backend/scripts/run_smoke_workflow_contracts_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke")
        == "bash backend/scripts/run_smoke_health_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:runtime-prereqs-artifact")
        == "bash backend/scripts/run_smoke_sales_runtime_prereqs_artifact_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:sendgrid-reliability")
        == "bash backend/scripts/run_smoke_sendgrid_reliability_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:credential-freshness")
        == "bash backend/scripts/run_smoke_credential_freshness_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-quality")
        == "bash backend/scripts/run_smoke_telemetry_quality_workflow.sh"
    )
    assert (
        scripts.get("verify:release-gate:artifact:contract")
        == ".venv311/bin/python backend/scripts/validate_connector_release_gate_artifact.py --artifact backend/test_reports/connector_release_gate_result.json"
    )
    assert scripts.get("verify:release-gate:artifact:fixtures") == "bash backend/scripts/run_release_gate_artifact_fixture_checks.sh"
    assert (
        scripts.get("verify:release-gate:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_connector_release_gate_artifact_retention.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --min-count 3 --max-age-days 30"
    )
    assert (
        scripts.get("verify:release-gate:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_connector_release_gate_artifacts.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3"
    )
    assert (
        scripts.get("verify:release-gate:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_connector_release_gate_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:release-gate:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_connector_release_gate_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix connector_release_gate_result --keep-days 30 --keep-min-count 3 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:telemetry:traceability:fixture")
        == ".venv311/bin/python backend/scripts/generate_connector_telemetry_snapshot_fixture.py --output backend/test_reports/connector-telemetry-summary-snapshot.json"
    )
    assert (
        scripts.get("verify:telemetry:traceability:contract")
        == ".venv311/bin/python backend/scripts/validate_connector_telemetry_snapshot.py --snapshot backend/test_reports/connector-telemetry-summary-snapshot.json"
    )
    assert (
        scripts.get("verify:telemetry:traceability:retention")
        == ".venv311/bin/python backend/scripts/validate_connector_telemetry_snapshot_retention.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:telemetry:traceability:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_connector_telemetry_snapshots.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:telemetry:traceability:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_connector_telemetry_cleanup_policy.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:telemetry:traceability:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_connector_telemetry_cleanup_guarded_apply.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:telemetry:traceability")
        == "npm run verify:telemetry:traceability:fixture && npm run verify:telemetry:traceability:contract && npm run verify:telemetry:traceability:retention"
    )
    assert (
        scripts.get("verify:governance:weekly:report")
        == ".venv311/bin/python backend/scripts/generate_connector_governance_weekly_report.py --telemetry-snapshot backend/test_reports/connector-telemetry-summary-snapshot.json --baseline-metrics backend/test_reports/baseline_metrics.json --output backend/test_reports/connector_governance_weekly_report.json --window-days 7"
    )
    assert (
        scripts.get("verify:governance:weekly:report:contract")
        == ".venv311/bin/python backend/scripts/validate_connector_governance_weekly_report.py --artifact backend/test_reports/connector_governance_weekly_report.json"
    )
    assert (
        scripts.get("verify:governance:weekly")
        == "npm run verify:governance:weekly:report && npm run verify:governance:weekly:report:contract && npm run verify:governance:weekly:endpoint:contract && npm run verify:governance:schema:preflight && npm run verify:governance:packet:contract && npm run verify:governance:packet:artifact:retention && npm run verify:governance:packet:artifact:cleanup:dry-run && npm run verify:governance:packet:artifact:cleanup:policy && npm run verify:governance:weekly:retention && npm run verify:governance:weekly:cleanup:dry-run && npm run verify:governance:weekly:cleanup:policy"
    )
    assert (
        scripts.get("verify:governance:weekly:endpoint:contract")
        == ".venv311/bin/python -m pytest -q backend/tests/test_governance_export_endpoint_contract.py backend/tests/test_governance_weekly_report_endpoint_contract.py"
    )
    assert (
        scripts.get("verify:governance:schema:preflight")
        == ".venv311/bin/python -m pytest -q backend/tests/test_validate_connector_signoff_bundle_unittest.py -k governance_schema_env_override"
    )
    assert (
        scripts.get("verify:governance:packet:fixture")
        == ".venv311/bin/python backend/scripts/generate_governance_packet_fixture.py --report backend/test_reports/connector_governance_weekly_report.json --handoff backend/test_reports/governance_handoff_export.json --history backend/test_reports/governance_history_export.json --requested-by u1"
    )
    assert (
        scripts.get("verify:governance:packet:validate")
        == ".venv311/bin/python backend/scripts/validate_governance_packet_artifacts.py --handoff backend/test_reports/governance_handoff_export.json --history backend/test_reports/governance_history_export.json --output backend/test_reports/governance_packet_validation.json"
    )
    assert (
        scripts.get("verify:governance:packet:contract")
        == "npm run verify:governance:packet:fixture && npm run verify:governance:packet:validate"
    )
    assert (
        scripts.get("verify:governance:packet:artifact:fixtures")
        == "bash backend/scripts/run_governance_packet_artifact_fixture_checks.sh"
    )
    assert (
        scripts.get("verify:governance:packet:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_governance_packet_validation_artifact_retention.py --artifact-dir backend/test_reports --prefix governance_packet_validation --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:governance:packet:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_governance_packet_validation_artifacts.py --artifact-dir backend/test_reports --prefix governance_packet_validation --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:governance:packet:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_governance_packet_validation_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix governance_packet_validation --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:governance:packet:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_governance_packet_validation_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix governance_packet_validation --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:governance:weekly:retention")
        == ".venv311/bin/python backend/scripts/validate_connector_governance_weekly_report_retention.py --artifact-dir backend/test_reports --prefix connector_governance_weekly_report --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:governance:weekly:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_connector_governance_weekly_reports.py --artifact-dir backend/test_reports --prefix connector_governance_weekly_report --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:governance:weekly:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_connector_governance_weekly_cleanup_policy.py --artifact-dir backend/test_reports --prefix connector_governance_weekly_report --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:governance:weekly:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_connector_governance_weekly_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix connector_governance_weekly_report --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:smoke:governance-report")
        == "bash backend/scripts/run_smoke_governance_report_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-export-guard")
        == "bash backend/scripts/run_smoke_governance_export_guard_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-history-retention")
        == "bash backend/scripts/run_smoke_governance_history_retention_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-packet")
        == "bash backend/scripts/run_smoke_governance_packet_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-connector-pressure")
        == "bash backend/scripts/run_smoke_governance_connector_pressure_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-duplicate-artifact-remediation")
        == "bash backend/scripts/run_smoke_governance_duplicate_artifact_remediation_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-schema-endpoint")
        == "bash backend/scripts/run_smoke_governance_schema_endpoint_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:governance-schema-ui")
        == "bash backend/scripts/run_smoke_governance_schema_ui_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-packet-filter")
        == "bash backend/scripts/run_smoke_telemetry_packet_filter_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-status-filter")
        == "bash backend/scripts/run_smoke_telemetry_status_filter_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-status-counts")
        == "bash backend/scripts/run_smoke_telemetry_status_count_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-event-root-backfill")
        == "bash backend/scripts/run_smoke_telemetry_event_root_backfill_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:telemetry-export-distribution")
        == "bash backend/scripts/run_smoke_telemetry_export_distribution_workflow.sh"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:dry-run")
        == ".venv311/bin/python backend/scripts/backfill_integration_telemetry_event_root_contract.py --max-docs 50000 --batch-size 500"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:policy")
        == ".venv311/bin/python backend/scripts/evaluate_integration_telemetry_event_root_backfill_policy.py --max-docs 50000 --batch-size 500 --max-apply-candidates 2000"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_integration_telemetry_event_root_backfill_guarded_apply.py --max-docs 50000 --batch-size 500 --max-apply-candidates 2000"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:contract")
        == ".venv311/bin/python -m pytest -q backend/tests/test_integration_telemetry_event_root_backfill_artifact_contract_unittest.py"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:fixtures")
        == "bash backend/scripts/run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:retention")
        == ".venv311/bin/python backend/scripts/validate_integration_telemetry_event_root_backfill_artifact_retention.py --artifact-dir backend/test_reports --prefix integration_telemetry_event_root_backfill --min-count 3 --max-age-days 30"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_integration_telemetry_event_root_backfill_artifacts.py --artifact-dir backend/test_reports --prefix integration_telemetry_event_root_backfill --keep-days 30 --keep-min-count 3"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy.py --artifact-dir backend/test_reports --prefix integration_telemetry_event_root_backfill --keep-days 30 --keep-min-count 3 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:telemetry:event-root:backfill:artifact:cleanup:apply:guarded")
        == ".venv311/bin/python backend/scripts/run_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply.py --artifact-dir backend/test_reports --prefix integration_telemetry_event_root_backfill --keep-days 30 --keep-min-count 3 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:smoke:telemetry-event-root-backfill-artifact-cleanup")
        == "bash backend/scripts/run_smoke_telemetry_event_root_backfill_artifact_cleanup_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:traceability-ci-guard")
        == "bash backend/scripts/run_smoke_traceability_ci_guard_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:traceability-governance-handoff")
        == "bash backend/scripts/run_smoke_traceability_governance_handoff_workflow.sh"
    )
    assert (
        scripts.get("verify:smoke:baseline-governance-drift")
        == "bash backend/scripts/run_smoke_baseline_governance_drift_workflow.sh"
    )
