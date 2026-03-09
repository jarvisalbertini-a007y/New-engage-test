import json
import os
import tempfile
import unittest

from scripts import generate_governance_packet_fixture


class GenerateGovernancePacketFixtureTests(unittest.TestCase):
    def _write_report(self, path: str, status: str, rollout_blocked: bool):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": status,
                    "handoff": {"ownerRole": "Release Manager"},
                    "governanceExport": {
                        "governanceType": "weekly_report",
                        "exportSchemaVersion": 1,
                        "status": status,
                        "rolloutBlocked": rollout_blocked,
                        "ownerRole": "Release Manager",
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {
                                "commands": [],
                                "workspace": [],
                            },
                            "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
                            "generatedAt": "2026-02-23T00:00:00+00:00",
                            "validatedAt": "2026-02-23T00:00:00+00:00",
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "baseline_metrics",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                            "generatedAt": "2026-02-23T00:00:00+00:00",
                            "validatedAt": "2026-02-23T00:00:00+00:00",
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {
                            "commands": [],
                            "workspace": [],
                        },
                        "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
                        "generatedAt": "2026-02-23T00:00:00+00:00",
                        "validatedAt": "2026-02-23T00:00:00+00:00",
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "baseline_metrics",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                        "generatedAt": "2026-02-23T00:00:00+00:00",
                        "validatedAt": "2026-02-23T00:00:00+00:00",
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 3,
                            "byEndpoint": {
                                "apollo_search": 2,
                                "company_enrichment_orchestration": 1,
                            },
                            "latestEventAt": "2026-02-23T00:01:00+00:00",
                            "maxRetryAfterSeconds": 46,
                            "avgRetryAfterSeconds": 30,
                            "maxResetInSeconds": 44,
                            "avgResetInSeconds": 22,
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 3,
                            "timestampAnomalyCountTotal": 1,
                            "pressureLabelCounts": {"moderate": 3},
                            "pressureHintCounts": {"monitor_rollout": 3},
                            "timestampAgeBucketCounts": {"fresh_1h_to_24h": 3},
                            "timestampAnomalyEventTypeCounts": {"delivered": 1},
                            "latestEventAt": "2026-02-23T00:01:30+00:00",
                        },
                    },
                    "recommendedCommands": ["npm run verify:governance:weekly"],
                },
                f,
            )

    def test_generator_writes_handoff_and_history_packet_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_path = os.path.join(tmp, "connector_governance_weekly_report.json")
            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            history_path = os.path.join(tmp, "governance_history_export.json")
            self._write_report(report_path, "READY", False)

            class _Args:
                report = report_path
                handoff = handoff_path
                history = history_path
                requested_by = "u-test"

            original_parse_args = generate_governance_packet_fixture.parse_args
            try:
                generate_governance_packet_fixture.parse_args = lambda: _Args
                exit_code = generate_governance_packet_fixture.main()
            finally:
                generate_governance_packet_fixture.parse_args = original_parse_args

            self.assertEqual(exit_code, 0)
            self.assertTrue(os.path.exists(handoff_path))
            self.assertTrue(os.path.exists(history_path))

            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff = json.load(f)
            with open(history_path, "r", encoding="utf-8") as f:
                history = json.load(f)

            self.assertEqual(handoff["status"], "READY")
            self.assertEqual(handoff["exportSchemaVersion"], 1)
            self.assertEqual(handoff["reasonCodeCount"], len(handoff["reasonCodes"]))
            self.assertEqual(
                handoff["recommendedCommandCount"],
                len(handoff["recommendedCommands"]),
            )
            self.assertEqual(handoff["governanceExport"]["exportSchemaVersion"], 1)
            self.assertEqual(
                handoff["governanceExport"]["reasonCodes"],
                handoff["reasonCodes"],
            )
            self.assertEqual(
                handoff["governanceExport"]["reasonCodeCount"],
                handoff["reasonCodeCount"],
            )
            self.assertEqual(
                handoff["governanceExport"]["recommendedCommands"],
                handoff["recommendedCommands"],
            )
            self.assertEqual(
                handoff["governanceExport"]["recommendedCommandCount"],
                handoff["recommendedCommandCount"],
            )
            self.assertFalse(handoff["governanceExport"]["rolloutBlocked"])
            self.assertEqual(handoff["connectorRateLimit"]["eventCount"], 3)
            self.assertEqual(
                handoff["governanceExport"]["connectorRateLimit"]["eventCount"], 3
            )
            self.assertEqual(
                handoff["totals"]["connectorRateLimitEventCount"],
                handoff["connectorRateLimit"]["eventCount"],
            )
            self.assertEqual(handoff["sendgridWebhookTimestamp"]["eventCount"], 3)
            self.assertEqual(
                handoff["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"],
                1,
            )
            self.assertEqual(
                handoff["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"],
                3,
            )
            self.assertEqual(
                handoff["totals"]["sendgridWebhookTimestampEventCount"],
                handoff["sendgridWebhookTimestamp"]["eventCount"],
            )
            self.assertEqual(
                handoff["totals"]["sendgridWebhookTimestampAnomalyCountTotal"],
                handoff["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"],
            )
            self.assertTrue(handoff["connectorPressureParity"]["eventCountMatchesNested"])
            self.assertTrue(handoff["connectorPressureParity"]["eventCountMatchesTotals"])
            self.assertTrue(handoff["connectorPressureParity"]["byEndpointMatchesNested"])
            self.assertTrue(
                handoff["connectorPressureParity"]["pressureLabelMatchesNested"]
            )
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["eventCountMatchesNested"]
            )
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"]
            )
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesNested"]
            )
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesTotals"]
            )
            self.assertTrue(handoff["runtimePrereqs"]["present"])
            self.assertTrue(handoff["runtimePrereqs"]["available"])
            self.assertEqual(handoff["runtimePrereqs"]["missingCheckCount"], 0)
            self.assertEqual(
                handoff["runtimePrereqs"],
                handoff["governanceExport"]["runtimePrereqs"],
            )
            self.assertEqual(
                handoff["totals"]["runtimePrereqsMissingCheckCount"],
                handoff["runtimePrereqs"]["missingCheckCount"],
            )
            self.assertEqual(
                handoff["totals"]["commandAliasesMissingAliasCount"],
                handoff["commandAliases"]["missingAliasCount"],
            )
            self.assertEqual(
                handoff["totals"]["commandAliasesMismatchedAliasCount"],
                handoff["commandAliases"]["mismatchedAliasCount"],
            )
            self.assertEqual(
                handoff["commandAliases"],
                handoff["governanceExport"]["commandAliases"],
            )
            self.assertEqual(handoff["sourceReport"]["name"], "connector_governance_weekly_report.json")
            self.assertEqual(
                handoff["sourceReport"]["runtimePrereqsMissingCheckCount"],
                handoff["runtimePrereqs"]["missingCheckCount"],
            )
            self.assertEqual(
                handoff["sourceReport"]["commandAliasesMissingAliasCount"],
                handoff["commandAliases"]["missingAliasCount"],
            )
            self.assertEqual(
                handoff["sourceReport"]["commandAliasesMismatchedAliasCount"],
                handoff["commandAliases"]["mismatchedAliasCount"],
            )
            self.assertEqual(history["status"], "READY")
            self.assertEqual(history["exportSchemaVersion"], 1)
            self.assertEqual(history["reasonCodeCount"], len(history["reasonCodes"]))
            self.assertEqual(
                history["recommendedCommandCount"],
                len(history["recommendedCommands"]),
            )
            self.assertEqual(history["governanceExport"]["exportSchemaVersion"], 1)
            self.assertEqual(
                history["governanceExport"]["reasonCodes"],
                history["reasonCodes"],
            )
            self.assertEqual(
                history["governanceExport"]["reasonCodeCount"],
                history["reasonCodeCount"],
            )
            self.assertEqual(
                history["governanceExport"]["recommendedCommands"],
                history["recommendedCommands"],
            )
            self.assertEqual(
                history["governanceExport"]["recommendedCommandCount"],
                history["recommendedCommandCount"],
            )
            self.assertEqual(history["connectorRateLimit"]["eventCount"], 3)
            self.assertEqual(
                history["governanceExport"]["connectorRateLimit"]["eventCount"], 3
            )
            self.assertEqual(
                history["totals"]["connectorRateLimitEventCount"],
                history["connectorRateLimit"]["eventCount"],
            )
            self.assertEqual(history["sendgridWebhookTimestamp"]["eventCount"], 3)
            self.assertEqual(
                history["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"],
                1,
            )
            self.assertEqual(
                history["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"],
                3,
            )
            self.assertEqual(
                history["totals"]["sendgridWebhookTimestampEventCount"],
                history["sendgridWebhookTimestamp"]["eventCount"],
            )
            self.assertEqual(
                history["totals"]["sendgridWebhookTimestampAnomalyCountTotal"],
                history["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"],
            )
            self.assertTrue(history["connectorPressureParity"]["eventCountMatchesNested"])
            self.assertTrue(history["connectorPressureParity"]["eventCountMatchesTotals"])
            self.assertTrue(history["connectorPressureParity"]["byEndpointMatchesNested"])
            self.assertTrue(
                history["connectorPressureParity"]["pressureLabelMatchesNested"]
            )
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["eventCountMatchesNested"]
            )
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"]
            )
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesNested"]
            )
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesTotals"]
            )
            self.assertTrue(history["runtimePrereqs"]["present"])
            self.assertTrue(history["runtimePrereqs"]["available"])
            self.assertEqual(history["runtimePrereqs"]["missingCheckCount"], 0)
            self.assertEqual(
                history["runtimePrereqs"],
                history["governanceExport"]["runtimePrereqs"],
            )
            self.assertEqual(
                history["totals"]["runtimePrereqsMissingCheckCount"],
                history["runtimePrereqs"]["missingCheckCount"],
            )
            self.assertEqual(
                history["totals"]["commandAliasesMissingAliasCount"],
                history["commandAliases"]["missingAliasCount"],
            )
            self.assertEqual(
                history["totals"]["commandAliasesMismatchedAliasCount"],
                history["commandAliases"]["mismatchedAliasCount"],
            )
            self.assertEqual(
                history["commandAliases"],
                history["governanceExport"]["commandAliases"],
            )
            self.assertEqual(len(history["items"]), 1)
            self.assertEqual(history["items"][0]["exportSchemaVersion"], 1)
            self.assertFalse(history["items"][0]["rolloutBlocked"])

    def test_generator_carries_action_required_rollout_blocked_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_path = os.path.join(tmp, "connector_governance_weekly_report.json")
            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            history_path = os.path.join(tmp, "governance_history_export.json")
            self._write_report(report_path, "ACTION_REQUIRED", True)

            class _Args:
                report = report_path
                handoff = handoff_path
                history = history_path
                requested_by = "u-test"

            original_parse_args = generate_governance_packet_fixture.parse_args
            try:
                generate_governance_packet_fixture.parse_args = lambda: _Args
                exit_code = generate_governance_packet_fixture.main()
            finally:
                generate_governance_packet_fixture.parse_args = original_parse_args

            self.assertEqual(exit_code, 0)
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff = json.load(f)
            with open(history_path, "r", encoding="utf-8") as f:
                history = json.load(f)

            self.assertEqual(handoff["status"], "ACTION_REQUIRED")
            self.assertEqual(handoff["exportSchemaVersion"], 1)
            self.assertTrue(handoff["governanceExport"]["rolloutBlocked"])
            self.assertEqual(
                handoff["governanceExport"]["connectorRateLimit"]["pressure"]["label"],
                "High",
            )
            self.assertTrue(handoff["connectorPressureParity"]["eventCountMatchesNested"])
            self.assertTrue(handoff["connectorPressureParity"]["eventCountMatchesTotals"])
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["eventCountMatchesNested"]
            )
            self.assertTrue(
                handoff["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"]
            )
            self.assertEqual(handoff["runtimePrereqs"]["missingCheckCount"], 0)
            self.assertEqual(handoff["commandAliases"]["missingAliasCount"], 0)
            self.assertEqual(history["status"], "ACTION_REQUIRED")
            self.assertEqual(history["exportSchemaVersion"], 1)
            self.assertTrue(history["governanceExport"]["rolloutBlocked"])
            self.assertEqual(
                history["governanceExport"]["connectorRateLimit"]["pressure"]["label"],
                "High",
            )
            self.assertTrue(history["connectorPressureParity"]["eventCountMatchesNested"])
            self.assertTrue(history["connectorPressureParity"]["eventCountMatchesTotals"])
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["eventCountMatchesNested"]
            )
            self.assertTrue(
                history["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"]
            )
            self.assertEqual(history["runtimePrereqs"]["missingCheckCount"], 0)
            self.assertEqual(history["commandAliases"]["missingAliasCount"], 0)

    def test_generator_returns_nonzero_for_invalid_report_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_path = os.path.join(tmp, "connector_governance_weekly_report.json")
            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("{invalid")

            class _Args:
                report = report_path
                handoff = handoff_path
                history = history_path
                requested_by = "u-test"

            original_parse_args = generate_governance_packet_fixture.parse_args
            try:
                generate_governance_packet_fixture.parse_args = lambda: _Args
                exit_code = generate_governance_packet_fixture.main()
            finally:
                generate_governance_packet_fixture.parse_args = original_parse_args

            self.assertEqual(exit_code, 1)
            self.assertFalse(os.path.exists(handoff_path))
            self.assertFalse(os.path.exists(history_path))

    def test_generator_normalizes_malformed_status_and_endpoint_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_path = os.path.join(tmp, "connector_governance_weekly_report.json")
            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "generatedAt": "2026-02-23T00:00:00+00:00",
                        "exportSchemaVersion": 1,
                        "windowDays": 7,
                        "eventLimit": 1000,
                        "status": " action-required ",
                        "handoff": {"ownerRole": "Release Manager"},
                        "governanceExport": {
                            "governanceType": "weekly_report",
                            "exportSchemaVersion": 1,
                            "status": "ACTION REQUIRED",
                            "rolloutBlocked": False,
                            "ownerRole": "Release Manager",
                        },
                        "summary": {
                            "connectorRateLimit": {
                                "eventCount": 4,
                                "byEndpoint": {
                                    "Apollo Search": 1,
                                    "apollo-search": 1,
                                    "  ": 2,
                                },
                                "latestEventAt": "2026-02-23T00:01:00+00:00",
                                "maxRetryAfterSeconds": 46,
                                "avgRetryAfterSeconds": 30,
                                "maxResetInSeconds": 44,
                                "avgResetInSeconds": 22,
                            }
                        },
                    },
                    f,
                )

            class _Args:
                report = report_path
                handoff = handoff_path
                history = history_path
                requested_by = "u-test"

            original_parse_args = generate_governance_packet_fixture.parse_args
            try:
                generate_governance_packet_fixture.parse_args = lambda: _Args
                exit_code = generate_governance_packet_fixture.main()
            finally:
                generate_governance_packet_fixture.parse_args = original_parse_args

            self.assertEqual(exit_code, 0)
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff = json.load(f)
            with open(history_path, "r", encoding="utf-8") as f:
                history = json.load(f)

            self.assertEqual(handoff["status"], "ACTION_REQUIRED")
            self.assertEqual(handoff["governanceExport"]["status"], "ACTION_REQUIRED")
            self.assertTrue(handoff["governanceExport"]["rolloutBlocked"])
            self.assertEqual(
                handoff["connectorRateLimit"]["byEndpoint"],
                {"apollo_search": 2, "unknown": 2},
            )
            self.assertEqual(history["status"], "ACTION_REQUIRED")
            self.assertEqual(history["items"][0]["status"], "ACTION_REQUIRED")
            self.assertTrue(history["items"][0]["rolloutBlocked"])
            self.assertFalse(handoff["runtimePrereqs"]["present"])
            self.assertFalse(history["runtimePrereqs"]["present"])
            self.assertFalse(handoff["commandAliases"]["present"])
            self.assertFalse(history["commandAliases"]["present"])
            self.assertEqual(
                handoff["runtimePrereqs"]["command"],
                "npm run verify:baseline:runtime-prereqs:artifact",
            )
            self.assertEqual(
                handoff["commandAliases"]["command"],
                "npm run verify:baseline:command-aliases:artifact",
            )


if __name__ == "__main__":
    unittest.main()
