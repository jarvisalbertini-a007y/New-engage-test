from routes import real_integrations


def test_mask_secret_masks_long_values():
    masked = real_integrations._mask_secret("SG.1234567890abcdef")
    assert masked.startswith("••••••••")
    assert masked.endswith("cdef")


def test_mask_secret_handles_short_values():
    assert real_integrations._mask_secret("abcd") == "••••"


def test_flag_enabled_true(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    assert real_integrations._flag_enabled("ENABLE_APOLLO_CONNECTOR") is True


def test_flag_enabled_false_when_missing(monkeypatch):
    monkeypatch.delenv("ENABLE_CLEARBIT_CONNECTOR", raising=False)
    assert real_integrations._flag_enabled("ENABLE_CLEARBIT_CONNECTOR") is False


def test_is_retryable_error_true_for_timeout():
    assert real_integrations._is_retryable_error(Exception("request timeout")) is True


def test_extract_retry_error_status_code_from_message():
    status_code = real_integrations._extract_retry_error_status_code(
        Exception("provider temporary failure (503)")
    )
    assert status_code == 503


def test_classify_retry_error_marks_http_429_retryable():
    result = real_integrations._classify_retry_error(
        Exception("too many requests 429")
    )
    assert result["retryable"] is True
    assert result["status_code"] == 429
    assert result["reason_code"] == "http_429"


def test_classify_retry_error_marks_non_retryable_validation_error():
    result = real_integrations._classify_retry_error(Exception("invalid api key"))
    assert result["retryable"] is False
    assert result["reason_code"] == "non_retryable_error"


def test_is_retryable_error_false_for_validation():
    assert real_integrations._is_retryable_error(Exception("invalid api key")) is False


def test_retry_with_backoff_retries_once_and_succeeds():
    state = {"attempts": 0}

    async def flaky_operation():
        state["attempts"] += 1
        if state["attempts"] == 1:
            raise Exception("timeout")
        return "ok"

    result = real_integrations.asyncio.run(
        real_integrations._retry_with_backoff(
            flaky_operation,
            max_attempts=2,
            base_delay_seconds=0,
        )
    )
    assert result == "ok"
    assert state["attempts"] == 2


def test_retry_with_backoff_does_not_retry_non_retryable_error():
    state = {"attempts": 0}

    async def invalid_request_operation():
        state["attempts"] += 1
        raise Exception("invalid api key")

    try:
        real_integrations.asyncio.run(
            real_integrations._retry_with_backoff(
                invalid_request_operation,
                max_attempts=3,
                base_delay_seconds=0,
            )
        )
        assert False, "Expected exception was not raised"
    except Exception as exc:
        assert "invalid api key" in str(exc)
        assert state["attempts"] == 1


def test_build_sendgrid_dedup_key_uses_event_fingerprint_when_ids_missing():
    event_a = {"event": "open", "email": "a@example.com"}
    event_b = {"event": "open", "email": "b@example.com"}

    dedup_a = real_integrations._build_sendgrid_dedup_key(event_a, "open", None)
    dedup_b = real_integrations._build_sendgrid_dedup_key(event_b, "open", None)

    assert dedup_a != dedup_b
