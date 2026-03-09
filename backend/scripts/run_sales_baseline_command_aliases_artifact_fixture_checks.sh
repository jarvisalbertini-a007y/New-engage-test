#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"
ARTIFACT_DIR="backend/test_reports"
PREFIX="sales_baseline_command_aliases_fixture"

"$PYTHON_BIN" backend/scripts/generate_sales_baseline_command_aliases_artifact_fixtures.py \
  --output-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX"

for profile in healthy missing-alias mismatched-alias; do
  "$PYTHON_BIN" backend/scripts/validate_sales_baseline_command_aliases_artifact.py \
    --artifact "$ARTIFACT_DIR/${PREFIX}_${profile}.json"
done
