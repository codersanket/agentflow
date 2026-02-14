from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from models.user import User
from schemas.integration import (
    AvailableIntegrationResponse,
    ConnectIntegrationRequest,
    IntegrationResponse,
)
from services import integration_service

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[IntegrationResponse]:
    return await integration_service.list_integrations(db, org_id)


@router.post(
    "/{provider}/connect",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def connect_integration(
    provider: str,
    data: ConnectIntegrationRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
) -> IntegrationResponse:
    return await integration_service.connect_integration(
        db, org_id, current_user.id, provider, data
    )


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
):
    await integration_service.disconnect_integration(db, org_id, integration_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/available", response_model=list[AvailableIntegrationResponse])
async def list_available_providers(
    _user: User = Depends(get_current_user),
) -> list[AvailableIntegrationResponse]:
    return integration_service.list_available_providers()
