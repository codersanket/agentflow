# AgentFlow — Implementation Plan

**Version:** 1.0
**Date:** February 15, 2026
**Status:** Draft

---

## Overview

This document is the phased execution roadmap for building AgentFlow. Each phase has a clear goal, deliverables, and acceptance criteria. Phases are designed to be incrementally deployable — each phase produces a working, testable increment of the product.

**Total timeline estimate:** 30 weeks (8 phases)
**Team assumption:** 2-3 full-stack engineers, 1 platform/DevOps engineer

---

## Phase 1: Foundation (Weeks 1-3)

### Goal
Project scaffolding, authentication, database setup, basic CRUD operations, and a functional frontend shell.

### Deliverables

#### Week 1: Monorepo & Infrastructure Setup

- [ ] **Initialize monorepo structure**
  - Turborepo configuration (`turbo.json`)
  - pnpm workspace for frontend packages (`package.json`, `pnpm-workspace.yaml`)
  - Poetry for Python backend (`pyproject.toml`)
  - Root-level scripts for common operations

- [ ] **Next.js frontend scaffolding**
  - Next.js 14 with App Router, TypeScript strict mode
  - Tailwind CSS configuration
  - shadcn/ui initialization (install CLI, add base components: Button, Input, Card, Dialog, etc.)
  - App layout structure: `(auth)` and `(dashboard)` route groups
  - Zustand store setup

- [ ] **FastAPI backend scaffolding**
  - Project structure: `main.py`, `core/`, `models/`, `schemas/`, `routers/`, `services/`
  - Pydantic settings for configuration (`core/config.py`)
  - SQLAlchemy async engine setup (`core/database.py`)
  - Redis connection setup (`core/redis.py`)
  - CORS middleware, request ID middleware
  - Health check endpoint

- [ ] **Docker Compose for local development**
  - PostgreSQL 16 with pgvector extension
  - Redis 7
  - API service (hot-reload)
  - Worker service (Celery)
  - Volumes for data persistence

- [ ] **Alembic setup**
  - Migration environment configuration
  - First migration: organizations, users, org_memberships, teams, team_memberships

#### Week 2: Authentication System

- [ ] **Backend auth**
  - Password hashing (bcrypt via passlib)
  - JWT token generation + validation (`core/security.py`)
  - Refresh token mechanism (httpOnly cookies)
  - Auth router: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
  - Signup flow: create user + create organization + create owner membership
  - Login flow: verify password → issue tokens
  - Auth dependency injection for protected routes

- [ ] **WorkOS integration**
  - WorkOS SDK setup
  - SSO/SAML callback handler (`POST /auth/sso/callback`)
  - User provisioning from SSO response
  - Organization-level SSO configuration

- [ ] **Frontend auth pages**
  - Login page (`/login`) with email/password form
  - Signup page (`/signup`) with org name + email + password
  - SSO login page (`/sso`) with org slug input
  - Auth context/store for managing session state
  - Protected route middleware (redirect to login if unauthenticated)
  - Token refresh logic in API client

#### Week 3: RBAC, Org Settings & Navigation

- [ ] **RBAC middleware**
  - Tenant resolution middleware (extract org_id from JWT)
  - Role-based permission checking decorator/dependency
  - Permission matrix implementation (Owner, Admin, Editor, Viewer)

- [ ] **API key management**
  - `POST /org/api-keys` — generate API key, return once, store hash
  - `GET /org/api-keys` — list keys (show prefix only)
  - `DELETE /org/api-keys/:id` — revoke key
  - API key auth middleware (resolve org + scopes from key hash)

- [ ] **Organization settings endpoints**
  - `GET /org` — current org details
  - `PUT /org` — update org name, settings
  - `GET /org/members` — list org members with roles
  - `POST /org/members/invite` — invite by email (send email via SES or stub)
  - `PUT /org/members/:id/role` — change member role
  - `DELETE /org/members/:id` — remove member

