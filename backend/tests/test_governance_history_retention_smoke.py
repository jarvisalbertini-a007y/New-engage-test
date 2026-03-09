import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations

ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "generate_governance_packet_fixture.py"
)
GOVERNANCE_PACKET_VALIDATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "validate_governance_packet_artifacts.py"
)


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

    def find(self, _flt, *_args, **_kwargs):
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
    def __init__(self, integration_doc=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc or {})
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


def _write_packet_validation_artifact(path: Path, validated_at: datetime):
    path.write_text(
        json.dumps(
            {
                "validatedAt": validated_at.isoformat(),
                "checks": {},
                "errors": [],
                "valid": True,
            }
        ),
        encoding="utf-8",
    )


def test_governance_history_retention_smoke_detects_stale_invalid_and_blocking_artifacts(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        recent_ready = artifact_dir / "connector_governance_weekly_report_recent.json"
        stale_blocked = artifact_dir / "connector_governance_weekly_report_stale.json"
        invalid_payload = artifact_dir / "connector_governance_weekly_report_invalid.json"

        recent_ready.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        stale_blocked.write_text(
            json.dumps(
                {
                    "generatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=60)
                    ).isoformat(),
                    "governanceExport": {
                        "status": "ACTION_REQUIRED",
                        "rolloutBlocked": True,
                    },
                }
            ),
            encoding="utf-8",
        )
        invalid_payload.write_text("{invalid", encoding="utf-8")
        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
        )

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["artifactCount"] == 3
        assert payload["staleCount"] >= 1
        assert payload["rolloutBlockedCount"] >= 1
        assert payload["governanceExport"]["rolloutBlocked"] is True
        assert isinstance(payload.get("runtimePrereqs"), dict)
        assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
        assert payload["governanceExport"]["runtimePrereqs"] == payload["runtimePrereqs"]
        assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert any("outside retention threshold" in str(msg).lower() for msg in payload["alerts"])
        assert any(
            "governance-export-guard" in str(cmd)
            for cmd in payload["recommendedCommands"]
        )
        assert any(
            "cleanup:policy" in str(cmd)
            for cmd in payload["recommendedCommands"]
        )
        assert len(fake_db.integration_telemetry.inserted) == 1
        assert (
            fake_db.integration_telemetry.inserted[0]["eventType"]
            == "integrations_traceability_governance_report_history_viewed"
        )


def test_governance_history_retention_smoke_ready_when_recent_artifacts_are_healthy(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        recent_ready = artifact_dir / "connector_governance_weekly_report_recent.json"
        recent_ready.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
        )
        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "READY"
        assert payload["staleCount"] == 0
        assert payload["rolloutBlockedCount"] == 0
        assert payload["governanceExport"]["rolloutBlocked"] is False
        assert isinstance(payload.get("runtimePrereqs"), dict)
        assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
        assert payload["governanceExport"]["runtimePrereqs"] == payload["runtimePrereqs"]
        assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert payload["governancePacketValidation"]["status"] == "READY"
        assert any("history is healthy" in str(msg).lower() for msg in payload["alerts"])


def test_governance_history_retention_smoke_flags_invalid_governance_export_shape(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        invalid_export = (
            artifact_dir
            / "connector_governance_weekly_report_invalid_governance_export.json"
        )
        invalid_export.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": "invalid-shape",
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
        )

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["artifactCount"] == 1
        assert payload["rolloutBlockedCount"] == 1
        assert payload["governanceExport"]["rolloutBlocked"] is True
        by_name = {item["name"]: item for item in payload["items"]}
        item = by_name["connector_governance_weekly_report_invalid_governance_export.json"]
        assert item["status"] == "INVALID"
        assert item["rolloutBlocked"] is True


def test_governance_history_retention_smoke_flags_duplicate_logical_artifact_names(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        shared_name = "connector_governance_weekly_report_shared.json"
        report_a = artifact_dir / "connector_governance_weekly_report_a.json"
        report_b = artifact_dir / "connector_governance_weekly_report_b.json"

        report_a.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "artifactName": shared_name,
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        report_b.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "artifactName": shared_name,
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                    },
                }
            ),
            encoding="utf-8",
        )

        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc),
        )

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["artifactCount"] == 2
        assert payload["status"] == "ACTION_REQUIRED"
        assert shared_name in payload["duplicateArtifactNames"]
        assert payload["governanceExport"]["rolloutBlocked"] is True
        assert any(
            "duplicate artifact names" in str(msg).lower()
            for msg in payload["alerts"]
        )
        assert any(
            "cleanup:policy" in str(cmd)
            for cmd in payload["recommendedCommands"]
        )


def test_governance_history_retention_smoke_transitions_packet_validation_from_stale_to_ready_after_fixture_regeneration(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        report_path = artifact_dir / "connector_governance_weekly_report_recent.json"
        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "status": "READY",
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "alerts": [],
                        "actions": [],
                    },
                    "handoff": {
                        "ownerRole": "Release Manager",
                        "rolloutBlocked": False,
                        "actions": [],
                    },
                }
            ),
            encoding="utf-8",
        )

        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        _write_packet_validation_artifact(
            packet_validation_path,
            datetime.now(timezone.utc) - timedelta(days=14),
        )

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        stale_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert stale_response.status_code == 200
        stale_payload = stale_response.json()
        assert stale_payload["status"] == "ACTION_REQUIRED"
        assert stale_payload["governancePacketValidation"]["status"] == "ACTION_REQUIRED"
        assert stale_payload["governancePacketValidation"]["withinFreshnessWindow"] is False

        handoff_path = artifact_dir / "governance_handoff_export.json"
        history_path = artifact_dir / "governance_history_export.json"

        fixture_result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH),
                "--report",
                str(report_path),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--requested-by",
                "u1",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert fixture_result.returncode == 0

        validate_result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_VALIDATOR_PATH),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--output",
                str(packet_validation_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert validate_result.returncode == 0

        refreshed_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert refreshed_response.status_code == 200
        refreshed_payload = refreshed_response.json()
        assert refreshed_payload["status"] == "READY"
        assert refreshed_payload["governancePacketValidation"]["status"] == "READY"
        assert refreshed_payload["governancePacketValidation"]["withinFreshnessWindow"] is True
