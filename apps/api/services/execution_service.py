from __future__ import annotations

import base64
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent import Agent, AgentVersion
from models.execution import Execution, ExecutionLog, ExecutionStep
from schemas.common import PaginatedResponse
from schemas.execution import (
    ExecutionLogResponse,
    ExecutionResponse,
    ExecutionStepResponse,
    TriggerExecutionRequest,
)


async def trigger_execution(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
    user_id: UUID,
    data: TriggerExecutionRequest,
    dry_run: bool = False,
) -> ExecutionResponse:
    # Validate agent exists and belongs to org
    agent = await _get_active_agent_or_400(db, org_id, agent_id)

    # Resolve version
    if data.version_id:
        version_result = await db.execute(
            select(AgentVersion).where(
                AgentVersion.id == data.version_id,
                AgentVersion.agent_id == agent_id,
            )
        )
        version = version_result.scalar_one_or_none()
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent version not found",
            )
    else:
        # Use latest published version
        version_result = await db.execute(
            select(AgentVersion)
            .where(
                AgentVersion.agent_id == agent_id,
                AgentVersion.is_published.is_(True),
            )
            .order_by(AgentVersion.version.desc())
            .limit(1)
        )
        version = version_result.scalar_one_or_none()
        if version is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent has no published version",
            )

    # Check concurrency limit
    concurrency_limit = agent.settings.get("concurrency_limit", 5)
    running_count_result = await db.execute(
        select(func.count(Execution.id)).where(
            Execution.agent_id == agent_id,
            Execution.org_id == org_id,
            Execution.status.in_(["pending", "running"]),
        )
    )
    running_count = running_count_result.scalar() or 0

    if running_count >= concurrency_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Agent concurrency limit ({concurrency_limit}) reached",
        )

    triggered_by = "test" if dry_run else "api"

    # Create execution record
    execution = Execution(
        agent_id=agent_id,
        agent_version_id=version.id,
        org_id=org_id,
        triggered_by=triggered_by,
        trigger_data=data.trigger_data,
        status="pending",
    )
    db.add(execution)
    await db.flush()

    # Dispatch to Celery or run inline
    from core.config import settings as app_settings

    if app_settings.CELERY_ENABLED:
        try:
            from workers.agent_worker import execute_agent

            execute_agent.delay(str(execution.id))
        except Exception:
            # Celery dispatch failed — run inline as fallback
            await _run_inline(db, execution)
    else:
        # Celery disabled — run inline
        await _run_inline(db, execution)

    return _execution_to_response(execution)