- [ ] **Frontend dashboard shell**
  - Sidebar navigation (Agents, Executions, Integrations, Knowledge, Templates, Analytics, Settings)
  - Top bar with org switcher, user menu, notifications area
  - Settings pages: General, Members, API Keys, Billing (placeholder)
  - Member management UI: invite, role change, remove

### Acceptance Criteria
- A user can sign up, log in, and see the dashboard
- A user can invite team members and assign roles
- API keys can be created and used to authenticate API requests
- All endpoints are org-scoped (no cross-tenant access)
- Docker Compose spins up the full local stack with one command

---

## Phase 2: Agent Engine Core (Weeks 4-7)

### Goal
Build the execution engine that powers agent workflows — from database models to Celery workers to real-time streaming.

### Deliverables

#### Week 4: Agent Data Model & CRUD

- [ ] **Database migration:** agents, agent_versions, agent_nodes, agent_edges, agent_templates
- [ ] **Pydantic schemas** for agent create/update/response
- [ ] **Agent CRUD endpoints:**
  - `GET /agents` — list with pagination, filtering (status, trigger_type)
  - `POST /agents` — create new agent
  - `GET /agents/:id` — get agent with latest version detail
  - `PUT /agents/:id` — update metadata
  - `DELETE /agents/:id` — soft delete (archive)
  - `POST /agents/:id/publish` — create new version from definition
  - `GET /agents/:id/versions` — list versions
  - `PUT /agents/:id/status` — activate, pause, archive
- [ ] **Agent service** with business logic (version incrementing, publish validation)

#### Week 5: AI Provider Layer

- [ ] **Provider abstraction** (`engine/providers/base.py`)
  - `LLMProvider` abstract class: `chat()`, `embed()`, `estimate_cost()`
  - `LLMResponse` dataclass with content, tool_calls, tokens, cost

- [ ] **Provider implementations:**
  - OpenAI provider (`engine/providers/openai.py`) — GPT-4o, GPT-4o-mini
  - Anthropic provider (`engine/providers/anthropic.py`) — Claude Sonnet 4.5, Haiku
  - Google provider (`engine/providers/google.py`) — Gemini 2.0 Flash
  - Ollama provider (`engine/providers/ollama.py`) — local models

- [ ] **Provider router** (`engine/providers/router.py`)
  - Model → provider mapping
  - Fallback chain on provider failure
  - Cost estimation by model

#### Week 6: Execution Engine

- [ ] **Database migration:** executions, execution_steps, execution_logs
- [ ] **Celery worker setup**
  - Celery app configuration (`workers/celery_app.py`)
  - Redis as broker
  - Task serialization (JSON)
  - Concurrency configuration

- [ ] **LangGraph orchestrator** (`engine/orchestrator.py`)
  - Build LangGraph state machine from agent definition (nodes + edges)
  - Execution context: shared state dict passed between nodes
  - Topological ordering of node execution

- [ ] **Node handlers:**
  - AI node handler — LLM calls (chat, summarize, classify, extract)
  - Action node handler — HTTP requests, webhook calls
  - Logic node handler — if/else, switch, loop, delay
  - Human-in-the-loop handler — pause execution, notify, resume on approval

- [ ] **Step executor** (`engine/executor.py`)
  - Execute individual steps with input resolution
  - Variable template resolution (`{{node.output.field}}`)
  - Token tracking per step
  - Cost calculation per step

- [ ] **Agent execution task** (`workers/agent_worker.py`)
  - `execute_agent(execution_id)` Celery task
  - Load agent definition, build graph, execute
  - Update execution status (running → completed/failed)
  - Write execution steps and logs

- [ ] **Retry logic**
  - Exponential backoff for transient errors
  - Configurable max retries per agent
  - Retryable vs non-retryable error classification

#### Week 7: Execution API & Real-Time

- [ ] **Execution endpoints:**
  - `GET /executions` — list with pagination
  - `GET /executions/:id` — execution detail
  - `GET /executions/:id/steps` — steps with input/output
  - `GET /executions/:id/logs` — log stream
  - `POST /agents/:id/execute` — trigger execution
  - `POST /agents/:id/test` — dry-run test execution
  - `POST /executions/:id/cancel` — cancel running execution
  - `POST /executions/:id/approve` — approve HITL step

