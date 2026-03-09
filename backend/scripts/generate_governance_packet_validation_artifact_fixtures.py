#!/usr/bin/env python3
"""Generate deterministic governance packet validation artifact fixtures."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict, Tuple


SUPPORTED_PROFILES = ("ready", "action-required", "validation-fail")
COMMAND = "generate_governance_packet_validation_artifact_fixtures"


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate deterministic governance packet validation artifacts for "
            "retention and cleanup contract checks."
        )
    )
    parser.add_argument(
        "--output-dir",
        default="backend/test_reports",
        help="Directory where fixture artifacts are written.",
    )
    parser.add_argument(
        "--prefix",
        default="governance_packet_validation_fixture",
        help="Filename prefix for generated validation artifacts.",
    )
    parser.add_argument(
        "--requested-by",
        default="u1",
        help="Requested-by user identifier stamped in generated artifacts.",
    )
    return parser.parse_args()


def _load_module(script_name: str):
    script_path = Path(__file__).resolve().parent / script_name
    spec = importlib.util.spec_from_file_location(script_name.replace(".py", ""), script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _profile_timestamp(profile: str) -> str:
    return {
        "ready": "2026-03-02T02:00:00+00:00",
        "action-required": "2026-03-02T02:05:00+00:00",
        "validation-fail": "2026-03-02T02:10:00+00:00",
    }[profile]


def _profile_payload(profile: str) -> Dict[str, Any]:
    generated_at = _profile_timestamp(profile)
    if profile == "action-required":
        status = "ACTION_REQUIRED"
        rollout_blocked = True
        runtime_missing_checks = {
            "commands": ["npm run verify:governance:weekly"],
            "workspace": ["backend/test_reports/governance_packet_validation.json"],
        }
        command_alias_missing = ["verify:smoke:governance-packet"]
        command_alias_mismatched = ["verify:governance:packet:contract"]
        connector_event_count = 4
        connector_by_endpoint = {"apollo_search": 3, "clearbit_company": 1}
        connector_pressure_label = "high"
        sendgrid_event_count = 4
        sendgrid_anomaly_count_total = 2
        sendgrid_pressure_label_counts = {"high": 3, "moderate": 1}
        sendgrid_pressure_hint_counts = {"stabilize_webhook_clock": 4}
        sendgrid_age_bucket_counts = {"stale": 2, "fresh_1h_to_24h": 2}
        sendgrid_anomaly_event_type_counts = {"bounce": 1, "delivered": 1}
        reason_codes = ["packet_validation_failed", "rollout_blocked"]
    else:
        status = "READY"
        rollout_blocked = False
        runtime_missing_checks = {"commands": [], "workspace": []}
        command_alias_missing = []
        command_alias_mismatched = []
        connector_event_count = 1
        connector_by_endpoint = {"apollo_search": 1}
        connector_pressure_label = "low"
        sendgrid_event_count = 1
        sendgrid_anomaly_count_total = 0
        sendgrid_pressure_label_counts = {"low": 1}
        sendgrid_pressure_hint_counts = {"within_expected_window": 1}
        sendgrid_age_bucket_counts = {"fresh_lt_1h": 1}
        sendgrid_anomaly_event_type_counts = {}
        reason_codes = ["governance_ready"]

    recommended_commands = [
        "npm run verify:governance:weekly",
        "npm run verify:governance:packet:contract",
        "npm run verify:smoke:governance-packet",
    ]

    return {
        "generatedAt": generated_at,
        "exportSchemaVersion": 1,
        "windowDays": 7,
        "eventLimit": 1000,
        "status": status,
        "handoff": {
            "ownerRole": "Release Manager",
            "rolloutBlocked": rollout_blocked,
        },
        "runtimePrereqs": {
            "present": True,
            "available": True,
            "passed": not rollout_blocked,
            "contractValid": True,
            "valid": not rollout_blocked,
            "missingCheckCount": len(runtime_missing_checks["commands"]) + len(runtime_missing_checks["workspace"]),
            "missingChecks": runtime_missing_checks,
            "command": "npm run verify:baseline:runtime-prereqs:artifact",
            "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
            "generatedAt": generated_at,
            "validatedAt": generated_at,
        },
        "commandAliases": {
            "present": True,
            "available": True,
            "source": "governance_weekly_report",
            "gatePassed": len(command_alias_missing) == 0 and len(command_alias_mismatched) == 0,
            "contractValid": True,
            "valid": len(command_alias_missing) == 0 and len(command_alias_mismatched) == 0,
            "missingAliasCount": len(command_alias_missing),
            "mismatchedAliasCount": len(command_alias_mismatched),
            "missingAliases": command_alias_missing,
            "mismatchedAliases": command_alias_mismatched,
            "command": "npm run verify:baseline:command-aliases:artifact",
            "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
            "generatedAt": generated_at,
            "validatedAt": generated_at,
        },
        "reasonCodes": reason_codes,
        "recommendedCommands": recommended_commands,
        "summary": {
            "connectorRateLimit": {
                "eventCount": connector_event_count,
                "byEndpoint": connector_by_endpoint,
                "pressure": {"label": connector_pressure_label},
            },
            "sendgridWebhookTimestamp": {
                "eventCount": sendgrid_event_count,
                "timestampAnomalyCountTotal": sendgrid_anomaly_count_total,
                "pressureLabelCounts": sendgrid_pressure_label_counts,
                "pressureHintCounts": sendgrid_pressure_hint_counts,
                "timestampAgeBucketCounts": sendgrid_age_bucket_counts,
                "timestampAnomalyEventTypeCounts": sendgrid_anomaly_event_type_counts,
                "latestEventAt": generated_at,
            },
        },
        "governanceExport": {
            "status": status,
            "rolloutBlocked": rollout_blocked,
            "ownerRole": "Release Manager",
            "exportSchemaVersion": 1,
            "reasonCodes": reason_codes,
            "reasonCodeCount": len(reason_codes),
            "recommendedCommands": recommended_commands,
            "recommendedCommandCount": len(recommended_commands),
            "runtimePrereqs": {
                "present": True,
                "available": True,
                "passed": not rollout_blocked,
                "contractValid": True,
                "valid": not rollout_blocked,
                "missingCheckCount": len(runtime_missing_checks["commands"]) + len(runtime_missing_checks["workspace"]),
                "missingChecks": runtime_missing_checks,
                "command": "npm run verify:baseline:runtime-prereqs:artifact",
            },
            "commandAliases": {
                "present": True,
                "available": True,
                "source": "governance_weekly_report",
                "gatePassed": len(command_alias_missing) == 0 and len(command_alias_mismatched) == 0,
                "contractValid": True,
                "valid": len(command_alias_missing) == 0 and len(command_alias_mismatched) == 0,
                "missingAliasCount": len(command_alias_missing),
                "mismatchedAliasCount": len(command_alias_mismatched),
                "missingAliases": command_alias_missing,
                "mismatchedAliases": command_alias_mismatched,
                "command": "npm run verify:baseline:command-aliases:artifact",
            },
            "connectorRateLimit": {
                "eventCount": connector_event_count,
                "byEndpoint": connector_by_endpoint,
                "pressure": {"label": connector_pressure_label},
            },
            "sendgridWebhookTimestamp": {
                "eventCount": sendgrid_event_count,
                "timestampAnomalyCountTotal": sendgrid_anomaly_count_total,
                "pressureLabelCounts": sendgrid_pressure_label_counts,
                "pressureHintCounts": sendgrid_pressure_hint_counts,
                "timestampAgeBucketCounts": sendgrid_age_bucket_counts,
                "timestampAnomalyEventTypeCounts": sendgrid_anomaly_event_type_counts,
                "latestEventAt": generated_at,
            },
        },
    }


def _build_profile_artifacts(
    profile: str,
    requested_by: str,
) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    fixture_module = _load_module("generate_governance_packet_fixture.py")
    validator_module = _load_module("validate_governance_packet_artifacts.py")

    report_payload = _profile_payload(profile)
    handoff_payload, history_payload = fixture_module._build_packet_payloads(
        report_payload,
        Path("backend/test_reports/connector_governance_weekly_report.json"),
        requested_by,
    )

    if profile == "validation-fail":
        if isinstance(history_payload.get("reasonCodeCount"), int):
            history_payload["reasonCodeCount"] = history_payload["reasonCodeCount"] + 1

    validation_payload = validator_module.validate_governance_packet_artifacts(
        handoff_payload,
        history_payload,
    )
    validation_payload["validatedAt"] = _profile_timestamp(profile)
    validation_payload["valid"] = len(validation_payload.get("errors", [])) == 0

    return report_payload, handoff_payload, history_payload, validation_payload


def generate_fixtures(output_dir: str, prefix: str, requested_by: str) -> Dict[str, Any]:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    profiles = []

    for profile in SUPPORTED_PROFILES:
        report_payload, handoff_payload, history_payload, validation_payload = (
            _build_profile_artifacts(profile, requested_by)
        )

        bundle_prefix = f"governance_packet_bundle_fixture_{profile}"
        report_path = output_path / f"{bundle_prefix}_report.json"
        handoff_path = output_path / f"{bundle_prefix}_handoff.json"
        history_path = output_path / f"{bundle_prefix}_history.json"
        validation_path = output_path / f"{prefix}_{profile}.json"

        report_path.write_text(json.dumps(report_payload, indent=2), encoding="utf-8")
        handoff_path.write_text(json.dumps(handoff_payload, indent=2), encoding="utf-8")
        history_path.write_text(json.dumps(history_payload, indent=2), encoding="utf-8")
        validation_path.write_text(json.dumps(validation_payload, indent=2), encoding="utf-8")

        profiles.append(
            {
                "profile": profile,
                "valid": bool(validation_payload.get("valid")),
                "reportArtifact": str(report_path),
                "handoffArtifact": str(handoff_path),
                "historyArtifact": str(history_path),
                "validationArtifact": str(validation_path),
            }
        )

    return {
        "generatedAt": "2026-03-02T02:15:00+00:00",
        "command": COMMAND,
        "outputDir": str(output_path),
        "prefix": prefix,
        "profiles": profiles,
    }


def main() -> int:
    args = parse_args()
    manifest = generate_fixtures(args.output_dir, args.prefix, args.requested_by)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
