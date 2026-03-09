import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

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
                    "observedAttemptErrorCount": 1,
                    "maxAttemptSkippedCountThreshold": 25,
                    "observedAttemptSkippedCount": 2,
                },
                "rolloutActions": [
                    {"priority": "P3", "ownerRole": "Release Manager", "action": "Proceed"}
                ],
                "signoff": {
                    "status": "READY_FOR_APPROVAL",
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
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
            self.assertIn("governance_handoff_export.json", content)
            self.assertIn("governance_history_export.json", content)
            self.assertIn("governance_packet_validation.json", content)
            self.assertIn("Governance Handoff Export Placeholder", content)
            self.assertIn("governance_handoff_export.json.governanceExport.status", content)
            self.assertIn("governance_handoff_export.json.reasonCodeCount", content)
            self.assertIn("governance_handoff_export.json.recommendedCommandCount", content)
            self.assertIn(
                "governance_handoff_export.json.reasonCodeCount equals len(governance_handoff_export.json.reasonCodes)",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.recommendedCommandCount equals len(governance_handoff_export.json.recommendedCommands)",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.runtimePrereqs.missingCheckCount",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.runtimePrereqs.command",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.commandAliases.missingAliasCount",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.commandAliases.mismatchedAliasCount",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.commandAliases equals governance_handoff_export.json.governanceExport.commandAliases",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.runtimePrereqs equals governance_handoff_export.json.governanceExport.runtimePrereqs",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.reasonCodes equals governance_handoff_export.json.governanceExport.reasonCodes",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.recommendedCommands equals governance_handoff_export.json.governanceExport.recommendedCommands",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.totals.connectorRateLimitEventCount",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.connectorRateLimit.byEndpoint equals governance_handoff_export.json.governanceExport.connectorRateLimit.byEndpoint",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.totals.runtimePrereqsMissingCheckCount equals governance_handoff_export.json.runtimePrereqs.missingCheckCount",
                content,
            )
            self.assertIn(
                "governance_handoff_export.json.totals.commandAliasesMissingAliasCount equals governance_handoff_export.json.commandAliases.missingAliasCount",
                content,
            )
            self.assertIn("Governance History Export Placeholder", content)
            self.assertIn("governance_history_export.json.items = []", content)
            self.assertIn("governance_history_export.json.reasonCodeCount", content)
            self.assertIn("governance_history_export.json.recommendedCommandCount", content)
            self.assertIn(
                "governance_history_export.json.reasonCodeCount equals len(governance_history_export.json.reasonCodes)",
                content,
            )
            self.assertIn(
                "governance_history_export.json.recommendedCommandCount equals len(governance_history_export.json.recommendedCommands)",
                content,
            )
            self.assertIn(
                "governance_history_export.json.runtimePrereqs.missingCheckCount",
                content,
            )
            self.assertIn(
                "governance_history_export.json.runtimePrereqs.command",
                content,
            )
            self.assertIn(
                "governance_history_export.json.commandAliases.missingAliasCount",
                content,
            )
            self.assertIn(
                "governance_history_export.json.commandAliases.mismatchedAliasCount",
                content,
            )
            self.assertIn(
                "governance_history_export.json.commandAliases equals governance_history_export.json.governanceExport.commandAliases",
                content,
            )
            self.assertIn(
                "governance_history_export.json.runtimePrereqs equals governance_history_export.json.governanceExport.runtimePrereqs",
                content,
            )
            self.assertIn(
                "governance_history_export.json.reasonCodes equals governance_history_export.json.governanceExport.reasonCodes",
                content,
            )
            self.assertIn(
                "governance_history_export.json.recommendedCommands equals governance_history_export.json.governanceExport.recommendedCommands",
                content,
            )
            self.assertIn(
                "governance_history_export.json.totals.connectorRateLimitEventCount",
                content,
            )
            self.assertIn(
                "governance_history_export.json.connectorRateLimit.byEndpoint equals governance_history_export.json.governanceExport.connectorRateLimit.byEndpoint",
                content,
            )
            self.assertIn(
                "governance_history_export.json.totals.runtimePrereqsMissingCheckCount equals governance_history_export.json.runtimePrereqs.missingCheckCount",
                content,
            )
            self.assertIn(
                "governance_history_export.json.totals.commandAliasesMissingAliasCount equals governance_history_export.json.commandAliases.missingAliasCount",
                content,
            )
            self.assertIn("Governance Schema Preflight Checklist", content)
            self.assertIn("npm run verify:governance:schema:preflight", content)
            self.assertIn("governanceSchemaPreflight.consistent = true", content)
            self.assertIn("Schema Evidence Traceability", content)
            self.assertIn("schemaCoverage.minSampleCount", content)
            self.assertIn("gates.schemaSampleSizePassed", content)
            self.assertIn("gates.orchestrationAttemptErrorPassed", content)
            self.assertIn("orchestrationAudit.observedAttemptSkippedCount", content)
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
                path = os.path.join(tmp, filename)
                runtime_prereqs = {
                    "present": True,
                    "available": True,
                    "passed": True,
                    "contractValid": True,
                    "valid": True,
                    "missingCheckCount": 0,
                    "missingChecks": {"commands": [], "workspace": []},
                    "artifactPath": "/tmp/sales_runtime_prereqs.json",
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "command": "npm run verify:baseline:runtime-prereqs",
                }
                command_aliases = {
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
                    "artifactPath": "/tmp/sales_baseline_command_aliases.json",
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "command": "npm run verify:baseline:command-aliases:artifact",
                }
                if filename == "governance_handoff_export.json":
                    payload = {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "totals": {
                            "connectorRateLimitEventCount": 2,
                            "sendgridWebhookTimestampEventCount": 2,
                            "sendgridWebhookTimestampAnomalyCountTotal": 1,
                            "runtimePrereqsMissingCheckCount": 0,
                            "commandAliasesMissingAliasCount": 0,
                            "commandAliasesMismatchedAliasCount": 0,
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
                        "runtimePrereqs": runtime_prereqs,
                        "commandAliases": command_aliases,
                        "governanceExport": {
                            "status": "READY",
                            "exportSchemaVersion": 1,
                            "rolloutBlocked": False,
                            "reasonCodes": ["governance_ready"],
                            "reasonCodeCount": 1,
                            "recommendedCommands": ["npm run verify:ci:sales:extended"],
                            "recommendedCommandCount": 1,
                            "runtimePrereqs": runtime_prereqs,
                            "commandAliases": command_aliases,
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
                        "connectorPressureParity": {
                            "topLevelEventCount": 2,
                            "nestedEventCount": 2,
                            "totalsEventCount": 2,
                            "eventCountMatchesNested": True,
                            "eventCountMatchesTotals": True,
                            "byEndpointMatchesNested": True,
                            "pressureLabelMatchesNested": True,
                            "normalizedTopLevelByEndpoint": {"apollo_search": 2},
                            "normalizedNestedByEndpoint": {"apollo_search": 2},
                            "computedAt": datetime.now(timezone.utc).isoformat(),
                        },
                        "sendgridWebhookTimestampParity": {
                            "topLevelEventCount": 2,
                            "nestedEventCount": 2,
                            "totalsEventCount": 2,
                            "topLevelAnomalyCountTotal": 1,
                            "nestedAnomalyCountTotal": 1,
                            "totalsAnomalyCountTotal": 1,
                            "eventCountMatchesNested": True,
                            "eventCountMatchesTotals": True,
                            "anomalyCountTotalMatchesNested": True,
                            "anomalyCountTotalMatchesTotals": True,
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
                            "computedAt": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                elif filename == "governance_history_export.json":
                    payload = {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "totals": {
                            "connectorRateLimitEventCount": 2,
                            "sendgridWebhookTimestampEventCount": 2,
                            "sendgridWebhookTimestampAnomalyCountTotal": 1,
                            "runtimePrereqsMissingCheckCount": 0,
                            "commandAliasesMissingAliasCount": 0,
                            "commandAliasesMismatchedAliasCount": 0,
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
                        "runtimePrereqs": runtime_prereqs,
                        "commandAliases": command_aliases,
                        "governanceExport": {
                            "status": "READY",
                            "exportSchemaVersion": 1,
                            "rolloutBlocked": False,
                            "reasonCodes": ["governance_ready"],
                            "reasonCodeCount": 1,
                            "recommendedCommands": ["npm run verify:ci:sales:extended"],
                            "recommendedCommandCount": 1,
                            "runtimePrereqs": runtime_prereqs,
                            "commandAliases": command_aliases,
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
                        "connectorPressureParity": {
                            "topLevelEventCount": 2,
                            "nestedEventCount": 2,
                            "totalsEventCount": 2,
                            "eventCountMatchesNested": True,
                            "eventCountMatchesTotals": True,
                            "byEndpointMatchesNested": True,
                            "pressureLabelMatchesNested": True,
                            "normalizedTopLevelByEndpoint": {"apollo_search": 2},
                            "normalizedNestedByEndpoint": {"apollo_search": 2},
                            "computedAt": datetime.now(timezone.utc).isoformat(),
                        },
                        "sendgridWebhookTimestampParity": {
                            "topLevelEventCount": 2,
                            "nestedEventCount": 2,
                            "totalsEventCount": 2,
                            "topLevelAnomalyCountTotal": 1,
                            "nestedAnomalyCountTotal": 1,
                            "totalsAnomalyCountTotal": 1,
                            "eventCountMatchesNested": True,
                            "eventCountMatchesTotals": True,
                            "anomalyCountTotalMatchesNested": True,
                            "anomalyCountTotalMatchesTotals": True,
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
                            "computedAt": datetime.now(timezone.utc).isoformat(),
                        },
                        "items": [
                            {
                                "name": "connector_governance_weekly_report.json",
                                "status": "READY",
                                "withinRetention": True,
                                "rolloutBlocked": False,
                                "exportSchemaVersion": 1,
                            }
                        ],
                    }
                elif filename == "connector_governance_weekly_report.json":
                    payload = {
                        "generatedAt": "2026-02-23T00:00:00+00:00",
                        "summary": {"status": "READY"},
                    }
                elif filename == "governance_packet_validation.json":
                    payload = {
                        "validatedAt": datetime.now(timezone.utc).isoformat(),
                        "checks": {},
                        "errors": [],
                        "valid": True,
                    }
                else:
                    payload = {}
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(payload, f)

            with open(signoff_path, "r", encoding="utf-8") as f:
                signoff_content = f.read()
            with patch.dict(os.environ, {"GOVERNANCE_EXPORT_SCHEMA_VERSION": "1"}):
                result = validate_connector_signoff_bundle.validate_signoff_bundle(
                    evidence,
                    signoff_content,
                    tmp,
                )
            self.assertTrue(result["valid"])


if __name__ == "__main__":
    unittest.main()
