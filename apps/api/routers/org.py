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


@router.delete(
    "/members/{membership_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def remove_member(
    membership_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
):
    await org_service.remove_member(db, org_id, membership_id)


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


@router.delete(
    "/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def revoke_api_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _role: str = Depends(require_role("admin")),
):
    await api_key_service.revoke_api_key(db, org_id, key_id)
