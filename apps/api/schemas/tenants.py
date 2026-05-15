from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TenantSummary(BaseModel):
    id: UUID
    name: str
    slug: str
    subscription_status: str
    credits_used: int
    credits_limit: int
    billing_cycle_end: datetime | None = None
