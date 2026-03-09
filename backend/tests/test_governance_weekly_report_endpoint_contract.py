from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations
from pathlib import Path
from datetime import datetime, timedelta, timezone
import json
import tempfile


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc

    async def find_one(self, _flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

    async def insert_one(self, _doc):
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

    def sort(self, _field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda item: item.get("createdAt", ""), reverse=reverse)
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


def _write_packet_validation_artifact(path: Path, validated_at: datetime, valid: bool = True):
    path.write_text(
        json.dumps(
            {
                "validatedAt": validated_at.isoformat(),
                "checks": {},
                "errors": [] if valid else ["invalid"],
                "valid": valid,
            }
        ),
        encoding="utf-8",
    )


def test_governance_weekly_report_response_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "r1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-1"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "r2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-2"},
                "createdAt": _recent_iso(9),
            },
            {
                "id": "r3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": "PASS", "request_id": "req-3"},
                "createdAt": _recent_iso(8),
            },
            {
                "id": "r4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "apollo_search",
                    "retry_after_seconds": 46,
                    "reset_in_seconds": 44,
                },
                "createdAt": _recent_iso(7),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()

    assert isinstance(payload.get("generatedAt"), str)
    assert payload.get("governanceType") == "weekly_report"
    assert isinstance(payload.get("exportSchemaVersion"), int)
    assert payload.get("windowDays") == 7
    assert payload.get("eventLimit") == 500
    assert isinstance(payload.get("status"), str)
    assert isinstance(payload.get("alerts"), list)
    assert isinstance(payload.get("handoff"), dict)
    assert isinstance(payload.get("totals"), dict)
    assert isinstance(payload.get("reasonCodes"), list)
    assert isinstance(payload.get("reasonCodeCount"), int)
    assert payload.get("reasonCodeCount") == len(payload.get("reasonCodes") or [])
    assert isinstance(payload.get("connectorRateLimit"), dict)
    assert isinstance(payload.get("connectorPressureParity"), dict)
    assert isinstance(payload.get("sendgridWebhookTimestamp"), dict)
    assert isinstance(payload.get("sendgridWebhookTimestampParity"), dict)
    assert isinstance(payload.get("governanceStatusCounts"), dict)
    assert isinstance(payload.get("traceabilityDecisionCounts"), dict)
    assert isinstance(payload.get("timeline"), list)
    assert isinstance(payload.get("latestEvents"), list)
    assert isinstance(payload.get("ownerActionMatrix"), list)
    assert isinstance(payload.get("recommendedCommands"), list)
    assert isinstance(payload.get("recommendedCommandCount"), int)
    assert payload.get("recommendedCommandCount") == len(
        payload.get("recommendedCommands") or []
    )
    assert isinstance(payload.get("governanceExport"), dict)
    assert isinstance(payload["governanceExport"].get("connectorRateLimit"), dict)
    assert isinstance(payload.get("runtimePrereqs"), dict)
    assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
    assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
        "runtimePrereqs"
    )
    assert isinstance(payload["governanceExport"].get("recommendedCommands"), list)
    assert payload["governanceExport"].get("recommendedCommands") == payload.get(
        "recommendedCommands"
    )
    assert isinstance(payload["governanceExport"].get("recommendedCommandCount"), int)
    assert payload["governanceExport"].get("recommendedCommandCount") == payload.get(
        "recommendedCommandCount"
    )
    assert isinstance(payload["governanceExport"].get("reasonCodes"), list)
    assert payload["governanceExport"].get("reasonCodes") == payload.get("reasonCodes")
    assert isinstance(payload["governanceExport"].get("reasonCodeCount"), int)
    assert payload["governanceExport"].get("reasonCodeCount") == payload.get(
        "reasonCodeCount"
    )
    assert isinstance(payload["governanceExport"].get("exportSchemaVersion"), int)
    assert payload["governanceExport"].get("exportSchemaVersion") == payload.get(
        "exportSchemaVersion"
    )
    assert payload.get("requestedBy") == "u1"
    assert payload["handoff"].get("ownerRole") == "Release Manager"
    assert isinstance(payload["handoff"].get("rolloutBlocked"), bool)
    assert isinstance(payload["handoff"].get("actions"), list)
    assert payload["governanceExport"].get("governanceType") == "weekly_report"
    assert payload["governanceExport"].get("requestedBy") == "u1"

    totals = payload["totals"]
    assert isinstance(totals.get("governanceEventCount"), int)
    assert isinstance(totals.get("traceabilityEvaluationCount"), int)
    assert isinstance(totals.get("snapshotEvaluationCount"), int)
    assert isinstance(totals.get("baselineEvaluationCount"), int)
    assert isinstance(totals.get("actionRequiredCount"), int)
    assert isinstance(totals.get("connectorRateLimitEventCount"), int)
    assert isinstance(totals.get("rolloutBlockedCount"), int)
    connector_rate_limit = payload["connectorRateLimit"]
    assert isinstance(connector_rate_limit.get("eventCount"), int)
    assert isinstance(connector_rate_limit.get("byEndpoint"), dict)
    assert isinstance(connector_rate_limit.get("pressure"), dict)
    assert isinstance(connector_rate_limit["pressure"].get("label"), str)
    assert isinstance(connector_rate_limit["pressure"].get("signalSeconds"), (int, float))
    connector_pressure_parity = payload["connectorPressureParity"]
    assert connector_pressure_parity.get("eventCountMatchesNested") is True
    assert connector_pressure_parity.get("eventCountMatchesTotals") is True
    assert connector_pressure_parity.get("byEndpointMatchesNested") is True
    assert connector_pressure_parity.get("pressureLabelMatchesNested") is True
    sendgrid_webhook_timestamp_parity = payload["sendgridWebhookTimestampParity"]
    assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesNested") is True
    assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesTotals") is True
    assert (
        sendgrid_webhook_timestamp_parity.get("anomalyCountTotalMatchesNested")
        is True
    )
    assert (
        sendgrid_webhook_timestamp_parity.get("pressureLabelCountsMatchNested")
        in (True, None)
    )
    assert sendgrid_webhook_timestamp_parity.get("ageBucketCountsMatchNested") in (
        True,
        None,
    )
    runtime_prereqs = payload["runtimePrereqs"]
    assert isinstance(runtime_prereqs.get("present"), bool)
    assert isinstance(runtime_prereqs.get("available"), bool)
    assert runtime_prereqs.get("passed") in (True, False, None)
    assert runtime_prereqs.get("contractValid") in (True, False, None)
    assert runtime_prereqs.get("valid") in (True, False, None)
    assert isinstance(runtime_prereqs.get("missingCheckCount"), int)
    assert isinstance(runtime_prereqs.get("missingChecks"), dict)
    assert isinstance(
        (runtime_prereqs.get("missingChecks") or {}).get("commands", []), list
    )
    assert isinstance(
        (runtime_prereqs.get("missingChecks") or {}).get("workspace", []), list
    )
    assert payload["governanceExport"]["runtimePrereqs"] == runtime_prereqs

    if payload["timeline"]:
        row = payload["timeline"][0]
        assert isinstance(row.get("date"), str)
        assert isinstance(row.get("traceabilityEvents"), int)
        assert isinstance(row.get("snapshotGovernanceEvents"), int)
        assert isinstance(row.get("baselineGovernanceEvents"), int)
        assert isinstance(row.get("actionRequiredEvents"), int)
        assert isinstance(row.get("holdDecisions"), int)
        assert isinstance(row.get("proceedDecisions"), int)
        assert isinstance(row.get("statusCounts"), dict)

    if payload["ownerActionMatrix"]:
        action = payload["ownerActionMatrix"][0]
        assert isinstance(action.get("priority"), str)
        assert isinstance(action.get("severity"), str)
        assert isinstance(action.get("ownerRole"), str)
        assert isinstance(action.get("trigger"), str)
        assert isinstance(action.get("action"), str)
        assert isinstance(action.get("command"), str)


