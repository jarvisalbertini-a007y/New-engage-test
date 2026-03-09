from scripts import enforce_connector_release_gate


def _build_evidence(
    schema_gate_passed: bool = True,
    sample_gate_passed: bool = True,
    sample_count: int = 30,
    min_sample_count: int = 25,
):
    return {
        "sloSummary": {
            "decision": "PROCEED",
            "alerts": [],
            "gates": {
                "overallPassed": schema_gate_passed and sample_gate_passed,
                "schemaCoveragePassed": schema_gate_passed,
                "schemaSampleSizePassed": sample_gate_passed,
                "orchestrationAttemptErrorPassed": True,
                "orchestrationAttemptSkippedPassed": True,
            },
            "schemaCoverage": {
                "thresholdPct": 95.0,
                "observedPct": 100.0 if schema_gate_passed else 80.0,
                "sampleCount": sample_count,
                "minSampleCount": min_sample_count,
                "schemaV2Count": sample_count if schema_gate_passed else int(sample_count * 0.8),
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


def test_release_gate_result_contract_includes_schema_traceability_fields():
    result = enforce_connector_release_gate.evaluate_release_gate(
        _build_evidence(schema_gate_passed=True, sample_gate_passed=True, sample_count=30, min_sample_count=25),
        {"valid": True},
    )

    assert result["approved"] is True
    assert result["schemaCoverage"]["passed"] is True
    assert result["schemaCoverage"]["sampleSizePassed"] is True
    assert result["schemaCoverage"]["sampleCount"] == 30
    assert result["schemaCoverage"]["minSampleCount"] == 25
    assert result["checks"]["schemaCoveragePassed"] is True
    assert result["checks"]["schemaSampleSizePassed"] is True
    assert result["checks"]["orchestrationAttemptErrorPassed"] is True
    assert result["checks"]["orchestrationAttemptSkippedPassed"] is True
    assert result["orchestrationAudit"]["attemptErrorPassed"] is True
    assert result["orchestrationAudit"]["attemptSkippedPassed"] is True
    assert result["failedChecks"] == []


def test_release_gate_result_contract_defaults_schema_gates_to_failed_when_missing():
    result = enforce_connector_release_gate.evaluate_release_gate(
        {
            "sloSummary": {
                "decision": "PROCEED",
                "alerts": [],
                "signoff": {"status": "READY_FOR_APPROVAL"},
            }
        },
        {"valid": True},
    )

    assert result["approved"] is False
    assert result["schemaCoverage"]["passed"] is False
    assert result["schemaCoverage"]["sampleSizePassed"] is False
    assert result["schemaCoverage"]["sampleCount"] is None
    assert result["schemaCoverage"]["minSampleCount"] is None
    assert result["orchestrationAudit"]["attemptErrorPassed"] is False
    assert result["orchestrationAudit"]["attemptSkippedPassed"] is False
    assert result["orchestrationAudit"]["observedAttemptErrorCount"] is None
    assert result["orchestrationAudit"]["maxAttemptErrorCountThreshold"] is None
    assert result["orchestrationAudit"]["observedAttemptSkippedCount"] is None
    assert result["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] is None
    assert "schemaCoveragePassed" in result["failedChecks"]
    assert "schemaSampleSizePassed" in result["failedChecks"]
    assert "orchestrationAttemptErrorPassed" in result["failedChecks"]
    assert "orchestrationAttemptSkippedPassed" in result["failedChecks"]
