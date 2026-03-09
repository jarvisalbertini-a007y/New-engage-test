from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "run_smoke_sales_suite.sh"


def test_sales_smoke_suite_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_sales_smoke_suite_runs_frontend_gate_before_backend_smokes_and_health_last():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    frontend_smoke_index = content.index(
        "bash backend/scripts/run_smoke_frontend_sales_workflow.sh"
    )
    sales_dashboard_smoke_index = content.index(
        "bash backend/scripts/run_smoke_sales_dashboard_workflow.sh"
    )
    multi_channel_controls_smoke_index = content.index(
        "bash backend/scripts/run_smoke_multi_channel_controls_workflow.sh"
    )
    baseline_command_aliases_smoke_index = content.index(
        "bash backend/scripts/run_smoke_baseline_command_aliases_workflow.sh"
    )
    baseline_command_aliases_artifact_smoke_index = content.index(
        "bash backend/scripts/run_smoke_baseline_command_aliases_artifact_workflow.sh"
    )
    campaign_smoke_index = content.index(
        "bash backend/scripts/run_smoke_sales_campaign_workflow.sh"
    )
    runtime_prereqs_smoke_index = content.index(
        "bash backend/scripts/run_smoke_sales_runtime_prereqs_artifact_workflow.sh"
    )
    baseline_metrics_artifact_smoke_index = content.index(
        "bash backend/scripts/run_smoke_baseline_metrics_artifact_workflow.sh"
    )
    canary_smoke_index = content.index(
        "bash backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh"
    )
    credential_lifecycle_smoke_index = content.index(
        "bash backend/scripts/run_smoke_connector_credential_lifecycle_workflow.sh"
    )
    connector_reliability_smoke_index = content.index(
        "bash backend/scripts/run_smoke_connector_reliability_workflow.sh"
    )
    connector_input_validation_smoke_index = content.index(
        "bash backend/scripts/run_smoke_connector_input_validation_workflow.sh"
    )
    telemetry_quality_smoke_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_quality_workflow.sh"
    )
    event_root_backfill_smoke_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_event_root_backfill_workflow.sh"
    )
    event_root_cleanup_smoke_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_event_root_backfill_artifact_cleanup_workflow.sh"
    )
    schema_gate_smoke_index = content.index(
        "bash backend/scripts/run_smoke_schema_gate_workflow.sh"
    )
    orchestration_slo_smoke_index = content.index(
        "bash backend/scripts/run_smoke_orchestration_slo_gate_workflow.sh"
    )
    release_gate_smoke_index = content.index(
        "bash backend/scripts/run_smoke_connector_release_gate_workflow.sh"
    )
    health_smoke_index = content.index("bash backend/scripts/run_smoke_health.sh")
    assert frontend_smoke_index < sales_dashboard_smoke_index < multi_channel_controls_smoke_index
    assert multi_channel_controls_smoke_index < baseline_command_aliases_smoke_index
    assert baseline_command_aliases_smoke_index < baseline_command_aliases_artifact_smoke_index
    assert baseline_command_aliases_artifact_smoke_index < campaign_smoke_index
    assert campaign_smoke_index < runtime_prereqs_smoke_index
    assert runtime_prereqs_smoke_index < baseline_metrics_artifact_smoke_index
    assert baseline_metrics_artifact_smoke_index < canary_smoke_index
    assert canary_smoke_index < credential_lifecycle_smoke_index
    assert credential_lifecycle_smoke_index < connector_reliability_smoke_index
    assert connector_reliability_smoke_index < connector_input_validation_smoke_index
    assert connector_input_validation_smoke_index < telemetry_quality_smoke_index
    assert telemetry_quality_smoke_index < event_root_backfill_smoke_index
    assert event_root_backfill_smoke_index < event_root_cleanup_smoke_index
    assert event_root_cleanup_smoke_index < schema_gate_smoke_index
    assert schema_gate_smoke_index < orchestration_slo_smoke_index < release_gate_smoke_index
    assert release_gate_smoke_index < health_smoke_index
