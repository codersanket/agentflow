from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentNodeSchema(BaseModel):
    id: UUID | None = None
    node_type: str
    node_subtype: str
    label: str | None = None
    config: dict = Field(default_factory=dict)
    position_x: float = 0
    position_y: float = 0

    model_config = ConfigDict(from_attributes=True)


class AgentEdgeSchema(BaseModel):
    id: UUID | None = None
    source_node_id: UUID
    target_node_id: UUID
    condition: dict | None = None
    label: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict = Field(default_factory=dict)
    settings: dict = Field(default_factory=dict)
    template_id: UUID | None = None


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    trigger_type: str | None = None
    trigger_config: dict | None = None
    settings: dict | None = None


class AgentStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|paused|archived)$")


class PublishVersionRequest(BaseModel):
    change_message: str | None = None
    definition: dict = Field(
        ...,
        description="The agent definition containing nodes and edges",
    )


class AgentVersionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    version: int
    definition: dict
    change_message: str | None
    created_by: UUID | None
    is_published: bool
    created_at: datetime
    nodes: list[AgentNodeSchema] = []
    edges: list[AgentEdgeSchema] = []

    model_config = ConfigDict(from_attributes=True)


class AgentResponse(BaseModel):
    id: UUID
    org_id: UUID
    created_by: UUID
    name: str
    description: str | None
    status: str
    trigger_type: str | None
    trigger_config: dict
    is_template: bool
    template_id: UUID | None
    settings: dict
    created_at: datetime
    updated_at: datetime
    latest_version: AgentVersionResponse | None = None

    model_config = ConfigDict(from_attributes=True)
