<p align="center">
  <h1 align="center">AgentFlow</h1>
  <p align="center">Open-source AI agent platform for building, deploying, and managing workflow automations.</p>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#development">Development</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Features

- **Visual Agent Builder** — Drag-and-drop React Flow canvas for designing AI workflows
- **Multi-Provider AI** — OpenAI, Anthropic, Google, Ollama with automatic fallback
- **Execution Engine** — Async Celery workers with real-time WebSocket streaming
- **Integrations** — Slack, webhooks, custom HTTP connectors (plugin architecture)
- **Knowledge Base (RAG)** — Document upload, chunking, pgvector semantic search
- **Templates** — 5 pre-built agent templates for common workflows
- **Analytics** — Usage dashboard, cost tracking, per-agent metrics
- **Auth & RBAC** — JWT authentication, role-based access (Owner/Admin/Editor/Viewer)
- **Self-Hostable** — Docker Compose, run anywhere

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) 20+ and [pnpm](https://pnpm.io/) 9+
- [Python](https://python.org/) 3.12+ and [Poetry](https://python-poetry.org/)

### 1. Clone and configure

```bash
git clone https://github.com/codersanket/agentflow.git
cd agentflow
cp .env.example .env
```

### 2. Start infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts PostgreSQL 16 (with pgvector), Redis 7, and Mailpit.

### 3. Install dependencies

```bash
# Frontend
pnpm install

# Backend
cd apps/api && poetry install
```

### 4. Run database migrations

```bash
cd apps/api && poetry run alembic upgrade head
```

### 5. Start the app

```bash
# Terminal 1: Backend API
cd apps/api && poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) — sign up and start building agents.

## Architecture

```
agentflow/
├── apps/
│   ├── web/          # Next.js 14 frontend (App Router, shadcn/ui, React Flow)
│   └── api/          # FastAPI backend (SQLAlchemy, Celery, LangGraph)
├── packages/         # Shared packages (future: SDK)
├── infra/            # Docker, Dockerfiles
└── docs/             # PRD, Tech PRD, Plan
```

```
Client (Next.js) → FastAPI API → PostgreSQL + Redis
                                      ↓
                              Celery Workers → LLM Providers
                                      ↓
                              Redis Pub/Sub → WebSocket → Client
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, React Flow, Zustand |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, Alembic |
| Engine | Celery, Redis, topological graph executor |
| AI | OpenAI, Anthropic, Google, Ollama (via httpx) |
| Database | PostgreSQL 16 + pgvector |
| Cache/Queue | Redis 7 |

## Development

### Project Scripts

```bash
pnpm dev:web          # Start frontend dev server
pnpm dev:api          # Start backend API with hot-reload
pnpm docker:up        # Start Postgres + Redis
pnpm docker:down      # Stop infrastructure
pnpm db:migrate       # Run Alembic migrations
pnpm db:makemigrations "message"  # Create new migration
```

### Backend Development

```bash
cd apps/api
poetry run ruff check .        # Lint
poetry run ruff format .       # Format
poetry run pytest              # Test
```

### Frontend Development

```bash
cd apps/web
pnpm lint              # ESLint
pnpm build             # Production build
pnpm test              # Vitest
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Setting up your development environment
- Code style and conventions
- Pull request process
- Issue reporting

## License

AgentFlow is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you can freely use, modify, and distribute AgentFlow, but if you run a modified version as a network service, you must make the source code available to users of that service.

## Links

- [Technical PRD](docs/TECH_PRD.md)
- [Product PRD](docs/PRD.md)
- [Implementation Plan](docs/PLAN.md)
- [Self-Hosting Guide](docs/SELF_HOSTING.md)
