from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_CANARY_EVIDENCE.md"
)


def _text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_connector_canary_evidence_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_connector_canary_evidence_runbook_includes_schema_sample_override_and_outputs():
    content = _text()
    required_fragments = [
        "--min-schema-v2-sample-count 25",
        "gates.schemaCoveragePassed",
        "gates.schemaSampleSizePassed",
        "schemaCoverage.sampleCount",
        "schemaCoverage.minSampleCount",
    ]
    for fragment in required_fragments:
        assert fragment in content
