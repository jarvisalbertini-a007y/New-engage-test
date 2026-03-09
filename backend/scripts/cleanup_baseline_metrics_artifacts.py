#!/usr/bin/env python3
"""Cleanup stale baseline metrics artifacts with dry-run safety."""

from __future__ import annotations

import argparse
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cleanup stale baseline metrics artifacts."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing baseline metrics artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="baseline_metrics",
        help="Baseline metrics artifact filename prefix.",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=30,
        help="Retain artifacts newer than this many days.",
    )
    parser.add_argument(
        "--keep-min-count",
        type=int,
        default=3,
        help="Always keep at least this many newest artifacts.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete stale files. Without this flag, cleanup is dry-run.",
    )
    return parser.parse_args()


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_payload(path: Path) -> Dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def _load_validator_module():
    script_path = Path(__file__).resolve().parent / "validate_baseline_metrics_artifact.py"
    spec = importlib.util.spec_from_file_location(
        "validate_baseline_metrics_artifact",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load validator module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def discover_artifacts(artifact_dir: Path, prefix: str) -> List[Dict[str, Any]]:
    validator = _load_validator_module()
    records: List[Dict[str, Any]] = []
    for path in sorted(artifact_dir.glob(f"{prefix}_*.json")):
        payload = _load_payload(path)
        generated_at = _parse_iso_datetime(payload.get("generatedAt")) if payload else None
        contract_errors: List[str] = []
        if isinstance(payload, dict):
            contract_errors = list(validator.validate_artifact(payload))
        records.append(
            {
                "path": path,
                "payload": payload,
                "generatedAt": generated_at,
                "contractErrors": contract_errors,
            }
        )
    records.sort(
        key=lambda record: (
            record.get("generatedAt") or datetime.min.replace(tzinfo=timezone.utc),
            str((record.get("path") or Path("")).name),
        ),
        reverse=True,
    )
    return records


def plan_cleanup(
    artifact_dir: Path,
    prefix: str,
    keep_days: int,
    keep_min_count: int,
) -> List[Dict[str, Any]]:
    if keep_days < 1:
        raise ValueError("keep-days must be >= 1")
    if keep_min_count < 1:
        raise ValueError("keep-min-count must be >= 1")

    records = discover_artifacts(artifact_dir, prefix)
    threshold = datetime.now(timezone.utc) - timedelta(days=keep_days)
    stale: List[Dict[str, Any]] = []

    for idx, record in enumerate(records):
        if idx < keep_min_count:
            continue
        generated_at = record.get("generatedAt")
        payload = record.get("payload")
        contract_errors = record.get("contractErrors") or []

        if (
            generated_at is None
            or generated_at < threshold
            or payload is None
            or len(contract_errors) > 0
        ):
            stale.append(record)
    return stale


def execute_cleanup(stale_records: List[Dict[str, Any]], apply: bool) -> Dict[str, Any]:
    deleted: List[str] = []
    for record in stale_records:
        path = record.get("path")
        if not isinstance(path, Path):
            continue
        if apply:
            path.unlink(missing_ok=True)
            deleted.append(str(path))
    return {
        "mode": "apply" if apply else "dry-run",
        "candidateCount": len(stale_records),
        "deletedCount": len(deleted),
        "candidates": [str(record.get("path")) for record in stale_records],
        "deleted": deleted,
    }


def run_cleanup(
    artifact_dir: Path,
    prefix: str,
    keep_days: int,
    keep_min_count: int,
    apply: bool,
) -> Dict[str, Any]:
    stale_records = plan_cleanup(
        artifact_dir=artifact_dir,
        prefix=prefix,
        keep_days=keep_days,
        keep_min_count=keep_min_count,
    )
    return execute_cleanup(stale_records=stale_records, apply=apply)


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1

    try:
        summary = run_cleanup(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            apply=args.apply,
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    print(
        f"Baseline metrics artifact cleanup {summary['mode']} completed: "
        f"{summary['candidateCount']} candidate(s), {summary['deletedCount']} deleted."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
