"""
Website analysis engine — the core intelligence of LocalAudit AI.

This module inspects a business website and returns a scored list of issues
expressed in business language, not technical jargon.  Every issue maps to
a revenue impact statement so the prospect immediately understands WHY the
problem costs them money.

Analysis checks (in priority order):
1. SSL certificate         — trust signals, Google ranking
2. Page load speed         — every extra second costs 7% conversion rate
3. Mobile readiness        — 60%+ of local searches happen on mobile
4. Missing SEO basics      — invisible in Google search results
5. No contact mechanisms   — customers can't reach the business
6. No social proof         — prospects won't trust an unknown brand
7. No lead-capture forms   — missed opportunities to collect leads
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ── Issue severity weights (points deducted from a 100-point score) ──────────
_ISSUE_WEIGHTS: dict[str, int] = {
    "no_ssl": 20,
    "slow_load": 15,
    "not_mobile_ready": 15,
    "missing_title": 10,
    "missing_meta_description": 8,
    "no_contact_info": 12,
    "no_whatsapp": 8,
    "no_social_proof": 10,
    "no_lead_form": 8,
    "broken_page": 25,
}

# Human-readable issue definitions in business language
_ISSUE_DEFINITIONS: dict[str, dict[str, str]] = {
    "broken_page": {
        "title": "Website is not loading or returning errors",
        "impact": "Every visitor who lands on your site immediately leaves — you lose 100% of web traffic.",
        "severity": "critical",
    },
    "no_ssl": {
        "title": "Website has no security certificate (not HTTPS)",
        "impact": "Google marks your site 'Not Secure', causing customers to leave before reading anything. "
                  "You rank lower in search results and lose trust before a word is read.",
        "severity": "high",
    },
    "slow_load": {
        "title": "Website loads too slowly",
        "impact": "53% of mobile visitors leave if a page takes more than 3 seconds to load. "
                  "A slow site is silently turning away customers every day.",
        "severity": "high",
    },
    "not_mobile_ready": {
        "title": "Website is not optimised for mobile devices",
        "impact": "Over 60% of local searches happen on smartphones. "
                  "Customers viewing your site on a phone see a broken, unreadable layout and leave immediately.",
        "severity": "high",
    },
    "missing_title": {
        "title": "Website has no page title for search engines",
        "impact": "Google cannot understand what your business does, so your site appears lower in search results "
                  "or not at all. You are invisible to customers searching for your services.",
        "severity": "medium",
    },
    "missing_meta_description": {
        "title": "No description shown in Google search results",
        "impact": "When your business does appear in Google, the preview snippet looks unprofessional or random, "
                  "reducing the number of people who click through to your site.",
        "severity": "medium",
    },
    "no_contact_info": {
        "title": "No phone number or email visible on the homepage",
        "impact": "Customers who want to call or email you must search your entire site to find contact details. "
                  "Most won't bother — they'll contact a competitor instead.",
        "severity": "high",
    },
    "no_whatsapp": {
        "title": "No WhatsApp or instant messaging option",
        "impact": "Today's customers expect to message businesses instantly. "
                  "Without WhatsApp, you lose every lead who prefers messaging over calling.",
        "severity": "medium",
    },
    "no_social_proof": {
        "title": "No customer reviews or testimonials on the site",
        "impact": "92% of consumers read online reviews before making a purchase. "
                  "Without visible social proof, new visitors have no reason to trust your business.",
        "severity": "medium",
    },
    "no_lead_form": {
        "title": "No contact form or booking form to capture leads",
        "impact": "Visitors who don't want to call right now have no way to leave their details. "
                  "You miss every lead who visits outside business hours.",
        "severity": "medium",
    },
}


@dataclass
class AnalysisResult:
    """Structured result returned by the analyzer."""
    url: str
    score: int
    issues: list[dict[str, Any]] = field(default_factory=list)
    load_time_seconds: float | None = None
    is_reachable: bool = True
    error: str | None = None


def analyze_website(url: str, timeout: int = 10) -> AnalysisResult:
    """Fetch *url* and run all checks, returning a scored AnalysisResult.

    This function is intentionally synchronous so it can be run in a
    thread pool from async FastAPI route handlers without the overhead
    of Playwright for most checks.  Playwright is only used when a
    screenshot is explicitly requested.

    Args:
        url: The full URL of the business website (must include scheme).
        timeout: HTTP request timeout in seconds.

    Returns:
        AnalysisResult with issues list and 0-100 score.
        Score < 40 = high-value lead; 40-70 = medium; > 70 = low priority.
    """
    url = _normalise_url(url)
    issues: list[dict[str, Any]] = []
    score = 100
    load_time: float | None = None

    # ── Step 1: Fetch the page ─────────────────────────────────────────────
    try:
        start = time.perf_counter()
        response = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "LocalAuditBot/1.0 (+https://localauditai.com)"},
            allow_redirects=True,
        )
        load_time = round(time.perf_counter() - start, 2)
        response.raise_for_status()
        html = response.text
        final_url = response.url
    except requests.exceptions.SSLError:
        # SSL error means the site exists but has a bad cert
        logger.warning("SSL error for %s — adding no_ssl issue", url)
        issues.append(_make_issue("no_ssl"))
        score -= _ISSUE_WEIGHTS["no_ssl"]
        # Try again without SSL verification to still analyse content
        try:
            resp2 = requests.get(url, timeout=timeout, verify=False)  # noqa: S501
            html = resp2.text
            final_url = resp2.url
        except Exception:
            return AnalysisResult(
                url=url, score=max(0, score), issues=issues,
                load_time_seconds=load_time, is_reachable=False,
            )
    except Exception as exc:
        logger.error("Failed to fetch %s: %s", url, exc)
        issues.append(_make_issue("broken_page"))
        return AnalysisResult(
            url=url, score=0, issues=issues,
            is_reachable=False, error=str(exc),
        )

    soup = BeautifulSoup(html, "html.parser")

    # ── Step 2: SSL check ─────────────────────────────────────────────────
    if not final_url.startswith("https://") and "no_ssl" not in {i["code"] for i in issues}:
        issues.append(_make_issue("no_ssl"))
        score -= _ISSUE_WEIGHTS["no_ssl"]

    # ── Step 3: Load speed check ──────────────────────────────────────────
    # 3 seconds is the threshold after which conversion rates drop sharply
    if load_time is not None and load_time > 3.0:
        issue = _make_issue("slow_load")
        issue["detail"] = f"Page loaded in {load_time}s (target: under 3s)"
        issues.append(issue)
        score -= _ISSUE_WEIGHTS["slow_load"]

    # ── Step 4: Mobile readiness ──────────────────────────────────────────
    viewport = soup.find("meta", attrs={"name": "viewport"})
    if not viewport:
        issues.append(_make_issue("not_mobile_ready"))
        score -= _ISSUE_WEIGHTS["not_mobile_ready"]

    # ── Step 5: SEO basics ────────────────────────────────────────────────
    title_tag = soup.find("title")
    if not title_tag or not title_tag.get_text(strip=True):
        issues.append(_make_issue("missing_title"))
        score -= _ISSUE_WEIGHTS["missing_title"]

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if not meta_desc or not meta_desc.get("content", "").strip():
        issues.append(_make_issue("missing_meta_description"))
        score -= _ISSUE_WEIGHTS["missing_meta_description"]

    # ── Step 6: Contact information ───────────────────────────────────────
    page_text = soup.get_text(separator=" ").lower()
    has_phone = _contains_phone(page_text)
    has_email_link = bool(soup.find("a", href=lambda h: h and "mailto:" in h))
    if not has_phone and not has_email_link:
        issues.append(_make_issue("no_contact_info"))
        score -= _ISSUE_WEIGHTS["no_contact_info"]

    # WhatsApp: look for wa.me links or "whatsapp" text
    has_whatsapp = (
        bool(soup.find("a", href=lambda h: h and "wa.me" in h))
        or "whatsapp" in page_text
    )
    if not has_whatsapp:
        issues.append(_make_issue("no_whatsapp"))
        score -= _ISSUE_WEIGHTS["no_whatsapp"]

    # ── Step 7: Social proof ──────────────────────────────────────────────
    social_proof_signals = [
        "review", "testimonial", "rating", "stars", "customer said",
        "clients say", "what our", "trusted by",
    ]
    has_social_proof = any(signal in page_text for signal in social_proof_signals)
    if not has_social_proof:
        issues.append(_make_issue("no_social_proof"))
        score -= _ISSUE_WEIGHTS["no_social_proof"]

    # ── Step 8: Lead capture form ─────────────────────────────────────────
    has_form = bool(soup.find("form")) or bool(soup.find("input", attrs={"type": "email"}))
    if not has_form:
        issues.append(_make_issue("no_lead_form"))
        score -= _ISSUE_WEIGHTS["no_lead_form"]

    final_score = max(0, score)

    logger.info(
        "Analyzed %s — score=%d, issues=%d, load_time=%ss",
        url, final_score, len(issues), load_time,
    )

    return AnalysisResult(
        url=url,
        score=final_score,
        issues=issues,
        load_time_seconds=load_time,
        is_reachable=True,
    )


# ── Private helpers ───────────────────────────────────────────────────────────

def _normalise_url(url: str) -> str:
    """Ensure the URL has a scheme so requests can connect."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def _make_issue(code: str) -> dict[str, Any]:
    """Build a structured issue dict from the code lookup table."""
    defn = _ISSUE_DEFINITIONS.get(code, {})
    return {
        "code": code,
        "title": defn.get("title", code),
        "impact": defn.get("impact", ""),
        "severity": defn.get("severity", "medium"),
        "detail": None,
    }


def _contains_phone(text: str) -> bool:
    """Heuristic check for a phone number pattern in page text."""
    import re
    # Matches common phone formats: +44, (555), 555-555-5555, etc.
    pattern = r"(\+?\d[\d\s\-().]{7,}\d)"
    return bool(re.search(pattern, text))