def test_governance_weekly_report_normalizes_malformed_decision_and_status_tokens(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "norm-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": " hold ", "request_id": "req-hold"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "norm-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "blocked-now", "request_id": "req-unknown-decision"},
                "createdAt": _recent_iso(9),
            },
            {
                "id": "norm-3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": " fail ", "request_id": "req-fail"},
                "createdAt": _recent_iso(8),
            },
            {
                "id": "norm-4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": {"unexpected": "value"}, "request_id": "req-unknown-status"},
                "createdAt": _recent_iso(7),
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
    assert payload["traceabilityDecisionCounts"]["HOLD"] == 1
    assert payload["traceabilityDecisionCounts"]["UNKNOWN"] == 1
    assert payload["governanceStatusCounts"]["FAIL"] == 1
    assert payload["governanceStatusCounts"]["UNKNOWN"] == 1
    allowed_decision_tokens = {"HOLD", "PROCEED", "UNKNOWN"}
    assert set(payload["traceabilityDecisionCounts"].keys()).issubset(
        allowed_decision_tokens
    )
    allowed_governance_tokens = {"READY", "ACTION_REQUIRED", "PASS", "FAIL", "UNKNOWN"}
    assert set(payload["governanceStatusCounts"].keys()).issubset(
        allowed_governance_tokens
    )
    if payload["timeline"]:
        status_counts = payload["timeline"][0].get("statusCounts") or {}
        assert set(status_counts.keys()).issubset(allowed_governance_tokens)
    latest_by_request_id = {
        row.get("requestId"): row for row in payload.get("latestEvents") or []
    }
    assert latest_by_request_id["req-hold"]["decision"] == "HOLD"
    assert latest_by_request_id["req-unknown-decision"]["decision"] == "UNKNOWN"
    assert latest_by_request_id["req-fail"]["status"] == "FAIL"
    assert latest_by_request_id["req-unknown-status"]["status"] == "UNKNOWN"


