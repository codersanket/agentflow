from __future__ import annotations

from engine.handlers.action_handler import ActionNodeHandler
from engine.handlers.ai_handler import AINodeHandler
from engine.handlers.base import NodeHandler, NodeOutput
from engine.handlers.human_handler import HumanApprovalRequiredError, HumanNodeHandler
from engine.handlers.logic_handler import LogicNodeHandler
from engine.handlers.trigger_handler import TriggerNodeHandler

# Registry mapping node_type -> handler class
NODE_HANDLER_REGISTRY: dict[str, type[NodeHandler]] = {
    "trigger": TriggerNodeHandler,
    "ai": AINodeHandler,
    "action": ActionNodeHandler,
    "logic": LogicNodeHandler,
    "human": HumanNodeHandler,
}


def get_handler(node_type: str) -> type[NodeHandler]:
    """Look up a handler class by node type string."""
    handler_cls = NODE_HANDLER_REGISTRY.get(node_type)
    if handler_cls is None:
        raise ValueError(f"Unknown node type: {node_type}")
    return handler_cls


__all__ = [
    "AINodeHandler",
    "ActionNodeHandler",
    "HumanApprovalRequiredError",
    "HumanNodeHandler",
    "LogicNodeHandler",
    "NODE_HANDLER_REGISTRY",
    "NodeHandler",
    "NodeOutput",
    "TriggerNodeHandler",
    "get_handler",
]
