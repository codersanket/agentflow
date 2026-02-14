from __future__ import annotations

import base64
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from engine.rag.embeddings import generate_embeddings
from engine.rag.retrieval import vector_search
from models.knowledge import Document, KnowledgeBase
from schemas.common import PaginatedResponse
from schemas.knowledge import (
    ChunkResultSchema,
    DocumentResponse,
    DocumentUploadResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    QueryRequest,
    QueryResponse,
)

UPLOAD_DIR = Path("uploads")


async def create_knowledge_base(
    db: AsyncSession,
    org_id: UUID,
    data: KnowledgeBaseCreate,
) -> KnowledgeBaseResponse:
    kb = KnowledgeBase(
        org_id=org_id,
        name=data.name,
        description=data.description,
        embedding_model=data.embedding_model,
        chunk_size=data.chunk_size,
        chunk_overlap=data.chunk_overlap,
    )
    db.add(kb)
    await db.flush()
    return _kb_to_response(kb, document_count=0)


async def list_knowledge_bases(
    db: AsyncSession,
    org_id: UUID,
    cursor: str | None = None,
    limit: int = 20,
) -> PaginatedResponse[KnowledgeBaseResponse]:
    query = select(KnowledgeBase).where(
        KnowledgeBase.org_id == org_id,
        KnowledgeBase.status != "deleted",
    )
    query = query.order_by(KnowledgeBase.created_at.desc())

    if cursor:
        try:
            cursor_bytes = base64.b64decode(cursor)
            cursor_val = cursor_bytes.decode("utf-8")
            query = query.where(KnowledgeBase.created_at < datetime.fromisoformat(cursor_val))
        except Exception:
            pass

    query = query.limit(limit + 1)
    result = await db.execute(query)
    kbs = list(result.scalars().all())

    has_more = len(kbs) > limit
    if has_more:
        kbs = kbs[:limit]

    next_cursor = None
    if has_more and kbs:
        last_created = kbs[-1].created_at.isoformat()
        next_cursor = base64.b64encode(last_created.encode("utf-8")).decode("utf-8")

    items: list[KnowledgeBaseResponse] = []
    for kb in kbs:
        doc_count_result = await db.execute(
            select(func.count(Document.id)).where(Document.knowledge_base_id == kb.id)
        )
        doc_count = doc_count_result.scalar() or 0
        items.append(_kb_to_response(kb, document_count=doc_count))

    return PaginatedResponse(items=items, cursor=next_cursor, has_more=has_more)


async def get_knowledge_base(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
) -> KnowledgeBaseResponse:
    kb = await _get_kb_or_404(db, org_id, kb_id)
    doc_count_result = await db.execute(
        select(func.count(Document.id)).where(Document.knowledge_base_id == kb.id)
    )
    doc_count = doc_count_result.scalar() or 0
    return _kb_to_response(kb, document_count=doc_count)


async def delete_knowledge_base(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
) -> None:
    kb = await _get_kb_or_404(db, org_id, kb_id)
    kb.status = "deleted"
    kb.updated_at = datetime.now(UTC)
    await db.flush()


async def upload_document(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
    file: UploadFile,
) -> DocumentUploadResponse:
    await _get_kb_or_404(db, org_id, kb_id)

    # Determine file type from extension
    filename = file.filename or "unnamed"
    ext = Path(filename).suffix.lower()
    allowed_types = {".txt", ".md", ".csv", ".pdf", ".docx"}
    if ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_types)}",
        )

    # Save file to uploads directory
    upload_dir = UPLOAD_DIR / str(kb_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    file_size = len(content)

    doc = Document(
        knowledge_base_id=kb_id,
        name=filename,
        source_type="upload",
        file_type=ext.lstrip("."),
        file_size_bytes=file_size,
        status="pending",
    )
    db.add(doc)
    await db.flush()

    # Write file to disk
    file_path = upload_dir / f"{doc.id}{ext}"
    file_path.write_bytes(content)
    doc.file_path = str(file_path)
    await db.flush()

    # Dispatch ingestion task
    try:
        from workers.ingestion_worker import ingest_document

        ingest_document.delay(str(doc.id))
    except Exception:
        # If Celery is not available, leave status as pending
        pass

    return DocumentUploadResponse(
        id=doc.id,
        name=filename,
        status="pending",
        message="Document uploaded and queued for processing",
    )


async def list_documents(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
) -> list[DocumentResponse]:
    await _get_kb_or_404(db, org_id, kb_id)

    result = await db.execute(
        select(Document)
        .where(Document.knowledge_base_id == kb_id)
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [_doc_to_response(doc) for doc in docs]


async def delete_document(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
    doc_id: UUID,
) -> None:
    await _get_kb_or_404(db, org_id, kb_id)

    result = await db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.knowledge_base_id == kb_id,
        )
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Delete file from disk if it exists
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)
    await db.flush()


async def query_knowledge_base(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
    data: QueryRequest,
) -> QueryResponse:
    kb = await _get_kb_or_404(db, org_id, kb_id)

    # Generate embedding for the query
    embeddings = await generate_embeddings([data.query], model=kb.embedding_model)
    query_embedding = embeddings[0]

    # Perform vector search
    results = await vector_search(db, kb_id, query_embedding, top_k=data.top_k)

    return QueryResponse(
        query=data.query,
        results=[
            ChunkResultSchema(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                content=r.content,
                metadata=r.metadata,
                chunk_index=r.chunk_index,
                similarity=r.similarity,
            )
            for r in results
        ],
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_kb_or_404(
    db: AsyncSession,
    org_id: UUID,
    kb_id: UUID,
) -> KnowledgeBase:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == kb_id,
            KnowledgeBase.org_id == org_id,
            KnowledgeBase.status != "deleted",
        )
    )
    kb = result.scalar_one_or_none()
    if kb is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found",
        )
    return kb


def _kb_to_response(
    kb: KnowledgeBase,
    document_count: int = 0,
) -> KnowledgeBaseResponse:
    return KnowledgeBaseResponse(
        id=kb.id,
        org_id=kb.org_id,
        name=kb.name,
        description=kb.description,
        embedding_model=kb.embedding_model,
        chunk_size=kb.chunk_size,
        chunk_overlap=kb.chunk_overlap,
        status=kb.status,
        document_count=document_count,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
    )


def _doc_to_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        name=doc.name,
        source_type=doc.source_type,
        source_url=doc.source_url,
        file_type=doc.file_type,
        file_size_bytes=doc.file_size_bytes,
        status=doc.status,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )
