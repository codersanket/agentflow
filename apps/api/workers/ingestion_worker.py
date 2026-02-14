from __future__ import annotations

import asyncio
import csv
import io
import logging
from pathlib import Path
from uuid import UUID

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(
    name="workers.ingestion_worker.ingest_document",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def ingest_document(self, document_id: str) -> dict:
    """Celery task: parse, chunk, embed, and store a document.

    1. Load document record from DB
    2. Parse content based on file_type
    3. Chunk the text using RecursiveCharacterSplitter
    4. Generate embeddings for each chunk
    5. Store chunks with embeddings in document_chunks table
    6. Update document status and chunk_count
    """
    logger.info("Starting ingestion for document %s", document_id)

    try:
        result = _run_async(_ingest(document_id))
        logger.info(
            "Ingestion for document %s completed: %d chunks",
            document_id,
            result["chunk_count"],
        )
        return result
    except Exception as exc:
        logger.exception("Ingestion for document %s failed: %s", document_id, exc)
        _run_async(_mark_failed(document_id, str(exc)))
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        raise


async def _ingest(document_id: str) -> dict:
    from sqlalchemy import select

    from core.database import async_session_factory
    from engine.rag.chunking import RecursiveCharacterSplitter
    from engine.rag.embeddings import generate_embeddings
    from models.knowledge import Document, DocumentChunk, KnowledgeBase

    async with async_session_factory() as db:
        # Load document
        result = await db.execute(select(Document).where(Document.id == UUID(document_id)))
        doc = result.scalar_one_or_none()
        if doc is None:
            raise ValueError(f"Document {document_id} not found")

        # Mark as processing
        doc.status = "processing"
        await db.flush()

        # Load knowledge base for settings
        kb_result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == doc.knowledge_base_id)
        )
        kb = kb_result.scalar_one()

        # Parse content based on file type
        text_content = _parse_file(doc.file_path, doc.file_type)

        if not text_content.strip():
            doc.status = "ready"
            doc.chunk_count = 0
            await db.commit()
            return {"chunk_count": 0}

        # Chunk the text
        splitter = RecursiveCharacterSplitter(
            chunk_size=kb.chunk_size,
            chunk_overlap=kb.chunk_overlap,
        )
        chunks = splitter.split(text_content)

        if not chunks:
            doc.status = "ready"
            doc.chunk_count = 0
            await db.commit()
            return {"chunk_count": 0}

        # Generate embeddings
        texts = [chunk.content for chunk in chunks]
        embeddings = await generate_embeddings(texts, model=kb.embedding_model)

        # Store chunks with embeddings
        for chunk, embedding in zip(chunks, embeddings):
            db_chunk = DocumentChunk(
                document_id=doc.id,
                knowledge_base_id=kb.id,
                content=chunk.content,
                metadata_={
                    "chunk_index": chunk.metadata.chunk_index,
                    "start_char": chunk.metadata.start_char,
                    "end_char": chunk.metadata.end_char,
                },
                embedding=embedding,
                chunk_index=chunk.metadata.chunk_index,
            )
            db.add(db_chunk)

        # Update document status
        doc.status = "ready"
        doc.chunk_count = len(chunks)
        await db.commit()

        return {"chunk_count": len(chunks)}


def _parse_file(file_path: str | None, file_type: str | None) -> str:
    """Parse document content based on file type."""
    if not file_path:
        return ""

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ft = (file_type or "").lower()

    if ft in ("txt", "md"):
        return path.read_text(encoding="utf-8")

    if ft == "csv":
        raw = path.read_text(encoding="utf-8")
        reader = csv.reader(io.StringIO(raw))
        rows: list[str] = []
        for row in reader:
            rows.append(" | ".join(row))
        return "\n".join(rows)

    if ft == "pdf":
        # Requires pypdf — stub for now
        # To enable: pip install pypdf
        # from pypdf import PdfReader
        # reader = PdfReader(path)
        # return "\n".join(page.extract_text() or "" for page in reader.pages)
        return f"[PDF parsing requires pypdf package. File: {path.name}]"

    if ft == "docx":
        # Requires python-docx — stub for now
        # To enable: pip install python-docx
        # import docx
        # doc = docx.Document(path)
        # return "\n".join(p.text for p in doc.paragraphs)
        return f"[DOCX parsing requires python-docx package. File: {path.name}]"

    return ""


async def _mark_failed(document_id: str, error_message: str) -> None:
    from sqlalchemy import update

    from core.database import async_session_factory
    from models.knowledge import Document

    async with async_session_factory() as db:
        await db.execute(
            update(Document).where(Document.id == UUID(document_id)).values(status="failed")
        )
        await db.commit()
