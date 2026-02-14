# AgentFlow — Technical PRD

**Version:** 1.0
**Date:** February 15, 2026
**Status:** Draft

---

## 1. System Architecture Overview

AgentFlow is a multi-tenant SaaS platform built as a monorepo with a clear separation between the frontend (Next.js), backend API (FastAPI), and agent execution engine (LangGraph + Celery). All services are containerized and deployed on AWS via ECS Fargate.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  Next.js App (SSR/CSR) │ Python SDK │ TypeScript SDK │ CLI  │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS / WebSocket
┌──────────────▼──────────────────────────────────────────────┐
│                     Gateway Layer                           │
│  CloudFront (CDN) → ALB → FastAPI (ECS Fargate, auto-scale)│
│  Rate Limiting │ Auth (JWT/API Key) │ Tenant Resolution     │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐      │
│  │ REST API    │  │ WebSocket    │  │ Webhook       │      │
│  │ Routers     │  │ Server       │  │ Ingress       │      │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘      │
│         │                │                   │              │
│  ┌──────▼────────────────▼───────────────────▼──────┐      │
│  │              Service Layer                        │      │
│  │  AgentService │ ExecutionService │ BillingService │      │
│  └──────────────────────┬───────────────────────────┘      │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Engine Layer                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │  Celery Workers (ECS Fargate, auto-scale)       │        │
│  │  ┌───────────────────────────────────────┐      │        │
│  │  │  LangGraph Orchestrator               │      │        │
│  │  │  ├── Node Executors (AI, Action, Logic)│      │        │
│  │  │  ├── Provider Router (OpenAI, Claude) │      │        │
│  │  │  ├── Tool Registry (Slack, Jira, etc.)│      │        │
│  │  │  └── RAG Pipeline (pgvector)          │      │        │
│  │  └───────────────────────────────────────┘      │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
│  PostgreSQL (RDS)  │  Redis (ElastiCache)  │  S3 (Storage)  │
│  + pgvector        │  + Pub/Sub            │  + Documents    │
│  + Alembic         │  + Celery Broker      │  + Static       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

1. **Multi-tenancy first:** Every database query, API call, and execution is scoped to an organization. Tenant isolation is enforced at the middleware and ORM level.
2. **Event-driven execution:** Agent executions are async (Celery) with real-time updates (WebSocket via Redis pub/sub). The API never blocks on agent execution.
3. **Provider-agnostic AI:** All LLM interactions go through an abstraction layer. Adding a new provider requires implementing a single interface.
4. **Plugin-based integrations:** Each external tool integration is a self-contained plugin with a standard interface. New integrations don't touch core code.
5. **Version everything:** Agent definitions are versioned. Running executions use the version they were started with, not the latest.

---

## 2. Tech Stack Decisions

### 2.1 Frontend: Next.js 14 (App Router) + TypeScript

**Why Next.js:**
- Server-side rendering for SEO (marketing pages) and fast initial load
- App Router for layouts, loading states, and streaming
- API routes as BFF (Backend-for-Frontend) proxy to avoid CORS and add session handling
- Mature ecosystem, strong TypeScript support

**UI Libraries:**
- **Tailwind CSS:** Utility-first styling, rapid iteration, consistent design
- **shadcn/ui:** Accessible, composable UI components built on Radix UI. Not a dependency — components are copied into the project for full control.
- **React Flow:** The only mature library for building node-based graph editors. Handles canvas, zoom, pan, drag, connect, and custom nodes/edges.
- **Zustand:** Lightweight state management for builder state, execution state. Simpler than Redux for our use case.

### 2.2 Backend: Python FastAPI

**Why FastAPI:**
- Native async support (critical for I/O-heavy operations: LLM calls, DB queries, external APIs)
- Automatic OpenAPI documentation (Swagger UI) from type hints
- Pydantic v2 for request/response validation — fast, type-safe
- First-class WebSocket support
- Python ecosystem for AI/ML (LangChain, LangGraph, embedding libraries)

**Why not Node.js backend:**
- LangChain/LangGraph are Python-first with the most mature features
- Python has superior ML/AI library support (document parsing, embeddings, vector operations)
- FastAPI's async performance is comparable to Node.js for I/O-bound workloads

### 2.3 Database: PostgreSQL + pgvector

