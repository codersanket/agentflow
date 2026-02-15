from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectIntegrationRequest(BaseModel):
    """Request body for connecting an integration."""

    name: str | None = Field(default=None, max_length=255)
    credentials: dict = Field(
        ...,
        description="Provider-specific credentials (e.g. bot_token for Slack)",
    )
    scopes: list[str] | None = None


class IntegrationResponse(BaseModel):
    """Response for a connected integration."""

    id: UUID
    org_id: UUID
    provider: str
    name: str | None
    status: str
    scopes: list[str] | None
    connected_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AvailableIntegrationResponse(BaseModel):
    """Describes an integration provider that can be connected."""

    provider: str
    name: str
    description: str
    auth_method: str = Field(
        default="credentials",
        description="How to connect: 'oauth' opens a popup flow, 'credentials' shows a form",
    )
    actions: list[AvailableActionResponse]


class AvailableActionResponse(BaseModel):
    """Describes a single action offered by a provider."""

    name: str
    description: str
    parameters: dict[str, str]
