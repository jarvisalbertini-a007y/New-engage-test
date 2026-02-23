from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from routes import sales_intelligence


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get(field, ""), reverse=reverse)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeUpdateResult:
    def __init__(self, matched_count, modified_count):
        self.matched_count = matched_count
        self.modified_count = modified_count


def _set_nested(doc, key_path, value):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    target[keys[-1]] = value


def _inc_nested(doc, key_path, amount):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    leaf = keys[-1]
    target[leaf] = int(target.get(leaf, 0)) + int(amount)


def _add_to_set_nested(doc, key_path, value):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    leaf = keys[-1]
    if leaf not in target or not isinstance(target[leaf], list):
        target[leaf] = []
    if value not in target[leaf]:
        target[leaf].append(value)


class _FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.inserted = []
        self.updated = []

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.docs.append(doc)
        return {"ok": 1}

    async def find_one(self, flt=None, *_args, **_kwargs):
        flt = flt or {}
        for doc in self.docs:
            if _matches_filter(doc, flt):
                return doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        for doc in self.docs:
            if _matches_filter(doc, flt):
                if "$set" in payload:
                    for key, value in payload["$set"].items():
                        _set_nested(doc, key, value)
                if "$inc" in payload:
                    for key, value in payload["$inc"].items():
                        _inc_nested(doc, key, value)
                if "$addToSet" in payload:
                    for key, value in payload["$addToSet"].items():
                        _add_to_set_nested(doc, key, value)
                self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
                return _FakeUpdateResult(1, 1)
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return _FakeUpdateResult(0, 0)

    def find(self, flt=None, *_args, **_kwargs):
        flt = flt or {}
        docs = [d for d in self.docs if _matches_filter(d, flt)]
        return _FakeCursor(docs)


def _matches_filter(doc, flt):
    for key, expected in flt.items():
        if isinstance(expected, dict):
            if "$gte" in expected and doc.get(key, "") < expected["$gte"]:
                return False
            if "$nin" in expected and doc.get(key) in expected["$nin"]:
                return False
            if "$in" in expected and doc.get(key) not in expected["$in"]:
                return False
            continue
        if doc.get(key) != expected:
            return False
    return True


class _FakeDb:
    def __init__(
        self,
        email_events=None,
        prospects=None,
        outcomes=None,
        chat_sessions=None,
        companies=None,
        campaigns=None,
        ab_tests=None,
    ):
        self.email_events = _FakeCollection(email_events or [])
        self.prospects = _FakeCollection(prospects or [])
        self.lead_score_outcomes = _FakeCollection(outcomes or [])
        self.chat_sessions = _FakeCollection(chat_sessions or [])
        self.companies = _FakeCollection(companies or [])
        self.sales_campaigns = _FakeCollection(campaigns or [])
        self.ab_tests = _FakeCollection(ab_tests or [])
        self.integration_telemetry = _FakeCollection([])
        self.prediction_feedback = _FakeCollection([])


def _build_client(monkeypatch, fake_db, authenticated=True):
    app = FastAPI()
    app.include_router(sales_intelligence.router, prefix="/api/sales-intelligence")
    if authenticated:
        app.dependency_overrides[sales_intelligence.get_current_user] = (
            lambda: {"id": "u1", "email": "sales@example.com"}
        )
    else:
        def _raise_unauthorized():
            raise HTTPException(status_code=401, detail="Not authenticated")
        app.dependency_overrides[sales_intelligence.get_current_user] = _raise_unauthorized
    monkeypatch.setattr(sales_intelligence, "get_db", lambda: fake_db)
    return TestClient(app)


def test_phrase_analytics_requires_auth(monkeypatch):
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=False)
    response = client.get("/api/sales-intelligence/analytics/phrases")
    assert response.status_code == 401


def test_pipeline_forecast_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_PIPELINE_FORECAST", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/forecast/pipeline")
    assert response.status_code == 503