- [ ] **WebSocket setup**
  - FastAPI WebSocket endpoint: `WS /executions/:id/stream`
  - Redis pub/sub: workers publish events, API subscribes and forwards
  - Event types: step.started, step.completed, step.failed, execution.completed

- [ ] **Token & cost tracking**
  - Per-step token counting
  - Per-execution total tokens + cost
  - Cost calculation by model pricing

### Acceptance Criteria
- An agent can be created, published, and executed via API
- Execution runs asynchronously via Celery worker
- Each step's input, output, and timing is recorded
- WebSocket streams execution events in real-time
- Provider fallback works when primary provider fails
- Human-in-the-loop pauses execution until approved

---

## Phase 3: Visual Agent Builder (Weeks 8-11)

### Goal
Build the drag-and-drop UI for designing agent workflows visually.

### Deliverables

#### Week 8: React Flow Canvas Setup

- [ ] **React Flow integration**
  - Canvas component with zoom, pan, minimap, controls
  - Zustand store for builder state (nodes, edges, selected node, dirty flag)
  - Custom theme matching AgentFlow design system

- [ ] **Custom node components**
  - Base node wrapper (consistent styling, handles, status indicator)
  - Trigger node (webhook icon, schedule icon, manual icon)
  - AI node (brain icon, model badge)
  - Action node (tool-specific icon)
  - Logic node (diamond shape for if/else, loop icon)
  - Human approval node (person icon)

- [ ] **Custom edge components**
  - Animated edges during execution preview
  - Conditional edge labels
  - Edge styling (success = green, error = red)

#### Week 9: Node Configuration

- [ ] **Configuration panel** (right sidebar)
  - Opens when a node is selected
  - Dynamic form based on node type and subtype
  - Form fields: text inputs, dropdowns, code editor (for prompts), JSON editor

- [ ] **Node configuration forms:**
  - Trigger: webhook URL display, cron expression builder, manual trigger button
  - AI: model selector, prompt template editor, temperature slider, max tokens, tool selection
  - Action: tool selector, parameter mapping, output mapping
  - Logic: condition builder (field, operator, value), loop configuration
  - Human: approver selection, message template, timeout

- [ ] **Variable system**
  - Variable picker: dropdown showing available outputs from upstream nodes
  - `{{node_name.output.field}}` syntax with autocomplete
  - Variable validation (highlight broken references)

#### Week 10: Builder Toolbar & Operations

- [ ] **Toolbar**
  - Save (draft) button with auto-save
  - Publish button (creates new version)
  - Test button (execute with sample data)
  - Undo/redo (via Zustand history)
  - Zoom controls, fit-to-screen, minimap toggle

- [ ] **Agent testing mode**
  - "Test Run" dialog: input sample trigger data (JSON editor)
  - Execute agent in test mode (no side effects for action nodes)
  - Show step-by-step results in the canvas (node borders light up)
  - Display execution timeline with timing and token usage

- [ ] **Version management**
  - Version list sidebar
  - Publish dialog with change message input
  - Rollback to previous version
  - Visual diff between versions (highlight added/removed/changed nodes)

#### Week 11: Agent List & Detail Pages

- [ ] **Agent list page** (`/dashboard/agents`)
  - Grid/list view toggle
  - Agent cards showing: name, status, trigger type, last run time, success rate
  - Quick actions: execute, edit, pause, archive
  - Filters: status, trigger type, search by name
  - "Create Agent" button → new agent dialog or template picker

- [ ] **Agent detail page** (`/dashboard/agents/:id`)
  - Tabs: Builder, Executions, Settings, Versions
  - Builder tab: React Flow canvas (full screen)
  - Executions tab: list of recent executions with status, duration, cost
  - Settings tab: name, description, trigger config, timeout, retry, concurrency
  - Versions tab: version history with publish dates