**Why PostgreSQL:**
- Battle-tested for multi-tenant SaaS
- JSONB for flexible schema (agent configs, execution data)
- pgvector extension for vector similarity search (RAG) — no need for a separate vector database
- Strong transaction support for execution state management
- AWS RDS for managed operation with Multi-AZ failover

**Why not a separate vector DB (Pinecone, Weaviate):**
- pgvector keeps the operational footprint small
- Co-locating vectors with relational data avoids cross-system consistency issues
- Performance is sufficient for our scale (< 10M vectors per org)
- If scale demands it, we can migrate to a dedicated vector DB later

### 2.4 Queue & Cache: Redis + Celery

**Why Redis:**
- Celery broker (reliable message queue for agent execution tasks)
- Cache layer (API responses, rate limit counters, session data)
- Pub/sub for WebSocket event distribution (execution updates broadcast to all API instances)
- ElastiCache for managed operation

**Why Celery:**
- Mature, battle-tested distributed task queue
- Supports priority queues (premium orgs get higher priority)
- celery-beat for cron/scheduled triggers
- Task chaining, groups, and chords for complex execution flows
- Python-native — same language as our backend

### 2.5 Auth: WorkOS + JWT

**Why WorkOS:**
- Enterprise SSO (SAML, OIDC) out of the box — supporting 100+ identity providers
- Directory sync for auto-provisioning users from Okta, Azure AD, etc.
- Handles the complexity of enterprise auth so we don't have to
- Simple API for email/password + social login as fallback

**JWT Strategy:**
- Access tokens: 15-minute expiry, stored in memory (frontend)
- Refresh tokens: 7-day expiry, stored in httpOnly secure cookies
- API keys: SHA-256 hashed, stored in database, used for SDK/API access

### 2.6 Agent Engine: LangGraph + LangChain

**Why LangGraph:**
- State machine abstraction maps directly to our visual builder's node/edge graph
- Built-in support for conditional edges, loops, and human-in-the-loop
- Checkpointing for pause/resume (critical for approval steps)
- Streaming support for real-time execution updates
- Maintained by LangChain team — active development

**Why LangChain (selectively):**
- Tool abstraction for building integration connectors
- Document loaders and text splitters for RAG pipeline
- Embedding wrappers for multiple providers
- We use LangChain as a utility library, not as an orchestration framework

---

## 3. Database Schema

### 3.1 Entity-Relationship Overview

```
Organization ─┬── Users (via org_memberships)
              ├── Teams (via team_memberships)
              ├── Agents ──── Agent Versions ──┬── Agent Nodes
              │      │                         └── Agent Edges
              │      └── Executions ──── Execution Steps
              │                    └── Execution Logs
              ├── Integrations
              ├── Knowledge Bases ── Documents ── Document Chunks
              ├── API Keys
              ├── Subscriptions
              ├── Usage Records / Usage Daily
              ├── Audit Logs
              └── Agent Templates
```

### 3.2 Core Tables

#### Organizations & Users

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    stripe_customer_id VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'email',
    auth_provider_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, org_id)
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(user_id, team_id)
);
```

#### Agents & Versioning

```sql
CREATE TABLE agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    definition JSONB NOT NULL,
    icon VARCHAR(50),
    is_official BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    author_org_id UUID REFERENCES organizations(id),
    install_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    trigger_type VARCHAR(50),
    trigger_config JSONB DEFAULT '{}',
    is_template BOOLEAN DEFAULT FALSE,
    template_id UUID REFERENCES agent_templates(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL,
    change_message TEXT,
    created_by UUID REFERENCES users(id),
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, version)
);

CREATE TABLE agent_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_version_id UUID REFERENCES agent_versions(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL,
    node_subtype VARCHAR(100) NOT NULL,
    label VARCHAR(255),
    config JSONB DEFAULT '{}',
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0
);

CREATE TABLE agent_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_version_id UUID REFERENCES agent_versions(id) ON DELETE CASCADE,
    source_node_id UUID REFERENCES agent_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES agent_nodes(id) ON DELETE CASCADE,
    condition JSONB,
    label VARCHAR(100)
);
```

#### Executions

```sql
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    agent_version_id UUID REFERENCES agent_versions(id),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    triggered_by VARCHAR(50),
    trigger_data JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_executions_agent ON executions(agent_id);
