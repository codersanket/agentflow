from __future__ import annotations

from typing import Any

from engine.handlers.base import NodeHandler, NodeOutput


class TriggerNodeHandler(NodeHandler):
    """Pass-through handler for trigger nodes.

    Trigger nodes are entry points of the agent graph.  They don't
    perform any computation — they simply forward the trigger data
    that was already placed into the execution context by the
    orchestrator.
    """

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        trigger_data = context.get("trigger", {}).get("data", {})
        trigger_type = config.get("trigger_type", "manual")

        return NodeOutput(
            data={
                "trigger_type": trigger_type,
                "payload": trigger_data,
            },
        )
