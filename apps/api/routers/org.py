from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import (
    get_current_org,
    get_current_user,
    require_role,
)
from models.user import User
from schemas.org import (
    AIProviderConfig,
    AIProviderSetRequest,
    AIProvidersListResponse,
    AIProviderTestResponse,
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyResponse,
    InviteMemberRequest,
    MemberResponse,
    OrgResponse,
    OrgUpdateRequest,
    UpdateRoleRequest,
)
from services import api_key_service, org_service

router = APIRouter(prefix="/org", tags=["organization"])


@router.get("", response_model=OrgResponse)
async def get_org(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> OrgResponse:
    return await org_service.get_org(db, org_id)


@router.put("", response_model=OrgResponse)
async def update_org(
    data: OrgUpdateRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
) -> OrgResponse:
    return await org_service.update_org(db, org_id, name=data.name, settings=data.settings)


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[MemberResponse]:
    return await org_service.list_members(db, org_id)


@router.post(
    "/members/invite",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    data: InviteMemberRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
) -> MemberResponse:
    return await org_service.invite_member(db, org_id, email=data.email, role=data.role)


@router.put("/members/{membership_id}/role", response_model=MemberResponse)
async def update_member_role(
    membership_id: UUID,
    data: UpdateRoleRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    role: str = Depends(require_role("admin")),
) -> MemberResponse:
    return await org_service.update_member_role(
        db, org_id, membership_id, role=data.role, requester_role=role
    )


@router.delete("/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    membership_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
):
    await org_service.remove_member(db, org_id, membership_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[ApiKeyResponse]:
    return await api_key_service.list_api_keys(db, org_id)


@router.post(
    "/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    data: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    _role: str = Depends(require_role("admin")),
) -> ApiKeyCreatedResponse:
    return await api_key_service.create_api_key(
        db,
        org_id=org_id,
        created_by=current_user.id,
        name=data.name,
        scopes=data.scopes,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
):
    await api_key_service.revoke_api_key(db, org_id, key_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# AI Provider Key Management
# ---------------------------------------------------------------------------


@router.get("/ai-providers", response_model=AIProvidersListResponse)
async def list_ai_providers(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
) -> AIProvidersListResponse:
    """List all supported AI providers and their configuration status."""
    providers = await org_service.get_ai_providers(db, org_id)
    return AIProvidersListResponse(providers=providers)


@router.put("/ai-providers/{provider}", response_model=AIProviderConfig)
async def set_ai_provider(
    provider: str,
    data: AIProviderSetRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
) -> AIProviderConfig:
    """Store an AI provider API key and/or base URL in org settings."""
    return await org_service.set_ai_provider(
        db,
        org_id,
        provider=provider,
        api_key=data.api_key,
        base_url=data.base_url,
    )


@router.delete("/ai-providers/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ai_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
):
    """Remove an AI provider configuration from org settings."""
    await org_service.remove_ai_provider(db, org_id, provider)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/ai-providers/{provider}/test", response_model=AIProviderTestResponse)
async def test_ai_provider(
    provider: str,
    data: AIProviderSetRequest | None = None,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
) -> AIProviderTestResponse:
    """Test an AI provider connection.

    Uses credentials from the request body if provided, otherwise falls back
    to org settings, then environment variables.
    """
    # Resolve the key/url to use: request body > org settings > env var
    api_key: str | None = None
    base_url: str | None = None

    if data and data.api_key:
        api_key = data.api_key
    if data and data.base_url:
        base_url = data.base_url

    # Fallback to org settings (read raw values, not masked)
    if not api_key and not base_url:
        org = await org_service._load_org(db, org_id)
        ai_providers: dict = (org.settings or {}).get("ai_providers", {})
        stored = ai_providers.get(provider, {})
        api_key = api_key or stored.get("api_key")
        base_url = base_url or stored.get("base_url")

    # Fallback to env vars
    if not api_key and provider in ("openai", "anthropic", "google"):
        from core.config import settings

        env_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "google": "GOOGLE_API_KEY",
        }
        api_key = getattr(settings, env_map[provider], None)

    if not base_url and provider == "ollama":
        from core.config import settings

        base_url = getattr(settings, "OLLAMA_URL", None)

    return await org_service.test_ai_provider(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
    )
