from __future__ import annotations

from pydantic import BaseModel


class BillingPortalRequest(BaseModel):
    return_url: str


class BillingPortalResponse(BaseModel):
    url: str
