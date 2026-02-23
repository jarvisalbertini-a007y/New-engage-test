import json
from pathlib import Path


PACKAGE_JSON_PATH = Path(__file__).resolve().parents[2] / "package.json"


def _scripts():
    payload = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
    return payload.get("scripts", {})


def test_package_json_exists():
    assert PACKAGE_JSON_PATH.exists()


def test_lint_script_is_defined_for_baseline_gate():
    scripts = _scripts()
    assert scripts.get("lint") == "npm run check"


def test_verify_baseline_command_chain_includes_required_stages_in_order():
    scripts = _scripts()
    baseline_cmd = scripts.get("verify:baseline")
    assert baseline_cmd is not None

    segments = [segment.strip() for segment in baseline_cmd.split("&&")]
    assert segments == [
        "npm run lint",
        "npm run build",
        "npm run verify:frontend",
        "npm run verify:backend:sales",
        "npm run verify:smoke:campaign",
        "npm run verify:smoke:schema-gate",
        "npm run verify:smoke:release-gate",
        "npm run verify:release-gate:artifact:contract",
        "npm run verify:smoke",
    ]


def test_verify_ci_sales_chain_includes_baseline_and_metrics_contract():
    scripts = _scripts()
    assert scripts.get("verify:ci:sales") == "npm run verify:baseline && npm run verify:baseline:metrics"


def test_package_scripts_include_connector_docs_and_canary_dry_run_wrappers():
    scripts = _scripts()
    assert scripts.get("verify:docs:sales:connectors") == "bash backend/scripts/run_docs_connector_runbook_contracts.sh"
    assert (
        scripts.get("verify:docs:sales")
        == "npm run verify:docs:sales:connectors && npm run verify:docs:sales:predictive"
    )
    assert (
        scripts.get("verify:smoke:canary-dry-run")
        == "bash backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh"
    )


def test_package_scripts_include_sales_smoke_and_extended_ci_wrappers():
    scripts = _scripts()
    assert scripts.get("verify:smoke:sales") == "bash backend/scripts/run_smoke_sales_suite.sh"
    assert (
        scripts.get("verify:ci:sales:extended")
        == "npm run verify:ci:sales && npm run verify:docs:sales && npm run verify:smoke:canary-dry-run && npm run verify:release-gate:artifact:fixtures && npm run verify:telemetry:traceability && npm run verify:telemetry:traceability:cleanup:policy && npm run verify:smoke:traceability-ci-guard && npm run verify:smoke:traceability-governance-handoff"
    )
    assert (
        scripts.get("verify:release-gate:artifact:contract")
        == ".venv311/bin/python backend/scripts/validate_connector_release_gate_artifact.py --artifact backend/test_reports/connector_release_gate_result.json"
    )
    assert scripts.get("verify:release-gate:artifact:fixtures") == "bash backend/scripts/run_release_gate_artifact_fixture_checks.sh"
    assert (
        scripts.get("verify:telemetry:traceability:fixture")
        == ".venv311/bin/python backend/scripts/generate_connector_telemetry_snapshot_fixture.py --output backend/test_reports/connector-telemetry-summary-snapshot.json"
    )
    assert (
        scripts.get("verify:telemetry:traceability:contract")
        == ".venv311/bin/python backend/scripts/validate_connector_telemetry_snapshot.py --snapshot backend/test_reports/connector-telemetry-summary-snapshot.json"
    )
    assert (
        scripts.get("verify:telemetry:traceability:retention")
        == ".venv311/bin/python backend/scripts/validate_connector_telemetry_snapshot_retention.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --min-count 1 --max-age-days 30"
    )
    assert (
        scripts.get("verify:telemetry:traceability:cleanup:dry-run")
        == ".venv311/bin/python backend/scripts/cleanup_connector_telemetry_snapshots.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --keep-days 30 --keep-min-count 1"
    )
    assert (
        scripts.get("verify:telemetry:traceability:cleanup:policy")
        == ".venv311/bin/python backend/scripts/evaluate_connector_telemetry_cleanup_policy.py --snapshot-dir backend/test_reports --prefix connector-telemetry-summary --keep-days 30 --keep-min-count 1 --max-apply-candidates 20"
    )
    assert (
        scripts.get("verify:telemetry:traceability")
        == "npm run verify:telemetry:traceability:fixture && npm run verify:telemetry:traceability:contract && npm run verify:telemetry:traceability:retention"
    )
    assert (
        scripts.get("verify:smoke:traceability-ci-guard")
        == ".venv311/bin/python -m pytest -q backend/tests/test_traceability_ci_failure_smoke.py"
    )
    assert (
        scripts.get("verify:smoke:traceability-governance-handoff")
        == ".venv311/bin/python -m pytest -q backend/tests/test_traceability_governance_handoff_smoke.py"
    )
