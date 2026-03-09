import asyncio

import database


class _FakeCollection:
    def __init__(self):
        self.index_calls = []

    async def create_index(self, keys, **kwargs):
        normalized_keys = tuple(keys) if isinstance(keys, list) else keys
        self.index_calls.append({"keys": normalized_keys, "kwargs": kwargs})
        return f"idx_{len(self.index_calls)}"


class _FakeDb:
    def __init__(self):
        self.users = _FakeCollection()
        self.agents = _FakeCollection()
        self.workflows = _FakeCollection()
        self.prospects = _FakeCollection()
        self.user_integrations = _FakeCollection()
        self.email_sends = _FakeCollection()
        self.email_events = _FakeCollection()
        self.integration_telemetry = _FakeCollection()
        self.integration_event_dedup = _FakeCollection()
        self.company_research = _FakeCollection()
        self.prediction_feedback = _FakeCollection()
        self.sales_campaigns = _FakeCollection()
        self.companies = _FakeCollection()


def _has_index(collection: _FakeCollection, keys, **kwargs) -> bool:
    normalized_keys = tuple(keys) if isinstance(keys, list) else keys
    for call in collection.index_calls:
        if call["keys"] != normalized_keys:
            continue
        if all(call["kwargs"].get(k) == v for k, v in kwargs.items()):
            return True
    return False


def test_create_indexes_noop_when_database_unset():
    original_db = database.db
    try:
        database.db = None
        asyncio.run(database.create_indexes())
    finally:
        database.db = original_db


def test_create_indexes_includes_reliability_and_idempotency_indexes():
    original_db = database.db
    try:
        fake_db = _FakeDb()
        database.db = fake_db
        asyncio.run(database.create_indexes())
    finally:
        database.db = original_db

    assert _has_index(fake_db.email_events, "timestamp")
    assert _has_index(
        fake_db.email_events,
        [("sendId", 1), ("eventType", 1), ("timestamp", -1)],
    )
    assert _has_index(fake_db.integration_telemetry, [("userId", 1), ("createdAt", -1)])
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("eventType", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("provider", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("provider", 1), ("eventType", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("governanceStatus", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("governancePacketValidationStatus", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("requestId", 1), ("createdAt", -1)],
    )
    assert _has_index(
        fake_db.integration_telemetry,
        [("userId", 1), ("schemaVersion", 1), ("createdAt", -1)],
    )
    assert _has_index(fake_db.integration_event_dedup, "id", unique=True)
    assert _has_index(
        fake_db.integration_event_dedup,
        "createdAt",
        expireAfterSeconds=604800,
    )
    assert _has_index(
        fake_db.integration_event_dedup,
        [("provider", 1), ("createdAt", -1)],
    )
