import json
import os
import tempfile
import unittest
import urllib.error

from scripts import collect_connector_canary_evidence
from scripts import evaluate_connector_slo_gates


class ConnectorSloScriptQueryTests(unittest.TestCase):
    def test_evaluate_slo_gates_includes_schema_threshold_query_param(self):
        captured = {"url": None}

        def _fake_fetch_json(url, _token):
            captured["url"] = url
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 90
            min_schema_v2_sample_count = 25
            max_orchestration_attempt_error_count = 1
            max_orchestration_attempt_skipped_count = 3

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 0)
        self.assertIsNotNone(captured["url"])
        self.assertIn("max_error_rate_pct=5", captured["url"])
        self.assertIn("min_schema_v2_pct=90", captured["url"])
        self.assertIn("min_schema_v2_sample_count=25", captured["url"])
        self.assertIn("max_orchestration_attempt_error_count=1", captured["url"])
        self.assertIn("max_orchestration_attempt_skipped_count=3", captured["url"])

    def test_collect_canary_evidence_passes_schema_threshold_to_slo_url(self):
        urls = []

        def _fake_fetch_json(url, _token):
            urls.append(url)
            if "telemetry/summary" in url:
                return {"eventCount": 1}
            if "integrations/health" in url:
                return {"providers": []}
            return {"decision": "PROCEED", "gates": {"overallPassed": True}}

        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "connector_canary_evidence.json")

            class _Args:
                base_url = "http://127.0.0.1:8000"
                token = "token"
                days = 7
                limit = 1000
                max_error_rate_pct = 5
                min_schema_v2_pct = 95
                min_schema_v2_sample_count = 30
                max_orchestration_attempt_error_count = 2
                max_orchestration_attempt_skipped_count = 4
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

        slo_urls = [url for url in urls if "telemetry/slo-gates" in url]
        self.assertEqual(len(slo_urls), 1)
        self.assertIn("max_error_rate_pct=5", slo_urls[0])
        self.assertIn("min_schema_v2_pct=95", slo_urls[0])
        self.assertIn("min_schema_v2_sample_count=30", slo_urls[0])
        self.assertIn("max_orchestration_attempt_error_count=2", slo_urls[0])
        self.assertIn("max_orchestration_attempt_skipped_count=4", slo_urls[0])

    def test_evaluate_slo_gates_omits_threshold_query_when_not_provided(self):
        captured = {"url": None}

        def _fake_fetch_json(url, _token):
            captured["url"] = url
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = None
            min_schema_v2_pct = None
            min_schema_v2_sample_count = None

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 0)
        self.assertIsNotNone(captured["url"])
        self.assertNotIn("max_error_rate_pct", captured["url"])
        self.assertNotIn("min_schema_v2_pct", captured["url"])
        self.assertNotIn("min_schema_v2_sample_count", captured["url"])
        self.assertNotIn("max_orchestration_attempt_error_count", captured["url"])
        self.assertNotIn("max_orchestration_attempt_skipped_count", captured["url"])

    def test_collect_canary_evidence_omits_threshold_query_when_not_provided(self):
        urls = []

        def _fake_fetch_json(url, _token):
            urls.append(url)
            if "telemetry/summary" in url:
                return {"eventCount": 1}
            if "integrations/health" in url:
                return {"providers": []}
            return {"decision": "PROCEED", "gates": {"overallPassed": True}}

        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "connector_canary_evidence.json")

            class _Args:
                base_url = "http://127.0.0.1:8000"
                token = "token"
                days = 7
                limit = 1000
                max_error_rate_pct = None
                min_schema_v2_pct = None
                min_schema_v2_sample_count = None
                max_orchestration_attempt_error_count = None
                max_orchestration_attempt_skipped_count = None
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

        slo_urls = [url for url in urls if "telemetry/slo-gates" in url]
        self.assertEqual(len(slo_urls), 1)
        self.assertNotIn("max_error_rate_pct", slo_urls[0])
        self.assertNotIn("min_schema_v2_pct", slo_urls[0])
        self.assertNotIn("min_schema_v2_sample_count", slo_urls[0])
        self.assertNotIn("max_orchestration_attempt_error_count", slo_urls[0])
        self.assertNotIn("max_orchestration_attempt_skipped_count", slo_urls[0])

    def test_collect_canary_evidence_rejects_out_of_range_orchestration_error_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"ok": True}

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
                max_orchestration_attempt_error_count = -1
                max_orchestration_attempt_skipped_count = None
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

            self.assertEqual(exit_code, 2)
            self.assertFalse(called["fetch"])
            self.assertFalse(os.path.exists(output_path))

    def test_collect_canary_evidence_rejects_out_of_range_orchestration_skipped_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"ok": True}

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
                max_orchestration_attempt_error_count = None
                max_orchestration_attempt_skipped_count = 5001
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

            self.assertEqual(exit_code, 2)
            self.assertFalse(called["fetch"])
            self.assertFalse(os.path.exists(output_path))

    def test_evaluate_slo_gates_rejects_out_of_range_schema_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 120
            min_schema_v2_sample_count = 25

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 2)
        self.assertFalse(called["fetch"])

    def test_evaluate_slo_gates_rejects_out_of_range_schema_sample_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 95
            min_schema_v2_sample_count = 0

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 2)
        self.assertFalse(called["fetch"])

    def test_evaluate_slo_gates_rejects_out_of_range_orchestration_error_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 95
            min_schema_v2_sample_count = 25
            max_orchestration_attempt_error_count = -1
            max_orchestration_attempt_skipped_count = None

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 2)
        self.assertFalse(called["fetch"])

    def test_evaluate_slo_gates_rejects_out_of_range_orchestration_skipped_threshold(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"gates": {"overallPassed": True}}

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 95
            min_schema_v2_sample_count = 25
            max_orchestration_attempt_error_count = None
            max_orchestration_attempt_skipped_count = 5001

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 2)
        self.assertFalse(called["fetch"])

    def test_collect_canary_evidence_rejects_out_of_range_limit(self):
        called = {"fetch": False}

        def _fake_fetch_json(_url, _token):
            called["fetch"] = True
            return {"ok": True}

        with tempfile.TemporaryDirectory() as tmp:
            output_path = os.path.join(tmp, "connector_canary_evidence.json")

            class _Args:
                base_url = "http://127.0.0.1:8000"
                token = "token"
                days = 7
                limit = 50
                max_error_rate_pct = 5
                min_schema_v2_pct = 95
                min_schema_v2_sample_count = 25
                max_orchestration_attempt_error_count = None
                max_orchestration_attempt_skipped_count = None
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

            self.assertEqual(exit_code, 2)
            self.assertFalse(called["fetch"])
            self.assertFalse(os.path.exists(output_path))

    def test_evaluate_slo_gates_returns_nonzero_on_network_error(self):
        def _fake_fetch_json(_url, _token):
            raise urllib.error.URLError("timed out")

        class _Args:
            base_url = "http://127.0.0.1:8000"
            token = "token"
            days = 7
            limit = 2000
            max_error_rate_pct = 5
            min_schema_v2_pct = 95
            min_schema_v2_sample_count = 25

        original_parse = evaluate_connector_slo_gates.parse_args
        original_fetch = evaluate_connector_slo_gates.fetch_json
        try:
            evaluate_connector_slo_gates.parse_args = lambda: _Args
            evaluate_connector_slo_gates.fetch_json = _fake_fetch_json
            exit_code = evaluate_connector_slo_gates.main()
        finally:
            evaluate_connector_slo_gates.parse_args = original_parse
            evaluate_connector_slo_gates.fetch_json = original_fetch

        self.assertEqual(exit_code, 2)

    def test_collect_canary_evidence_returns_nonzero_on_http_error(self):
        def _fake_fetch_json(_url, _token):
            raise urllib.error.HTTPError("http://127.0.0.1:8000/fail", 503, "unavailable", None, None)

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
                max_orchestration_attempt_error_count = None
                max_orchestration_attempt_skipped_count = None
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

            self.assertEqual(exit_code, 1)
            self.assertFalse(os.path.exists(output_path))


if __name__ == "__main__":
    unittest.main()
