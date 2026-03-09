from routes import real_integrations
from pathlib import Path
import json


def test_normalize_recommended_commands_returns_empty_for_non_list_values():
    assert real_integrations._normalize_recommended_commands(None) == []
    assert real_integrations._normalize_recommended_commands("npm run verify:ci:sales") == []
    assert real_integrations._normalize_recommended_commands({"command": "npm run verify:ci:sales"}) == []


def test_normalize_recommended_commands_filters_non_string_and_blank_entries():
    payload = [
        "  ",
        "npm run verify:baseline:metrics",
        123,
        None,
        {"command": "npm run verify:ci:sales:extended"},
        "npm run verify:baseline:metrics",
        "  npm run verify:smoke:baseline-governance-drift  ",
    ]
    assert real_integrations._normalize_recommended_commands(payload) == [
        "npm run verify:baseline:metrics",
        "npm run verify:smoke:baseline-governance-drift",
    ]


def test_normalize_recommended_commands_preserves_first_seen_order_after_dedupe():
    payload = [
        "npm run verify:smoke:baseline-governance-drift",
        "npm run verify:ci:sales:extended",
        "npm run verify:smoke:baseline-governance-drift",
        "npm run verify:baseline:metrics",
    ]
    assert real_integrations._normalize_recommended_commands(payload) == [
        "npm run verify:smoke:baseline-governance-drift",
        "npm run verify:ci:sales:extended",
        "npm run verify:baseline:metrics",
    ]


def test_build_baseline_governance_recommended_commands_ignores_non_string_action_commands():
    commands = real_integrations._build_baseline_governance_recommended_commands(
        status="FAIL",
        orchestration_gate_needs_remediation=False,
        actions=[
            {"command": "npm run verify:ci:sales:extended"},
            {"command": None},
            {"command": 42},
            {"command": {"bad": "value"}},
            {"command": "   "},
        ],
        artifact_commands=[],
    )
    assert commands[0] == "npm run verify:smoke:baseline-governance-drift"
    assert "npm run verify:ci:sales:extended" in commands
    assert len(commands) == 2


def test_build_baseline_governance_recommended_commands_collapses_legacy_when_wrapper_present():
    commands = real_integrations._build_baseline_governance_recommended_commands(
        status="PASS",
        orchestration_gate_needs_remediation=False,
        actions=[],
        artifact_commands=[
            "npm run verify:smoke:baseline-orchestration-remediation",
            "npm run verify:smoke:orchestration-slo-gate",
            "npm run verify:baseline:metrics",
            "npm run verify:smoke:baseline-governance-drift",
            "npm run verify:ci:sales:extended",
        ],
    )
    assert commands == [
        "npm run verify:smoke:baseline-orchestration-remediation",
        "npm run verify:baseline:command-aliases:artifact",
        "npm run verify:baseline:command-aliases:artifact:contract",
        "npm run verify:smoke:baseline-command-aliases-artifact",
        "npm run verify:ci:sales:extended",
    ]


def test_build_baseline_governance_recommended_commands_injects_wrapper_first_for_orchestration_remediation():
    commands = real_integrations._build_baseline_governance_recommended_commands(
        status="FAIL",
        orchestration_gate_needs_remediation=True,
        actions=[
            {"command": "npm run verify:smoke:orchestration-slo-gate"},
            {"command": "npm run verify:ci:sales:extended"},
        ],
        artifact_commands=["npm run verify:baseline:metrics"],
    )
    assert commands[0] == "npm run verify:smoke:baseline-orchestration-remediation"
    assert commands[1:4] == [
        "npm run verify:baseline:command-aliases:artifact",
        "npm run verify:baseline:command-aliases:artifact:contract",
        "npm run verify:smoke:baseline-command-aliases-artifact",
    ]
    assert "npm run verify:smoke:orchestration-slo-gate" not in commands
    assert "npm run verify:baseline:metrics" not in commands
    assert "npm run verify:ci:sales:extended" in commands


def test_build_baseline_governance_recommended_commands_keeps_single_alias_chain_when_already_present():
    commands = real_integrations._build_baseline_governance_recommended_commands(
        status="FAIL",
        orchestration_gate_needs_remediation=True,
        actions=[
            {"command": "npm run verify:smoke:baseline-command-aliases-artifact"},
            {"command": "npm run verify:ci:sales:extended"},
        ],
        artifact_commands=[
            "npm run verify:smoke:baseline-orchestration-remediation",
            "npm run verify:baseline:command-aliases:artifact",
            "npm run verify:baseline:command-aliases:artifact:contract",
            "npm run verify:smoke:baseline-command-aliases-artifact",
        ],
    )
    assert commands[:4] == [
        "npm run verify:smoke:baseline-orchestration-remediation",
        "npm run verify:baseline:command-aliases:artifact",
        "npm run verify:baseline:command-aliases:artifact:contract",
        "npm run verify:smoke:baseline-command-aliases-artifact",
    ]
    assert commands.count("npm run verify:baseline:command-aliases:artifact") == 1
    assert commands.count("npm run verify:baseline:command-aliases:artifact:contract") == 1
    assert commands.count("npm run verify:smoke:baseline-command-aliases-artifact") == 1


def test_resolve_baseline_command_aliases_summary_reads_nested_artifact_file(tmp_path, monkeypatch):
    artifact_path = Path(tmp_path) / "sales_baseline_command_aliases.json"
    artifact_path.write_text(
        json.dumps(
            {
                "generatedAt": "2026-02-22T00:00:00+00:00",
                "command": "verify_sales_baseline_command_aliases",
                "artifact": {
                    "valid": False,
                    "validatedAt": "2026-02-22T00:00:05+00:00",
                    "command": "verify_sales_baseline_command_aliases",
                    "requiredAliases": {"test": "npm run verify:backend:sales"},
                    "aliasChecks": {
                        "test": {
                            "actual": "npm run verify:backend:sales",
                            "expected": "npm run verify:backend:sales",
                            "valid": True,
                        }
                    },
                    "missingAliases": ["verify:smoke:sales"],
                    "mismatchedAliases": ["typecheck"],
                    "errors": [],
                },
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        real_integrations,
        "BASELINE_COMMAND_ALIASES_ARTIFACT_PATH",
        artifact_path,
    )
    summary = real_integrations._resolve_baseline_command_aliases_summary(None)
    assert summary["present"] is True
    assert summary["available"] is True
    assert summary["source"] == "artifact_file"
    assert summary["contractValid"] is True
    assert summary["valid"] is False
    assert summary["gatePassed"] is False
    assert summary["missingAliases"] == ["verify:smoke:sales"]
    assert summary["mismatchedAliases"] == ["typecheck"]
    assert summary["missingAliasCount"] == 1
    assert summary["mismatchedAliasCount"] == 1


def test_resolve_baseline_command_aliases_summary_handles_missing_artifact(monkeypatch, tmp_path):
    missing_path = Path(tmp_path) / "missing_sales_baseline_command_aliases.json"
    monkeypatch.setattr(
        real_integrations,
        "BASELINE_COMMAND_ALIASES_ARTIFACT_PATH",
        missing_path,
    )
    summary = real_integrations._resolve_baseline_command_aliases_summary(None)
    assert summary["present"] is False
    assert summary["available"] is False
    assert summary["source"] == "none"
    assert summary["gatePassed"] is None
