from __future__ import annotations

from dataclasses import dataclass, field

# Pricing per 1K tokens: (input_cost, output_cost)
# Updated February 2026
MODEL_PRICING: dict[str, tuple[float, float]] = {
    # OpenAI
    "gpt-4o": (0.0025, 0.010),
    "gpt-4o-mini": (0.000150, 0.000600),
    # Anthropic
    "claude-sonnet-4-5-20250929": (0.003, 0.015),
    "claude-haiku-4-5-20251001": (0.0008, 0.004),
    # Google
    "gemini-2.0-flash": (0.0001, 0.0004),
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Calculate the cost for a given model and token usage.

    Returns 0.0 for unknown models (e.g., local Ollama models).
    """
    pricing = MODEL_PRICING.get(model)
    if pricing is None:
        return 0.0

    input_cost = (input_tokens / 1000) * pricing[0]
    output_cost = (output_tokens / 1000) * pricing[1]
    return round(input_cost + output_cost, 8)


@dataclass
class StepCost:
    """Cost record for a single execution step."""

    model: str
    tokens_used: int
    cost: float


@dataclass
class CostTracker:
    """Accumulates token usage and cost across an entire execution."""

    steps: list[StepCost] = field(default_factory=list)
    total_tokens: int = 0
    total_cost: float = 0.0

    def add_step(self, model: str, tokens_used: int, cost: float) -> None:
        """Record cost for a single step."""
        self.steps.append(StepCost(model=model, tokens_used=tokens_used, cost=cost))
        self.total_tokens += tokens_used
        self.total_cost = round(self.total_cost + cost, 8)

    def summary(self) -> dict:
        """Return a summary of accumulated cost data."""
        by_model: dict[str, dict] = {}
        for step in self.steps:
            if step.model not in by_model:
                by_model[step.model] = {"tokens": 0, "cost": 0.0, "steps": 0}
            by_model[step.model]["tokens"] += step.tokens_used
            by_model[step.model]["cost"] = round(by_model[step.model]["cost"] + step.cost, 8)
            by_model[step.model]["steps"] += 1

        return {
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "step_count": len(self.steps),
            "by_model": by_model,
        }
