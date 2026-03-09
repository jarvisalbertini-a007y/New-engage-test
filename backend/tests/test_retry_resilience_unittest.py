import sys
import types
import unittest
from unittest.mock import AsyncMock, patch


if "fastapi" not in sys.modules:
    fastapi_stub = types.ModuleType("fastapi")

    class _HTTPException(Exception):
        def __init__(self, status_code: int, detail):
            super().__init__(str(detail))
            self.status_code = status_code
            self.detail = detail

    class _APIRouter:
        def _decorator(self, *_args, **_kwargs):
            def _inner(func):
                return func

            return _inner

        get = post = put = delete = patch = _decorator

    def _depends(_callable):
        return None

    class _BackgroundTasks:
        pass

    class _Request:
        headers = {}

    class _Response:
        pass

    fastapi_stub.APIRouter = _APIRouter
    fastapi_stub.HTTPException = _HTTPException
    fastapi_stub.Depends = _depends
    fastapi_stub.BackgroundTasks = _BackgroundTasks
    fastapi_stub.Request = _Request
    fastapi_stub.Response = _Response
    sys.modules["fastapi"] = fastapi_stub

if "database" not in sys.modules:
    database_stub = types.ModuleType("database")

    def _stub_get_db():
        raise RuntimeError("get_db must be patched in tests")

    database_stub.get_db = _stub_get_db
    sys.modules["database"] = database_stub

if "httpx" not in sys.modules:
    httpx_stub = types.ModuleType("httpx")

    class _AsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, **_kwargs):
            raise RuntimeError("httpx.AsyncClient.request should be patched in tests")

        async def get(self, *_args, **_kwargs):
            raise RuntimeError("httpx.AsyncClient.get should be patched in tests")

    httpx_stub.AsyncClient = _AsyncClient
    sys.modules["httpx"] = httpx_stub

if "routes.auth" not in sys.modules:
    auth_stub = types.ModuleType("routes.auth")

    async def _stub_get_current_user():
        return {"id": "stub-user"}

    auth_stub.get_current_user = _stub_get_current_user
    sys.modules["routes.auth"] = auth_stub

from routes import real_integrations


