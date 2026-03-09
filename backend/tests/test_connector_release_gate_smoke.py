import json
import os
import tempfile

from scripts import enforce_connector_release_gate
from scripts import generate_connector_signoff_template
from scripts import validate_connector_signoff_bundle


def _build_evidence(
    schema_gate_passed: bool,
    observed_pct: float,
    sample_gate_passed: bool = True,
    sample_count: int = 30,
    min_sample_count: int = 25,
    orchestration_error_gate_passed: bool = True,
    orchestration_skipped_gate_passed: bool = True,
    observed_attempt_error_count: int = 0,
    max_attempt_error_count_threshold: int = 5,
    observed_attempt_skipped_count: int = 0,
    max_attempt_skipped_count_threshold: int = 25,
) -> dict:
    return {
        "sloSummary": {
            "decision": "PROCEED",
            "alerts": [],
            "gates": {
                "overallPassed": (
                    schema_gate_passed
                    and sample_gate_passed
                    and orchestration_error_gate_passed
                    and orchestration_skipped_gate_passed
                ),
                "schemaCoveragePassed": schema_gate_passed,
                "schemaSampleSizePassed": sample_gate_passed,
                "orchestrationAttemptErrorPassed": orchestration_error_gate_passed,
                "orchestrationAttemptSkippedPassed": orchestration_skipped_gate_passed,
            },
            "schemaCoverage": {
                "thresholdPct": 95.0,
                "observedPct": observed_pct,
                "sampleCount": sample_count,
                "minSampleCount": min_sample_count,
                "schemaV2Count": int((observed_pct / 100.0) * sample_count),
            },
            "orchestrationAudit": {
                "maxAttemptErrorCountThreshold": max_attempt_error_count_threshold,
                "observedAttemptErrorCount": observed_attempt_error_count,
                "maxAttemptSkippedCountThreshold": max_attempt_skipped_count_threshold,
                "observedAttemptSkippedCount": observed_attempt_skipped_count,
            },
            "rolloutActions": [
                {
                    "priority": "P3",
                    "ownerRole": "Release Manager",
                    "action": "Proceed with connector expansion",
                }
            ],
            "signoff": {
                "status": "READY_FOR_APPROVAL",
                "requiredEvidence": [
                    "connector_canary_evidence.json",
                    "telemetry_slo_gates_snapshot.json",
                ],
                "requiredApprovals": [
                    {"role": "Release Manager", "required": True},
                    {"role": "Sales Ops Lead", "required": True},
                ],
            },
        }
    }


def _run_generate(evidence_path: str, output_path: str) -> int:
    class _Args:
        evidence = evidence_path
        output = output_path

    original_parse = generate_connector_signoff_template.parse_args
    try:
        generate_connector_signoff_template.parse_args = lambda: _Args
        return generate_connector_signoff_template.main()
    finally:
        generate_connector_signoff_template.parse_args = original_parse


def _run_validate(evidence_path: str, signoff_path: str, artifacts_dir: str, output_path: str) -> int:
    artifacts_dir_path = artifacts_dir

    class _Args:
        evidence = evidence_path
        signoff = signoff_path
        artifacts_dir = artifacts_dir_path
        output = output_path

    original_parse = validate_connector_signoff_bundle.parse_args
    try:
        validate_connector_signoff_bundle.parse_args = lambda: _Args
        return validate_connector_signoff_bundle.main()
    finally:
        validate_connector_signoff_bundle.parse_args = original_parse


def _run_enforce(evidence_path: str, validation_path: str, output_path: str) -> int:
    class _Args:
        evidence = evidence_path
        validation = validation_path
        output = output_path

    original_parse = enforce_connector_release_gate.parse_args
    try:
        enforce_connector_release_gate.parse_args = lambda: _Args
        return enforce_connector_release_gate.main()
    finally:
        enforce_connector_release_gate.parse_args = original_parse


