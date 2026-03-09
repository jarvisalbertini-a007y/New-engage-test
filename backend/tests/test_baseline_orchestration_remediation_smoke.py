from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_baseline_orchestration_remediation_workflow.sh"
)


def test_baseline_orchestration_remediation_smoke_wrapper_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_orchestration_remediation_smoke_wrapper_orders_commands():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    orchestration_smoke_index = content.index(
        "bash backend/scripts/run_smoke_orchestration_slo_gate_workflow.sh"
    )
    baseline_metrics_index = content.index(
        ".venv311/bin/python backend/scripts/validate_baseline_metrics_artifact.py --artifact backend/test_reports/baseline_metrics.json"
    )
    baseline_drift_index = content.index(
        ".venv311/bin/python -m pytest -q backend/tests/test_baseline_governance_drift_smoke.py"
    )
    baseline_recommended_commands_index = content.index(
        ".venv311/bin/python -m pytest -q backend/tests/test_baseline_governance_recommended_commands_smoke.py"
    )
    assert (
        orchestration_smoke_index
        < baseline_metrics_index
        < baseline_drift_index
        < baseline_recommended_commands_index
    )
