from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.organization import Organization, OrgMembership
from models.user import User
from schemas.org import MemberResponse, OrgResponse


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
