from __future__ import annotations

from typing import Any

from engine.handlers.base import NodeHandler, NodeOutput


class HumanApprovalRequiredError(Exception):
    """Raised when an execution step requires human approval to continue."""

    def __init__(self, step_id: str, message: str = "Approval required") -> None:
        self.step_id = step_id
        self.message = message
        super().__init__(message)


class HumanNodeHandler(NodeHandler):
    """Pauses execution and waits for human approval."""

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        step_id = context.get("current_step_id", "")
        message = config.get("message", "Approval required")

        raise HumanApprovalRequiredError(
            step_id=str(step_id),
            message=message,
        )
