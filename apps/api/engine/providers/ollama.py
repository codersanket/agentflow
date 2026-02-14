from __future__ import annotations

import logging

import httpx

from engine.providers.base import EmbeddingResponse, LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

OLLAMA_DEFAULT_URL = "http://localhost:11434"


class OllamaProvider(LLMProvider):
    """Ollama provider for local model execution via httpx."""

    def __init__(self, base_url: str = OLLAMA_DEFAULT_URL, timeout: float = 120.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        model: str = "llama3",
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if tools:
            payload["tools"] = tools

        resp = await self._client.post("/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()

        message = data.get("message", {})
        content = message.get("content", "")

        tool_calls = None
        if message.get("tool_calls"):
            tool_calls = [
                {
                    "id": tc.get("function", {}).get("name", ""),
                    "type": "function",
                    "function": {
                        "name": tc["function"]["name"],
                        "arguments": tc["function"].get("arguments", {}),
                    },
                }
                for tc in message["tool_calls"]
            ]

        input_tokens = data.get("prompt_eval_count", 0)
        output_tokens = data.get("eval_count", 0)

        return LLMResponse(
            content=content,
            tool_calls=tool_calls,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            cost=0.0,
        )

    async def embed(
        self,
        texts: list[str],
        model: str = "nomic-embed-text",
    ) -> EmbeddingResponse:
        payload = {
            "model": model,
            "input": texts,
        }

        resp = await self._client.post("/api/embed", json=payload)
        resp.raise_for_status()
        data = resp.json()

        embeddings = data.get("embeddings", [])

        return EmbeddingResponse(
            embeddings=embeddings,
            input_tokens=0,
            model=model,
            cost=0.0,
        )

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        return 0.0

    async def close(self) -> None:
        await self._client.aclose()
