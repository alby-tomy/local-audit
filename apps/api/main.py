"""
LocalAudit AI — FastAPI application entry point.

Mounts all routers, configures CORS for the Next.js frontend, sets up
logging, and runs the database table creation on startup.

Run locally:
    uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import init_db
from .routers import auth, health, leads, pipeline, settings as settings_router

# ── Logging configuration ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

settings = get_settings()

# ── App creation ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="LocalAudit AI",
    description=(
        "Automated local business discovery, website analysis, "
        "AI report generation, and outreach pipeline."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow the Next.js frontend (and localhost for development) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(pipeline.router)
app.include_router(settings_router.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup() -> None:
    """Create database tables on first startup.

    In production, replace this with proper Alembic migrations to avoid
    destructive schema changes on deployment.
    """
    logger.info("Starting LocalAudit AI API (env=%s)", settings.APP_ENV)
    await init_db()
    logger.info("Database tables ready.")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    from .core.database import engine
    await engine.dispose()
    logger.info("Database connections closed.")
