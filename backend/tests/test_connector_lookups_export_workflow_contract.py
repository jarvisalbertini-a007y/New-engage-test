from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_lookups_export_workflow.sh"
)


def test_connector_lookups_export_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_lookups_export_smoke_workflow_runs_export_contract_regression():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    integrations_page_index = content.index("src/pages/Integrations.test.tsx")
    export_pattern_index = content.index(
        '--testNamePattern="connector lookup metadata for rate limits, provider-order diagnostics, storage policy, and export payloads"'
    )
    assert integrations_page_index < export_pattern_index
