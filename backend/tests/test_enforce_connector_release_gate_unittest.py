import json
import os
import tempfile
import unittest

from scripts import enforce_connector_release_gate


class EnforceConnectorReleaseGateTests(unittest.TestCase):
    def _base_evidence(self):
        return {
            "sloSummary": {
                "decision": "PROCEED",
                "alerts": [],
                "gates": {
                    "overallPassed": True,
                    "schemaCoveragePassed": True,
                    "schemaSampleSizePassed": True,
                    "orchestrationAttemptErrorPassed": True,
                    "orchestrationAttemptSkippedPassed": True,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 100.0,
                    "sampleCount": 30,
                    "minSampleCount": 25,
                },
                "orchestrationAudit": {
                    "maxAttemptErrorCountThreshold": 5,
                    "observedAttemptErrorCount": 0,
                    "maxAttemptSkippedCountThreshold": 25,
                    "observedAttemptSkippedCount": 0,
                },
                "signoff": {
                    "status": "READY_FOR_APPROVAL",
                },
            }
        }

    def _base_validation(self):
        return {"valid": True}

    def test_release_gate_approves_when_all_checks_pass(self):
        result = enforce_connector_release_gate.evaluate_release_gate(
            self._base_evidence(),
            self._base_validation(),
        )
        self.assertTrue(result["approved"])
        self.assertEqual(result["failedChecks"], [])

    def test_release_gate_fails_on_hold_or_missing_validation(self):
        evidence = self._base_evidence()
        evidence["sloSummary"]["decision"] = "HOLD"
        validation = {"valid": False}
        result = enforce_connector_release_gate.evaluate_release_gate(evidence, validation)
        self.assertFalse(result["approved"])
        failed = set(result["failedChecks"])
        self.assertIn("validationPassed", failed)
        self.assertIn("decisionIsProceed", failed)

    def test_release_gate_fails_when_schema_gate_is_not_passed(self):
        evidence = self._base_evidence()
        evidence["sloSummary"]["gates"]["schemaCoveragePassed"] = False
        evidence["sloSummary"]["schemaCoverage"]["observedPct"] = 72.0
        evidence["sloSummary"]["schemaCoverage"]["thresholdPct"] = 95.0

        result = enforce_connector_release_gate.evaluate_release_gate(
            evidence,
            self._base_validation(),
        )
        self.assertFalse(result["approved"])
        self.assertIn("schemaCoveragePassed", result["failedChecks"])
        self.assertFalse(result["schemaCoverage"]["passed"])
        self.assertIn("below threshold", " ".join(result["reasons"]))

    def test_release_gate_fails_when_schema_sample_size_gate_is_not_passed(self):
        evidence = self._base_evidence()
        evidence["sloSummary"]["gates"]["schemaSampleSizePassed"] = False
        evidence["sloSummary"]["schemaCoverage"]["sampleCount"] = 8
        evidence["sloSummary"]["schemaCoverage"]["minSampleCount"] = 25

        result = enforce_connector_release_gate.evaluate_release_gate(
            evidence,
            self._base_validation(),
        )
        self.assertFalse(result["approved"])
        self.assertIn("schemaSampleSizePassed", result["failedChecks"])
        self.assertFalse(result["schemaCoverage"]["sampleSizePassed"])
        self.assertIn("below minimum", " ".join(result["reasons"]))

    def test_release_gate_fails_when_orchestration_attempt_gate_is_not_passed(self):
        evidence = self._base_evidence()
        evidence["sloSummary"]["gates"]["orchestrationAttemptErrorPassed"] = False
        evidence["sloSummary"]["orchestrationAudit"]["maxAttemptErrorCountThreshold"] = 1
        evidence["sloSummary"]["orchestrationAudit"]["observedAttemptErrorCount"] = 3

        result = enforce_connector_release_gate.evaluate_release_gate(
            evidence,
            self._base_validation(),
        )
        self.assertFalse(result["approved"])
        self.assertIn("orchestrationAttemptErrorPassed", result["failedChecks"])
        self.assertFalse(result["orchestrationAudit"]["attemptErrorPassed"])
        self.assertIn("above threshold", " ".join(result["reasons"]))

    def test_main_writes_output_and_returns_nonzero_when_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence_path = os.path.join(tmp, "evidence.json")
            validation_path = os.path.join(tmp, "validation.json")
            output_path = os.path.join(tmp, "gate_result.json")

            evidence = self._base_evidence()
            evidence["sloSummary"]["alerts"] = [{"gate": "error_rate"}]
            with open(evidence_path, "w", encoding="utf-8") as f:
                json.dump(evidence, f)
            with open(validation_path, "w", encoding="utf-8") as f:
                json.dump(self._base_validation(), f)

            class _Args:
                evidence = evidence_path
                validation = validation_path
                output = output_path

            original_parse_args = enforce_connector_release_gate.parse_args
            try:
                enforce_connector_release_gate.parse_args = lambda: _Args
                exit_code = enforce_connector_release_gate.main()
            finally:
                enforce_connector_release_gate.parse_args = original_parse_args

            self.assertEqual(exit_code, 1)
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            self.assertFalse(payload["approved"])


if __name__ == "__main__":
    unittest.main()
