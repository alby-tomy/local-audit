"""Pydantic schemas for user settings endpoints."""

from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    full_name: str | None = None
    anthropic_api_key: str | None = None
    gmail_address: str | None = None
    gmail_app_password: str | None = None


class SettingsResponse(BaseModel):
    full_name: str | None
    email: str
    anthropic_api_key_set: bool
    gmail_address: str | None
    gmail_configured: bool
