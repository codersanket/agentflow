from __future__ import annotations

import logging

import httpx

from engine.providers.base import EmbeddingResponse, LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# Cost per 1K tokens (input, output) by model
GOOGLE_PRICING: dict[str, tuple[float, float]] = {
    "gemini-2.0-flash": (0.0001, 0.0004),
}

GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta"


def _convert_messages_to_google(
    messages: list[dict],
) -> tuple[str | None, list[dict]]:
    """Convert OpenAI-style messages to Google Gemini format."""
    system_instruction = None
    contents: list[dict] = []

    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")

        if role == "system":
            system_instruction = content
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})

    return system_instruction, contents


def _convert_tools_to_google(tools: list[dict]) -> list[dict]:
    """Convert OpenAI-style tool definitions to Google format."""
    function_declarations = []
    for tool in tools:
        if tool.get("type") == "function":
            fn = tool["function"]
            function_declarations.append(
                {
                    "name": fn["name"],
                    "description": fn.get("description", ""),
                    "parameters": fn.get("parameters", {}),
                }
            )
    return [{"function_declarations": function_declarations}] if function_declarations else []


class GoogleProvider(LLMProvider):
    """Google Gemini provider using raw httpx -- no SDK dependency."""

    def __init__(self, api_key: str, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=GOOGLE_API_URL,
            timeout=timeout,
        )

    async def chat(
        self,
        messages: list[dict],
        model: str = "gemini-2.0-flash",
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse:
        system_instruction, contents = _convert_messages_to_google(messages)

        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if tools:
            payload["tools"] = _convert_tools_to_google(tools)

        url = f"/models/{model}:generateContent?key={self._api_key}"
        resp = await self._client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

        # Parse response
        candidates = data.get("candidates", [])
        content_parts: list[str] = []
        tool_calls: list[dict] | None = None

        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                if "text" in part:
                    content_parts.append(part["text"])
                elif "functionCall" in part:
                    if tool_calls is None:
                        tool_calls = []
                    fc = part["functionCall"]
                    tool_calls.append(
                        {
                            "id": fc["name"],
                            "type": "function",
                            "function": {
                                "name": fc["name"],
                                "arguments": fc.get("args", {}),
                            },
                        }
                    )

        usage = data.get("usageMetadata", {})
        input_tokens = usage.get("promptTokenCount", 0)
        output_tokens = usage.get("candidatesTokenCount", 0)

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
        model: str = "text-embedding-004",
    ) -> EmbeddingResponse:
        embeddings: list[list[float]] = []
        total_tokens = 0

        for text in texts:
            payload = {
                "model": f"models/{model}",
                "content": {"parts": [{"text": text}]},
            }
            url = f"/models/{model}:embedContent?key={self._api_key}"
            resp = await self._client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

            embedding = data.get("embedding", {}).get("values", [])
            embeddings.append(embedding)

        return EmbeddingResponse(
            embeddings=embeddings,
            input_tokens=total_tokens,
            model=model,
            cost=0.0,
        )

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float:
        pricing = GOOGLE_PRICING.get(model, GOOGLE_PRICING["gemini-2.0-flash"])
        input_cost = (input_tokens / 1000) * pricing[0]
        output_cost = (output_tokens / 1000) * pricing[1]
        return round(input_cost + output_cost, 8)

    async def close(self) -> None:
        await self._client.aclose()
