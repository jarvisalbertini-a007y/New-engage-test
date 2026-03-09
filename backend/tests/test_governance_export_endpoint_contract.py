import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


ALLOWED_GOVERNANCE_STATUS_TOKENS = {"READY", "ACTION_REQUIRED", "PASS", "FAIL", "UNKNOWN"}
ALLOWED_TRACEABILITY_DECISION_TOKENS = {"PROCEED", "HOLD", "UNKNOWN"}


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []

    async def find_one(self, _flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}

    def find(self, flt, *_args, **_kwargs):
        docs = []
        if isinstance(self.seed_doc, list):
            docs = self.seed_doc
        user_id = flt.get("userId")
        created_at_filter = (flt.get("createdAt") or {}).get("$gte", "")
        filtered = [
            doc
            for doc in docs
            if doc.get("userId") == user_id and doc.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, _direction):
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeDb:
    def __init__(self, integration_doc=None, telemetry_docs=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc or {})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.integration_telemetry = _FakeCollection(seed_doc=telemetry_docs or [])


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def _recent_iso(minutes_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def _assert_normalized_governance_export(
    payload: dict,
    expected_type: str,
    *,
    require_connector_rate_limit: bool = False,
    require_orchestration_gate: bool = False,
    require_runtime_prereqs: bool = False,
):
    assert isinstance(payload.get("exportSchemaVersion"), int)
    assert isinstance(payload.get("schemaMetadata"), dict)
    assert isinstance(payload["schemaMetadata"].get("activeVersion"), int)
    assert isinstance(payload["schemaMetadata"].get("source"), str)
    assert isinstance(payload.get("reasonCodes"), list)
    assert isinstance(payload.get("reasonCodeCount"), int)
    assert payload.get("reasonCodeCount") == len(payload.get("reasonCodes") or [])
    assert isinstance(payload.get("recommendedCommands"), list)
    assert isinstance(payload.get("recommendedCommandCount"), int)
    assert payload.get("recommendedCommandCount") == len(
        payload.get("recommendedCommands") or []
    )
    connector_rate_limit = payload.get("connectorRateLimit")
    connector_pressure_parity = payload.get("connectorPressureParity")
    sendgrid_webhook_timestamp = payload.get("sendgridWebhookTimestamp")
    sendgrid_webhook_timestamp_parity = payload.get("sendgridWebhookTimestampParity")
    orchestration_gate = payload.get("orchestrationGate")
    if require_connector_rate_limit:
        assert isinstance(connector_rate_limit, dict)
        assert isinstance(connector_rate_limit.get("eventCount"), int)
        assert isinstance(connector_rate_limit.get("byEndpoint"), dict)
        assert isinstance(connector_rate_limit.get("pressure"), dict)
        assert isinstance(connector_rate_limit["pressure"].get("label"), str)
        assert isinstance(
            connector_rate_limit["pressure"].get("signalSeconds"), (int, float)
        )
        assert isinstance(connector_pressure_parity, dict)
        assert connector_pressure_parity.get("eventCountMatchesNested") is True
        assert connector_pressure_parity.get("eventCountMatchesTotals") is True
        assert connector_pressure_parity.get("byEndpointMatchesNested") is True
        assert connector_pressure_parity.get("pressureLabelMatchesNested") is True
        assert isinstance(sendgrid_webhook_timestamp, dict)
        assert isinstance(sendgrid_webhook_timestamp.get("eventCount"), int)
        assert isinstance(sendgrid_webhook_timestamp.get("pressureLabelCounts"), dict)
        assert isinstance(sendgrid_webhook_timestamp_parity, dict)
        assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesNested") is True
        assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesTotals") is True
        assert (
            sendgrid_webhook_timestamp_parity.get("anomalyCountTotalMatchesNested")
            is True
        )
        assert sendgrid_webhook_timestamp_parity.get(
            "pressureLabelCountsMatchNested"
        ) in (True, None)
        assert sendgrid_webhook_timestamp_parity.get("ageBucketCountsMatchNested") in (
            True,
            None,
        )
    assert payload["governanceExport"]["governanceType"] == expected_type
    assert isinstance(payload["governanceExport"].get("exportSchemaVersion"), int)
    assert (
        payload["governanceExport"]["exportSchemaVersion"]
        == payload["exportSchemaVersion"]
    )
    assert isinstance(payload["governanceExport"].get("schemaMetadata"), dict)
    assert (
        payload["governanceExport"]["schemaMetadata"].get("activeVersion")
        == payload["schemaMetadata"].get("activeVersion")
    )
    assert isinstance(payload["governanceExport"]["status"], str)
    assert payload["governanceExport"]["status"] in ALLOWED_GOVERNANCE_STATUS_TOKENS
    assert isinstance(payload["governanceExport"]["rolloutBlocked"], bool)
    assert isinstance(payload["governanceExport"]["ownerRole"], str)
    assert isinstance(payload["governanceExport"]["alerts"], list)
    assert isinstance(payload["governanceExport"]["actions"], list)
    assert isinstance(payload["governanceExport"].get("reasonCodes"), list)
    assert payload["governanceExport"].get("reasonCodes") == payload.get("reasonCodes")
    assert isinstance(payload["governanceExport"].get("reasonCodeCount"), int)
    assert payload["governanceExport"].get("reasonCodeCount") == payload.get(
        "reasonCodeCount"
    )
    assert isinstance(payload["governanceExport"].get("recommendedCommands"), list)
    assert payload["governanceExport"].get("recommendedCommands") == payload.get(
        "recommendedCommands"
    )
    assert isinstance(payload["governanceExport"].get("recommendedCommandCount"), int)
    assert payload["governanceExport"].get("recommendedCommandCount") == payload.get(
        "recommendedCommandCount"
    )
    runtime_prereqs_payload = payload.get("runtimePrereqs")
    governance_export_runtime_prereqs = payload["governanceExport"].get("runtimePrereqs")
    if require_runtime_prereqs:
        assert isinstance(runtime_prereqs_payload, dict)
        assert isinstance(governance_export_runtime_prereqs, dict)
        assert governance_export_runtime_prereqs == runtime_prereqs_payload
        assert isinstance(runtime_prereqs_payload.get("present"), bool)
        assert isinstance(runtime_prereqs_payload.get("available"), bool)
        assert runtime_prereqs_payload.get("passed") in (True, False, None)
        assert runtime_prereqs_payload.get("contractValid") in (True, False, None)
        assert runtime_prereqs_payload.get("valid") in (True, False, None)
        assert isinstance(runtime_prereqs_payload.get("missingCheckCount"), int)
        runtime_missing_checks = runtime_prereqs_payload.get("missingChecks")
        assert isinstance(runtime_missing_checks, dict)
        assert isinstance((runtime_missing_checks or {}).get("commands", []), list)
        assert isinstance((runtime_missing_checks or {}).get("workspace", []), list)
    elif runtime_prereqs_payload is not None:
        assert isinstance(runtime_prereqs_payload, dict)
        if governance_export_runtime_prereqs is not None:
            assert isinstance(governance_export_runtime_prereqs, dict)
    governance_export_connector_rate_limit = payload["governanceExport"].get(
        "connectorRateLimit"
    )
    governance_export_sendgrid_webhook_timestamp = payload["governanceExport"].get(
        "sendgridWebhookTimestamp"
    )
    governance_export_sendgrid_webhook_timestamp_parity = payload[
        "governanceExport"
    ].get("sendgridWebhookTimestampParity")
    if require_connector_rate_limit:
        assert isinstance(governance_export_connector_rate_limit, dict)
        assert (
            governance_export_connector_rate_limit.get("eventCount")
            == payload["connectorRateLimit"].get("eventCount")
        )
        assert (
            governance_export_connector_rate_limit.get("byEndpoint")
            == payload["connectorRateLimit"].get("byEndpoint")
        )
        assert (
            (governance_export_connector_rate_limit.get("pressure") or {}).get("label")
            == (payload["connectorRateLimit"].get("pressure") or {}).get("label")
        )
        totals_payload = payload.get("totals")
        if isinstance(totals_payload, dict) and isinstance(
            totals_payload.get("connectorRateLimitEventCount"), int
        ):
            assert (
                totals_payload.get("connectorRateLimitEventCount")
                == payload["connectorRateLimit"].get("eventCount")
            )
        assert isinstance(governance_export_sendgrid_webhook_timestamp, dict)
        assert governance_export_sendgrid_webhook_timestamp.get("eventCount") == payload[
            "sendgridWebhookTimestamp"
        ].get("eventCount")
        assert isinstance(governance_export_sendgrid_webhook_timestamp_parity, dict)
        assert (
            governance_export_sendgrid_webhook_timestamp_parity
            == payload.get("sendgridWebhookTimestampParity")
        )
    if require_orchestration_gate:
        assert isinstance(orchestration_gate, dict)
        assert isinstance(orchestration_gate.get("available"), bool)
        assert isinstance(
            payload["governanceExport"].get("orchestrationGate"),
            dict,
        )
        assert (
            payload["governanceExport"]["orchestrationGate"].get("available")
            == orchestration_gate.get("available")
        )
    assert isinstance(payload["governanceExport"]["evaluatedAt"], str)
    assert payload["governanceExport"]["requestedBy"] == "u1"
    assert len(payload["governanceExport"]["actions"]) >= 1
    first_action = payload["governanceExport"]["actions"][0]
    assert isinstance(first_action.get("ownerRole"), str)
    assert isinstance(first_action.get("severity"), str)
    assert isinstance(first_action.get("action"), str)
    assert isinstance(first_action.get("command"), str)
    assert isinstance(first_action.get("reasonCode"), str)
    first_alert = payload["governanceExport"]["alerts"][0]
    assert isinstance(first_alert.get("reasonCode"), str)

    top_level_status = payload.get("status")
    if isinstance(top_level_status, str):
        assert top_level_status in ALLOWED_GOVERNANCE_STATUS_TOKENS
    governance_status_counts = payload.get("governanceStatusCounts")
    if isinstance(governance_status_counts, dict):
        assert set(governance_status_counts.keys()).issubset(
            ALLOWED_GOVERNANCE_STATUS_TOKENS
        )
    traceability_decision_counts = payload.get("traceabilityDecisionCounts")
    if isinstance(traceability_decision_counts, dict):
        assert set(traceability_decision_counts.keys()).issubset(
            ALLOWED_TRACEABILITY_DECISION_TOKENS
        )
    timeline_rows = payload.get("timeline")
    if isinstance(timeline_rows, list):
        for row in timeline_rows:
            if not isinstance(row, dict):
                continue
            row_status_counts = row.get("statusCounts")
            if isinstance(row_status_counts, dict):
                assert set(row_status_counts.keys()).issubset(
                    ALLOWED_GOVERNANCE_STATUS_TOKENS
                )


def test_snapshot_governance_includes_normalized_export_contract(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        snapshot_path = tmp_path / "connector-telemetry-summary-2026-02-22.json"
        snapshot_path.write_text(
            json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat()}),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        hold_fixture = tmp_path / "connector_release_gate_result_hold.json"
        validation_fail_fixture = (
            tmp_path / "connector_release_gate_result_validation_fail.json"
        )
        for path in (pass_fixture, hold_fixture, validation_fail_fixture):
            path.write_text(json.dumps({"approved": True}), encoding="utf-8")

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": hold_fixture,
                "validation-fail": validation_fail_fixture,
            },
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        _assert_normalized_governance_export(payload, "snapshot")
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        rollout_action_reason_codes = {
            action.get("reasonCode")
            for action in payload.get("rolloutActions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert top_level_reason_codes == rollout_action_reason_codes
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes


def test_baseline_governance_includes_normalized_export_contract(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "fail",
                    "releaseGateFixturePolicy": {
                        "passed": False,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": ["validation-fail"],
                        "message": "Missing release-gate fixture profile(s): validation-fail",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": False,
                        "availableProfileCount": 2,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 1,
                        "observedAttemptErrorCount": 3,
                        "maxAttemptSkippedCountThreshold": 2,
                        "observedAttemptSkippedCount": 1,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)

        response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["handoff"]["rolloutBlocked"] is True
        _assert_normalized_governance_export(
            payload,
            "baseline",
            require_orchestration_gate=True,
        )
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        rollout_action_reason_codes = {
            action.get("reasonCode")
            for action in payload.get("rolloutActions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert "baseline_orchestration_attempt_error_failed" in top_level_reason_codes
        assert top_level_reason_codes == rollout_action_reason_codes
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes
        assert (
            payload["governanceExport"]["orchestrationGate"]["attemptErrorGatePassed"]
            is False
        )


def test_weekly_governance_report_includes_normalized_export_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "HOLD", "request_id": "req-traceability-1"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "ACTION_REQUIRED", "request_id": "req-snapshot-1"},
                "createdAt": _recent_iso(9),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["handoff"]["rolloutBlocked"] is True
    _assert_normalized_governance_export(
        payload,
        "weekly_report",
        require_connector_rate_limit=True,
        require_runtime_prereqs=True,
    )


def test_weekly_governance_report_export_includes_normalized_export_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-traceability-2"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-snapshot-2"},
                "createdAt": _recent_iso(9),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    _assert_normalized_governance_export(
        payload,
        "weekly_report",
        require_connector_rate_limit=True,
        require_runtime_prereqs=True,
    )


def test_weekly_governance_report_export_normalizes_malformed_status_tokens(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g-norm-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "review-now", "request_id": "req-traceability-norm"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "g-norm-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "needs-review", "request_id": "req-snapshot-norm"},
                "createdAt": _recent_iso(9),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "READY"
    assert payload["governanceExport"]["status"] == "READY"


def test_weekly_governance_report_history_includes_normalized_export_contract(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        recent_path = tmp_path / "connector_governance_weekly_report_recent.json"
        recent_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"rolloutBlocked": False},
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        packet_validation_path.write_text(
            json.dumps(
                {
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "checks": {},
                    "errors": [],
                    "valid": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=20"
        )
        assert response.status_code == 200
        payload = response.json()
        _assert_normalized_governance_export(
            payload,
            "weekly_report_history",
            require_connector_rate_limit=True,
            require_runtime_prereqs=True,
        )
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes


def test_governance_export_endpoints_match_signoff_attachment_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-parity-1"},
                "createdAt": _recent_iso(10),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        weekly_report_path = tmp_path / "connector_governance_weekly_report_recent.json"
        weekly_report_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"rolloutBlocked": False},
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "alerts": [],
                        "actions": [
                            {
                                "priority": "P3",
                                "severity": "info",
                                "ownerRole": "Release Manager",
                                "action": "Continue release signoff review.",
                                "trigger": "ready",
                                "command": "npm run verify:governance:weekly",
                            }
                        ],
                        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
                        "requestedBy": "u1",
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        packet_validation_path.write_text(
            json.dumps(
                {
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "checks": {},
                    "errors": [],
                    "valid": True,
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        export_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
        )
        assert export_response.status_code == 200
        export_payload = export_response.json()
        assert isinstance(export_payload.get("status"), str)
        assert bool(export_payload.get("status", "").strip())
        assert isinstance(export_payload.get("governanceExport"), dict)
        assert export_payload["governanceExport"].get("status") == export_payload.get("status")
        assert isinstance(export_payload.get("connectorPressureParity"), dict)
        assert export_payload["connectorPressureParity"].get("eventCountMatchesNested") is True
        assert export_payload["connectorPressureParity"].get("eventCountMatchesTotals") is True
        assert export_payload["connectorPressureParity"].get("byEndpointMatchesNested") is True
        assert export_payload["connectorPressureParity"].get("pressureLabelMatchesNested") is True
        assert isinstance(export_payload.get("sendgridWebhookTimestampParity"), dict)
        assert (
            export_payload["sendgridWebhookTimestampParity"].get(
                "eventCountMatchesNested"
            )
            is True
        )
        assert (
            export_payload["sendgridWebhookTimestampParity"].get(
                "eventCountMatchesTotals"
            )
            is True
        )
        assert (
            export_payload["sendgridWebhookTimestampParity"].get(
                "anomalyCountTotalMatchesNested"
            )
            is True
        )
        assert isinstance(export_payload.get("runtimePrereqs"), dict)
        assert isinstance(export_payload["governanceExport"].get("runtimePrereqs"), dict)
        assert export_payload["governanceExport"].get("runtimePrereqs") == export_payload.get(
            "runtimePrereqs"
        )
        assert isinstance(export_payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(export_payload["runtimePrereqs"].get("available"), bool)
        assert export_payload["runtimePrereqs"].get("passed") in (True, False, None)
        assert export_payload["runtimePrereqs"].get("contractValid") in (True, False, None)
        assert export_payload["runtimePrereqs"].get("valid") in (True, False, None)
        assert isinstance(export_payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(
            (export_payload["runtimePrereqs"].get("missingChecks") or {}).get(
                "commands", []
            ),
            list,
        )
        assert isinstance(
            (export_payload["runtimePrereqs"].get("missingChecks") or {}).get(
                "workspace", []
            ),
            list,
        )

        history_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=20"
        )
        assert history_response.status_code == 200
        history_payload = history_response.json()
        assert isinstance(history_payload.get("status"), str)
        assert bool(history_payload.get("status", "").strip())
        assert isinstance(history_payload.get("items"), list)
        assert isinstance(history_payload.get("governanceExport"), dict)
        assert history_payload["governanceExport"].get("status") == history_payload.get("status")
        assert isinstance(history_payload.get("connectorPressureParity"), dict)
        assert history_payload["connectorPressureParity"].get("eventCountMatchesNested") is True
        assert history_payload["connectorPressureParity"].get("eventCountMatchesTotals") is True
        assert history_payload["connectorPressureParity"].get("byEndpointMatchesNested") is True
        assert history_payload["connectorPressureParity"].get("pressureLabelMatchesNested") is True
        assert isinstance(history_payload.get("sendgridWebhookTimestampParity"), dict)
        assert (
            history_payload["sendgridWebhookTimestampParity"].get(
                "eventCountMatchesNested"
            )
            is True
        )
        assert (
            history_payload["sendgridWebhookTimestampParity"].get(
                "eventCountMatchesTotals"
            )
            is True
        )
        assert (
            history_payload["sendgridWebhookTimestampParity"].get(
                "anomalyCountTotalMatchesNested"
            )
            is True
        )
        assert isinstance(history_payload.get("runtimePrereqs"), dict)
        assert isinstance(history_payload["governanceExport"].get("runtimePrereqs"), dict)
        assert history_payload["governanceExport"].get("runtimePrereqs") == history_payload.get(
            "runtimePrereqs"
        )
        assert isinstance(history_payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(history_payload["runtimePrereqs"].get("available"), bool)
        assert history_payload["runtimePrereqs"].get("passed") in (True, False, None)
        assert history_payload["runtimePrereqs"].get("contractValid") in (True, False, None)
        assert history_payload["runtimePrereqs"].get("valid") in (True, False, None)
        assert isinstance(history_payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(
            (history_payload["runtimePrereqs"].get("missingChecks") or {}).get(
                "commands", []
            ),
            list,
        )
        assert isinstance(
            (history_payload["runtimePrereqs"].get("missingChecks") or {}).get(
                "workspace", []
            ),
            list,
        )
