from __future__ import annotations

import re
from typing import Any

# Pattern to match {{path.to.value}} or {{path.to.array[0].field}}
TEMPLATE_PATTERN = re.compile(r"\{\{(.+?)\}\}")

# Pattern to match array indexing like items[0]
ARRAY_INDEX_PATTERN = re.compile(r"^(.+?)\[(\d+)\]$")


def _resolve_path(context: dict[str, Any], path: str) -> Any:
    """Resolve a dot-separated path against a context dict.

    Supports nested access (a.b.c) and array indexing (a.items[0].name).
    """
    current: Any = context

    for segment in path.strip().split("."):
        if current is None:
            return None

        # Check for array index: e.g. "items[0]"
        match = ARRAY_INDEX_PATTERN.match(segment)
        if match:
            key = match.group(1)
            index = int(match.group(2))
            if isinstance(current, dict):
                current = current.get(key)
            else:
                return None
            if isinstance(current, list) and 0 <= index < len(current):
                current = current[index]
            else:
                return None
        elif isinstance(current, dict):
            current = current.get(segment)
        else:
            return None

    return current


def resolve_template(template: str, context: dict[str, Any]) -> str:
    """Resolve all {{...}} expressions in a template string."""

    def replacer(match: re.Match) -> str:
        path = match.group(1)
        value = _resolve_path(context, path)
        if value is None:
            return match.group(0)  # Leave unresolved templates as-is
        return str(value)

    return TEMPLATE_PATTERN.sub(replacer, template)


def resolve_value(value: Any, context: dict[str, Any]) -> Any:
    """Recursively resolve template expressions in a value.

    Handles strings, dicts, and lists.
    """
    if isinstance(value, str):
        # If the entire string is a single template, return the raw value
        # (preserving type, e.g. list or dict)
        match = TEMPLATE_PATTERN.fullmatch(value)
        if match:
            resolved = _resolve_path(context, match.group(1))
            return resolved if resolved is not None else value
        return resolve_template(value, context)
    elif isinstance(value, dict):
        return {k: resolve_value(v, context) for k, v in value.items()}
    elif isinstance(value, list):
        return [resolve_value(item, context) for item in value]
    return value
