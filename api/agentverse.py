"""Consent-safe Agentverse bridge for the existing Agent Reputation A2A agent.

Agentverse speaks its signed Agent Chat Protocol to ``/av/chat``. The official
SDK verifies that envelope, then hands the user text to this read-only A2A
executor. The executor forwards plain text only to Agent Reputation's existing
A2A endpoint, so Agentverse can discover agents but cannot invoke authenticated
writes or bypass owner-token consent controls.
"""

from __future__ import annotations

import os
from uuid import uuid4

import a2a.server.routes as a2a_routes
import httpx
from a2a.helpers.proto_helpers import new_text_message
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import add_a2a_routes_to_fastapi
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentInterface,
    AgentProvider,
    AgentSkill,
)

# uagents-core 0.4.8 creates ``uagents_core.log`` in the current directory by
# default. Vercel Functions have a read-only code filesystem, so replace that
# default before importing Agentverse. Logs still go to stdout/Vercel logs.
from uagents_core import logger as uagents_logger

_original_uagents_get_logger = uagents_logger.get_logger


def _stdout_uagents_logger(logger_name=None, level=20, log_file=None):
    return _original_uagents_get_logger(logger_name, level, log_file=None)


uagents_logger.get_logger = _stdout_uagents_logger

from agentverse_sdk.a2a import init as agentverse_init
from fastapi import FastAPI
from fastapi.responses import JSONResponse


PUBLIC_BASE_URL = "https://agentreputation.dev"
UPSTREAM_A2A_URL = os.environ.get(
    "AGENT_REPUTATION_A2A_URL", f"{PUBLIC_BASE_URL}/api/a2a"
)
AGENTVERSE_AGENT_URI = os.environ.get("AGENTVERSE_AGENT_URI")
MAX_QUERY_CHARS = 2_000
MAX_RESPONSE_CHARS = 4_000

GENERIC_FAILURE = (
    "Agent Reputation could not complete this discovery request. "
    "Retry later or use the public MCP endpoint at "
    "https://agentreputation.dev/api/mcp."
)


def _normalize_query(value: str) -> str:
    """Keep Agentverse input inert, bounded and suitable for semantic search."""

    return value.strip()[:MAX_QUERY_CHARS]


def _extract_upstream_text(payload: object) -> str:
    """Return only the public text summary from an A2A JSON-RPC response."""

    if not isinstance(payload, dict):
        return GENERIC_FAILURE

    result = payload.get("result")
    if not isinstance(result, dict):
        return GENERIC_FAILURE

    parts = result.get("parts")
    if not isinstance(parts, list):
        return GENERIC_FAILURE

    for part in parts:
        if (
            isinstance(part, dict)
            and part.get("kind") == "text"
            and isinstance(part.get("text"), str)
        ):
            text = part["text"].strip()
            if text:
                return text[:MAX_RESPONSE_CHARS]

    return GENERIC_FAILURE


async def _forward_discovery(query: str) -> str:
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid4()),
        "method": "message/send",
        "params": {
            "message": {
                "kind": "message",
                "role": "user",
                "messageId": str(uuid4()),
                # A text part can only trigger semantic discovery in /api/a2a.
                # Structured writes require a DataPart and are intentionally
                # impossible through this bridge.
                "parts": [{"kind": "text", "text": query}],
            },
            "configuration": {
                "blocking": True,
                "acceptedOutputModes": ["text/plain"],
            },
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                UPSTREAM_A2A_URL,
                json=payload,
                headers={"User-Agent": "Agent-Reputation-Agentverse-Bridge/1.0"},
            )
            response.raise_for_status()
            return _extract_upstream_text(response.json())
    except (httpx.HTTPError, ValueError):
        # Never reflect infrastructure details or upstream bodies to an
        # untrusted external sender.
        return GENERIC_FAILURE


class AgentReputationExecutor(AgentExecutor):
    async def execute(
        self, context: RequestContext, event_queue: EventQueue
    ) -> None:
        query = _normalize_query(context.get_user_input())
        if not query:
            reply = (
                "Describe the capability you need. Agent Reputation will search "
                "its agent and MCP-server directory by meaning."
            )
        else:
            reply = await _forward_discovery(query)

        await event_queue.enqueue_event(
            new_text_message(reply, context_id=context.context_id)
        )

    async def cancel(
        self, context: RequestContext, event_queue: EventQueue
    ) -> None:
        raise RuntimeError("Cancellation is not supported for synchronous discovery.")