def test_release_gate_smoke_blocks_then_approves_after_schema_recovery():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(_build_evidence(schema_gate_passed=False, observed_pct=80.0), f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
        for artifact in ["connector_canary_evidence.json", "telemetry_slo_gates_snapshot.json"]:
            artifact_path = os.path.join(tmp, artifact)
            if artifact_path == evidence_path:
                continue
            with open(artifact_path, "w", encoding="utf-8") as f:
                f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            blocked_payload = json.load(f)
        assert blocked_payload["approved"] is False
        assert "schemaCoveragePassed" in blocked_payload["failedChecks"]

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(_build_evidence(schema_gate_passed=True, observed_pct=100.0), f)

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 0
        with open(release_path, "r", encoding="utf-8") as f:
            approved_payload = json.load(f)
        assert approved_payload["approved"] is True
        assert approved_payload["failedChecks"] == []


def test_release_gate_smoke_blocks_when_alerts_are_active():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        evidence = _build_evidence(schema_gate_passed=True, observed_pct=100.0)
        evidence["sloSummary"]["alerts"] = [
            {
                "gate": "error_rate",
                "severity": "critical",
                "message": "error rate above threshold",
            }
        ]
        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(evidence, f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
        with open(os.path.join(tmp, "telemetry_slo_gates_snapshot.json"), "w", encoding="utf-8") as f:
            f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "noActiveAlerts" in payload["failedChecks"]


def test_release_gate_smoke_blocks_then_approves_after_orchestration_recovery():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(
                _build_evidence(
                    schema_gate_passed=True,
                    observed_pct=100.0,
                    orchestration_error_gate_passed=False,
                    orchestration_skipped_gate_passed=False,
                    observed_attempt_error_count=3,
                    max_attempt_error_count_threshold=1,
                    observed_attempt_skipped_count=4,
                    max_attempt_skipped_count_threshold=2,
                ),
                f,
            )

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
        for artifact in ["connector_canary_evidence.json", "telemetry_slo_gates_snapshot.json"]:
            artifact_path = os.path.join(tmp, artifact)
            if artifact_path == evidence_path:
                continue
            with open(artifact_path, "w", encoding="utf-8") as f:
                f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            blocked_payload = json.load(f)
        assert blocked_payload["approved"] is False
        assert "orchestrationAttemptErrorPassed" in blocked_payload["failedChecks"]
        assert "orchestrationAttemptSkippedPassed" in blocked_payload["failedChecks"]

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(
                _build_evidence(
                    schema_gate_passed=True,
                    observed_pct=100.0,
                    orchestration_error_gate_passed=True,
                    orchestration_skipped_gate_passed=True,
                    observed_attempt_error_count=1,
                    max_attempt_error_count_threshold=1,
                    observed_attempt_skipped_count=2,
                    max_attempt_skipped_count_threshold=2,
                ),
                f,
            )

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 0
        with open(release_path, "r", encoding="utf-8") as f:
            approved_payload = json.load(f)
        assert approved_payload["approved"] is True
        assert approved_payload["failedChecks"] == []


def test_release_gate_smoke_blocks_when_required_approval_is_missing():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(_build_evidence(schema_gate_passed=True, observed_pct=100.0), f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n")
        with open(os.path.join(tmp, "telemetry_slo_gates_snapshot.json"), "w", encoding="utf-8") as f:
            f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 1
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "validationPassed" in payload["failedChecks"]


def test_release_gate_smoke_blocks_when_required_evidence_artifact_is_missing():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(_build_evidence(schema_gate_passed=True, observed_pct=100.0), f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
        # Intentionally do not create telemetry_slo_gates_snapshot.json.

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 1
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "validationPassed" in payload["failedChecks"]


def test_release_gate_smoke_blocks_when_approval_markers_are_malformed():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(_build_evidence(schema_gate_passed=True, observed_pct=100.0), f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] release manager\n")
            f.write("Sales Ops Lead - APPROVED\n")
        with open(os.path.join(tmp, "telemetry_slo_gates_snapshot.json"), "w", encoding="utf-8") as f:
            f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 1
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "validationPassed" in payload["failedChecks"]


def test_release_gate_smoke_blocks_when_evidence_payload_is_malformed():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump({"unexpected": "shape"}, f)

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "decisionIsProceed" in payload["failedChecks"]
        assert "signoffReady" in payload["failedChecks"]


def test_release_gate_smoke_blocks_when_schema_sample_size_gate_is_not_passed():
    with tempfile.TemporaryDirectory() as tmp:
        evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
        signoff_path = os.path.join(tmp, "connector_signoff.md")
        validation_path = os.path.join(tmp, "connector_signoff_validation.json")
        release_path = os.path.join(tmp, "connector_release_gate_result.json")

        with open(evidence_path, "w", encoding="utf-8") as f:
            json.dump(
                _build_evidence(
                    schema_gate_passed=True,
                    observed_pct=100.0,
                    sample_gate_passed=False,
                    sample_count=8,
                    min_sample_count=25,
                ),
                f,
            )

        assert _run_generate(evidence_path, signoff_path) == 0
        with open(signoff_path, "a", encoding="utf-8") as f:
            f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
        with open(os.path.join(tmp, "telemetry_slo_gates_snapshot.json"), "w", encoding="utf-8") as f:
            f.write("{}")

        assert _run_validate(evidence_path, signoff_path, tmp, validation_path) == 0
        assert _run_enforce(evidence_path, validation_path, release_path) == 1
        with open(release_path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        assert payload["approved"] is False
        assert "schemaSampleSizePassed" in payload["failedChecks"]
