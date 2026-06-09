"""
Application configuration using Pydantic BaseSettings.

Reads from environment variables or a .env file at the project root.
All secrets (API keys, JWT secret, SMTP credentials) are sourced here
so that no service module ever hard-codes a credential.
"""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    APP_ENV: Literal["development", "production", "test"] = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Database ──────────────────────────────────────────────────────────
    # Falls back to a local SQLite file so the app runs with zero infra setup.
    DATABASE_URL: str = "sqlite+aiosqlite:///./localaudit.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _default_database_url_if_blank(cls, value: str | None) -> str:
        """Treat an empty DATABASE_URL in .env as "use the SQLite default".

        Without this, `DATABASE_URL=` (present but blank) overrides the
        Python default with `''`, which SQLAlchemy cannot parse.
        """
        if not value or not value.strip():
            return "sqlite+aiosqlite:///./localaudit.db"
        return value

    # ── Security ──────────────────────────────────────────────────────────
    JWT_SECRET: str = "changeme-set-a-real-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    # Tokens expire after 7 days by default — long enough for a SaaS session
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    # ── Anthropic (Claude) ────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    # claude-haiku-4-5 is fast and cheap for bulk report generation
    CLAUDE_MODEL: str = "claude-haiku-4-5-20251001"

    # ── Gmail SMTP ────────────────────────────────────────────────────────
    GMAIL_ADDRESS: str = ""
    GMAIL_APP_PASSWORD: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    # ── Pipeline defaults ─────────────────────────────────────────────────
    # Only process leads whose score is below this threshold; higher scores
    # indicate a healthy-enough website that an outreach is less likely to convert.
    MAX_LEAD_SCORE: int = 70
    # Minimum issues required before a lead is worth contacting
    MIN_ISSUES_TO_CONTACT: int = 3
    # Follow-up delay in days
    FOLLOW_UP_1_DAYS: int = 3
    FOLLOW_UP_2_DAYS: int = 7
    # Don't re-email a business we've already contacted within this many days,
    # even if a re-scan rediscovers it as a "new" lead
    EMAIL_COOLDOWN_DAYS: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings singleton — called by every module that needs config."""
    return Settings()
