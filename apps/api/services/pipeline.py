"""
Pipeline orchestrator — the main automation engine.

The pipeline ties together every service module to run the full
lead-generation workflow:

  scrape → filter → analyze → email_find → report → outreach → store

It is designed to be run as a FastAPI BackgroundTask so the HTTP request
returns immediately and the pipeline updates lead records asynchronously.

A PipelineRun object tracks progress and logs so the frontend can poll
for status and display a live feed of what's happening.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..models.lead import Lead, LeadStatus
from .ai_service import generate_outreach_email
from .outreach import send_initial_outreach
from .report_generator import build_lead_data
from .scraper import discover_businesses

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class PipelineRun:
    """Tracks the state of one pipeline execution for status polling."""
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "running"  # running | completed | failed
    niche: str = ""
    city: str = ""
    total_discovered: int = 0
    total_analyzed: int = 0
    total_contacted: int = 0
    total_skipped: int = 0
    logs: list[str] = field(default_factory=list)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
    error: str | None = None

    def log(self, message: str) -> None:
        timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        entry = f"[{timestamp}] {message}"
        self.logs.append(entry)
        logger.info(entry)


# In-memory store of active/recent pipeline runs (keyed by run_id).
# In production this should live in Redis so multiple workers can access it.
_active_runs: dict[str, PipelineRun] = {}


def get_run(run_id: str) -> PipelineRun | None:
    return _active_runs.get(run_id)


def list_runs() -> list[PipelineRun]:
    return list(_active_runs.values())


def create_run(niche: str, city: str) -> PipelineRun:
    """Pre-register a PipelineRun in _active_runs before the background task starts.

    This lets the router return the run_id immediately so the client can start
    polling, even though the background task hasn't been picked up yet.
    """
    run = PipelineRun(niche=niche, city=city)
    _active_runs[run.run_id] = run
    return run


async def run_pipeline(
    db: AsyncSession,
    user_id: str,
    niche: str,
    city: str,
    run: PipelineRun,
    num_leads: int = 20,
    send_emails: bool = True,
    email_type: str = "problem_loss",
    anthropic_api_key: str | None = None,
    gmail_address: str | None = None,
    gmail_app_password: str | None = None,
) -> PipelineRun:
    """Execute the full lead generation pipeline for one niche + city combo.

    This function is intended to run in the background (FastAPI BackgroundTasks).
    It updates *run* in-place so the frontend can poll /api/pipeline/{run_id}
    for live progress.

    Args:
        db: Async SQLAlchemy session.
        user_id: ID of the user who triggered the run.
        niche: Business category (e.g. "dentist").
        city: Target city.
        run: Pre-created PipelineRun from create_run() — already in _active_runs.
        num_leads: How many businesses to discover and process.
        send_emails: Whether to actually send outreach emails.
        email_type: "problem_loss" | "value_first" | "curiosity"
        anthropic_api_key: Per-user Anthropic key override.
        gmail_address: Per-user Gmail sender override.
        gmail_app_password: Per-user Gmail App Password override.

    Returns:
        PipelineRun object — also stored in _active_runs for polling.
    """

    try:
        loop = asyncio.get_event_loop()

        # Support comma-separated locations: "delhi, mumbai" or "india, usa"
        locations = [loc.strip() for loc in city.split(",") if loc.strip()]

        for location in locations:
            # ── Phase 1: Discovery ────────────────────────────────────────
            if len(locations) > 1:
                run.log(f"── Location: {location} ──────────────────────────")
            run.log(f"Discovering {niche} businesses in {location}...")

            businesses: list[dict[str, Any]] = await loop.run_in_executor(
                None, lambda loc=location: discover_businesses(niche, loc, num_leads)
            )
            run.total_discovered += len(businesses)
            run.log(f"Found {len(businesses)} businesses to analyze.")

            if not businesses:
                run.log(f"No businesses found in {location}. Try a different niche or city.")
                continue

            # ── Phase 2: Analyze each business ───────────────────────────
            for i, biz in enumerate(businesses, 1):
                website = biz.get("website")
                name = biz.get("business_name", "Unknown")

                if not website:
                    run.log(f"[{i}/{len(businesses)}] Skipping {name} — no website found.")
                    run.total_skipped += 1
                    continue

                run.log(f"[{i}/{len(businesses)}] Analyzing {name} ({website})...")

                try:
                    lead_data = await build_lead_data(
                        business_name=name,
                        website=website,
                        city=location,
                        category=niche,
                        phone=biz.get("phone", ""),
                        anthropic_api_key=anthropic_api_key,
                    )
                except Exception as exc:
                    run.log(f"  ERROR analyzing {name}: {exc}")
                    run.total_skipped += 1
                    continue

                score = lead_data.get("score", 100)
                issues = lead_data.get("issues", [])
                issue_count = len(issues)
                run.log(f"  Score: {score}/100, Issues: {issue_count}")

                # A site that's down entirely is the single strongest pitch a
                # local-audit outreach can make ("your website isn't loading —
                # you're losing 100% of your traffic"), even though the analyzer
                # only logs one "broken_page" issue (the other checks can't run
                # on a page that never loaded). Treat it as an automatic qualifier
                # so the issue-count filter below doesn't discard these top leads.
                is_broken_page = any(issue.get("code") == "broken_page" for issue in issues)

                # ── Phase 3: Filter — skip healthy sites ──────────────────
                if score > settings.MAX_LEAD_SCORE:
                    run.log(f"  Skipping {name} — score {score} is above threshold ({settings.MAX_LEAD_SCORE}).")
                    run.total_skipped += 1
                    lead_data["status"] = LeadStatus.IGNORED
                    await _save_lead(db, user_id, lead_data)
                    continue

                if issue_count < settings.MIN_ISSUES_TO_CONTACT and not is_broken_page:
                    run.log(f"  Skipping {name} — only {issue_count} issues (minimum: {settings.MIN_ISSUES_TO_CONTACT}).")
                    run.total_skipped += 1
                    lead_data["status"] = LeadStatus.IGNORED
                    await _save_lead(db, user_id, lead_data)
                    continue

                run.total_analyzed += 1

                # ── Phase 4: Save to database ──────────────────────────────
                lead = await _save_lead(db, user_id, lead_data)
                if not lead:
                    continue

                # ── Phase 5: Send outreach email ───────────────────────────
                if not send_emails:
                    run.log(f"  Lead saved. Email sending is disabled for this run.")
                    continue

                if not lead.email:
                    run.log(f"  No email address found for {name} — skipping outreach.")
                    continue

                # ── Phase 5a: Cooldown — don't re-email a recently contacted org ──
                cooldown_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.EMAIL_COOLDOWN_DAYS)
                recent_contact = await db.execute(
                    select(Lead.id).where(
                        Lead.user_id == user_id,
                        Lead.email == lead.email,
                        Lead.email_sent_at.is_not(None),
                        Lead.email_sent_at > cooldown_cutoff,
                    ).limit(1)
                )
                if recent_contact.scalar_one_or_none():
                    run.log(
                        f"  Skipping {name} — {lead.email} was already contacted within "
                        f"the last {settings.EMAIL_COOLDOWN_DAYS} days."
                    )
                    run.total_skipped += 1
                    continue

                run.log(f"  Generating {email_type} email for {name}...")
                try:
                    email_content = await loop.run_in_executor(
                        None,
                        lambda l=lead: generate_outreach_email(
                            email_type=email_type,
                            business_name=l.business_name,
                            city=l.city or "",
                            issues=l.issues,
                            score=l.score or 50,
                            load_time=l.load_time_seconds,
                            api_key=anthropic_api_key,
                        ),
                    )
                except Exception as exc:
                    run.log(f"  Email generation failed for {name}: {exc}")
                    continue

                sent = await loop.run_in_executor(
                    None,
                    lambda l=lead, ec=email_content: send_initial_outreach(
                        lead=l,
                        email_content=ec,
                        gmail_address=gmail_address,
                        gmail_app_password=gmail_app_password,
                    ),
                )

                if sent:
                    lead.email_sent = True
                    lead.email_sent_at = datetime.now(timezone.utc)
                    lead.status = LeadStatus.CONTACTED
                    await db.commit()
                    run.total_contacted += 1
                    run.log(f"  Outreach email sent to {lead.email}")
                else:
                    run.log(f"  Failed to send email to {lead.email}")

                # Polite delay between business analyses
                await asyncio.sleep(1)

        # ── Complete ──────────────────────────────────────────────────────
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        run.log(
            f"Pipeline complete. Analyzed: {run.total_analyzed}, "
            f"Contacted: {run.total_contacted}, Skipped: {run.total_skipped}"
        )

    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = datetime.now(timezone.utc)
        run.log(f"PIPELINE FAILED: {exc}")
        logger.exception("Pipeline run %s failed", run.run_id)

    return run


async def _save_lead(
    db: AsyncSession, user_id: str, data: dict[str, Any]
) -> Lead | None:
    """Create and persist a Lead record, returning the instance."""
    try:
        lead = Lead(user_id=user_id)
        lead.business_name = data.get("business_name", "Unknown")
        lead.category = data.get("category", "")
        lead.city = data.get("city", "")
        lead.website = data.get("website", "")
        lead.email = data.get("email")
        lead.phone = data.get("phone", "")
        lead.issues = data.get("issues", [])
        lead.score = data.get("score")
        lead.report_text = data.get("report_text", "")
        lead.load_time_seconds = data.get("load_time_seconds")
        lead.priority = data.get("priority", "medium")
        lead.status = data.get("status", LeadStatus.ANALYZED)

        db.add(lead)
        await db.commit()
        await db.refresh(lead)
        return lead
    except Exception as exc:
        logger.error("Failed to save lead %s: %s", data.get("business_name"), exc)
        await db.rollback()
        return None
