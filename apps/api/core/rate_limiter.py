import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis
from apps.api.core.redis import get_redis_client
from apps.api.core.config import RATE_LIMIT_AUTH_RPM, RATE_LIMIT_API_RPM, RATE_LIMIT_ENABLED

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_client=None):
        super().__init__(app)
        self.redis_client = redis_client or get_redis_client()

    async def dispatch(self, request: Request, call_next):
        if not RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path
        ip = request.client.host
        if path.startswith("/api/v1/auth/"):
            rate_limit = RATE_LIMIT_AUTH_RPM
        else:
            rate_limit = RATE_LIMIT_API_RPM

        key = f"rate_limit:{ip}:{path}"
        current_time = int(time.time())
        window_start = current_time - 60

        pipeline = self.redis_client.pipeline()
        pipeline.zremrangebyscore(key, 0, window_start)
        pipeline.zcard(key)
        pipeline.zadd(key, {current_time: current_time})
        pipeline.zexpire(key, 60)
        _, request_count, _ = pipeline.execute()

        if request_count >= rate_limit:
            retry_after = 60 - (current_time - window_start)
            headers = {
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(rate_limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(current_time + retry_after))
            }
            raise HTTPException(status_code=429, detail="Too Many Requests", headers=headers)
        
        headers = {
            "X-RateLimit-Limit": str(rate_limit),
            "X-RateLimit-Remaining": str(rate_limit - request_count - 1),
            "X-RateLimit-Reset": str(int(current_time + 60))
        }
        
        response = await call_next(request)
        response.headers.update(headers)
        return response
