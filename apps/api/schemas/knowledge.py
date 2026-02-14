from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    embedding_model: str = "text-embedding-3-small"
    chunk_size: int = Field(default=1000, ge=100, le=10000)
    chunk_overlap: int = Field(default=200, ge=0, le=2000)


class KnowledgeBaseResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    description: str | None
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    status: str
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: UUID
    knowledge_base_id: UUID
    name: str
    source_type: str
    source_url: str | None
    file_type: str | None
    file_size_bytes: int | None
    status: str
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    id: UUID
    name: str
    status: str
    message: str


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=10000)
    top_k: int = Field(default=5, ge=1, le=50)


class ChunkResultSchema(BaseModel):
    chunk_id: UUID
    document_id: UUID
    content: str
    metadata: dict | None
    chunk_index: int
    similarity: float


class QueryResponse(BaseModel):
    query: str
    results: list[ChunkResultSchema]
