from __future__ import annotations

import logging
import smtplib
from email.mime.text import MIMEText
from typing import Any

import httpx

from engine.handlers.base import NodeHandler, NodeOutput
from engine.variable_resolver import resolve_value

logger = logging.getLogger(__name__)


class ActionNodeHandler(NodeHandler):
    """Handles external actions: HTTP requests, webhook calls, Slack, email."""

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        action_type = config.get("action_type", "http_request")

        if action_type == "http_request":
            return await self._http_request(config, context)
        elif action_type == "webhook":
            return await self._webhook(config, context)
        elif action_type == "slack_send_message":
            return await self._slack_send_message(config, context)
        elif action_type == "slack_read_messages":
            return await self._slack_read_messages(config, context)
        elif action_type == "send_email":
            return await self._send_email(config, context)
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

    async def _slack_send_message(
        self, config: dict[str, Any], context: dict[str, Any]
    ) -> NodeOutput:
        """Send a message to a Slack channel using the org's Slack integration."""
        channel = resolve_value(config.get("channel", ""), context)
        text = resolve_value(config.get("text", ""), context)

        # Get Slack credentials from context (loaded by orchestrator)
        integrations = context.get("integrations", {})
        slack_creds = integrations.get("slack", {})
        token = slack_creds.get("bot_token") or slack_creds.get("access_token", "")

        if not token:
            return NodeOutput(
                data={"success": False, "error": "No Slack integration configured"},
            )

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {token}"},
                json={"channel": channel, "text": text},
            )
            data = resp.json()

        if not data.get("ok"):
            error = data.get("error", "unknown_error")
            logger.error("Slack send_message failed: %s", error)
            return NodeOutput(data={"success": False, "error": error})

        return NodeOutput(
            data={
                "success": True,
                "channel": data.get("channel"),
                "ts": data.get("ts"),
                "message": text,
            },
        )

    async def _slack_read_messages(
        self, config: dict[str, Any], context: dict[str, Any]
    ) -> NodeOutput:
        """Read recent messages from a Slack channel."""
        channel = resolve_value(config.get("channel", ""), context)
        limit = config.get("limit", 10)

        integrations = context.get("integrations", {})
        slack_creds = integrations.get("slack", {})
        token = slack_creds.get("bot_token") or slack_creds.get("access_token", "")

        if not token:
            return NodeOutput(
                data={"success": False, "error": "No Slack integration configured"},
            )

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://slack.com/api/conversations.history",
                headers={"Authorization": f"Bearer {token}"},
                params={"channel": channel, "limit": str(limit)},
            )
            data = resp.json()

        if not data.get("ok"):
            return NodeOutput(
                data={"success": False, "error": data.get("error", "unknown_error")},
            )

        messages = [
            {"user": m.get("user"), "text": m.get("text"), "ts": m.get("ts")}
            for m in data.get("messages", [])
        ]
        return NodeOutput(data={"success": True, "messages": messages})

    async def _send_email(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Send an email via SMTP (or org's email integration)."""
        to = resolve_value(config.get("to", ""), context)
        subject = resolve_value(config.get("subject", ""), context)
        body = resolve_value(config.get("body", ""), context)

        # Try org email integration first, fallback to SMTP config
        integrations = context.get("integrations", {})
        email_creds = integrations.get("email", integrations.get("gmail", {}))

        smtp_host = email_creds.get("smtp_host", "smtp.gmail.com")
        smtp_port = int(email_creds.get("smtp_port", 587))
        smtp_user = email_creds.get("smtp_user", email_creds.get("email", ""))
        smtp_pass = email_creds.get("smtp_password", email_creds.get("access_token", ""))
        from_addr = email_creds.get("from", smtp_user)

        if not smtp_user or not smtp_pass:
            return NodeOutput(
                data={"success": False, "error": "No email integration configured"},
            )

        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = from_addr
            msg["To"] = to

            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            return NodeOutput(
                data={"success": True, "to": to, "subject": subject},
            )
        except Exception as exc:
            logger.error("Email send failed: %s", exc)
            return NodeOutput(
                data={"success": False, "error": str(exc)},
            )
