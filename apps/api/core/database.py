"""
Async SQLAlchemy database engine and session factory.

Uses aiosqlite in development (zero-config) and asyncpg in production.
All database access goes through the `get_db` dependency injected into
FastAPI route handlers — this guarantees each request gets its own
session that is properly closed even on exception.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


# SQLite needs check_same_thread=False; PostgreSQL ignores it.
_connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    # Echo SQL only in dev — avoids leaking queries in production logs
    echo=settings.APP_ENV == "development",
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create all tables on startup if they do not exist yet.

    In production, prefer running Alembic migrations instead of calling this.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async DB session.

    The session is automatically rolled back on exception and closed
    after the request completes, preventing connection leaks.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
