from __future__ import annotations

import logging
from typing import Any

import httpx

from engine.handlers.base import NodeHandler, NodeOutput
from engine.variable_resolver import resolve_value

logger = logging.getLogger(__name__)


class ActionNodeHandler(NodeHandler):
    """Handles external actions: HTTP requests, webhook calls."""

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        action_type = config.get("action_type", "http_request")

        if action_type == "http_request":
            return await self._http_request(config, context)
        elif action_type == "webhook":
            return await self._webhook(config, context)
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    async def _http_request(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Execute an HTTP request."""
        method = resolve_value(config.get("method", "GET"), context)
        url = resolve_value(config.get("url", ""), context)
        headers = resolve_value(config.get("headers", {}), context)
        body = resolve_value(config.get("body"), context)
        timeout = config.get("timeout", 30.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body if body else None,
            )

        try:
            response_data = response.json()
        except Exception:
            response_data = response.text

        return NodeOutput(
            data={
                "status_code": response.status_code,
                "body": response_data,
                "headers": dict(response.headers),
            },
        )

    async def _webhook(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Send a webhook POST request."""
        url = resolve_value(config.get("url", ""), context)
        payload = resolve_value(config.get("payload", {}), context)
        headers = resolve_value(config.get("headers", {}), context)
        timeout = config.get("timeout", 30.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url=url,
                json=payload,
                headers=headers,
            )

        try:
            response_data = response.json()
        except Exception:
            response_data = response.text

        return NodeOutput(
            data={
                "status_code": response.status_code,
                "body": response_data,
            },
        )
