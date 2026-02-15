from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from croniter import croniter
from sqlalchemy import select

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
    name="workers.schedule_worker.check_scheduled_agents",
    bind=True,
    ignore_result=True,
)
def check_scheduled_agents(self) -> None:
    """Periodic task that checks for agents with cron-based schedules.

    Runs every 60 seconds. For each active agent with trigger_type == "schedule",
    parses the cron expression and checks if the current time falls within the
    60-second window. Dispatches execution if a match is found and the agent
    hasn't already been triggered in this window.
    """
    logger.info("Checking scheduled agents...")
    try:
        _run_async(_check_and_dispatch())
    except Exception:
        logger.exception("Error checking scheduled agents")


async def _check_and_dispatch() -> None:
    """Query scheduled agents and dispatch executions for matching cron windows."""
    from core.config import settings as app_settings
    from core.database import async_session_factory
    from models.agent import Agent, AgentVersion

    now = datetime.now(UTC)

    async with async_session_factory() as db:
        # Query all active agents with schedule trigger type
        result = await db.execute(
            select(Agent).where(
                Agent.trigger_type == "schedule",
                Agent.status == "active",
            )
        )
        agents = list(result.scalars().all())

        if not agents:
            logger.debug("No scheduled agents found")
            return

        for agent in agents:
            try:
                cron_expr = (agent.trigger_config or {}).get("cron")
                if not cron_expr:
                    logger.warning(
                        "Agent %s has schedule trigger but no cron expression", agent.id
                    )
                    continue

                # Validate cron expression
                if not croniter.is_valid(cron_expr):
                    logger.warning(
                        "Agent %s has invalid cron expression: %s", agent.id, cron_expr
                    )
                    continue

                # Check if current time matches the cron schedule within the 60s window
                if not _cron_matches_window(cron_expr, now):
                    continue

                # Check last run to avoid duplicate dispatches within the same window
                last_run_iso = (agent.settings or {}).get("last_scheduled_run")
                if last_run_iso:
                    last_run = datetime.fromisoformat(last_run_iso)
                    # If last run was less than 60 seconds ago, skip
                    if (now - last_run).total_seconds() < 60:
                        logger.debug(
                            "Agent %s already triggered in this window, skipping", agent.id
                        )
                        continue

                # Find latest published version
                version_result = await db.execute(
                    select(AgentVersion)
                    .where(
                        AgentVersion.agent_id == agent.id,
                        AgentVersion.is_published.is_(True),
                    )
                    .order_by(AgentVersion.version.desc())
                    .limit(1)
                )
                version = version_result.scalar_one_or_none()
                if version is None:
                    logger.warning(
                        "Agent %s has no published version, skipping schedule", agent.id
                    )
                    continue

                # Update last_scheduled_run before dispatching
                updated_settings = dict(agent.settings or {})
                updated_settings["last_scheduled_run"] = now.isoformat()
                agent.settings = updated_settings
                await db.flush()

                logger.info(
                    "Dispatching scheduled execution for agent %s (cron: %s)",
                    agent.id,
                    cron_expr,
                )

                # Create execution and dispatch
                await _dispatch_execution(
                    db=db,
                    agent=agent,
                    version=version,
                    celery_enabled=app_settings.CELERY_ENABLED,
                )

            except Exception:
                logger.exception("Error processing scheduled agent %s", agent.id)
                continue

        await db.commit()


def _cron_matches_window(cron_expr: str, now: datetime, window_seconds: int = 60) -> bool:
    """Check if the current time falls within a cron schedule's 60-second window.

    Uses croniter to find the most recent matching time and checks
    if it's within the window.
    """
    cron = croniter(cron_expr, now)
    prev_fire = cron.get_prev(datetime)

    # Check if the previous fire time is within the window
    delta = (now - prev_fire).total_seconds()
    return 0 <= delta < window_seconds


async def _dispatch_execution(
    db,
    agent,
    version,
    celery_enabled: bool,
) -> None:
    """Create an execution record and dispatch it for processing."""
    from models.execution import Execution

    execution = Execution(
        agent_id=agent.id,
        agent_version_id=version.id,
        org_id=agent.org_id,
        triggered_by="schedule",
        trigger_data={"cron": agent.trigger_config.get("cron"), "scheduled_at": datetime.now(UTC).isoformat()},
        status="pending",
    )
    db.add(execution)
    await db.flush()

    if celery_enabled:
        try:
            from workers.agent_worker import execute_agent

            execute_agent.delay(str(execution.id))
        except Exception:
            logger.warning(
                "Celery dispatch failed for scheduled execution %s, running inline",
                execution.id,
            )
            await _run_inline(db, execution)
    else:
        await _run_inline(db, execution)


async def _run_inline(db, execution) -> None:
    """Execute the agent inline (without Celery)."""
    from datetime import UTC, datetime

    from engine.orchestrator import Orchestrator

    try:
        orchestrator = Orchestrator(db)
        await orchestrator.run(execution.id)
    except Exception as exc:
        if execution.status not in ("failed", "completed"):
            execution.status = "failed"
            execution.error_message = str(exc)
            execution.completed_at = datetime.now(UTC)
            await db.flush()
