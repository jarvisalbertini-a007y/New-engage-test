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

    fastapi_stub.APIRouter = _APIRouter
    fastapi_stub.HTTPException = _HTTPException
    fastapi_stub.Depends = _depends
    fastapi_stub.BackgroundTasks = _BackgroundTasks
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


if __name__ == "__main__":
    unittest.main()
