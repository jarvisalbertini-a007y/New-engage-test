import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


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
    def __init__(self, telemetry_docs=None):
        self.user_integrations = _FakeCollection(seed_doc={"userId": "u1"})
        self.integration_telemetry = _FakeCollection(seed_doc=telemetry_docs or [])
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def _write_packet_validation(path: Path):
    path.write_text(
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


def _assert_connector_rollup_contract(payload: dict):
    connector_rate_limit = payload.get("connectorRateLimit")
    assert isinstance(connector_rate_limit, dict)
    assert isinstance(connector_rate_limit.get("eventCount"), int)
    assert isinstance(connector_rate_limit.get("byEndpoint"), dict)
    assert isinstance(connector_rate_limit.get("pressure"), dict)
    assert isinstance(connector_rate_limit["pressure"].get("label"), str)


def test_governance_connector_pressure_endpoint_export_history_parity(monkeypatch):
    now = datetime.now(timezone.utc)
    docs = [
        {
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "createdAt": now.isoformat(),
            "payload": {"status": "ACTION_REQUIRED"},
        },
        {
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_baseline_governance_evaluated",
            "createdAt": now.isoformat(),
            "payload": {"status": "PASS"},
        },
        {
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "createdAt": now.isoformat(),
            "payload": {"decision": "HOLD", "is_ready": False},
        },
        {
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "createdAt": now.isoformat(),
            "payload": {
                "endpoint": "apollo_search",
                "retry_after_seconds": 46,
                "reset_in_seconds": 44,
            },
        },
        {
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "createdAt": now.isoformat(),
            "payload": {
                "endpoint": "company_enrichment_orchestration",
                "retry_after_seconds": 22,
                "reset_in_seconds": 21,
            },
        },
    ]
    fake_db = _FakeDb(telemetry_docs=docs)
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        weekly_report_path = tmp_path / "connector_governance_weekly_report_recent.json"
        weekly_report_path.write_text(
            json.dumps(
                {
                    "generatedAt": now.isoformat(),
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {
                                "apollo_search": 1,
                                "company_enrichment_orchestration": 1,
                            },
                            "latestEventAt": now.isoformat(),
                            "maxRetryAfterSeconds": 46,
                            "avgRetryAfterSeconds": 34,
                            "maxResetInSeconds": 44,
                            "avgResetInSeconds": 32,
                            "pressure": {
                                "label": "High",
                            },
                        },
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "artifactPath": "/tmp/sales_runtime_prereqs.json",
                            "generatedAt": now.isoformat(),
                            "validatedAt": now.isoformat(),
                            "command": "verify_sales_runtime_prereqs",
                        },
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "artifactPath": "/tmp/sales_runtime_prereqs.json",
                            "generatedAt": now.isoformat(),
                            "validatedAt": now.isoformat(),
                            "command": "verify_sales_runtime_prereqs",
                        },
                    },
                }
            ),
            encoding="utf-8",
        )

        packet_validation_path = tmp_path / "governance_packet_validation.json"
        _write_packet_validation(packet_validation_path)

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

        report_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500"
        )
        export_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
        )
        history_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=50"
        )

        assert report_response.status_code == 200
        assert export_response.status_code == 200
        assert history_response.status_code == 200

        report_payload = report_response.json()
        export_payload = export_response.json()
        history_payload = history_response.json()

        _assert_connector_rollup_contract(report_payload)
        _assert_connector_rollup_contract(export_payload)
        _assert_connector_rollup_contract(history_payload)
        assert isinstance(report_payload.get("runtimePrereqs"), dict)
        assert isinstance(export_payload.get("runtimePrereqs"), dict)
        assert isinstance(history_payload.get("runtimePrereqs"), dict)
        assert isinstance(report_payload["governanceExport"].get("runtimePrereqs"), dict)
        assert isinstance(export_payload["governanceExport"].get("runtimePrereqs"), dict)
        assert isinstance(history_payload["governanceExport"].get("runtimePrereqs"), dict)
        assert report_payload["governanceExport"]["runtimePrereqs"] == report_payload[
            "runtimePrereqs"
        ]
        assert export_payload["governanceExport"]["runtimePrereqs"] == export_payload[
            "runtimePrereqs"
        ]
        assert history_payload["governanceExport"]["runtimePrereqs"] == history_payload[
            "runtimePrereqs"
        ]
        assert isinstance(report_payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(export_payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(history_payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(report_payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(export_payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(history_payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(history_payload["totals"].get("runtimePrereqsFailingArtifactCount"), int)

        assert report_payload["connectorRateLimit"]["eventCount"] == report_payload["totals"][
            "connectorRateLimitEventCount"
        ]
        assert export_payload["connectorRateLimit"]["eventCount"] == export_payload[
            "totals"
        ]["connectorRateLimitEventCount"]
        assert (
            export_payload["connectorRateLimit"]["eventCount"]
            == export_payload["governanceExport"]["connectorRateLimit"]["eventCount"]
        )
        assert (
            history_payload["connectorRateLimit"]["eventCount"]
            == history_payload["governanceExport"]["connectorRateLimit"]["eventCount"]
        )
        assert isinstance(
            export_payload["governanceExport"]["connectorRateLimit"]["pressure"].get("label"),
            str,
        )
        assert isinstance(
            history_payload["governanceExport"]["connectorRateLimit"]["pressure"].get("label"),
            str,
        )
        assert len(fake_db.integration_telemetry.inserted) == 4
        export_event = fake_db.integration_telemetry.inserted[2]
        history_event = fake_db.integration_telemetry.inserted[3]
        assert export_event["eventType"] == "integrations_traceability_governance_report_exported"
        assert history_event["eventType"] == "integrations_traceability_governance_report_history_viewed"
        assert isinstance(export_event["payload"].get("runtime_prereqs_present"), bool)
        assert isinstance(export_event["payload"].get("runtime_prereqs_missing_check_count"), int)
        assert isinstance(export_event["payload"].get("runtime_prereqs_missing_commands"), list)
        assert isinstance(export_event["payload"].get("runtime_prereqs_missing_workspace"), list)
        assert isinstance(export_event["payload"].get("runtime_prereqs_command"), str)
        assert isinstance(history_event["payload"].get("runtime_prereqs_present_count"), int)
        assert isinstance(history_event["payload"].get("runtime_prereqs_failure_count"), int)
        assert isinstance(history_event["payload"].get("runtime_prereqs_missing_commands"), list)
        assert isinstance(history_event["payload"].get("runtime_prereqs_missing_workspace"), list)
        assert isinstance(history_event["payload"].get("runtime_prereqs_command"), str)
