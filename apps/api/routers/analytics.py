from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from models.user import User
from services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> dict:
    return await analytics_service.get_overview(db, org_id)


@router.get("/usage")
async def get_usage(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
    period: str = Query(default="daily", pattern="^(daily|weekly)$"),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
) -> list[dict]:
    return await analytics_service.get_usage_over_time(
        db, org_id, period=period, from_date=from_date, to_date=to_date
    )


@router.get("/agents/{agent_id}")
async def get_agent_metrics(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> dict:
    return await analytics_service.get_agent_metrics(db, org_id, agent_id)


@router.get("/costs")
async def get_cost_breakdown(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
    group_by: str = Query(default="agent", pattern="^(agent|provider|model)$"),
) -> list[dict]:
    return await analytics_service.get_cost_breakdown(db, org_id, group_by=group_by)
