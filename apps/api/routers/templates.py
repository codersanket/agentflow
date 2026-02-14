from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from models.user import User
from schemas.agent import AgentResponse
from schemas.common import PaginatedResponse
from schemas.template import (
    InstallTemplateRequest,
    PublishTemplateRequest,
    TemplateDetailResponse,
    TemplateResponse,
)
from services import template_service

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=PaginatedResponse[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    cursor: str | None = None,
    limit: int = 20,
    category: str | None = None,
    search: str | None = None,
) -> PaginatedResponse[TemplateResponse]:
    return await template_service.list_templates(
        db, cursor=cursor, limit=limit, category=category, search=search
    )


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TemplateDetailResponse:
    return await template_service.get_template(db, template_id)


@router.post(
    "/{template_id}/install",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def install_template(
    template_id: UUID,
    data: InstallTemplateRequest | None = None,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    install_data = data or InstallTemplateRequest()
    agent = await template_service.install_template(
        db, org_id, current_user.id, template_id, install_data
    )
    from services.agent_service import _agent_to_response

    return _agent_to_response(agent)


@router.post(
    "",
    response_model=TemplateDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def publish_template(
    data: PublishTemplateRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> TemplateDetailResponse:
    return await template_service.publish_as_template(db, org_id, data)
