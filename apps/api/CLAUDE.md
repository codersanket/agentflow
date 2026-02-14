# AgentFlow Backend — Claude Code Instructions

## Overview
FastAPI Python backend for the AgentFlow platform. Handles REST API, WebSocket streaming, agent execution engine, and background workers.

## Stack
- Python 3.12+
- FastAPI (async, with WebSocket support)
- SQLAlchemy 2.0 (async, with PostgreSQL)
- Pydantic v2 (validation + settings)
- Alembic (database migrations)
- Celery + Redis (background task queue)
- LangGraph + LangChain (agent execution engine)
- pytest (testing)

## Directory Structure
```
apps/api/
├── main.py                    # FastAPI app entry point
├── core/
│   ├── config.py              # Pydantic Settings (env vars)
│   ├── database.py            # SQLAlchemy async engine + session
│   ├── redis.py               # Redis connection
│   ├── security.py            # JWT creation/validation, password hashing
│   └── dependencies.py        # FastAPI dependency injection (get_db, get_current_user, etc.)
├── models/
│   ├── __init__.py
│   ├── user.py                # User, OrgMembership
│   ├── organization.py        # Organization, Team, TeamMembership
│   ├── agent.py               # Agent, AgentVersion, AgentNode, AgentEdge
│   ├── execution.py           # Execution, ExecutionStep, ExecutionLog
│   ├── integration.py         # Integration, ApiKey
│   ├── knowledge.py           # KnowledgeBase, Document, DocumentChunk
│   ├── billing.py             # Subscription, UsageRecord, UsageDaily
│   ├── audit.py               # AuditLog
│   └── template.py            # AgentTemplate
├── schemas/
│   ├── auth.py                # Login, Signup, Token schemas
│   ├── agent.py               # AgentCreate, AgentUpdate, AgentResponse
│   ├── execution.py           # ExecutionResponse, StepResponse
│   ├── integration.py         # IntegrationResponse
│   ├── knowledge.py           # KnowledgeBaseCreate, DocumentResponse
│   ├── billing.py             # SubscriptionResponse, UsageResponse
│   └── common.py              # Pagination, ErrorResponse
├── routers/
│   ├── auth.py                # /auth/* endpoints
│   ├── agents.py              # /agents/* endpoints
│   ├── executions.py          # /executions/* endpoints
│   ├── integrations.py        # /integrations/* endpoints
│   ├── knowledge.py           # /knowledge-bases/* endpoints
│   ├── templates.py           # /templates/* endpoints
│   ├── analytics.py           # /analytics/* endpoints
│   ├── billing.py             # /billing/* endpoints
│   └── org.py                 # /org/* endpoints
├── services/
│   ├── auth_service.py
│   ├── agent_service.py
│   ├── execution_service.py
│   ├── integration_service.py
│   ├── knowledge_service.py
│   ├── analytics_service.py
│   └── billing_service.py
├── engine/
│   ├── orchestrator.py        # LangGraph state machine builder
│   ├── executor.py            # Step executor with variable resolution
│   ├── providers/
│   │   ├── base.py            # LLMProvider ABC, LLMResponse dataclass
│   │   ├── router.py          # ProviderRouter with fallback
│   │   ├── openai.py
│   │   ├── anthropic.py
│   │   ├── google.py
│   │   └── ollama.py
│   ├── tools/
│   │   ├── base.py            # IntegrationTool ABC
│   │   ├── registry.py        # Tool registry
│   │   ├── slack.py
│   │   ├── gmail.py
│   │   ├── jira.py
│   │   ├── github_tool.py
│   │   ├── webhook.py
│   │   └── http_request.py
│   └── rag/
│       ├── chunking.py        # Text splitters
│       ├── embeddings.py      # Embedding generation
│       └── retrieval.py       # Vector search
├── workers/
│   ├── celery_app.py          # Celery configuration
│   ├── agent_worker.py        # execute_agent task
│   ├── ingestion_worker.py    # Document ingestion task
│   └── billing_worker.py      # Usage aggregation task
├── migrations/
│   ├── env.py                 # Alembic config
│   └── versions/              # Migration files
├── tests/
│   ├── conftest.py            # Test fixtures (db, client, auth)
│   ├── test_auth.py
│   ├── test_agents.py
│   ├── test_executions.py
│   └── test_engine/
├── alembic.ini
├── pyproject.toml
└── Dockerfile
```

## Conventions

### API Pattern
```python
# routers/agents.py
router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("/", response_model=PaginatedResponse[AgentResponse])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    cursor: str | None = None,
    limit: int = 20,
    status: str | None = None,
):
    return await agent_service.list_agents(db, current_user.org_id, cursor, limit, status)
```

### Service Pattern
```python
# services/agent_service.py
async def list_agents(db: AsyncSession, org_id: UUID, cursor, limit, status):
    query = select(Agent).where(Agent.org_id == org_id)  # ALWAYS scope by org_id
    if status:
        query = query.where(Agent.status == status)
    # ... pagination logic
    result = await db.execute(query)
    return result.scalars().all()
```

### Model Pattern
```python
# models/agent.py
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

class Agent(Base):
    __tablename__ = "agents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="draft")
    # ...
```

### Testing Pattern
```python
# tests/test_agents.py
@pytest.mark.asyncio
async def test_create_agent(client, auth_headers):
    response = await client.post("/api/v1/agents", json={...}, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["name"] == "Test Agent"
```

## Critical Rules
- `from __future__ import annotations` at the top of every file
- EVERY database query MUST include `org_id` filter — no exceptions
- NEVER log credentials, tokens, or API keys
- ALWAYS use async/await for I/O operations
- Validate ALL input with Pydantic schemas before processing
- Use Alembic for ALL schema changes
- Integration credentials must be AES-256 encrypted before storage
- LLM calls go through ProviderRouter, never direct SDK calls in routes/services

## Environment Variables
See `.env.example` in project root. Load via `core/config.py` using Pydantic Settings.
