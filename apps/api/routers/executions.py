from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from core.redis import get_redis
from core.security import decode_token
from models.user import User
from schemas.common import PaginatedResponse
from schemas.execution import (
    ExecutionLogResponse,
    ExecutionResponse,
    ExecutionStepResponse,
    TriggerExecutionRequest,
)
from services import execution_service

router = APIRouter(prefix="/executions", tags=["executions"])

# Agent-scoped execution triggers live in the agents router but are registered here
# so they share the same service. They are wired via the agents router prefix.
agent_execution_router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Agent-scoped endpoints (mounted under /agents/:id)
# ---------------------------------------------------------------------------


@agent_execution_router.post(
    "/{agent_id}/execute",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def trigger_execution(
    agent_id: UUID,
    data: TriggerExecutionRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> ExecutionResponse:
    return await execution_service.trigger_execution(
        db, org_id, agent_id, current_user.id, data, dry_run=False
    )


@agent_execution_router.post(
    "/{agent_id}/test",
    response_model=ExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def test_execution(
    agent_id: UUID,
    data: TriggerExecutionRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> ExecutionResponse:
    return await execution_service.trigger_execution(
        db, org_id, agent_id, current_user.id, data, dry_run=True
    )


# ---------------------------------------------------------------------------
# Execution endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=PaginatedResponse[ExecutionResponse])
async def list_executions(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
    agent_id: UUID | None = None,
    cursor: str | None = None,
    limit: int = 20,
    status_filter: str | None = Query(default=None, alias="status"),
) -> PaginatedResponse[ExecutionResponse]:
    return await execution_service.list_executions(
        db, org_id, agent_id=agent_id, cursor=cursor, limit=limit, status_filter=status_filter
    )


@router.get("/{execution_id}", response_model=ExecutionResponse)
async def get_execution(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> ExecutionResponse:
    return await execution_service.get_execution(db, org_id, execution_id)


@router.get("/{execution_id}/steps", response_model=list[ExecutionStepResponse])
async def get_execution_steps(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[ExecutionStepResponse]:
    return await execution_service.get_execution_steps(db, org_id, execution_id)


@router.get("/{execution_id}/logs", response_model=list[ExecutionLogResponse])
async def get_execution_logs(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[ExecutionLogResponse]:
    return await execution_service.get_execution_logs(db, org_id, execution_id)


@router.post("/{execution_id}/cancel", response_model=ExecutionResponse)
async def cancel_execution(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> ExecutionResponse:
    return await execution_service.cancel_execution(db, org_id, execution_id)


@router.post("/{execution_id}/approve", response_model=ExecutionResponse)
async def approve_execution(
    execution_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> ExecutionResponse:
    return await execution_service.approve_step(db, org_id, execution_id)


# ---------------------------------------------------------------------------
# WebSocket streaming
# ---------------------------------------------------------------------------


@router.websocket("/{execution_id}/stream")
async def execution_stream(websocket: WebSocket, execution_id: UUID):
    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    org_id = UUID(payload["org_id"])

    await websocket.accept()

    # Verify execution belongs to org using a fresh DB session
    from core.database import async_session_factory

    async with async_session_factory() as db:
        from sqlalchemy import select

        from models.execution import Execution

        result = await db.execute(
            select(Execution).where(
                Execution.id == execution_id,
                Execution.org_id == org_id,
            )
        )
        execution = result.scalar_one_or_none()

        if execution is None:
            await websocket.close(code=4004, reason="Execution not found")
            return

    # Subscribe to Redis pub/sub channel for this execution
    redis = await get_redis()
    pubsub = redis.pubsub()
    channel = f"execution:{execution_id}"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await websocket.send_text(data)

                # Close WebSocket on terminal events
                try:
                    event = json.loads(data)
                    if event.get("type") in (
                        "execution.completed",
                        "execution.failed",
                        "execution.cancelled",
                    ):
                        await websocket.close()
                        break
                except (json.JSONDecodeError, KeyError):
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
