import os
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from core.integration_slo_policy import (
    DEFAULT_MIN_SCHEMA_V2_SAMPLE_COUNT,
    DEFAULT_MAX_ERROR_RATE_PCT,
    DEFAULT_MIN_SCHEMA_V2_PCT,
    PERCENT_THRESHOLD_MAX,
    PERCENT_THRESHOLD_MIN,
    SAMPLE_THRESHOLD_MAX,
    SAMPLE_THRESHOLD_MIN,
    SLO_QUERY_LIMIT_MAX,
    SLO_QUERY_LIMIT_MIN,
    TELEMETRY_DAYS_MAX,
    TELEMETRY_DAYS_MIN,
    TELEMETRY_SUMMARY_LIMIT_MAX,
    TELEMETRY_SUMMARY_LIMIT_MIN,
)
from routes import real_integrations
from scripts import collect_connector_canary_evidence
from scripts import evaluate_connector_slo_gates


def test_shared_slo_policy_constants_are_stable():
    assert TELEMETRY_DAYS_MIN == 1
    assert TELEMETRY_DAYS_MAX == 30
    assert TELEMETRY_SUMMARY_LIMIT_MIN == 50
    assert TELEMETRY_SUMMARY_LIMIT_MAX == 5000
    assert SLO_QUERY_LIMIT_MIN == 100
    assert SLO_QUERY_LIMIT_MAX == 5000
    assert PERCENT_THRESHOLD_MIN == 0.0
    assert PERCENT_THRESHOLD_MAX == 100.0
    assert DEFAULT_MAX_ERROR_RATE_PCT == 5.0
    assert DEFAULT_MIN_SCHEMA_V2_PCT == 95.0
    assert SAMPLE_THRESHOLD_MIN == 1
    assert SAMPLE_THRESHOLD_MAX == 5000
    assert DEFAULT_MIN_SCHEMA_V2_SAMPLE_COUNT == 25


def test_slo_evaluator_script_validation_uses_shared_policy_ranges():
    class _Args:
        days = 0
        limit = 1000
        max_error_rate_pct = 5
        min_schema_v2_pct = 95
        min_schema_v2_sample_count = 25

    error = evaluate_connector_slo_gates._validate_args(_Args)
    assert error == f"days must be between {TELEMETRY_DAYS_MIN} and {TELEMETRY_DAYS_MAX}"

    _Args.days = 7
    _Args.limit = 99
    error = evaluate_connector_slo_gates._validate_args(_Args)
    assert error == f"limit must be between {SLO_QUERY_LIMIT_MIN} and {SLO_QUERY_LIMIT_MAX}"


def test_canary_collector_script_validation_uses_shared_policy_ranges():
    class _Args:
        days = 7
        limit = 1000
        max_error_rate_pct = -1
        min_schema_v2_pct = 95
        min_schema_v2_sample_count = 25

    error = collect_connector_canary_evidence._validate_args(_Args)
    assert error == (
        f"max_error_rate_pct must be between "
        f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
    )

    _Args.max_error_rate_pct = 5
    _Args.min_schema_v2_pct = 101
    error = collect_connector_canary_evidence._validate_args(_Args)
    assert error == (
        f"min_schema_v2_pct must be between "
        f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
    )

    _Args.min_schema_v2_pct = 95
    _Args.min_schema_v2_sample_count = 0
    error = collect_connector_canary_evidence._validate_args(_Args)
    assert error == (
        f"min_schema_v2_sample_count must be between "
        f"{SAMPLE_THRESHOLD_MIN} and {SAMPLE_THRESHOLD_MAX}"
    )


def test_route_threshold_resolution_uses_shared_defaults_when_query_thresholds_are_missing():
    with patch.dict(os.environ, {}, clear=True):
        error_threshold, schema_threshold, sample_threshold = real_integrations._resolve_slo_thresholds(
            max_error_rate_pct=None,
            min_schema_v2_pct=None,
        )
    assert error_threshold == DEFAULT_MAX_ERROR_RATE_PCT
    assert schema_threshold == DEFAULT_MIN_SCHEMA_V2_PCT
    assert sample_threshold == DEFAULT_MIN_SCHEMA_V2_SAMPLE_COUNT


