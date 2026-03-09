from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_reliability_workflow.sh"
)


def test_connector_reliability_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_reliability_smoke_workflow_runs_expected_stages_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    orchestration_workflow_index = content.index(
        "bash backend/scripts/run_smoke_connector_orchestration_workflow.sh"
    )
    provider_lookup_workflow_index = content.index(
        "bash backend/scripts/run_smoke_connector_provider_lookups_workflow.sh"
    )
    lookups_workflow_index = content.index(
        "bash backend/scripts/run_smoke_connector_lookups_workflow.sh"
    )
    sendgrid_workflow_index = content.index(
        "bash backend/scripts/run_smoke_sendgrid_reliability_workflow.sh"
    )
    credential_freshness_workflow_index = content.index(
        "bash backend/scripts/run_smoke_credential_freshness_workflow.sh"
    )
    assert (
        orchestration_workflow_index
        < provider_lookup_workflow_index
        < lookups_workflow_index
        < sendgrid_workflow_index
        < credential_freshness_workflow_index
    )
