from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class NodeOutput:
    """Standard output from a node handler execution."""

    data: dict[str, Any] = field(default_factory=dict)
    tokens_used: int = 0
    cost: float = 0.0


class NodeHandler(ABC):
    """Abstract base class for agent node handlers."""

    @abstractmethod
    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Execute the node logic.

        Args:
            config: Node configuration from the agent definition.
            context: Current execution context with outputs from prior nodes.

        Returns:
            NodeOutput containing the result data, token usage, and cost.
        """
        ...
