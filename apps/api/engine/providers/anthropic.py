from __future__ import annotations

import logging

import httpx

from engine.providers.base import EmbeddingResponse, LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# Cost per 1K tokens (input, output) by model
ANTHROPIC_PRICING: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-5-20250929": (0.003, 0.015),
    "claude-haiku-4-5-20251001": (0.0008, 0.004),
}

ANTHROPIC_API_URL = "https://api.anthropic.com/v1"
ANTHROPIC_API_VERSION = "2023-06-01"


def _convert_messages_to_anthropic(
    messages: list[dict],
) -> tuple[str | None, list[dict]]:
    """Convert OpenAI-style messages to Anthropic format.

    Extracts system message and reformats the rest.
    """
    system_prompt = None
    anthropic_messages = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            system_prompt = content
        elif role == "assistant":
            anthropic_messages.append({"role": "assistant", "content": content})
        else:
            anthropic_messages.append({"role": "user", "content": content})

    return system_prompt, anthropic_messages


def _convert_tools_to_anthropic(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-style tool definitions to Anthropic format."""
    anthropic_tools = []
    for tool in tools:
        if tool.get("type") == "function":
            fn = tool["function"]
            anthropic_tools.append(
                {
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {}),
                }
            )
    return anthropic_tools


class AnthropicProvider(LLMProvider):
    """Anthropic provider using raw httpx -- no SDK dependency."""

    def __init__(self, api_key: str, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=ANTHROPIC_API_URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_API_VERSION,
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        model: str = "claude-sonnet-4-5-20250929",
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        system_prompt, anthropic_messages = _convert_messages_to_anthropic(messages)

        payload: dict = {
            "model": model,
            "messages": anthropic_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system_prompt:
            payload["system"] = system_prompt
        if tools:
            payload["tools"] = _convert_tools_to_anthropic(tools)

        resp = await self._client.post("/messages", json=payload)
        resp.raise_for_status()
        data = resp.json()

        usage = data.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        # Extract content and tool_calls from Anthropic response blocks
        content_parts: list[str] = []
        tool_calls: list[dict] | None = None

        for block in data.get("content", []):
            if block["type"] == "text":
                content_parts.append(block["text"])
            elif block["type"] == "tool_use":
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append(
                    {
                        "id": block["id"],
                        "type": "function",
                        "function": {
                            "name": block["name"],
                            "arguments": block["input"],
                        },
                    }
                )

        return LLMResponse(
            content="\n".join(content_parts),
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            cost=self.estimate_cost(input_tokens, output_tokens, model),
        )

    async def embed(
        self,
        texts: list[str],
        model: str = "text-embedding-3-small",
    ) -> EmbeddingResponse:
        raise NotImplementedError(
            "Anthropic does not provide an embedding API. "
            "Use OpenAI or another provider for embeddings."
        )

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        pricing = ANTHROPIC_PRICING.get(model, ANTHROPIC_PRICING["claude-sonnet-4-5-20250929"])
        input_cost = (input_tokens / 1000) * pricing[0]
        output_cost = (output_tokens / 1000) * pricing[1]
        return round(input_cost + output_cost, 8)

    async def close(self) -> None:
        await self._client.aclose()