CREATE INDEX idx_executions_org ON executions(org_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created ON executions(created_at DESC);

CREATE TABLE execution_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
    node_id UUID REFERENCES agent_nodes(id),
    step_order INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10, 6) DEFAULT 0,
    duration_ms INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES executions(id) ON DELETE CASCADE,
    step_id UUID REFERENCES execution_steps(id),
    level VARCHAR(20) DEFAULT 'info',
    message TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Integrations & Credentials

```sql
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'connected',
    credentials_encrypted TEXT NOT NULL,
    scopes TEXT[],
    token_expires_at TIMESTAMPTZ,
    connected_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255),
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    scopes TEXT[] DEFAULT '{"agents:read","agents:write","executions:read"}',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Knowledge Base (RAG)

```sql
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    chunk_size INTEGER DEFAULT 1000,
    chunk_overlap INTEGER DEFAULT 200,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50),
    source_url TEXT,
    file_path TEXT,
    file_type VARCHAR(50),
    file_size_bytes BIGINT,
    status VARCHAR(50) DEFAULT 'processing',
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    chunk_index INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_embedding ON document_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### Billing

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES executions(id),
    record_type VARCHAR(50),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10, 6),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    UNIQUE(org_id, date)
);
```

#### Audit Logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org_date ON audit_logs(org_id, created_at DESC);
```

### 3.3 Key Schema Design Decisions

1. **UUID primary keys:** Globally unique, safe for distributed systems, no sequential ID leakage.
2. **JSONB for flexibility:** Agent configs, execution data, and settings use JSONB to avoid schema migrations for every feature change.
3. **Soft-delete via status:** Agents use `status = 'archived'` rather than hard deletes to preserve execution history.
4. **Encrypted credentials:** Integration credentials are AES-256 encrypted at the application level before storage. Encryption keys are managed via AWS KMS.
5. **Separate execution logs table:** High-volume log data is isolated from execution metadata for query performance.
6. **Usage aggregation:** Raw usage records are aggregated into `usage_daily` by a background worker for dashboard performance.

---

## 4. API Design

### 4.1 API Conventions

- **Base URL:** `https://api.agentflow.dev/api/v1/`
- **Authentication:** Bearer token (JWT) or API key (`X-API-Key` header)
- **Tenant resolution:** Org is resolved from the JWT token or API key — never passed explicitly in the URL
- **Pagination:** Cursor-based for list endpoints (`?cursor=xxx&limit=20`)
- **Filtering:** Query parameters (`?status=active&trigger_type=webhook`)
- **Sorting:** `?sort=created_at&order=desc`
- **Error format:**
  ```json
  {
    "error": {
      "code": "AGENT_NOT_FOUND",
      "message": "Agent with ID xxx not found",
      "details": {}
    }
  }
  ```
- **Rate limiting:** Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 4.2 Endpoint Specifications

#### Auth Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/signup` | Create account + org | None |
| POST | `/auth/login` | Email/password login | None |
| POST | `/auth/sso/callback` | SSO callback from WorkOS | None |
| POST | `/auth/refresh` | Refresh access token | Refresh token |
| GET | `/auth/me` | Get current user + org | JWT |

#### Agent Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/agents` | List agents (paginated, filterable) | JWT / API Key |
| POST | `/agents` | Create new agent | JWT / API Key |
| GET | `/agents/:id` | Get agent with latest version | JWT / API Key |
| PUT | `/agents/:id` | Update agent metadata | JWT / API Key |
| DELETE | `/agents/:id` | Archive agent | JWT / API Key |
| POST | `/agents/:id/publish` | Publish new version | JWT / API Key |
| GET | `/agents/:id/versions` | List all versions | JWT / API Key |
| POST | `/agents/:id/execute` | Trigger execution | JWT / API Key |
| POST | `/agents/:id/test` | Dry-run execution | JWT / API Key |
| PUT | `/agents/:id/status` | Change status (active/paused) | JWT / API Key |

**Create Agent Request:**
```json
{
  "name": "Lead Router",
  "description": "Routes incoming leads to the right team",
  "trigger_type": "webhook",
  "trigger_config": {},
  "settings": {
    "timeout_seconds": 300,
    "max_retries": 3,
    "concurrency_limit": 5
  }
}
```

**Publish Version Request:**
```json
{
  "change_message": "Added Slack notification step",
  "definition": {
    "nodes": [...],
    "edges": [...]
  }
}
```

