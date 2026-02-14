from __future__ import annotations

import base64
import json
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from engine.tools.registry import build_default_registry
from models.integration import Integration
from schemas.integration import (
    AvailableActionResponse,
    AvailableIntegrationResponse,
    ConnectIntegrationRequest,
    IntegrationResponse,
)


def _encrypt_credentials(creds: dict) -> str:
    """Encode credentials as base64 JSON.

    This is intentionally simple for the open-source phase.  Production
    deployments should replace this with AES-256-GCM backed by a KMS key.
    """
    return base64.b64encode(json.dumps(creds).encode()).decode()


def _decrypt_credentials(encrypted: str) -> dict:
    """Decode base64-encoded credentials back to a dict."""
    return json.loads(base64.b64decode(encrypted).decode())


async def list_integrations(
    db: AsyncSession,
    org_id: UUID,
) -> list[IntegrationResponse]:
    result = await db.execute(
        select(Integration)
        .where(Integration.org_id == org_id)
        .order_by(Integration.created_at.desc())
    )
    integrations = result.scalars().all()
    return [_to_response(i) for i in integrations]


async def connect_integration(
    db: AsyncSession,
    org_id: UUID,
    user_id: UUID,
    provider: str,
    data: ConnectIntegrationRequest,
) -> IntegrationResponse:
    # Validate provider is known
    registry = build_default_registry()
    if not registry.has(provider):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown integration provider: {provider}",
        )

    integration = Integration(
        org_id=org_id,
        provider=provider,
        name=data.name or provider.capitalize(),
        status="connected",
        credentials_encrypted=_encrypt_credentials(data.credentials),
        scopes=data.scopes,
        connected_by=user_id,
    )
    db.add(integration)
    await db.flush()
    return _to_response(integration)


async def disconnect_integration(
    db: AsyncSession,
    org_id: UUID,
    integration_id: UUID,
) -> None:
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.org_id == org_id,
        )
    )
    integration = result.scalar_one_or_none()

    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Integration not found",
        )

    await db.delete(integration)
    await db.flush()


def list_available_providers() -> list[AvailableIntegrationResponse]:
    """Return metadata for all built-in integration providers."""
    registry = build_default_registry()
    providers: list[AvailableIntegrationResponse] = []
    for tool in registry.list_tools():
        actions = [
            AvailableActionResponse(
                name=a.name,
                description=a.description,
                parameters=a.parameters,
            )
            for a in tool.actions
        ]
        providers.append(
            AvailableIntegrationResponse(
                provider=tool.name,
                name=tool.name.replace("_", " ").title(),
                description=tool.description,
                actions=actions,
            )
        )
    return providers


def _to_response(integration: Integration) -> IntegrationResponse:
    return IntegrationResponse(
        id=integration.id,
        org_id=integration.org_id,
        provider=integration.provider,
        name=integration.name,
        status=integration.status,
        scopes=integration.scopes,
        connected_by=integration.connected_by,
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )
