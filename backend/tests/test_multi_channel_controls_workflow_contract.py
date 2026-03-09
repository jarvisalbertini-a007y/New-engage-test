from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_multi_channel_controls_workflow.sh"
)


def test_multi_channel_controls_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_multi_channel_controls_workflow_runs_backend_then_frontend_control_regressions():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    backend_index = content.index(
        "backend/tests/test_sales_intelligence_http_contract.py -k \"multi_channel or relationship_map\""
    )
    frontend_suite_index = content.index("src/pages/SalesIntelligence.test.tsx")
    pattern_index = content.index(
        "--testNamePattern=\"multi-channel|conversation and relationship controls|exports conversation, multi-channel, relationship\""
    )
    assert backend_index < frontend_suite_index < pattern_index
