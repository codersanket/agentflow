from __future__ import annotations

import logging

import httpx

from engine.providers.base import EmbeddingResponse, LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# Cost per 1K tokens (input, output) by model
OPENAI_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (0.0025, 0.010),
    "gpt-4o-mini": (0.000150, 0.000600),
    "text-embedding-3-small": (0.00002, 0.0),
    "text-embedding-3-large": (0.00013, 0.0),
}

OPENAI_API_URL = "https://api.openai.com/v1"


class OpenAIProvider(LLMProvider):
    """OpenAI provider using raw httpx — no SDK dependency."""

    def __init__(self, api_key: str, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        payload: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools

        resp = await self._client.post("/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()

        choice = data["choices"][0]["message"]
        usage = data.get("usage", {})

        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        tool_calls = None
        if choice.get("tool_calls"):
            tool_calls = [
                {
                    "id": tc["id"],
                    "type": tc["type"],
                    "function": {
                        "name": tc["function"]["name"],
                        "arguments": tc["function"]["arguments"],
                    },
                }
                for tc in choice["tool_calls"]
            ]

        return LLMResponse(
            content=choice.get("content") or "",
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
        payload = {
            "model": model,
            "input": texts,
        }

        resp = await self._client.post("/embeddings", json=payload)
        resp.raise_for_status()
        data = resp.json()

        embeddings = [item["embedding"] for item in data["data"]]
        input_tokens = data.get("usage", {}).get("total_tokens", 0)

        return EmbeddingResponse(
            embeddings=embeddings,
            input_tokens=input_tokens,
            model=model,
            cost=self.estimate_cost(input_tokens, 0, model),
        )

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        pricing = OPENAI_PRICING.get(model, OPENAI_PRICING["gpt-4o"])
        input_cost = (input_tokens / 1000) * pricing[0]
        output_cost = (output_tokens / 1000) * pricing[1]
        return round(input_cost + output_cost, 8)

    async def close(self) -> None:
        await self._client.aclose()