async def get_execution(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> ExecutionResponse:
    execution = await _get_execution_or_404(db, org_id, execution_id)
    return _execution_to_response(execution)


async def list_executions(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID | None = None,
    cursor: str | None = None,
    limit: int = 20,
    status_filter: str | None = None,
) -> PaginatedResponse[ExecutionResponse]:
    query = select(Execution).where(Execution.org_id == org_id)

    if agent_id:
        query = query.where(Execution.agent_id == agent_id)

    if status_filter:
        query = query.where(Execution.status == status_filter)

    query = query.order_by(Execution.created_at.desc())

    # Cursor-based pagination
    if cursor:
        try:
            cursor_bytes = base64.b64decode(cursor)
            cursor_val = cursor_bytes.decode("utf-8")
            query = query.where(Execution.created_at < datetime.fromisoformat(cursor_val))
        except Exception:
            pass

    query = query.limit(limit + 1)

    result = await db.execute(query)
    executions = list(result.scalars().all())

    has_more = len(executions) > limit
    if has_more:
        executions = executions[:limit]

    next_cursor = None
    if has_more and executions:
        last_created = executions[-1].created_at.isoformat()
        next_cursor = base64.b64encode(last_created.encode("utf-8")).decode("utf-8")

    items = [_execution_to_response(e) for e in executions]

    return PaginatedResponse(items=items, cursor=next_cursor, has_more=has_more)


async def get_execution_steps(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> list[ExecutionStepResponse]:
    await _get_execution_or_404(db, org_id, execution_id)

    result = await db.execute(
        select(ExecutionStep)
        .where(ExecutionStep.execution_id == execution_id)
        .order_by(ExecutionStep.step_order)
    )
    steps = result.scalars().all()

    return [
        ExecutionStepResponse(
            id=s.id,
            execution_id=s.execution_id,
            node_id=s.node_id,
            step_order=s.step_order,
            status=s.status,
            input_data=s.input_data,
            output_data=s.output_data,
            error_message=s.error_message,
            tokens_used=s.tokens_used,
            cost=s.cost,
            duration_ms=s.duration_ms,
            started_at=s.started_at,
            completed_at=s.completed_at,
            created_at=s.created_at,
        )
        for s in steps
    ]


async def get_execution_logs(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> list[ExecutionLogResponse]:
    await _get_execution_or_404(db, org_id, execution_id)

    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.execution_id == execution_id)
        .order_by(ExecutionLog.created_at)
    )
    logs = result.scalars().all()

    return [
        ExecutionLogResponse(
            id=log.id,
            execution_id=log.execution_id,
            step_id=log.step_id,
            level=log.level,
            message=log.message,
            data=log.data,
            created_at=log.created_at,
        )
        for log in logs
    ]


async def cancel_execution(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> ExecutionResponse:
    execution = await _get_execution_or_404(db, org_id, execution_id)

    if execution.status in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel execution with status '{execution.status}'",
        )

    execution.status = "cancelled"
    execution.completed_at = datetime.now(UTC)
    await db.flush()

    # Publish cancel event to Redis for WebSocket subscribers
    try:
        from core.redis import get_redis

        redis = await get_redis()
        import json

        await redis.publish(
            f"execution:{execution_id}",
            json.dumps(
                {
                    "type": "execution.cancelled",
                    "execution_id": str(execution_id),
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            ),
        )
    except Exception:
        pass

    return _execution_to_response(execution)


async def approve_step(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> ExecutionResponse:
    execution = await _get_execution_or_404(db, org_id, execution_id)

    if execution.status != "waiting_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execution is not waiting for approval",
        )

    # Find the step waiting for approval
    step_result = await db.execute(
        select(ExecutionStep).where(
            ExecutionStep.execution_id == execution_id,
            ExecutionStep.status == "waiting_approval",
        )
    )
    step = step_result.scalar_one_or_none()

    if step:
        step.status = "approved"
        step.completed_at = datetime.now(UTC)

    execution.status = "running"
    await db.flush()

    # Publish approval event to Redis
    try:
        from core.redis import get_redis

        redis = await get_redis()
        import json

        await redis.publish(
            f"execution:{execution_id}",
            json.dumps(
                {
                    "type": "step.approved",
                    "execution_id": str(execution_id),
                    "step_id": str(step.id) if step else None,
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            ),
        )
    except Exception:
        pass

    return _execution_to_response(execution)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_active_agent_or_400(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> Agent:
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id))
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    if agent.status not in ("active", "draft"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent is {agent.status} and cannot be executed",
        )

    return agent


async def _get_execution_or_404(
    db: AsyncSession,
    org_id: UUID,
    execution_id: UUID,
) -> Execution:
    result = await db.execute(
        select(Execution).where(
            Execution.id == execution_id,
            Execution.org_id == org_id,
        )
    )
    execution = result.scalar_one_or_none()

    if execution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    return execution


async def _run_inline(db: AsyncSession, execution: Execution) -> None:
    """Execute the agent inline (without Celery)."""
    try:
        from engine.orchestrator import Orchestrator

        orchestrator = Orchestrator(db)
        await orchestrator.run(execution.id)
    except Exception as exc:
        # If orchestrator didn't already mark as failed, do it here
        if execution.status not in ("failed", "completed"):
            execution.status = "failed"
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(UTC)
            await db.flush()


def _execution_to_response(execution: Execution) -> ExecutionResponse:
    return ExecutionResponse(
        id=execution.id,
        agent_id=execution.agent_id,
        agent_version_id=execution.agent_version_id,
        org_id=execution.org_id,
        triggered_by=execution.triggered_by,
        trigger_data=execution.trigger_data,
        status=execution.status,
        started_at=execution.started_at,
        completed_at=execution.completed_at,
        error_message=execution.error_message,
        total_tokens=execution.total_tokens,
        total_cost=execution.total_cost,
        created_at=execution.created_at,
        updated_at=execution.updated_at,
    )
