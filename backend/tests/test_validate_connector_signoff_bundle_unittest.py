import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from scripts import validate_connector_signoff_bundle


class ValidateConnectorSignoffBundleTests(unittest.TestCase):
    def _base_evidence(self):
        return {
            "sloSummary": {
                "decision": "PROCEED",
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
                "signoff": {
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

    def _schema_traceability_lines(self):
        return [
            "- [ ] schemaCoverage.thresholdPct = 95.0",
            "- [ ] schemaCoverage.observedPct = 100.0",
            "- [ ] schemaCoverage.sampleCount = 30",
            "- [ ] schemaCoverage.minSampleCount = 25",
            "- [ ] gates.schemaCoveragePassed = True",
            "- [ ] gates.schemaSampleSizePassed = True",
            "- [ ] gates.orchestrationAttemptErrorPassed = True",
            "- [ ] gates.orchestrationAttemptSkippedPassed = True",
            "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
            "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
            "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
            "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
        ]

    def _runtime_prereqs_payload(self):
        return {
            "present": True,
            "available": True,
            "passed": True,
            "contractValid": True,
            "valid": True,
            "missingCheckCount": 0,
            "missingChecks": {"commands": [], "workspace": []},
            "artifactPath": "/tmp/sales_runtime_prereqs.json",
            "generatedAt": "2026-02-24T00:00:00+00:00",
            "validatedAt": "2026-02-24T00:00:00+00:00",
            "command": "npm run verify:baseline:runtime-prereqs",
        }

    def _command_aliases_payload(self):
        return {
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
            "generatedAt": "2026-02-24T00:00:00+00:00",
            "validatedAt": "2026-02-24T00:00:00+00:00",
            "command": "npm run verify:baseline:command-aliases:artifact",
        }

    def _sendgrid_webhook_timestamp_payload(
        self,
        event_count: int = 2,
        anomaly_count_total: int = 1,
    ):
        return {
            "eventCount": event_count,
            "timestampAnomalyCountTotal": anomaly_count_total,
            "pressureLabelCounts": {"moderate": event_count},
            "pressureHintCounts": {"monitor_rollout": event_count},
            "timestampAgeBucketCounts": {"fresh_1h_to_24h": event_count},
            "timestampAnomalyEventTypeCounts": {"delivered": anomaly_count_total},
            "latestEventAt": "2026-02-24T00:00:00+00:00",
        }

    def _sendgrid_webhook_timestamp_parity_payload(
        self,
        event_count: int = 2,
        anomaly_count_total: int = 1,
    ):
        return {
            "topLevelEventCount": event_count,
            "nestedEventCount": event_count,
            "totalsEventCount": event_count,
            "topLevelAnomalyCountTotal": anomaly_count_total,
            "nestedAnomalyCountTotal": anomaly_count_total,
            "totalsAnomalyCountTotal": anomaly_count_total,
            "eventCountMatchesNested": True,
            "eventCountMatchesTotals": True,
            "anomalyCountTotalMatchesNested": True,
            "anomalyCountTotalMatchesTotals": True,
            "pressureLabelCountsMatchNested": True,
            "pressureHintCountsMatchNested": True,
            "ageBucketCountsMatchNested": True,
            "anomalyEventTypeCountsMatchNested": True,
            "latestEventAtMatchesNested": True,
            "normalizedTopLevelPressureLabelCounts": {"moderate": event_count},
            "normalizedNestedPressureLabelCounts": {"moderate": event_count},
            "normalizedTopLevelPressureHintCounts": {"monitor_rollout": event_count},
            "normalizedNestedPressureHintCounts": {"monitor_rollout": event_count},
            "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": event_count},
            "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": event_count},
            "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": anomaly_count_total},
            "normalizedNestedAnomalyEventTypeCounts": {"delivered": anomaly_count_total},
            "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
            "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
            "computedAt": "2026-02-24T00:00:00+00:00",
        }

    def _write_required_evidence_file(self, directory: str, file_name: str):
        path = os.path.join(directory, file_name)
        if file_name == "governance_handoff_export.json":
            runtime_prereqs = self._runtime_prereqs_payload()
            command_aliases = self._command_aliases_payload()
            sendgrid_webhook_timestamp = self._sendgrid_webhook_timestamp_payload()
            sendgrid_webhook_timestamp_parity = (
                self._sendgrid_webhook_timestamp_parity_payload()
            )
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
                "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                "runtimePrereqs": runtime_prereqs,
                "commandAliases": command_aliases,
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
                    "computedAt": "2026-02-24T00:00:00+00:00",
                },
                "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
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
                    "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                },
            }
        elif file_name == "governance_history_export.json":
            runtime_prereqs = self._runtime_prereqs_payload()
            command_aliases = self._command_aliases_payload()
            sendgrid_webhook_timestamp = self._sendgrid_webhook_timestamp_payload()
            sendgrid_webhook_timestamp_parity = (
                self._sendgrid_webhook_timestamp_parity_payload()
            )
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
                "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                "runtimePrereqs": runtime_prereqs,
                "commandAliases": command_aliases,
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
                    "computedAt": "2026-02-24T00:00:00+00:00",
                },
                "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
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
                    "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
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
        elif file_name == "connector_governance_weekly_report.json":
            payload = {
                "generatedAt": "2026-02-23T00:00:00+00:00",
                "summary": {"status": "READY"},
            }
        elif file_name == "governance_packet_validation.json":
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

    def test_validation_passes_when_all_artifacts_and_approvals_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

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
            self.assertEqual(len(result["checks"]["schemaTraceability"]), 12)

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
                self._write_required_evidence_file(tmp, file_name)

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

    def test_validation_fails_when_governance_attachments_are_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            with open(os.path.join(tmp, "governance_handoff_export.json"), "w", encoding="utf-8") as f:
                f.write("{invalid")
            sendgrid_webhook_timestamp = self._sendgrid_webhook_timestamp_payload(
                event_count=1,
                anomaly_count_total=1,
            )
            sendgrid_webhook_timestamp_parity = (
                self._sendgrid_webhook_timestamp_parity_payload(
                    event_count=1,
                    anomaly_count_total=1,
                )
            )
            with open(os.path.join(tmp, "governance_history_export.json"), "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "totals": {
                            "connectorRateLimitEventCount": 1,
                            "sendgridWebhookTimestampEventCount": 1,
                            "sendgridWebhookTimestampAnomalyCountTotal": 1,
                            "runtimePrereqsMissingCheckCount": 0,
                            "commandAliasesMissingAliasCount": 0,
                            "commandAliasesMismatchedAliasCount": 0,
                        },
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                        "runtimePrereqs": self._runtime_prereqs_payload(),
                        "commandAliases": self._command_aliases_payload(),
                        "connectorPressureParity": {
                            "topLevelEventCount": 1,
                            "nestedEventCount": 1,
                            "totalsEventCount": 1,
                            "eventCountMatchesNested": True,
                            "eventCountMatchesTotals": True,
                            "byEndpointMatchesNested": True,
                            "pressureLabelMatchesNested": True,
                            "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                            "normalizedNestedByEndpoint": {"apollo_search": 1},
                            "computedAt": "2026-02-24T00:00:00+00:00",
                        },
                        "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
                        "governanceExport": {
                            "status": "READY",
                            "exportSchemaVersion": 1,
                            "rolloutBlocked": False,
                            "reasonCodes": ["governance_ready"],
                            "reasonCodeCount": 1,
                            "recommendedCommands": ["npm run verify:ci:sales:extended"],
                            "recommendedCommandCount": 1,
                            "runtimePrereqs": self._runtime_prereqs_payload(),
                            "commandAliases": self._command_aliases_payload(),
                            "connectorRateLimit": {
                                "eventCount": 1,
                                "byEndpoint": {"apollo_search": 1},
                                "pressure": {"label": "Low"},
                            },
                            "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                        },
                    },
                    f,
                )
            with open(os.path.join(tmp, "governance_packet_validation.json"), "w", encoding="utf-8") as f:
                json.dump({"valid": False, "errors": ["bad"], "checks": {}}, f)

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
            self.assertFalse(result["valid"])
            errors_text = "\n".join(result["errors"])
            self.assertIn("Governance handoff evidence is not valid JSON", errors_text)
            self.assertIn("Governance history evidence is missing items list", errors_text)
            self.assertIn(
                "Governance packet validation artifact must indicate valid=true",
                errors_text,
            )

    def test_validation_fails_when_governance_attachment_schema_versions_are_mismatched(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            with open(
                os.path.join(tmp, "governance_history_export.json"), "w", encoding="utf-8"
            ) as f:
                json.dump(
                    {
                        "status": "READY",
                        "exportSchemaVersion": 2,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "totals": {"connectorRateLimitEventCount": 2},
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "pressure": {"label": "Moderate"},
                        },
                        "governanceExport": {
                            "status": "READY",
                            "exportSchemaVersion": 2,
                            "rolloutBlocked": False,
                            "reasonCodes": ["governance_ready"],
                            "reasonCodeCount": 1,
                            "recommendedCommands": ["npm run verify:ci:sales:extended"],
                            "recommendedCommandCount": 1,
                            "connectorRateLimit": {
                                "eventCount": 2,
                                "byEndpoint": {"apollo_search": 2},
                                "pressure": {"label": "Moderate"},
                            },
                        },
                        "items": [
                            {
                                "name": "connector_governance_weekly_report.json",
                                "status": "READY",
                                "withinRetention": True,
                                "rolloutBlocked": False,
                                "exportSchemaVersion": 2,
                            }
                        ],
                    },
                    f,
                )

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
            self.assertFalse(result["valid"])
            errors_text = "\n".join(result["errors"])
            self.assertIn("exportSchemaVersion=2 is unsupported", errors_text)
            self.assertIn("Regenerate governance packet artifacts", errors_text)

    def test_validation_fails_when_governance_connector_rate_limit_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            with open(
                os.path.join(tmp, "governance_handoff_export.json"), "w", encoding="utf-8"
            ) as f:
                sendgrid_webhook_timestamp = self._sendgrid_webhook_timestamp_payload()
                sendgrid_webhook_timestamp_parity = (
                    self._sendgrid_webhook_timestamp_parity_payload()
                )
                json.dump(
                    {
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
                        },
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "pressure": {"label": "Moderate"},
                        },
                        "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                        "runtimePrereqs": self._runtime_prereqs_payload(),
                        "connectorPressureParity": {
                            "topLevelEventCount": 2,
                            "nestedEventCount": 3,
                            "totalsEventCount": 2,
                            "eventCountMatchesNested": False,
                            "eventCountMatchesTotals": True,
                            "byEndpointMatchesNested": False,
                            "pressureLabelMatchesNested": False,
                            "normalizedTopLevelByEndpoint": {"apollo_search": 2},
                            "normalizedNestedByEndpoint": {"apollo_search": 3},
                            "computedAt": "2026-02-24T00:00:00+00:00",
                        },
                        "sendgridWebhookTimestampParity": sendgrid_webhook_timestamp_parity,
                        "governanceExport": {
                            "status": "READY",
                            "exportSchemaVersion": 1,
                            "rolloutBlocked": False,
                            "reasonCodes": ["governance_ready"],
                            "reasonCodeCount": 1,
                            "recommendedCommands": ["npm run verify:ci:sales:extended"],
                            "recommendedCommandCount": 1,
                            "runtimePrereqs": self._runtime_prereqs_payload(),
                            "connectorRateLimit": {
                                "eventCount": 3,
                                "byEndpoint": {"apollo_search": 3},
                                "pressure": {"label": "High"},
                            },
                            "sendgridWebhookTimestamp": sendgrid_webhook_timestamp,
                        },
                    },
                    f,
                )

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "connectorRateLimit.eventCount must match governanceExport.connectorRateLimit.eventCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_connector_rate_limit_totals_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            with open(
                os.path.join(tmp, "governance_handoff_export.json"), "r", encoding="utf-8"
            ) as f:
                handoff_payload = json.load(f)
            handoff_payload["totals"]["connectorRateLimitEventCount"] = 5
            with open(
                os.path.join(tmp, "governance_handoff_export.json"), "w", encoding="utf-8"
            ) as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "totals.connectorRateLimitEventCount must match connectorRateLimit.eventCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_connector_rate_limit_by_endpoint_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            with open(
                os.path.join(tmp, "governance_history_export.json"), "r", encoding="utf-8"
            ) as f:
                history_payload = json.load(f)
            history_payload["governanceExport"]["connectorRateLimit"]["byEndpoint"] = {
                "apollo_search": 1,
                "clearbit_company": 1,
            }
            with open(
                os.path.join(tmp, "governance_history_export.json"), "w", encoding="utf-8"
            ) as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "connectorRateLimit.byEndpoint must match governanceExport.connectorRateLimit.byEndpoint",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_runtime_prereqs_missing_check_count_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["runtimePrereqs"]["missingCheckCount"] = 2
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "runtimePrereqs.missingCheckCount must match missingChecks command/workspace totals",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_runtime_prereqs_totals_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["totals"]["runtimePrereqsMissingCheckCount"] = 3
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "totals.runtimePrereqsMissingCheckCount must match runtimePrereqs.missingCheckCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_runtime_prereqs_drift_between_top_level_and_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["governanceExport"]["runtimePrereqs"]["missingCheckCount"] = 1
            handoff_payload["governanceExport"]["runtimePrereqs"]["missingChecks"] = {
                "commands": ["npm run verify:baseline:runtime-prereqs"],
                "workspace": [],
            }
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "runtimePrereqs must match governanceExport.runtimePrereqs",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_runtime_prereqs_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["runtimePrereqs"]["missingCheckCount"] = 1
            history_payload["runtimePrereqs"]["missingChecks"] = {
                "commands": ["npm run verify:baseline:runtime-prereqs"],
                "workspace": [],
            }
            history_payload["governanceExport"]["runtimePrereqs"]["missingCheckCount"] = 1
            history_payload["governanceExport"]["runtimePrereqs"]["missingChecks"] = {
                "commands": ["npm run verify:baseline:runtime-prereqs"],
                "workspace": [],
            }
            history_payload["totals"]["runtimePrereqsMissingCheckCount"] = 1
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history runtimePrereqs.missingCheckCount values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_runtime_prereqs_command_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["runtimePrereqs"]["command"] = "npm run verify:smoke:runtime-prereqs-artifact"
            history_payload["governanceExport"]["runtimePrereqs"]["command"] = (
                "npm run verify:smoke:runtime-prereqs-artifact"
            )
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history runtimePrereqs.command values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_command_aliases_totals_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["totals"]["commandAliasesMissingAliasCount"] = 2
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "totals.commandAliasesMissingAliasCount must match commandAliases.missingAliasCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_command_aliases_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["commandAliases"]["missingAliasCount"] = 1
            history_payload["commandAliases"]["missingAliases"] = [
                "verify:smoke:sales"
            ]
            history_payload["governanceExport"]["commandAliases"]["missingAliasCount"] = 1
            history_payload["governanceExport"]["commandAliases"]["missingAliases"] = [
                "verify:smoke:sales"
            ]
            history_payload["totals"]["commandAliasesMissingAliasCount"] = 1
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history commandAliases.missingAliasCount values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_command_aliases_mismatched_totals_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["totals"]["commandAliasesMismatchedAliasCount"] = 2
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "totals.commandAliasesMismatchedAliasCount must match commandAliases.mismatchedAliasCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_command_aliases_mismatched_count_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["commandAliases"]["mismatchedAliasCount"] = 1
            history_payload["commandAliases"]["mismatchedAliases"] = [
                "verify:smoke:sales",
            ]
            history_payload["governanceExport"]["commandAliases"]["mismatchedAliasCount"] = 1
            history_payload["governanceExport"]["commandAliases"]["mismatchedAliases"] = [
                "verify:smoke:sales",
            ]
            history_payload["totals"]["commandAliasesMismatchedAliasCount"] = 1
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history commandAliases.mismatchedAliasCount values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_command_aliases_command_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["commandAliases"]["command"] = "npm run verify:baseline:command-aliases"
            history_payload["governanceExport"]["commandAliases"]["command"] = (
                "npm run verify:baseline:command-aliases"
            )
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history commandAliases.command values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_reason_code_count_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["reasonCodeCount"] = 2
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "reasonCodeCount must match len(reasonCodes)",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_recommended_command_count_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["governanceExport"]["recommendedCommandCount"] = 0
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "governanceExport.recommendedCommandCount must match len(recommendedCommands)",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_reason_codes_drift_between_top_level_and_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["governanceExport"]["reasonCodes"] = ["requires_action"]
            handoff_payload["governanceExport"]["reasonCodeCount"] = 1
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "reasonCodes must match governanceExport.reasonCodes",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_connector_pressure_parity_flags_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["connectorPressureParity"]["eventCountMatchesNested"] = False
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "connectorPressureParity fields are inconsistent with connectorRateLimit payload parity",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_totals_parity_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["totals"]["sendgridWebhookTimestampEventCount"] = 9
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "totals.sendgridWebhookTimestampEventCount must match sendgridWebhookTimestamp.eventCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_payload_drift_between_top_level_and_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            history_payload["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"] = 5
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "sendgridWebhookTimestamp.eventCount must match governanceExport.sendgridWebhookTimestamp.eventCount",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_parity_flags_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            handoff_path = os.path.join(tmp, "governance_handoff_export.json")
            with open(handoff_path, "r", encoding="utf-8") as f:
                handoff_payload = json.load(f)
            handoff_payload["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] = False
            with open(handoff_path, "w", encoding="utf-8") as f:
                json.dump(handoff_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "sendgridWebhookTimestampParity fields are inconsistent with sendgridWebhookTimestamp payload parity",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_event_count_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=3,
                anomaly_count_total=1,
            )
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=3,
                anomaly_count_total=1,
            )
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            history_payload["totals"]["sendgridWebhookTimestampEventCount"] = 3
            history_payload["totals"]["sendgridWebhookTimestampAnomalyCountTotal"] = 1
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.eventCount values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_anomaly_total_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=2,
            )
            sendgrid_payload["timestampAnomalyEventTypeCounts"] = {"delivered": 2}
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=2,
            )
            sendgrid_parity["normalizedTopLevelAnomalyEventTypeCounts"] = {"delivered": 2}
            sendgrid_parity["normalizedNestedAnomalyEventTypeCounts"] = {"delivered": 2}
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            history_payload["totals"]["sendgridWebhookTimestampAnomalyCountTotal"] = 2
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.timestampAnomalyCountTotal values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_pressure_label_counts_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_payload["pressureLabelCounts"] = {"high": 2}
            sendgrid_payload["pressureHintCounts"] = {"cooldown_required": 2}
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_parity["normalizedTopLevelPressureLabelCounts"] = {"high": 2}
            sendgrid_parity["normalizedNestedPressureLabelCounts"] = {"high": 2}
            sendgrid_parity["normalizedTopLevelPressureHintCounts"] = {
                "cooldown_required": 2
            }
            sendgrid_parity["normalizedNestedPressureHintCounts"] = {
                "cooldown_required": 2
            }
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.pressureLabelCounts values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_pressure_hint_counts_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_payload["pressureHintCounts"] = {"cooldown_required": 2}
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_parity["normalizedTopLevelPressureHintCounts"] = {
                "cooldown_required": 2
            }
            sendgrid_parity["normalizedNestedPressureHintCounts"] = {
                "cooldown_required": 2
            }
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.pressureHintCounts values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_age_bucket_counts_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_payload["timestampAgeBucketCounts"] = {"stale": 2}
            sendgrid_payload["timestampAnomalyEventTypeCounts"] = {"open": 1}
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_parity["normalizedTopLevelAgeBucketCounts"] = {"stale": 2}
            sendgrid_parity["normalizedNestedAgeBucketCounts"] = {"stale": 2}
            sendgrid_parity["normalizedTopLevelAnomalyEventTypeCounts"] = {"open": 1}
            sendgrid_parity["normalizedNestedAnomalyEventTypeCounts"] = {"open": 1}
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.timestampAgeBucketCounts values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_anomaly_event_type_counts_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_payload["timestampAnomalyEventTypeCounts"] = {"open": 1}
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_parity["normalizedTopLevelAnomalyEventTypeCounts"] = {"open": 1}
            sendgrid_parity["normalizedNestedAnomalyEventTypeCounts"] = {"open": 1}
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.timestampAnomalyEventTypeCounts values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_sendgrid_latest_event_at_drift_between_handoff_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            history_path = os.path.join(tmp, "governance_history_export.json")
            with open(history_path, "r", encoding="utf-8") as f:
                history_payload = json.load(f)
            sendgrid_payload = self._sendgrid_webhook_timestamp_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_payload["latestEventAt"] = "2026-02-24T12:00:00+00:00"
            sendgrid_parity = self._sendgrid_webhook_timestamp_parity_payload(
                event_count=2,
                anomaly_count_total=1,
            )
            sendgrid_parity["normalizedLatestEventAtTopLevel"] = (
                "2026-02-24T12:00:00+00:00"
            )
            sendgrid_parity["normalizedLatestEventAtNested"] = (
                "2026-02-24T12:00:00+00:00"
            )
            history_payload["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["governanceExport"]["sendgridWebhookTimestamp"] = sendgrid_payload
            history_payload["sendgridWebhookTimestampParity"] = sendgrid_parity
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_payload, f)

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
            self.assertFalse(result["valid"])
            self.assertIn(
                "Governance handoff/history sendgridWebhookTimestamp.latestEventAt values are inconsistent",
                "\n".join(result["errors"]),
            )

    def test_validation_fails_when_governance_schema_env_override_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            signoff_md = "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    *self._schema_traceability_lines(),
                ]
            )
            with patch.dict(os.environ, {"GOVERNANCE_EXPORT_SCHEMA_VERSION": "invalid"}):
                result = validate_connector_signoff_bundle.validate_signoff_bundle(
                    self._base_evidence(),
                    signoff_md,
                    tmp,
                )
            self.assertFalse(result["valid"])
            self.assertIn(
                "GOVERNANCE_EXPORT_SCHEMA_VERSION is invalid",
                "\n".join(result["errors"]),
            )
            preflight = result["checks"]["governanceSchemaPreflight"]
            self.assertTrue(preflight["isSet"])
            self.assertFalse(preflight["isValid"])
            self.assertFalse(preflight["consistent"])

    def test_validation_fails_when_governance_schema_env_override_mismatches_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            signoff_md = "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    *self._schema_traceability_lines(),
                ]
            )
            with patch.dict(os.environ, {"GOVERNANCE_EXPORT_SCHEMA_VERSION": "7"}):
                result = validate_connector_signoff_bundle.validate_signoff_bundle(
                    self._base_evidence(),
                    signoff_md,
                    tmp,
                )
            self.assertFalse(result["valid"])
            self.assertIn(
                "do not match GOVERNANCE_EXPORT_SCHEMA_VERSION=7",
                "\n".join(result["errors"]),
            )
            preflight = result["checks"]["governanceSchemaPreflight"]
            self.assertTrue(preflight["isSet"])
            self.assertTrue(preflight["isValid"])
            self.assertEqual(preflight["expectedExportSchemaVersion"], 7)
            self.assertEqual(preflight["detectedExportSchemaVersions"], [1])
            self.assertFalse(preflight["consistent"])

    def test_validation_passes_when_governance_schema_env_override_matches_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            signoff_md = "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    *self._schema_traceability_lines(),
                ]
            )
            with patch.dict(os.environ, {"GOVERNANCE_EXPORT_SCHEMA_VERSION": "1"}):
                result = validate_connector_signoff_bundle.validate_signoff_bundle(
                    self._base_evidence(),
                    signoff_md,
                    tmp,
                )
            self.assertTrue(result["valid"])
            preflight = result["checks"]["governanceSchemaPreflight"]
            self.assertTrue(preflight["isSet"])
            self.assertTrue(preflight["isValid"])
            self.assertTrue(preflight["consistent"])
            self.assertEqual(preflight["detectedExportSchemaVersions"], [1])

    def test_validation_fails_when_governance_packet_validation_is_stale(self):
        with tempfile.TemporaryDirectory() as tmp:
            for file_name in self._base_evidence()["sloSummary"]["signoff"]["requiredEvidence"]:
                self._write_required_evidence_file(tmp, file_name)

            stale_validated_at = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
            with open(os.path.join(tmp, "governance_packet_validation.json"), "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "validatedAt": stale_validated_at,
                        "checks": {},
                        "errors": [],
                        "valid": True,
                    },
                    f,
                )

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
            self.assertFalse(result["valid"])
            errors_text = "\n".join(result["errors"])
            self.assertIn("governance packet validation artifact is stale", errors_text.lower())

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
