from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_sales_intelligence_tests.sh"
)


def test_sales_intelligence_chain_script_exists():
    assert SCRIPT_PATH.exists()


def test_sales_intelligence_chain_includes_core_sales_only_suites_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    startup_flags_index = content.index("backend/tests/test_server_startup_flags.py")
    backlog_index = content.index("backend/tests/test_sales_intelligence_backlog.py")
    campaign_smoke_index = content.index("backend/tests/test_sales_campaign_smoke.py")
    http_contract_index = content.index(
        "backend/tests/test_sales_intelligence_http_contract.py"
    )
    predictive_runbook_index = content.index(
        "backend/tests/test_predictive_runbook_contract.py"
    )

    assert startup_flags_index < backlog_index < campaign_smoke_index
    assert campaign_smoke_index < http_contract_index < predictive_runbook_index