def test_governance_weekly_report_export_response_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "r1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-1"},
                "createdAt": _recent_iso(10),
            },
            {
                "id": "r2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-2"},
                "createdAt": _recent_iso(9),
            },
            {
                "id": "r3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "company_enrichment_orchestration",
                    "retry_after_seconds": 22,
                    "reset_in_seconds": 21,
                },
                "createdAt": _recent_iso(8),
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("generatedAt"), str)
    assert payload.get("governanceType") == "weekly_report"
    assert isinstance(payload.get("exportSchemaVersion"), int)
    assert payload.get("windowDays") == 7
    assert payload.get("eventLimit") == 500
    assert isinstance(payload.get("status"), str)
    assert isinstance(payload.get("totals"), dict)
    assert isinstance(payload.get("connectorRateLimit"), dict)
    assert isinstance(payload.get("connectorPressureParity"), dict)
    assert isinstance(payload.get("sendgridWebhookTimestamp"), dict)
    assert isinstance(payload.get("sendgridWebhookTimestampParity"), dict)
    assert isinstance(payload.get("reasonCodes"), list)
    assert isinstance(payload.get("reasonCodeCount"), int)
    assert payload.get("reasonCodeCount") == len(payload.get("reasonCodes") or [])
    assert isinstance(payload.get("recommendedCommands"), list)
    assert isinstance(payload.get("recommendedCommandCount"), int)
    assert payload.get("recommendedCommandCount") == len(
        payload.get("recommendedCommands") or []
    )
    assert isinstance(payload.get("governanceExport"), dict)
    assert isinstance(payload["governanceExport"].get("recommendedCommands"), list)
    assert payload["governanceExport"].get("recommendedCommands") == payload.get(
        "recommendedCommands"
    )
    assert isinstance(payload["governanceExport"].get("recommendedCommandCount"), int)
    assert payload["governanceExport"].get("recommendedCommandCount") == payload.get(
        "recommendedCommandCount"
    )
    assert isinstance(payload["governanceExport"].get("reasonCodes"), list)
    assert payload["governanceExport"].get("reasonCodes") == payload.get("reasonCodes")
    assert isinstance(payload["governanceExport"].get("reasonCodeCount"), int)
    assert payload["governanceExport"].get("reasonCodeCount") == payload.get(
        "reasonCodeCount"
    )
    assert isinstance(payload["governanceExport"].get("exportSchemaVersion"), int)
    assert payload["governanceExport"].get("exportSchemaVersion") == payload.get(
        "exportSchemaVersion"
    )
    assert isinstance(payload.get("runtimePrereqs"), dict)
    assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
    assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
        "runtimePrereqs"
    )
    assert payload.get("requestedBy") == "u1"
    assert payload["governanceExport"].get("governanceType") == "weekly_report"
    assert isinstance(payload["governanceExport"].get("rolloutBlocked"), bool)
    assert isinstance(payload["governanceExport"].get("connectorRateLimit"), dict)
    assert payload["connectorPressureParity"].get("eventCountMatchesNested") is True
    assert payload["connectorPressureParity"].get("eventCountMatchesTotals") is True
    assert payload["connectorPressureParity"].get("byEndpointMatchesNested") is True
    assert payload["connectorPressureParity"].get("pressureLabelMatchesNested") is True
    assert payload["sendgridWebhookTimestampParity"].get("eventCountMatchesNested") is True
    assert payload["sendgridWebhookTimestampParity"].get("eventCountMatchesTotals") is True
    assert (
        payload["sendgridWebhookTimestampParity"].get("anomalyCountTotalMatchesNested")
        is True
    )
    assert (
        payload["sendgridWebhookTimestampParity"].get("pressureLabelCountsMatchNested")
        in (True, None)
    )
    assert (
        payload["sendgridWebhookTimestampParity"].get("ageBucketCountsMatchNested")
        in (True, None)
    )
    assert isinstance(payload["runtimePrereqs"].get("present"), bool)
    assert isinstance(payload["runtimePrereqs"].get("available"), bool)
    assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)


