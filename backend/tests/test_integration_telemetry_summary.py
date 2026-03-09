from datetime import datetime, timedelta, timezone

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


def test_record_integration_event_redacts_mixed_case_and_header_style_sensitive_keys(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "connector_event",
            "u1",
            {
                "apiKey": "secret-api-key",
                "x-api-key": "secret-header-key",
                "clientSecret": "super-secret",
                "privateKey": "private-secret",
                "idToken": "id-token-secret",
                "headers": {
                    "Authorization": "Bearer abc123",
                    "X-Api-Key": "header-value",
                    "X-Trace-Id": "trace-1",
                },
                "nested": [
                    {
                        "refreshToken": "refresh-secret",
                        "safeField": "ok",
                    }
                ],
            },
            request_id="req-telemetry-sensitive-1",
        )
    )
    saved = fake_db.integration_telemetry.inserted[0]["payload"]
    assert saved["apiKey"] == "[redacted]"
    assert saved["x-api-key"] == "[redacted]"
    assert saved["clientSecret"] == "[redacted]"
    assert saved["privateKey"] == "[redacted]"
    assert saved["idToken"] == "[redacted]"
    assert saved["headers"]["Authorization"] == "[redacted]"
    assert saved["headers"]["X-Api-Key"] == "[redacted]"
    assert saved["headers"]["X-Trace-Id"] == "trace-1"
    assert saved["nested"][0]["refreshToken"] == "[redacted]"
    assert saved["nested"][0]["safeField"] == "ok"


def test_record_integration_event_masks_camel_case_email_keys(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "email_event",
            "u1",
            {
                "toEmail": "recipient@example.com",
                "fromEmail": "owner@example.com",
                "emailAddress": "primary@example.com",
            },
        )
    )
    saved = fake_db.integration_telemetry.inserted[0]["payload"]
    assert saved["toEmail"] == "re***@example.com"
    assert saved["fromEmail"] == "ow***@example.com"
    assert saved["emailAddress"] == "pr***@example.com"


def test_record_integration_event_preserves_non_sensitive_token_like_fields(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "telemetry_meta",
            "u1",
            {
                "token_count": 5,
                "sessionTokenCount": 2,
                "api_status": "ok",
            },
        )
    )
    saved = fake_db.integration_telemetry.inserted[0]["payload"]
    assert saved["token_count"] == 5
    assert saved["sessionTokenCount"] == 2
    assert saved["api_status"] == "ok"


def test_record_integration_event_persists_top_level_normalized_contract_fields(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "integrations_traceability_status_evaluated",
            "u1",
            {
                "schema_version": 2,
                "status": " action required ",
                "governance_packet_validation_status": " ready ",
                "governance_packet_validation_within_freshness": True,
            },
            request_id="req-contract-top-level-1",
        )
    )
    saved = fake_db.integration_telemetry.inserted[0]
    assert saved["requestId"] == "req-contract-top-level-1"
    assert saved["schemaVersion"] == 2
    assert saved["governanceStatus"] == "ACTION_REQUIRED"
    assert saved["governancePacketValidationStatus"] == "READY"
    assert saved["governancePacketValidationWithinFreshness"] is True


def test_record_integration_event_redacts_cookie_and_session_secret_fields(monkeypatch):
    fake_db = _FakeDb()
    _run(
        real_integrations._record_integration_event(
            fake_db,
            "connector_cookie_event",
            "u1",
            {
                "cookie": "session=abc",
                "set-cookie": "session=abc; HttpOnly",
                "session_id": "session-id-secret",
                "headers": {
                    "Cookie": "nested-cookie",
                    "Set-Cookie": "nested-set-cookie",
                    "Proxy-Authorization": "Bearer nested-secret",
                },
            },
        )
    )
    saved = fake_db.integration_telemetry.inserted[0]["payload"]
    assert saved["cookie"] == "[redacted]"
    assert saved["set-cookie"] == "[redacted]"
    assert saved["session_id"] == "[redacted]"
    assert saved["headers"]["Cookie"] == "[redacted]"
    assert saved["headers"]["Set-Cookie"] == "[redacted]"
    assert saved["headers"]["Proxy-Authorization"] == "[redacted]"


