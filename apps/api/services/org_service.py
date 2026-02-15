from __future__ import annotations

import logging
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.organization import Organization, OrgMembership
from models.user import User
from schemas.org import AIProviderConfig, AIProviderTestResponse, MemberResponse, OrgResponse

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = ("openai", "anthropic", "google", "ollama")

# Map provider name -> env var attribute on Settings
_ENV_VAR_MAP: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
    "ollama": "OLLAMA_URL",
}


async def get_org(db: AsyncSession, org_id: UUID) -> OrgResponse:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return OrgResponse.model_validate(org)


async def update_org(
    db: AsyncSession,
    org_id: UUID,
    name: str | None = None,
    settings: dict | None = None,
) -> OrgResponse:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()

    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    if name is not None:
        org.name = name
    if settings is not None:
        org.settings = settings

    await db.flush()
    return OrgResponse.model_validate(org)


async def list_members(
    db: AsyncSession,
    org_id: UUID,
) -> list[MemberResponse]:
    result = await db.execute(
        select(OrgMembership, User)
        .join(User, OrgMembership.user_id == User.id)
        .where(OrgMembership.org_id == org_id)
        .order_by(OrgMembership.created_at)
    )
    rows = result.all()

    return [
        MemberResponse(
            id=membership.id,
            user_id=user.id,
            email=user.email,
            name=user.name,
            role=membership.role,
            created_at=membership.created_at,
        )
        for membership, user in rows
    ]


async def invite_member(
    db: AsyncSession,
    org_id: UUID,
    email: str,
    role: str,
) -> MemberResponse:
    # Check if user already exists
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()

    if user is None:
        # Create a stub user (no password — they'll set it when they accept)
        user = User(email=email)
        db.add(user)
        await db.flush()

    # Check if already a member
    existing = await db.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user.id,
            OrgMembership.org_id == org_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    membership = OrgMembership(user_id=user.id, org_id=org_id, role=role)
    db.add(membership)
    await db.flush()

    # TODO: Send invitation email

    return MemberResponse(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=membership.role,
        created_at=membership.created_at,
    )


async def update_member_role(
    db: AsyncSession,
    org_id: UUID,
    membership_id: UUID,
    role: str,
    requester_role: str,
) -> MemberResponse:
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.id == membership_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Only owners can assign the owner role
    if role == "owner" and requester_role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can assign the owner role",
        )

    membership.role = role
    await db.flush()

    user_result = await db.execute(select(User).where(User.id == membership.user_id))
    user = user_result.scalar_one()

    return MemberResponse(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=membership.role,
        created_at=membership.created_at,
    )


async def remove_member(
    db: AsyncSession,
    org_id: UUID,
    membership_id: UUID,
) -> None:
    result = await db.execute(
        select(OrgMembership).where(
            OrgMembership.id == membership_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = result.scalar_one_or_none()

    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    # Prevent removing the last owner
    if membership.role == "owner":
        owner_count = await db.execute(
            select(OrgMembership).where(
                OrgMembership.org_id == org_id,
                OrgMembership.role == "owner",
            )
        )
        if len(owner_count.scalars().all()) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner",
            )

    await db.delete(membership)
    await db.flush()


# ---------------------------------------------------------------------------
# AI Provider key management
# ---------------------------------------------------------------------------


def _mask_key(key: str) -> str:
    """Return a masked version of an API key, showing only the last 4 chars."""
    if len(key) <= 4:
        return "****"
    return f"{'*' * (len(key) - 4)}{key[-4:]}"


async def _load_org(db: AsyncSession, org_id: UUID) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


async def get_ai_providers(db: AsyncSession, org_id: UUID) -> list[AIProviderConfig]:
    """Return the AI provider configuration for all supported providers.

    For each provider, checks org settings first, then falls back to env vars.
    API keys are always masked in the response.
    """
    org = await _load_org(db, org_id)
    ai_providers: dict = (org.settings or {}).get("ai_providers", {})

    configs: list[AIProviderConfig] = []
    for provider_name in SUPPORTED_PROVIDERS:
        stored = ai_providers.get(provider_name, {})
        stored_key = stored.get("api_key")
        stored_url = stored.get("base_url")

        # Check env var fallback
        env_attr = _ENV_VAR_MAP.get(provider_name)
        env_value = getattr(settings, env_attr, None) if env_attr else None

        if stored_key:
            configs.append(
                AIProviderConfig(
                    provider=provider_name,
                    api_key=_mask_key(stored_key),
                    base_url=stored_url,
                    is_configured=True,
                )
            )
        elif env_value:
            # Env var is set but key is not in org settings
            masked = _mask_key(env_value) if provider_name != "ollama" else None
            configs.append(
                AIProviderConfig(
                    provider=provider_name,
                    api_key=masked,
                    base_url=env_value if provider_name == "ollama" else None,
                    is_configured=True,
                )
            )
        else:
            configs.append(
                AIProviderConfig(
                    provider=provider_name,
                    api_key=None,
                    base_url=stored_url,
                    is_configured=False,
                )
            )

    return configs


async def set_ai_provider(
    db: AsyncSession,
    org_id: UUID,
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
) -> AIProviderConfig:
    """Store an AI provider key/url in org settings and return the masked config.

    # TODO: Encrypt credentials with AES-256 before storing. For MVP, storing in
    # JSONB is acceptable since the database is already behind auth.
    """
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}. "
            f"Must be one of: {', '.join(SUPPORTED_PROVIDERS)}",
        )

    org = await _load_org(db, org_id)

    current_settings = dict(org.settings or {})
    ai_providers = dict(current_settings.get("ai_providers", {}))

    provider_data: dict = {}
    if api_key is not None:
        provider_data["api_key"] = api_key
    if base_url is not None:
        provider_data["base_url"] = base_url

    ai_providers[provider] = provider_data
    current_settings["ai_providers"] = ai_providers

    # Reassign to trigger SQLAlchemy JSONB change detection
    org.settings = current_settings
    await db.flush()

    return AIProviderConfig(
        provider=provider,
        api_key=_mask_key(api_key) if api_key else None,
        base_url=base_url,
        is_configured=bool(api_key or base_url),
    )


