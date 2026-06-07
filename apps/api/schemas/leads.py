"""Pydantic schemas for lead CRUD endpoints."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class IssueSchema(BaseModel):
    code: str
    title: str
    impact: str
    severity: str
    detail: str | None = None


class LeadCreate(BaseModel):
    business_name: str
    website: str
    city: str = ""
    category: str = ""
    email: str | None = None
    phone: str | None = None


class LeadAnalyzeRequest(BaseModel):
    """Request to analyze a single URL and create a lead."""
    business_name: str
    website: str
    city: str = ""
    category: str = ""


class LeadUpdate(BaseModel):
    email: str | None = None
    replied: bool | None = None
    converted: bool | None = None
    deal_value: float | None = None
    status: str | None = None
    notes: str | None = None


class LeadResponse(BaseModel):
    id: str
    business_name: str
    category: str | None
    city: str | None
    website: str | None
    email: str | None
    phone: str | None
    issues: list[dict[str, Any]]
    score: int | None
    report_text: str | None
    load_time_seconds: float | None
    email_sent: bool
    email_sent_at: datetime | None
    follow_up_1_sent: bool
    follow_up_2_sent: bool
    replied: bool
    converted: bool
    deal_value: float | None
    status: str
    priority: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    total: int
    leads: list[LeadResponse]


class SendEmailRequest(BaseModel):
    email_type: str = "problem_loss"  # problem_loss | value_first | curiosity
    custom_subject: str | None = None
    custom_body: str | None = None


class ExportRequest(BaseModel):
    format: str = "csv"
    status_filter: str | None = None
