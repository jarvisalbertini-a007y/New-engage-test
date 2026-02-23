import json
import os
import tempfile
import unittest

from scripts import validate_connector_signoff_bundle


class ValidateConnectorSignoffBundleTests(unittest.TestCase):
    def _base_evidence(self):
        return {
            "sloSummary": {
                "decision": "PROCEED",
                "gates": {
                    "schemaCoveragePassed": True,
                    "schemaSampleSizePassed": True,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 100.0,
                    "sampleCount": 30,
                    "minSampleCount": 25,
                },
                "signoff": {
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

    def _schema_traceability_lines(self):
        return [
            "- [ ] schemaCoverage.thresholdPct = 95.0",
            "- [ ] schemaCoverage.observedPct = 100.0",
            "- [ ] schemaCoverage.sampleCount = 30",
            "- [ ] schemaCoverage.minSampleCount = 25",
            "- [ ] gates.schemaCoveragePassed = True",
            "- [ ] gates.schemaSampleSizePassed = True",
        ]

    def test_validation_passes_when_all_artifacts_and_approvals_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                with open(os.path.join(tmp, file_name), "w", encoding="utf-8") as f:
                    f.write("{}")

            signoff_md = "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    *self._schema_traceability_lines(),
                ]
            )
            result = validate_connector_signoff_bundle.validate_signoff_bundle(
                self._base_evidence(),
                signoff_md,
                tmp,
            )
            self.assertTrue(result["valid"])
            self.assertEqual(result["errors"], [])
            self.assertEqual(len(result["checks"]["schemaTraceability"]), 6)

    def test_validation_fails_when_artifacts_or_approvals_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            # only create one required file
            with open(os.path.join(tmp, "connector_canary_evidence.json"), "w", encoding="utf-8") as f:
                f.write("{}")

            signoff_md = "\n".join(["- [x] Release Manager", *self._schema_traceability_lines()])
            result = validate_connector_signoff_bundle.validate_signoff_bundle(
                self._base_evidence(),
                signoff_md,
                tmp,
            )
            self.assertFalse(result["valid"])
            errors_text = "\n".join(result["errors"])
            self.assertIn("Missing required evidence file", errors_text)
            self.assertIn("Missing required approval: Sales Ops Lead", errors_text)

    def test_validation_fails_when_schema_traceability_markers_are_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                with open(os.path.join(tmp, file_name), "w", encoding="utf-8") as f:
                    f.write("{}")

            signoff_md = "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                ]
            )
            result = validate_connector_signoff_bundle.validate_signoff_bundle(
                self._base_evidence(),
                signoff_md,
                tmp,
            )
            self.assertFalse(result["valid"])
            errors_text = "\n".join(result["errors"])
            self.assertIn("Missing schema traceability checklist item", errors_text)

    def test_main_writes_output_and_returns_nonzero_on_invalid_bundle(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence_path = os.path.join(tmp, "evidence.json")
            signoff_path = os.path.join(tmp, "signoff.md")
            output_path = os.path.join(tmp, "validation.json")

            with open(evidence_path, "w", encoding="utf-8") as f:
                json.dump(self._base_evidence(), f)
            with open(signoff_path, "w", encoding="utf-8") as f:
                f.write("- [ ] Release Manager\n")

            # monkeypatch argv through parse_args indirection
            class _Args:
                evidence = evidence_path
                signoff = signoff_path
                artifacts_dir = tmp
                output = output_path

            original_parse_args = validate_connector_signoff_bundle.parse_args
            try:
                validate_connector_signoff_bundle.parse_args = lambda: _Args
                exit_code = validate_connector_signoff_bundle.main()
            finally:
                validate_connector_signoff_bundle.parse_args = original_parse_args

            self.assertEqual(exit_code, 1)
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            self.assertFalse(payload["valid"])


if __name__ == "__main__":
    unittest.main()
