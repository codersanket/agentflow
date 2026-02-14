from __future__ import annotations

import base64
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.agent import Agent, AgentEdge, AgentNode, AgentVersion
from schemas.agent import (
    AgentCreate,
    AgentEdgeSchema,
    AgentNodeSchema,
    AgentResponse,
    AgentStatusUpdate,
    AgentUpdate,
    AgentVersionResponse,
    PublishVersionRequest,
)
from schemas.common import PaginatedResponse

VALID_STATUS_TRANSITIONS = {
    "draft": {"active", "archived"},
    "active": {"paused", "archived"},
    "paused": {"active", "archived"},
    "archived": set(),
}


async def list_agents(
    db: AsyncSession,
    org_id: UUID,
    cursor: str | None = None,
    limit: int = 20,
    status_filter: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
) -> PaginatedResponse[AgentResponse]:
    query = select(Agent).where(Agent.org_id == org_id)

    if status_filter:
        query = query.where(Agent.status == status_filter)

    # Exclude archived by default unless explicitly requested
    if status_filter != "archived":
        query = query.where(Agent.status != "archived")

    # Sorting
    sort_col = getattr(Agent, sort, Agent.created_at)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    # Cursor-based pagination
    if cursor:
        try:
            cursor_bytes = base64.b64decode(cursor)
            cursor_val = cursor_bytes.decode("utf-8")
            query = query.where(Agent.created_at < datetime.fromisoformat(cursor_val))
        except Exception:
            pass

    query = query.limit(limit + 1)

    result = await db.execute(query)
    agents = list(result.scalars().all())

    has_more = len(agents) > limit
    if has_more:
        agents = agents[:limit]

    next_cursor = None
    if has_more and agents:
        last_created = agents[-1].created_at.isoformat()
        next_cursor = base64.b64encode(last_created.encode("utf-8")).decode("utf-8")

    items = [_agent_to_response(agent) for agent in agents]

    return PaginatedResponse(items=items, cursor=next_cursor, has_more=has_more)


async def create_agent(
    db: AsyncSession,
    org_id: UUID,
    created_by: UUID,
    data: AgentCreate,
) -> AgentResponse:
    agent = Agent(
        org_id=org_id,
        created_by=created_by,
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        trigger_config=data.trigger_config,
        settings=data.settings,
        template_id=data.template_id,
    )
    db.add(agent)
    await db.flush()

    return _agent_to_response(agent)


async def get_agent(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> AgentResponse:
    agent = await _get_agent_or_404(db, org_id, agent_id)

    # Load latest version with nodes and edges
    version_result = await db.execute(
        select(AgentVersion)
        .where(AgentVersion.agent_id == agent_id)
        .options(selectinload(AgentVersion.nodes), selectinload(AgentVersion.edges))
        .order_by(AgentVersion.version.desc())
        .limit(1)
    )
    latest_version = version_result.scalar_one_or_none()

    return _agent_to_response(agent, latest_version)


async def update_agent(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
    data: AgentUpdate,
) -> AgentResponse:
    agent = await _get_agent_or_404(db, org_id, agent_id)

    if agent.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update an archived agent",
        )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)

    agent.updated_at = datetime.now(UTC)
    await db.flush()

    return _agent_to_response(agent)


