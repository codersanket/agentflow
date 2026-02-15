from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import engine
from core.redis import close_redis
from routers.agents import router as agents_router
from routers.analytics import router as analytics_router
from routers.auth import router as auth_router
from routers.executions import agent_execution_router
from routers.executions import router as executions_router
from routers.integrations import router as integrations_router
from routers.knowledge import router as knowledge_router
from routers.org import router as org_router
from routers.templates import router as templates_router
from routers.webhooks import router as webhooks_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup — seed templates
    try:
        from scripts.seed_templates import seed as seed_templates

        await seed_templates()
    except Exception:
        pass  # Don't block startup if seeding fails

    yield
    # Shutdown
    await engine.dispose()
    await close_redis()


app = FastAPI(
    title="AgentFlow API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# Health check
@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


# API v1 router
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(org_router)
api_v1_router.include_router(agents_router)
api_v1_router.include_router(executions_router)
api_v1_router.include_router(agent_execution_router)
api_v1_router.include_router(templates_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(integrations_router)
api_v1_router.include_router(knowledge_router)
api_v1_router.include_router(webhooks_router)

app.include_router(api_v1_router)
