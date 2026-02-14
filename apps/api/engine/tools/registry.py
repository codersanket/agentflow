from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from engine.tools.base import IntegrationTool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Central registry for integration tool plugins.

    Usage::

        registry = ToolRegistry()
        registry.register(SlackTool())
        tool = registry.get("slack")
        result = await tool.execute("send_message", params, creds)
    """

    def __init__(self) -> None:
        self._tools: dict[str, IntegrationTool] = {}

    def register(self, tool: IntegrationTool) -> None:
        """Register a tool by its ``name``."""
        if tool.name in self._tools:
            logger.warning("Overwriting already-registered tool '%s'", tool.name)
        self._tools[tool.name] = tool
        logger.info("Registered integration tool '%s'", tool.name)

    def get(self, name: str) -> IntegrationTool:
        """Return a registered tool by name, or raise ``KeyError``."""
        try:
            return self._tools[name]
        except KeyError:
            raise KeyError(f"Tool '{name}' not found. Registered: {list(self._tools)}")

    def list_tools(self) -> list[IntegrationTool]:
        """Return all registered tools."""
        return list(self._tools.values())

    def has(self, name: str) -> bool:
        """Return ``True`` if a tool with the given name is registered."""
        return name in self._tools


def build_default_registry() -> ToolRegistry:
    """Build a registry pre-loaded with all built-in tools."""
    from engine.tools.http_request import HttpRequestTool
    from engine.tools.slack import SlackTool
    from engine.tools.webhook import WebhookTool

    registry = ToolRegistry()
    registry.register(SlackTool())
    registry.register(WebhookTool())
    registry.register(HttpRequestTool())
    return registry