def test_route_threshold_resolution_honors_environment_overrides():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MAX_ERROR_RATE_PCT": "7.5",
            "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT": "88.5",
            "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT": "30",
        },
        clear=True,
    ):
        error_threshold, schema_threshold, sample_threshold = real_integrations._resolve_slo_thresholds(
            max_error_rate_pct=None,
            min_schema_v2_pct=None,
        )
    assert error_threshold == 7.5
    assert schema_threshold == 88.5
    assert sample_threshold == 30


def test_route_threshold_resolution_rejects_non_numeric_error_threshold_env():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MAX_ERROR_RATE_PCT": "not-a-number",
        },
        clear=True,
    ):
        with pytest.raises(HTTPException) as exc:
            real_integrations._resolve_slo_thresholds(
                max_error_rate_pct=None,
                min_schema_v2_pct=None,
            )

    assert exc.value.status_code == 400
    assert "INTEGRATION_SLO_MAX_ERROR_RATE_PCT must be numeric" in str(exc.value.detail)


def test_route_threshold_resolution_rejects_non_numeric_schema_threshold_env():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT": "not-a-number",
        },
        clear=True,
    ):
        with pytest.raises(HTTPException) as exc:
            real_integrations._resolve_slo_thresholds(
                max_error_rate_pct=None,
                min_schema_v2_pct=None,
            )

    assert exc.value.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT must be numeric" in str(exc.value.detail)


def test_route_threshold_resolution_rejects_non_numeric_sample_threshold_env():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT": "not-an-int",
        },
        clear=True,
    ):
        with pytest.raises(HTTPException) as exc:
            real_integrations._resolve_slo_thresholds(
                max_error_rate_pct=None,
                min_schema_v2_pct=None,
            )

    assert exc.value.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT must be an integer" in str(exc.value.detail)


def test_orchestration_slo_threshold_resolution_uses_defaults():
    with patch.dict(os.environ, {}, clear=True):
        error_threshold, skipped_threshold = (
            real_integrations._resolve_orchestration_audit_slo_thresholds(
                max_orchestration_attempt_error_count=None,
                max_orchestration_attempt_skipped_count=None,
            )
        )
    assert error_threshold == real_integrations.DEFAULT_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT
    assert skipped_threshold == real_integrations.DEFAULT_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT


def test_orchestration_slo_threshold_resolution_honors_environment_overrides():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT": "2",
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT": "9",
        },
        clear=True,
    ):
        error_threshold, skipped_threshold = (
            real_integrations._resolve_orchestration_audit_slo_thresholds(
                max_orchestration_attempt_error_count=None,
                max_orchestration_attempt_skipped_count=None,
            )
        )
    assert error_threshold == 2
    assert skipped_threshold == 9


def test_orchestration_slo_threshold_resolution_rejects_non_numeric_env():
    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT": "bad-value",
        },
        clear=True,
    ):
        with pytest.raises(HTTPException) as exc:
            real_integrations._resolve_orchestration_audit_slo_thresholds(
                max_orchestration_attempt_error_count=None,
                max_orchestration_attempt_skipped_count=None,
            )
    assert exc.value.status_code == 400
    assert (
        "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT must be an integer"
        in str(exc.value.detail)
    )

    with patch.dict(
        os.environ,
        {
            "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT": "bad-value",
        },
        clear=True,
    ):
        with pytest.raises(HTTPException) as exc:
            real_integrations._resolve_orchestration_audit_slo_thresholds(
                max_orchestration_attempt_error_count=None,
                max_orchestration_attempt_skipped_count=None,
            )
    assert exc.value.status_code == 400
    assert (
        "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT must be an integer"
        in str(exc.value.detail)
    )
