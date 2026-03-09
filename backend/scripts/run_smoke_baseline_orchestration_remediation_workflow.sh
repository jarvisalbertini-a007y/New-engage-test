#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_orchestration_slo_gate_workflow.sh
.venv311/bin/python backend/scripts/validate_baseline_metrics_artifact.py --artifact backend/test_reports/baseline_metrics.json
.venv311/bin/python -m pytest -q backend/tests/test_baseline_governance_drift_smoke.py
.venv311/bin/python -m pytest -q backend/tests/test_baseline_governance_recommended_commands_smoke.py
