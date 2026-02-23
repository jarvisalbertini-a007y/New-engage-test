import io
import json
from contextlib import redirect_stdout

from routes import real_integrations


def test_log_integration_event_outputs_json_contract():
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        real_integrations._log_integration_event(
            "sendgrid_send_success",
            {
                "user_id": "u1",
                "send_id": "send-1",
                "status_code": 202,
                "latency_ms": 42.5,
                "api_key": "should-not-appear",
            },
        )
    output = buffer.getvalue().strip()
    payload = json.loads(output)
    assert payload["type"] == "integration_event"
    assert payload["event"] == "sendgrid_send_success"
    assert payload["user_id"] == "u1"
    assert payload["send_id"] == "send-1"
    assert payload["status_code"] == 202
    assert "timestamp" in payload
    assert payload["api_key"] == "[redacted]"


def test_log_integration_event_supports_error_payload():
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        real_integrations._log_integration_event(
            "sendgrid_send_error",
            {"user_id": "u2", "error": "timeout"},
        )
    output = buffer.getvalue().strip()
    payload = json.loads(output)
    assert payload["type"] == "integration_event"
    assert payload["event"] == "sendgrid_send_error"
    assert payload["user_id"] == "u2"
    assert payload["error"] == "timeout"


def test_log_integration_event_redacts_nested_sensitive_fields_and_masks_email():
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        real_integrations._log_integration_event(
            "connector_probe",
            {
                "user_id": "u3",
                "request_id": "req-contract-123",
                "to": "prospect@example.com",
                "auth": {
                    "authorization": "Bearer secret-token",
                    "token": "abc123",
                },
                "payload": {
                    "api_key": "secret-key",
                    "password": "secret-password",
                },
            },
        )
    output = buffer.getvalue().strip()
    payload = json.loads(output)
    assert payload["request_id"] == "req-contract-123"
    assert payload["to"] == "pr***@example.com"
    assert payload["auth"]["authorization"] == "[redacted]"
    assert payload["auth"]["token"] == "[redacted]"
    assert payload["payload"]["api_key"] == "[redacted]"
    assert payload["payload"]["password"] == "[redacted]"
