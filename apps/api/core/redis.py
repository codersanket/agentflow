from __future__ import annotations

from redis.asyncio import ConnectionPool, Redis

from core.config import settings

pool = ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)


async def get_redis() -> Redis:
    return Redis(connection_pool=pool)


async def close_redis() -> None:
    await pool.aclose()
