import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_connector_telemetry_snapshot_fixture.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_telemetry_snapshot_fixture", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_contains_traceability_audit_contract_fields():
    module = _load_script_module()
    payload = module.build_fixture_payload()
    assert payload["eventCount"] == 6
    assert payload["traceabilityAudit"]["eventCount"] == 1
    assert payload["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert payload["traceabilityAudit"]["readyCount"] == 0
    assert payload["traceabilityAudit"]["notReadyCount"] == 1
    assert payload["connectorRateLimit"]["eventCount"] == 1
    assert payload["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 1
    assert payload["connectorRateLimit"]["maxRetryAfterSeconds"] == 44
    assert payload["connectorRateLimit"]["avgRetryAfterSeconds"] == 44.0
    assert payload["connectorRateLimit"]["maxResetInSeconds"] == 43
    assert payload["connectorRateLimit"]["avgResetInSeconds"] == 43.0
    assert len(payload["recentEvents"]) >= 1
    assert payload["recentEvents"][0]["eventType"] == "integrations_connector_rate_limited"
    assert payload["recentEvents"][0]["connectorRateLimitEndpoint"] == "apollo_search"
    assert payload["recentEvents"][0]["connectorRateLimitRetryAfterSeconds"] == 44
    assert payload["recentEvents"][0]["connectorRateLimitResetInSeconds"] == 43
    assert payload["recentEvents"][1]["eventType"] == "integrations_traceability_status_evaluated"
    assert payload["recentEvents"][1]["traceabilityDecision"] == "HOLD"
    assert payload["recentEvents"][1]["traceabilityReady"] is False
    assert payload["recentEvents"][1]["governancePacketValidationStatus"] == "ACTION_REQUIRED"
    assert payload["recentEvents"][1]["governancePacketValidationWithinFreshness"] is False
    assert payload["governanceAudit"]["eventCount"] == 2
    assert payload["governanceAudit"]["snapshotEvaluationCount"] == 1
    assert payload["governanceAudit"]["baselineEvaluationCount"] == 1
    assert payload["governanceAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["packetValidationAudit"]["eventCount"] == 1
    assert payload["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["packetValidationAudit"]["withinFreshnessCount"] == 0
    assert payload["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert payload["packetValidationAudit"]["missingFreshnessCount"] == 0
    assert payload["sendgridWebhookTimestamp"]["eventCount"] == 1
    assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["Moderate"] == 1
    assert payload["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"] == 2
    assert payload["sendgridWebhookTimestamp"]["timestampAgeBucketCounts"]["stale"] == 1
    assert payload["sendgridWebhookTimestamp"]["latestEventAt"] is not None
    assert payload["recentEvents"][2]["eventType"] == "sendgrid_webhook_processed"
    assert payload["recentEvents"][2]["timestampPressureLabel"] == "Moderate"
    assert payload["recentEvents"][2]["timestampAnomalyCount"] == 2


def test_main_writes_snapshot_fixture_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        output_path = Path(tmp) / "connector-telemetry-summary-snapshot.json"

        class _Args:
            output = str(output_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        payload = json.loads(output_path.read_text(encoding="utf-8"))
        assert "traceabilityAudit" in payload
        assert "packetValidationAudit" in payload
        assert "connectorRateLimit" in payload
        assert "sendgridWebhookTimestamp" in payload