- [ ] **Execution history page** (`/dashboard/executions`)
  - Table: agent name, status, triggered by, started at, duration, cost
  - Click to expand: step-by-step detail with inputs/outputs
  - Filters: agent, status, date range
  - Live-updating for running executions (WebSocket)

### Acceptance Criteria
- A user can build an agent visually by dragging nodes and connecting them
- Each node type has a configuration panel with appropriate form fields
- Variables can reference outputs from previous nodes
- Agents can be tested with sample data and results displayed on the canvas
- Agent versions can be published and rolled back
- Execution history shows step-by-step detail with real-time updates

---

## Phase 4: Integrations (Weeks 12-15)

### Goal
Connect AgentFlow to external tools so agents can interact with the real world.

### Deliverables

#### Week 12: Integration Architecture

- [ ] **Plugin base class** (`engine/tools/base.py`)
  ```python
  class IntegrationTool(ABC):
      name: str
      description: str
      required_scopes: list[str]
      actions: list[ToolAction]

      @abstractmethod
      async def execute(self, action, params, credentials) -> dict: ...
      @abstractmethod
      def get_oauth_config(self) -> OAuthConfig: ...
  ```
- [ ] **Tool registry** — register, discover, and instantiate tools by name
- [ ] **OAuth2 flow system**
  - Initiate OAuth: redirect to provider with state token
  - Callback handler: exchange code for tokens, encrypt and store
  - Automatic token refresh before expiry
- [ ] **Credential vault**
  - AES-256-GCM encryption at application level
  - AWS KMS for key management
  - Encrypt on write, decrypt on read, never log credentials

#### Week 13: Core Integrations (Batch 1)

- [ ] **Slack integration**
  - Actions: send message, read channel messages, list channels, react to message
  - OAuth scopes: `chat:write`, `channels:read`, `channels:history`
  - Webhook trigger: incoming Slack events → agent execution

- [ ] **Gmail integration**
  - Actions: send email, read inbox, search emails, create draft
  - OAuth scopes: `gmail.send`, `gmail.readonly`

- [ ] **Jira integration**
  - Actions: create issue, update issue, search issues, add comment, transition status
  - OAuth scopes: `read:jira-work`, `write:jira-work`

- [ ] **GitHub integration**
  - Actions: create issue, create comment, list PRs, create PR review
  - OAuth scopes: `repo`, `issues`

#### Week 14: Core Integrations (Batch 2)

- [ ] **Notion integration**
  - Actions: create page, update page, query database, append blocks
  - OAuth scopes: as per Notion API

- [ ] **Salesforce integration**
  - Actions: create/update contact, create/update lead, query SOQL
  - OAuth scopes: `api`, `refresh_token`

- [ ] **HubSpot integration**
  - Actions: create/update contact, create deal, log activity
  - OAuth scopes: `contacts`, `deals`

- [ ] **Google Sheets integration**
  - Actions: read range, write range, append row, create sheet
  - OAuth scopes: `spreadsheets`

#### Week 15: Generic Connectors & UI

- [ ] **Webhook connector**
  - Incoming webhook: generate unique URL per agent, parse payload
  - Outgoing webhook: send HTTP POST to user-defined URL

- [ ] **Custom API connector**
  - User defines: base URL, auth method (API key, Bearer, Basic), endpoints
  - Action: make HTTP request with templated URL, headers, body
  - Response mapping to agent context

- [ ] **Schedule/cron trigger**
  - celery-beat integration
  - Cron expression support (with human-readable preview)
  - Timezone-aware scheduling

- [ ] **Integration management UI**
  - Available integrations page with connect buttons
  - Connected integrations list with status, connected date, scopes
  - Disconnect confirmation dialog
  - Integration node types appear in builder palette when connected

### Acceptance Criteria
- At least 8 integrations are functional (Slack, Gmail, Jira, GitHub, Notion, Salesforce, HubSpot, Sheets)
- OAuth flow works end-to-end for each provider
- Credentials are encrypted at rest
- Integration actions are available as nodes in the visual builder
- Webhook triggers start agent executions
- Cron-scheduled agents run on time

---

## Phase 5: Knowledge Base & RAG (Weeks 16-18)

