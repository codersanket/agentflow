from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ToolAction:
    """Describes a single action an integration tool can perform."""

    name: str
    description: str
    parameters: dict[str, str] = field(default_factory=dict)


class IntegrationTool(ABC):
    """Base class for all integration tool plugins.

    Each integration tool provides a set of named actions that can be
    executed during agent runs.  Concrete implementations must set
    ``name``, ``description``, and ``actions`` and implement ``execute``.
    """

    name: str
    description: str
    actions: list[ToolAction]

    @abstractmethod
    async def execute(
        self,
        action: str,
        params: dict,
        credentials: dict,
    ) -> dict:
        """Execute a named action with the given params and credentials.

        Returns a dict that will be stored as the step output.
        """
        ...

    def get_action(self, action_name: str) -> ToolAction | None:
        """Look up an action by name."""
        for action in self.actions:
            if action.name == action_name:
                return action
        return None

    def validate_action(self, action_name: str) -> None:
        """Raise ``ValueError`` if the action is unknown."""
        if self.get_action(action_name) is None:
            valid = [a.name for a in self.actions]
            raise ValueError(
                f"Unknown action '{action_name}' for tool '{self.name}'. Available: {valid}"
            )
