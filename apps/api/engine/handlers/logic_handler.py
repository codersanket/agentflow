from __future__ import annotations

import operator
from typing import Any

from engine.handlers.base import NodeHandler, NodeOutput
from engine.variable_resolver import resolve_value

# Supported comparison operators
OPERATORS: dict[str, Any] = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
    "contains": lambda a, b: b in a if a else False,
    "not_contains": lambda a, b: b not in a if a else True,
}


class LogicNodeHandler(NodeHandler):
    """Handles control-flow logic: if/else, switch/case, loop."""

    async def execute(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        logic_type = config.get("logic_type", "if_else")

        if logic_type == "if_else":
            return self._if_else(config, context)
        elif logic_type == "switch":
            return self._switch(config, context)
        elif logic_type == "loop":
            return self._loop(config, context)
        else:
            raise ValueError(f"Unknown logic type: {logic_type}")

    def _if_else(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Evaluate an if/else condition."""
        condition = config.get("condition", {})
        result = self._evaluate_condition(condition, context)
        return NodeOutput(data={"branch": "true" if result else "false"})

    def _switch(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Evaluate a switch/case expression."""
        value = resolve_value(config.get("value", ""), context)
        cases = config.get("cases", {})

        matched_branch = cases.get(str(value), config.get("default", "default"))
        return NodeOutput(data={"branch": matched_branch})

    def _loop(self, config: dict[str, Any], context: dict[str, Any]) -> NodeOutput:
        """Resolve the items collection to iterate over."""
        items_expression = config.get("items_expression", "")
        items = resolve_value(items_expression, context)

        if not isinstance(items, list):
            items = []

        return NodeOutput(data={"items": items, "count": len(items)})

    def _evaluate_condition(self, condition: dict[str, Any], context: dict[str, Any]) -> bool:
        """Evaluate a condition object: {left, operator, right}."""
        left = resolve_value(condition.get("left", ""), context)
        op_name = condition.get("operator", "eq")
        right = resolve_value(condition.get("right", ""), context)

        op_func = OPERATORS.get(op_name)
        if op_func is None:
            raise ValueError(f"Unknown operator: {op_name}")

        try:
            return bool(op_func(left, right))
        except (TypeError, ValueError):
            return False
