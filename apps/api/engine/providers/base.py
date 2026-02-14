from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    """Standard response from any LLM provider."""

    content: str
    tool_calls: list[dict] | None
    input_tokens: int
    output_tokens: int
    model: str
    cost: float


@dataclass
class EmbeddingResponse:
    """Standard response from an embedding call."""

    embeddings: list[list[float]]
    input_tokens: int
    model: str
    cost: float


class LLMProvider(ABC):
    """Abstract base class for LLM providers.

    All provider implementations must use httpx for HTTP calls
    and never import vendor SDKs directly.
    """

    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> LLMResponse: ...

    @abstractmethod
    async def embed(
        self,
        texts: list[str],
        model: str,
    ) -> EmbeddingResponse: ...

    @abstractmethod
    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> float: ...
