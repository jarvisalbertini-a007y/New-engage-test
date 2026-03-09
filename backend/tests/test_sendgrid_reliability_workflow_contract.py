from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_sendgrid_reliability_workflow.sh"
)


def test_sendgrid_reliability_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_sendgrid_reliability_smoke_workflow_runs_expected_suites_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    credential_freshness_index = content.index(
        "backend/tests/test_integration_credential_freshness_smoke.py"
    )
    health_and_webhook_index = content.index(
        "backend/tests/test_integration_health_and_webhook.py"
    )
    reliability_unit_index = content.index(
        "backend/tests/test_integrations_reliability_unittest.py"
    )
    retry_unit_index = content.index("backend/tests/test_retry_resilience_unittest.py")
    resilience_index = content.index("backend/tests/test_real_integrations_resilience.py")
    assert (
        credential_freshness_index
        < health_and_webhook_index
        < reliability_unit_index
        < retry_unit_index
        < resilience_index
    )
