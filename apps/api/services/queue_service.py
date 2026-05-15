from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis

from core.config import get_settings

settings = get_settings()
_redis: Redis | None = None


def _channel(name: str) -> str:
    return f"{settings.WORKER_REDIS_CHANNEL_PREFIX}:{name}"


async def _redis_client() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def enqueue_audit(audit_id: str, tenant_id: str, website_url: str) -> None:
    redis = await _redis_client()
    await redis.publish(
        _channel("audit"),
        json.dumps({"auditId": audit_id, "tenantId": tenant_id, "websiteUrl": website_url}),
    )


async def enqueue_fix(audit_id: str, tenant_id: str, issue: dict[str, Any], html: str | None = None) -> None:
    redis = await _redis_client()
    await redis.publish(
        _channel("fix"),
        json.dumps(
            {
                "auditId": audit_id,
                "tenantId": tenant_id,
                "issue": issue,
                "html": html,
            }
        ),
    )


async def enqueue_delivery(audit_id: str, tenant_id: str, client_email: str) -> None:
    redis = await _redis_client()
    await redis.publish(
        _channel("delivery"),
        json.dumps({"auditId": audit_id, "tenantId": tenant_id, "clientEmail": client_email}),
    )


async def enqueue_deletion(tenant_id: str, delay_days: int = 30) -> None:
    redis = await _redis_client()
    await redis.publish(
        _channel("deletion"),
        json.dumps({"tenantId": tenant_id, "delayDays": delay_days}),
    )

