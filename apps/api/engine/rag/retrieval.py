from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.knowledge import DocumentChunk


@dataclass
class ChunkResult:
    chunk_id: UUID
    document_id: UUID
    content: str
    metadata: dict | None
    chunk_index: int
    similarity: float


async def vector_search(
    db: AsyncSession,
    knowledge_base_id: UUID,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[ChunkResult]:
    """Perform cosine similarity search against document chunks in a knowledge base."""
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    # Use pgvector cosine distance operator (<=>)
    stmt = (
        select(
            DocumentChunk.id,
            DocumentChunk.document_id,
            DocumentChunk.content,
            DocumentChunk.metadata_,
            DocumentChunk.chunk_index,
            (1 - DocumentChunk.embedding.cosine_distance(text(f"'{embedding_str}'::vector"))).label(
                "similarity"
            ),
        )
        .where(
            DocumentChunk.knowledge_base_id == knowledge_base_id,
            DocumentChunk.embedding.isnot(None),
        )
        .order_by(
            DocumentChunk.embedding.cosine_distance(text(f"'{embedding_str}'::vector"))
        )
        .limit(top_k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        ChunkResult(
            chunk_id=row.id,
            document_id=row.document_id,
            content=row.content,
            metadata=row.metadata_,
            chunk_index=row.chunk_index,
            similarity=float(row.similarity),
        )
        for row in rows
    ]
