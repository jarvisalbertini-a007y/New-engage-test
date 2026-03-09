import importlib.util
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "backfill_integration_telemetry_event_root_contract.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "backfill_integration_telemetry_event_root_contract",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def batch_size(self, _size):
        return self

    def __iter__(self):
        return iter(self._docs)


class _FakeCollection:
    def __init__(self, docs):
        self.docs = list(docs)
        self.updated = []

    def find(self, query, _projection):
        user_id = query.get("userId")
        event_type = query.get("eventType")
        filtered = []
        for doc in self.docs:
            if user_id and doc.get("userId") != user_id:
                continue
            if event_type and doc.get("eventType") != event_type:
                continue
            filtered.append(doc)
        return _FakeCursor(filtered)

    def update_one(self, flt, payload):
        self.updated.append({"filter": flt, "payload": payload})


def test_normalize_helpers_handle_blank_and_mixed_tokens():
    module = _load_module()
    assert module.normalize_request_id("  req-123  ") == "req-123"
    assert module.normalize_request_id("   ") is None
    assert module.normalize_status_token(" action required ") == "ACTION_REQUIRED"
    assert module.normalize_status_token("!!!") is None


def test_resolve_event_root_patch_prefers_existing_top_level_fields():
    module = _load_module()
    patch = module.resolve_event_root_patch(
        {
            "requestId": "req-top-level",
            "schemaVersion": 2,
            "governanceStatus": "ACTION_REQUIRED",
            "governancePacketValidationStatus": "READY",
            "governancePacketValidationWithinFreshness": True,
            "payload": {
                "request_id": "req-from-payload",
                "schema_version": 1,
                "status": "ready",
                "governance_packet_validation_status": "ACTION_REQUIRED",
                "governance_packet_validation_within_freshness": False,
            },
        }
    )
    assert patch == {}


def test_run_backfill_dry_run_counts_candidates_without_writes():
    module = _load_module()
    fake_collection = _FakeCollection(
        [
            {
                "_id": "d1",
                "userId": "u1",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-1",
                    "schema_version": 2,
                    "status": "action required",
                    "governance_packet_validation_status": "ready",
                    "governance_packet_validation_within_freshness": True,
                },
            },
            {
                "_id": "d2",
                "userId": "u1",
                "eventType": "integrations_traceability_status_evaluated",
                "requestId": "req-2",
                "schemaVersion": 2,
                "governanceStatus": "PASS",
                "governancePacketValidationStatus": "READY",
                "governancePacketValidationWithinFreshness": True,
                "payload": {},
            },
        ]
    )

    summary = module.run_backfill(
        fake_collection,
        user_id="u1",
        event_type="integrations_traceability_status_evaluated",
        batch_size=50,
        max_docs=100,
        apply=False,
    )

    assert summary["mode"] == "dry-run"
    assert summary["scannedCount"] == 2
    assert summary["candidateCount"] == 1
    assert summary["updatedCount"] == 0
    assert summary["fieldBackfillCounts"]["requestId"] == 1
    assert summary["fieldBackfillCounts"]["schemaVersion"] == 1
    assert summary["fieldBackfillCounts"]["governanceStatus"] == 1
    assert summary["fieldBackfillCounts"]["governancePacketValidationStatus"] == 1
    assert summary["fieldBackfillCounts"]["governancePacketValidationWithinFreshness"] == 1
    assert fake_collection.updated == []


def test_run_backfill_apply_writes_updates():
    module = _load_module()
    fake_collection = _FakeCollection(
        [
            {
                "_id": "apply-1",
                "userId": "u1",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-apply-1",
                    "schema_version": 2,
                    "status": "ready",
                },
            }
        ]
    )
    summary = module.run_backfill(
        fake_collection,
        user_id="u1",
        event_type="integrations_traceability_status_evaluated",
        batch_size=10,
        max_docs=10,
        apply=True,
    )
    assert summary["mode"] == "apply"
    assert summary["candidateCount"] == 1
    assert summary["updatedCount"] == 1
    assert len(fake_collection.updated) == 1
    assert fake_collection.updated[0]["filter"] == {"_id": "apply-1"}
    assert fake_collection.updated[0]["payload"]["$set"]["requestId"] == "req-apply-1"
    assert fake_collection.updated[0]["payload"]["$set"]["schemaVersion"] == 2
    assert fake_collection.updated[0]["payload"]["$set"]["governanceStatus"] == "READY"
