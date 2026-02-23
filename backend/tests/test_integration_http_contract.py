import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "providers"


def _load_fixture(name: str):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []
        self.updated = []

    async def find_one(self, flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

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
            d
            for d in docs
            if d.get("userId") == user_id and d.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get("createdAt", ""), reverse=reverse)
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


def test_http_get_integrations_masks_keys_and_flags(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "SG.abcdefgh12345678",
            "apollo_api_key": "apolloabcdefgh12345678",
            "clearbit_api_key": "clearbitabcdefgh12345678",
            "crunchbase_api_key": "crunchbaseabcdefgh12345678",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sendgrid_configured"] is True
    assert payload["apollo_enabled"] is True
    assert payload["clearbit_enabled"] is False
    assert payload["crunchbase_enabled"] is True
    assert payload["sendgrid_api_key"].startswith("••••••••")


def test_http_apollo_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 2, "saveResults": True},
        headers={"X-Request-Id": "req-http-contract-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["resultCount"] == 2
    assert payload["savedCount"] == 2
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved_event = fake_db.integration_telemetry.inserted[0]
    assert saved_event["payload"]["request_id"] == "req-http-contract-1"


def test_http_clearbit_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "clearbit_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("clearbit_company_find.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/clearbit/company",
        json={"domain": "growthops.ai", "saveResearch": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["found"] is True


def test_http_crunchbase_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "crunchbase_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("crunchbase_organizations_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/crunchbase/company",
        json={"companyName": "PipelineIQ", "limit": 2, "saveResearch": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["resultCount"] == 2
    assert payload["savedCount"] == 2


def test_http_integrations_health(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "token",
            "apollo_api_key": "token",
            "clearbit_api_key": "token",
        }
    )

    async def fake_sendgrid_health(_api_key):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 15, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/health")
    assert response.status_code == 200
    payload = response.json()
    assert "providers" in payload
    providers = {p["provider"]: p for p in payload["providers"]}
    assert providers["sendgrid"]["healthy"] is True
    assert providers["apollo"]["healthy"] is True
    assert providers["clearbit"]["healthy"] is True
    assert providers["crunchbase"]["healthy"] is False


def test_http_integrations_telemetry_summary(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "schemaVersion": 1,
                "payload": {"result_count": 2, "saved_count": 2},
                "createdAt": "2026-02-18T11:00:00+00:00",
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_send_error",
                "schemaVersion": 1,
                "payload": {"error": "timeout"},
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
            {
                "id": "t3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {
                    "open_pipeline_value": 10000,
                    "schema_version": 2,
                    "request_id": "req-sales-intel-99",
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
            {
                "id": "t4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "decision": "HOLD",
                    "traceability_ready": False,
                    "request_id": "req-traceability-99",
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 4
    assert payload["errorEventCount"] == 1
    assert payload["byProvider"]["apollo"] == 1
    assert payload["byProvider"]["sendgrid"] == 1
    assert payload["byProvider"]["sales_intelligence"] == 1
    assert payload["byProvider"]["integrations"] == 1
    assert payload["bySchemaVersion"]["1"] == 2
    assert payload["bySchemaVersion"]["2"] == 1
    assert payload["bySchemaVersion"]["unknown"] == 1
    assert payload["salesIntelligence"]["eventCount"] == 1
    assert payload["salesIntelligence"]["byEventFamily"]["forecast"] == 1
    assert payload["salesIntelligence"]["bySchemaVersion"]["2"] == 1
    assert payload["traceabilityAudit"]["eventCount"] == 1
    assert payload["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert payload["traceabilityAudit"]["readyCount"] == 0
    assert payload["traceabilityAudit"]["notReadyCount"] == 1
    assert payload["traceabilityAudit"]["latestEvaluatedAt"] == "2026-02-18T11:07:00+00:00"
    assert len(payload["trendByDay"]) == 1
    assert payload["trendByDay"][0]["events"] == 4
    assert payload["trendByDay"][0]["errors"] == 1
    assert len(payload["salesIntelligence"]["trendByDay"]) == 1
    assert payload["salesIntelligence"]["trendByDay"][0]["forecast"] == 1
    assert payload["recentEvents"][0]["schemaVersion"] is None
    assert payload["recentEvents"][0]["requestId"] == "req-traceability-99"
    assert payload["recentEvents"][0]["traceabilityDecision"] == "HOLD"
    assert payload["recentEvents"][0]["traceabilityReady"] is False


def test_http_integrations_telemetry_snapshot_governance(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        snapshot_path = tmp_path / "connector-telemetry-summary-2026-02-22.json"
        snapshot_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "traceabilityAudit": {
                        "eventCount": 1,
                        "decisionCounts": {"HOLD": 1},
                        "readyCount": 0,
                        "notReadyCount": 1,
                    },
                }
            ),
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
        assert payload["status"] == "READY"
        assert payload["snapshot"]["fileCount"] >= 1
        assert payload["snapshot"]["withinRetention"] is True
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is True
        assert payload["releaseGateFixtures"]["missingProfiles"] == []
        assert payload["handoff"]["rolloutBlocked"] is False
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert (
            governance_event["eventType"]
            == "integrations_traceability_snapshot_governance_evaluated"
        )
        assert governance_event["payload"]["status"] == "READY"


def test_http_integrations_telemetry_snapshot_governance_handles_missing_and_stale_artifacts(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        stale_snapshot_path = tmp_path / "connector-telemetry-summary-2025-01-01.json"
        stale_snapshot_path.write_text(
            json.dumps(
                {
                    "generatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=90)
                    ).isoformat()
                }
            ),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        pass_fixture.write_text(json.dumps({"approved": True}), encoding="utf-8")

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": tmp_path / "connector_release_gate_result_hold.json",
                "validation-fail": (
                    tmp_path / "connector_release_gate_result_validation_fail.json"
                ),
            },
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["snapshot"]["withinRetention"] is False
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is False
        assert "hold" in payload["releaseGateFixtures"]["missingProfiles"]
        assert "validation-fail" in payload["releaseGateFixtures"]["missingProfiles"]
        assert payload["handoff"]["rolloutBlocked"] is True
        assert payload["handoff"]["ownerRole"] == "Release Manager"
        assert len(payload["alerts"]) >= 1
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["status"] == "ACTION_REQUIRED"


def test_http_integrations_telemetry_snapshot_governance_validates_retention_days(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=0"
    )
    assert response.status_code == 400


def test_http_integrations_baseline_governance(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "PASS"
        assert payload["releaseGateFixturePolicy"]["passed"] is True
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is True
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert (
            governance_event["eventType"]
            == "integrations_traceability_baseline_governance_evaluated"
        )
        assert governance_event["payload"]["status"] == "PASS"


def test_http_integrations_baseline_governance_handles_missing_artifact(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        missing_path = Path(tmp) / "baseline_metrics.json"
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            missing_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 404


def test_http_integrations_baseline_governance_handles_invalid_json(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text("{invalid", encoding="utf-8")
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 422


def test_http_integrations_slo_gates(monkeypatch):
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "5")
    monkeypatch.setenv("INTEGRATION_SLO_SENDGRID_P95_MS", "2000")
    monkeypatch.setenv("INTEGRATION_SLO_APOLLO_P95_MS", "3000")

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "payload": {"latency_ms": 1200},
                "createdAt": "2026-02-18T11:00:00+00:00",
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_send_error",
                "payload": {"error": "timeout", "latency_ms": 1500},
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
            {
                "id": "t3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&min_schema_v2_sample_count=1"
    )
    assert response.status_code == 200
    payload = response.json()
    assert "gates" in payload
    assert payload["eventCount"] == 3
    assert "errorRate" in payload
    assert "schemaCoverage" in payload
    assert "providerLatency" in payload
    assert "decision" in payload
    assert "rolloutActions" in payload
    assert "signoff" in payload
    assert "requiredApprovals" in payload["signoff"]
    assert payload["gates"]["schemaCoveragePassed"] is True
    assert payload["gates"]["schemaSampleSizePassed"] is True
    assert payload["schemaCoverage"]["sampleCount"] == 1
    assert payload["schemaCoverage"]["minSampleCount"] == 1
    assert payload["schemaCoverage"]["observedPct"] == 100.0
    assert len(fake_db.integration_telemetry.inserted) == 1
    audit_event = fake_db.integration_telemetry.inserted[0]
    assert audit_event["eventType"] == "integrations_traceability_status_evaluated"
    assert audit_event["payload"]["decision"] == payload["decision"]
    assert audit_event["payload"]["traceability_ready"] is False
    assert audit_event["payload"]["event_count"] == 3


def test_http_integrations_slo_gates_excludes_existing_traceability_audit_events(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "a1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "traceability_ready": True},
                "createdAt": "2026-02-18T11:00:00+00:00",
            },
            {
                "id": "a2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "within_retention": True},
                "createdAt": "2026-02-18T11:00:30+00:00",
            },
            {
                "id": "a3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": "PASS", "policy_passed": True},
                "createdAt": "2026-02-18T11:00:45+00:00",
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": "2026-02-18T11:01:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&min_schema_v2_sample_count=1",
        headers={"X-Request-Id": "req-traceability-audit-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 1
    assert payload["schemaCoverage"]["sampleCount"] == 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    inserted = fake_db.integration_telemetry.inserted[0]
    assert inserted["payload"]["request_id"] == "req-traceability-audit-1"


def test_http_integrations_slo_gates_can_hold_on_schema_coverage(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": "2026-02-18T11:00:00+00:00",
            },
            {
                "id": "s2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_campaign_created",
                "schemaVersion": 1,
                "payload": {"schema_version": 1},
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["gates"]["schemaCoveragePassed"] is False
    assert payload["gates"]["overallPassed"] is False
    assert payload["decision"] == "HOLD"
    assert payload["schemaCoverage"]["sampleCount"] == 2
    assert payload["schemaCoverage"]["schemaV2Count"] == 1
    assert payload["schemaCoverage"]["observedPct"] == 50.0
    assert any(alert["gate"] == "schema_coverage" for alert in payload["alerts"])


def test_http_integrations_slo_gates_can_hold_on_schema_sample_size(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": "2026-02-18T11:00:00+00:00",
            },
            {
                "id": "s2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_campaign_created",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=5"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["gates"]["schemaCoveragePassed"] is True
    assert payload["gates"]["schemaSampleSizePassed"] is False
    assert payload["gates"]["overallPassed"] is False
    assert payload["decision"] == "HOLD"
    assert payload["schemaCoverage"]["sampleCount"] == 2
    assert payload["schemaCoverage"]["minSampleCount"] == 5
    assert any(alert["gate"] == "schema_sample_size" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "Sales Ops Lead" for action in payload["rolloutActions"])
    assert any(
        "minimum sample threshold" in str(action.get("action", "")).lower()
        for action in payload["rolloutActions"]
    )


def test_http_integrations_telemetry_summary_rejects_invalid_days(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/summary?days=0&limit=500")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text

    response = client.get("/api/integrations/integrations/telemetry/summary?days=31&limit=500")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text


def test_http_integrations_telemetry_summary_rejects_invalid_limit(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/summary?days=7&limit=49")
    assert response.status_code == 400
    assert "limit must be between 50 and 5000" in response.text

    response = client.get("/api/integrations/integrations/telemetry/summary?days=7&limit=5001")
    assert response.status_code == 400
    assert "limit must be between 50 and 5000" in response.text


def test_http_integrations_slo_gates_rejects_invalid_query_bounds(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=0&limit=1000")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text

    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=99")
    assert response.status_code == 400
    assert "limit must be between 100 and 5000" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_error_rate_pct=101"
    )
    assert response.status_code == 400
    assert "max_error_rate_pct must be between 0 and 100" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&min_schema_v2_pct=101"
    )
    assert response.status_code == 400
    assert "min_schema_v2_pct must be between 0 and 100" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&min_schema_v2_sample_count=0"
    )
    assert response.status_code == 400
    assert "min_schema_v2_sample_count must be between 1 and 5000" in response.text


def test_http_integrations_slo_gates_rejects_non_numeric_threshold_env(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MAX_ERROR_RATE_PCT must be numeric" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT must be numeric" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT must be an integer" in response.text
