from __future__ import annotations

import logging
import re

import httpx

from engine.tools.base import IntegrationTool, ToolAction

logger = logging.getLogger(__name__)

ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def _render_template(template: str, variables: dict) -> str:
    """Replace ``{{key}}`` placeholders with values from *variables*."""
    def _replacer(match: re.Match) -> str:
        key = match.group(1).strip()
        return str(variables.get(key, match.group(0)))

    return re.sub(r"\{\{(.+?)\}\}", _replacer, template)


def _render_dict(d: dict, variables: dict) -> dict:
    """Recursively render template variables in a dict's string values."""
    rendered: dict = {}
    for key, value in d.items():
        if isinstance(value, str):
            rendered[key] = _render_template(value, variables)
        elif isinstance(value, dict):
            rendered[key] = _render_dict(value, variables)
        else:
            rendered[key] = value
    return rendered


class HttpRequestTool(IntegrationTool):
    """Generic HTTP request tool for calling external APIs."""

    name = "http_request"
    description = "Make custom HTTP requests (GET, POST, PUT, PATCH, DELETE) to any URL."
    actions = [
        ToolAction(
            name="request",
            description="Send an HTTP request.",
            parameters={
                "url": "Request URL (supports {{var}} templates)",
                "method": "HTTP method (GET/POST/PUT/PATCH/DELETE)",
                "headers": "Optional headers dict (supports {{var}} templates)",
                "body": "Optional JSON body (supports {{var}} templates)",
                "response_mapping": "Optional dict mapping response JSON paths to output keys",
            },
        ),
    ]

    async def execute(
        self,
        action: str,
        params: dict,
        credentials: dict,
    ) -> dict:
        self.validate_action(action)

        if action == "request":
            return await self._request(params, credentials)

        raise ValueError(f"Unhandled action: {action}")

    async def _request(self, params: dict, credentials: dict) -> dict:
        variables = credentials.get("variables", {})

        method = params.get("method", "GET").upper()
        if method not in ALLOWED_METHODS:
            return {"success": False, "error": f"Method '{method}' not allowed"}

        url = _render_template(params.get("url", ""), variables)
        headers = _render_dict(params.get("headers", {}), variables)
        body = params.get("body")
        if isinstance(body, dict):
            body = _render_dict(body, variables)
        elif isinstance(body, str):
            body = _render_template(body, variables)

        # Inject auth header if credentials provide one
        if "auth_header" in credentials:
            headers.setdefault("Authorization", credentials["auth_header"])

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request(
                method,
                url,
                headers=headers,
                json=body if isinstance(body, dict) else None,
                content=body if isinstance(body, str) else None,
            )

        # Try to parse response as JSON
        try:
            response_json = resp.json()
        except Exception:
            response_json = None

        result: dict = {
            "success": resp.is_success,
            "status_code": resp.status_code,
            "response_body": response_json if response_json is not None else resp.text[:4000],
        }

        # Apply response mapping
        response_mapping = params.get("response_mapping")
        if response_mapping and isinstance(response_json, dict):
            mapped: dict = {}
            for output_key, json_path in response_mapping.items():
                mapped[output_key] = _extract_path(response_json, json_path)
            result["mapped"] = mapped

        return result


def _extract_path(data: dict, path: str):
    """Extract a value from a nested dict using dot notation (e.g. ``a.b.0.c``)."""
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (IndexError, ValueError):
                return None
        else:
            return None
    return current
