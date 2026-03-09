from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
DOCS_DIR = ROOT_DIR / "docs"
RUNBOOKS_DIR = DOCS_DIR / "runbooks"
DEV_SETUP_PATH = ROOT_DIR / "DEV_SETUP.md"


def test_docs_and_setup_do_not_reference_stale_workspace_path():
    markdown_files = sorted(DOCS_DIR.rglob("*.md")) + [DEV_SETUP_PATH]
    assert markdown_files
    for path in markdown_files:
        content = path.read_text(encoding="utf-8")
        assert "EngageAI2-main" not in content, f"stale path found in {path}"


def test_connector_runbooks_reference_active_workspace_path():
    runbooks = [
        RUNBOOKS_DIR / "CONNECTOR_CANARY_EVIDENCE.md",
        RUNBOOKS_DIR / "CONNECTOR_RELEASE_SIGNOFF.md",
        RUNBOOKS_DIR / "CONNECTOR_SLO_ALERTS.md",
    ]
    expected_prefix = "/Users/AIL/Documents/EngageAI/EngageAI2/"
    for path in runbooks:
        content = path.read_text(encoding="utf-8")
        assert expected_prefix in content, f"active path prefix missing in {path.name}"
