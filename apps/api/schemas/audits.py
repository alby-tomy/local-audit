from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AuditCreate(BaseModel):
    website_url: HttpUrl
    business_name: str | None = None
    niche: str | None = None
    city: str | None = None
    country: str | None = None


class AuditIssue(BaseModel):
    id: str
    name: str
    description: str
    score_penalty: int


class AuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    business_name: str | None = None
    website_url: str
    niche: str | None = None
    city: str | None = None
    country: str | None = None
    status: str
    issues: list[dict[str, Any]] = Field(default_factory=list)
    score: int | None = None
    load_time_ms: int | None = None
    screenshot_before: str | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
