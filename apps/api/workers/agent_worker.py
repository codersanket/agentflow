from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="workers.agent_worker.execute_agent",
    bind=True,
    max_retries=3,
    default_retry_delay=10,
)
def execute_agent(self, execution_id: str) -> dict:
    """Celery task that drives a full agent execution.

    1. Load execution record and agent definition from DB
    2. Build execution graph (topological order)
    3. Execute each node through the orchestrator
    4. Update execution status on completion/failure
    """
    logger.info("Starting execution %s", execution_id)

    try:
        result = _run_async(_execute(execution_id))
        logger.info("Execution %s completed successfully", execution_id)
        return result
    except Exception as exc:
        logger.exception("Execution %s failed: %s", execution_id, exc)
        _run_async(_mark_failed(execution_id, str(exc)))
        raise self.retry(exc=exc) if self.request.retries < self.max_retries else exc


async def _execute(execution_id: str) -> dict:
    """Async execution logic."""
    from core.database import async_session_factory
    from engine.orchestrator import Orchestrator

    async with async_session_factory() as db:
        orchestrator = Orchestrator(db)
        result = await orchestrator.run(UUID(execution_id))
        await db.commit()
        return result


async def _mark_failed(execution_id: str, error_message: str) -> None:
    """Mark execution as failed in the database."""
    from datetime import UTC, datetime

    from sqlalchemy import update

    from core.database import async_session_factory
    from models.execution import Execution

    async with async_session_factory() as db:
        await db.execute(
            update(Execution)
            .where(Execution.id == UUID(execution_id))
            .values(
                status="failed",
                error_message=error_message,
                completed_at=datetime.now(UTC),
            )
        )
        await db.commit()
