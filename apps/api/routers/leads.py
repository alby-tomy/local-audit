"""
Leads router — CRUD + outreach actions for lead records.

Endpoints:
- GET    /api/leads              — list leads with filtering
- POST   /api/leads/analyze      — analyze a URL and create a lead
- GET    /api/leads/{id}         — get one lead
- PATCH  /api/leads/{id}         — update lead status/outcome
- DELETE /api/leads/{id}         — delete a lead
- POST   /api/leads/{id}/send    — generate + send outreach email
- POST   /api/leads/{id}/followup — send follow-up email
- GET    /api/leads/export/csv   — export all leads as CSV
"""

import csv
import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.lead import Lead, LeadStatus
from ..models.user import User
from ..schemas.leads import (
    LeadAnalyzeRequest,
    LeadListResponse,
    LeadResponse,
    LeadUpdate,
    SendEmailRequest,
)
from ..services.ai_service import generate_outreach_email
from ..services.outreach import send_follow_up, send_initial_outreach
from ..services.report_generator import build_lead_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.get("", response_model=LeadListResponse)
async def list_leads(
    city: str | None = Query(None),
    category: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = Query(None),
    min_score: int | None = Query(None),
    max_score: int | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a paginated, filtered list of leads owned by the current user."""
    q = select(Lead).where(Lead.user_id == current_user.id)

    if city:
        q = q.where(Lead.city.ilike(f"%{city}%"))
    if category:
        q = q.where(Lead.category.ilike(f"%{category}%"))
    if status_filter:
        q = q.where(Lead.status == status_filter)
    if priority:
        q = q.where(Lead.priority == priority)
    if min_score is not None:
        q = q.where(Lead.score >= min_score)
    if max_score is not None:
        q = q.where(Lead.score <= max_score)

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    q = q.order_by(Lead.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    leads = result.scalars().all()

    return LeadListResponse(total=total, leads=[_to_response(l) for l in leads])


@router.post("/analyze", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def analyze_and_create(
    body: LeadAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze a single website URL and create a Lead record.

    This endpoint is synchronous from the caller's perspective — it runs the
    full analysis and returns the populated lead.  For bulk processing, use
    the pipeline endpoint instead.
    """
    api_key = current_user.anthropic_api_key or None

    lead_data = await build_lead_data(
        business_name=body.business_name,
        website=body.website,
        city=body.city,
        category=body.category,
        anthropic_api_key=api_key,
    )

    lead = Lead(user_id=current_user.id)
    _populate_lead(lead, lead_data)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    logger.info("Created lead %s for user %s", lead.id, current_user.id)
    return _to_response(lead)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lead = await _get_owned_lead(lead_id, current_user.id, db)
    return _to_response(lead)


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: str,
    body: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update mutable fields on a lead (reply status, deal value, etc.)."""
    lead = await _get_owned_lead(lead_id, current_user.id, db)

    if body.email is not None:
        lead.email = body.email
    if body.replied is not None:
        lead.replied = body.replied
    if body.converted is not None:
        lead.converted = body.converted
        if body.converted and lead.status != LeadStatus.CONVERTED:
            lead.status = LeadStatus.CONVERTED
    if body.deal_value is not None:
        lead.deal_value = body.deal_value
    if body.status is not None:
        lead.status = body.status

    await db.commit()
    await db.refresh(lead)
    return _to_response(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lead = await _get_owned_lead(lead_id, current_user.id, db)
    await db.delete(lead)
    await db.commit()


@router.post("/{lead_id}/send", response_model=LeadResponse)
async def send_outreach(
    lead_id: str,
    body: SendEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and send the initial cold outreach email for a lead.

    If custom_subject and custom_body are provided, those are used directly
    instead of generating a new email via Claude — supporting the
    "edit before sending" feature.
    """
    lead = await _get_owned_lead(lead_id, current_user.id, db)

    if not lead.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This lead has no email address. Add one before sending.",
        )

    # Use custom copy if provided, otherwise generate via Claude
    if body.custom_subject and body.custom_body:
        email_content = {"subject": body.custom_subject, "body": body.custom_body}
    else:
        import asyncio
        loop = asyncio.get_event_loop()
        api_key = current_user.anthropic_api_key or None
        email_content = await loop.run_in_executor(
            None,
            lambda: generate_outreach_email(
                email_type=body.email_type,
                business_name=lead.business_name,
                city=lead.city or "",
                issues=lead.issues,
                score=lead.score or 50,
                load_time=lead.load_time_seconds,
                api_key=api_key,
            ),
        )

    sent = send_initial_outreach(
        lead=lead,
        email_content=email_content,
        gmail_address=current_user.gmail_address,
        gmail_app_password=current_user.gmail_app_password,
    )

    if sent:
        lead.email_sent = True
        lead.email_sent_at = datetime.now(timezone.utc)
        lead.status = LeadStatus.CONTACTED
        await db.commit()
        await db.refresh(lead)
    else:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Email sending failed. Check Gmail credentials in Settings.",
        )

    return _to_response(lead)


@router.post("/{lead_id}/followup", response_model=LeadResponse)
async def send_follow_up_email(
    lead_id: str,
    follow_up_number: int = Query(1, ge=1, le=2),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send follow-up 1 (Day 3) or follow-up 2 (Day 7) for a lead."""
    lead = await _get_owned_lead(lead_id, current_user.id, db)

    sent = send_follow_up(
        lead=lead,
        follow_up_number=follow_up_number,
        gmail_address=current_user.gmail_address,
        gmail_app_password=current_user.gmail_app_password,
    )

    if sent:
        if follow_up_number == 1:
            lead.follow_up_1_sent = True
            lead.follow_up_1_sent_at = datetime.now(timezone.utc)
        else:
            lead.follow_up_2_sent = True
            lead.follow_up_2_sent_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(lead)

    return _to_response(lead)


@router.get("/export/csv")
async def export_csv(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all leads as a CSV file for use in CRMs or spreadsheets."""
    result = await db.execute(
        select(Lead).where(Lead.user_id == current_user.id).order_by(Lead.created_at.desc())
    )
    leads = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Business Name", "Category", "City", "Website", "Email", "Phone",
        "Score", "Priority", "Status", "Issues Count", "Email Sent",
        "Replied", "Converted", "Deal Value", "Created At",
    ])
    for lead in leads:
        writer.writerow([
            lead.id, lead.business_name, lead.category, lead.city,
            lead.website, lead.email, lead.phone, lead.score,
            lead.priority, lead.status, len(lead.issues),
            lead.email_sent, lead.replied, lead.converted,
            lead.deal_value or "", lead.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_owned_lead(lead_id: str, user_id: str, db: AsyncSession) -> Lead:
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.user_id == user_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")
    return lead


def _to_response(lead: Lead) -> LeadResponse:
    from ..schemas.leads import LeadResponse as LR
    return LR.model_validate(lead)


def _populate_lead(lead: Lead, data: dict) -> None:
    for key in [
        "business_name", "category", "city", "website", "email", "phone",
        "score", "report_text", "load_time_seconds", "priority", "status",
    ]:
        if key in data:
            setattr(lead, key, data[key])
    if "issues" in data:
        lead.issues = data["issues"]
