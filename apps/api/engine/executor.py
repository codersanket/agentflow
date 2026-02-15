from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from core.redis import get_redis
from engine.cost_tracker import CostTracker
from engine.handlers import get_handler
from engine.handlers.base import NodeHandler, NodeOutput
from engine.handlers.human_handler import HumanApprovalRequiredError
from engine.providers.router import ProviderRouter
from engine.variable_resolver import resolve_value
from models.execution import ExecutionLog, ExecutionStep

logger = logging.getLogger(__name__)


@dataclass
class RetryPolicy:
    """Configuration for retry behavior on transient errors."""

    max_retries: int = 3
    backoff_base: float = 2.0
    backoff_max: float = 60.0
    retryable_errors: list[str] = field(
        default_factory=lambda: [
            "TimeoutError",
            "ConnectionError",
            "httpx.TimeoutException",
            "httpx.ConnectError",
        ]
    )


def _is_retryable(exc: Exception, policy: RetryPolicy) -> bool:
    """Check if an exception is retryable based on the policy."""
    exc_type_name = type(exc).__name__
    for retryable in policy.retryable_errors:
        if exc_type_name == retryable or retryable in str(type(exc).__mro__):
            return True
    # Also match by checking class name in the MRO
    for cls in type(exc).__mro__:
        if cls.__name__ in policy.retryable_errors:
            return True
    return False


async def execute_with_retry(
    handler: NodeHandler,
    config: dict[str, Any],
    context: dict[str, Any],
    policy: RetryPolicy | None = None,
) -> NodeOutput:
    """Execute a node handler with exponential backoff retry."""
    policy = policy or RetryPolicy()

    for attempt in range(policy.max_retries + 1):
        try:
            return await handler.execute(config, context)
        except HumanApprovalRequiredError:
            raise
        except Exception as exc:
            if attempt == policy.max_retries or not _is_retryable(exc, policy):
                raise
            wait = min(policy.backoff_base**attempt, policy.backoff_max)
            logger.warning(
                "Retry attempt %d/%d after %.1fs for error: %s",
                attempt + 1,
                policy.max_retries,
                wait,
                exc,
            )
            await asyncio.sleep(wait)

    raise RuntimeError("Unreachable: execute_with_retry exhausted retries")


class StepExecutor:
    """Executes individual nodes within an agent execution.

    Manages step lifecycle: create record, resolve inputs, execute handler,
    record output, track cost, emit events.
    """

    def __init__(
        self,
        db: AsyncSession,
        execution_id: UUID,
        provider_router: ProviderRouter,
        cost_tracker: CostTracker,
        retry_policy: RetryPolicy | None = None,
    ) -> None:
        self._db = db
        self._execution_id = execution_id
        self._router = provider_router
        self._cost_tracker = cost_tracker
        self._retry_policy = retry_policy or RetryPolicy()

    async def execute_node(
        self,
        node_id: UUID,
        node_type: str,
        node_config: dict[str, Any],
        context: dict[str, Any],
        step_order: int,
    ) -> NodeOutput:
        """Execute a single node and persist its step record."""
        # Create step record
        step = ExecutionStep(
            execution_id=self._execution_id,
            node_id=node_id,
            step_order=step_order,
            status="running",
            input_data=node_config,
            started_at=datetime.now(UTC),
        )
        self._db.add(step)
        await self._db.flush()

        await self._emit_event(
            "step.started",
            {
                "step_id": str(step.id),
                "node_id": str(node_id),
                "step_order": step_order,
            },
        )

        start_time = time.monotonic()

        try:
            # Instantiate handler
            handler_cls = get_handler(node_type)
            if node_type == "ai":
                handler = handler_cls(provider_router=self._router)
            else:
                handler = handler_cls()

            # Inject current step id into context for human handler
            context["current_step_id"] = str(step.id)

            # Resolve variable templates (e.g. {{Node Label.output.field}}) in config
            resolved_config = resolve_value(node_config, context)

            # Execute with retry using resolved config
            output = await execute_with_retry(handler, resolved_config, context, self._retry_policy)

            duration_ms = int((time.monotonic() - start_time) * 1000)

            # Track cost
            if output.tokens_used > 0:
                model = node_config.get("model", "unknown")
                self._cost_tracker.add_step(model, output.tokens_used, output.cost)

            # Update step record
            step.status = "completed"
            step.output_data = output.data
            step.tokens_used = output.tokens_used
            step.cost = Decimal(str(output.cost))
            step.duration_ms = duration_ms
            step.completed_at = datetime.now(UTC)
            await self._db.flush()

            await self._emit_event(
                "step.completed",
                {
                    "step_id": str(step.id),
                    "node_id": str(node_id),
                    "output": output.data,
                    "tokens_used": output.tokens_used,
                    "duration_ms": duration_ms,
                },
            )

            # Log
            await self._add_log(
                step.id,
                "info",
                f"Node completed in {duration_ms}ms",
                {"tokens": output.tokens_used, "cost": output.cost},
            )

            return output

        except HumanApprovalRequiredError as exc:
            step.status = "waiting_approval"
            step.completed_at = datetime.now(UTC)
            await self._db.flush()

            await self._emit_event(
                "step.waiting_approval",
                {
                    "step_id": str(step.id),
                    "node_id": str(node_id),
                    "message": exc.message,
                },
            )
            raise

        except Exception as exc:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            step.status = "failed"
            step.error_message = str(exc)
            step.duration_ms = duration_ms
            step.completed_at = datetime.now(UTC)
            await self._db.flush()

            await self._emit_event(
                "step.failed",
                {
                    "step_id": str(step.id),
                    "node_id": str(node_id),
                    "error": str(exc),
                },
            )

            await self._add_log(step.id, "error", f"Node failed: {exc}")
            raise

    async def _emit_event(self, event_type: str, data: dict[str, Any]) -> None:
        """Publish execution event via Redis pub/sub."""
        try:
            redis = await get_redis()
            channel = f"execution:{self._execution_id}"
            payload = json.dumps(
                {
                    "type": event_type,
                    "execution_id": str(self._execution_id),
                    "timestamp": datetime.now(UTC).isoformat(),
                    **data,
                }
            )
            await redis.publish(channel, payload)
        except Exception:
            logger.warning("Failed to emit event %s", event_type, exc_info=True)

    async def _add_log(
        self,
        step_id: UUID,
        level: str,
        message: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        """Add a log entry for this execution."""
        log = ExecutionLog(
            execution_id=self._execution_id,
            step_id=step_id,
            level=level,
            message=message,
            data=data,
        )
        self._db.add(log)
        await self._db.flush()
