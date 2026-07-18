"""Local, secret-free checks for the Agentverse bridge helpers and fallback."""

import os
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.agentverse import (
    GENERIC_FAILURE,
    MAX_QUERY_CHARS,
    _extract_upstream_text,
    _normalize_query,
    app,
)


def test_query_is_trimmed_and_bounded() -> None:
    assert _normalize_query("  hello  ") == "hello"
    assert len(_normalize_query("x" * (MAX_QUERY_CHARS + 10))) == MAX_QUERY_CHARS


def test_only_text_summary_is_returned() -> None:
    payload = {
        "result": {
            "parts": [
                {"kind": "data", "data": {"private": "ignored"}},
                {"kind": "text", "text": "  Three candidates found.  "},
            ]
        }
    }
    assert _extract_upstream_text(payload) == "Three candidates found."


def test_malformed_upstream_is_generic() -> None:
    assert _extract_upstream_text({"error": {"message": "secret detail"}}) == GENERIC_FAILURE


def test_unconfigured_bridge_fails_closed() -> None:
    client = TestClient(app)
    health = client.get("/api/agentverse")
    assert health.status_code == 200
    assert health.json()["configured"] is False

    response = client.post("/api/agentverse", json={})
    assert response.status_code == 503


def test_configured_bridge_uses_verified_sdk_route() -> None:
    """Exercise the SDK monkey-patch without contacting Agentverse.

    This catches a subtle import-order regression: binding create_jsonrpc_routes
    before agentverse_init runs leaves the original factory in place, so the
    signed /av/chat handler is never added even though configuration exists.
    """

    code = r"""
import os
os.environ["AGENTVERSE_AGENT_URI"] = "https://test-handle:test-key@localhost/Test-Agent"

import agentverse_sdk.a2a._app as sdk_app
captured = {}
def capture_registration(request, *args, **kwargs):
    captured["chat_url"] = request.url
sdk_app.register_to_agentverse_sync = capture_registration

from fastapi.testclient import TestClient
from api.agentverse import app

client = TestClient(app)
health = client.get("/api/agentverse")
assert health.status_code == 200
assert health.json()["configured"] is True
assert captured["chat_url"] == "https://agentreputation.dev/av/chat"

# Unsigned traffic must reach the SDK handler and fail envelope validation.
response = client.post("/api/agentverse", json={})
assert response.status_code == 400, response.text
"""
    env = os.environ.copy()
    env.pop("AGENTVERSE_AGENT_URI", None)
    subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        check=True,
    )


def test_import_does_not_write_vendor_log() -> None:
    log_path = Path(__file__).resolve().parents[1] / "uagents_core.log"
    log_path.unlink(missing_ok=True)

    code = "import api.agentverse"
    env = os.environ.copy()
    env.pop("AGENTVERSE_AGENT_URI", None)
    subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        check=True,
    )
    assert not log_path.exists()


if __name__ == "__main__":
    test_query_is_trimmed_and_bounded()
    test_only_text_summary_is_returned()
    test_malformed_upstream_is_generic()
    test_unconfigured_bridge_fails_closed()
    test_configured_bridge_uses_verified_sdk_route()
    test_import_does_not_write_vendor_log()
    print("Agentverse bridge checks passed")