#### Execution Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/executions` | List executions (paginated) | JWT / API Key |
| GET | `/executions/:id` | Get execution detail | JWT / API Key |
| GET | `/executions/:id/steps` | Get execution steps | JWT / API Key |
| GET | `/executions/:id/logs` | Get execution logs | JWT / API Key |
| POST | `/executions/:id/cancel` | Cancel running execution | JWT / API Key |
| POST | `/executions/:id/approve` | Approve HITL step | JWT |
| WS | `/executions/:id/stream` | Live execution stream | JWT |

**WebSocket Message Format:**
```json
{
  "type": "step.started",
  "execution_id": "uuid",
  "step_id": "uuid",
  "node_id": "uuid",
  "timestamp": "2026-02-15T10:30:00Z"
}
```

```json
{
  "type": "step.completed",
  "execution_id": "uuid",
  "step_id": "uuid",
  "output": { "text": "Classified as: high-priority" },
  "tokens_used": 150,
  "duration_ms": 1200
}
```

#### Integration Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/integrations` | List connected integrations | JWT |
| POST | `/integrations/:provider/connect` | Initiate OAuth flow | JWT |
| DELETE | `/integrations/:id` | Disconnect integration | JWT |
| GET | `/integrations/available` | List available providers | JWT |

#### Knowledge Base Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/knowledge-bases` | List knowledge bases | JWT / API Key |
| POST | `/knowledge-bases` | Create knowledge base | JWT / API Key |
| GET | `/knowledge-bases/:id` | Get knowledge base detail | JWT / API Key |
| DELETE | `/knowledge-bases/:id` | Delete knowledge base | JWT / API Key |
| POST | `/knowledge-bases/:id/documents` | Upload document | JWT / API Key |
| DELETE | `/knowledge-bases/:id/documents/:docId` | Remove document | JWT / API Key |
| POST | `/knowledge-bases/:id/query` | Semantic search | JWT / API Key |

#### Template Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/templates` | Browse templates | JWT |
| GET | `/templates/:id` | Template detail | JWT |
| POST | `/templates/:id/install` | Create agent from template | JWT |
| POST | `/templates` | Publish as template | JWT |

#### Analytics Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/analytics/overview` | Dashboard summary stats | JWT |
| GET | `/analytics/usage` | Usage over time (charts) | JWT |
| GET | `/analytics/agents/:id` | Per-agent metrics | JWT |
| GET | `/analytics/costs` | Cost breakdown | JWT |

#### Billing Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/billing/subscription` | Current subscription | JWT |
| POST | `/billing/subscribe` | Create subscription | JWT |
| POST | `/billing/portal` | Stripe customer portal URL | JWT |
| GET | `/billing/invoices` | Invoice history | JWT |
| GET | `/billing/usage` | Current period usage | JWT |

#### Organization Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/org` | Get current org | JWT |
| PUT | `/org` | Update org settings | JWT (Admin) |
| GET | `/org/members` | List members | JWT |
| POST | `/org/members/invite` | Invite member | JWT (Admin) |
| PUT | `/org/members/:id/role` | Change role | JWT (Admin) |
| DELETE | `/org/members/:id` | Remove member | JWT (Admin) |
| GET | `/org/api-keys` | List API keys | JWT |
| POST | `/org/api-keys` | Create API key | JWT |
| DELETE | `/org/api-keys/:id` | Revoke API key | JWT |
| GET | `/org/audit-logs` | Audit trail | JWT (Admin) |

---

## 5. Agent Execution Engine

### 5.1 Execution Flow

```
1. Trigger received (webhook/schedule/manual/API)
        │
2. ExecutionService.start(agent_id, trigger_data)
        │
        ├── Validate agent is active
        ├── Check concurrency limit
        ├── Resolve latest published version
        ├── Create execution record (status=pending)
        │
3. Dispatch Celery task: execute_agent.delay(execution_id)
        │
4. Worker picks up task
        ├── Load agent definition (nodes, edges)
        ├── Build LangGraph state machine from definition
        ├── Initialize execution context = {trigger_data, org_config}
        │
5. Execute LangGraph graph
        │
        ┌─── For each node (topological order): ──────────────┐
        │                                                      │
        │  a. Create execution_step record (status=running)    │
        │  b. Resolve input variables from context             │
        │  c. Execute node handler:                            │
        │     ├── AI Node → ProviderRouter.chat(messages)      │
        │     ├── Action Node → ToolRegistry.execute(tool, params)
        │     ├── Logic Node → evaluate condition/loop         │
        │     └── Human Node → pause, notify, wait for approval│
        │  d. Store output in execution context                │
        │  e. Update execution_step (status=completed, output) │
        │  f. Emit WebSocket event via Redis pub/sub           │
        │  g. Track tokens + cost                              │
        │  h. Handle errors → retry or fail                    │
        │                                                      │
        └──────────────────────────────────────────────────────┘
        │
6. Update execution record (status=completed/failed)
7. Emit final WebSocket event
8. Record usage for billing
```

