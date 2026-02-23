from routes import real_integrations


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


class _FakeCollection:
    def __init__(self, seed_doc=None, docs=None):
        self.seed_doc = seed_doc
        self.docs = docs or []
        self.inserted = []
        self.updated = []

    async def find_one(self, *_args, **_kwargs):
        return self.seed_doc

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.docs.append(doc)
        return {"ok": 1}

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    def find(self, flt, *_args, **_kwargs):
        user_id = flt.get("userId")
        created_at_filter = (flt.get("createdAt") or {}).get("$gte", "")
        filtered = [
            d
            for d in self.docs
            if d.get("userId") == user_id and d.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeDb:
    def __init__(self, telemetry_docs=None):
        self.integration_telemetry = _FakeCollection(docs=telemetry_docs or [])
        self.user_integrations = _FakeCollection(seed_doc={"userId": "u1"})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})


def _run(coro):
    return real_integrations.asyncio.run(coro)


def test_record_integration_event_persists_redacted_payload(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "sendgrid_send_success",
            "u1",
            {"status_code": 202, "api_key": "secret"},
        )
    )
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved = fake_db.integration_telemetry.inserted[0]
    assert saved["userId"] == "u1"
    assert saved["eventType"] == "sendgrid_send_success"
    assert saved["payload"]["api_key"] == "[redacted]"


def test_record_integration_event_persists_request_id_and_redacts_sensitive_nested_fields(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "apollo_search_success",
            "u1",
            {
                "authorization": "Bearer token",
                "to": "demo@example.com",
                "nested": {"password": "secret-password"},
            },
            request_id="req-telemetry-1",
        )
    )
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved = fake_db.integration_telemetry.inserted[0]
    assert saved["payload"]["request_id"] == "req-telemetry-1"
    assert saved["payload"]["authorization"] == "[redacted]"
    assert saved["payload"]["nested"]["password"] == "[redacted]"
    assert saved["payload"]["to"] == "de***@example.com"


