from __future__ import annotations

import logging

import httpx

from engine.tools.base import IntegrationTool, ToolAction

logger = logging.getLogger(__name__)

SLACK_API_BASE = "https://slack.com/api"


class SlackTool(IntegrationTool):
    """Slack integration via the Slack Web API."""

    name = "slack"
    description = "Send messages, list channels, and read messages in Slack."
    actions = [
        ToolAction(
            name="send_message",
            description="Send a message to a Slack channel.",
            parameters={"channel": "Channel name or ID", "text": "Message text"},
        ),
        ToolAction(
            name="list_channels",
            description="List public channels in the workspace.",
            parameters={},
        ),
        ToolAction(
            name="read_messages",
            description="Read recent messages from a channel.",
            parameters={"channel": "Channel name or ID", "limit": "Number of messages (default 10)"},
        ),
    ]

    async def execute(
        self,
        action: str,
        params: dict,
        credentials: dict,
    ) -> dict:
        self.validate_action(action)
        token = credentials.get("bot_token") or credentials.get("access_token", "")

        if action == "send_message":
            return await self._send_message(token, params)
        elif action == "list_channels":
            return await self._list_channels(token)
        elif action == "read_messages":
            return await self._read_messages(token, params)

        raise ValueError(f"Unhandled action: {action}")

    async def _send_message(self, token: str, params: dict) -> dict:
        channel = params.get("channel", "")
        text = params.get("text", "")

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{SLACK_API_BASE}/chat.postMessage",
                headers={"Authorization": f"Bearer {token}"},
                json={"channel": channel, "text": text},
            )
            data = resp.json()

        if not data.get("ok"):
            error = data.get("error", "unknown_error")
            logger.error("Slack send_message failed: %s", error)
            return {"success": False, "error": error}

        return {
            "success": True,
            "channel": data.get("channel"),
            "ts": data.get("ts"),
            "message": text,
        }

    async def _list_channels(self, token: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{SLACK_API_BASE}/conversations.list",
                headers={"Authorization": f"Bearer {token}"},
                params={"types": "public_channel", "limit": "100"},
            )
            data = resp.json()

        if not data.get("ok"):
            return {"success": False, "error": data.get("error", "unknown_error")}

        channels = [
            {"id": ch["id"], "name": ch["name"]}
            for ch in data.get("channels", [])
        ]
        return {"success": True, "channels": channels}

    async def _read_messages(self, token: str, params: dict) -> dict:
        channel = params.get("channel", "")
        limit = int(params.get("limit", 10))

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{SLACK_API_BASE}/conversations.history",
                headers={"Authorization": f"Bearer {token}"},
                params={"channel": channel, "limit": str(limit)},
            )
            data = resp.json()

        if not data.get("ok"):
            return {"success": False, "error": data.get("error", "unknown_error")}

        messages = [
            {"user": m.get("user"), "text": m.get("text"), "ts": m.get("ts")}
            for m in data.get("messages", [])
        ]
        return {"success": True, "messages": messages}
