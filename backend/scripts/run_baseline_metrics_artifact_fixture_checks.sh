#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"
ARTIFACT_DIR="backend/test_reports"
PREFIX="baseline_metrics_fixture"

"$PYTHON_BIN" backend/scripts/generate_baseline_metrics_artifact_fixtures.py \
  --output-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX"

for profile in healthy step-failure orchestration-unavailable; do
  "$PYTHON_BIN" backend/scripts/validate_baseline_metrics_artifact.py \
    --artifact "$ARTIFACT_DIR/${PREFIX}_${profile}.json"
done
