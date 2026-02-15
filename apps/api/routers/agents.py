from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from models.user import User
from schemas.agent import (
    AgentCreate,
    AgentResponse,
    AgentStatusUpdate,
    AgentUpdate,
    AgentVersionResponse,
    PublishVersionRequest,
)
from schemas.common import PaginatedResponse
from services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=PaginatedResponse[AgentResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
    cursor: str | None = None,
    limit: int = 20,
    status_filter: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
) -> PaginatedResponse[AgentResponse]:
    return await agent_service.list_agents(
        db, org_id, cursor=cursor, limit=limit, status_filter=status_filter, sort=sort, order=order
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    data: AgentCreate,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    return await agent_service.create_agent(db, org_id, current_user.id, data)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> AgentResponse:
    return await agent_service.get_agent(db, org_id, agent_id)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    data: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> AgentResponse:
    return await agent_service.update_agent(db, org_id, agent_id, data)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
):
    await agent_service.delete_agent(db, org_id, agent_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{agent_id}/publish",
    response_model=AgentVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def publish_version(
    agent_id: UUID,
    data: PublishVersionRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> AgentVersionResponse:
    return await agent_service.publish_version(db, org_id, agent_id, current_user.id, data)


@router.get("/{agent_id}/versions", response_model=list[AgentVersionResponse])
async def list_versions(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[AgentVersionResponse]:
    return await agent_service.list_versions(db, org_id, agent_id)


@router.post("/{agent_id}/versions/{version_id}/rollback", response_model=AgentResponse)
async def rollback_agent_version(
    agent_id: UUID,
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    return await agent_service.rollback_to_version(db, org_id, agent_id, version_id, current_user.id)


@router.put("/{agent_id}/status", response_model=AgentResponse)
async def update_status(
    agent_id: UUID,
    data: AgentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> AgentResponse:
    return await agent_service.update_status(db, org_id, agent_id, data)
