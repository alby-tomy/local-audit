from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    JWT_SECRET: str
    STRIPE_SECRET_KEY: str | None = None

    ANTHROPIC_API_KEY: str
    CLAUDE_AUDIT_MODEL: str = "claude-haiku-4-5-20251001"
    CLAUDE_FIX_MODEL: str = "claude-sonnet-4-20250514"

    CLOUDFLARE_R2_ACCOUNT_ID: str
    CLOUDFLARE_R2_ACCESS_KEY: str
    CLOUDFLARE_R2_SECRET_KEY: str
    CLOUDFLARE_R2_BUCKET: str
    CLOUDFLARE_R2_PUBLIC_URL: str

    RESEND_API_KEY: str
    FROM_EMAIL: str = "noreply@localauditai.com"

    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_CONCURRENT_SCRAPES: int = 5

    STARTER_CREDITS: int = 50
    PRO_CREDITS: int = 200
    AGENCY_CREDITS: int = 99999

    WORKER_REDIS_CHANNEL_PREFIX: str = "enqueue"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
