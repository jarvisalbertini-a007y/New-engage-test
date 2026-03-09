from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc

    async def find_one(self, _flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

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
        self.user_integrations = _FakeCollection(seed_doc={})
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


def test_telemetry_export_distribution_smoke_exposes_recent_event_distribution_fields(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=59, second=0, microsecond=0
    )
    telemetry_docs = []
    for idx in range(60):
        has_packet_marker = idx < 45
        payload = {"request_id": f"req-distribution-{idx}"}
        event_type = "sales_pipeline_forecast_generated"
        provider = "sales_intelligence"
        if has_packet_marker:
            payload["governance_packet_validation_status"] = "READY"
            payload["governance_packet_validation_within_freshness"] = True
            event_type = "integrations_traceability_status_evaluated"
            provider = "integrations"
        elif idx == 45:
            payload["endpoint"] = "apollo_search"
            payload["window_seconds"] = 60
            payload["max_requests"] = 1
            payload["retry_after_seconds"] = 42
            payload["reset_in_seconds"] = 41
            event_type = "integrations_connector_rate_limited"
            provider = "integrations"
        elif idx in (46, 47):
            payload["selected_provider"] = "apollo" if idx == 46 else "clearbit"
            payload["attempt_count"] = 3 if idx == 46 else 2
            payload["attempt_success_count"] = 1
            payload["attempt_skipped_count"] = 1 if idx == 46 else 0
            payload["attempt_error_count"] = 1 if idx == 47 else 0
            payload["attempt_reason_codes"] = (
                {"success": 1, "domain_required": 1}
                if idx == 46
                else {"success": 1, "provider_http_error": 1}
            )
            payload["latency_ms"] = 82.0 if idx == 46 else 49.0
            payload["result_count"] = 2 if idx == 46 else 1
            event_type = "company_enrichment_orchestrated"
            provider = "integrations"
        telemetry_docs.append(
            {
                "id": f"td{idx}",
                "userId": "u1",
                "provider": provider,
                "eventType": event_type,
                "payload": payload,
                "createdAt": (recent_base - timedelta(minutes=idx)).isoformat(),
            }
        )

    client = _build_client(monkeypatch, _FakeDb(telemetry_docs=telemetry_docs))
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 60
    assert payload["recentEventsTotalCount"] == 50
    assert payload["recentEventsFilteredCount"] == 50
    assert payload["recentEventsPacketValidationCount"] == 45
    assert payload["recentEventsNonPacketCount"] == 5
    assert payload["recentEventsGovernanceStatusCounts"] == {}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 45}
    assert payload["recentEventsGovernanceStatusCountsSource"] == "local"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is False
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert payload["recentEventsGovernanceStatusCountsServer"] == {}
    assert payload["recentEventsPacketValidationStatusCountsServer"] == {"READY": 45}
    assert payload["recentEventsGovernanceStatusCountsFallback"] == {}
    assert payload["recentEventsPacketValidationStatusCountsFallback"] == {"READY": 45}
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "local_fallback"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "server_consistent"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False
    assert (
        payload["recentEventsPacketValidationCount"]
        + payload["recentEventsNonPacketCount"]
        == payload["recentEventsTotalCount"]
    )
    assert payload["trendByDay"][0]["orchestrationEvents"] == 2
    assert payload["connectorRateLimit"]["eventCount"] == 1
    assert payload["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 1
    assert payload["connectorRateLimit"]["maxRetryAfterSeconds"] == 42
    assert payload["connectorRateLimit"]["avgRetryAfterSeconds"] == 42.0
    assert payload["connectorRateLimit"]["maxResetInSeconds"] == 41
    assert payload["connectorRateLimit"]["avgResetInSeconds"] == 41.0
    assert payload["orchestrationAudit"]["eventCount"] == 2
    assert payload["orchestrationAudit"]["trendByDay"][0]["events"] == 2
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptSuccessCount"] == 2
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptSkippedCount"] == 1
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptErrorCount"] == 1
    assert any(
        row.get("connectorRateLimitResetInSeconds") == 41
        for row in payload["recentEvents"]
    )
    assert any(
        row.get("orchestrationSelectedProvider") in {"apollo", "clearbit"}
        for row in payload["recentEvents"]
    )


def test_telemetry_export_distribution_smoke_surfaces_server_drift_posture_when_parity_fails(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "td-server-drift-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-server-drift-1",
                "status": "PASS",
                "governance_packet_validation_status": "READY",
            },
            "createdAt": created_at,
        }
    ]
    monkeypatch.setattr(real_integrations, "_status_count_maps_equal", lambda left, right: False)
    client = _build_client(monkeypatch, _FakeDb(telemetry_docs=telemetry_docs))

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCountsSource"] == "server"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is True
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is True
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "server_drift"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "server_drift"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "warning"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "warning"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is True
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is True


def test_telemetry_export_distribution_smoke_exposes_orchestration_threshold_metadata(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "o1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "company_enrichment_orchestrated",
            "payload": {
                "attempt_error_count": 2,
                "attempt_skipped_count": 3,
                "attempt_success_count": 0,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "s1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_2,
        },
    ]
    client = _build_client(monkeypatch, _FakeDb(telemetry_docs=telemetry_docs))
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?"
        "days=30&limit=500&max_error_rate_pct=100&min_schema_v2_pct=90"
        "&min_schema_v2_sample_count=1&max_orchestration_attempt_error_count=1"
        "&max_orchestration_attempt_skipped_count=2"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "HOLD"
    assert payload["gates"]["orchestrationAttemptErrorPassed"] is False
    assert payload["gates"]["orchestrationAttemptSkippedPassed"] is False
    assert payload["orchestrationAudit"]["maxAttemptErrorCountThreshold"] == 1
    assert payload["orchestrationAudit"]["observedAttemptErrorCount"] == 2
    assert payload["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] == 2
    assert payload["orchestrationAudit"]["observedAttemptSkippedCount"] == 3