def test_pipeline_forecast_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_PIPELINE_FORECAST", "true")
    fake_db = _FakeDb(
        prospects=[
            {"id": "p1", "userId": "u1", "leadScore": 81, "status": "open"},
            {"id": "p2", "userId": "u1", "leadScore": 48, "status": "open"},
            {"id": "p3", "userId": "u1", "leadScore": 23, "status": "closed_won"},
        ],
        outcomes=[
            {"userId": "u1", "outcome": "won", "scoreAtOutcome": 80},
            {"userId": "u1", "outcome": "lost", "scoreAtOutcome": 40},
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/forecast/pipeline?window_days=120")
    assert response.status_code == 200
    payload = response.json()
    assert payload["windowDays"] == 120
    assert payload["sampleSize"]["openProspects"] == 2
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_pipeline_forecast_generated"


def test_sales_intelligence_telemetry_includes_request_id_and_schema(monkeypatch):
    fake_db = _FakeDb(
        prospects=[
            {"id": "p1", "userId": "u1", "leadScore": 80, "status": "open"},
        ],
        outcomes=[
            {"userId": "u1", "outcome": "won", "scoreAtOutcome": 78},
        ],
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Pricing", "message": "Can you send options?"},
                "timestamp": "2026-02-22T12:00:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    headers = {"X-Request-Id": "req-sales-telemetry-123"}

    forecast_response = client.get(
        "/api/sales-intelligence/forecast/pipeline?window_days=90",
        headers=headers,
    )
    phrase_response = client.get(
        "/api/sales-intelligence/analytics/phrases?window_days=60&min_exposure=1&limit=10",
        headers=headers,
    )
    prediction_response = client.post(
        "/api/sales-intelligence/prediction/response",
        headers=headers,
        json={"message": "Can we schedule a demo this week?"},
    )

    assert forecast_response.status_code == 200
    assert phrase_response.status_code == 200
    assert prediction_response.status_code == 200
    assert len(fake_db.integration_telemetry.inserted) == 3

    for event in fake_db.integration_telemetry.inserted:
        assert event["schemaVersion"] == 2
        assert event["payload"]["schema_version"] == 2
        assert event["payload"]["request_id"] == "req-sales-telemetry-123"


def test_sales_intelligence_telemetry_uses_correlation_id_fallback(monkeypatch):
    fake_db = _FakeDb(
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Pricing", "message": "Share options"},
                "timestamp": "2026-02-22T12:00:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get(
        "/api/sales-intelligence/analytics/phrases?window_days=60&min_exposure=1&limit=10",
        headers={"X-Correlation-Id": "corr-sales-telemetry-7"},
    )
    assert response.status_code == 200
    assert len(fake_db.integration_telemetry.inserted) == 1
    event = fake_db.integration_telemetry.inserted[0]
    assert event["payload"]["request_id"] == "corr-sales-telemetry-7"
    assert event["payload"]["schema_version"] == 2
    assert event["schemaVersion"] == 2


def test_sales_intelligence_request_id_propagates_across_endpoint_families(monkeypatch):
    fake_db = _FakeDb(
        prospects=[
            {
                "id": "p1",
                "userId": "u1",
                "leadScore": 79,
                "status": "open",
                "firstName": "Alex",
                "lastName": "Ng",
                "companyId": "c1",
                "engagement": {"opens": 3, "clicks": 1, "replies": 1},
            }
        ],
        outcomes=[{"userId": "u1", "outcome": "won", "scoreAtOutcome": 82}],
        chat_sessions=[
            {
                "userId": "u1",
                "message": "This looks useful.",
                "response": "Let's meet next week.",
                "timestamp": "2026-02-22T10:00:00+00:00",
            }
        ],
        companies=[{"id": "c1", "userId": "u1", "name": "Acme Inc"}],
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Book demo", "message": "Book a demo this week"},
                "timestamp": "2026-02-22T12:00:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    headers = {"X-Request-Id": "req-sales-all-endpoints-42"}

    assert client.get("/api/sales-intelligence/forecast/pipeline?window_days=90", headers=headers).status_code == 200
    assert client.get("/api/sales-intelligence/conversation/intelligence?limit=50", headers=headers).status_code == 200
    assert client.get("/api/sales-intelligence/engagement/multi-channel", headers=headers).status_code == 200
    assert client.get("/api/sales-intelligence/relationships/map?limit=100", headers=headers).status_code == 200
    assert client.get(
        "/api/sales-intelligence/analytics/phrases?window_days=60&min_exposure=1&limit=10",
        headers=headers,
    ).status_code == 200
    assert client.get(
        "/api/sales-intelligence/analytics/phrases/channel-summary?window_days=60&min_exposure=1&limit=5",
        headers=headers,
    ).status_code == 200
    assert client.post(
        "/api/sales-intelligence/prediction/response",
        headers=headers,
        json={"message": "Can we schedule a demo this week?"},
    ).status_code == 200

    create = client.post(
        "/api/sales-intelligence/campaigns",
        headers=headers,
        json={"name": "Q2 Outreach", "channels": ["email", "linkedin"]},
    )
    assert create.status_code == 200
    campaign_id = create.json()["id"]
    assert client.get("/api/sales-intelligence/campaigns", headers=headers).status_code == 200
    assert client.get(f"/api/sales-intelligence/campaigns/{campaign_id}", headers=headers).status_code == 200
    assert client.get(f"/api/sales-intelligence/campaigns/{campaign_id}/performance", headers=headers).status_code == 200
    assert (
        client.get(
            "/api/sales-intelligence/campaigns/performance/portfolio?window_days=30&limit=10",
            headers=headers,
        ).status_code
        == 200
    )
    assert client.post(f"/api/sales-intelligence/campaigns/{campaign_id}/activate", headers=headers, json={}).status_code == 200
    assert (
        client.post(
            f"/api/sales-intelligence/campaigns/{campaign_id}/metrics",
            headers=headers,
            json={"channel": "email", "sent": 5, "opened": 2, "replied": 1},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/sales-intelligence/prediction/feedback",
            headers=headers,
            json={
                "predictionId": "pred-req-id-1",
                "predictedProbability": 0.66,
                "outcome": "reply",
                "channel": "email",
            },
        ).status_code
        == 200
    )
    assert client.get("/api/sales-intelligence/prediction/performance?window_days=90", headers=headers).status_code == 200
    assert (
        client.get("/api/sales-intelligence/prediction/performance/report?window_days=90", headers=headers).status_code
        == 200
    )
    assert (
        client.get("/api/sales-intelligence/prediction/feedback/history?window_days=90&limit=50", headers=headers).status_code
        == 200
    )

    event_types = {item["eventType"] for item in fake_db.integration_telemetry.inserted}
    expected_types = {
        "sales_pipeline_forecast_generated",
        "sales_conversation_intelligence_generated",
        "sales_multi_channel_engagement_generated",
        "sales_relationship_map_generated",
        "sales_phrase_analytics_generated",
        "sales_phrase_channel_summary_generated",
        "sales_response_prediction_generated",
        "sales_campaign_created",
        "sales_campaign_list_viewed",
        "sales_campaign_viewed",
        "sales_campaign_performance_viewed",
        "sales_campaign_portfolio_viewed",
        "sales_campaign_activated",
        "sales_campaign_metrics_recorded",
        "sales_response_prediction_feedback_recorded",
        "sales_response_prediction_performance_viewed",
        "sales_response_prediction_report_viewed",
        "sales_response_prediction_feedback_history_viewed",
    }
    assert expected_types.issubset(event_types)
    for event in fake_db.integration_telemetry.inserted:
        assert event["schemaVersion"] == 2
        assert event["payload"]["schema_version"] == 2
        assert event["payload"]["request_id"] == "req-sales-all-endpoints-42"


def test_conversation_intelligence_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_CONVERSATION_INTELLIGENCE", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/conversation/intelligence")
    assert response.status_code == 503


def test_conversation_intelligence_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_CONVERSATION_INTELLIGENCE", "true")
    fake_db = _FakeDb(
        chat_sessions=[
            {
                "userId": "u1",
                "message": "Great timing, we should talk this week.",
                "response": "Awesome. Let's book tomorrow.",
                "timestamp": "2026-02-22T10:00:00+00:00",
            }
        ],
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Budget check", "message": "Price is too expensive."},
                "timestamp": "2026-02-22T12:00:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/conversation/intelligence?limit=50")
    assert response.status_code == 200
    payload = response.json()
    assert payload["totals"]["records"] >= 2
    assert payload["sources"]["chatSessions"] == 1
    assert payload["sources"]["emailEvents"] == 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert (
        fake_db.integration_telemetry.inserted[0]["eventType"]
        == "sales_conversation_intelligence_generated"
    )


def test_multi_channel_engagement_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_MULTI_CHANNEL_ENGAGEMENT", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/engagement/multi-channel")
    assert response.status_code == 503


def test_multi_channel_engagement_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_MULTI_CHANNEL_ENGAGEMENT", "true")
    fake_db = _FakeDb(
        campaigns=[
            {"userId": "u1", "channels": ["email", "linkedin"], "status": "active"},
            {"userId": "u1", "channels": ["phone"], "status": "draft"},
        ],
        ab_tests=[
            {"userId": "u1", "testType": "channel", "channelA": "email", "channelB": "sms"},
        ],
        prospects=[
            {"userId": "u1", "preferredChannel": "linkedin"},
            {"userId": "u1", "preferredChannel": "phone"},
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/engagement/multi-channel")
    assert response.status_code == 200
    payload = response.json()
    assert payload["coverageScore"] >= 50
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_multi_channel_engagement_generated"


def test_campaign_lifecycle_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)

    assert client.post("/api/sales-intelligence/campaigns", json={"name": "x", "channels": ["email"]}).status_code == 503
    assert client.get("/api/sales-intelligence/campaigns").status_code == 503
    assert client.get("/api/sales-intelligence/campaigns/performance/portfolio").status_code == 503
    assert client.get("/api/sales-intelligence/campaigns/c1").status_code == 503
    assert client.get("/api/sales-intelligence/campaigns/c1/performance").status_code == 503
    assert client.post("/api/sales-intelligence/campaigns/c1/activate", json={}).status_code == 503
    assert client.post("/api/sales-intelligence/campaigns/c1/metrics", json={"channel": "email", "sent": 1}).status_code == 503


def test_campaign_lifecycle_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "true")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)

    create = client.post(
        "/api/sales-intelligence/campaigns",
        json={
            "name": "Q2 Mid-Market Outreach",
            "objective": "pipeline_growth",
            "targetSegment": "mid_market",
            "channels": ["email", "linkedin"],
        },
    )
    assert create.status_code == 200
    campaign_id = create.json()["id"]

    list_response = client.get("/api/sales-intelligence/campaigns?status=draft")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/api/sales-intelligence/campaigns/{campaign_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == campaign_id

    activate = client.post(f"/api/sales-intelligence/campaigns/{campaign_id}/activate", json={})
    assert activate.status_code == 200
    assert activate.json()["status"] == "active"

    metrics = client.post(
        f"/api/sales-intelligence/campaigns/{campaign_id}/metrics",
        json={"channel": "email", "sent": 10, "opened": 4, "replied": 2},
    )
    assert metrics.status_code == 200
    metrics_doc = metrics.json()["metrics"]["email"]
    assert metrics_doc["sent"] == 10
    assert metrics_doc["opened"] == 4
    assert metrics_doc["replied"] == 2

    events = [item["eventType"] for item in fake_db.integration_telemetry.inserted]
    assert "sales_campaign_created" in events
    assert "sales_campaign_list_viewed" in events
    assert "sales_campaign_viewed" in events
    assert "sales_campaign_activated" in events
    assert "sales_campaign_metrics_recorded" in events


def test_campaign_performance_endpoint_success(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "true")
    fake_db = _FakeDb(
        campaigns=[
            {
                "id": "c1",
                "userId": "u1",
                "name": "Q2 Campaign",
                "status": "active",
                "channels": ["email", "linkedin"],
                "metrics": {
                    "email": {"sent": 100, "opened": 30, "replied": 9},
                    "linkedin": {"sent": 40, "opened": 14, "replied": 4},
                },
                "createdAt": "2026-02-22T00:00:00+00:00",
                "updatedAt": "2026-02-22T08:00:00+00:00",
            }
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/campaigns/c1/performance")
    assert response.status_code == 200
    payload = response.json()
    assert payload["campaignId"] == "c1"
    assert payload["totals"]["sent"] == 140
    assert payload["overall"]["replyRate"] > 0
    events = [item["eventType"] for item in fake_db.integration_telemetry.inserted]
    assert "sales_campaign_performance_viewed" in events


def test_campaign_portfolio_performance_success_and_filters(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "true")
    fake_db = _FakeDb(
        campaigns=[
            {
                "id": "c-active",
                "userId": "u1",
                "name": "Active Campaign",
                "status": "active",
                "channels": ["email"],
                "metrics": {"email": {"sent": 80, "opened": 32, "replied": 10}},
                "createdAt": "2026-02-20T00:00:00+00:00",
                "updatedAt": "2026-02-22T10:00:00+00:00",
            },
            {
                "id": "c-draft",
                "userId": "u1",
                "name": "Draft Campaign",
                "status": "draft",
                "channels": ["email"],
                "metrics": {"email": {"sent": 20, "opened": 5, "replied": 1}},
                "createdAt": "2026-02-18T00:00:00+00:00",
                "updatedAt": "2026-02-22T09:00:00+00:00",
            },
            {
                "id": "c-old",
                "userId": "u1",
                "name": "Old Campaign",
                "status": "active",
                "channels": ["email"],
                "metrics": {"email": {"sent": 100, "opened": 20, "replied": 2}},
                "createdAt": "2024-01-01T00:00:00+00:00",
                "updatedAt": "2024-01-01T00:00:00+00:00",
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get(
        "/api/sales-intelligence/campaigns/performance/portfolio?window_days=30&status=active&limit=10"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["statusFilter"] == "active"
    assert payload["campaignCount"] == 1
    assert payload["rankedCampaigns"][0]["campaignId"] == "c-active"
    events = [item["eventType"] for item in fake_db.integration_telemetry.inserted]
    assert "sales_campaign_portfolio_viewed" in events


def test_campaign_metrics_rejects_negative_increments(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "true")
    fake_db = _FakeDb(
        campaigns=[
            {
                "id": "c1",
                "userId": "u1",
                "name": "Negative Test",
                "channels": ["email"],
                "status": "active",
                "metrics": {"email": {"sent": 0, "opened": 0, "replied": 0}},
                "createdAt": "2026-02-22T00:00:00+00:00",
                "updatedAt": "2026-02-22T00:00:00+00:00",
            }
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post(
        "/api/sales-intelligence/campaigns/c1/metrics",
        json={"channel": "email", "sent": -1},
    )
    assert response.status_code == 400


def test_relationship_map_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_RELATIONSHIP_MAP", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/relationships/map")
    assert response.status_code == 503


def test_relationship_map_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_RELATIONSHIP_MAP", "true")
    fake_db = _FakeDb(
        prospects=[
            {
                "id": "p1",
                "userId": "u1",
                "firstName": "Alex",
                "lastName": "N",
                "companyId": "c1",
                "leadScore": 75,
                "engagement": {"opens": 3, "clicks": 1, "replies": 1},
            },
            {
                "id": "p2",
                "userId": "u1",
                "firstName": "Jamie",
                "lastName": "L",
                "companyId": "c1",
                "leadScore": 61,
                "engagement": {"opens": 2, "clicks": 0, "replies": 0},
            },
        ],
        companies=[
            {"id": "c1", "userId": "u1", "name": "Acme Inc"},
        ],
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/relationships/map?limit=100")
    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["prospects"] == 2
    assert payload["stats"]["companies"] == 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_relationship_map_generated"


def test_phrase_analytics_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_PHRASE_ANALYTICS", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/analytics/phrases")
    assert response.status_code == 503


def test_phrase_analytics_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_PHRASE_ANALYTICS", "true")
    fake_db = _FakeDb(
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Book demo", "message": "Book a demo this week"},
                "timestamp": "2026-02-21T11:00:00+00:00",
            },
            {
                "userId": "u1",
                "eventType": "unsubscribe",
                "channel": "email",
                "metadata": {"subject": "Pricing", "message": "Too expensive for budget"},
                "timestamp": "2026-02-21T12:00:00+00:00",
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get(
        "/api/sales-intelligence/analytics/phrases?window_days=60&min_exposure=1&limit=20"
    )
    assert response.status_code == 200
    payload = response.json()
    assert "phrases" in payload
    assert "summary" in payload
    assert payload["summary"]["trackedPhrases"] >= 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_phrase_analytics_generated"


def test_phrase_analytics_respects_window_filter(monkeypatch):
    monkeypatch.setenv("ENABLE_PHRASE_ANALYTICS", "true")
    fake_db = _FakeDb(
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Recent demo", "message": "Book a demo this week"},
                "timestamp": "2026-02-21T11:00:00+00:00",
            },
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Old demo", "message": "Book a demo last season"},
                "timestamp": "2020-01-01T00:00:00+00:00",
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/analytics/phrases?window_days=30&min_exposure=1&limit=20")
    assert response.status_code == 200
    payload = response.json()
    assert payload["totalRecords"] == 1


def test_phrase_channel_summary_success(monkeypatch):
    monkeypatch.setenv("ENABLE_PHRASE_ANALYTICS", "true")
    fake_db = _FakeDb(
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "channel": "email",
                "metadata": {"subject": "Book demo", "message": "Book a demo this week"},
                "timestamp": "2026-02-21T11:00:00+00:00",
            },
            {
                "userId": "u1",
                "eventType": "open",
                "channel": "linkedin",
                "metadata": {"subject": "Connect", "message": "Connect on linkedin this week"},
                "timestamp": "2026-02-21T12:00:00+00:00",
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get(
        "/api/sales-intelligence/analytics/phrases/channel-summary?window_days=60&min_exposure=1&limit=5"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["channelCount"] >= 2
    assert payload["totalRecords"] == 2
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_phrase_channel_summary_generated"


def test_response_prediction_requires_message(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION", "true")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post("/api/sales-intelligence/prediction/response", json={"channel": "email"})
    assert response.status_code == 400


def test_response_prediction_flag_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION", "false")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post(
        "/api/sales-intelligence/prediction/response",
        json={"message": "Can we schedule a demo?", "channel": "email"},
    )
    assert response.status_code == 503


def test_response_prediction_success_and_telemetry(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION", "true")
    fake_db = _FakeDb(
        email_events=[
            {
                "userId": "u1",
                "eventType": "reply",
                "timestamp": "2026-02-21T12:00:00+00:00",
            },
            {
                "userId": "u1",
                "eventType": "open",
                "timestamp": "2026-02-21T13:00:00+00:00",
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post(
        "/api/sales-intelligence/prediction/response",
        json={
            "message": "Hi Alex, can we schedule a demo next Tuesday?",
            "channel": "email",
            "sendTime": "2026-02-24T10:00:00+00:00",
            "prospect": {
                "firstName": "Alex",
                "company": "Acme",
                "leadScore": 80,
                "engagement": {"opens": 4, "clicks": 2, "replies": 1},
            },
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert "responseProbability" in payload
    assert "confidence" in payload
    assert "rationale" in payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_response_prediction_generated"


def test_prediction_feedback_validation(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post(
        "/api/sales-intelligence/prediction/feedback",
        json={"predictedProbability": 1.2, "outcome": "reply"},
    )
    assert response.status_code == 400


def test_prediction_feedback_success(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.post(
        "/api/sales-intelligence/prediction/feedback",
        json={
            "predictionId": "pred-123",
            "predictedProbability": 0.73,
            "outcome": "meeting_booked",
            "channel": "email",
            "responseLatencyHours": 6,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["actualLabel"] == 1
    assert len(fake_db.prediction_feedback.inserted) == 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_response_prediction_feedback_recorded"


def test_prediction_feedback_idempotent_by_prediction_id(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db, authenticated=True)

    first = client.post(
        "/api/sales-intelligence/prediction/feedback",
        json={
            "predictionId": "pred-xyz",
            "predictedProbability": 0.61,
            "outcome": "reply",
            "channel": "email",
        },
    )
    assert first.status_code == 200
    first_payload = first.json()
    assert first_payload["writeMode"] == "created"

    second = client.post(
        "/api/sales-intelligence/prediction/feedback",
        json={
            "predictionId": "pred-xyz",
            "predictedProbability": 0.61,
            "outcome": "lost",
            "channel": "email",
        },
    )
    assert second.status_code == 200
    second_payload = second.json()
    assert second_payload["writeMode"] == "updated"
    assert len(fake_db.prediction_feedback.docs) == 1
    assert fake_db.prediction_feedback.docs[0]["outcome"] == "lost"


def test_prediction_performance_success(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    fake_db.prediction_feedback.docs = [
        {
            "userId": "u1",
            "predictedProbability": 0.7,
            "actualLabel": 1,
            "channel": "email",
            "createdAt": "2026-02-21T10:00:00+00:00",
        },
        {
            "userId": "u1",
            "predictedProbability": 0.3,
            "actualLabel": 0,
            "channel": "linkedin",
            "createdAt": "2026-02-21T11:00:00+00:00",
        },
    ]
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/prediction/performance?window_days=90")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sampleSize"] == 2
    assert "meanAbsoluteCalibrationError" in payload
    assert "byChannel" in payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_response_prediction_performance_viewed"


def test_prediction_performance_respects_window_filter(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    fake_db.prediction_feedback.docs = [
        {
            "userId": "u1",
            "predictedProbability": 0.7,
            "actualLabel": 1,
            "channel": "email",
            "createdAt": "2026-02-20T10:00:00+00:00",
        },
        {
            "userId": "u1",
            "predictedProbability": 0.2,
            "actualLabel": 0,
            "channel": "email",
            "createdAt": "2020-01-01T10:00:00+00:00",
        },
    ]
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/prediction/performance?window_days=30")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sampleSize"] == 1


def test_prediction_performance_report_success(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    fake_db.prediction_feedback.docs = [
        {
            "userId": "u1",
            "predictedProbability": 0.62,
            "actualLabel": 1,
            "channel": "email",
            "createdAt": "2026-02-20T10:00:00+00:00",
        },
        {
            "userId": "u1",
            "predictedProbability": 0.25,
            "actualLabel": 0,
            "channel": "linkedin",
            "createdAt": "2026-02-20T11:00:00+00:00",
        },
    ]
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/prediction/performance/report?window_days=90")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sampleSize"] == 2
    assert "qualityTier" in payload
    assert "rolloutDecision" in payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert fake_db.integration_telemetry.inserted[0]["eventType"] == "sales_response_prediction_report_viewed"


def test_prediction_feedback_history(monkeypatch):
    monkeypatch.setenv("ENABLE_RESPONSE_PREDICTION_FEEDBACK", "true")
    fake_db = _FakeDb()
    fake_db.prediction_feedback.docs = [
        {
            "id": "f1",
            "userId": "u1",
            "predictedProbability": 0.7,
            "actualLabel": 1,
            "channel": "email",
            "createdAt": "2026-02-22T10:00:00+00:00",
        },
        {
            "id": "f2",
            "userId": "u1",
            "predictedProbability": 0.3,
            "actualLabel": 0,
            "channel": "linkedin",
            "createdAt": "2026-02-21T10:00:00+00:00",
        },
    ]
    client = _build_client(monkeypatch, fake_db, authenticated=True)
    response = client.get("/api/sales-intelligence/prediction/feedback/history?window_days=90&limit=10")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 2
    assert payload["records"][0]["id"] == "f1"
    assert len(fake_db.integration_telemetry.inserted) == 1
    assert (
        fake_db.integration_telemetry.inserted[0]["eventType"]
        == "sales_response_prediction_feedback_history_viewed"
    )
