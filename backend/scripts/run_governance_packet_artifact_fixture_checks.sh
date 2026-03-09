#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv311/bin/python}"
ARTIFACT_DIR="backend/test_reports"
PREFIX="governance_packet_validation_fixture"

"$PYTHON_BIN" backend/scripts/generate_governance_packet_validation_artifact_fixtures.py \
  --output-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --requested-by u1

for profile in ready action-required validation-fail; do
  "$PYTHON_BIN" backend/scripts/validate_governance_packet_validation_artifact.py \
    --artifact "$ARTIFACT_DIR/${PREFIX}_${profile}.json"
done

"$PYTHON_BIN" backend/scripts/validate_governance_packet_validation_artifact_retention.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --min-count 3 \
  --max-age-days 30

"$PYTHON_BIN" backend/scripts/cleanup_governance_packet_validation_artifacts.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3

"$PYTHON_BIN" backend/scripts/evaluate_governance_packet_validation_artifact_cleanup_policy.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20

"$PYTHON_BIN" backend/scripts/run_governance_packet_validation_artifact_cleanup_guarded_apply.py \
  --artifact-dir "$ARTIFACT_DIR" \
  --prefix "$PREFIX" \
  --keep-days 30 \
  --keep-min-count 3 \
  --max-apply-candidates 20
