"""
Email outreach service.

Handles all email sending for the LocalAudit AI system:
- Initial cold outreach (3 template types)
- Follow-up 1 (Day 3): soft reminder
- Follow-up 2 (Day 7): final value offer

Gmail is used via SMTP with App Passwords so no OAuth flow is needed.
Per-user credentials from the User model override the system defaults,
allowing each customer to send from their own inbox.

ALL email sending is logged and any failure is caught — a failed email
never crashes the pipeline; it just marks the lead's email_sent flag as
False and logs the error for retry.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from ..core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Follow-up copy templates ─────────────────────────────────────────────────

_FOLLOWUP_1_TEMPLATE = """Subject: Re: Your {business_name} website audit

Hi {business_name} team,

Just wanted to check if you had a chance to see the website audit we sent a few days ago.

We found {issue_count} issues on {website} that are likely costing you leads — including: {top_issue}.

Happy to walk you through the fixes on a quick 15-minute call. No obligation.

Best,
The LocalAudit AI Team"""

_FOLLOWUP_2_TEMPLATE = """Subject: One last thing — quick fix for {business_name}

Hi {business_name} team,

This is my last message. I won't keep reaching out if this isn't relevant.

We noticed your website still has some quick wins that could bring in more customers in {city}. The most impactful one is: {top_issue}.

If you'd like a free 10-minute breakdown of what to fix first, just reply "yes" and I'll send it over.

Best,
The LocalAudit AI Team"""


def send_email(
    to_address: str,
    subject: str,
    body: str,
    gmail_address: str | None = None,
    gmail_app_password: str | None = None,
) -> bool:
    """Send a plain-text email via Gmail SMTP.

    Args:
        to_address: Recipient email address.
        subject: Email subject line.
        body: Plain-text email body.
        gmail_address: Sender Gmail address (falls back to system setting).
        gmail_app_password: Gmail App Password (falls back to system setting).

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    sender = gmail_address or settings.GMAIL_ADDRESS
    password = gmail_app_password or settings.GMAIL_APP_PASSWORD

    if not sender or not password:
        logger.error(
            "Gmail credentials not configured. "
            "Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD in .env or user settings."
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_address
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(sender, password)
            smtp.sendmail(sender, [to_address], msg.as_string())
        logger.info("Email sent to %s — subject: %s", to_address, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Gmail authentication failed for %s. "
            "Make sure you're using an App Password, not your regular password.",
            sender,
        )
        return False
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_address, exc)
        return False


def send_initial_outreach(
    lead: Any,
    email_content: dict[str, str],
    gmail_address: str | None = None,
    gmail_app_password: str | None = None,
) -> bool:
    """Send the initial cold outreach email for a lead.

    Args:
        lead: Lead ORM model instance.
        email_content: Dict with "subject" and "body" from ai_service.
        gmail_address: Sender credentials override.
        gmail_app_password: Sender credentials override.

    Returns:
        True if sent successfully.
    """
    if not lead.email:
        logger.warning("Cannot send outreach to %s — no email address found", lead.business_name)
        return False

    return send_email(
        to_address=lead.email,
        subject=email_content["subject"],
        body=email_content["body"],
        gmail_address=gmail_address,
        gmail_app_password=gmail_app_password,
    )


def send_follow_up(
    lead: Any,
    follow_up_number: int,
    gmail_address: str | None = None,
    gmail_app_password: str | None = None,
) -> bool:
    """Send a follow-up email using the appropriate template.

    Args:
        lead: Lead ORM instance.
        follow_up_number: 1 for Day-3 follow-up, 2 for Day-7 final.
        gmail_address: Sender credentials override.
        gmail_app_password: Sender credentials override.

    Returns:
        True if sent successfully.
    """
    if not lead.email:
        logger.warning(
            "Cannot send follow-up %d to %s — no email", follow_up_number, lead.business_name
        )
        return False

    issues = lead.issues or []
    top_issue = issues[0]["title"] if issues else "website performance issues"

    template = _FOLLOWUP_1_TEMPLATE if follow_up_number == 1 else _FOLLOWUP_2_TEMPLATE

    filled = template.format(
        business_name=lead.business_name,
        website=lead.website or "",
        city=lead.city or "",
        issue_count=len(issues),
        top_issue=top_issue,
    )

    # First line is the subject
    lines = filled.strip().splitlines()
    subject = lines[0].replace("Subject: ", "").strip()
    body = "\n".join(lines[2:]).strip()

    return send_email(
        to_address=lead.email,
        subject=subject,
        body=body,
        gmail_address=gmail_address,
        gmail_app_password=gmail_app_password,
    )


def build_preview_email(
    email_type: str,
    lead: Any,
    email_content: dict[str, str],
) -> dict[str, str]:
    """Return a preview of the email without sending it.

    Used by the frontend "Edit before sending" feature.
    """
    return {
        "to": lead.email or "",
        "subject": email_content.get("subject", ""),
        "body": email_content.get("body", ""),
        "type": email_type,
    }
