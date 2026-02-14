# Self-Hosting AgentFlow

This guide covers running AgentFlow on your own infrastructure using Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ and Docker Compose v2
- At least 2GB RAM available
- Ports 3000, 8000, 5432, 6379 available

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/codersanket/agentflow.git
cd agentflow
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
# REQUIRED: Change this to a random secret
JWT_SECRET_KEY=your-random-secret-key-at-least-32-chars

# OPTIONAL: Add AI provider keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start all services

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts:
- **PostgreSQL 16** (with pgvector) on port 5432
- **Redis 7** on port 6379
- **Mailpit** (email testing) on port 8025

### 4. Run database migrations

```bash
# If running the API outside Docker:
cd apps/api && poetry run alembic upgrade head

# If running via Docker:
docker compose exec api alembic upgrade head
```

### 5. Access AgentFlow

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Mailpit:** http://localhost:8025

## Environment Variables

### Required

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://agentflow:agentflow@localhost:5432/agentflow` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens | **Must be changed** |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT models | — |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | — |
| `GOOGLE_API_KEY` | Google API key for Gemini models | — |
| `OLLAMA_URL` | Ollama server URL for local models | `http://localhost:11434` |
| `API_CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server for emails | `localhost` |
| `SMTP_PORT` | SMTP port | `1025` |

## Persistent Storage

Docker Compose creates named volumes for data persistence:

- `pgdata` — PostgreSQL data
- `redisdata` — Redis data

Data persists across container restarts. To reset everything:

```bash
docker compose -f infra/docker/docker-compose.yml down -v
docker compose -f infra/docker/docker-compose.yml up -d
```

## Backup and Restore

### Database Backup

```bash
docker compose exec postgres pg_dump -U agentflow agentflow > backup.sql
```

### Database Restore

```bash
cat backup.sql | docker compose exec -T postgres psql -U agentflow agentflow
```

## Upgrading

```bash
git pull origin main
docker compose -f infra/docker/docker-compose.yml down
docker compose -f infra/docker/docker-compose.yml up -d --build

# Run any new migrations
cd apps/api && poetry run alembic upgrade head
```

## Troubleshooting

### Port conflicts

If ports are in use, edit `infra/docker/docker-compose.yml` to change the host port mappings.

### Database connection errors

Ensure PostgreSQL is healthy:
```bash
docker compose exec postgres pg_isready -U agentflow
```

### Redis connection errors

Ensure Redis is healthy:
```bash
docker compose exec redis redis-cli ping
```
