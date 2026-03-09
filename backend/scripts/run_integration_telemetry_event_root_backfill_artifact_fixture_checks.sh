#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"
OUTPUT_DIR="backend/test_reports"
PREFIX="integration_telemetry_event_root_backfill"

"$PYTHON_BIN" backend/scripts/generate_integration_telemetry_event_root_backfill_artifact_fixtures.py \
  --output-dir "$OUTPUT_DIR" \
  --prefix "$PREFIX"

for PROFILE in skip allow action-required; do
  POLICY_ARTIFACT="$OUTPUT_DIR/${PREFIX}_${PROFILE}_policy.json"
  GUARDED_ARTIFACT="$OUTPUT_DIR/${PREFIX}_${PROFILE}_guarded.json"
  VALIDATION_ARTIFACT="$OUTPUT_DIR/${PREFIX}_${PROFILE}_validation.json"
  "$PYTHON_BIN" backend/scripts/validate_integration_telemetry_event_root_backfill_artifacts.py \
    --policy-artifact "$POLICY_ARTIFACT" \
    --guarded-artifact "$GUARDED_ARTIFACT" \
    --output "$VALIDATION_ARTIFACT"
done