### 5.2 Provider Abstraction

```python
# engine/providers/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class LLMResponse:
    content: str
    tool_calls: list | None
    input_tokens: int
    output_tokens: int
    model: str
    cost: float

class LLMProvider(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs
    ) -> LLMResponse:
        ...

    @abstractmethod
    async def embed(
        self,
        texts: list[str],
        model: str
    ) -> list[list[float]]:
        ...

    @abstractmethod
    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str
    ) -> float:
        ...
```

```python
# engine/providers/router.py
class ProviderRouter:
    """Routes LLM requests to the appropriate provider with fallback."""

    def __init__(self, providers: dict[str, LLMProvider], fallback_order: list[str]):
        self.providers = providers
        self.fallback_order = fallback_order

    def resolve_provider(self, model: str) -> LLMProvider:
        """Determine which provider handles a given model."""
        prefix = model.split("-")[0]  # "gpt" -> openai, "claude" -> anthropic
        provider_map = {
            "gpt": "openai",
            "o1": "openai",
            "o3": "openai",
            "claude": "anthropic",
            "gemini": "google",
        }
        provider_name = provider_map.get(prefix, self.fallback_order[0])
        return self.providers[provider_name]

    async def chat(self, messages, model=None, **kwargs) -> LLMResponse:
        provider = self.resolve_provider(model)
        try:
            return await provider.chat(messages, model=model, **kwargs)
        except Exception:
            for fallback_name in self.fallback_order:
                try:
                    fallback = self.providers[fallback_name]
                    return await fallback.chat(messages, **kwargs)
                except Exception:
                    continue
            raise RuntimeError("All LLM providers failed")
```

### 5.3 Node Execution Handlers

Each node type has a handler that receives the execution context and returns output:

```python
class NodeHandler(ABC):
    @abstractmethod
    async def execute(self, config: dict, context: ExecutionContext) -> NodeOutput:
        ...

class AINodeHandler(NodeHandler):
    """Handles LLM calls — chat, summarize, classify, extract."""
    async def execute(self, config, context):
        messages = self.build_messages(config, context)
        response = await self.provider_router.chat(
            messages=messages,
            model=config.get("model", "gpt-4o"),
            tools=config.get("tools"),
            temperature=config.get("temperature", 0.7),
        )
        return NodeOutput(
            data={"text": response.content, "tool_calls": response.tool_calls},
            tokens_used=response.input_tokens + response.output_tokens,
            cost=response.cost,
        )

class ActionNodeHandler(NodeHandler):
    """Handles external tool actions — Slack, Jira, HTTP, etc."""
    async def execute(self, config, context):
        tool = self.tool_registry.get(config["tool_name"])
        params = self.resolve_variables(config["params"], context)
        result = await tool.execute(params, context.org_integrations)
        return NodeOutput(data=result)

class LogicNodeHandler(NodeHandler):
    """Handles if/else, switch, loop, delay."""
    async def execute(self, config, context):
        if config["logic_type"] == "if_else":
            condition_result = self.evaluate_condition(config["condition"], context)
            return NodeOutput(data={"branch": "true" if condition_result else "false"})
        elif config["logic_type"] == "loop":
            # Returns items to iterate over
            items = self.resolve_variables(config["items_expression"], context)
            return NodeOutput(data={"items": items, "count": len(items)})

class HumanNodeHandler(NodeHandler):
    """Pauses execution and waits for human approval."""
    async def execute(self, config, context):
        # Send notification to approvers
        await self.notify_approvers(config["approvers"], context)
        # Mark step as waiting — execution is paused
        raise HumanApprovalRequired(
            step_id=context.current_step_id,
            message=config.get("message", "Approval required"),
        )
```

### 5.4 Variable Resolution

Nodes reference outputs from previous nodes using template syntax:

```
{{trigger.data.email}}
{{node_classify.output.text}}
{{node_fetch.output.items[0].name}}
```

The variable resolver:
1. Parses `{{...}}` expressions from node config strings
2. Resolves each path against the execution context dictionary
3. Supports nested access, array indexing, and default values

