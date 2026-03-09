import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_telemetry_snapshot.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_telemetry_snapshot", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload():
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "eventCount": 4,
        "byProvider": {"integrations": 1},
        "byEventType": {"integrations_traceability_status_evaluated": 1},
        "traceabilityAudit": {
            "eventCount": 1,
            "decisionCounts": {"HOLD": 1},
            "readyCount": 0,
            "notReadyCount": 1,
        },
        "governanceAudit": {
            "eventCount": 2,
            "snapshotEvaluationCount": 1,
            "baselineEvaluationCount": 1,
            "statusCounts": {"ACTION_REQUIRED": 1, "PASS": 1},
        },
        "packetValidationAudit": {
            "eventCount": 1,
            "statusCounts": {"ACTION_REQUIRED": 1},
            "withinFreshnessCount": 0,
            "outsideFreshnessCount": 1,
            "missingFreshnessCount": 0,
            "latestEvaluatedAt": "2026-02-22T00:00:00+00:00",
        },
        "connectorRateLimit": {
            "eventCount": 1,
            "byEndpoint": {"apollo_search": 1},
            "latestEventAt": "2026-02-22T00:00:00+00:00",
            "maxRetryAfterSeconds": 44,
            "avgRetryAfterSeconds": 44.0,
            "maxResetInSeconds": 43,
            "avgResetInSeconds": 43.0,
        },
        "sendgridWebhookTimestamp": {
            "eventCount": 1,
            "pressureLabelCounts": {"Moderate": 1},
            "pressureHintCounts": {"Validate event timestamp source clocks.": 1},
            "timestampFallbackCount": 1,
            "futureSkewEventCount": 0,
            "staleEventCount": 1,
            "freshEventCount": 0,
            "timestampAnomalyCountTotal": 2,
            "avgTimestampAnomalyCount": 2.0,
            "avgTimestampAnomalyRatePct": 50.0,
            "maxTimestampAnomalyRatePct": 50.0,
            "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
            "timestampAnomalyEventTypeCounts": {"open": 1, "processed": 1},
            "timestampDominantAnomalyBucketCounts": {"stale": 1},
            "timestampDominantAnomalyEventTypeCounts": {"open": 1},
            "timestampPressureHighAnomalyRatePct": 20.0,
            "timestampPressureModerateAnomalyRatePct": 5.0,
            "timestampPressureHighAnomalyCount": 10,
            "timestampPressureModerateAnomalyCount": 3,
            "latestEventAt": "2026-02-22T00:00:00+00:00",
        },
        "recentEvents": [
            {
                "eventType": "integrations_traceability_status_evaluated",
                "requestId": "req-1",
                "traceabilityDecision": "HOLD",
                "traceabilityReady": False,
                "governancePacketValidationStatus": "ACTION_REQUIRED",
                "governancePacketValidationWithinFreshness": False,
            },
            {
                "eventType": "integrations_connector_rate_limited",
                "requestId": "req-rate-limit",
                "connectorRateLimitEndpoint": "apollo_search",
                "connectorRateLimitRetryAfterSeconds": 44,
                "connectorRateLimitResetInSeconds": 43,
                "connectorRateLimitWindowSeconds": 60,
                "connectorRateLimitMaxRequests": 1,
            },
            {
                "eventType": "sendgrid_webhook_processed",
                "requestId": "req-sendgrid-1",
                "timestampPressureLabel": "Moderate",
                "timestampAnomalyCount": 2,
                "timestampAnomalyRatePct": 50.0,
                "timestampAnomalyEventTypeCounts": {"open": 1, "processed": 1},
                "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
                "futureSkewThresholdSeconds": 300,
                "staleEventAgeThresholdSeconds": 86400,
            },
        ],
    }


def test_validate_snapshot_accepts_valid_payload():
    module = _load_script_module()
    errors = module.validate_snapshot(_valid_payload())
    assert errors == []


def test_validate_snapshot_rejects_missing_traceability_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["traceabilityAudit"] = {"eventCount": 1}
    errors = module.validate_snapshot(payload)
    assert any("traceabilityAudit missing key" in error for error in errors)


def test_validate_snapshot_rejects_missing_governance_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["governanceAudit"] = {"eventCount": 2}
    errors = module.validate_snapshot(payload)
    assert any("governanceAudit missing key" in error for error in errors)


def test_validate_snapshot_rejects_missing_packet_validation_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["packetValidationAudit"] = {"eventCount": 1}
    errors = module.validate_snapshot(payload)
    assert any("packetValidationAudit missing key" in error for error in errors)


def test_validate_snapshot_rejects_missing_connector_rate_limit_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["connectorRateLimit"] = {"eventCount": 1}
    errors = module.validate_snapshot(payload)
    assert any("connectorRateLimit missing key" in error for error in errors)


def test_validate_snapshot_rejects_missing_sendgrid_webhook_timestamp_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["sendgridWebhookTimestamp"] = {"eventCount": 1}
    errors = module.validate_snapshot(payload)
    assert any("sendgridWebhookTimestamp missing key" in error for error in errors)


def test_validate_snapshot_rejects_bad_traceability_recent_event():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recentEvents"][0]["traceabilityReady"] = "false"
    errors = module.validate_snapshot(payload)
    assert any("traceabilityReady must be boolean" in error for error in errors)


def test_validate_snapshot_rejects_bad_packet_validation_recent_event():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recentEvents"][0]["governancePacketValidationWithinFreshness"] = "false"
    errors = module.validate_snapshot(payload)
    assert any(
        "governancePacketValidationWithinFreshness must be boolean or null" in error
        for error in errors
    )


def test_validate_snapshot_rejects_bad_connector_rate_limit_recent_event():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recentEvents"][1]["connectorRateLimitResetInSeconds"] = "43"
    errors = module.validate_snapshot(payload)
    assert any(
        "connector-rate-limit row 0 connectorRateLimitResetInSeconds must be integer or null"
        in error
        for error in errors
    )


def test_validate_snapshot_rejects_bad_sendgrid_recent_event_shape():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recentEvents"][2]["timestampAnomalyRatePct"] = "50%"
    errors = module.validate_snapshot(payload)
    assert any(
        "recentEvents sendgrid-webhook row 0 timestampAnomalyRatePct must be number or null"
        in error
        for error in errors
    )


def test_main_returns_nonzero_for_invalid_snapshot_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_path = Path(tmp) / "snapshot.json"
        snapshot_path.write_text(json.dumps({"eventCount": 1}), encoding="utf-8")

        class _Args:
            snapshot = str(snapshot_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
