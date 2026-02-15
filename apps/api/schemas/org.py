from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class OrgResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    settings: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    settings: dict | None = None


class MemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: str
    name: str | None
    role: str
    created_at: datetime


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="member", pattern=r"^(viewer|editor|admin)$")


class UpdateRoleRequest(BaseModel):
    role: str = Field(pattern=r"^(viewer|editor|admin|owner)$")


class ApiKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scopes: list[str] = Field(default=["agents:read", "agents:write", "executions:read"])


class ApiKeyResponse(BaseModel):
    id: UUID
    name: str | None
    key_prefix: str
    scopes: list[str]
    is_active: bool
    last_used_at: datetime | None
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(BaseModel):
    id: UUID
    name: str | None
    key: str
    key_prefix: str
    scopes: list[str]


# --- AI Provider Key Management ---


class AIProviderConfig(BaseModel):
    provider: str  # "openai", "anthropic", "google", "ollama"
    api_key: str | None = None  # masked on read
    base_url: str | None = None  # for ollama/custom endpoints
    is_configured: bool = False


class AIProviderSetRequest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None


class AIProviderTestResponse(BaseModel):
    success: bool
    message: str
    model_used: str | None = None


class AIProvidersListResponse(BaseModel):
    providers: list[AIProviderConfig]
