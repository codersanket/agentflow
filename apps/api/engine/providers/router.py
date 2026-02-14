from __future__ import annotations

import logging

from engine.providers.base import LLMProvider, LLMResponse

logger = logging.getLogger(__name__)

# Model prefix -> provider name mapping
DEFAULT_PROVIDER_MAP: dict[str, str] = {
    "gpt": "openai",
    "o1": "openai",
    "o3": "openai",
    "claude": "anthropic",
    "gemini": "google",
}


class ProviderRouter:
    """Routes LLM requests to the appropriate provider with fallback."""

    def __init__(
        self,
        providers: dict[str, LLMProvider],
        fallback_order: list[str] | None = None,
        provider_map: dict[str, str] | None = None,
    ) -> None:
        self.providers = providers
        self.fallback_order = fallback_order or list(providers.keys())
        self.provider_map = provider_map or DEFAULT_PROVIDER_MAP

    def resolve_provider(self, model: str) -> LLMProvider:
        """Determine which provider handles a given model."""
        prefix = model.split("-")[0]
        provider_name = self.provider_map.get(prefix)

        if provider_name and provider_name in self.providers:
            return self.providers[provider_name]

        # Fallback to first available provider
        if self.fallback_order:
            return self.providers[self.fallback_order[0]]

        raise ValueError(f"No provider found for model: {model}")

    async def chat(
        self,
        messages: list[dict],
        model: str = "gpt-4o",
        **kwargs,
    ) -> LLMResponse:
        """Send a chat request, falling back through providers on failure."""
        provider = self.resolve_provider(model)
        try:
            return await provider.chat(messages, model=model, **kwargs)
        except Exception:
            logger.warning("Primary provider failed for model %s, trying fallbacks", model)
            for fallback_name in self.fallback_order:
                if self.providers[fallback_name] is provider:
                    continue
                try:
                    fallback = self.providers[fallback_name]
                    return await fallback.chat(messages, **kwargs)
                except Exception:
                    logger.warning("Fallback provider %s also failed", fallback_name)
                    continue
            raise RuntimeError("All LLM providers failed")

    async def close(self) -> None:
        """Close all provider HTTP clients."""
        for provider in self.providers.values():
            if hasattr(provider, "close"):
                await provider.close()