### 5.5 Error Handling & Retry

```python
class RetryPolicy:
    max_retries: int = 3
    backoff_base: float = 2.0  # seconds
    backoff_max: float = 60.0  # seconds
    retryable_errors: list[type] = [ProviderTimeoutError, RateLimitError, ConnectionError]

async def execute_with_retry(handler, config, context, policy):
    for attempt in range(policy.max_retries + 1):
        try:
            return await handler.execute(config, context)
        except tuple(policy.retryable_errors) as e:
            if attempt == policy.max_retries:
                raise
            wait = min(policy.backoff_base ** attempt, policy.backoff_max)
            await asyncio.sleep(wait)
```

---

## 6. Real-Time Architecture (WebSockets)

### 6.1 Design

```
Browser (WebSocket) ──→ FastAPI WS endpoint ──→ Redis Pub/Sub ←── Celery Worker
```

- The **Celery worker** publishes execution events to a Redis pub/sub channel: `execution:{execution_id}`
- The **FastAPI WebSocket endpoint** subscribes to the channel and forwards events to the connected client
- This decouples the API process from the worker process and supports multiple API instances

### 6.2 Event Types

| Event | Description |
|-------|-------------|
| `execution.started` | Execution has begun |
| `step.started` | A specific step is now running |
| `step.completed` | Step finished with output |
| `step.failed` | Step encountered an error |
| `step.waiting_approval` | Human-in-the-loop pause |
| `execution.completed` | All steps done, execution succeeded |
| `execution.failed` | Execution failed (unrecoverable) |
| `execution.cancelled` | User cancelled the execution |
| `log` | Debug/info log message |

---

## 7. Infrastructure (AWS)

### 7.1 Service Architecture

```
                        ┌─────────────┐
                        │ Route 53    │
                        │ (DNS)       │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │ CloudFront  │
                        │ (CDN)       │
                        └──────┬──────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
             ┌──────▼──┐  ┌───▼────┐  ┌──▼───────┐
             │ ALB     │  │ S3     │  │ S3       │
             │ (API)   │  │(Static)│  │(Uploads) │
             └────┬────┘  └────────┘  └──────────┘
                  │
         ┌────────┼────────┐
         │        │        │
      ┌──▼──┐ ┌──▼──┐ ┌───▼────┐
      │ECS  │ │ECS  │ │ECS     │
      │API  │ │API  │ │Workers │
      │(x2) │ │(x2) │ │(Celery)│
      └──┬──┘ └──┬──┘ └───┬────┘
         │       │        │
         ├───────┴────────┤
         │                │
      ┌──▼──────┐   ┌────▼─────┐
      │ RDS     │   │ElastiCache│
      │Postgres │   │ Redis     │
      │(pgvect) │   │           │
      └─────────┘   └───────────┘
```

### 7.2 AWS Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **ECS Fargate** | API + Worker containers | Auto-scaling (CPU/memory), min 2 API tasks |
| **RDS PostgreSQL 16** | Primary database | Multi-AZ, db.r6g.large, 100GB gp3 |
| **ElastiCache Redis 7** | Cache + queue + pub/sub | cluster mode, r6g.large |
| **S3** | Document storage + static assets | Standard + Intelligent-Tiering |
| **CloudFront** | CDN for frontend + API caching | Edge locations worldwide |
| **ALB** | Load balancer | Health checks, path-based routing |
| **Route 53** | DNS management | Alias records for CloudFront + ALB |
| **SES** | Transactional emails | Verified domain, DKIM |
| **KMS** | Encryption key management | For credential vault |
| **Secrets Manager** | API keys, DB credentials | Auto-rotation |
| **CloudWatch** | Logs, metrics, alarms | Log groups per service, custom metrics |
| **ECR** | Container registry | Image scanning enabled |

### 7.3 Environment Strategy

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| **Local** | Development | Docker Compose (Postgres + Redis) |
| **Staging** | Pre-production testing | Scaled-down AWS (single AZ, small instances) |
| **Production** | Live traffic | Full AWS (Multi-AZ, auto-scaling) |

### 7.4 CI/CD Pipeline (GitHub Actions)

