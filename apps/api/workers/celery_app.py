from __future__ import annotations

from celery import Celery

from core.config import settings

celery_app = Celery(
    "agentflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "workers.agent_worker.execute_agent": {"queue": "agents"},
        "workers.ingestion_worker.ingest_document": {"queue": "ingestion"},
        "workers.schedule_worker.check_scheduled_agents": {"queue": "agents"},
    },
    beat_schedule={
        "check-scheduled-agents": {
            "task": "workers.schedule_worker.check_scheduled_agents",
            "schedule": 60.0,  # Run every 60 seconds
        },
    },
)
