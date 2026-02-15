from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.agent import Agent, AgentVersion
from models.execution import Execution

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/{agent_id}")
async def receive_webhook(
    agent_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive a webhook trigger for an agent.

    No auth required -- the webhook URL acts as the secret.
    """

    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    if agent.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent is not active (current status: {agent.status})",
        )

    if agent.trigger_type != "webhook":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent is not configured with a webhook trigger",
        )

    # Parse request body — gracefully handle non-JSON payloads
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Resolve the latest published version (if any)
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

    # Create execution record
    execution = Execution(
        agent_id=agent.id,
        agent_version_id=version.id if version else None,
        org_id=agent.org_id,
        triggered_by="webhook",
        trigger_data=body,
        status="pending",
    )
    db.add(execution)
    await db.flush()

    # Dispatch to Celery worker if available
    try:
        from workers.agent_worker import execute_agent

        execute_agent.delay(str(execution.id))
    except ImportError:
        # Celery worker not available — execution stays pending
        logger.info("Celery not available; execution %s stays pending", execution.id)

    return {
        "execution_id": str(execution.id),
        "status": execution.status,
        "message": "Webhook received, execution started",
    }
