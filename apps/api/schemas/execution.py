from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TriggerExecutionRequest(BaseModel):
    trigger_data: dict = Field(default_factory=dict)
    version_id: UUID | None = None


class ExecutionStepResponse(BaseModel):
    id: UUID
    execution_id: UUID
    node_id: UUID | None
    step_order: int | None
    status: str
    input_data: dict | None
    output_data: dict | None
    error_message: str | None
    tokens_used: int
    cost: Decimal
    duration_ms: int | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExecutionLogResponse(BaseModel):
    id: UUID
    execution_id: UUID
    step_id: UUID | None
    level: str
    message: str
    data: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExecutionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    agent_version_id: UUID | None
    org_id: UUID
    triggered_by: str | None
    trigger_data: dict
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    total_tokens: int
    total_cost: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
