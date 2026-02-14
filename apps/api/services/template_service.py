from __future__ import annotations

import base64
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.agent import Agent
from models.template import AgentTemplate
from schemas.common import PaginatedResponse
from schemas.template import (
    InstallTemplateRequest,
    PublishTemplateRequest,
    TemplateDetailResponse,
    TemplateResponse,
)


async def list_templates(
    db: AsyncSession,
    cursor: str | None = None,
    limit: int = 20,
    category: str | None = None,
    search: str | None = None,
) -> PaginatedResponse[TemplateResponse]:
    query = select(AgentTemplate).where(AgentTemplate.is_public.is_(True))

    if category:
        query = query.where(AgentTemplate.category == category)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            AgentTemplate.name.ilike(pattern) | AgentTemplate.description.ilike(pattern)
        )

    query = query.order_by(AgentTemplate.install_count.desc(), AgentTemplate.created_at.desc())

    if cursor:
        try:
            cursor_bytes = base64.b64decode(cursor)
            cursor_val = cursor_bytes.decode("utf-8")
            query = query.where(AgentTemplate.created_at < datetime.fromisoformat(cursor_val))
        except Exception:
            pass

    query = query.limit(limit + 1)

    result = await db.execute(query)
    templates = list(result.scalars().all())

    has_more = len(templates) > limit
    if has_more:
        templates = templates[:limit]

    next_cursor = None
    if has_more and templates:
        last_created = templates[-1].created_at.isoformat()
        next_cursor = base64.b64encode(last_created.encode("utf-8")).decode("utf-8")

    items = [_template_to_response(t) for t in templates]

    return PaginatedResponse(items=items, cursor=next_cursor, has_more=has_more)


async def get_template(
    db: AsyncSession,
    template_id: UUID,
) -> TemplateDetailResponse:
    template = await _get_template_or_404(db, template_id)
    return _template_to_detail_response(template)


async def install_template(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    template_id: UUID,
    data: InstallTemplateRequest,
) -> Agent:
    template = await _get_template_or_404(db, template_id)

    agent_name = data.name or template.name

    agent = Agent(
        org_id=org_id,
        created_by=user_id,
        name=agent_name,
        description=template.description,
        trigger_type=template.definition.get("trigger_type"),
        trigger_config=template.definition.get("trigger_config", {}),
        template_id=template.id,
        settings=template.definition.get("settings", {}),
    )
    db.add(agent)
    await db.flush()

    # Increment install count
    template.install_count = template.install_count + 1
    await db.flush()

    return agent


async def publish_as_template(
    db: AsyncSession,
    org_id: UUID,
    data: PublishTemplateRequest,
) -> TemplateDetailResponse:
    # Verify the agent belongs to the org
    result = await db.execute(
        select(Agent).where(Agent.id == data.agent_id, Agent.org_id == org_id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    # Build definition from the agent
    definition: dict = {
        "trigger_type": agent.trigger_type,
        "trigger_config": agent.trigger_config,
        "settings": agent.settings,
    }

    template = AgentTemplate(
        name=data.name,
        description=data.description,
        category=data.category,
        definition=definition,
        icon=data.icon,
        is_official=False,
        is_public=data.is_public,
        author_org_id=org_id,
    )
    db.add(template)
    await db.flush()

    return _template_to_detail_response(template)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_template_or_404(
    db: AsyncSession,
    template_id: UUID,
) -> AgentTemplate:
    result = await db.execute(
        select(AgentTemplate).where(AgentTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    return template


def _template_to_response(template: AgentTemplate) -> TemplateResponse:
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        category=template.category,
        icon=template.icon,
        is_official=template.is_official,
        is_public=template.is_public,
        author_org_id=template.author_org_id,
        install_count=template.install_count,
        rating=template.rating,
        created_at=template.created_at,
    )


def _template_to_detail_response(template: AgentTemplate) -> TemplateDetailResponse:
    return TemplateDetailResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        category=template.category,
        definition=template.definition,
        icon=template.icon,
        is_official=template.is_official,
        is_public=template.is_public,
        author_org_id=template.author_org_id,
        install_count=template.install_count,
        rating=template.rating,
        created_at=template.created_at,
    )
