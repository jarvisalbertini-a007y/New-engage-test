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

    def find(self, _flt=None, *_args, **_kwargs):
        return _FakeCursor([])


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, _direction):
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeDb:
    def __init__(self):
        self.user_integrations = _FakeCollection(seed_doc={"userId": "u1"})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.integration_telemetry = _FakeCollection(seed_doc=[])


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def _assert_reason_code_parity(payload):
    top_level_reason_codes = set(payload.get("reasonCodes") or [])
    rollout_action_reason_codes = {
        action.get("reasonCode")
        for action in payload.get("rolloutActions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_action_reason_codes = {
        action.get("reasonCode")
        for action in payload.get("governanceExport", {}).get("actions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_alert_reason_codes = {
        alert.get("reasonCode")
        for alert in payload.get("governanceExport", {}).get("alerts") or []
        if isinstance(alert.get("reasonCode"), str)
    }
    assert top_level_reason_codes == rollout_action_reason_codes
    assert top_level_reason_codes == export_action_reason_codes
    assert top_level_reason_codes == export_alert_reason_codes


def _assert_telemetry_parity(payload, schema_event):
    event_payload = schema_event["payload"]
    assert event_payload["reason_codes"] == payload["reasonCodes"]
    assert event_payload["reason_codes"] == payload["governanceExport"]["reasonCodes"]
    assert event_payload["reason_code_count"] == len(payload["reasonCodes"])
    assert event_payload["reason_code_count"] == len(event_payload["reason_codes"])
    assert event_payload["recommended_commands"] == payload["recommendedCommands"]
    assert (
        event_payload["recommended_commands"]
        == payload["governanceExport"]["recommendedCommands"]
    )
    assert event_payload["recommended_command_count"] == len(payload["recommendedCommands"])
    assert event_payload["recommended_command_count"] == len(
        event_payload["recommended_commands"]
    )
    assert event_payload["rollout_blocked"] == payload["handoff"]["rolloutBlocked"]
    assert event_payload["reason_code_parity_ok"] is True
    assert event_payload["recommended_command_parity_ok"] is True
    assert event_payload["handoff_parity_ok"] is True


def _assert_schema_contract_parity(payload):
    assert payload["schemaContractParity"]["reasonCodeCount"] == len(payload["reasonCodes"])
    assert (
        payload["schemaContractParity"]["recommendedCommandCount"]
        == len(payload["recommendedCommands"])
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsRolloutActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportAlerts"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportReasonCodes"]
        is True
    )
    assert (
        payload["schemaContractParity"]["recommendedCommandParity"]["topLevelVsExport"]
        is True
    )
    assert (
        payload["schemaContractParity"]["handoffParity"]["rolloutBlockedMatchesExport"]
        is True
    )
    assert payload["schemaContractParity"]["handoffParity"]["ownerRoleMatchesExport"] is True
    assert (
        payload["schemaContractParity"]["handoffParity"]["handoffActionsMatchRolloutActions"]
        is True
    )
    assert isinstance(payload["schemaContractParity"]["computedAt"], str)


def test_governance_schema_contract_parity_smoke_ready(monkeypatch):
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db)

    response = client.get("/api/integrations/integrations/telemetry/governance-schema")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "READY"
    assert payload["handoff"]["rolloutBlocked"] is False
    assert payload["governanceExport"]["status"] == "READY"
    assert payload["governanceExport"]["rolloutBlocked"] is False
    assert payload["governanceExport"]["ownerRole"] == payload["handoff"]["ownerRole"]
    assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["handoff"]["actions"] == [
        action.get("action")
        for action in payload["rolloutActions"]
        if action.get("action")
    ]
    _assert_reason_code_parity(payload)
    _assert_schema_contract_parity(payload)
    assert len(fake_db.integration_telemetry.inserted) == 1
    schema_event = fake_db.integration_telemetry.inserted[0]
    assert (
        schema_event["eventType"] == "integrations_traceability_governance_schema_viewed"
    )
    assert schema_event["payload"]["status"] == "READY"
    assert schema_event["payload"]["override_is_set"] is False
    _assert_telemetry_parity(payload, schema_event)


def test_governance_schema_contract_parity_smoke_invalid_override(monkeypatch):
    monkeypatch.setenv("GOVERNANCE_EXPORT_SCHEMA_VERSION", "invalid")
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db)

    response = client.get("/api/integrations/integrations/telemetry/governance-schema")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["handoff"]["rolloutBlocked"] is True
    assert payload["governanceExport"]["status"] == "ACTION_REQUIRED"
    assert payload["governanceExport"]["rolloutBlocked"] is True
    assert payload["governanceExport"]["ownerRole"] == payload["handoff"]["ownerRole"]
    assert payload["schemaMetadata"]["source"] == "env_invalid_fallback"
    assert payload["schemaMetadata"]["override"]["isSet"] is True
    assert payload["schemaMetadata"]["override"]["isValid"] is False
    assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["handoff"]["actions"] == [
        action.get("action")
        for action in payload["rolloutActions"]
        if action.get("action")
    ]
    _assert_reason_code_parity(payload)
    _assert_schema_contract_parity(payload)
    assert len(fake_db.integration_telemetry.inserted) == 1
    schema_event = fake_db.integration_telemetry.inserted[0]
    assert (
        schema_event["eventType"] == "integrations_traceability_governance_schema_viewed"
    )
    assert schema_event["payload"]["status"] == "ACTION_REQUIRED"
    assert schema_event["payload"]["override_is_set"] is True
    assert schema_event["payload"]["override_is_valid"] is False
    _assert_telemetry_parity(payload, schema_event)
