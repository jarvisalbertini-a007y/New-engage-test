import pytest

from routes import real_integrations


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []
        self.updated = []
        self.find_queries = []

    async def find_one(self, flt=None, *_args, **_kwargs):
        self.find_queries.append(flt or {})
        if self.seed_doc is None:
            return None
        if isinstance(self.seed_doc, dict):
            # Dedup collection lookup by id
            if flt and "id" in flt:
                for item in self.inserted:
                    if item.get("id") == flt["id"]:
                        return item
                return None
            return self.seed_doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integrations=None):
        self.user_integrations = _FakeCollection(seed_doc=integrations or {})
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})


def _run(coro):
    return real_integrations.asyncio.run(coro)


def test_get_user_integrations_masks_provider_keys(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.1234567890",
            "apollo_api_key": "apollo-secret-1234",
            "clearbit_api_key": "clearbit-secret-1234",
            "crunchbase_api_key": "crunch-secret-1234",
            "from_email": "sales@example.com",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")

    result = _run(real_integrations.get_user_integrations(current_user={"id": "u1", "email": "sales@example.com"}))
    assert result["sendgrid_configured"] is True
    assert result["apollo_configured"] is True
    assert result["clearbit_configured"] is True
    assert result["crunchbase_configured"] is True
    assert result["apollo_enabled"] is True
    assert result["clearbit_enabled"] is False
    assert result["crunchbase_enabled"] is True
    assert result["sendgrid_api_key"].startswith("••••••••")
    assert result["apollo_api_key"].startswith("••••••••")


def test_get_integrations_health_reports_provider_statuses(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
            "apollo_api_key": "apollo-key",
            "clearbit_api_key": "clearbit-key",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")

    async def fake_sendgrid_health(_api_key):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 10, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    result = _run(real_integrations.get_integrations_health(current_user={"id": "u1", "email": "sales@example.com"}))
    providers = {p["provider"]: p for p in result["providers"]}
    assert providers["sendgrid"]["healthy"] is True
    assert providers["apollo"]["healthy"] is True
    assert providers["clearbit"]["healthy"] is False
    assert providers["crunchbase"]["healthy"] is False


def test_sendgrid_webhook_deduplicates_duplicate_events(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    payload = [
        {
            "event": "open",
            "send_id": "send-123",
            "timestamp": 1739900000,
            "sg_event_id": "evt-1",
        },
        {
            "event": "open",
            "send_id": "send-123",
            "timestamp": 1739900000,
            "sg_event_id": "evt-1",
        },
    ]
    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["received"] == 2
    # only one update and one event insert should occur due dedup
    assert len(fake_db.email_sends.updated) == 1
    assert len(fake_db.email_events.inserted) == 1
    assert len(fake_db.integration_event_dedup.inserted) == 1


def test_sendgrid_webhook_click_increments_click_count(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "click",
            "send_id": "send-456",
            "timestamp": 1739900001,
            "sg_event_id": "evt-2",
        }
    ]
    _run(real_integrations.sendgrid_webhook(events=payload))
    assert len(fake_db.email_sends.updated) == 1
    update_payload = fake_db.email_sends.updated[0]["payload"]
    assert "$inc" in update_payload
    assert update_payload["$inc"].get("clickCount") == 1


def test_remove_provider_integrations_issue_unset(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    _run(real_integrations.remove_apollo_integration(current_user={"id": "u1", "email": "sales@example.com"}))
    _run(real_integrations.remove_clearbit_integration(current_user={"id": "u1", "email": "sales@example.com"}))
    _run(real_integrations.remove_crunchbase_integration(current_user={"id": "u1", "email": "sales@example.com"}))

    assert len(fake_db.user_integrations.updated) == 3
    assert all("$unset" in call["payload"] for call in fake_db.user_integrations.updated)
