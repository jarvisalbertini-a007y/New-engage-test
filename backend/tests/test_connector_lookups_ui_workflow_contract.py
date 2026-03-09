from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_lookups_ui_workflow.sh"
)


def test_connector_lookups_ui_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_lookups_ui_smoke_workflow_runs_expected_frontend_suites_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    api_contract_index = content.index(
        "src/lib/api.test.js"
    )
    api_pattern_index = content.index(
        '--testNamePattern="supports connector lookup and enrichment endpoints"'
    )
    integrations_page_index = content.index(
        "src/pages/Integrations.test.tsx"
    )
    integrations_pattern_index = content.index(
        '--testNamePattern="connector lookup sandbox controls|connector lookup metadata for rate limits, provider-order diagnostics, storage policy, and export payloads|rate-limited"'
    )
    assert api_contract_index < api_pattern_index < integrations_page_index < integrations_pattern_index
