from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_SLO_ALERTS.md"
)


def _content() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_connector_slo_alerts_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_connector_slo_alerts_runbook_includes_schema_coverage_gate_details():
    content = _content()
    required_fragments = [
        "Sales schema-coverage gate passes",
        "Sales schema sample-size gate passes",
        "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT=95",
        "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT=25",
        "min_schema_v2_pct",
        "min_schema_v2_sample_count",
        "schemaCoverage",
        "gates.schemaCoveragePassed",
        "gates.schemaSampleSizePassed",
    ]
    for fragment in required_fragments:
        assert fragment in content
