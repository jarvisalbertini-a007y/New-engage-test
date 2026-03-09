import json
from pathlib import Path

import pytest

from routes import real_integrations


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "providers"


def _load_fixture(name: str):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []
        self.updated = []

    async def find_one(self, *_args, **_kwargs):
        return self.seed_doc

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integration_doc=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc)
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_telemetry = _FakeCollection()


def _run(coro):
    return real_integrations.asyncio.run(coro)


def test_apollo_flag_disabled_returns_403(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.apollo_search_prospects(
                {"query": "vp sales"},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 403


def test_apollo_missing_key_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.apollo_search_prospects(
                {"query": "director sales"},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 400


def test_apollo_smoke_success_with_persistence(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"apollo_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    result = _run(
        real_integrations.apollo_search_prospects(
            {"query": "sales operations", "saveResults": True, "limit": 2},
            current_user={"id": "u1", "email": "user@example.com"},
        )
    )
    assert result["success"] is True
    assert result["resultCount"] == 2
    assert result["savedCount"] == 2
    assert len(fake_db.prospects.updated) == 2


def test_apollo_search_rate_limited_on_second_request(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_MAX_REQUESTS", "1")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_WINDOW_SECONDS", "60")
    fake_db = _FakeDb(integration_doc={"apollo_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    real_integrations._reset_connector_rate_limit_state()

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    first = _run(
        real_integrations.apollo_search_prospects(
            {"query": "sales operations", "limit": 1},
            current_user={"id": "u1", "email": "user@example.com"},
        )
    )
    assert first["success"] is True
    assert first["rateLimit"]["limit"] == 1
    assert first["rateLimit"]["remaining"] == 0
    assert isinstance(first["rateLimit"]["resetAt"], str)
    assert 1 <= int(first["rateLimit"]["resetInSeconds"]) <= 60

    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.apollo_search_prospects(
                {"query": "sales operations", "limit": 1},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 429
    retry_after = int(exc.value.headers.get("Retry-After"))
    assert 1 <= retry_after <= 60
    assert exc.value.headers.get("X-RateLimit-Limit") == "1"
    assert exc.value.headers.get("X-RateLimit-Remaining") == "0"
    assert exc.value.headers.get("X-RateLimit-Window-Seconds") == "60"
    assert exc.value.headers.get("X-RateLimit-Reset-In-Seconds") == str(retry_after)
    assert exc.value.detail["errorCode"] == "connector_rate_limited"
    assert "Retry in" in exc.value.detail["message"]
    assert exc.value.detail["endpoint"] == "apollo_search"
    assert exc.value.detail["retryAfterSeconds"] == retry_after
    assert exc.value.detail["rateLimit"]["limit"] == 1
    assert exc.value.detail["rateLimit"]["remaining"] == 0
    assert exc.value.detail["rateLimit"]["windowSeconds"] == 60
    assert exc.value.detail["rateLimit"]["retryAfterSeconds"] == retry_after
    assert exc.value.detail["rateLimit"]["resetInSeconds"] == retry_after
    matching_events = [
        doc
        for doc in fake_db.integration_telemetry.inserted
        if doc.get("eventType") == "integrations_connector_rate_limited"
    ]
    assert len(matching_events) >= 1
    latest_event = matching_events[-1]
    payload = latest_event.get("payload") or {}
    assert payload.get("endpoint") == "apollo_search"
    assert payload.get("retry_after_seconds") == retry_after
    assert payload.get("reset_in_seconds") == retry_after


def test_apollo_search_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"apollo_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.apollo_search_prospects(
                {"query": "sales operations", "limit": "invalid"},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["errorCode"] == "invalid_request_bounds"
    assert exc.value.detail["message"] == "Invalid limit: expected integer between 1 and 100"
    assert exc.value.detail["field"] == "limit"
    assert exc.value.detail["reason"] == "type"
    assert exc.value.detail["received"] == "invalid"


def test_apollo_search_invalid_page_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"apollo_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.apollo_search_prospects(
                {"query": "sales operations", "page": 0},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["errorCode"] == "invalid_request_bounds"
    assert exc.value.detail["message"] == "Invalid page: expected integer between 1 and 1000"
    assert exc.value.detail["field"] == "page"
    assert exc.value.detail["reason"] == "range"
    assert exc.value.detail["received"] == 0


def test_clearbit_flag_disabled_returns_403(monkeypatch):
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.clearbit_enrich_company(
                {"domain": "growthops.ai"},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 403


def test_clearbit_smoke_success_with_persistence(monkeypatch):
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"clearbit_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    async def fake_provider_request(**_kwargs):
        return _load_fixture("clearbit_company_find.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    result = _run(
        real_integrations.clearbit_enrich_company(
            {"domain": "growthops.ai", "saveResearch": True},
            current_user={"id": "u1", "email": "user@example.com"},
        )
    )
    assert result["success"] is True
    assert result["found"] is True
    assert len(fake_db.company_research.inserted) == 1


def test_crunchbase_missing_criteria_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"crunchbase_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.crunchbase_enrich_company(
                {"limit": 5},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 400


def test_crunchbase_smoke_success_with_persistence(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"crunchbase_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    async def fake_provider_request(**_kwargs):
        return _load_fixture("crunchbase_organizations_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    result = _run(
        real_integrations.crunchbase_enrich_company(
            {"companyName": "PipelineIQ", "saveResearch": True, "limit": 2},
            current_user={"id": "u1", "email": "user@example.com"},
        )
    )
    assert result["success"] is True
    assert result["resultCount"] == 2
    assert result["savedCount"] == 2
    assert len(fake_db.company_research.inserted) == 2


def test_crunchbase_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"crunchbase_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    with pytest.raises(real_integrations.HTTPException) as exc:
        _run(
            real_integrations.crunchbase_enrich_company(
                {"companyName": "PipelineIQ", "limit": 0},
                current_user={"id": "u1", "email": "user@example.com"},
            )
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["errorCode"] == "invalid_request_bounds"
    assert exc.value.detail["message"] == "Invalid limit: expected integer between 1 and 25"
    assert exc.value.detail["field"] == "limit"
    assert exc.value.detail["reason"] == "range"
    assert exc.value.detail["received"] == 0


def test_apollo_company_storage_policy_truncates_large_payload(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("CONNECTOR_PERSIST_MAX_BYTES", "512")
    monkeypatch.setenv("CONNECTOR_PERSIST_PREVIEW_CHARS", "160")
    fake_db = _FakeDb(integration_doc={"apollo_api_key": "token"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    async def fake_provider_request(**_kwargs):
        payload = _load_fixture("apollo_people_search.json")
        payload["organizations"] = [
            {
                "name": "PipelineIQ",
                "website_url": "https://pipelineiq.com",
                "short_description": "A" * 5000,
            }
        ]
        return payload

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    result = _run(
        real_integrations.apollo_enrich_company(
            {"companyName": "PipelineIQ", "saveResearch": True, "limit": 1},
            current_user={"id": "u1", "email": "user@example.com"},
        )
    )
    assert result["success"] is True
    assert result["savedCount"] == 1
    assert result["storagePolicy"]["truncatedRecordCount"] == 1
    assert result["storagePolicy"]["truncatedRawRecordCount"] == 1
    assert result["storagePolicy"]["truncatedEnrichedRecordCount"] == 1
    assert len(fake_db.company_research.inserted) == 1
    saved_doc = fake_db.company_research.inserted[0]
    assert saved_doc["storagePolicy"]["truncated"] is True
    assert saved_doc["rawData"]["truncated"] is True
    assert saved_doc["enrichedData"]["truncated"] is True
