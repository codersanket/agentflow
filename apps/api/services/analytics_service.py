from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import case, cast, func, select, Date
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent import Agent
from models.execution import Execution


async def get_overview(
    db: AsyncSession,
    org_id: UUID,
) -> dict:
    """Dashboard summary stats for the last 7 days."""
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    # Total executions
    total_q = await db.execute(
        select(func.count(Execution.id)).where(Execution.org_id == org_id)
    )
    total_executions = total_q.scalar() or 0

    # Executions in last 7 days
    recent_q = await db.execute(
        select(func.count(Execution.id)).where(
            Execution.org_id == org_id,
            Execution.created_at >= seven_days_ago,
        )
    )
    recent_executions = recent_q.scalar() or 0

    # Success rate
    if total_executions > 0:
        success_q = await db.execute(
            select(func.count(Execution.id)).where(
                Execution.org_id == org_id,
                Execution.status == "completed",
            )
        )
        success_count = success_q.scalar() or 0
        success_rate = round(success_count / total_executions * 100, 1)
    else:
        success_rate = 0.0

    # Average duration (completed executions)
    avg_q = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Execution.completed_at)
                - func.extract("epoch", Execution.started_at)
            )
        ).where(
            Execution.org_id == org_id,
            Execution.status == "completed",
            Execution.started_at.isnot(None),
            Execution.completed_at.isnot(None),
        )
    )
    avg_duration_seconds = avg_q.scalar()
    avg_duration_ms = round(float(avg_duration_seconds) * 1000) if avg_duration_seconds else 0

    # Active agents (agents that had at least 1 execution in last 7 days)
    active_q = await db.execute(
        select(func.count(func.distinct(Execution.agent_id))).where(
            Execution.org_id == org_id,
            Execution.created_at >= seven_days_ago,
        )
    )
    active_agents = active_q.scalar() or 0

    # Total cost
    cost_q = await db.execute(
        select(func.sum(Execution.total_cost)).where(Execution.org_id == org_id)
    )
    total_cost = float(cost_q.scalar() or 0)

    return {
        "total_executions": total_executions,
        "recent_executions": recent_executions,
        "success_rate": success_rate,
        "avg_duration_ms": avg_duration_ms,
        "active_agents": active_agents,
        "total_cost": total_cost,
    }


async def get_usage_over_time(
    db: AsyncSession,
    org_id: UUID,
    period: str = "daily",
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict]:
    """Aggregated usage data over time."""
    if to_date is None:
        to_date = date.today()
    if from_date is None:
        from_date = to_date - timedelta(days=30)

    date_col = cast(Execution.created_at, Date)

    query = (
        select(
            date_col.label("date"),
            func.count(Execution.id).label("total_runs"),
            func.sum(Execution.total_tokens).label("total_tokens"),
            func.sum(Execution.total_cost).label("total_cost"),
            func.count(
                case((Execution.status == "completed", Execution.id))
            ).label("success_count"),
            func.count(
                case((Execution.status == "failed", Execution.id))
            ).label("failure_count"),
        )
        .where(
            Execution.org_id == org_id,
            cast(Execution.created_at, Date) >= from_date,
            cast(Execution.created_at, Date) <= to_date,
        )
        .group_by(date_col)
        .order_by(date_col.asc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "date": str(row.date),
            "total_runs": row.total_runs,
            "total_tokens": row.total_tokens or 0,
            "total_cost": float(row.total_cost or 0),
            "success_count": row.success_count,
            "failure_count": row.failure_count,
        }
        for row in rows
    ]


async def get_agent_metrics(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> dict:
    """Per-agent metrics."""
    # Verify agent belongs to org
    agent_q = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id)
    )
    agent = agent_q.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Total executions for this agent
    total_q = await db.execute(
        select(func.count(Execution.id)).where(
            Execution.org_id == org_id,
            Execution.agent_id == agent_id,
        )
    )
    total_executions = total_q.scalar() or 0

    # Success count
    success_q = await db.execute(
        select(func.count(Execution.id)).where(
            Execution.org_id == org_id,
            Execution.agent_id == agent_id,
            Execution.status == "completed",
        )
    )
    success_count = success_q.scalar() or 0

    success_rate = round(success_count / total_executions * 100, 1) if total_executions > 0 else 0.0

    # Average duration
    avg_q = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Execution.completed_at)
                - func.extract("epoch", Execution.started_at)
            )
        ).where(
            Execution.org_id == org_id,
            Execution.agent_id == agent_id,
            Execution.status == "completed",
            Execution.started_at.isnot(None),
            Execution.completed_at.isnot(None),
        )
    )
    avg_duration_seconds = avg_q.scalar()
    avg_duration_ms = round(float(avg_duration_seconds) * 1000) if avg_duration_seconds else 0

    # Total cost and tokens
    cost_q = await db.execute(
        select(
            func.sum(Execution.total_cost),
            func.sum(Execution.total_tokens),
        ).where(
            Execution.org_id == org_id,
            Execution.agent_id == agent_id,
        )
    )
    cost_row = cost_q.one()
    total_cost = float(cost_row[0] or 0)
    total_tokens = cost_row[1] or 0

    return {
        "agent_id": str(agent_id),
        "agent_name": agent.name,
        "total_executions": total_executions,
        "success_rate": success_rate,
        "avg_duration_ms": avg_duration_ms,
        "total_cost": total_cost,
        "total_tokens": total_tokens,
    }


async def get_cost_breakdown(
    db: AsyncSession,
    org_id: UUID,
    group_by: str = "agent",
) -> list[dict]:
    """Cost breakdown grouped by agent."""
    if group_by == "agent":
        query = (
            select(
                Agent.id.label("group_id"),
                Agent.name.label("group_name"),
                func.count(Execution.id).label("total_runs"),
                func.sum(Execution.total_tokens).label("total_tokens"),
                func.sum(Execution.total_cost).label("total_cost"),
            )
            .join(Agent, Agent.id == Execution.agent_id)
            .where(Execution.org_id == org_id)
            .group_by(Agent.id, Agent.name)
            .order_by(func.sum(Execution.total_cost).desc())
        )
    else:
        # Default to agent grouping
        query = (
            select(
                Agent.id.label("group_id"),
                Agent.name.label("group_name"),
                func.count(Execution.id).label("total_runs"),
                func.sum(Execution.total_tokens).label("total_tokens"),
                func.sum(Execution.total_cost).label("total_cost"),
            )
            .join(Agent, Agent.id == Execution.agent_id)
            .where(Execution.org_id == org_id)
            .group_by(Agent.id, Agent.name)
            .order_by(func.sum(Execution.total_cost).desc())
        )

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "group_id": str(row.group_id),
            "group_name": row.group_name,
            "total_runs": row.total_runs,
            "total_tokens": row.total_tokens or 0,
            "total_cost": float(row.total_cost or 0),
        }
        for row in rows
    ]
