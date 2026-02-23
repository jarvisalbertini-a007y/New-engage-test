import json
import os
import tempfile
import unittest
import urllib.parse

from scripts import collect_connector_canary_evidence


class ConnectorCanaryDryRunSmokeTests(unittest.TestCase):
    def test_collect_canary_evidence_dry_run_persists_schema_sample_override(self):
        captured_urls = []

        def _fake_fetch_json(url, _token):
            captured_urls.append(url)
            if "telemetry/summary" in url:
                return {
                    "eventCount": 20,
                    "salesIntelligence": {"eventCount": 10, "bySchemaVersion": {"2": 10}},
                }
            if "integrations/health" in url:
                return {"providers": [{"provider": "apollo", "healthy": True}]}

            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query)
            min_sample = int(query.get("min_schema_v2_sample_count", ["25"])[0])
            observed_sample = 10
            return {
                "decision": "HOLD",
                "gates": {
                    "overallPassed": False,
                    "schemaCoveragePassed": True,
                    "schemaSampleSizePassed": False,
                },
                "schemaCoverage": {
                    "thresholdPct": 95.0,
                    "observedPct": 100.0,
                    "sampleCount": observed_sample,
                    "minSampleCount": min_sample,
                    "schemaV2Count": observed_sample,
                },
                "alerts": [
                    {
                        "gate": "schema_sample_size",
                        "severity": "medium",
                        "message": f"sample count {observed_sample} below {min_sample}",
                    }
                ],
                "rolloutActions": [
                    {
                        "priority": "P2",
                        "ownerRole": "Sales Ops Lead",
                        "action": "Collect additional schema-v2 telemetry samples.",
                        "trigger": "schema sample threshold not met",
                    }
                ],
                "signoff": {
                    "status": "HOLD_REMEDIATION_REQUIRED",
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                    ],
                },
            }

        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "connector_canary_evidence.json")

            class _Args:
                base_url = "http://127.0.0.1:8000"
                token = "token"
                days = 7
                limit = 1000
                max_error_rate_pct = 5
                min_schema_v2_pct = 95
                min_schema_v2_sample_count = 25
                output = output_path

            original_parse = collect_connector_canary_evidence.parse_args
            original_fetch = collect_connector_canary_evidence.fetch_json
            try:
                collect_connector_canary_evidence.parse_args = lambda: _Args
                collect_connector_canary_evidence.fetch_json = _fake_fetch_json
                exit_code = collect_connector_canary_evidence.main()
            finally:
                collect_connector_canary_evidence.parse_args = original_parse
                collect_connector_canary_evidence.fetch_json = original_fetch

            self.assertEqual(exit_code, 0)
            self.assertTrue(os.path.exists(output_path))

            with open(output_path, "r", encoding="utf-8") as f:
                payload = json.load(f)

            self.assertIn("sloSummary", payload)
            self.assertFalse(payload["sloSummary"]["gates"]["schemaSampleSizePassed"])
            self.assertEqual(payload["sloSummary"]["schemaCoverage"]["sampleCount"], 10)
            self.assertEqual(payload["sloSummary"]["schemaCoverage"]["minSampleCount"], 25)

        slo_urls = [url for url in captured_urls if "telemetry/slo-gates" in url]
        self.assertEqual(len(slo_urls), 1)
        self.assertIn("min_schema_v2_sample_count=25", slo_urls[0])


if __name__ == "__main__":
    unittest.main()