### Goal
Enable agents to access company knowledge via document upload, embedding, and retrieval.

### Deliverables

#### Week 16: Document Ingestion Pipeline

- [ ] **Knowledge base CRUD endpoints**
  - Create, list, get, delete knowledge bases
  - Upload documents (multipart form upload → S3)
  - List documents with processing status
  - Delete documents (cascade: remove chunks + embeddings)

- [ ] **File parsers**
  - PDF parser (PyPDF2 / pdfplumber)
  - DOCX parser (python-docx)
  - CSV parser (pandas)
  - TXT / Markdown parser (plain text)
  - HTML parser (BeautifulSoup)

- [ ] **Ingestion worker** (`workers/ingestion_worker.py`)
  - Celery task: `ingest_document(document_id)`
  - Download file from S3
  - Parse based on file type
  - Extract text content
  - Update document status (processing → ready / failed)

#### Week 17: Chunking & Embedding

- [ ] **Text chunking** (`engine/rag/chunking.py`)
  - Recursive character splitter (configurable chunk_size, chunk_overlap)
  - Semantic chunking (split on paragraph/section boundaries)
  - Metadata preservation (page number, section header)

- [ ] **Embedding generation** (`engine/rag/embeddings.py`)
  - OpenAI `text-embedding-3-small` (default)
  - Batch embedding for efficiency
  - Store embeddings in `document_chunks` table (pgvector)

- [ ] **pgvector setup**
  - Create `vector` extension in migration
  - IVFFlat index for approximate nearest neighbor search
  - Index tuning (lists parameter based on expected data volume)

- [ ] **Vector search** (`engine/rag/retrieval.py`)
  - Cosine similarity search over embeddings
  - Top-K retrieval with configurable K
  - Metadata filtering (by document, by knowledge base)
  - Result re-ranking (optional)

#### Week 18: RAG Node & UI

- [ ] **RAG retrieval node for builder**
  - "Knowledge Retrieval" node type in visual builder
  - Configuration: select knowledge base, query expression (from context), top K
  - Output: retrieved chunks with content, metadata, similarity score
  - Automatic injection into AI node prompts

- [ ] **Query endpoint**
  - `POST /knowledge-bases/:id/query` — semantic search
  - Returns ranked chunks with scores

- [ ] **Web URL ingestion**
  - Provide a URL → scrape content → process like a document
  - Handle common formats (HTML article pages)

- [ ] **Knowledge base management UI**
  - Knowledge bases list page
  - Create dialog: name, description, embedding model, chunk config
  - Document upload (drag & drop, multi-file)
  - Document list with processing status indicator
  - Test query interface: type a question, see retrieved chunks
  - Delete confirmation with cascade warning

### Acceptance Criteria
- Documents can be uploaded and processed (PDF, DOCX, CSV, TXT)
- Chunks are embedded and stored in pgvector
- Semantic search returns relevant results
- RAG retrieval node works in the visual builder
- AI nodes can use retrieved context in their prompts
- Knowledge base UI shows processing status and allows test queries

---

## Phase 6: Analytics & Billing (Weeks 19-22)

### Goal
Add observability dashboards and Stripe-powered billing.

### Deliverables

#### Week 19: Analytics Backend

- [ ] **Analytics service** (`services/analytics_service.py`)
  - Overview stats: total executions, success rate, avg duration, active agents (last 7d)
  - Usage over time: daily/weekly/monthly aggregation
  - Per-agent metrics: success rate, avg duration, total cost, error breakdown
  - Cost breakdown: by agent, by provider, by model, by time period

- [ ] **Analytics endpoints**
  - `GET /analytics/overview` — dashboard summary
  - `GET /analytics/usage?period=daily&from=...&to=...` — time series
  - `GET /analytics/agents/:id` — per-agent detail
  - `GET /analytics/costs?group_by=agent|provider|model` — cost breakdown

- [ ] **Usage daily aggregation worker** (`workers/billing_worker.py`)
  - Celery beat task: run daily at midnight UTC
  - Aggregate raw execution data into `usage_daily` table
  - Calculate total runs, tokens, cost per org per day

