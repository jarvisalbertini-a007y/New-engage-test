#!/usr/bin/env python3
"""Generate deterministic policy/guarded artifacts for event-root backfill contract checks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Tuple


ALLOW_APPLY_ENV_VAR = "BACKFILL_ALLOW_APPLY"
POLICY_COMMAND = "evaluate_integration_telemetry_event_root_backfill_policy"
GUARDED_COMMAND = "run_integration_telemetry_event_root_backfill_guarded_apply"
SUPPORTED_PROFILES = ("skip", "allow", "action-required")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate deterministic policy + guarded artifacts for telemetry event-root "
            "backfill validator fixtures."
        )
    )
    parser.add_argument(
        "--output-dir",
        default="backend/test_reports",
        help="Directory where fixture artifacts are written.",
    )
    parser.add_argument(
        "--prefix",
        default="integration_telemetry_event_root_backfill",
        help="Filename prefix for generated artifacts.",
    )
    return parser.parse_args()


def _profile_timestamp(profile: str, offset_seconds: int = 0) -> str:
    base = {
        "skip": "2026-02-27T00:00:00+00:00",
        "allow": "2026-02-27T00:05:00+00:00",
        "action-required": "2026-02-27T00:10:00+00:00",
    }[profile]
    if offset_seconds <= 0:
        return base
    hour_prefix, plus_tz = base.split("+", 1)
    date_part, time_part = hour_prefix.split("T", 1)
    hh, mm, ss = [int(value) for value in time_part.split(":")]
    ss += offset_seconds
    mm += ss // 60
    ss = ss % 60
    hh += mm // 60
    mm = mm % 60
    return f"{date_part}T{hh:02d}:{mm:02d}:{ss:02d}+{plus_tz}"


def _profile_counts(profile: str) -> Dict[str, int]:
    if profile == "skip":
        return {
            "candidateCount": 0,
            "maxApplyCandidates": 2000,
            "scannedCount": 120,
            "updatedCount": 0,
        }
    if profile == "allow":
        return {
            "candidateCount": 3,
            "maxApplyCandidates": 2000,
            "scannedCount": 120,
            "updatedCount": 3,
        }
    return {
        "candidateCount": 2501,
        "maxApplyCandidates": 2000,
        "scannedCount": 5000,
        "updatedCount": 0,
    }


def build_fixture_payloads(profile: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if profile not in SUPPORTED_PROFILES:
        raise ValueError(f"Unsupported profile: {profile}")

    counts = _profile_counts(profile)
    decision = {
        "skip": "SKIP_APPLY",
        "allow": "ALLOW_APPLY",
        "action-required": "ACTION_REQUIRED",
    }[profile]
    allow_flag = profile == "allow"
    recommended_command = {
        "skip": None,
        "allow": "npm run verify:telemetry:event-root:backfill:apply:guarded",
        "action-required": "npm run verify:telemetry:event-root:backfill:dry-run -- --max-docs 5000",
    }[profile]
    reason = {
        "skip": "No telemetry event-root backfill candidates detected.",
        "allow": "Backfill candidates are within unattended threshold and apply is authorized.",
        "action-required": "Candidate count exceeds unattended apply threshold; split scope or run manual review first.",
    }[profile]

    dry_run_summary = {
        "mode": "dry-run",
        "batchSize": 500,
        "maxDocs": 50000,
        "scannedCount": counts["scannedCount"],
        "candidateCount": counts["candidateCount"],
        "updatedCount": 0,
        "fieldBackfillCounts": {
            "requestId": counts["candidateCount"],
            "schemaVersion": counts["candidateCount"],
            "governanceStatus": counts["candidateCount"],
            "governancePacketValidationStatus": counts["candidateCount"],
            "governancePacketValidationWithinFreshness": counts["candidateCount"],
        },
    }

    policy = {
        "generatedAt": _profile_timestamp(profile),
        "command": POLICY_COMMAND,
        "decision": decision,
        "reason": reason,
        "maxApplyCandidates": counts["maxApplyCandidates"],
        "candidateCount": counts["candidateCount"],
        "allowApplyFlag": allow_flag,
        "allowApplyEnvVar": ALLOW_APPLY_ENV_VAR,
        "recommendedCommand": recommended_command,
        "dryRunSummary": dry_run_summary,
    }

    guarded: Dict[str, Any] = {
        "generatedAt": _profile_timestamp(profile, offset_seconds=1),
        "command": GUARDED_COMMAND,
        "policy": {
            "decision": policy["decision"],
            "reason": policy["reason"],
            "maxApplyCandidates": policy["maxApplyCandidates"],
            "candidateCount": policy["candidateCount"],
            "allowApplyFlag": policy["allowApplyFlag"],
            "allowApplyEnvVar": policy["allowApplyEnvVar"],
            "recommendedCommand": policy["recommendedCommand"],
            "dryRunSummary": policy["dryRunSummary"],
        },
    }
    if decision == "ALLOW_APPLY":
        guarded["apply"] = {
            "mode": "apply",
            "batchSize": 500,
            "maxDocs": 50000,
            "scannedCount": counts["scannedCount"],
            "candidateCount": counts["candidateCount"],
            "updatedCount": counts["updatedCount"],
            "fieldBackfillCounts": dry_run_summary["fieldBackfillCounts"],
        }

    return policy, guarded


def generate_fixtures(output_dir: str, prefix: str) -> Dict[str, Any]:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    profiles = []
    for profile in SUPPORTED_PROFILES:
        policy_payload, guarded_payload = build_fixture_payloads(profile)
        policy_path = output_path / f"{prefix}_{profile}_policy.json"
        guarded_path = output_path / f"{prefix}_{profile}_guarded.json"
        policy_path.write_text(json.dumps(policy_payload, indent=2), encoding="utf-8")
        guarded_path.write_text(json.dumps(guarded_payload, indent=2), encoding="utf-8")
        profiles.append(
            {
                "profile": profile,
                "decision": policy_payload["decision"],
                "policyArtifact": str(policy_path),
                "guardedArtifact": str(guarded_path),
            }
        )
    return {
        "generatedAt": "2026-02-27T00:15:00+00:00",
        "command": "generate_integration_telemetry_event_root_backfill_artifact_fixtures",
        "outputDir": str(output_path),
        "prefix": prefix,
        "profiles": profiles,
    }


def main():
    args = parse_args()
    manifest = generate_fixtures(args.output_dir, args.prefix)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