```
Push to main → Lint + Test → Build Docker images → Push to ECR
                                                        │
                                            ┌───────────▼──────────┐
                                            │ Deploy to Staging    │
                                            │ (auto)               │
                                            └───────────┬──────────┘
                                                        │
                                            ┌───────────▼──────────┐
                                            │ E2E Tests on Staging │
                                            └───────────┬──────────┘
                                                        │
                                            ┌───────────▼──────────┐
                                            │ Deploy to Production │
                                            │ (manual approval)    │
                                            └──────────────────────┘
```

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
Email/Password Login:
  Client → POST /auth/login → Verify password (bcrypt) → Issue JWT + Refresh Token

SSO/SAML Login:
  Client → Redirect to WorkOS → IdP authentication → Callback to /auth/sso/callback
         → Create/update user → Issue JWT + Refresh Token

API Key Access:
  Client → Request with X-API-Key header → Hash key (SHA-256) → Lookup in api_keys table
         → Resolve org + scopes → Authorize request
```

### 8.2 Authorization Model

```
Roles: Owner > Admin > Editor > Viewer

Permissions Matrix:
                    Owner  Admin  Editor  Viewer
Create Agent         ✓      ✓      ✓       ✗
Edit Agent           ✓      ✓      ✓       ✗
Delete Agent         ✓      ✓      ✗       ✗
Execute Agent        ✓      ✓      ✓       ✗
View Executions      ✓      ✓      ✓       ✓
Manage Integrations  ✓      ✓      ✗       ✗
Manage Members       ✓      ✓      ✗       ✗
Manage Billing       ✓      ✗      ✗       ✗
View Audit Logs      ✓      ✓      ✗       ✗
Manage API Keys      ✓      ✓      ✗       ✗
```

### 8.3 Credential Vault

Integration credentials (OAuth tokens, API keys) are encrypted before storage:

1. Generate a data encryption key (DEK) per credential using AWS KMS
2. Encrypt the credential JSON with AES-256-GCM using the DEK
3. Store the encrypted credential + encrypted DEK in the database
4. On access: decrypt DEK via KMS → decrypt credential → use in memory → discard

### 8.4 Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| API (per org) | 1,000 requests | 1 minute |
| API (per API key) | 500 requests | 1 minute |
| Agent execution (per org) | Based on plan | Rolling window |
| Auth endpoints | 10 requests | 1 minute |

Implemented via Redis sliding window counters in FastAPI middleware.

---

## 9. Monitoring & Observability

### 9.1 Logging

- **Structured JSON logs** from all services
- **Log levels:** DEBUG (dev only), INFO, WARNING, ERROR
- **CloudWatch Log Groups:** `/agentflow/api`, `/agentflow/worker`, `/agentflow/web`
- **Correlation ID:** Every request gets a unique `X-Request-ID` propagated through all services

### 9.2 Metrics

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| API response time (p99) | CloudWatch | > 1s |
| API error rate (5xx) | CloudWatch | > 1% |
| Execution queue depth | Redis/Celery | > 1,000 |
| Execution failure rate | Custom metric | > 5% |
| Database connections | RDS | > 80% max |
| Redis memory usage | ElastiCache | > 80% |
| LLM provider latency | Custom metric | > 10s |

### 9.3 Error Tracking

- **Sentry:** Captures exceptions from API and workers with full stack traces, context, and breadcrumbs
- **Source maps:** Uploaded for frontend error tracking

### 9.4 Analytics

- **PostHog:** Product analytics for user behavior tracking
- Events: agent_created, execution_started, integration_connected, template_installed
- Funnels: signup → first agent → first execution → paid conversion

---

## 10. Testing Strategy

### 10.1 Test Pyramid

| Layer | Tool | Coverage Target |
|-------|------|----------------|
| Unit tests | pytest (backend), vitest (frontend) | 80%+ |
| Integration tests | pytest + test DB | All API endpoints |
| E2E tests | Playwright | Critical user flows |
| Load tests | Locust | Execution engine |

### 10.2 Test Database Strategy

- Tests use a separate PostgreSQL database (created/destroyed per test session)
- Fixtures provide test org, user, agent, and execution data
- Integration tests run against real database with transactions rolled back after each test

### 10.3 CI Test Matrix

```yaml
# Every PR:
- Lint (ruff, eslint, prettier)
- Type check (mypy, tsc)
- Unit tests (pytest, vitest)
- Integration tests (pytest with test DB)

# Pre-deploy (staging):
- E2E tests (Playwright)

# Weekly:
- Load tests (Locust)
- Security scan (Snyk, Trivy)
```