#### Week 20: Analytics Frontend

- [ ] **Analytics dashboard page** (`/dashboard/analytics`)
  - Summary cards: total executions, success rate, avg duration, active agents
  - Line chart: executions over time (daily/weekly)
  - Bar chart: token usage by provider
  - Pie chart: cost breakdown by agent
  - Table: top agents by usage

- [ ] **Chart library integration**
  - Recharts or Chart.js for data visualization
  - Responsive charts with date range picker
  - Loading states and empty states

- [ ] **Per-agent analytics**
  - Success rate trend
  - Execution duration histogram
  - Error breakdown (by error type)
  - Cost per execution trend

#### Week 21: Stripe Integration

- [ ] **Stripe setup**
  - Products + Prices in Stripe (Starter, Pro, Enterprise)
  - Webhook endpoint for Stripe events

- [ ] **Billing service** (`services/billing_service.py`)
  - Create Stripe customer on org creation
  - Create subscription (checkout session)
  - Handle webhook events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Metered usage reporting to Stripe

- [ ] **Billing endpoints**
  - `GET /billing/subscription` — current plan + status
  - `POST /billing/subscribe` — create checkout session
  - `POST /billing/portal` — Stripe customer portal session URL
  - `GET /billing/invoices` — invoice history
  - `GET /billing/usage` — current period usage vs limits

- [ ] **Plan limits enforcement**
  - Max agents per plan
  - Max executions per month per plan
  - Check limits before agent creation and execution
  - Return clear error when limit reached

#### Week 22: Billing Frontend & Alerts

- [ ] **Billing settings page** (`/dashboard/settings/billing`)
  - Current plan display with features
  - Upgrade/downgrade buttons
  - Usage meter: runs used / runs included
  - Invoice history table
  - "Manage Billing" button → Stripe customer portal

- [ ] **Usage alerts**
  - In-app notification when 80% of plan limit reached
  - Email notification when 100% reached
  - Admin notification for payment failures

