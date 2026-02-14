# AgentFlow — Claude Code Instructions

## Project Overview
AgentFlow is an **open-source** AI Agent Platform that enables teams to build, deploy, and manage AI agents that automate workflows across their tool stack (Slack, Gmail, Jira, Salesforce, etc.) via a visual drag-and-drop builder or SDK/API.

**License:** AGPLv3 (open-core model — cloud + enterprise features added later based on community traction)

**Strategy:** Ship open source first → gauge community reaction → add paid cloud hosting + enterprise tier

## Monorepo Structure
```
agentflow/
├── apps/
│   ├── web/          # Next.js 14 (App Router) frontend
│   └── api/          # FastAPI Python backend
├── packages/
│   ├── sdk-python/   # Python SDK (PyPI)
│   └── sdk-ts/       # TypeScript SDK (npm)
├── infra/
│   └── docker/       # Docker Compose for local dev
├── docs/
│   ├── PRD.md        # Product requirements
│   ├── TECH_PRD.md   # Technical architecture
│   └── PLAN.md       # Phased implementation plan
└── CLAUDE.md         # (this file)
```

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, React Flow, Zustand
- **Backend:** Python 3.12+, FastAPI, SQLAlchemy (async), Pydantic v2, Alembic
- **Database:** PostgreSQL 16 + pgvector extension
- **Queue/Cache:** Redis 7, Celery
- **Agent Engine:** LangGraph + LangChain (selective)
- **Auth:** JWT (access + refresh tokens), API keys (SHA-256 hashed)
- **Infra:** Docker Compose (self-hosted), deploy target TBD for future cloud tier

## Build Phases (Open Source First)
1. **Foundation** — Monorepo, auth, database, RBAC, dashboard shell
2. **Agent Engine** — Execution engine, AI providers, Celery workers, WebSocket streaming
3. **Visual Builder** — React Flow canvas, node config, testing, version management
4. **Integrations** — Slack, webhook, custom HTTP (start with 2-3, community adds more)
5. **Templates** — 5 pre-built agent templates for quick start
6. **Analytics** — Usage dashboard, cost breakdown, per-agent metrics
7. **Knowledge Base (RAG)** — Document ingestion, chunking, pgvector search, RAG node
8. **Open Source Launch** — LICENSE (AGPLv3), README, CONTRIBUTING.md, Docker self-host guide, GitHub repo setup

### Future (Post-Community Validation)
9. **Cloud Hosting** — Managed cloud tier with Stripe billing
10. **Enterprise** — SSO/SAML, audit logs, rate limiting (paid tier)
11. **Ecosystem** — Python SDK, TypeScript SDK, CLI, marketplace

## Code Conventions

### Frontend (apps/web)
- Use App Router (`app/` directory) with route groups: `(auth)`, `(dashboard)`
- Components in `components/` with subdirectories by feature
- Use shadcn/ui components — installed locally, not as dependency
- State management via Zustand stores in `stores/`
- API calls via a typed client in `lib/api.ts`
- All components are TypeScript with strict mode
- Use `className` with Tailwind, never inline styles
- File naming: kebab-case for files, PascalCase for components

### Backend (apps/api)
- Project structure:
  ```
  apps/api/
  ├── main.py
  ├── core/           # Config, database, security, redis
  ├── models/         # SQLAlchemy models
  ├── schemas/        # Pydantic request/response schemas
  ├── routers/        # FastAPI route handlers
  ├── services/       # Business logic layer
  ├── engine/         # Agent execution engine
  │   ├── providers/  # LLM provider abstraction
  │   ├── tools/      # Integration plugins
  │   ├── rag/        # RAG pipeline
  │   └── orchestrator.py
  └── workers/        # Celery tasks
  ```
- Async everywhere — use `async def` for all endpoints and services
- All DB queries scoped to `org_id` — never allow cross-tenant access
- Pydantic v2 for all request/response validation
- SQLAlchemy 2.0 style with async session
- Alembic for all schema changes — never modify DB manually
- Type hints on all function signatures
- Use `from __future__ import annotations` in all Python files

### Database
- UUID primary keys everywhere
- `created_at TIMESTAMPTZ DEFAULT NOW()` on all tables
- `org_id` foreign key on all tenant-scoped tables
- JSONB for flexible config fields (agent config, settings, metadata)
- Indexes on all foreign keys and frequently filtered columns
- Soft-delete via `status = 'archived'` for agents, hard delete for user data on request

### API Design
- Base path: `/api/v1/`
- Auth: Bearer JWT or `X-API-Key` header
- Pagination: cursor-based (`?cursor=xxx&limit=20`)
- Errors: `{"error": {"code": "ERROR_CODE", "message": "Human-readable message"}}`
- All list endpoints support filtering and sorting

## Task Management (Beads)
This project uses **Beads** (`bd`) for issue tracking. All tasks live in `.beads/`.

```bash
bd ready              # Find available work (unblocked tasks)
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
bd list               # List all issues
```

### Task Structure
- Epics: `agentflow-xxx` (one per phase)
- Sub-tasks: `agentflow-xxx.N` (work items within a phase)
- Dependencies enforce build order — `bd ready` shows what's unblocked

## Multi-Agent Workflow
This project uses Claude Code multi-agent mode. When working:
- Run `bd ready` to find available work
- Claim a task with `bd update <id> --status in_progress`
- Read the relevant CLAUDE.md in subdirectories for context-specific instructions
- Reference docs/PRD.md, docs/TECH_PRD.md, and docs/PLAN.md for requirements
- Close tasks with `bd close <id>` when acceptance criteria are met
- Run `bd sync` before ending a session

## Key Commands
```bash
# Local development
docker compose -f infra/docker/docker-compose.yml up -d   # Start Postgres + Redis
cd apps/web && pnpm dev                                     # Frontend dev server
cd apps/api && uvicorn main:app --reload                    # Backend dev server
cd apps/api && celery -A workers.celery_app worker --loglevel=info  # Celery worker

# Database
cd apps/api && alembic upgrade head                         # Run migrations
cd apps/api && alembic revision --autogenerate -m "desc"    # Create migration

# Testing
cd apps/api && pytest                                       # Backend tests
cd apps/web && pnpm test                                    # Frontend tests

# Linting
cd apps/api && ruff check . && ruff format .                # Python lint + format
cd apps/web && pnpm lint                                    # Frontend lint
```

## Important Rules
- NEVER commit .env files or secrets
- NEVER skip multi-tenant scoping — every query must filter by org_id
- NEVER store credentials in plain text — always encrypt with AES-256
- ALWAYS validate user input with Pydantic before processing
- ALWAYS use parameterized queries (SQLAlchemy ORM) — no raw SQL strings
- ALWAYS write migrations for schema changes — no manual DB edits
- Keep AI provider calls behind the abstraction layer — never call OpenAI/Anthropic directly from routes
