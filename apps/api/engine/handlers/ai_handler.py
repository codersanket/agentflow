from __future__ import annotations

from typing import Any

from engine.handlers.base import NodeHandler, NodeOutput
from engine.providers.router import ProviderRouter
from engine.variable_resolver import resolve_value


class AINodeHandler(NodeHandler):
    """Handles LLM calls: chat, summarize, classify, extract."""

    def __init__(self, provider_router: ProviderRouter) -> None:
        self._router = provider_router

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        messages = self._build_messages(config, context)
        model = config.get("model", "gpt-4o")
        tools = config.get("tools")
        temperature = config.get("temperature", 0.7)
        max_tokens = config.get("max_tokens", 4096)

        response = await self._router.chat(
            messages=messages,
            model=model,
            tools=tools,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return NodeOutput(
            data={"text": response.content, "tool_calls": response.tool_calls},
            tokens_used=response.input_tokens + response.output_tokens,
            cost=response.cost,
        )

    def _build_messages(self, config: dict[str, Any], context: dict[str, Any]) -> list[dict]:
        """Build the messages array from node config, resolving templates."""
        raw_messages = config.get("messages", [])
        if not raw_messages:
            # Fallback: single prompt field
            prompt = config.get("prompt", "")
            system = config.get("system_prompt")
            resolved_prompt = resolve_value(prompt, context)
            msgs: list[dict] = []
            if system:
                msgs.append({"role": "system", "content": resolve_value(system, context)})
            msgs.append({"role": "user", "content": resolved_prompt})
            return msgs

        return [
            {
                "role": msg.get("role", "user"),
                "content": resolve_value(msg.get("content", ""), context),
            }
            for msg in raw_messages
        ]
