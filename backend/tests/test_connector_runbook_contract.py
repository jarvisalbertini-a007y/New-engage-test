from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_ENRICHMENT_RUNBOOK.md"
)


def _runbook_text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_runbook_includes_operations_and_verification_commands():
    content = _runbook_text()
    assert "## Operational Checklist" in content
    assert "## Verification Commands" in content
    assert "npm run verify:backend:sales:connectors:runtime" in content
    assert "npm run verify:smoke:connector-lookups" in content


def test_runbook_includes_connector_lookup_validation_steps():
    content = _runbook_text()
    assert "run one Company Enrichment lookup from the Connector Enrichment Sandbox" in content
    assert "run one Apollo Prospect Lookup from the same sandbox" in content
    assert "Validate result counts, selected provider, and top-record summaries" in content


def test_runbook_includes_slo_gate_review_step():
    content = _runbook_text()
    assert "Connector Rollout SLO Gate" in content
    assert "confirm decision/actions/signoff requirements align with telemetry" in content
    assert "Traceability Readiness" in content
    assert "schema coverage gate pass, schema sample gate pass" in content
    assert "Traceability Readiness` shows `NOT READY`" in content
    assert "remediation checklist items shown in the SLO card" in content


def test_runbook_includes_telemetry_refresh_and_snapshot_export_steps():
    content = _runbook_text()
    assert "Use Integrations UI telemetry controls to refresh the telemetry window and limit" in content
    assert "Export both telemetry and SLO JSON snapshots" in content


def test_runbook_includes_notice_dismiss_and_auto_clear_validation_step():
    content = _runbook_text()
    assert "notice banner can be dismissed" in content
    assert "stale notices clear automatically after a short interval" in content


def test_runbook_includes_combined_sales_smoke_command():
    content = _runbook_text()
    assert "npm run verify:smoke:sales" in content


def test_runbook_includes_rate_limit_and_provider_order_diagnostics_steps():
    content = _runbook_text()
    assert "responses include `rateLimit` metadata" in content
    assert "`providerOrderDiagnostics` in orchestration responses" in content
    assert "integrations_connector_rate_limited" in content
    assert "`Retry-After` response header" in content
    assert "`X-RateLimit-Limit`" in content
    assert "`X-RateLimit-Remaining`" in content
    assert "`X-RateLimit-Window-Seconds`" in content
    assert "`X-RateLimit-Reset-In-Seconds`" in content
    assert "`detail.errorCode=connector_rate_limited`" in content
    assert "`detail.retryAfterSeconds`" in content
    assert "`detail.rateLimit.limit|remaining|windowSeconds|resetInSeconds`" in content
    assert "Connector rate limit reached. Retry in <seconds>s." in content
    assert "`rateLimit.resetAt` payload field" in content
    assert "`rateLimit.resetInSeconds` payload field" in content
    assert "`X-RateLimit-Reset-At` response header" in content
    assert "`X-RateLimit-Reset-In-Seconds` response header" in content
    assert "Rate Limit Reset At" in content
    assert "Rate Limit Reset In" in content
    assert "test_integration_http_contract.py -k rate_limit_returns_429" in content
    assert "test_integration_http_contract.py -k http_apollo_search_success" in content
    assert "integrations_connector_input_validation_failed" in content


def test_runbook_includes_request_bounds_validation_and_quota_preservation_steps():
    content = _runbook_text()
    required_fragments = [
        "Validate request-bound guardrails return `400` with explicit messages",
        "Apollo prospect lookup: `limit` must be `1-100`, `page` must be `1-1000`",
        "Apollo company enrichment: `limit` must be `1-25`",
        "Crunchbase company enrichment: `limit` must be `1-25`",
        "Company enrichment orchestration: `limit` must be `1-25`",
        "Invalid <field>: expected integer between <min> and <max>",
        "Confirm invalid connector payloads do not consume throttling budget",
        "CONNECTOR_RATE_LIMIT_MAX_REQUESTS=1",
        "test_integration_http_contract.py -k invalid_limit_returns_400",
        "test_integration_http_contract.py -k invalid_page_returns_400",
        "test_integration_http_contract.py -k does_not_consume_rate_limit",
        "test_connector_endpoint_smoke.py -k invalid",
        "detail.errorCode=invalid_request_bounds",
        "detail.errorCode=invalid_request_required_field",
        "detail.field",
        "detail.min",
        "detail.max",
        "detail.reason",
        "detail.received",
        "connectorValidation.eventCount",
        "connectorValidation.byEndpoint",
        "connectorValidation.byProvider",
        "connectorValidation.byField",
        "connectorValidation.byReason",
        "connectorValidation.latestEventAt",
        "connectorValidationEndpoint",
        "connectorValidationField",
        "connectorValidationReason",
        "connectorValidationErrorCode",
        "connectorValidationReceived",
        "npm run verify:smoke:connector-input-validation",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_runbook_includes_orchestration_attempt_diagnostics_steps():
    content = _runbook_text()
    required_fragments = [
        "attemptSummary.total",
        "attemptSummary.statusCounts",
        "attemptSummary.reasonCodeCounts",
        "attemptSummary.providersAttempted",
        "attemptSummary.providersWithResults",
        "attemptSummary.providersWithoutResults",
        "attempts[]",
        "reasonCode",
        "latencyMs",
        "rateLimitRemaining",
        "rateLimitResetInSeconds",
        "company_enrichment_orchestrated",
        "attempt_success_count",
        "attempt_skipped_count",
        "attempt_error_count",
        "attempt_reason_codes",
        "orchestrationAudit.eventCount",
        "orchestrationAudit.bySelectedProvider",
        "orchestrationAudit.attemptStatusCounts",
        "orchestrationAudit.reasonCodeCounts",
        "orchestrationAudit.maxAttemptCount",
        "orchestrationAudit.avgAttemptCount",
        "orchestrationAudit.latestEventAt",
        "orchestrationSelectedProvider",
        "orchestrationAttemptCount",
        "orchestrationAttemptSuccessCount",
        "orchestrationAttemptSkippedCount",
        "orchestrationAttemptErrorCount",
        "orchestrationAttemptReasonCodes",
        "orchestrationResultCount",
        "test_integration_http_contract.py -k orchestration_audit_rollup",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_runbook_includes_storage_policy_validation_step():
    content = _runbook_text()
    assert "`storagePolicy` metadata" in content
    assert "storage-policy truncation contract" in content


def test_runbook_includes_connector_lookup_export_steps():
    content = _runbook_text()
    required_fragments = [
        "Export Company Lookup JSON",
        "Export Apollo Lookup JSON",
        "exportSchemaVersion",
        "exportRequestedProvider",
        "exportRequestedDomain",
        "exportRequestedLimit",
        "exportAttemptSummary",
        "exportProviderOrderDiagnostics",
        "exportRequestedQuery",
        "exportRequestedTitle",
        "exportRateLimit",
        "exportTopProspect",
    ]
    for fragment in required_fragments:
        assert fragment in content
