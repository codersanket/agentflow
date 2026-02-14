from __future__ import annotations

import hashlib
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.integration import ApiKey
from schemas.org import ApiKeyCreatedResponse, ApiKeyResponse


def _generate_api_key() -> tuple[str, str, str]:
    """Generate an API key, returning (full_key, prefix, hash)."""
    raw = secrets.token_urlsafe(32)
    full_key = f"af_{raw}"
    prefix = full_key[:10]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


async def create_api_key(
    db: AsyncSession,
    org_id: UUID,
    created_by: UUID,
    name: str,
    scopes: list[str],
) -> ApiKeyCreatedResponse:
    full_key, prefix, key_hash = _generate_api_key()

    api_key = ApiKey(
        org_id=org_id,
        created_by=created_by,
        name=name,
        key_hash=key_hash,
        key_prefix=prefix,
        scopes=scopes,
    )
    db.add(api_key)
    await db.flush()

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key=full_key,
        key_prefix=prefix,
        scopes=scopes,
    )


async def list_api_keys(
    db: AsyncSession,
    org_id: UUID,
) -> list[ApiKeyResponse]:
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.org_id == org_id, ApiKey.is_active.is_(True))
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


async def revoke_api_key(
    db: AsyncSession,
    org_id: UUID,
    key_id: UUID,
) -> None:
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.org_id == org_id))
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.is_active = False
    await db.flush()