def test_telemetry_summary_prefers_top_level_event_contract_fields_when_payload_is_sparse(
    monkeypatch,
):
    recent_created_at = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    telemetry_docs = [
        {
            "id": "top-level-contract-1",
            "userId": "u1",
            "provider": "integration",
            "eventType": "integrations_traceability_status_evaluated",
            "schemaVersion": 2,
            "requestId": "req-top-level-contract-1",
            "governanceStatus": "ACTION_REQUIRED",
            "governancePacketValidationStatus": "READY",
            "governancePacketValidationWithinFreshness": True,
            "payload": {
                "decision": "HOLD",
            },
            "createdAt": recent_created_at,
        }
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=7,
            limit=500,
            current_user={"id": "u1"},
        )
    )

    assert summary["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert summary["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert summary["packetValidationAudit"]["statusCounts"] == {"READY": 1}
    assert summary["recentEvents"][0]["schemaVersion"] == 2
    assert summary["recentEvents"][0]["requestId"] == "req-top-level-contract-1"
    assert summary["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] == "READY"
    assert summary["recentEvents"][0]["governancePacketValidationWithinFreshness"] is True


def test_telemetry_summary_aggregates_by_provider_and_event(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=14)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=9)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=4)).isoformat()
    created_at_4 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_5 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_6 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "schemaVersion": 1,
            "payload": {"result_count": 2, "saved_count": 2},
            "createdAt": created_at_1,
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "clearbit",
            "eventType": "clearbit_enrichment_success",
            "schemaVersion": 1,
            "payload": {"result_count": 1, "saved_count": 1},
            "createdAt": created_at_2,
        },
        {
            "id": "3",
            "userId": "u1",
            "provider": "sendgrid",
            "eventType": "sendgrid_send_error",
            "schemaVersion": 1,
            "payload": {"error": "timeout"},
            "createdAt": created_at_3,
        },
        {
            "id": "4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_campaign_created",
            "schemaVersion": 2,
            "payload": {"channel_count": 2, "schema_version": 2, "request_id": "req-sales-1"},
            "createdAt": created_at_4,
        },
        {
            "id": "5",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_response_prediction_generated",
            "schemaVersion": 2,
            "payload": {"confidence": 0.81, "schema_version": 2, "request_id": "req-sales-2"},
            "createdAt": created_at_5,
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
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_6,
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
    assert summary["traceabilityAudit"]["latestEvaluatedAt"] == created_at_6
    assert summary["governanceAudit"]["eventCount"] == 0
    assert summary["governanceAudit"]["snapshotEvaluationCount"] == 0
    assert summary["governanceAudit"]["baselineEvaluationCount"] == 0
    assert summary["governanceAudit"]["statusCounts"] == {}
    assert summary["governanceAudit"]["latestEvaluatedAt"] is None
    assert summary["governanceSchemaAudit"]["eventCount"] == 0
    assert summary["governanceSchemaAudit"]["statusCounts"] == {}
    assert summary["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["handoffParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["handoffParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["allParityPassedCount"] == 0
    assert summary["governanceSchemaAudit"]["allParityFailedCount"] == 0
    assert summary["governanceSchemaAudit"]["rolloutBlockedCount"] == 0
    assert summary["governanceSchemaAudit"]["latestEvaluatedAt"] is None
    assert summary["packetValidationAudit"]["eventCount"] == 1
    assert summary["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["packetValidationAudit"]["withinFreshnessCount"] == 0
    assert summary["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["missingFreshnessCount"] == 0
    assert summary["packetValidationAudit"]["latestEvaluatedAt"] == created_at_6
    assert len(summary["trendByDay"]) == 1
    assert summary["trendByDay"][0]["date"] == recent_base.date().isoformat()
    assert summary["trendByDay"][0]["events"] == 6
    assert summary["trendByDay"][0]["errors"] == 1
    assert summary["trendByDay"][0]["salesIntelligenceEvents"] == 2
    assert summary["trendByDay"][0]["orchestrationEvents"] == 0
    assert len(summary["salesIntelligence"]["trendByDay"]) == 1
    assert summary["salesIntelligence"]["trendByDay"][0]["campaigns"] == 1
    assert summary["salesIntelligence"]["trendByDay"][0]["prediction"] == 1
    assert len(summary["recentEvents"]) == 6
    assert summary["recentEvents"][0]["schemaVersion"] is None
    assert summary["recentEvents"][0]["requestId"] == "req-traceability-1"
    assert summary["recentEvents"][0]["traceabilityDecision"] == "HOLD"
    assert summary["recentEvents"][0]["traceabilityReady"] is False
    assert summary["recentEvents"][0]["governanceStatus"] is None
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaHandoffParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaAllParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaRolloutBlocked"] is None
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeCount"] is None
    assert summary["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] is None
    assert (
        summary["recentEvents"][0]["governancePacketValidationStatus"]
        == "ACTION_REQUIRED"
    )
    assert summary["recentEvents"][0]["governancePacketValidationWithinFreshness"] is False


def test_telemetry_summary_aggregates_connector_credential_lifecycle(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "lc1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_credential_saved",
            "payload": {"provider": "apollo", "action": "saved", "key_rotated": True},
            "createdAt": created_at_1,
        },
        {
            "id": "lc2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_credential_saved",
            "payload": {"provider": "apollo", "action": "saved", "key_rotated": False},
            "createdAt": created_at_2,
        },
        {
            "id": "lc3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_credential_removed",
            "payload": {"provider": "clearbit", "action": "removed"},
            "createdAt": created_at_3,
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
    assert summary["eventCount"] == 3
    assert summary["connectorLifecycle"]["eventCount"] == 3
    assert summary["connectorLifecycle"]["byAction"]["saved"] == 2
    assert summary["connectorLifecycle"]["byAction"]["removed"] == 1
    assert summary["connectorLifecycle"]["byProvider"]["apollo"]["saved"] == 2
    assert summary["connectorLifecycle"]["byProvider"]["apollo"]["removed"] == 0
    assert summary["connectorLifecycle"]["byProvider"]["clearbit"]["saved"] == 0
    assert summary["connectorLifecycle"]["byProvider"]["clearbit"]["removed"] == 1
    assert summary["connectorLifecycle"]["latestEventAt"] == created_at_3
    assert summary["recentEvents"][0]["connectorCredentialProvider"] == "clearbit"
    assert summary["recentEvents"][0]["connectorCredentialAction"] == "removed"


def test_telemetry_summary_recent_events_do_not_expose_sensitive_payload_fields(monkeypatch):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "secret1",
            "userId": "u1",
            "provider": "sendgrid",
            "eventType": "sendgrid_send_success",
            "payload": {
                "api_key": "secret-api-key",
                "authorization": "Bearer sensitive",
                "cookie": "session=secret",
                "request_id": "req-sensitive-1",
            },
            "createdAt": created_at,
        }
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
    assert summary["eventCount"] == 1
    assert len(summary["recentEvents"]) == 1
    recent_event = summary["recentEvents"][0]
    assert recent_event["requestId"] == "req-sensitive-1"
    assert "api_key" not in recent_event
    assert "authorization" not in recent_event
    assert "cookie" not in recent_event
    assert "secret-api-key" not in str(recent_event)
    assert "Bearer sensitive" not in str(recent_event)
    assert "session=secret" not in str(recent_event)


def test_telemetry_summary_aggregates_connector_rate_limit_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "rl1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "payload": {
                "endpoint": "apollo_search",
                "window_seconds": 60,
                "max_requests": 1,
                "retry_after_seconds": 59,
                "reset_in_seconds": 59,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "rl2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "payload": {
                "endpoint": "apollo_search",
                "window_seconds": 60,
                "max_requests": 1,
                "retry_after_seconds": 58,
                "reset_in_seconds": 58,
            },
            "createdAt": created_at_2,
        },
        {
            "id": "rl3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "payload": {
                "endpoint": "company_enrichment_orchestration",
                "window_seconds": 60,
                "max_requests": 1,
                "retry_after_seconds": 57,
                "reset_in_seconds": 56,
            },
            "createdAt": created_at_3,
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
    assert summary["connectorRateLimit"]["eventCount"] == 3
    assert summary["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 2
    assert (
        summary["connectorRateLimit"]["byEndpoint"]["company_enrichment_orchestration"]
        == 1
    )
    assert summary["connectorRateLimit"]["maxRetryAfterSeconds"] == 59
    assert summary["connectorRateLimit"]["avgRetryAfterSeconds"] == 58.0
    assert summary["connectorRateLimit"]["maxResetInSeconds"] == 59
    assert summary["connectorRateLimit"]["avgResetInSeconds"] == 57.67
    assert summary["connectorRateLimit"]["latestEventAt"] == created_at_3
    assert (
        summary["recentEvents"][0]["connectorRateLimitEndpoint"]
        == "company_enrichment_orchestration"
    )
    assert summary["recentEvents"][0]["connectorRateLimitRetryAfterSeconds"] == 57
    assert summary["recentEvents"][0]["connectorRateLimitResetInSeconds"] == 56


def test_telemetry_summary_connector_rate_limit_rollup_handles_sparse_payloads(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "rl-sparse-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "payload": {
                "endpoint": "",
                "retry_after_seconds": "invalid",
                "reset_in_seconds": "invalid",
            },
            "createdAt": created_at_1,
        },
        {
            "id": "rl-sparse-2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_rate_limited",
            "payload": {
                "retry_after_seconds": "8",
            },
            "createdAt": created_at_2,
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
    assert summary["connectorRateLimit"]["eventCount"] == 2
    assert summary["connectorRateLimit"]["byEndpoint"]["unknown"] == 2
    assert summary["connectorRateLimit"]["maxRetryAfterSeconds"] == 8
    assert summary["connectorRateLimit"]["avgRetryAfterSeconds"] == 8.0
    assert summary["connectorRateLimit"]["maxResetInSeconds"] == 8
    assert summary["connectorRateLimit"]["avgResetInSeconds"] == 8.0
    assert summary["connectorRateLimit"]["latestEventAt"] == created_at_2


def test_telemetry_summary_aggregates_sendgrid_webhook_timestamp_rollup(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "sg-ts-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "sendgrid_webhook_processed",
            "payload": {
                "timestamp_pressure_label": "High",
                "timestamp_pressure_hint": "High anomaly pressure",
                "timestamp_anomaly_count": 4,
                "timestamp_anomaly_rate_pct": 50.0,
                "timestamp_fallback_count": 1,
                "future_skew_event_count": 1,
                "stale_event_count": 2,
                "fresh_event_count": 3,
                "timestamp_age_bucket_counts": {
                    "stale": 2,
                    "future_skew": 1,
                    "fresh_lt_1h": 3,
                },
                "timestamp_anomaly_event_type_counts": {
                    "open": 2,
                    "click": 1,
                },
                "timestamp_dominant_anomaly_bucket": "stale",
                "timestamp_dominant_anomaly_event_type": "open",
                "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                "timestamp_pressure_high_anomaly_count": 10,
                "timestamp_pressure_moderate_anomaly_count": 3,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "sg-ts-2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "sendgrid_webhook_processed",
            "payload": {
                "timestamp_pressure_label": "Moderate",
                "timestamp_pressure_hint": "Moderate anomaly pressure",
                "timestamp_anomaly_count": 2,
                "timestamp_anomaly_rate_pct": 10.0,
                "timestamp_fallback_count": 1,
                "future_skew_event_count": 1,
                "stale_event_count": 0,
                "fresh_event_count": 4,
                "timestamp_age_bucket_counts": {
                    "future_skew": 1,
                    "fallback": 1,
                },
                "timestamp_anomaly_event_type_counts": {"processed": 1},
                "timestamp_dominant_anomaly_bucket": "future_skew",
                "timestamp_dominant_anomaly_event_type": "processed",
                "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                "timestamp_pressure_high_anomaly_count": 10,
                "timestamp_pressure_moderate_anomaly_count": 3,
            },
            "createdAt": created_at_2,
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
    rollup = summary["sendgridWebhookTimestamp"]
    assert rollup["eventCount"] == 2
    assert rollup["pressureLabelCounts"] == {"High": 1, "Moderate": 1}
    assert rollup["pressureHintCounts"]["High anomaly pressure"] == 1
    assert rollup["pressureHintCounts"]["Moderate anomaly pressure"] == 1
    assert rollup["timestampFallbackCount"] == 2
    assert rollup["futureSkewEventCount"] == 2
    assert rollup["staleEventCount"] == 2
    assert rollup["freshEventCount"] == 7
    assert rollup["timestampAnomalyCountTotal"] == 6
    assert rollup["avgTimestampAnomalyCount"] == 3.0
    assert rollup["avgTimestampAnomalyRatePct"] == 30.0
    assert rollup["maxTimestampAnomalyRatePct"] == 50.0
    assert rollup["timestampAgeBucketCounts"]["stale"] == 2
    assert rollup["timestampAgeBucketCounts"]["future_skew"] == 2
    assert rollup["timestampAgeBucketCounts"]["fresh_lt_1h"] == 3
    assert rollup["timestampAgeBucketCounts"]["fallback"] == 1
    assert rollup["timestampAnomalyEventTypeCounts"]["open"] == 2
    assert rollup["timestampAnomalyEventTypeCounts"]["click"] == 1
    assert rollup["timestampAnomalyEventTypeCounts"]["processed"] == 1
    assert rollup["timestampDominantAnomalyBucketCounts"]["stale"] == 1
    assert rollup["timestampDominantAnomalyBucketCounts"]["future_skew"] == 1
    assert rollup["timestampDominantAnomalyEventTypeCounts"]["open"] == 1
    assert rollup["timestampDominantAnomalyEventTypeCounts"]["processed"] == 1
    assert rollup["timestampPressureHighAnomalyRatePct"] == 20.0
    assert rollup["timestampPressureModerateAnomalyRatePct"] == 5.0
    assert rollup["timestampPressureHighAnomalyCount"] == 10
    assert rollup["timestampPressureModerateAnomalyCount"] == 3
    assert rollup["latestEventAt"] == created_at_2
    assert summary["recentEvents"][0]["timestampPressureLabel"] == "Moderate"
    assert summary["recentEvents"][0]["timestampAnomalyCount"] == 2
    assert summary["recentEvents"][0]["timestampDominantAnomalyBucket"] == "future_skew"


def test_telemetry_summary_sendgrid_webhook_timestamp_rollup_handles_sparse_payloads(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "sg-ts-sparse-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "sendgrid_webhook_processed",
            "payload": {
                "timestamp_pressure_label": "invalid",
                "timestamp_pressure_hint": "   ",
                "timestamp_anomaly_count": "bad",
                "timestamp_anomaly_rate_pct": "bad",
                "timestamp_fallback_count": "bad",
                "future_skew_event_count": None,
                "stale_event_count": -1,
                "fresh_event_count": "bad",
                "timestamp_age_bucket_counts": {
                    "future_skew": 2,
                    "stale": "bad",
                },
                "timestamp_anomaly_event_type_counts": {
                    "open": 1,
                    "click": "bad",
                },
                "timestamp_dominant_anomaly_bucket": "",
                "timestamp_dominant_anomaly_event_type": " ",
            },
            "createdAt": created_at,
        }
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
    rollup = summary["sendgridWebhookTimestamp"]
    assert rollup["eventCount"] == 1
    assert rollup["pressureLabelCounts"] == {"Unknown": 1}
    assert rollup["pressureHintCounts"] == {"Timestamp posture not available.": 1}
    assert rollup["timestampFallbackCount"] == 0
    assert rollup["futureSkewEventCount"] == 0
    assert rollup["staleEventCount"] == 0
    assert rollup["freshEventCount"] == 0
    assert rollup["timestampAnomalyCountTotal"] == 0
    assert rollup["avgTimestampAnomalyCount"] is None
    assert rollup["avgTimestampAnomalyRatePct"] is None
    assert rollup["maxTimestampAnomalyRatePct"] is None
    assert rollup["timestampAgeBucketCounts"] == {"future_skew": 2}
    assert rollup["timestampAnomalyEventTypeCounts"] == {"open": 1}
    assert rollup["timestampDominantAnomalyBucketCounts"] == {}
    assert rollup["timestampDominantAnomalyEventTypeCounts"] == {}
    assert rollup["latestEventAt"] == created_at


def test_telemetry_summary_aggregates_connector_input_validation_failures(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "cv1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_input_validation_failed",
            "payload": {
                "provider": "apollo",
                "endpoint": "apollo_search",
                "field": "limit",
                "reason": "range",
                "error_code": "invalid_request_bounds",
                "message": "Invalid limit: expected integer between 1 and 100",
                "received": 1000,
                "minimum": 1,
                "maximum": 100,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "cv2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_connector_input_validation_failed",
            "payload": {
                "provider": "clearbit",
                "endpoint": "clearbit_company",
                "field": "domain",
                "reason": "required",
                "error_code": "invalid_request_required_field",
                "message": "domain is required",
            },
            "createdAt": created_at_2,
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
    assert summary["connectorValidation"]["eventCount"] == 2
    assert summary["connectorValidation"]["byEndpoint"]["apollo_search"] == 1
    assert summary["connectorValidation"]["byEndpoint"]["clearbit_company"] == 1
    assert summary["connectorValidation"]["byProvider"]["apollo"] == 1
    assert summary["connectorValidation"]["byProvider"]["clearbit"] == 1
    assert summary["connectorValidation"]["byField"]["limit"] == 1
    assert summary["connectorValidation"]["byField"]["domain"] == 1
    assert summary["connectorValidation"]["byReason"]["range"] == 1
    assert summary["connectorValidation"]["byReason"]["required"] == 1
    assert summary["connectorValidation"]["latestEventAt"] == created_at_2
    assert summary["recentEvents"][0]["connectorValidationEndpoint"] == "clearbit_company"
    assert summary["recentEvents"][0]["connectorValidationField"] == "domain"
    assert (
        summary["recentEvents"][0]["connectorValidationErrorCode"]
        == "invalid_request_required_field"
    )


def test_telemetry_summary_aggregates_retry_audit_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "retry-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_retry_attempt",
            "payload": {
                "operation": "sendgrid_send_email",
                "provider": "sendgrid",
                "attempt": 1,
                "max_attempts": 3,
                "next_delay_seconds": 0.5,
                "error": "503 temporarily unavailable",
                "request_id": "req-retry-1",
            },
            "createdAt": created_at_1,
        },
        {
            "id": "retry-2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_retry_attempt",
            "payload": {
                "operation": "sendgrid_health_check",
                "provider": "sendgrid",
                "attempt": 2,
                "max_attempts": 3,
                "next_delay_seconds": 1.0,
                "error": "timeout",
                "request_id": "req-retry-2",
            },
            "createdAt": created_at_2,
        },
        {
            "id": "retry-3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_retry_attempt",
            "payload": {
                "operation": "sendgrid_health_check",
                "attempt": 1,
                "max_attempts": 3,
                "error": "connection reset",
                "request_id": "req-retry-3",
            },
            "createdAt": created_at_3,
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

    assert summary["eventCount"] == 3
    assert summary["retryAudit"]["eventCount"] == 3
    assert summary["retryAudit"]["byOperation"]["sendgrid_send_email"] == 1
    assert summary["retryAudit"]["byOperation"]["sendgrid_health_check"] == 2
    assert summary["retryAudit"]["byProvider"]["sendgrid"] == 2
    assert summary["retryAudit"]["byProvider"]["integrations"] == 1
    assert summary["retryAudit"]["maxNextDelaySeconds"] == 1.0
    assert summary["retryAudit"]["avgNextDelaySeconds"] == 0.75
    assert summary["retryAudit"]["latestEventAt"] == created_at_3
    assert summary["recentEvents"][0]["retryOperation"] == "sendgrid_health_check"
    assert summary["recentEvents"][0]["retryAttempt"] == 1
    assert summary["recentEvents"][0]["retryMaxAttempts"] == 3
    assert summary["recentEvents"][0]["retryError"] == "connection reset"
    assert summary["recentEvents"][0]["retryNextDelaySeconds"] is None


def test_telemetry_summary_aggregates_orchestration_audit_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "orch-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "company_enrichment_orchestrated",
            "payload": {
                "selected_provider": "apollo",
                "attempt_count": 3,
                "attempt_success_count": 1,
                "attempt_skipped_count": 1,
                "attempt_error_count": 1,
                "attempt_reason_codes": {
                    "success": 1,
                    "domain_required": 1,
                    "provider_http_error": 1,
                },
                "result_count": 2,
                "latency_ms": 81.4,
                "request_id": "req-orch-1",
            },
            "createdAt": created_at_1,
        },
        {
            "id": "orch-2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "company_enrichment_orchestrated",
            "payload": {
                "selected_provider": "",
                "attempt_success_count": 0,
                "attempt_skipped_count": 2,
                "attempt_error_count": 0,
                "attempt_reason_codes": {
                    "domain_required": 2,
                    "": 3,
                    "bad_count": "invalid",
                },
                "latency_ms": 9.5,
                "request_id": "req-orch-2",
            },
            "createdAt": created_at_2,
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

    assert summary["eventCount"] == 2
    assert summary["orchestrationAudit"]["eventCount"] == 2
    assert summary["orchestrationAudit"]["bySelectedProvider"]["apollo"] == 1
    assert summary["orchestrationAudit"]["bySelectedProvider"]["none"] == 1
    assert summary["orchestrationAudit"]["attemptStatusCounts"]["success"] == 1
    assert summary["orchestrationAudit"]["attemptStatusCounts"]["skipped"] == 3
    assert summary["orchestrationAudit"]["attemptStatusCounts"]["error"] == 1
    assert summary["orchestrationAudit"]["reasonCodeCounts"]["domain_required"] == 3
    assert summary["orchestrationAudit"]["reasonCodeCounts"]["provider_http_error"] == 1
    assert summary["orchestrationAudit"]["reasonCodeCounts"]["success"] == 1
    assert summary["orchestrationAudit"]["maxAttemptCount"] == 3
    assert summary["orchestrationAudit"]["avgAttemptCount"] == 2.5
    assert summary["orchestrationAudit"]["maxLatencyMs"] == 81.4
    assert summary["orchestrationAudit"]["avgLatencyMs"] == 45.45
    assert len(summary["orchestrationAudit"]["trendByDay"]) == 1
    assert summary["orchestrationAudit"]["trendByDay"][0]["date"] == recent_base.date().isoformat()
    assert summary["orchestrationAudit"]["trendByDay"][0]["events"] == 2
    assert summary["orchestrationAudit"]["trendByDay"][0]["attemptSuccessCount"] == 1
    assert summary["orchestrationAudit"]["trendByDay"][0]["attemptSkippedCount"] == 3
    assert summary["orchestrationAudit"]["trendByDay"][0]["attemptErrorCount"] == 1
    assert summary["orchestrationAudit"]["latestEventAt"] == created_at_2
    assert summary["trendByDay"][0]["orchestrationEvents"] == 2
    assert summary["recentEvents"][0]["orchestrationSelectedProvider"] == ""
    assert summary["recentEvents"][0]["orchestrationAttemptSuccessCount"] == 0
    assert summary["recentEvents"][0]["orchestrationAttemptSkippedCount"] == 2
    assert summary["recentEvents"][0]["orchestrationAttemptErrorCount"] == 0
    assert summary["recentEvents"][0]["orchestrationResultCount"] is None
    assert summary["recentEvents"][1]["orchestrationSelectedProvider"] == "apollo"
    assert summary["recentEvents"][1]["orchestrationAttemptCount"] == 3
    assert summary["recentEvents"][1]["orchestrationResultCount"] == 2


def test_telemetry_summary_aggregates_governance_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "payload": {"status": "ACTION_REQUIRED"},
            "createdAt": created_at_1,
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_baseline_governance_evaluated",
            "payload": {
                "status": "PASS",
                "governance_packet_validation_status": "READY",
                "governance_packet_validation_within_freshness": True,
            },
            "createdAt": created_at_2,
        },
        {
            "id": "3",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_3,
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
    assert summary["eventCount"] == 3
    assert summary["governanceAudit"]["eventCount"] == 2
    assert summary["governanceAudit"]["snapshotEvaluationCount"] == 1
    assert summary["governanceAudit"]["baselineEvaluationCount"] == 1
    assert summary["governanceAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["governanceAudit"]["statusCounts"]["PASS"] == 1
    assert summary["governanceAudit"]["latestEvaluatedAt"] == created_at_2
    assert summary["packetValidationAudit"]["eventCount"] == 1
    assert summary["packetValidationAudit"]["statusCounts"]["READY"] == 1
    assert summary["packetValidationAudit"]["withinFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["outsideFreshnessCount"] == 0
    assert summary["packetValidationAudit"]["missingFreshnessCount"] == 0
    assert summary["packetValidationAudit"]["latestEvaluatedAt"] == created_at_2
    assert summary["recentEvents"][1]["governanceStatus"] == "PASS"
    assert summary["recentEvents"][1]["governanceSchemaAllParityOk"] is None
    assert summary["recentEvents"][1]["governancePacketValidationStatus"] == "READY"
    assert summary["recentEvents"][1]["governancePacketValidationWithinFreshness"] is True


def test_telemetry_summary_aggregates_governance_schema_parity_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "gs1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_governance_schema_viewed",
            "payload": {
                "status": "READY",
                "rollout_blocked": False,
                "reason_codes": ["schema_ready"],
                "reason_code_count": 1,
                "recommended_commands": ["npm run verify:governance:schema:preflight"],
                "recommended_command_count": 1,
                "reason_code_parity_ok": True,
                "recommended_command_parity_ok": True,
                "handoff_parity_ok": True,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "gs2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_governance_schema_viewed",
            "payload": {
                "status": "ACTION_REQUIRED",
                "rollout_blocked": True,
                "reason_codes": ["schema_override_invalid"],
                "reason_code_count": 1,
                "recommended_commands": ["npm run verify:ci:sales:extended"],
                "recommended_command_count": 1,
                "reason_code_parity_ok": False,
                "recommended_command_parity_ok": False,
                "handoff_parity_ok": False,
            },
            "createdAt": created_at_2,
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
    assert summary["eventCount"] == 2
    assert summary["governanceSchemaAudit"]["eventCount"] == 2
    assert summary["governanceSchemaAudit"]["statusCounts"]["READY"] == 1
    assert summary["governanceSchemaAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 1
    assert summary["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 1
    assert summary["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 1
    assert summary["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 1
    assert summary["governanceSchemaAudit"]["handoffParityPassCount"] == 1
    assert summary["governanceSchemaAudit"]["handoffParityFailCount"] == 1
    assert summary["governanceSchemaAudit"]["allParityPassedCount"] == 1
    assert summary["governanceSchemaAudit"]["allParityFailedCount"] == 1
    assert summary["governanceSchemaAudit"]["rolloutBlockedCount"] == 1
    assert summary["governanceSchemaAudit"]["latestEvaluatedAt"] == created_at_2
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is False
    assert (
        summary["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is False
    )
    assert summary["recentEvents"][0]["governanceSchemaHandoffParityOk"] is False
    assert summary["recentEvents"][0]["governanceSchemaAllParityOk"] is False
    assert summary["recentEvents"][0]["governanceSchemaRolloutBlocked"] is True
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeCount"] == 1
    assert summary["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] == 1
    assert summary["recentEvents"][1]["governanceSchemaReasonCodeParityOk"] is True
    assert (
        summary["recentEvents"][1]["governanceSchemaRecommendedCommandParityOk"] is True
    )
    assert summary["recentEvents"][1]["governanceSchemaHandoffParityOk"] is True
    assert summary["recentEvents"][1]["governanceSchemaAllParityOk"] is True
    assert summary["recentEvents"][1]["governanceSchemaRolloutBlocked"] is False


def test_telemetry_summary_normalizes_malformed_governance_schema_recent_event_fields(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "gs-malformed-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_governance_schema_viewed",
            "payload": {
                "status": "READY",
                "rollout_blocked": "true",
                "reason_code_count": True,
                "recommended_command_count": " 2 ",
                "reason_code_parity_ok": "false",
                "recommended_command_parity_ok": 0,
                "handoff_parity_ok": "no",
            },
            "createdAt": created_at,
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
    assert summary["eventCount"] == 1
    assert summary["governanceSchemaAudit"]["eventCount"] == 1
    assert summary["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["handoffParityPassCount"] == 0
    assert summary["governanceSchemaAudit"]["handoffParityFailCount"] == 0
    assert summary["governanceSchemaAudit"]["allParityPassedCount"] == 0
    assert summary["governanceSchemaAudit"]["allParityFailedCount"] == 0
    assert summary["governanceSchemaAudit"]["rolloutBlockedCount"] == 0
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is None
    assert (
        summary["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is None
    )
    assert summary["recentEvents"][0]["governanceSchemaHandoffParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaAllParityOk"] is None
    assert summary["recentEvents"][0]["governanceSchemaRolloutBlocked"] is None
    assert summary["recentEvents"][0]["governanceSchemaReasonCodeCount"] is None
    assert summary["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] == 2


def test_telemetry_summary_normalizes_governance_and_packet_status_tokens(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=3)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_4 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "gs-status-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "payload": {"status": " ready "},
            "createdAt": created_at_1,
        },
        {
            "id": "gs-status-2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_baseline_governance_evaluated",
            "payload": {
                "status": {"unexpected": "value"},
                "request_id": "req-packet-status-normalized",
                "governance_packet_validation_status": " action required ",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_2,
        },
        {
            "id": "gs-status-3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_governance_schema_viewed",
            "payload": {"status": " action required "},
            "createdAt": created_at_3,
        },
        {
            "id": "gs-status-4",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-packet-status-unknown",
                "governance_packet_validation_status": " !!! ",
                "governance_packet_validation_within_freshness": True,
            },
            "createdAt": created_at_4,
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

    assert summary["eventCount"] == 4
    assert summary["governanceAudit"]["eventCount"] == 2
    assert summary["governanceAudit"]["statusCounts"]["READY"] == 1
    assert summary["governanceAudit"]["statusCounts"]["UNKNOWN"] == 1
    assert summary["governanceSchemaAudit"]["eventCount"] == 1
    assert summary["governanceSchemaAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["packetValidationAudit"]["eventCount"] == 2
    assert summary["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["packetValidationAudit"]["statusCounts"]["UNKNOWN"] == 1
    assert summary["packetValidationAudit"]["withinFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["missingFreshnessCount"] == 0

    recent_by_request_id = {
        event.get("requestId"): event for event in summary["recentEvents"]
    }
    assert (
        recent_by_request_id["req-packet-status-normalized"][
            "governancePacketValidationStatus"
        ]
        == "ACTION_REQUIRED"
    )
    assert (
        recent_by_request_id["req-packet-status-normalized"]["governanceStatus"]
        is None
    )
    assert (
        recent_by_request_id["req-packet-status-unknown"][
            "governancePacketValidationStatus"
        ]
        is None
    )
    assert recent_by_request_id["req-packet-status-unknown"]["governanceStatus"] is None
    governance_status_values = sorted(
        {
            event.get("governanceStatus")
            for event in summary["recentEvents"]
            if event.get("governanceStatus") is not None
        }
    )
    assert governance_status_values == ["ACTION_REQUIRED", "READY"]


def test_telemetry_summary_aggregates_mixed_packet_validation_freshness_buckets_over_multiple_days(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(days=1, hours=3)).isoformat()
    created_at_2 = (recent_base - timedelta(hours=2)).isoformat()
    created_at_3 = (recent_base - timedelta(hours=1)).isoformat()
    created_at_4 = (recent_base - timedelta(minutes=30)).isoformat()
    telemetry_docs = [
        {
            "id": "m1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "decision": "PROCEED",
                "traceability_ready": True,
                "governance_packet_validation_status": "READY",
                "governance_packet_validation_within_freshness": True,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "m2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "decision": "HOLD",
                "traceability_ready": False,
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_2,
        },
        {
            "id": "m3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "decision": "PROCEED",
                "traceability_ready": True,
                "governance_packet_validation_status": "READY",
            },
            "createdAt": created_at_3,
        },
        {
            "id": "m4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_4,
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
    assert summary["eventCount"] == 4
    assert summary["packetValidationAudit"]["eventCount"] == 3
    assert summary["packetValidationAudit"]["statusCounts"]["READY"] == 2
    assert summary["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert summary["packetValidationAudit"]["withinFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["missingFreshnessCount"] == 1
    assert summary["packetValidationAudit"]["latestEvaluatedAt"] == created_at_3
    assert len(summary["trendByDay"]) == 2
    assert summary["trendByDay"][0]["date"] == created_at_1[:10]
    assert summary["trendByDay"][1]["date"] == recent_base.date().isoformat()
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] is None
    assert summary["recentEvents"][1]["governancePacketValidationStatus"] == "READY"
    assert summary["recentEvents"][1]["governancePacketValidationWithinFreshness"] is None


def test_telemetry_summary_filters_recent_events_to_packet_validation_rows_when_requested(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    telemetry_docs = [
        {
            "id": "p1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "decision": "HOLD",
                "traceability_ready": False,
                "request_id": "req-traceability-packet",
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "p2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2, "request_id": "req-sales-plain"},
            "createdAt": created_at_2,
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            packet_only_recent_events=True,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 2
    assert summary["recentEventsFilter"] == "packet"
    assert summary["recentEventsTotalCount"] == 2
    assert summary["recentEventsFilteredCount"] == 1
    assert summary["recentEventsPacketValidationCount"] == 1
    assert summary["recentEventsNonPacketCount"] == 1
    assert len(summary["recentEvents"]) == 1
    assert summary["recentEvents"][0]["requestId"] == "req-traceability-packet"
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"


def test_telemetry_summary_defaults_recent_event_filter_metadata_to_all(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    telemetry_docs = [
        {
            "id": "fa1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-packet-default-all",
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "fa2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2, "request_id": "req-sales-default-all"},
            "createdAt": created_at_2,
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
    assert summary["eventCount"] == 2
    assert summary["recentEventsFilter"] == "all"
    assert summary["recentEventsTotalCount"] == 2
    assert summary["recentEventsFilteredCount"] == 2
    assert summary["recentEventsPacketValidationCount"] == 1
    assert summary["recentEventsNonPacketCount"] == 1
    assert summary["recentEventsGovernanceStatusCounts"] == {}
    assert summary["recentEventsPacketValidationStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert len(summary["recentEvents"]) == 2


def test_telemetry_summary_filters_recent_events_by_governance_status_token(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    telemetry_docs = [
        {
            "id": "fg1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "payload": {
                "request_id": "req-governance-action-required",
                "status": " ACTION REQUIRED ",
            },
            "createdAt": created_at_1,
        },
        {
            "id": "fg2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_baseline_governance_evaluated",
            "payload": {
                "request_id": "req-governance-pass",
                "status": "PASS",
            },
            "createdAt": created_at_2,
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            governance_status="action required",
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 2
    assert summary["recentEventsFilter"] == "all"
    assert summary["recentEventsGovernanceStatusFilter"] == "ACTION_REQUIRED"
    assert summary["recentEventsPacketValidationStatusFilter"] is None
    assert summary["recentEventsFilteredCount"] == 1
    assert summary["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert summary["recentEventsPacketValidationStatusCounts"] == {}
    assert len(summary["recentEvents"]) == 1
    assert summary["recentEvents"][0]["requestId"] == "req-governance-action-required"
    assert summary["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"


def test_telemetry_summary_filters_recent_events_by_packet_validation_status_token(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=2)).isoformat()
    telemetry_docs = [
        {
            "id": "fp1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-packet-ready",
                "governance_packet_validation_status": " ready ",
                "governance_packet_validation_within_freshness": True,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "fp2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-packet-action-required",
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_2,
        },
        {
            "id": "fp3",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "payload": {"request_id": "req-non-packet"},
            "createdAt": created_at_3,
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            packet_validation_status="ready",
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 3
    assert summary["recentEventsFilter"] == "all"
    assert summary["recentEventsGovernanceStatusFilter"] is None
    assert summary["recentEventsPacketValidationStatusFilter"] == "READY"
    assert summary["recentEventsFilteredCount"] == 1
    assert summary["recentEventsGovernanceStatusCounts"] == {}
    assert summary["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert len(summary["recentEvents"]) == 1
    assert summary["recentEvents"][0]["requestId"] == "req-packet-ready"
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] == "READY"


def test_telemetry_summary_recent_event_status_count_maps_are_sorted_by_status_token(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    telemetry_docs = [
        {
            "id": "sc1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-status-count-pass-ready",
                "status": "PASS",
                "governance_packet_validation_status": "READY",
            },
            "createdAt": created_at_1,
        },
        {
            "id": "sc2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-status-count-action-required",
                "status": "ACTION_REQUIRED",
                "governance_packet_validation_status": "ACTION_REQUIRED",
            },
            "createdAt": created_at_2,
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
    assert summary["recentEventsGovernanceStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "PASS": 1,
    }
    assert list(summary["recentEventsGovernanceStatusCounts"].keys()) == [
        "ACTION_REQUIRED",
        "PASS",
    ]
    assert summary["recentEventsPacketValidationStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "READY": 1,
    }
    assert list(summary["recentEventsPacketValidationStatusCounts"].keys()) == [
        "ACTION_REQUIRED",
        "READY",
    ]


def test_telemetry_summary_recent_event_status_count_provenance_fields(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "scp1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-provenance-pass-ready",
                "status": "PASS",
                "governance_packet_validation_status": "READY",
            },
            "createdAt": created_at,
        }
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
    assert summary["recentEventsGovernanceStatusCounts"] == {"PASS": 1}
    assert summary["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsSource"] == "server"
    assert summary["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert summary["recentEventsGovernanceStatusCountsMismatch"] is False
    assert summary["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert summary["recentEventsGovernanceStatusCountsServer"] == {"PASS": 1}
    assert summary["recentEventsPacketValidationStatusCountsServer"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsFallback"] == {"PASS": 1}
    assert summary["recentEventsPacketValidationStatusCountsFallback"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsPosture"] == "server_consistent"
    assert summary["recentEventsPacketValidationStatusCountsPosture"] == "server_consistent"
    assert summary["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert summary["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False


def test_telemetry_summary_recent_event_status_count_provenance_local_for_empty_rollups(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "scp2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "payload": {
                "request_id": "req-provenance-no-status",
                "status": "!!!",
                "governance_packet_validation_status": "###",
            },
            "createdAt": created_at,
        }
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
    assert summary["recentEventsGovernanceStatusCounts"] == {}
    assert summary["recentEventsPacketValidationStatusCounts"] == {}
    assert summary["recentEventsGovernanceStatusCountsSource"] == "local"
    assert summary["recentEventsPacketValidationStatusCountsSource"] == "local"
    assert summary["recentEventsGovernanceStatusCountsMismatch"] is False
    assert summary["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert summary["recentEventsGovernanceStatusCountsServer"] == {}
    assert summary["recentEventsPacketValidationStatusCountsServer"] == {}
    assert summary["recentEventsGovernanceStatusCountsFallback"] == {}
    assert summary["recentEventsPacketValidationStatusCountsFallback"] == {}
    assert summary["recentEventsGovernanceStatusCountsPosture"] == "local_fallback"
    assert summary["recentEventsPacketValidationStatusCountsPosture"] == "local_fallback"
    assert summary["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert summary["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False


def test_telemetry_summary_recent_event_status_count_provenance_prefers_event_root_status_fields(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "scp3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "governanceStatus": "ACTION_REQUIRED",
            "governancePacketValidationStatus": "READY",
            "payload": {
                "request_id": "req-provenance-event-root-preferred",
                "status": "PASS",
                "governance_packet_validation_status": "ACTION_REQUIRED",
            },
            "createdAt": created_at,
        }
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
    assert summary["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert summary["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsSource"] == "server"
    assert summary["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert summary["recentEventsGovernanceStatusCountsMismatch"] is False
    assert summary["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert summary["recentEventsGovernanceStatusCountsServer"] == {"ACTION_REQUIRED": 1}
    assert summary["recentEventsPacketValidationStatusCountsServer"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsFallback"] == {"ACTION_REQUIRED": 1}
    assert summary["recentEventsPacketValidationStatusCountsFallback"] == {"READY": 1}
    assert summary["recentEventsGovernanceStatusCountsPosture"] == "server_consistent"
    assert summary["recentEventsPacketValidationStatusCountsPosture"] == "server_consistent"
    assert summary["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert summary["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert summary["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False
    assert len(summary["recentEvents"]) == 1
    assert summary["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] == "READY"


def test_telemetry_summary_recent_event_status_count_provenance_surfaces_server_drift_posture(
    monkeypatch,
):
    created_at = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    ).isoformat()
    telemetry_docs = [
        {
            "id": "scp4",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-provenance-server-drift",
                "status": "PASS",
                "governance_packet_validation_status": "READY",
            },
            "createdAt": created_at,
        }
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setattr(real_integrations, "_status_count_maps_equal", lambda left, right: False)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["recentEventsGovernanceStatusCountsSource"] == "server"
    assert summary["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert summary["recentEventsGovernanceStatusCountsMismatch"] is True
    assert summary["recentEventsPacketValidationStatusCountsMismatch"] is True
    assert summary["recentEventsGovernanceStatusCountsPosture"] == "server_drift"
    assert summary["recentEventsPacketValidationStatusCountsPosture"] == "server_drift"
    assert summary["recentEventsGovernanceStatusCountsPostureSeverity"] == "warning"
    assert summary["recentEventsPacketValidationStatusCountsPostureSeverity"] == "warning"
    assert summary["recentEventsGovernanceStatusCountsRequiresInvestigation"] is True
    assert summary["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is True


def test_telemetry_summary_rejects_blank_status_filters(monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    try:
        _run(
            real_integrations.get_integrations_telemetry_summary(
                days=30,
                limit=500,
                governance_status="   ",
                current_user={"id": "u1", "email": "sales@example.com"},
            )
        )
        assert False, "Expected HTTPException for blank governance status filter"
    except real_integrations.HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "governance_status must be a non-empty status token"

    try:
        _run(
            real_integrations.get_integrations_telemetry_summary(
                days=30,
                limit=500,
                packet_validation_status="!!!",
                current_user={"id": "u1", "email": "sales@example.com"},
            )
        )
        assert False, "Expected HTTPException for blank packet validation status filter"
    except real_integrations.HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "packet_validation_status must be a non-empty status token"


def test_telemetry_summary_packet_filter_handles_malformed_payload_mix_without_crashing(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_4 = (recent_base - timedelta(minutes=3)).isoformat()
    telemetry_docs = [
        {
            "id": "pm1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {
                "request_id": "req-packet-healthy",
                "decision": "HOLD",
                "traceability_ready": False,
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
            "createdAt": created_at_1,
        },
        {
            "id": "pm2",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": "unexpected-string-payload",
            "createdAt": created_at_2,
        },
        {
            "id": "pm3",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "payload": ["unexpected", "list"],
            "createdAt": created_at_3,
        },
        {
            "id": "pm4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2, "request_id": "req-sales"},
            "createdAt": created_at_4,
        },
    ]
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            packet_only_recent_events=True,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 4
    assert summary["recentEventsFilter"] == "packet"
    assert summary["recentEventsTotalCount"] == 4
    assert summary["recentEventsFilteredCount"] == 1
    assert summary["recentEventsPacketValidationCount"] == 1
    assert summary["recentEventsNonPacketCount"] == 3
    assert len(summary["recentEvents"]) == 1
    assert summary["recentEvents"][0]["requestId"] == "req-packet-healthy"
    assert summary["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"


def test_telemetry_summary_recent_event_distribution_counts_use_capped_recent_window(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=59, second=0, microsecond=0
    )
    telemetry_docs = []
    for idx in range(60):
        has_packet_marker = idx < 45
        payload = {"request_id": f"req-window-{idx}"}
        if has_packet_marker:
            payload["governance_packet_validation_status"] = "READY"
            payload["governance_packet_validation_within_freshness"] = True
        telemetry_docs.append(
            {
                "id": f"w{idx}",
                "userId": "u1",
                "provider": "integrations" if has_packet_marker else "sales_intelligence",
                "eventType": (
                    "integrations_traceability_status_evaluated"
                    if has_packet_marker
                    else "sales_pipeline_forecast_generated"
                ),
                "payload": payload,
                "createdAt": (recent_base - timedelta(minutes=idx)).isoformat(),
            }
        )

    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    summary = _run(
        real_integrations.get_integrations_telemetry_summary(
            days=30,
            limit=500,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert summary["eventCount"] == 60
    assert summary["recentEventsTotalCount"] == 50
    assert summary["recentEventsFilteredCount"] == 50
    assert summary["recentEventsPacketValidationCount"] == 45
    assert summary["recentEventsNonPacketCount"] == 5
    assert len(summary["recentEvents"]) == 50


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
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=3)).isoformat()
    created_at_2 = (recent_base - timedelta(minutes=2)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_4 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "payload": {"latency_ms": 1200},
            "createdAt": created_at_1,
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "sendgrid",
            "eventType": "sendgrid_send_success",
            "payload": {"latency_ms": 500},
            "createdAt": created_at_2,
        },
        {
            "id": "3",
            "userId": "u1",
            "provider": "clearbit",
            "eventType": "clearbit_enrichment_success",
            "payload": {"latency_ms": 900},
            "createdAt": created_at_3,
        },
        {
            "id": "4",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_4,
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
    assert result["gates"]["orchestrationAttemptErrorPassed"] is True
    assert result["gates"]["orchestrationAttemptSkippedPassed"] is True
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
    assert result["orchestrationAudit"]["observedAttemptErrorCount"] == 0
    assert result["orchestrationAudit"]["observedAttemptSkippedCount"] == 0
    assert result["orchestrationAudit"]["maxAttemptErrorCountThreshold"] >= 0
    assert result["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] >= 0
    roles = {r["role"] for r in result["signoff"]["requiredApprovals"]}
    assert "Release Manager" in roles
    assert "Sales Ops Lead" in roles
    required_evidence = set(result["signoff"]["requiredEvidence"])
    assert "connector_governance_weekly_report.json" in required_evidence
    assert "governance_handoff_export.json" in required_evidence
    assert "governance_history_export.json" in required_evidence
    assert "governance_packet_validation.json" in required_evidence
    assert len(fake_db.integration_telemetry.inserted) == 1
    audit_event = fake_db.integration_telemetry.inserted[0]
    assert audit_event["eventType"] == "integrations_traceability_status_evaluated"
    assert audit_event["payload"]["decision"] == "PROCEED"
    assert audit_event["payload"]["traceability_ready"] is True


def test_slo_gates_ignore_existing_traceability_audit_events_for_gate_counts(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "audit-1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "integrations_traceability_status_evaluated",
            "payload": {"decision": "PROCEED", "traceability_ready": True},
            "createdAt": created_at_1,
        },
        {
            "id": "sales-1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_2,
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
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_success",
            "payload": {"latency_ms": 8000},
            "createdAt": created_at_1,
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "apollo",
            "eventType": "apollo_search_error",
            "payload": {"error": "timeout", "latency_ms": 8500},
            "createdAt": created_at_2,
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
    assert result["gates"]["orchestrationAttemptErrorPassed"] is True
    assert result["gates"]["orchestrationAttemptSkippedPassed"] is True
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
    assert "connector_governance_weekly_report.json" in result["signoff"]["requiredEvidence"]
    assert "governance_handoff_export.json" in result["signoff"]["requiredEvidence"]
    assert "governance_history_export.json" in result["signoff"]["requiredEvidence"]
    assert "governance_packet_validation.json" in result["signoff"]["requiredEvidence"]


def test_slo_gates_fail_on_sales_schema_v2_coverage(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_1,
        },
        {
            "id": "2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_campaign_created",
            "schemaVersion": 1,
            "payload": {"schema_version": 1},
            "createdAt": created_at_2,
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


def test_slo_gates_can_hold_on_orchestration_attempt_errors(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "o1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "company_enrichment_orchestrated",
            "payload": {
                "attempt_error_count": 2,
                "attempt_skipped_count": 0,
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
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            max_error_rate_pct=100,
            min_schema_v2_pct=90,
            min_schema_v2_sample_count=1,
            max_orchestration_attempt_error_count=1,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["decision"] == "HOLD"
    assert result["gates"]["overallPassed"] is False
    assert result["gates"]["orchestrationAttemptErrorPassed"] is False
    assert result["gates"]["orchestrationAttemptSkippedPassed"] is True
    assert result["orchestrationAudit"]["observedAttemptErrorCount"] == 2
    assert result["orchestrationAudit"]["maxAttemptErrorCountThreshold"] == 1
    assert any(alert["gate"] == "orchestration_attempt_error" for alert in result["alerts"])
    assert any(action["ownerRole"] == "Integrations Engineer" for action in result["rolloutActions"])


def test_slo_gates_can_hold_on_orchestration_attempt_skipped(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "o1",
            "userId": "u1",
            "provider": "integrations",
            "eventType": "company_enrichment_orchestrated",
            "payload": {
                "attempt_error_count": 0,
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
    fake_db = _FakeDb(telemetry_docs=telemetry_docs)
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    result = _run(
        real_integrations.evaluate_integrations_slo_gates(
            days=30,
            limit=1000,
            max_error_rate_pct=100,
            min_schema_v2_pct=90,
            min_schema_v2_sample_count=1,
            max_orchestration_attempt_skipped_count=2,
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )
    assert result["decision"] == "HOLD"
    assert result["gates"]["overallPassed"] is False
    assert result["gates"]["orchestrationAttemptErrorPassed"] is True
    assert result["gates"]["orchestrationAttemptSkippedPassed"] is False
    assert result["orchestrationAudit"]["observedAttemptSkippedCount"] == 3
    assert result["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] == 2
    assert any(alert["gate"] == "orchestration_attempt_skipped" for alert in result["alerts"])
    assert any(action["ownerRole"] == "Sales Ops Lead" for action in result["rolloutActions"])


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

    for invalid_orchestration_error_count in [-1, 5001]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=1000,
                    max_orchestration_attempt_error_count=invalid_orchestration_error_count,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid max_orchestration_attempt_error_count"
        except real_integrations.HTTPException as exc:
            assert exc.status_code == 400

    for invalid_orchestration_skipped_count in [-1, 5001]:
        try:
            _run(
                real_integrations.evaluate_integrations_slo_gates(
                    days=7,
                    limit=1000,
                    max_orchestration_attempt_skipped_count=invalid_orchestration_skipped_count,
                    current_user={"id": "u1", "email": "sales@example.com"},
                )
            )
            assert False, "Expected HTTPException for invalid max_orchestration_attempt_skipped_count"
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
