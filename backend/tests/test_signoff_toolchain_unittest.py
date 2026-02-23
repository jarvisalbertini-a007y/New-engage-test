import json
import os
import tempfile
import unittest

from scripts import generate_connector_signoff_template
from scripts import validate_connector_signoff_bundle


class SignoffToolchainTests(unittest.TestCase):
    def _evidence(self):
        return {
            "sloSummary": {
                "decision": "PROCEED",
                "alerts": [],
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
                "rolloutActions": [
                    {"priority": "P3", "ownerRole": "Release Manager", "action": "Proceed"}
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

    def test_generate_signoff_template_contains_core_sections(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence_path = os.path.join(tmp, "evidence.json")
            output_path = os.path.join(tmp, "signoff.md")

            with open(evidence_path, "w", encoding="utf-8") as f:
                json.dump(self._evidence(), f)

            class _Args:
                evidence = evidence_path
                output = output_path

            original_parse_args = generate_connector_signoff_template.parse_args
            try:
                generate_connector_signoff_template.parse_args = lambda: _Args
                exit_code = generate_connector_signoff_template.main()
            finally:
                generate_connector_signoff_template.parse_args = original_parse_args

            self.assertEqual(exit_code, 0)
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("Connector Rollout Signoff", content)
            self.assertIn("Decision: PROCEED", content)
            self.assertIn("Required Evidence", content)
            self.assertIn("Schema Evidence Traceability", content)
            self.assertIn("schemaCoverage.minSampleCount", content)
            self.assertIn("gates.schemaSampleSizePassed", content)
            self.assertIn("Required Approvals", content)

    def test_end_to_end_signoff_validation_passes_with_required_markers(self):
        with tempfile.TemporaryDirectory() as tmp:
            evidence = self._evidence()
            evidence_path = os.path.join(tmp, "connector_canary_evidence.json")
            signoff_path = os.path.join(tmp, "connector_signoff.md")
            with open(evidence_path, "w", encoding="utf-8") as f:
                json.dump(evidence, f)

            # Generate template
            class _ArgsGen:
                evidence = evidence_path
                output = signoff_path

            original_gen = generate_connector_signoff_template.parse_args
            try:
                generate_connector_signoff_template.parse_args = lambda: _ArgsGen
                self.assertEqual(generate_connector_signoff_template.main(), 0)
            finally:
                generate_connector_signoff_template.parse_args = original_gen

            # Simulate approvals and required files
            with open(signoff_path, "a", encoding="utf-8") as f:
                f.write("\n- [x] Release Manager\n- [x] Sales Ops Lead\n")
            for filename in evidence["sloSummary"]["signoff"]["requiredEvidence"]:
                with open(os.path.join(tmp, filename), "w", encoding="utf-8") as f:
                    f.write("{}")

            with open(signoff_path, "r", encoding="utf-8") as f:
                signoff_content = f.read()
            result = validate_connector_signoff_bundle.validate_signoff_bundle(
                evidence,
                signoff_content,
                tmp,
            )
            self.assertTrue(result["valid"])


if __name__ == "__main__":
    unittest.main()
