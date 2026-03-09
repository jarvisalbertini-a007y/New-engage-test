import json
from pathlib import Path
import tempfile

from scripts import generate_governance_packet_fixture
from scripts import validate_governance_packet_artifacts


def _run_generate(report_path: Path, handoff_path: Path, history_path: Path) -> int:
    class _Args:
        report = str(report_path)
        handoff = str(handoff_path)
        history = str(history_path)
        requested_by = "u-smoke"

    original_parse = generate_governance_packet_fixture.parse_args
    try:
        generate_governance_packet_fixture.parse_args = lambda: _Args
        return generate_governance_packet_fixture.main()
    finally:
        generate_governance_packet_fixture.parse_args = original_parse


def test_governance_packet_status_normalization_smoke():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        report_path = tmp_path / "connector_governance_weekly_report.json"
        handoff_path = tmp_path / "governance_handoff_export.json"
        history_path = tmp_path / "governance_history_export.json"

        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": "action-required",
                    "handoff": {"ownerRole": "Release Manager"},
                    "governanceExport": {
                        "status": "ACTION REQUIRED",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 3,
                            "byEndpoint": {
                                "Apollo Search": 2,
                                "apollo-search": 1,
                            },
                            "pressure": {"label": "High"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))

        assert handoff_payload["status"] == "ACTION_REQUIRED"
        assert handoff_payload["governanceExport"]["status"] == "ACTION_REQUIRED"
        assert handoff_payload["governanceExport"]["rolloutBlocked"] is True
        assert handoff_payload["connectorRateLimit"]["byEndpoint"] == {"apollo_search": 3}
        assert history_payload["status"] == "ACTION_REQUIRED"
        assert history_payload["items"][0]["status"] == "ACTION_REQUIRED"
        assert history_payload["items"][0]["rolloutBlocked"] is True

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is True
        assert result["errors"] == []


def test_governance_packet_count_parity_mismatch_smoke():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        report_path = tmp_path / "connector_governance_weekly_report.json"
        handoff_path = tmp_path / "governance_handoff_export.json"
        history_path = tmp_path / "governance_history_export.json"

        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": "READY",
                    "handoff": {"ownerRole": "Release Manager"},
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "pressure": {"label": "Moderate"},
                        }
                    },
                    "recommendedCommands": ["npm run verify:governance:weekly"],
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))

        handoff_payload["reasonCodeCount"] = len(handoff_payload["reasonCodes"]) + 1
        history_payload["governanceExport"]["recommendedCommandCount"] = 0

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is False
        errors = "\n".join(result["errors"])
        assert (
            "Governance handoff artifact reasonCodeCount does not match len(reasonCodes)"
            in errors
        )
        assert (
            "Governance history artifact governanceExport recommendedCommandCount does not match len(recommendedCommands)"
            in errors
        )