def test_telemetry_summary_aggregates_by_provider_and_event(monkeypatch):
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "schemaVersion": 1,
            "payload": {"result_count": 2, "saved_count": 2},
            "createdAt": "2026-02-18T10:00:00+00:00",
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "clearbit",
            "eventType": "clearbit_enrichment_success",
            "schemaVersion": 1,
            "payload": {"result_count": 1, "saved_count": 1},
            "createdAt": "2026-02-18T10:05:00+00:00",
        },
        {
            "id": "3",
            "userId": "u1",
            "provider": "sendgrid",
            "eventType": "sendgrid_send_error",
            "schemaVersion": 1,
            "payload": {"error": "timeout"},
            "createdAt": "2026-02-18T10:10:00+00:00",
        },
        {
            "id": "4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_campaign_created",
            "schemaVersion": 2,
            "payload": {"channel_count": 2, "schema_version": 2, "request_id": "req-sales-1"},
            "createdAt": "2026-02-18T10:12:00+00:00",
        },
        {
            "id": "5",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_response_prediction_generated",
            "schemaVersion": 2,
            "payload": {"confidence": 0.81, "schema_version": 2, "request_id": "req-sales-2"},
            "createdAt": "2026-02-18T10:13:00+00:00",
        },
        {
            "id": "6",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "decision": "HOLD",
                "traceability_ready": False,
                "request_id": "req-traceability-1",
            },
            "createdAt": "2026-02-18T10:14:00+00:00",
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 6
    assert summary["errorEventCount"] == 1
    assert summary["byProvider"]["apollo"] == 1
    assert summary["byProvider"]["clearbit"] == 1
    assert summary["byProvider"]["sendgrid"] == 1
    assert summary["byProvider"]["sales_intelligence"] == 2
    assert summary["byProvider"]["integrations"] == 1
    assert summary["byEventType"]["sendgrid_send_error"] == 1
    assert summary["bySchemaVersion"]["1"] == 3
    assert summary["bySchemaVersion"]["2"] == 2
    assert summary["bySchemaVersion"]["unknown"] == 1
    assert summary["salesIntelligence"]["eventCount"] == 2
    assert summary["salesIntelligence"]["byEventFamily"]["campaigns"] == 1
    assert summary["salesIntelligence"]["byEventFamily"]["prediction"] == 1
    assert summary["salesIntelligence"]["byEventType"]["sales_campaign_created"] == 1
    assert summary["salesIntelligence"]["bySchemaVersion"]["2"] == 2
    assert summary["traceabilityAudit"]["eventCount"] == 1
    assert summary["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert summary["traceabilityAudit"]["readyCount"] == 0
    assert summary["traceabilityAudit"]["notReadyCount"] == 1
    assert summary["traceabilityAudit"]["latestEvaluatedAt"] == "2026-02-18T10:14:00+00:00"
    assert len(summary["trendByDay"]) == 1
    assert summary["trendByDay"][0]["date"] == "2026-02-18"
    assert summary["trendByDay"][0]["events"] == 6
    assert summary["trendByDay"][0]["errors"] == 1
    assert summary["trendByDay"][0]["salesIntelligenceEvents"] == 2
    assert len(summary["salesIntelligence"]["trendByDay"]) == 1
    assert summary["salesIntelligence"]["trendByDay"][0]["campaigns"] == 1
    assert summary["salesIntelligence"]["trendByDay"][0]["prediction"] == 1
    assert len(summary["recentEvents"]) == 6
    assert summary["recentEvents"][0]["schemaVersion"] is None
    assert summary["recentEvents"][0]["requestId"] == "req-traceability-1"
    assert summary["recentEvents"][0]["traceabilityDecision"] == "HOLD"
    assert summary["recentEvents"][0]["traceabilityReady"] is False


def test_telemetry_summary_validates_days_and_limit(monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    try:
        _run(
            real_integrations.get_integrations_telemetry_summary(
                days=0,
                limit=500,
                current_user={"id": "u1", "email": "sales@example.com"},
            )
        )
        assert False, "Expected HTTPException for invalid days"
    except real_integrations.HTTPException as exc:
        assert exc.status_code == 400


def test_percentile_helper_handles_empty_and_sorted_values():
    assert real_integrations._percentile([], 95) is None
    assert real_integrations._percentile([1, 2, 3, 4, 5], 95) == 5.0
    assert real_integrations._percentile([10, 20, 30, 40], 50) in (20.0, 30.0)


def test_slo_gates_pass_when_error_and_latency_within_threshold(monkeypatch):
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "payload": {"latency_ms": 1200},
            "createdAt": "2026-02-18T10:00:00+00:00",
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "sendgrid",
            "eventType": "sendgrid_send_success",
            "payload": {"latency_ms": 500},
            "createdAt": "2026-02-18T10:02:00+00:00",
        },
        {
            "id": "3",
            "userId": "u1",
            "provider": "clearbit",
            "eventType": "clearbit_enrichment_success",
            "payload": {"latency_ms": 900},
            "createdAt": "2026-02-18T10:05:00+00:00",
        },
        {
            "id": "4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": "2026-02-18T10:08:00+00:00",
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "10")
    monkeypatch.setenv("INTEGRATION_SLO_SENDGRID_P95_MS", "2000")
    monkeypatch.setenv("INTEGRATION_SLO_APOLLO_P95_MS", "3000")
    monkeypatch.setenv("INTEGRATION_SLO_CLEARBIT_P95_MS", "3000")

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            min_schema_v2_sample_count=1,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["gates"]["overallPassed"] is True
    assert result["gates"]["errorRatePassed"] is True
    assert result["gates"]["latencyPassed"] is True
    assert result["gates"]["schemaCoveragePassed"] is True
    assert result["gates"]["schemaSampleSizePassed"] is True
    assert result["errorRate"]["errorEvents"] == 0
    assert result["schemaCoverage"]["sampleCount"] == 1
    assert result["schemaCoverage"]["schemaV2Count"] == 1
    assert result["schemaCoverage"]["minSampleCount"] == 1
    assert result["schemaCoverage"]["observedPct"] == 100.0
    assert result["alerts"] == []
    assert result["decision"] == "PROCEED"
    assert len(result["rolloutActions"]) >= 1
    assert result["rolloutActions"][0]["ownerRole"] == "Release Manager"
    assert result["signoff"]["status"] == "READY_FOR_APPROVAL"
    roles = {r["role"] for r in result["signoff"]["requiredApprovals"]}
    assert "Release Manager" in roles
    assert "Sales Ops Lead" in roles
    assert len(fake_db.integration_telemetry.inserted) == 1
    audit_event = fake_db.integration_telemetry.inserted[0]
    assert audit_event["eventType"] == "integrations_traceability_status_evaluated"
    assert audit_event["payload"]["decision"] == "PROCEED"
    assert audit_event["payload"]["traceability_ready"] is True


def test_slo_gates_ignore_existing_traceability_audit_events_for_gate_counts(monkeypatch):
    telemetry_docs = [
        {
            "id": "audit-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {"decision": "PROCEED", "traceability_ready": True},
            "createdAt": "2026-02-18T10:00:00+00:00",
        },
        {
            "id": "sales-1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": "2026-02-18T10:01:00+00:00",
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            min_schema_v2_sample_count=1,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["eventCount"] == 1
    assert result["schemaCoverage"]["sampleCount"] == 1


def test_slo_gates_fail_on_error_rate_or_latency(monkeypatch):
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "payload": {"latency_ms": 8000},
            "createdAt": "2026-02-18T10:00:00+00:00",
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_error",
            "payload": {"error": "timeout", "latency_ms": 8500},
            "createdAt": "2026-02-18T10:02:00+00:00",
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("INTEGRATION_SLO_APOLLO_P95_MS", "2000")

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            max_error_rate_pct=10.0,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["gates"]["overallPassed"] is False
    assert result["gates"]["errorRatePassed"] is False
    assert result["gates"]["latencyPassed"] is False
    assert result["gates"]["schemaCoveragePassed"] is True
    assert len(result["alerts"]) >= 1
    assert result["decision"] == "HOLD"
    assert len(result["rolloutActions"]) >= 1
    owners = {a["ownerRole"] for a in result["rolloutActions"]}
    assert "On-call Engineer" in owners or "Integrations Engineer" in owners
    assert result["signoff"]["status"] == "HOLD_REMEDIATION_REQUIRED"
    hold_roles = {r["role"] for r in result["signoff"]["requiredApprovals"]}
    assert "On-call Engineer" in hold_roles
    assert "Integrations Engineer" in hold_roles
    assert "Release Manager" in hold_roles
    assert "rollback_drill_report.md" in result["signoff"]["requiredEvidence"]


def test_slo_gates_fail_on_sales_schema_v2_coverage(monkeypatch):
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": "2026-02-18T10:00:00+00:00",
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_campaign_created",
            "schemaVersion": 1,
            "payload": {"schema_version": 1},
            "createdAt": "2026-02-18T10:01:00+00:00",
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "20")
    monkeypatch.setenv("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", "80")

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["schemaCoverage"]["sampleCount"] == 2
    assert result["schemaCoverage"]["schemaV2Count"] == 1
    assert result["schemaCoverage"]["observedPct"] == 50.0
    assert result["schemaCoverage"]["thresholdPct"] == 80
    assert result["gates"]["schemaCoveragePassed"] is False
    assert result["gates"]["overallPassed"] is False
    assert result["decision"] == "HOLD"
    assert any(alert["gate"] == "schema_coverage" for alert in result["alerts"])
    schema_actions = [item for item in result["rolloutActions"] if item.get("ownerRole") == "Release Manager"]
    assert any("schema-version drift" in str(item.get("action", "")).lower() for item in schema_actions)


def test_slo_gates_validate_parameters(monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    for invalid_days in [0, 31]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=invalid_days,
                    limit=1000,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid days"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    for invalid_limit in [10, 6000]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=invalid_limit,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid limit"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    for invalid_rate in [-1, 101]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=1000,
                    max_error_rate_pct=invalid_rate,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid max_error_rate_pct"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    for invalid_schema_rate in [-1, 101]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=1000,
                    min_schema_v2_pct=invalid_schema_rate,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid min_schema_v2_pct"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    for invalid_sample_count in [0, 5001]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=1000,
                    min_schema_v2_sample_count=invalid_sample_count,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid min_schema_v2_sample_count"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    try:
        _run(
            real_integrations.get_integrations_telemetry_summary(
                days=7,
                limit=10,
                current_user={"id": "u1", "email": "sales@example.com"},
            )
        )
        assert False, "Expected HTTPException for invalid limit"
    except real_integrations.HTTPException as exc:
        assert exc.status_code == 400
