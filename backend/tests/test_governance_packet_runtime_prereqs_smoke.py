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


def test_governance_packet_runtime_prereqs_parity_smoke():
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
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "pressure": {"label": "Moderate"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))

        assert handoff_payload["runtimePrereqs"] == handoff_payload["governanceExport"]["runtimePrereqs"]
        assert history_payload["runtimePrereqs"] == history_payload["governanceExport"]["runtimePrereqs"]
        assert handoff_payload["commandAliases"] == handoff_payload["governanceExport"]["commandAliases"]
        assert history_payload["commandAliases"] == history_payload["governanceExport"]["commandAliases"]
        assert handoff_payload["totals"]["runtimePrereqsMissingCheckCount"] == 0
        assert history_payload["totals"]["runtimePrereqsMissingCheckCount"] == 0
        assert handoff_payload["totals"]["commandAliasesMissingAliasCount"] == 0
        assert history_payload["totals"]["commandAliasesMissingAliasCount"] == 0

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is True
        assert result["errors"] == []


def test_governance_packet_runtime_prereqs_parity_mismatch_smoke():
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
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["commandAliases"]["missingAliasCount"] = 1
        history_payload["governanceExport"]["commandAliases"]["missingAliases"] = [
            "verify:smoke:sales"
        ]

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is False
        errors = "\n".join(result["errors"])
        assert (
            "Governance history artifact commandAliases does not match governanceExport.commandAliases"
            in errors
        )


def test_governance_packet_command_alias_mismatched_count_parity_mismatch_smoke():
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
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["commandAliases"]["mismatchedAliasCount"] = 1
        history_payload["governanceExport"]["commandAliases"]["mismatchedAliases"] = [
            {"name": "verify:smoke:sales", "expected": "bash backend/scripts/run_smoke_sales_suite.sh"}
        ]

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is False
        errors = "\n".join(result["errors"])
        assert (
            "Governance history artifact commandAliases does not match governanceExport.commandAliases"
            in errors
        )


def test_governance_packet_command_alias_command_parity_mismatch_smoke():
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
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        assert _run_generate(report_path, handoff_path, history_path) == 0
        handoff_payload = json.loads(handoff_path.read_text(encoding="utf-8"))
        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["commandAliases"]["command"] = (
            "npm run verify:baseline:command-aliases"
        )

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff_payload,
            history_payload,
        )
        assert result["valid"] is False
        errors = "\n".join(result["errors"])
        assert (
            "Governance history artifact commandAliases does not match governanceExport.commandAliases"
            in errors
        )
