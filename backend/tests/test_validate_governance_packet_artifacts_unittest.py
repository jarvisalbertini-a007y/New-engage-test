import json
import os
import tempfile
import unittest

from scripts import validate_governance_packet_artifacts


class ValidateGovernancePacketArtifactsTests(unittest.TestCase):
    def _valid_handoff(self):
        return {
            "status": "READY",
            "exportSchemaVersion": 1,
            "reasonCodes": ["governance_ready"],
            "reasonCodeCount": 1,
            "recommendedCommands": ["npm run verify:ci:sales:extended"],
            "recommendedCommandCount": 1,
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
                "generatedAt": "2026-02-24T00:00:00+00:00",
                "validatedAt": "2026-02-24T00:00:00+00:00",
                "command": "npm run verify:baseline:runtime-prereqs:artifact",
            },
            "commandAliases": {
                "present": True,
                "available": True,
                "source": "governance_weekly_report",
                "gatePassed": True,
                "contractValid": True,
                "valid": True,
                "missingAliasCount": 0,
                "mismatchedAliasCount": 0,
                "missingAliases": [],
                "mismatchedAliases": [],
                "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                "generatedAt": "2026-02-24T00:00:00+00:00",
                "validatedAt": "2026-02-24T00:00:00+00:00",
                "command": "npm run verify:baseline:command-aliases:artifact",
            },
            "connectorRateLimit": {
                "eventCount": 2,
                "byEndpoint": {"apollo_search": 2},
                "pressure": {"label": "Moderate"},
            },
            "sendgridWebhookTimestamp": {
                "eventCount": 2,
                "timestampAnomalyCountTotal": 1,
                "pressureLabelCounts": {"moderate": 2},
                "pressureHintCounts": {"monitor_rollout": 2},
                "timestampAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "timestampAnomalyEventTypeCounts": {"delivered": 1},
                "latestEventAt": "2026-02-24T00:00:00+00:00",
            },
            "connectorPressureParity": {
                "topLevelEventCount": 2,
                "nestedEventCount": 2,
                "totalsEventCount": None,
                "eventCountMatchesNested": True,
                "eventCountMatchesTotals": None,
                "byEndpointMatchesNested": True,
                "pressureLabelMatchesNested": True,
                "normalizedTopLevelByEndpoint": {"apollo_search": 2},
                "normalizedNestedByEndpoint": {"apollo_search": 2},
                "computedAt": "2026-02-24T00:00:00+00:00",
            },
            "sendgridWebhookTimestampParity": {
                "topLevelEventCount": 2,
                "nestedEventCount": 2,
                "totalsEventCount": None,
                "topLevelAnomalyCountTotal": 1,
                "nestedAnomalyCountTotal": 1,
                "totalsAnomalyCountTotal": None,
                "eventCountMatchesNested": True,
                "eventCountMatchesTotals": None,
                "anomalyCountTotalMatchesNested": True,
                "anomalyCountTotalMatchesTotals": None,
                "pressureLabelCountsMatchNested": True,
                "pressureHintCountsMatchNested": True,
                "ageBucketCountsMatchNested": True,
                "anomalyEventTypeCountsMatchNested": True,
                "latestEventAtMatchesNested": True,
                "normalizedTopLevelPressureLabelCounts": {"moderate": 2},
                "normalizedNestedPressureLabelCounts": {"moderate": 2},
                "normalizedTopLevelPressureHintCounts": {"monitor_rollout": 2},
                "normalizedNestedPressureHintCounts": {"monitor_rollout": 2},
                "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": 1},
                "normalizedNestedAnomalyEventTypeCounts": {"delivered": 1},
                "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
                "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
                "computedAt": "2026-02-24T00:00:00+00:00",
            },
            "governanceExport": {
                "status": "READY",
                "exportSchemaVersion": 1,
                "rolloutBlocked": False,
                "ownerRole": "Release Manager",
                "reasonCodes": ["governance_ready"],
                "reasonCodeCount": 1,
                "recommendedCommands": ["npm run verify:ci:sales:extended"],
                "recommendedCommandCount": 1,
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
                    "generatedAt": "2026-02-24T00:00:00+00:00",
                    "validatedAt": "2026-02-24T00:00:00+00:00",
                    "command": "npm run verify:baseline:runtime-prereqs:artifact",
                },
                "commandAliases": {
                    "present": True,
                    "available": True,
                    "source": "governance_weekly_report",
                    "gatePassed": True,
                    "contractValid": True,
                    "valid": True,
                    "missingAliasCount": 0,
                    "mismatchedAliasCount": 0,
                    "missingAliases": [],
                    "mismatchedAliases": [],
                    "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                    "generatedAt": "2026-02-24T00:00:00+00:00",
                    "validatedAt": "2026-02-24T00:00:00+00:00",
                    "command": "npm run verify:baseline:command-aliases:artifact",
                },
                "connectorRateLimit": {
                    "eventCount": 2,
                    "byEndpoint": {"apollo_search": 2},
                    "pressure": {"label": "Moderate"},
                },
                "sendgridWebhookTimestamp": {
                    "eventCount": 2,
                    "timestampAnomalyCountTotal": 1,
                    "pressureLabelCounts": {"moderate": 2},
                    "pressureHintCounts": {"monitor_rollout": 2},
                    "timestampAgeBucketCounts": {"fresh_1h_to_24h": 2},
                    "timestampAnomalyEventTypeCounts": {"delivered": 1},
                    "latestEventAt": "2026-02-24T00:00:00+00:00",
                },
            },
        }

    def _valid_history(self):
        return {
            "status": "READY",
            "exportSchemaVersion": 1,
            "reasonCodes": ["governance_ready"],
            "reasonCodeCount": 1,
            "recommendedCommands": ["npm run verify:ci:sales:extended"],
            "recommendedCommandCount": 1,
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
                "generatedAt": "2026-02-24T00:00:00+00:00",
                "validatedAt": "2026-02-24T00:00:00+00:00",
                "command": "npm run verify:baseline:runtime-prereqs:artifact",
            },
            "commandAliases": {
                "present": True,
                "available": True,
                "source": "governance_weekly_report",
                "gatePassed": True,
                "contractValid": True,
                "valid": True,
                "missingAliasCount": 0,
                "mismatchedAliasCount": 0,
                "missingAliases": [],
                "mismatchedAliases": [],
                "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                "generatedAt": "2026-02-24T00:00:00+00:00",
                "validatedAt": "2026-02-24T00:00:00+00:00",
                "command": "npm run verify:baseline:command-aliases:artifact",
            },
            "connectorRateLimit": {
                "eventCount": 2,
                "byEndpoint": {"apollo_search": 2},
                "pressure": {"label": "Moderate"},
            },
            "sendgridWebhookTimestamp": {
                "eventCount": 2,
                "timestampAnomalyCountTotal": 1,
                "pressureLabelCounts": {"moderate": 2},
                "pressureHintCounts": {"monitor_rollout": 2},
                "timestampAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "timestampAnomalyEventTypeCounts": {"delivered": 1},
                "latestEventAt": "2026-02-24T00:00:00+00:00",
            },
            "connectorPressureParity": {
                "topLevelEventCount": 2,
                "nestedEventCount": 2,
                "totalsEventCount": None,
                "eventCountMatchesNested": True,
                "eventCountMatchesTotals": None,
                "byEndpointMatchesNested": True,
                "pressureLabelMatchesNested": True,
                "normalizedTopLevelByEndpoint": {"apollo_search": 2},
                "normalizedNestedByEndpoint": {"apollo_search": 2},
                "computedAt": "2026-02-24T00:00:00+00:00",
            },
            "sendgridWebhookTimestampParity": {
                "topLevelEventCount": 2,
                "nestedEventCount": 2,
                "totalsEventCount": None,
                "topLevelAnomalyCountTotal": 1,
                "nestedAnomalyCountTotal": 1,
                "totalsAnomalyCountTotal": None,
                "eventCountMatchesNested": True,
                "eventCountMatchesTotals": None,
                "anomalyCountTotalMatchesNested": True,
                "anomalyCountTotalMatchesTotals": None,
                "pressureLabelCountsMatchNested": True,
                "pressureHintCountsMatchNested": True,
                "ageBucketCountsMatchNested": True,
                "anomalyEventTypeCountsMatchNested": True,
                "latestEventAtMatchesNested": True,
                "normalizedTopLevelPressureLabelCounts": {"moderate": 2},
                "normalizedNestedPressureLabelCounts": {"moderate": 2},
                "normalizedTopLevelPressureHintCounts": {"monitor_rollout": 2},
                "normalizedNestedPressureHintCounts": {"monitor_rollout": 2},
                "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": 2},
                "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": 1},
                "normalizedNestedAnomalyEventTypeCounts": {"delivered": 1},
                "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
                "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
                "computedAt": "2026-02-24T00:00:00+00:00",
            },
            "items": [
                {
                    "name": "connector_governance_weekly_report_2026-02-23.json",
                    "exportSchemaVersion": 1,
                    "status": "READY",
                    "withinRetention": True,
                    "rolloutBlocked": False,
                }
            ],
            "governanceExport": {
                "status": "READY",
                "exportSchemaVersion": 1,
                "rolloutBlocked": False,
                "ownerRole": "Release Manager",
                "reasonCodes": ["governance_ready"],
                "reasonCodeCount": 1,
                "recommendedCommands": ["npm run verify:ci:sales:extended"],
                "recommendedCommandCount": 1,
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
                    "generatedAt": "2026-02-24T00:00:00+00:00",
                    "validatedAt": "2026-02-24T00:00:00+00:00",
                    "command": "npm run verify:baseline:runtime-prereqs:artifact",
                },
                "commandAliases": {
                    "present": True,
                    "available": True,
                    "source": "governance_weekly_report",
                    "gatePassed": True,
                    "contractValid": True,
                    "valid": True,
                    "missingAliasCount": 0,
                    "mismatchedAliasCount": 0,
                    "missingAliases": [],
                    "mismatchedAliases": [],
                    "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                    "generatedAt": "2026-02-24T00:00:00+00:00",
                    "validatedAt": "2026-02-24T00:00:00+00:00",
                    "command": "npm run verify:baseline:command-aliases:artifact",
                },
                "connectorRateLimit": {
                    "eventCount": 2,
                    "byEndpoint": {"apollo_search": 2},
                    "pressure": {"label": "Moderate"},
                },
                "sendgridWebhookTimestamp": {
                    "eventCount": 2,
                    "timestampAnomalyCountTotal": 1,
                    "pressureLabelCounts": {"moderate": 2},
                    "pressureHintCounts": {"monitor_rollout": 2},
                    "timestampAgeBucketCounts": {"fresh_1h_to_24h": 2},
                    "timestampAnomalyEventTypeCounts": {"delivered": 1},
                    "latestEventAt": "2026-02-24T00:00:00+00:00",
                },
            },
        }

    def test_validation_passes_for_valid_handoff_and_history_payloads(self):
        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            self._valid_history(),
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])
        self.assertTrue(result["checks"]["handoff"]["reasonCodesPresent"])
        self.assertTrue(result["checks"]["handoff"]["reasonCodeCountPresent"])
        self.assertTrue(result["checks"]["handoff"]["reasonCodeCountParity"])
        self.assertTrue(result["checks"]["handoff"]["recommendedCommandsPresent"])
        self.assertTrue(result["checks"]["handoff"]["recommendedCommandCountPresent"])
        self.assertTrue(result["checks"]["handoff"]["recommendedCommandCountParity"])
        self.assertTrue(result["checks"]["handoff"]["runtimePrereqsPresent"])
        self.assertTrue(result["checks"]["handoff"]["runtimePrereqsShapeValid"])
        self.assertTrue(result["checks"]["handoff"]["runtimePrereqsMissingCheckParity"])
        self.assertTrue(result["checks"]["handoff"]["governanceExportRuntimePrereqsPresent"])
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportRuntimePrereqsShapeValid"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportRuntimePrereqsMissingCheckParity"]
        )
        self.assertTrue(result["checks"]["handoff"]["runtimePrereqsConsistency"])
        self.assertTrue(result["checks"]["handoff"]["commandAliasesPresent"])
        self.assertTrue(result["checks"]["handoff"]["commandAliasesShapeValid"])
        self.assertTrue(result["checks"]["handoff"]["commandAliasesCountParity"])
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportCommandAliasesPresent"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportCommandAliasesShapeValid"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportCommandAliasesCountParity"]
        )
        self.assertTrue(result["checks"]["handoff"]["commandAliasesConsistency"])
        self.assertTrue(result["checks"]["history"]["reasonCodesPresent"])
        self.assertTrue(result["checks"]["history"]["reasonCodeCountPresent"])
        self.assertTrue(result["checks"]["history"]["reasonCodeCountParity"])
        self.assertTrue(result["checks"]["history"]["recommendedCommandsPresent"])
        self.assertTrue(result["checks"]["history"]["recommendedCommandCountPresent"])
        self.assertTrue(result["checks"]["history"]["recommendedCommandCountParity"])
        self.assertTrue(result["checks"]["history"]["runtimePrereqsPresent"])
        self.assertTrue(result["checks"]["history"]["runtimePrereqsShapeValid"])
        self.assertTrue(result["checks"]["history"]["runtimePrereqsMissingCheckParity"])
        self.assertTrue(result["checks"]["history"]["governanceExportRuntimePrereqsPresent"])
        self.assertTrue(
            result["checks"]["history"]["governanceExportRuntimePrereqsShapeValid"]
        )
        self.assertTrue(
            result["checks"]["history"]["governanceExportRuntimePrereqsMissingCheckParity"]
        )
        self.assertTrue(result["checks"]["history"]["runtimePrereqsConsistency"])
        self.assertTrue(result["checks"]["history"]["commandAliasesPresent"])
        self.assertTrue(result["checks"]["history"]["commandAliasesShapeValid"])
        self.assertTrue(result["checks"]["history"]["commandAliasesCountParity"])
        self.assertTrue(
            result["checks"]["history"]["governanceExportCommandAliasesPresent"]
        )
        self.assertTrue(
            result["checks"]["history"]["governanceExportCommandAliasesShapeValid"]
        )
        self.assertTrue(
            result["checks"]["history"]["governanceExportCommandAliasesCountParity"]
        )
        self.assertTrue(result["checks"]["history"]["commandAliasesConsistency"])
        self.assertTrue(
            result["checks"]["crossArtifact"]["runtimePrereqsMissingCheckCountConsistency"]
        )
        self.assertTrue(
            result["checks"]["crossArtifact"]["commandAliasesMissingAliasCountConsistency"]
        )
        self.assertTrue(
            result["checks"]["crossArtifact"]["commandAliasesMismatchedAliasCountConsistency"]
        )
        self.assertTrue(
            result["checks"]["crossArtifact"]["commandAliasesCommandConsistency"]
        )
        self.assertTrue(result["checks"]["handoff"]["sendgridWebhookTimestampPresent"])
        self.assertTrue(result["checks"]["handoff"]["sendgridWebhookTimestampShapeValid"])
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportSendgridWebhookTimestampPresent"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["governanceExportSendgridWebhookTimestampShapeValid"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["sendgridWebhookTimestampConsistency"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["sendgridWebhookTimestampParityPresent"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["sendgridWebhookTimestampParityShapeValid"]
        )
        self.assertTrue(
            result["checks"]["handoff"]["sendgridWebhookTimestampParityConsistency"]
        )
        self.assertTrue(result["checks"]["history"]["sendgridWebhookTimestampPresent"])
        self.assertTrue(result["checks"]["history"]["sendgridWebhookTimestampShapeValid"])
        self.assertTrue(
            result["checks"]["history"]["governanceExportSendgridWebhookTimestampPresent"]
        )
        self.assertTrue(
            result["checks"]["history"]["governanceExportSendgridWebhookTimestampShapeValid"]
        )
        self.assertTrue(
            result["checks"]["history"]["sendgridWebhookTimestampConsistency"]
        )
        self.assertTrue(
            result["checks"]["history"]["sendgridWebhookTimestampParityPresent"]
        )
        self.assertTrue(
            result["checks"]["history"]["sendgridWebhookTimestampParityShapeValid"]
        )
        self.assertTrue(
            result["checks"]["history"]["sendgridWebhookTimestampParityConsistency"]
        )
        self.assertTrue(
            result["checks"]["crossArtifact"]["sendgridWebhookTimestampEventCountConsistency"]
        )
        self.assertTrue(
            result["checks"]["crossArtifact"]["sendgridWebhookTimestampAnomalyCountConsistency"]
        )

    def test_validation_fails_for_reason_code_count_parity_mismatch(self):
        handoff = self._valid_handoff()
        handoff["reasonCodeCount"] = 3
        handoff["governanceExport"]["reasonCodeCount"] = 3

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            self._valid_history(),
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance handoff artifact reasonCodeCount does not match len(reasonCodes)",
            errors,
        )
        self.assertIn(
            "Governance handoff artifact governanceExport reasonCodeCount does not match len(reasonCodes)",
            errors,
        )

    def test_validation_fails_for_recommended_command_count_parity_mismatch(self):
        history = self._valid_history()
        history["recommendedCommandCount"] = 0
        history["governanceExport"]["recommendedCommandCount"] = 0

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance history artifact recommendedCommandCount does not match len(recommendedCommands)",
            errors,
        )
        self.assertIn(
            "Governance history artifact governanceExport recommendedCommandCount does not match len(recommendedCommands)",
            errors,
        )

    def test_validation_fails_for_invalid_handoff_governance_export_shape(self):
        handoff = self._valid_handoff()
        handoff["governanceExport"] = "invalid"
        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            self._valid_history(),
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff artifact is missing governanceExport payload",
            "\n".join(result["errors"]),
        )

    def test_validation_fails_for_invalid_history_items_shape(self):
        history = self._valid_history()
        history["items"] = [{"name": "bad-item"}]
        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance history artifact items must include name/status/withinRetention/rolloutBlocked",
            "\n".join(result["errors"]),
        )

    def test_validation_fails_for_missing_connector_rate_limit_payloads(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff.pop("connectorRateLimit", None)
        history["governanceExport"].pop("connectorRateLimit", None)

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance handoff artifact is missing connectorRateLimit payload",
            errors,
        )
        self.assertIn(
            "Governance history artifact governanceExport is missing connectorRateLimit payload",
            errors,
        )

    def test_validation_fails_for_connector_rate_limit_parity_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["governanceExport"]["connectorRateLimit"]["eventCount"] = 4
        history["governanceExport"]["connectorRateLimit"]["pressure"]["label"] = "High"

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance handoff artifact connectorRateLimit.eventCount does not match governanceExport.connectorRateLimit.eventCount",
            errors,
        )
        self.assertIn(
            "Governance history artifact connectorRateLimit.pressure.label does not match governanceExport.connectorRateLimit.pressure.label",
            errors,
        )

    def test_validation_fails_for_connector_rate_limit_by_endpoint_parity_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["governanceExport"]["connectorRateLimit"]["byEndpoint"] = {
            "apollo_search": 1,
            "clearbit_company": 1,
        }
        history["governanceExport"]["connectorRateLimit"]["byEndpoint"] = {
            "apollo_search": 1,
        }

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance handoff artifact connectorRateLimit.byEndpoint does not match governanceExport.connectorRateLimit.byEndpoint",
            errors,
        )
        self.assertIn(
            "Governance history artifact connectorRateLimit.byEndpoint does not match governanceExport.connectorRateLimit.byEndpoint",
            errors,
        )
        self.assertFalse(result["checks"]["handoff"]["connectorRateLimitByEndpointConsistency"])
        self.assertFalse(result["checks"]["history"]["connectorRateLimitByEndpointConsistency"])

    def test_validation_fails_for_runtime_prereqs_presence_mismatch(self):
        handoff = self._valid_handoff()
        handoff["governanceExport"].pop("runtimePrereqs", None)

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            self._valid_history(),
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff artifact runtimePrereqs presence does not match governanceExport.runtimePrereqs",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["handoff"]["runtimePrereqsConsistency"])

    def test_validation_fails_for_command_aliases_presence_mismatch(self):
        handoff = self._valid_handoff()
        handoff["governanceExport"].pop("commandAliases", None)

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            self._valid_history(),
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff artifact commandAliases presence does not match governanceExport.commandAliases",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["handoff"]["commandAliasesConsistency"])

    def test_validation_fails_for_command_aliases_mismatched_count_cross_artifact_mismatch(self):
        history = self._valid_history()
        history["commandAliases"]["mismatchedAliasCount"] = 1
        history["commandAliases"]["mismatchedAliases"] = [
            {"name": "verify:smoke:sales", "expected": "bash backend/scripts/run_smoke_sales_suite.sh"}
        ]
        history["governanceExport"]["commandAliases"]["mismatchedAliasCount"] = 1
        history["governanceExport"]["commandAliases"]["mismatchedAliases"] = [
            {"name": "verify:smoke:sales", "expected": "bash backend/scripts/run_smoke_sales_suite.sh"}
        ]

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff/history commandAliases mismatchedAliasCount values are inconsistent",
            "\n".join(result["errors"]),
        )
        self.assertFalse(
            result["checks"]["crossArtifact"]["commandAliasesMismatchedAliasCountConsistency"]
        )

    def test_validation_fails_for_command_aliases_command_cross_artifact_mismatch(self):
        history = self._valid_history()
        history["commandAliases"]["command"] = "npm run verify:baseline:command-aliases"
        history["governanceExport"]["commandAliases"]["command"] = (
            "npm run verify:baseline:command-aliases"
        )

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff/history commandAliases.command values are inconsistent",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["crossArtifact"]["commandAliasesCommandConsistency"])

    def test_validation_fails_for_runtime_prereqs_missing_check_count_parity_mismatch(self):
        history = self._valid_history()
        history["runtimePrereqs"]["missingCheckCount"] = 2
        history["governanceExport"]["runtimePrereqs"]["missingCheckCount"] = 2

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance history artifact runtimePrereqs missingCheckCount does not match missingChecks command/workspace totals",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["history"]["runtimePrereqsMissingCheckParity"])

    def test_validation_fails_for_missing_connector_pressure_parity_payload(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff.pop("connectorPressureParity", None)

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff artifact is missing connectorPressureParity payload",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["handoff"]["connectorPressureParityPresent"])

    def test_validation_fails_for_connector_pressure_parity_consistency_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        history["connectorPressureParity"]["eventCountMatchesNested"] = False

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance history artifact connectorPressureParity fields are inconsistent with connectorRateLimit parity expectations",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["history"]["connectorPressureParityConsistency"])

    def test_validation_fails_for_missing_sendgrid_webhook_timestamp_payload(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff.pop("sendgridWebhookTimestamp", None)

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff artifact is missing sendgridWebhookTimestamp payload",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["handoff"]["sendgridWebhookTimestampPresent"])

    def test_validation_fails_for_sendgrid_webhook_timestamp_parity_consistency_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        history["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] = False

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance history artifact sendgridWebhookTimestampParity fields are inconsistent with sendgridWebhookTimestamp parity expectations",
            "\n".join(result["errors"]),
        )
        self.assertFalse(
            result["checks"]["history"]["sendgridWebhookTimestampParityConsistency"]
        )

    def test_validation_fails_for_unsupported_status_values(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["status"] = "PASS"
        handoff["governanceExport"]["status"] = "PASS"
        history["status"] = "HOLD"
        history["governanceExport"]["status"] = "HOLD"

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn("Governance handoff artifact status must be READY or ACTION_REQUIRED", errors)
        self.assertIn("Governance history artifact status must be READY or ACTION_REQUIRED", errors)

    def test_validation_accepts_normalized_status_token_variants(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["status"] = " action-required "
        handoff["governanceExport"]["status"] = "ACTION REQUIRED"
        handoff["governanceExport"]["rolloutBlocked"] = True
        history["status"] = "action-required"
        history["governanceExport"]["status"] = "ACTION REQUIRED"
        history["governanceExport"]["rolloutBlocked"] = True
        history["items"][0]["status"] = "action required"
        history["items"][0]["rolloutBlocked"] = True

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])

    def test_validation_fails_for_punctuation_only_status_tokens(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["status"] = "!!!"
        handoff["governanceExport"]["status"] = "!!!"
        history["status"] = "!!!"
        history["governanceExport"]["status"] = "!!!"
        history["items"][0]["status"] = "!!!"

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn("Governance handoff artifact is missing status", errors)
        self.assertIn("Governance history artifact is missing status", errors)

    def test_validation_normalizes_connector_rate_limit_by_endpoint_keys_for_parity(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["connectorRateLimit"]["byEndpoint"] = {
            "Apollo Search": 1,
            "apollo-search": 1,
        }
        handoff["governanceExport"]["connectorRateLimit"]["byEndpoint"] = {
            "apollo_search": 2,
        }
        history["connectorRateLimit"]["byEndpoint"] = {
            "Apollo Search": 1,
            "apollo-search": 1,
        }
        history["governanceExport"]["connectorRateLimit"]["byEndpoint"] = {
            "apollo_search": 2,
        }

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertTrue(result["valid"])
        self.assertEqual(result["errors"], [])

    def test_validation_fails_for_status_rollout_consistency_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["governanceExport"]["status"] = "READY"
        handoff["governanceExport"]["rolloutBlocked"] = True
        history["governanceExport"]["status"] = "ACTION_REQUIRED"
        history["governanceExport"]["rolloutBlocked"] = False

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        errors = "\n".join(result["errors"])
        self.assertIn(
            "Governance handoff artifact governanceExport rolloutBlocked is inconsistent with status",
            errors,
        )
        self.assertIn(
            "Governance history artifact governanceExport rolloutBlocked is inconsistent with status",
            errors,
        )

    def test_validation_fails_for_cross_artifact_status_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["governanceExport"]["status"] = "READY"
        history["governanceExport"]["status"] = "ACTION_REQUIRED"
        history["governanceExport"]["rolloutBlocked"] = True

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff/history export statuses are inconsistent",
            "\n".join(result["errors"]),
        )

    def test_validation_fails_for_cross_artifact_runtime_prereqs_missing_check_count_mismatch(
        self,
    ):
        handoff = self._valid_handoff()
        history = self._valid_history()
        history["runtimePrereqs"]["missingCheckCount"] = 1
        history["runtimePrereqs"]["missingChecks"]["commands"] = ["node"]
        history["governanceExport"]["runtimePrereqs"]["missingCheckCount"] = 1
        history["governanceExport"]["runtimePrereqs"]["missingChecks"]["commands"] = [
            "node"
        ]

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff/history runtimePrereqs missingCheckCount values are inconsistent",
            "\n".join(result["errors"]),
        )
        self.assertFalse(
            result["checks"]["crossArtifact"]["runtimePrereqsMissingCheckCountConsistency"]
        )

    def test_validation_fails_for_cross_artifact_export_schema_version_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        handoff["exportSchemaVersion"] = 1
        handoff["governanceExport"]["exportSchemaVersion"] = 1
        history["exportSchemaVersion"] = 2
        history["governanceExport"]["exportSchemaVersion"] = 2
        history["items"][0]["exportSchemaVersion"] = 2

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance history artifact exportSchemaVersion is unsupported",
            "\n".join(result["errors"]),
        )
        self.assertIn(
            "Governance handoff/history exportSchemaVersion values are inconsistent",
            "\n".join(result["errors"]),
        )

    def test_validation_fails_for_cross_artifact_sendgrid_event_count_mismatch(self):
        handoff = self._valid_handoff()
        history = self._valid_history()
        history["sendgridWebhookTimestamp"]["eventCount"] = 3
        history["sendgridWebhookTimestamp"]["pressureLabelCounts"] = {"moderate": 3}
        history["sendgridWebhookTimestamp"]["pressureHintCounts"] = {"monitor_rollout": 3}
        history["sendgridWebhookTimestamp"]["timestampAgeBucketCounts"] = {
            "fresh_1h_to_24h": 3
        }
        history["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"] = 3
        history["governanceExport"]["sendgridWebhookTimestamp"]["pressureLabelCounts"] = {
            "moderate": 3
        }
        history["governanceExport"]["sendgridWebhookTimestamp"]["pressureHintCounts"] = {
            "monitor_rollout": 3
        }
        history["governanceExport"]["sendgridWebhookTimestamp"]["timestampAgeBucketCounts"] = {
            "fresh_1h_to_24h": 3
        }
        history["sendgridWebhookTimestampParity"]["topLevelEventCount"] = 3
        history["sendgridWebhookTimestampParity"]["nestedEventCount"] = 3
        history["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] = True
        history["sendgridWebhookTimestampParity"]["normalizedTopLevelPressureLabelCounts"] = {
            "moderate": 3
        }
        history["sendgridWebhookTimestampParity"]["normalizedNestedPressureLabelCounts"] = {
            "moderate": 3
        }
        history["sendgridWebhookTimestampParity"]["normalizedTopLevelPressureHintCounts"] = {
            "monitor_rollout": 3
        }
        history["sendgridWebhookTimestampParity"]["normalizedNestedPressureHintCounts"] = {
            "monitor_rollout": 3
        }
        history["sendgridWebhookTimestampParity"]["normalizedTopLevelAgeBucketCounts"] = {
            "fresh_1h_to_24h": 3
        }
        history["sendgridWebhookTimestampParity"]["normalizedNestedAgeBucketCounts"] = {
            "fresh_1h_to_24h": 3
        }

        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            handoff,
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "Governance handoff/history sendgridWebhookTimestamp.eventCount values are inconsistent",
            "\n".join(result["errors"]),
        )
        self.assertFalse(
            result["checks"]["crossArtifact"]["sendgridWebhookTimestampEventCountConsistency"]
        )

    def test_validation_fails_for_duplicate_history_artifact_names(self):
        history = self._valid_history()
        history["items"] = [
            {
                "name": "connector_governance_weekly_report_2026-02-23.json",
                "exportSchemaVersion": 1,
                "status": "READY",
                "withinRetention": True,
                "rolloutBlocked": False,
            },
            {
                "name": "connector_governance_weekly_report_2026-02-23.json",
                "exportSchemaVersion": 1,
                "status": "READY",
                "withinRetention": True,
                "rolloutBlocked": False,
            },
        ]
        result = validate_governance_packet_artifacts.validate_governance_packet_artifacts(
            self._valid_handoff(),
            history,
        )
        self.assertFalse(result["valid"])
        self.assertIn(
            "contains duplicate item names",
            "\n".join(result["errors"]),
        )
        self.assertFalse(result["checks"]["history"]["duplicateArtifactNames"])
        self.assertEqual(result["checks"]["history"]["duplicateArtifactNameCount"], 1)

    def test_main_writes_output_and_returns_nonzero_for_invalid_payloads(self):
        with tempfile.TemporaryDirectory() as tmp:
            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            history_path = os.path.join(tmp, "governance_history_export.json")
            output_path = os.path.join(tmp, "governance_packet_validation.json")

            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump({"status": "READY"}, f)
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(self._valid_history(), f)

            class _Args:
                handoff = handoff_path
                history = history_path
                output = output_path

            original_parse_args = validate_governance_packet_artifacts.parse_args
            try:
                validate_governance_packet_artifacts.parse_args = lambda: _Args
                exit_code = validate_governance_packet_artifacts.main()
            finally:
                validate_governance_packet_artifacts.parse_args = original_parse_args

            self.assertEqual(exit_code, 1)
            self.assertTrue(os.path.exists(output_path))
            with open(output_path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            self.assertFalse(payload["valid"])


if __name__ == "__main__":
    unittest.main()
