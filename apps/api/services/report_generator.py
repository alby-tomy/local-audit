"""
Report generation orchestrator.

Coordinates the analyzer + AI service to produce a complete lead record:
1. Runs website analysis (sync, in thread pool)
2. Finds the contact email
3. Calls Claude to generate the personalised report
4. Returns a populated dict ready to save to the Lead model

This module exists so that the pipeline service and the manual
"analyze single URL" API endpoint share the same logic.
"""

import asyncio
import logging
from typing import Any

from .analyzer import AnalysisResult, analyze_website
from .email_finder import find_email
from .ai_service import generate_audit_report

logger = logging.getLogger(__name__)


async def build_lead_data(
    business_name: str,
    website: str,
    city: str = "",
    category: str = "",
    phone: str = "",
    anthropic_api_key: str | None = None,
) -> dict[str, Any]:
    """Run the full analysis pipeline for a single business and return a dict
    that can be used to create or update a Lead model instance.

    Args:
        business_name: Human-readable business name.
        website: Business website URL.
        city: City the business operates in.
        category: Business category / niche (e.g. "dentist", "plumber").
        phone: Known phone number (may be empty).
        anthropic_api_key: Per-user Claude API key override.

    Returns:
        Dict with all Lead fields populated, ready for DB insertion.
    """
    loop = asyncio.get_event_loop()

    # Run blocking I/O in a thread pool to avoid blocking the event loop
    logger.info("Analyzing website: %s for %s", website, business_name)
    analysis: AnalysisResult = await loop.run_in_executor(
        None, analyze_website, website
    )

    # Attempt email extraction in parallel with report generation
    email_task = loop.run_in_executor(None, find_email, website)

    # Generate AI report (also blocking — runs in thread pool)
    report_text = ""
    if analysis.is_reachable and analysis.issues:
        try:
            report_text = await loop.run_in_executor(
                None,
                lambda: generate_audit_report(
                    business_name=business_name,
                    city=city,
                    website=website,
                    issues=analysis.issues,
                    score=analysis.score,
                    load_time=analysis.load_time_seconds,
                    api_key=anthropic_api_key,
                ),
            )
        except Exception as exc:
            logger.error("Report generation failed for %s: %s", business_name, exc)

    email = await email_task

    # Determine priority from score
    if analysis.score < 40:
        priority = "high"
    elif analysis.score <= 70:
        priority = "medium"
    else:
        priority = "low"

    return {
        "business_name": business_name,
        "category": category,
        "city": city,
        "website": website,
        "email": email,
        "phone": phone,
        "issues": analysis.issues,
        "score": analysis.score,
        "report_text": report_text,
        "load_time_seconds": analysis.load_time_seconds,
        "priority": priority,
        "status": "analyzed",
    }