### Acceptance Criteria
- Analytics dashboard shows accurate execution metrics
- Charts display usage trends over time
- Stripe subscriptions work end-to-end (subscribe, upgrade, cancel)
- Plan limits are enforced (can't exceed max agents/runs)
- Usage is accurately tracked and reported to Stripe for metered billing
- Admins receive alerts for usage thresholds and payment issues

---

## Phase 7: Enterprise Features (Weeks 23-26)

### Goal
Harden the platform for enterprise customers with security, compliance, and governance features.

### Deliverables

#### Week 23: SSO & Advanced RBAC

- [ ] **SSO hardening**
  - SAML support via WorkOS (tested with Okta, Azure AD)
  - OIDC support
  - Directory sync: auto-provision/deprovision users from IdP
  - Enforce SSO (disable email/password when SSO is active)

- [ ] **Advanced RBAC**
  - Custom roles with granular permissions
  - Per-agent access control (restrict which teams can edit/execute specific agents)
  - Team-based permissions (assign agents to teams)

#### Week 24: Audit Logs

- [ ] **Audit log system**
  - Middleware captures all mutations (POST, PUT, DELETE)
  - Logged fields: user_id, action, resource_type, resource_id, details, IP, user agent, timestamp
  - Actions: `agent.created`, `agent.updated`, `agent.deleted`, `agent.executed`, `member.invited`, `member.removed`, `integration.connected`, `api_key.created`, etc.

- [ ] **Audit log endpoints**
  - `GET /org/audit-logs` — paginated, filterable by action, user, resource, date range

- [ ] **Audit log viewer UI** (`/dashboard/audit`)
  - Table with columns: timestamp, user, action, resource, IP
  - Filters: action type, user, date range
  - Click to expand: full detail JSON
  - Export to CSV

#### Week 25: Security Hardening

- [ ] **IP allowlisting**
  - Org setting: list of allowed IP ranges (CIDR)
  - Middleware: reject requests from non-allowed IPs (when configured)

- [ ] **API rate limiting**
  - Per-org limits (configurable by plan)
  - Per-API-key limits
  - Redis sliding window counter implementation
  - Rate limit headers in responses
  - 429 response with retry-after

- [ ] **Data retention policies**
  - Org setting: execution data retention period (30d, 90d, 365d, unlimited)
  - Background worker: purge expired execution data
  - Warn before deletion

- [ ] **Environment variables for agents**
  - Org-scoped secrets (encrypted, like integration credentials)
  - Available in agent execution context as `{{env.SECRET_NAME}}`
  - CRUD endpoints for managing environment variables

#### Week 26: Enterprise Polish

- [ ] **Data export**
  - Export executions to CSV/JSON (filtered by date range)
  - Export audit logs to CSV
  - Async export for large datasets (generate file, send download link)

- [ ] **Webhook event system**
  - Org-level webhook configuration: URL + events to subscribe
  - Events: `execution.completed`, `execution.failed`, `agent.activated`, etc.
  - Webhook delivery with retry (3 attempts, exponential backoff)
  - Delivery log for debugging

- [ ] **Multi-region preparation**
  - Data residency flag on org (US, EU)
  - Database and storage region routing (design, not full implementation)
  - Documentation for compliance team

### Acceptance Criteria
- SSO works with major identity providers (Okta, Azure AD, Google Workspace)
- Audit logs capture all mutations with full detail
- IP allowlisting blocks unauthorized access
- Rate limiting returns 429 with proper headers
- Data retention policies automatically clean up old data
- Webhook events are delivered reliably to configured endpoints

---

## Phase 8: SDK, CLI & Marketplace (Weeks 27-30)

### Goal
Build the developer ecosystem — SDKs for programmatic access, a CLI for terminal workflows, and a template marketplace.

### Deliverables

#### Week 27: Python SDK

- [ ] **Python SDK** (`packages/sdk-python/`)
  - `AgentFlowClient` — authenticated client (API key)
  - Agent management: `client.agents.list()`, `.create()`, `.get()`, `.update()`, `.delete()`
  - Execution: `client.agents.execute(id, data)`, `.executions.get(id)`, `.executions.stream(id)`
  - Knowledge bases: `client.knowledge_bases.create()`, `.upload_document()`, `.query()`
  - Integrations: `client.integrations.list()`, `.connect()`
  - Streaming support: iterate over execution events
  - Pydantic models for type safety
  - Published to PyPI: `pip install agentflow`

#### Week 28: TypeScript SDK & CLI

- [ ] **TypeScript SDK** (`packages/sdk-typescript/`)
  - Same API surface as Python SDK
  - Full TypeScript types
  - Published to npm: `npm install @agentflow/sdk`

- [ ] **CLI tool**
  - `agentflow login` — authenticate with API key
  - `agentflow agents list` — list agents
  - `agentflow agents create --name "..." --from-file agent.yaml` — create from YAML definition
  - `agentflow agents deploy <id>` — publish latest version
  - `agentflow execute <agent-id> --data '{...}'` — trigger execution
  - `agentflow logs <execution-id>` — stream execution logs
  - `agentflow status` — current org usage stats
  - Rich terminal output (tables, colors, spinners)
  - Published to npm: `npx @agentflow/cli`

#### Week 29: Template Marketplace

- [ ] **Marketplace backend**
  - Template publishing: convert agent definition to template
  - Template browsing: paginated, filterable by category
  - One-click install: clone template into user's org as a new agent
  - Install count tracking
  - Rating and reviews (future — design schema now)

- [ ] **Marketplace frontend** (`/dashboard/templates`)
  - Template gallery with cards: name, description, category, install count, rating
  - Category filters: Support, Sales, Engineering, HR, Marketing
  - Search by name/description
  - Template detail page: description, node graph preview, install button
  - "Publish as Template" option in agent settings

- [ ] **Official templates** (seed the marketplace)
  - "Support Ticket Classifier" — classify Jira tickets using AI, route to team
  - "Meeting Notes Summarizer" — summarize meeting notes and send to Slack
  - "Lead Enrichment" — enrich CRM leads with AI-generated research
  - "PR Review Assistant" — review GitHub PRs and post comments
  - "Daily Standup Digest" — aggregate Slack standup messages into summary

#### Week 30: Documentation & Developer Portal

- [ ] **API documentation**
  - Auto-generated from FastAPI OpenAPI spec
  - Hosted Swagger UI + ReDoc
  - Custom documentation site (Next.js or Docusaurus)

- [ ] **SDK documentation**
  - Getting started guides (Python + TypeScript)
  - Code examples for common use cases
  - API reference (auto-generated from type definitions)

- [ ] **Developer guides**
  - "Build your first agent" tutorial
  - "Agent builder node reference" — all node types with config options
  - "Integration development guide" — how to build a custom integration
  - "Deployment guide" — self-hosting with Docker Compose

### Acceptance Criteria
- Python SDK can create, deploy, and execute agents programmatically
- TypeScript SDK has the same capabilities
- CLI can manage agents and stream execution logs
- Template marketplace has 5+ official templates
- Templates can be installed with one click
- API documentation is complete and auto-generated
- Developer guides cover key use cases

---

## Cross-Cutting Concerns (Ongoing)

These items are addressed throughout all phases:

### Testing
- **Unit tests:** Written alongside every feature (80%+ coverage target)
- **Integration tests:** API endpoint tests with test database
- **E2E tests:** Playwright tests added for each major UI feature
- **CI pipeline:** Runs on every PR (lint, type-check, unit tests, integration tests)

### Security
- **Input validation:** Pydantic validation on all endpoints
- **SQL injection prevention:** SQLAlchemy ORM (parameterized queries)
- **XSS prevention:** React's built-in escaping + Content-Security-Policy headers
- **CSRF protection:** SameSite cookies + CSRF tokens for mutations
- **Dependency scanning:** Snyk / Dependabot for vulnerability alerts

### Performance
- **Database:** Indexes on all foreign keys and frequently queried columns
- **Caching:** Redis caching for frequently read data (org settings, agent definitions)
- **Pagination:** Cursor-based pagination on all list endpoints
- **Connection pooling:** SQLAlchemy async connection pool, Redis connection pool

### Documentation
- **Code comments:** For complex business logic only (not obvious code)
- **API docs:** Auto-generated from FastAPI type hints
- **Architecture Decision Records (ADRs):** Document major technical decisions

---

## Risk Management

| Risk | Phase | Mitigation |
|------|-------|------------|
| React Flow performance with complex graphs | Phase 3 | Virtualization, limit max nodes to 100 initially |
| LLM provider rate limits during high load | Phase 2 | Queue-based execution, provider fallback, rate limiting |
| OAuth token refresh failures | Phase 4 | Automatic retry, alert on failure, re-auth prompt |
| pgvector performance at scale | Phase 5 | IVFFlat index tuning, partition by knowledge base if needed |
| Stripe webhook reliability | Phase 6 | Idempotent handlers, dead letter queue, reconciliation job |
| Celery worker memory leaks | Phase 2+ | Worker recycling (max-tasks-per-child), memory monitoring |
| Multi-tenant data leakage | All | Org-scoped queries enforced at ORM level, tested in CI |

---

## Milestone Summary

| Phase | Milestone | Key Outcome |
|-------|-----------|-------------|
| 1 | **Foundation** | Users can sign up, manage org, authenticate |
| 2 | **Engine** | Agents execute asynchronously with real-time updates |
| 3 | **Builder** | Visual drag-and-drop agent builder is functional |
| 4 | **Integrations** | Agents can interact with 8+ external tools |
| 5 | **Knowledge** | RAG pipeline enables agents to use company knowledge |
| 6 | **Analytics** | Dashboards + Stripe billing are live |
| 7 | **Enterprise** | SSO, audit logs, rate limiting, data retention |
| 8 | **Ecosystem** | SDKs, CLI, marketplace, documentation |

After Phase 8, the platform is feature-complete for v1 launch.
