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
