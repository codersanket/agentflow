from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    category: str | None
    icon: str | None
    is_official: bool
    is_public: bool
    author_org_id: UUID | None
    install_count: int
    rating: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateDetailResponse(TemplateResponse):
    definition: dict

    model_config = ConfigDict(from_attributes=True)


class PublishTemplateRequest(BaseModel):
    agent_id: UUID = Field(..., description="The agent to publish as a template")
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(
        default=None,
        pattern="^(support|sales|engineering|hr|marketing)$",
    )
    icon: str | None = None
    is_public: bool = True


class InstallTemplateRequest(BaseModel):
    name: str | None = Field(
        default=None,
        max_length=255,
        description="Override name for the new agent. Defaults to template name.",
    )