agent_card = AgentCard(
    name="Agent Reputation",
    description=(
        "Find and vet autonomous AI agents and MCP servers. Native interaction "
        "ratings and imported signals remain visibly separate, and introductions "
        "use explicit consent."
    ),
    supported_interfaces=[
        AgentInterface(
            # Agentverse SDK 0.2.0 treats the interface URL as an application
            # base and appends /av/chat when it registers the delivery URL.
            # The public A2A card remains at /.well-known/agent-card.json and
            # correctly advertises /api/a2a; this adapter-only card must use
            # the public origin or Agentverse would register
            # /api/a2a/av/chat, which does not exist.
            url=PUBLIC_BASE_URL,
            protocol_binding="JSONRPC",
            protocol_version="1.0",
        )
    ],
    provider=AgentProvider(
        organization="Agent Reputation", url=PUBLIC_BASE_URL
    ),
    version="1.11.0",
    documentation_url=f"{PUBLIC_BASE_URL}/llms.txt",
    capabilities=AgentCapabilities(
        streaming=False,
        push_notifications=False,
    ),
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
    skills=[
        AgentSkill(
            id="find_agent",
            name="Find and vet agents",
            description=(
                "Semantic discovery over autonomous agents and MCP servers, with "
                "claimed status and provenance-separated reputation evidence."
            ),
            tags=["agent discovery", "reputation", "MCP", "A2A", "trust"],
            examples=[
                "Find an agent that reviews TypeScript security",
                "I need a reliable MCP server for PostgreSQL administration",
            ],
        )
    ],
)


# The SDK applies its route patches before A2A routes are created. Without the
# secret env var, local builds still import cleanly but the public bridge remains
# unavailable rather than accepting unsigned traffic.
if AGENTVERSE_AGENT_URI:
    agentverse_init(AGENTVERSE_AGENT_URI)

request_handler = DefaultRequestHandler(
    agent_executor=AgentReputationExecutor(),
    task_store=InMemoryTaskStore(),
    agent_card=agent_card,
)

# agentverse_init monkey-patches the route factory. Resolve it from the module
# only after initialisation; importing the function by value before init would
# keep the unpatched factory and silently omit the verified /av/chat route.
jsonrpc_routes = a2a_routes.create_jsonrpc_routes(
    request_handler,
    rpc_url="/api/agentverse/a2a",
    enable_v0_3_compat=True,
)

agentverse_chat_route = next(
    (route for route in jsonrpc_routes if getattr(route, "path", "") == "/av/chat"),
    None,
)

fastapi_app = FastAPI(
    title="Agent Reputation Agentverse Bridge",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
add_a2a_routes_to_fastapi(fastapi_app, jsonrpc_routes=jsonrpc_routes)


@fastapi_app.get("/api/agentverse")
async def bridge_health() -> JSONResponse:
    return JSONResponse(
        {
            "service": "Agent Reputation Agentverse bridge",
            "configured": bool(AGENTVERSE_AGENT_URI),
            "mode": "read-only semantic discovery",
        }
    )


if agentverse_chat_route is None:

    @fastapi_app.post("/api/agentverse")
    async def bridge_unconfigured() -> JSONResponse:
        return JSONResponse(
            {"error": "Agentverse bridge is not configured."}, status_code=503
        )


class _ChatPathAlias:
    """Serve POST /api/agentverse through the exact same ASGI path as /av/chat.

    Vercel rewrites public /av/chat to this root Python Function; depending on
    the platform routing layer, ASGI may see either the original or the
    destination path. Rewriting the destination path back to /av/chat at the
    scope level makes the aliased request traverse the identical SDK stack —
    routes AND any path-scoped verification — rather than re-mounting the
    endpoint on a second path where path-matched middleware would not apply.
    """

    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        if (
            scope.get("type") == "http"
            and scope.get("method") == "POST"
            and scope.get("path") == "/api/agentverse"
        ):
            scope = dict(scope)
            scope["path"] = "/av/chat"
            scope["raw_path"] = b"/av/chat"
        await self.asgi_app(scope, receive, send)


# Vercel detects an ASGI application exported as `app`. The alias only exists
# when the verified /av/chat route does: unconfigured deployments keep the
# explicit 503 handler instead of a silent 404.
app = _ChatPathAlias(fastapi_app) if agentverse_chat_route is not None else fastapi_app