async def delete_agent(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> None:
    agent = await _get_agent_or_404(db, org_id, agent_id)
    agent.status = "archived"
    agent.updated_at = datetime.now(UTC)
    await db.flush()


async def publish_version(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
    user_id: UUID,
    data: PublishVersionRequest,
) -> AgentVersionResponse:
    agent = await _get_agent_or_404(db, org_id, agent_id)

    if agent.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot publish a version for an archived agent",
        )

    # Validate definition has nodes
    definition = data.definition
    nodes_data = definition.get("nodes", [])
    if not nodes_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent definition must contain at least one node",
        )

    # Get next version number
    max_version_result = await db.execute(
        select(func.max(AgentVersion.version)).where(AgentVersion.agent_id == agent_id)
    )
    max_version = max_version_result.scalar() or 0
    next_version = max_version + 1

    # Create version
    version = AgentVersion(
        agent_id=agent_id,
        version=next_version,
        definition=definition,
        change_message=data.change_message,
        created_by=user_id,
        is_published=True,
    )
    db.add(version)
    await db.flush()

    # Create nodes
    node_id_map: dict[str, UUID] = {}
    for node_data in nodes_data:
        node = AgentNode(
            agent_version_id=version.id,
            node_type=node_data["node_type"],
            node_subtype=node_data["node_subtype"],
            label=node_data.get("label"),
            config=node_data.get("config", {}),
            position_x=node_data.get("position_x", 0),
            position_y=node_data.get("position_y", 0),
        )
        db.add(node)
        await db.flush()
        # Map temp ID or index to real ID for edge references
        temp_id = node_data.get("id") or node_data.get("temp_id") or str(node.id)
        node_id_map[temp_id] = node.id

    # Create edges
    edges_data = definition.get("edges", [])
    for edge_data in edges_data:
        source_id = node_id_map.get(str(edge_data["source_node_id"]))
        target_id = node_id_map.get(str(edge_data["target_node_id"]))

        if source_id is None or target_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Edge references invalid node IDs",
            )

        edge = AgentEdge(
            agent_version_id=version.id,
            source_node_id=source_id,
            target_node_id=target_id,
            condition=edge_data.get("condition"),
            label=edge_data.get("label"),
        )
        db.add(edge)

    await db.flush()

    # Reload with relationships
    version_result = await db.execute(
        select(AgentVersion)
        .where(AgentVersion.id == version.id)
        .options(selectinload(AgentVersion.nodes), selectinload(AgentVersion.edges))
    )
    version = version_result.scalar_one()

    return _version_to_response(version)


async def list_versions(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> list[AgentVersionResponse]:
    # Verify agent belongs to org
    await _get_agent_or_404(db, org_id, agent_id)

    result = await db.execute(
        select(AgentVersion)
        .where(AgentVersion.agent_id == agent_id)
        .options(selectinload(AgentVersion.nodes), selectinload(AgentVersion.edges))
        .order_by(AgentVersion.version.desc())
    )
    versions = result.scalars().all()

    return [_version_to_response(v) for v in versions]


async def update_status(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
    data: AgentStatusUpdate,
) -> AgentResponse:
    agent = await _get_agent_or_404(db, org_id, agent_id)

    allowed = VALID_STATUS_TRANSITIONS.get(agent.status, set())
    if data.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{agent.status}' to '{data.status}'",
        )

    # Require at least one published version to go active
    if data.status == "active":
        version_count = await db.execute(
            select(func.count(AgentVersion.id)).where(
                AgentVersion.agent_id == agent_id,
                AgentVersion.is_published.is_(True),
            )
        )
        if version_count.scalar() == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent must have at least one published version to be activated",
            )

    agent.status = data.status
    agent.updated_at = datetime.now(UTC)
    await db.flush()

    return _agent_to_response(agent)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_agent_or_404(
    db: AsyncSession,
    org_id: UUID,
    agent_id: UUID,
) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id)
    )
    agent = result.scalar_one_or_none()

    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )

    return agent


def _agent_to_response(
    agent: Agent,
    latest_version: AgentVersion | None = None,
) -> AgentResponse:
    return AgentResponse(
        id=agent.id,
        org_id=agent.org_id,
        created_by=agent.created_by,
        name=agent.name,
        description=agent.description,
        status=agent.status,
        trigger_type=agent.trigger_type,
        trigger_config=agent.trigger_config,
        is_template=agent.is_template,
        template_id=agent.template_id,
        settings=agent.settings,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        latest_version=_version_to_response(latest_version) if latest_version else None,
    )


def _version_to_response(version: AgentVersion) -> AgentVersionResponse:
    nodes = []
    if hasattr(version, "nodes") and version.nodes:
        nodes = [
            AgentNodeSchema(
                id=n.id,
                node_type=n.node_type,
                node_subtype=n.node_subtype,
                label=n.label,
                config=n.config,
                position_x=n.position_x,
                position_y=n.position_y,
            )
            for n in version.nodes
        ]

    edges = []
    if hasattr(version, "edges") and version.edges:
        edges = [
            AgentEdgeSchema(
                id=e.id,
                source_node_id=e.source_node_id,
                target_node_id=e.target_node_id,
                condition=e.condition,
                label=e.label,
            )
            for e in version.edges
        ]

    return AgentVersionResponse(
        id=version.id,
        agent_id=version.agent_id,
        version=version.version,
        definition=version.definition,
        change_message=version.change_message,
        created_by=version.created_by,
        is_published=version.is_published,
        created_at=version.created_at,
        nodes=nodes,
        edges=edges,
    )
