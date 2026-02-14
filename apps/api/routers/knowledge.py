from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_org, get_current_user
from models.user import User
from schemas.common import PaginatedResponse
from schemas.knowledge import (
    DocumentResponse,
    DocumentUploadResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    QueryRequest,
    QueryResponse,
)
from services import knowledge_service

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge"])


@router.get("", response_model=PaginatedResponse[KnowledgeBaseResponse])
async def list_knowledge_bases(
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
    cursor: str | None = None,
    limit: int = 20,
) -> PaginatedResponse[KnowledgeBaseResponse]:
    return await knowledge_service.list_knowledge_bases(db, org_id, cursor=cursor, limit=limit)


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    data: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> KnowledgeBaseResponse:
    return await knowledge_service.create_knowledge_base(db, org_id, data)


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> KnowledgeBaseResponse:
    return await knowledge_service.get_knowledge_base(db, org_id, kb_id)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
):
    await knowledge_service.delete_knowledge_base(db, org_id, kb_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{kb_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    kb_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> DocumentUploadResponse:
    return await knowledge_service.upload_document(db, org_id, kb_id, file)


@router.get("/{kb_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    kb_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> list[DocumentResponse]:
    return await knowledge_service.list_documents(db, org_id, kb_id)


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    kb_id: UUID,
    doc_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
):
    await knowledge_service.delete_document(db, org_id, kb_id, doc_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{kb_id}/query", response_model=QueryResponse)
async def query_knowledge_base(
    kb_id: UUID,
    data: QueryRequest,
    db: AsyncSession = Depends(get_db),
    org_id: UUID = Depends(get_current_org),
    _user: User = Depends(get_current_user),
) -> QueryResponse:
    return await knowledge_service.query_knowledge_base(db, org_id, kb_id, data)