def test_governance_weekly_report_history_response_contract(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        recent_path = tmp_path / "connector_governance_weekly_report_recent.json"
        stale_path = tmp_path / "connector_governance_weekly_report_stale.json"
        recent_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "latestEventAt": "2026-02-22T00:00:00+00:00",
                            "maxRetryAfterSeconds": 31,
                            "avgRetryAfterSeconds": 30,
                            "maxResetInSeconds": 30,
                            "avgResetInSeconds": 29.5,
                        },
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {
                                "commands": [],
                                "workspace": [],
                            },
                            "artifactPath": "backend/test_reports/sales_runtime_prereqs_recent.json",
                            "generatedAt": "2026-02-22T00:00:00+00:00",
                            "validatedAt": "2026-02-22T00:05:00+00:00",
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                    },
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        stale_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2025-12-01T00:00:00+00:00",
                    "summary": {
                        "rolloutBlocked": True,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"company_enrichment_orchestration": 1},
                            "latestEventAt": "2025-12-01T00:00:00+00:00",
                            "maxRetryAfterSeconds": 47,
                            "avgRetryAfterSeconds": 47,
                            "maxResetInSeconds": 45,
                            "avgResetInSeconds": 45,
                        },
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": False,
                            "contractValid": True,
                            "valid": False,
                            "missingCheckCount": 1,
                            "missingChecks": {
                                "commands": ["node"],
                                "workspace": [],
                            },
                            "artifactPath": "backend/test_reports/sales_runtime_prereqs_stale.json",
                            "generatedAt": "2025-12-01T00:00:00+00:00",
                            "validatedAt": "2025-12-01T00:05:00+00:00",
                            "command": "npm run verify:smoke:runtime-prereqs-artifact",
                        },
                    },
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "status": "ACTION_REQUIRED",
                        "rolloutBlocked": True,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert isinstance(payload.get("generatedAt"), str)
        assert payload.get("governanceType") == "weekly_report_history"
        assert isinstance(payload.get("exportSchemaVersion"), int)
        assert payload.get("retentionDays") == 30
        assert payload.get("limit") == 50
        assert isinstance(payload.get("artifactDirectory"), str)
        assert isinstance(payload.get("artifactPrefix"), str)
        assert isinstance(payload.get("artifactCount"), int)
        assert isinstance(payload.get("staleCount"), int)
        assert isinstance(payload.get("rolloutBlockedCount"), int)
        assert isinstance(payload.get("totals"), dict)
        assert isinstance(payload.get("connectorRateLimit"), dict)
        assert isinstance(payload.get("connectorPressureParity"), dict)
        assert isinstance(payload.get("sendgridWebhookTimestamp"), dict)
        assert isinstance(payload.get("sendgridWebhookTimestampParity"), dict)
        assert isinstance(payload.get("items"), list)
        assert isinstance(payload.get("governancePacketValidation"), dict)
        assert isinstance(payload.get("status"), str)
        assert isinstance(payload.get("alerts"), list)
        assert isinstance(payload.get("handoff"), dict)
        assert isinstance(payload.get("reasonCodes"), list)
        assert isinstance(payload.get("reasonCodeCount"), int)
        assert payload.get("reasonCodeCount") == len(payload.get("reasonCodes") or [])
        assert isinstance(payload.get("recommendedCommands"), list)
        assert isinstance(payload.get("recommendedCommandCount"), int)
        assert payload.get("recommendedCommandCount") == len(
            payload.get("recommendedCommands") or []
        )
        assert isinstance(payload.get("governanceExport"), dict)
        assert isinstance(payload["governanceExport"].get("connectorRateLimit"), dict)
        assert isinstance(payload.get("runtimePrereqs"), dict)
        assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
        assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
            "runtimePrereqs"
        )
        assert isinstance(payload["governanceExport"].get("recommendedCommands"), list)
        assert payload["governanceExport"].get("recommendedCommands") == payload.get(
            "recommendedCommands"
        )
        assert isinstance(payload["governanceExport"].get("recommendedCommandCount"), int)
        assert payload["governanceExport"].get("recommendedCommandCount") == payload.get(
            "recommendedCommandCount"
        )
        assert isinstance(payload["governanceExport"].get("reasonCodes"), list)
        assert payload["governanceExport"].get("reasonCodes") == payload.get("reasonCodes")
        assert isinstance(payload["governanceExport"].get("reasonCodeCount"), int)
        assert payload["governanceExport"].get("reasonCodeCount") == payload.get(
            "reasonCodeCount"
        )
        assert isinstance(payload["governanceExport"].get("exportSchemaVersion"), int)
        assert payload["governanceExport"].get("exportSchemaVersion") == payload.get(
            "exportSchemaVersion"
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
        assert payload.get("requestedBy") == "u1"
        packet_validation = payload["governancePacketValidation"]
        assert isinstance(packet_validation.get("path"), str)
        assert isinstance(packet_validation.get("exists"), bool)
        assert isinstance(packet_validation.get("status"), str)
        assert isinstance(packet_validation.get("freshnessWindowHours"), float)
        connector_rate_limit = payload["connectorRateLimit"]
        assert isinstance(connector_rate_limit.get("eventCount"), int)
        assert isinstance(connector_rate_limit.get("byEndpoint"), dict)
        assert isinstance(connector_rate_limit.get("pressure"), dict)
        assert isinstance(connector_rate_limit["pressure"].get("label"), str)
        assert isinstance(
            payload["totals"].get("connectorRateLimitEventCount"), int
        )
        assert (
            payload["totals"].get("connectorRateLimitEventCount")
            == connector_rate_limit.get("eventCount")
        )
        connector_pressure_parity = payload["connectorPressureParity"]
        assert connector_pressure_parity.get("eventCountMatchesNested") is True
        assert connector_pressure_parity.get("eventCountMatchesTotals") is True
        assert connector_pressure_parity.get("byEndpointMatchesNested") is True
        assert connector_pressure_parity.get("pressureLabelMatchesNested") is True
        sendgrid_webhook_timestamp_parity = payload["sendgridWebhookTimestampParity"]
        assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesNested") is True
        assert sendgrid_webhook_timestamp_parity.get("eventCountMatchesTotals") is True
        assert (
            sendgrid_webhook_timestamp_parity.get("anomalyCountTotalMatchesNested")
            is True
        )
        assert (
            sendgrid_webhook_timestamp_parity.get("pressureLabelCountsMatchNested")
            in (True, None)
        )
        assert sendgrid_webhook_timestamp_parity.get("ageBucketCountsMatchNested") in (
            True,
            None,
        )
        runtime_prereqs = payload["runtimePrereqs"]
        assert isinstance(runtime_prereqs.get("present"), bool)
        assert isinstance(runtime_prereqs.get("available"), bool)
        assert runtime_prereqs.get("passed") in (True, False, None)
        assert isinstance(runtime_prereqs.get("missingCheckCount"), int)
        assert isinstance(runtime_prereqs.get("missingChecks"), dict)
        assert runtime_prereqs.get("failingArtifactCount") == 1
        assert runtime_prereqs.get("historyArtifactCount") == 2
        assert isinstance(packet_validation.get("withinFreshnessWindow"), bool)
        assert isinstance(packet_validation.get("valid"), bool)
        assert isinstance(packet_validation.get("issues"), list)
        assert packet_validation.get("status") == "READY"
        assert packet_validation.get("withinFreshnessWindow") is True
        if payload["items"]:
            item = payload["items"][0]
            assert isinstance(item.get("file"), str)
            assert isinstance(item.get("name"), str)
            assert isinstance(item.get("exportSchemaVersion"), int)
            assert isinstance(item.get("sizeBytes"), int)
            assert isinstance(item.get("withinRetention"), bool)
            assert isinstance(item.get("rolloutBlocked"), bool)


def test_governance_weekly_report_history_normalizes_malformed_artifact_status_tokens(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        explicit_status_path = (
            tmp_path / "connector_governance_weekly_report_explicit_status.json"
        )
        explicit_status_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"rolloutBlocked": True},
                    "governanceExport": {
                        "status": " action required ",
                        "rolloutBlocked": True,
                    },
                }
            ),
            encoding="utf-8",
        )
        fallback_status_path = (
            tmp_path / "connector_governance_weekly_report_fallback_status.json"
        )
        fallback_status_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"rolloutBlocked": False},
                    "governanceExport": {
                        "status": "review-needed",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        by_name = {item["name"]: item for item in payload["items"]}
        assert (
            by_name["connector_governance_weekly_report_explicit_status.json"][
                "status"
            ]
            == "ACTION_REQUIRED"
        )
        assert (
            by_name["connector_governance_weekly_report_fallback_status.json"][
                "status"
            ]
            == "READY"
        )
        allowed_status_tokens = {
            "READY",
            "ACTION_REQUIRED",
            "PASS",
            "FAIL",
            "UNKNOWN",
            "INVALID",
        }
        assert set(item.get("status") for item in payload["items"]).issubset(
            allowed_status_tokens
        )


def test_governance_weekly_report_history_contract_handles_malformed_generated_at_and_export_shape(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        malformed_ts_path = tmp_path / "connector_governance_weekly_report_malformed_ts.json"
        malformed_ts_path.write_text(
            json.dumps(
                {
                    "generatedAt": "not-a-timestamp",
                    "summary": {"rolloutBlocked": False},
                }
            ),
            encoding="utf-8",
        )
        non_dict_export_path = tmp_path / "connector_governance_weekly_report_non_dict_export.json"
        non_dict_export_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": "invalid-shape",
                }
            ),
            encoding="utf-8",
        )
        blocked_summary_path = tmp_path / "connector_governance_weekly_report_blocked_summary.json"
        blocked_summary_path.write_text(
            json.dumps(
                {
                    "generatedAt": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
                    "summary": {"rolloutBlocked": True},
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["artifactCount"] == 3
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["staleCount"] >= 1
        assert payload["rolloutBlockedCount"] >= 1
        by_name = {item["name"]: item for item in payload["items"]}
        malformed_item = by_name["connector_governance_weekly_report_malformed_ts.json"]
        assert malformed_item["generatedAt"] is None
        assert malformed_item["withinRetention"] is False
        non_dict_item = by_name["connector_governance_weekly_report_non_dict_export.json"]
        assert non_dict_item["status"] == "INVALID"
        assert non_dict_item["rolloutBlocked"] is True
        blocked_item = by_name["connector_governance_weekly_report_blocked_summary.json"]
        assert blocked_item["status"] == "ACTION_REQUIRED"
        assert blocked_item["rolloutBlocked"] is True


def test_governance_weekly_report_history_contract_handles_malformed_connector_rollup_payloads(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        fallback_path = (
            tmp_path / "connector_governance_weekly_report_connector_fallback.json"
        )
        fallback_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": "invalid-shape",
                    },
                    "connectorRateLimit": {
                        "eventCount": 4,
                        "byEndpoint": {
                            "apollo_search": 3,
                            "clearbit_company": 1,
                        },
                        "latestEventAt": "2026-02-22T00:01:00+00:00",
                        "maxRetryAfterSeconds": 41,
                        "avgRetryAfterSeconds": 30,
                        "maxResetInSeconds": 23,
                        "avgResetInSeconds": 22,
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        sparse_path = (
            tmp_path / "connector_governance_weekly_report_connector_sparse.json"
        )
        sparse_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": {
                            "eventCount": -5,
                            "byEndpoint": {"company_enrichment_orchestration": 2},
                            "latestEventAt": "2026-02-22T00:02:00+00:00",
                            "maxRetryAfterSeconds": 20,
                            "avgRetryAfterSeconds": 20,
                            "maxResetInSeconds": 19,
                            "avgResetInSeconds": 19,
                        },
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "READY"
        connector_rate_limit = payload["connectorRateLimit"]
        assert connector_rate_limit["eventCount"] == 6
        assert connector_rate_limit["byEndpoint"]["apollo_search"] == 3
        assert connector_rate_limit["byEndpoint"]["clearbit_company"] == 1
        assert connector_rate_limit["byEndpoint"]["company_enrichment_orchestration"] == 2
        assert connector_rate_limit["pressure"]["label"] == "Moderate"
        assert connector_rate_limit["latestEventAt"] == "2026-02-22T00:02:00+00:00"


def test_governance_weekly_report_history_contract_normalizes_connector_by_endpoint_keys(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        artifact_path = (
            tmp_path / "connector_governance_weekly_report_connector_key_normalization.json"
        )
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": {
                            "eventCount": -4,
                            "byEndpoint": {
                                " Apollo Search ": 1,
                                "APOLLO-SEARCH": 2,
                                " clearbit.company ": 3,
                                "": 4,
                                "   ": 5,
                                "company enrichment orchestration": 6,
                            },
                            "latestEventAt": "2026-02-22T00:05:00+00:00",
                            "maxRetryAfterSeconds": 52,
                            "avgRetryAfterSeconds": 33,
                            "maxResetInSeconds": 51,
                            "avgResetInSeconds": 30,
                        },
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        connector_rate_limit = payload["connectorRateLimit"]
        assert connector_rate_limit["eventCount"] == 21
        assert connector_rate_limit["byEndpoint"]["apollo_search"] == 3
        assert connector_rate_limit["byEndpoint"]["clearbit_company"] == 3
        assert connector_rate_limit["byEndpoint"]["company_enrichment_orchestration"] == 6
        assert connector_rate_limit["byEndpoint"]["unknown"] == 9
        assert connector_rate_limit["pressure"]["label"] == "High"
        assert connector_rate_limit["latestEventAt"] == "2026-02-22T00:05:00+00:00"


def test_governance_weekly_report_history_contract_detects_duplicate_logical_artifact_names(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        shared_name = "connector_governance_weekly_report_shared.json"
        first_path = tmp_path / "connector_governance_weekly_report_a.json"
        second_path = tmp_path / "connector_governance_weekly_report_b.json"
        first_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "artifactName": shared_name,
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        second_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "artifactName": shared_name,
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
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert shared_name in payload["duplicateArtifactNames"]
        assert payload["governanceExport"]["rolloutBlocked"] is True
        assert any(
            "duplicate artifact names" in str(message).lower()
            for message in payload.get("alerts", [])
        )


def test_governance_weekly_report_history_contract_marks_invalid_json_artifacts(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        valid_path = tmp_path / "connector_governance_weekly_report_recent.json"
        valid_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        invalid_path = tmp_path / "connector_governance_weekly_report_invalid.json"
        invalid_path.write_text("{invalid", encoding="utf-8")
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        by_name = {item["name"]: item for item in payload["items"]}
        assert by_name["connector_governance_weekly_report_invalid.json"]["status"] == "INVALID"
        assert by_name["connector_governance_weekly_report_invalid.json"]["withinRetention"] is False


def test_governance_weekly_report_history_contract_marks_non_object_json_artifacts_invalid(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        valid_path = tmp_path / "connector_governance_weekly_report_recent.json"
        valid_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        non_object_path = tmp_path / "connector_governance_weekly_report_non_object.json"
        non_object_path.write_text(json.dumps(["invalid-root"]), encoding="utf-8")
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        by_name = {item["name"]: item for item in payload["items"]}
        non_object_item = by_name["connector_governance_weekly_report_non_object.json"]
        assert non_object_item["status"] == "INVALID"
        assert non_object_item["rolloutBlocked"] is True


def test_governance_weekly_history_contract_flags_stale_packet_validation_artifact(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        ready_path = tmp_path / "connector_governance_weekly_report_ready.json"
        ready_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc) - timedelta(days=14),
            valid=True,
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
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert "verify:governance:packet:contract" in " ".join(payload["recommendedCommands"])
        packet_validation = payload["governancePacketValidation"]
        assert packet_validation["status"] == "ACTION_REQUIRED"
        assert packet_validation["withinFreshnessWindow"] is False
        assert isinstance(packet_validation["ageHours"], float)
        assert packet_validation["ageHours"] > 0


def test_governance_weekly_history_contract_flags_missing_packet_validation_artifact(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        ready_path = tmp_path / "connector_governance_weekly_report_ready.json"
        ready_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        missing_packet_path = tmp_path / "missing_governance_packet_validation.json"

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            missing_packet_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        packet_validation = payload["governancePacketValidation"]
        assert packet_validation["exists"] is False
        assert packet_validation["status"] == "ACTION_REQUIRED"
        assert packet_validation["withinFreshnessWindow"] is False
        assert any("missing" in str(issue).lower() for issue in packet_validation["issues"])


def test_governance_weekly_history_contract_flags_invalid_packet_validation_payload_variants(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        ready_path = tmp_path / "connector_governance_weekly_report_ready.json"
        ready_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"

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

        variants = [
            ("{invalid", "not valid json"),
            (json.dumps([]), "json object"),
            (
                json.dumps(
                    {
                        "valid": True,
                        "checks": {},
                        "errors": [],
                    }
                ),
                "validatedat",
            ),
            (
                json.dumps(
                    {
                        "valid": False,
                        "checks": {},
                        "errors": [],
                        "validatedAt": datetime.now(timezone.utc).isoformat(),
                    }
                ),
                "valid=true",
            ),
        ]

        for payload_text, expected_issue_fragment in variants:
            packet_validation_path.write_text(payload_text, encoding="utf-8")
            response = client.get(
                "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
            )
            assert response.status_code == 200
            payload = response.json()
            assert payload["status"] == "ACTION_REQUIRED"
            packet_validation = payload["governancePacketValidation"]
            assert packet_validation["status"] == "ACTION_REQUIRED"
            issues_text = " ".join(packet_validation["issues"]).lower()
            assert expected_issue_fragment in issues_text
