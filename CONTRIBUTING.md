# Contributing to AgentFlow

Thank you for your interest in contributing to AgentFlow! This guide will help you get started.

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm 9+
- Python 3.12+ and Poetry
- Git

### Getting Started

```bash
# Clone the repo
git clone https://github.com/codersanket/agentflow.git
cd agentflow

# Copy environment config
cp .env.example .env

# Start infrastructure (Postgres + Redis)
docker compose -f infra/docker/docker-compose.yml up -d

# Install frontend dependencies
pnpm install

# Install backend dependencies
cd apps/api && poetry install && cd ../..

# Run database migrations
cd apps/api && poetry run alembic upgrade head && cd ../..

# Start the app (two terminals)
pnpm dev:api     # Terminal 1: Backend on :8000
pnpm dev:web     # Terminal 2: Frontend on :3000
```

## Code Style

### Python (Backend)

- **Formatter/Linter:** [Ruff](https://docs.astral.sh/ruff/)
- **Line length:** 100 characters
- **Type hints:** Required on all function signatures
- **Imports:** `from __future__ import annotations` at the top of every file
- **Async:** All I/O operations must use async/await

```bash
cd apps/api
poetry run ruff check .      # Check lint errors
poetry run ruff format .     # Auto-format
```

### TypeScript (Frontend)

- **Linter:** ESLint (Next.js config)
- **Components:** PascalCase, named exports (not default)
- **Files:** kebab-case.tsx for components, kebab-case.ts for utilities
- **State:** Zustand for cross-component, React state for local UI
- **Forms:** react-hook-form + zod validation

```bash
cd apps/web
pnpm lint
```

## Pull Request Process

### 1. Create a branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make your changes

- Write code following the style guidelines above
- Add tests for new functionality
- Update documentation if needed

### 3. Test your changes

```bash
# Backend
cd apps/api && poetry run pytest

# Frontend
cd apps/web && pnpm build
```

### 4. Commit

Use clear, descriptive commit messages:

```
feat: add Notion integration
fix: resolve token refresh race condition
docs: update self-hosting guide for ARM64
refactor: extract variable resolver into separate module
```

### 5. Open a Pull Request

- Fill out the PR template
- Link any related issues
- Ensure CI passes
- Request review from a maintainer

## What to Contribute

### Good First Issues

Look for issues labeled `good-first-issue` — these are scoped tasks ideal for newcomers.

### Integration Plugins

Adding new integrations is one of the best ways to contribute. Each integration is self-contained in `apps/api/engine/tools/`:

1. Create a new file (e.g., `notion.py`)
2. Implement the `IntegrationTool` interface
3. Register in the tool registry
4. Add to the available integrations list

### Bug Fixes

Found a bug? Open an issue first, then submit a PR with:
- A description of the bug
- Steps to reproduce
- Your fix and any tests

## Project Structure

```
agentflow/
├── apps/web/           # Next.js frontend
│   ├── app/            # App Router pages
│   ├── components/     # React components
│   ├── stores/         # Zustand state stores
│   └── lib/            # Utilities, API client
├── apps/api/           # FastAPI backend
│   ├── core/           # Config, DB, auth, dependencies
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic request/response schemas
│   ├── routers/        # API route handlers
│   ├── services/       # Business logic
│   ├── engine/         # Execution engine, providers, tools
│   ├── workers/        # Celery background tasks
│   └── migrations/     # Alembic database migrations
├── infra/              # Docker files
└── docs/               # Documentation
```

## Key Conventions

- **Multi-tenancy:** Every database query MUST be scoped by `org_id`
- **No secrets in code:** Never commit `.env`, API keys, or credentials
- **Async everywhere:** All backend I/O uses async/await
- **Pydantic validation:** All API input is validated with Pydantic schemas
- **UUID primary keys:** All database tables use UUID PKs

## Questions?

Open a [GitHub Discussion](https://github.com/codersanket/agentflow/discussions) or file an issue. We're happy to help!
