"""phase5 knowledge base rag

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-02-15 18:00:00.000000

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "b3c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "a2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID_PK = UUID(as_uuid=True)
_TZDT = sa.DateTime(timezone=True)
_NOW = sa.func.now()
_UUID_DEFAULT = sa.text("gen_random_uuid()")


def _pk_col():
    return sa.Column("id", _UUID_PK, primary_key=True, server_default=_UUID_DEFAULT)


def _ts_cols():
    return [
        sa.Column("created_at", _TZDT, server_default=_NOW, nullable=False),
        sa.Column("updated_at", _TZDT, server_default=_NOW, nullable=False),
    ]


def _fk(col_name, target, ondelete="CASCADE", nullable=False):
    return sa.Column(
        col_name,
        _UUID_PK,
        sa.ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
    )


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # --- knowledge_bases ---
    op.create_table(
        "knowledge_bases",
        _pk_col(),
        _fk("org_id", "organizations.id"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("embedding_model", sa.String(100), server_default="text-embedding-3-small"),
        sa.Column("chunk_size", sa.Integer, server_default="1000"),
        sa.Column("chunk_overlap", sa.Integer, server_default="200"),
        sa.Column("status", sa.String(50), server_default="active"),
        *_ts_cols(),
    )
    op.create_index("ix_knowledge_bases_org_id", "knowledge_bases", ["org_id"])
    op.create_index("ix_knowledge_bases_status", "knowledge_bases", ["status"])

    # --- documents ---
    op.create_table(
        "documents",
        _pk_col(),
        _fk("knowledge_base_id", "knowledge_bases.id"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(50), server_default="upload"),
        sa.Column("source_url", sa.Text, nullable=True),
        sa.Column("file_path", sa.Text, nullable=True),
        sa.Column("file_type", sa.String(50), nullable=True),
        sa.Column("file_size_bytes", sa.Integer, nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("chunk_count", sa.Integer, server_default="0"),
        *_ts_cols(),
    )
    op.create_index("ix_documents_knowledge_base_id", "documents", ["knowledge_base_id"])
    op.create_index("ix_documents_status", "documents", ["status"])

    # --- document_chunks ---
    op.create_table(
        "document_chunks",
        _pk_col(),
        _fk("document_id", "documents.id"),
        _fk("knowledge_base_id", "knowledge_bases.id"),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        *_ts_cols(),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("ix_document_chunks_knowledge_base_id", "document_chunks", ["knowledge_base_id"])

    # Add vector column using raw SQL (pgvector)
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)")

    # Create IVFFlat index for approximate nearest neighbor search
    op.execute(
        "CREATE INDEX ix_document_chunks_embedding ON document_chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_table("knowledge_bases")