async def remove_ai_provider(db: AsyncSession, org_id: UUID, provider: str) -> None:
    """Remove an AI provider entry from org settings."""
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}. "
            f"Must be one of: {', '.join(SUPPORTED_PROVIDERS)}",
        )

    org = await _load_org(db, org_id)

    current_settings = dict(org.settings or {})
    ai_providers = dict(current_settings.get("ai_providers", {}))

    ai_providers.pop(provider, None)
    current_settings["ai_providers"] = ai_providers

    org.settings = current_settings
    await db.flush()


async def test_ai_provider(
    provider: str,
    api_key: str | None = None,
    base_url: str | None = None,
) -> AIProviderTestResponse:
    """Test an AI provider connection by making a minimal API call."""
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}. "
            f"Must be one of: {', '.join(SUPPORTED_PROVIDERS)}",
        )

    try:
        if provider == "openai":
            return await _test_openai(api_key)
        elif provider == "anthropic":
            return await _test_anthropic(api_key)
        elif provider == "google":
            return await _test_google(api_key)
        elif provider == "ollama":
            return await _test_ollama(base_url)
        else:
            return AIProviderTestResponse(success=False, message="Unknown provider")
    except Exception as exc:
        logger.warning("AI provider test failed for %s: %s", provider, exc)
        return AIProviderTestResponse(
            success=False,
            message=f"Connection failed: {exc}",
        )


async def _test_openai(api_key: str | None) -> AIProviderTestResponse:
    if not api_key:
        return AIProviderTestResponse(success=False, message="No API key provided")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if resp.status_code == 200:
        models = resp.json().get("data", [])
        first_model = models[0]["id"] if models else None
        return AIProviderTestResponse(
            success=True,
            message="Successfully connected to OpenAI",
            model_used=first_model,
        )
    return AIProviderTestResponse(
        success=False,
        message=f"OpenAI returned status {resp.status_code}: {resp.text[:200]}",
    )


async def _test_anthropic(api_key: str | None) -> AIProviderTestResponse:
    if not api_key:
        return AIProviderTestResponse(success=False, message="No API key provided")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )
    if resp.status_code == 200:
        return AIProviderTestResponse(
            success=True,
            message="Successfully connected to Anthropic",
            model_used="claude-haiku-4-5-20251001",
        )
    return AIProviderTestResponse(
        success=False,
        message=f"Anthropic returned status {resp.status_code}: {resp.text[:200]}",
    )


async def _test_google(api_key: str | None) -> AIProviderTestResponse:
    if not api_key:
        return AIProviderTestResponse(success=False, message="No API key provided")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
        )
    if resp.status_code == 200:
        models = resp.json().get("models", [])
        first_model = models[0]["name"] if models else None
        return AIProviderTestResponse(
            success=True,
            message="Successfully connected to Google AI",
            model_used=first_model,
        )
    return AIProviderTestResponse(
        success=False,
        message=f"Google AI returned status {resp.status_code}: {resp.text[:200]}",
    )


async def _test_ollama(base_url: str | None) -> AIProviderTestResponse:
    url = base_url or "http://localhost:11434"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{url}/api/tags")
    if resp.status_code == 200:
        models = resp.json().get("models", [])
        first_model = models[0]["name"] if models else None
        return AIProviderTestResponse(
            success=True,
            message="Successfully connected to Ollama",
            model_used=first_model,
        )
    return AIProviderTestResponse(
        success=False,
        message=f"Ollama returned status {resp.status_code}",
    )
