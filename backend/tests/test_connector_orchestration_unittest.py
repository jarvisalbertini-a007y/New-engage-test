import unittest
import types
import sys
from unittest.mock import AsyncMock, patch


try:
    import fastapi as _fastapi  # noqa: F401
except Exception:
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
        headers = {}

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


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []

    async def find_one(self, *_args, **_kwargs):
        return self.seed_doc

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integration_doc=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc or {})
        self.company_research = _FakeCollection()
        self.integration_telemetry = _FakeCollection()


class ConnectorOrchestrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.current_user = {"id": "u-test", "email": "user@example.com"}
        real_integrations._reset_connector_rate_limit_state()

    def test_normalize_apollo_company_results(self):
        payload = {
            "organizations": [
                {
                    "name": "GrowthOps",
                    "website_url": "https://www.growthops.ai",
                    "industry": "SaaS",
                    "estimated_num_employees": 72,
                    "city": "San Francisco",
                    "country": "US",
                },
                {
                    "organization": {
                        "name": "PipelineIQ",
                        "primary_domain": "pipelineiq.com",
                        "latest_funding_stage": "Series B",
                    }
                },
            ]
        }
        companies = real_integrations._normalize_apollo_company_results(payload, max_items=5)
        self.assertEqual(len(companies), 2)
        self.assertEqual(companies[0]["domain"], "growthops.ai")
        self.assertEqual(companies[0]["source"], "apollo")
        self.assertEqual(companies[1]["fundingStage"], "Series B")

    def test_normalize_provider_order_with_diagnostics(self):
        order, diagnostics = real_integrations._normalize_provider_order_with_diagnostics(
            ["clearbit", "clearbit", "apollo", "unknown", "crunchbase", "unknown"]
        )
        self.assertEqual(order, ["clearbit", "apollo", "crunchbase"])
        self.assertEqual(diagnostics["duplicatesRemoved"], ["clearbit"])
        self.assertEqual(diagnostics["ignoredProviders"], ["unknown"])
        self.assertFalse(diagnostics["defaultApplied"])

    def test_normalize_provider_order_with_diagnostics_defaults(self):
        order, diagnostics = real_integrations._normalize_provider_order_with_diagnostics(
            ["invalid-provider"]
        )
        self.assertEqual(order, ["clearbit", "apollo", "crunchbase"])
        self.assertTrue(diagnostics["defaultApplied"])
        self.assertEqual(diagnostics["ignoredProviders"], ["invalid-provider"])

    async def test_orchestration_requires_feature_flag(self):
        with patch.dict("os.environ", {"ENABLE_CONNECTOR_ORCHESTRATION": "false"}, clear=False):
            with self.assertRaises(real_integrations.HTTPException) as exc:
                await real_integrations.enrich_company_with_fallback(
                    {"domain": "growthops.ai"},
                    current_user=self.current_user,
                )
            self.assertEqual(exc.exception.status_code, 403)

    async def test_orchestration_stops_on_first_success(self):
        fake_db = _FakeDb()
        clearbit_result = {
            "success": True,
            "provider": "clearbit",
            "found": True,
            "company": {"name": "GrowthOps", "domain": "growthops.ai", "source": "clearbit"},
        }

        with patch.dict("os.environ", {"ENABLE_CONNECTOR_ORCHESTRATION": "true"}, clear=False):
            with patch.object(real_integrations, "get_db", return_value=fake_db):
                with patch.object(
                    real_integrations, "_record_integration_event", AsyncMock(return_value=None)
                ):
                    with patch.object(
                        real_integrations,
                        "clearbit_enrich_company",
                        AsyncMock(return_value=clearbit_result),
                    ) as clearbit_mock:
                        with patch.object(
                            real_integrations,
                            "apollo_enrich_company",
                            AsyncMock(return_value={"companies": []}),
                        ) as apollo_mock:
                            with patch.object(
                                real_integrations,
                                "crunchbase_enrich_company",
                                AsyncMock(return_value={"companies": []}),
                            ) as crunchbase_mock:
                                response = await real_integrations.enrich_company_with_fallback(
                                    {
                                        "domain": "growthops.ai",
                                        "providerOrder": [
                                            "clearbit",
                                            "clearbit",
                                            "apollo",
                                            "bad-provider",
                                        ],
                                    },
                                    current_user=self.current_user,
                                )

        self.assertTrue(response["found"])
        self.assertEqual(response["selectedProvider"], "clearbit")
        self.assertEqual(response["resultCount"], 1)
        self.assertEqual(response["attemptSummary"]["total"], 1)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["success"], 1)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["skipped"], 0)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["error"], 0)
        self.assertEqual(response["attemptSummary"]["reasonCodeCounts"]["success"], 1)
        self.assertEqual(response["attemptSummary"]["providersAttempted"], ["clearbit"])
        self.assertEqual(response["attemptSummary"]["providersWithResults"], ["clearbit"])
        self.assertEqual(response["attemptSummary"]["providersWithoutResults"], [])
        self.assertEqual(
            response["criteria"]["providerOrderDiagnostics"]["duplicatesRemoved"],
            ["clearbit"],
        )
        self.assertEqual(
            response["criteria"]["providerOrderDiagnostics"]["ignoredProviders"],
            ["bad-provider"],
        )
        self.assertEqual(response["attempts"][0]["reasonCode"], "success")
        self.assertGreaterEqual(response["attempts"][0]["latencyMs"], 0)
        clearbit_mock.assert_awaited_once()
        apollo_mock.assert_not_awaited()
        crunchbase_mock.assert_not_awaited()

    async def test_orchestration_skips_clearbit_without_domain(self):
        fake_db = _FakeDb()
        apollo_result = {
            "success": True,
            "provider": "apollo",
            "companies": [{"name": "SignalForge", "domain": "signalforge.io", "source": "apollo"}],
            "resultCount": 1,
        }

        with patch.dict("os.environ", {"ENABLE_CONNECTOR_ORCHESTRATION": "true"}, clear=False):
            with patch.object(real_integrations, "get_db", return_value=fake_db):
                with patch.object(
                    real_integrations, "_record_integration_event", AsyncMock(return_value=None)
                ):
                    with patch.object(
                        real_integrations,
                        "apollo_enrich_company",
                        AsyncMock(return_value=apollo_result),
                    ) as apollo_mock:
                        response = await real_integrations.enrich_company_with_fallback(
                            {"companyName": "SignalForge", "providerOrder": ["clearbit", "apollo"]},
                            current_user=self.current_user,
                        )

        self.assertTrue(response["found"])
        self.assertEqual(response["selectedProvider"], "apollo")
        self.assertEqual(response["resultCount"], 1)
        self.assertEqual(response["attemptSummary"]["total"], 2)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["success"], 1)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["skipped"], 1)
        self.assertEqual(response["attemptSummary"]["statusCounts"]["error"], 0)
        self.assertEqual(response["attemptSummary"]["reasonCodeCounts"]["domain_required"], 1)
        self.assertEqual(response["attemptSummary"]["reasonCodeCounts"]["success"], 1)
        self.assertEqual(
            response["attemptSummary"]["providersAttempted"],
            ["clearbit", "apollo"],
        )
        self.assertEqual(response["attemptSummary"]["providersWithResults"], ["apollo"])
        self.assertEqual(response["attemptSummary"]["providersWithoutResults"], [])
        self.assertEqual(response["attempts"][0]["provider"], "clearbit")
        self.assertEqual(response["attempts"][0]["status"], "skipped")
        self.assertEqual(response["attempts"][0]["reason"], "domain_required")
        self.assertEqual(response["attempts"][0]["reasonCode"], "domain_required")
        self.assertGreaterEqual(response["attempts"][0]["latencyMs"], 0)
        apollo_mock.assert_awaited_once()

    async def test_apollo_company_enrichment_persists_results(self):
        fake_db = _FakeDb(integration_doc={"apollo_api_key": "apollo-token"})
        provider_payload = {
            "organizations": [
                {
                    "name": "PipelineIQ",
                    "website_url": "https://pipelineiq.com",
                    "industry": "Sales Automation",
                    "estimated_num_employees": 120,
                }
            ]
        }

        with patch.dict("os.environ", {"ENABLE_APOLLO_CONNECTOR": "true"}, clear=False):
            with patch.object(real_integrations, "get_db", return_value=fake_db):
                with patch.object(
                    real_integrations,
                    "_provider_request_json",
                    AsyncMock(return_value=provider_payload),
                ):
                    with patch.object(
                        real_integrations, "_record_integration_event", AsyncMock(return_value=None)
                    ):
                        response = await real_integrations.apollo_enrich_company(
                            {"domain": "pipelineiq.com", "saveResearch": True, "limit": 5},
                            current_user=self.current_user,
                        )

        self.assertTrue(response["success"])
        self.assertEqual(response["provider"], "apollo")
        self.assertEqual(response["resultCount"], 1)
        self.assertEqual(response["savedCount"], 1)
        self.assertEqual(len(fake_db.company_research.inserted), 1)


if __name__ == "__main__":
    unittest.main()
