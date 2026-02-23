from pathlib import Path


DEV_SETUP_PATH = Path(__file__).resolve().parents[2] / "DEV_SETUP.md"


def _content() -> str:
    return DEV_SETUP_PATH.read_text(encoding="utf-8")


def test_dev_setup_exists():
    assert DEV_SETUP_PATH.exists()


def test_dev_setup_includes_required_sales_verification_commands():
    content = _content()
    required_fragments = [
        "npm run lint",
        "npm run verify:baseline",
        "npm run verify:baseline:metrics",
        "npm run verify:baseline:metrics:contract",
        "npm run verify:ci:sales",
        "npm run verify:backend:sales:integrations",
        "npm run verify:docs:sales:connectors",
        "npm run verify:docs:sales",
        "npm run verify:release-gate:artifact:contract",
        "npm run verify:release-gate:artifact:fixtures",
        "npm run verify:telemetry:traceability:fixture",
        "npm run verify:telemetry:traceability:contract",
        "npm run verify:telemetry:traceability:retention",
        "npm run verify:telemetry:traceability:cleanup:dry-run",
        "npm run verify:telemetry:traceability:cleanup:policy",
        "npm run verify:telemetry:traceability",
        "npm run verify:smoke:traceability-ci-guard",
        "npm run verify:smoke:traceability-governance-handoff",
        "npm run verify:ci:sales:extended",
        "npm run verify:smoke:canary-dry-run",
        "npm run verify:smoke:sales",
        "npm run verify:smoke:schema-gate",
        "npm run verify:smoke:release-gate",
        "backend/test_reports/baseline_metrics.json",
        "backend/test_reports/connector-telemetry-summary-snapshot.json",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_dev_setup_includes_schema_threshold_slo_script_examples():
    content = _content()
    required_fragments = [
        "collect_connector_canary_evidence.py",
        "evaluate_connector_slo_gates.py",
        "--min-schema-v2-pct 95",
        "--min-schema-v2-sample-count 25",
    ]
    for fragment in required_fragments:
        assert fragment in content
