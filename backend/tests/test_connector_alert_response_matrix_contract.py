from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_ALERT_RESPONSE_MATRIX.md"
)


def _text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_alert_response_matrix_exists():
    assert RUNBOOK_PATH.exists()


def test_alert_response_matrix_includes_schema_coverage_action():
    content = _text()
    required_fragments = [
        "Alert: `schema_coverage` gate failure",
        "Owner: `Release Manager`",
        "schema-version drift",
        "Alert: `schema_sample_size` gate failure",
        "Owner: `Sales Ops Lead`",
        "collect additional schema-v2 telemetry samples",
    ]
    for fragment in required_fragments:
        assert fragment in content
