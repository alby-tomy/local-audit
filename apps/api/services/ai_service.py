"""
Anthropic Claude integration layer.

All calls to the Claude API are funnelled through this module so that:
- API key management is centralised
- Retry logic and error handling live in one place
- Prompt engineering is versioned alongside the business logic

The module supports per-user API keys (stored on the User model) so that
each customer's Claude usage is billed to their own Anthropic account.
"""

import logging
from typing import Any

import anthropic

from ..core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_client(api_key: str | None = None) -> anthropic.Anthropic:
    """Return an Anthropic client using *api_key* or the system default.

    Per-user keys take precedence so each account controls its own quota.
    Falls back to the system key stored in settings for shared/demo use.
    """
    key = api_key or settings.ANTHROPIC_API_KEY
    if not key:
        raise ValueError(
            "No Anthropic API key configured. "
            "Set ANTHROPIC_API_KEY in .env or add one in Settings."
        )
    return anthropic.Anthropic(api_key=key)


def generate_audit_report(
    business_name: str,
    city: str,
    website: str,
    issues: list[dict[str, Any]],
    score: int,
    load_time: float | None = None,
    api_key: str | None = None,
) -> str:
    """Generate a personalised, business-focused website audit report.

    The report is written for a non-technical business owner.  It:
    - Acknowledges their business by name
    - Explains each issue in terms of lost revenue, not tech jargon
    - Ends with a clear call to action for the business to respond

    Args:
        business_name: The name of the business being audited.
        city: City where the business operates (for local relevance).
        website: The website URL that was analysed.
        issues: List of issue dicts from the analyzer service.
        score: 0-100 website health score (lower = worse = higher lead value).
        load_time: Optional page load time in seconds.
        api_key: Override Anthropic API key (per-user).

    Returns:
        Formatted report text as a string.
    """
    client = get_client(api_key)

    issues_text = "\n".join(
        f"- {i['title']}: {i['impact']}" for i in issues
    )
    load_note = f"Page load time: {load_time}s" if load_time else ""

    prompt = f"""You are a digital marketing consultant writing a concise website audit report for a local business owner.

Business: {business_name}
Location: {city}
Website: {website}
Website Health Score: {score}/100
{load_note}

Issues discovered:
{issues_text}

Write a friendly, professional audit report addressed directly to the business owner.
Rules:
- Use plain English — no technical jargon
- Each issue must be explained as a business problem (lost customers, lost revenue)
- Be specific and use numbers where available (e.g. "53% of visitors leave if load time exceeds 3s")
- Keep the total length under 350 words
- End with one sentence offering to help fix these issues
- Do NOT include a subject line or email headers — just the body text

Format: 2–3 short paragraphs."""

    try:
        message = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        report = message.content[0].text.strip()
        logger.info("Generated audit report for %s (%d chars)", business_name, len(report))
        return report
    except anthropic.APIError as exc:
        logger.error("Claude API error generating report for %s: %s", business_name, exc)
        # Fallback to a template-based report so the pipeline doesn't stall
        return _fallback_report(business_name, city, issues, score)


def generate_outreach_email(
    email_type: str,
    business_name: str,
    city: str,
    issues: list[dict[str, Any]],
    score: int,
    load_time: float | None = None,
    api_key: str | None = None,
) -> dict[str, str]:
    """Generate a personalised cold outreach email.

    Three types are supported:
    - "problem_loss"  : Highlights revenue loss from specific issues (under 120 words)
    - "value_first"   : Leads with a free insight and offers a small free fix
    - "curiosity"     : Asks an engaging question to start a conversation

    Args:
        email_type: One of "problem_loss", "value_first", "curiosity".
        business_name: Target business name.
        city: Business city.
        issues: Detected issues (top 2 are used in copy).
        score: Website health score.
        load_time: Optional load time for personalised copy.
        api_key: Override API key.

    Returns:
        Dict with "subject" and "body" keys.
    """
    client = get_client(api_key)

    top_issues = issues[:2]
    top_issue_text = top_issues[0]["title"] if top_issues else "website performance issues"
    load_note = f"It currently loads in {load_time} seconds (industry average: under 3s)." if load_time and load_time > 3 else ""

    type_instructions = {
        "problem_loss": f"""Write a SHORT cold email (under 120 words) that:
- Opens by naming ONE specific problem found on their website
- Quantifies the business impact (e.g. lost leads, lower Google ranking)
- Mentions their website score is {score}/100
- Ends with a soft CTA (reply to learn how to fix it)
{load_note}""",

        "value_first": f"""Write a value-first cold email (under 150 words) that:
- Leads with a genuinely useful insight about their biggest issue
- Offers to share a quick free fix with no obligation
- Keeps a helpful, consultant tone — not salesy
- Ends with an easy yes/no question""",

        "curiosity": f"""Write a curiosity-based cold email (under 100 words) that:
- Opens with a thought-provoking question about their online presence
- Teases that you noticed something specific without revealing everything
- Creates desire to know more
- Feels personal, not like a mass email""",
    }

    instructions = type_instructions.get(email_type, type_instructions["problem_loss"])

    prompt = f"""You are a conversion-focused copywriter writing a cold outreach email.

Target business: {business_name}, {city}
Their website: analyzed and scored {score}/100
Top issue: {top_issue_text}

{instructions}

IMPORTANT RULES:
- Address the owner as "Hi [Business Name] Team," or just the business name
- Do NOT use fake names or "Dear Sir/Madam"
- Do NOT claim to be their customer or existing relationship
- Sign off as: "Best,\nThe LocalAudit AI Team"
- Return ONLY valid JSON: {{"subject": "...", "body": "..."}}
- Body should use line breaks (\\n) not HTML tags"""

    try:
        message = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        import json
        # Claude may wrap in markdown code fences — strip them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        logger.info("Generated %s email for %s", email_type, business_name)
        return result
    except Exception as exc:
        logger.error("Failed to generate email for %s: %s", business_name, exc)
        return _fallback_email(email_type, business_name, city, top_issue_text, score)


# ── Fallback templates (used when Claude is unavailable) ─────────────────────

def _fallback_report(
    business_name: str, city: str, issues: list[dict], score: int
) -> str:
    issue_lines = "\n".join(f"• {i['title']}: {i['impact']}" for i in issues[:5])
    return (
        f"Hi {business_name} team,\n\n"
        f"We recently reviewed your website and gave it a health score of {score}/100. "
        f"Here are the top issues we found:\n\n{issue_lines}\n\n"
        f"These issues are likely costing you customers in {city} every day. "
        f"We'd love to help you fix them — reply to this email to get started."
    )


def _fallback_email(
    email_type: str, business_name: str, city: str, top_issue: str, score: int
) -> dict[str, str]:
    return {
        "subject": f"Your {business_name} website is losing customers",
        "body": (
            f"Hi {business_name} team,\n\n"
            f"We analysed your website and found it scores {score}/100 for customer conversion. "
            f"The biggest issue: {top_issue}.\n\n"
            f"This is silently costing you leads every week in {city}.\n\n"
            f"Reply to this email and we'll show you exactly what to fix — for free.\n\n"
            f"Best,\nThe LocalAudit AI Team"
        ),
    }
