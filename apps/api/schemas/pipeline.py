"""Pydantic schemas for pipeline run endpoints."""

from datetime import datetime

from pydantic import BaseModel


class PipelineRunRequest(BaseModel):
    niche: str
    city: str
    num_leads: int = 20
    send_emails: bool = True
    email_type: str = "problem_loss"


class PipelineRunResponse(BaseModel):
    run_id: str
    status: str
    niche: str
    city: str
    total_discovered: int
    total_analyzed: int
    total_contacted: int
    total_skipped: int
    logs: list[str]
    started_at: datetime
    completed_at: datetime | None
    error: str | None