class RetryResilienceTests(unittest.IsolatedAsyncioTestCase):
    def test_resolve_retry_delay_seconds_applies_clamp_and_jitter(self):
        with patch.object(real_integrations.random, "uniform", return_value=0.2) as jitter_mock:
            delay = real_integrations._resolve_retry_delay_seconds(
                attempt=3,
                base_delay_seconds=0.5,
                max_delay_seconds=1.0,
                jitter_seconds=0.5,
            )

        self.assertEqual(delay, 1.0)
        jitter_mock.assert_called_once_with(0.0, 0.5)

    async def test_retry_with_backoff_retries_retryable_error_then_succeeds(self):
        state = {"attempts": 0}

        async def _operation():
            state["attempts"] += 1
            if state["attempts"] == 1:
                raise Exception("503 temporarily unavailable")
            return {"ok": True}

        with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
            result = await real_integrations._retry_with_backoff(
                _operation,
                max_attempts=3,
                base_delay_seconds=0.01,
            )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(state["attempts"], 2)
        sleep_mock.assert_awaited_once()

    async def test_retry_with_backoff_does_not_retry_non_retryable_error(self):
        state = {"attempts": 0}

        async def _operation():
            state["attempts"] += 1
            raise Exception("401 unauthorized")

        with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
            with self.assertRaises(Exception):
                await real_integrations._retry_with_backoff(
                    _operation,
                    max_attempts=3,
                    base_delay_seconds=0.01,
                )

        self.assertEqual(state["attempts"], 1)
        sleep_mock.assert_not_awaited()

    async def test_retry_with_backoff_raises_after_max_attempts(self):
        state = {"attempts": 0}

        async def _operation():
            state["attempts"] += 1
            raise Exception("timeout contacting provider")

        with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
            with self.assertRaises(Exception):
                await real_integrations._retry_with_backoff(
                    _operation,
                    max_attempts=3,
                    base_delay_seconds=0.01,
                )

        self.assertEqual(state["attempts"], 3)
        self.assertEqual(sleep_mock.await_count, 2)

    async def test_retry_with_backoff_emits_fail_fast_terminal_event(self):
        state = {"attempts": 0}
        terminal_callback = AsyncMock(return_value=None)

        async def _operation():
            state["attempts"] += 1
            raise Exception("invalid api key")

        with patch.object(real_integrations, "_log_integration_event") as log_mock:
            with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
                with self.assertRaises(Exception):
                    await real_integrations._retry_with_backoff(
                        _operation,
                        max_attempts=3,
                        base_delay_seconds=0.01,
                        operation_name="sendgrid_send_email",
                        provider="sendgrid",
                        request_id="req-fail-fast-1",
                        on_retry_terminal_event=terminal_callback,
                    )

        self.assertEqual(state["attempts"], 1)
        sleep_mock.assert_not_awaited()
        log_mock.assert_called_once()
        log_args, log_kwargs = log_mock.call_args
        self.assertEqual(log_args[0], "integrations_retry_fail_fast")
        self.assertEqual(log_args[1]["operation"], "sendgrid_send_email")
        self.assertEqual(log_args[1]["provider"], "sendgrid")
        self.assertEqual(log_args[1]["attempt"], 1)
        self.assertEqual(log_args[1]["max_attempts"], 3)
        self.assertEqual(log_args[1]["final_outcome"], "fail_fast")
        self.assertEqual(log_args[1]["error_reason_code"], "non_retryable_error")
        self.assertEqual(log_args[1]["error_type"], "Exception")
        self.assertEqual(log_kwargs["request_id"], "req-fail-fast-1")
        terminal_callback.assert_awaited_once()

    async def test_retry_with_backoff_emits_exhausted_terminal_event(self):
        state = {"attempts": 0}
        terminal_callback = AsyncMock(return_value=None)

        async def _operation():
            state["attempts"] += 1
            raise Exception("503 temporarily unavailable")

        with patch.object(real_integrations, "_resolve_retry_delay_seconds", return_value=0.1):
            with patch.object(real_integrations, "_log_integration_event") as log_mock:
                with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)):
                    with self.assertRaises(Exception):
                        await real_integrations._retry_with_backoff(
                            _operation,
                            max_attempts=2,
                            base_delay_seconds=0.01,
                            operation_name="sendgrid_health_check",
                            provider="sendgrid",
                            request_id="req-retry-exhausted-1",
                            on_retry_terminal_event=terminal_callback,
                        )

        self.assertEqual(state["attempts"], 2)
        self.assertEqual(log_mock.call_count, 2)
        terminal_call = log_mock.call_args_list[1]
        terminal_args, terminal_kwargs = terminal_call
        self.assertEqual(terminal_args[0], "integrations_retry_exhausted")
        self.assertEqual(terminal_args[1]["operation"], "sendgrid_health_check")
        self.assertEqual(terminal_args[1]["provider"], "sendgrid")
        self.assertEqual(terminal_args[1]["attempt"], 2)
        self.assertEqual(terminal_args[1]["max_attempts"], 2)
        self.assertEqual(terminal_args[1]["final_outcome"], "retry_exhausted")
        self.assertEqual(terminal_args[1]["error_reason_code"], "http_503")
        self.assertEqual(terminal_args[1]["error_status_code"], 503)
        self.assertEqual(terminal_kwargs["request_id"], "req-retry-exhausted-1")
        terminal_callback.assert_awaited_once()

    async def test_retry_with_backoff_uses_resolved_delay(self):
        state = {"attempts": 0}

        async def _operation():
            state["attempts"] += 1
            if state["attempts"] < 2:
                raise Exception("503 temporarily unavailable")
            return {"ok": True}

        with patch.object(real_integrations, "_resolve_retry_delay_seconds", return_value=0.123) as delay_mock:
            with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
                result = await real_integrations._retry_with_backoff(
                    _operation,
                    max_attempts=2,
                    base_delay_seconds=0.01,
                    max_delay_seconds=0.5,
                    jitter_seconds=0.1,
                )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(state["attempts"], 2)
        delay_mock.assert_called_once()
        sleep_mock.assert_awaited_once_with(0.123)

    async def test_retry_with_backoff_emits_retry_observability_payload(self):
        state = {"attempts": 0}

        async def _operation():
            state["attempts"] += 1
            if state["attempts"] == 1:
                raise Exception("503 temporarily unavailable")
            return {"ok": True}

        retry_callback = AsyncMock(return_value=None)
        with patch.object(real_integrations, "_resolve_retry_delay_seconds", return_value=0.25):
            with patch.object(real_integrations, "_log_integration_event") as log_mock:
                with patch.object(real_integrations.asyncio, "sleep", AsyncMock(return_value=None)) as sleep_mock:
                    result = await real_integrations._retry_with_backoff(
                        _operation,
                        max_attempts=3,
                        base_delay_seconds=0.01,
                        operation_name="sendgrid_send_email",
                        provider="sendgrid",
                        request_id="req-retry-42",
                        on_retry_attempt=retry_callback,
                    )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(state["attempts"], 2)
        sleep_mock.assert_awaited_once_with(0.25)
        log_mock.assert_called_once()
        log_args, log_kwargs = log_mock.call_args
        self.assertEqual(log_args[0], "integrations_retry_attempt")
        self.assertEqual(log_args[1]["operation"], "sendgrid_send_email")
        self.assertEqual(log_args[1]["provider"], "sendgrid")
        self.assertEqual(log_args[1]["attempt"], 1)
        self.assertEqual(log_args[1]["max_attempts"], 3)
        self.assertEqual(log_args[1]["next_delay_seconds"], 0.25)
        self.assertEqual(log_kwargs["request_id"], "req-retry-42")
        retry_callback.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
