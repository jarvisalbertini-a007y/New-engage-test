from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "run_sales_only_tests.sh"


def test_sales_backend_chain_script_exists():
    assert SCRIPT_PATH.exists()


def test_sales_backend_chain_runs_integrations_before_sales_intelligence():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    integrations_chain_index = content.index(
        "bash backend/scripts/run_sales_integrations_tests.sh"
    )
    intelligence_chain_index = content.index(
        "bash backend/scripts/run_sales_intelligence_tests.sh"
    )
    assert integrations_chain_index < intelligence_chain_index
