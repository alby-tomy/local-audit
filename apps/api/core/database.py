from __future__ import annotations

from typing import Any

import asyncpg

from .config import get_settings


class DatabaseClient:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def fetch_one(self, query: str, *args: Any) -> dict[str, Any] | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def fetch_all(self, query: str, *args: Any) -> list[dict[str, Any]]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]

    async def execute(self, query: str, *args: Any) -> str:
        async with self._pool.acquire() as conn:
            return await conn.execute(query, *args)


_pool: asyncpg.Pool | None = None
_db: DatabaseClient | None = None


async def init_db() -> None:
    global _pool, _db
    if _pool is not None:
        return
    settings = get_settings()
    # Supabase pooler/PgBouncer compatibility:
    # disable asyncpg statement cache to avoid prepared statement errors.
    _pool = await asyncpg.create_pool(
        settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        statement_cache_size=0,
    )
    _db = DatabaseClient(_pool)


async def close_db() -> None:
    global _pool, _db
    if _pool is not None:
        await _pool.close()
    _pool = None
    _db = None


async def get_db() -> DatabaseClient:
    if _db is None:
        raise RuntimeError("Database is not initialized")
    return _db
