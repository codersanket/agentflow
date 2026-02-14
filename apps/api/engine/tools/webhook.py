from __future__ import annotations

import logging
import re
import uuid

import httpx

from engine.tools.base import IntegrationTool, ToolAction

logger = logging.getLogger(__name__)


def _render_template(template: str, variables: dict) -> str:
    """Replace ``{{key}}`` placeholders in *template* with values from *variables*."""

    def _replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{(.+?)\}\}", _replacer, template)


class WebhookTool(IntegrationTool):
    """Webhook connector for incoming and outgoing webhooks."""

    name = "webhook"
    description = "Receive incoming webhooks or send outgoing HTTP webhooks."
    actions = [
        ToolAction(
            name="generate_url",
            description="Generate a unique webhook URL for an agent to receive payloads.",
            parameters={"agent_id": "The agent ID to bind the URL to"},
        ),
        ToolAction(
            name="send",
            description="Send an outgoing webhook POST to a user-defined URL.",
            parameters={
                "url": "Destination URL",
                "body": "JSON body (supports {{var}} template variables)",
                "headers": "Optional extra headers dict",
            },
        ),
        ToolAction(
            name="parse_payload",
            description="Parse an incoming webhook payload.",
            parameters={"raw_body": "Raw JSON string of the incoming payload"},
        ),
    ]

    async def execute(
        self,
        action: str,
        params: dict,
        credentials: dict,
    ) -> dict:
        self.validate_action(action)

        if action == "generate_url":
            return self._generate_url(params, credentials)
        elif action == "send":
            return await self._send(params, credentials)
        elif action == "parse_payload":
            return self._parse_payload(params)

        raise ValueError(f"Unhandled action: {action}")

    def _generate_url(self, params: dict, credentials: dict) -> dict:
        agent_id = params.get("agent_id", "unknown")
        token = str(uuid.uuid4())
        base_url = credentials.get("webhook_base_url", "https://hooks.agentflow.dev")
        url = f"{base_url}/webhook/{agent_id}/{token}"
        return {"success": True, "url": url, "token": token}

    async def _send(self, params: dict, credentials: dict) -> dict:
        url = params.get("url", "")
        body_template = params.get("body", {})
        extra_headers = params.get("headers", {})

        # Resolve template variables in body if it's a string
        variables = credentials.get("variables", {})
        if isinstance(body_template, str):
            body_template = _render_template(body_template, variables)

        headers = {"Content-Type": "application/json"}
        headers.update(extra_headers)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=body_template)

        return {
            "success": resp.is_success,
            "status_code": resp.status_code,
            "response_body": resp.text[:2000],
        }

    def _parse_payload(self, params: dict) -> dict:
        import json

        raw = params.get("raw_body", "{}")
        try:
            parsed = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            return {"success": False, "error": "Invalid JSON payload"}
        return {"success": True, "data": parsed}
