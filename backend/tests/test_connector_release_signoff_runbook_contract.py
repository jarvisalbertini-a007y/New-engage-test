from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_RELEASE_SIGNOFF.md"
)


def _text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_connector_release_signoff_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_connector_release_signoff_runbook_includes_schema_traceability_contract():
    content = _text()
    required_fragments = [
        "required evidence files, required approvals, and schema traceability checklist markers are present",
        "schemaCoverage.thresholdPct",
        "schemaCoverage.observedPct",
        "schemaCoverage.sampleCount",
        "schemaCoverage.minSampleCount",
        "gates.schemaCoveragePassed",
        "gates.schemaSampleSizePassed",
    ]
    for fragment in required_fragments:
        assert fragment in content
