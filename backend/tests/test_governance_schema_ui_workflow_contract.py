from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_governance_schema_ui_workflow.sh"
)


def test_governance_schema_ui_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_governance_schema_ui_smoke_workflow_runs_frontend_contracts_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    integrations_index = content.index("src/pages/Integrations.test.tsx")
    sales_intelligence_index = content.index("src/pages/SalesIntelligence.test.tsx")
    pattern_index = content.index("--testNamePattern=\"governance schema\"")
    assert integrations_index < sales_intelligence_index < pattern_index
