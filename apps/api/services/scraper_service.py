from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Any

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright


ISSUES_CONFIG: dict[str, dict[str, Any]] = {
    "no_https": {
        "name": "No HTTPS / SSL",
        "score_penalty": 20,
        "description": "Website uses insecure HTTP and may show browser warnings.",
    },
    "site_unreachable": {
        "name": "Website unreachable",
        "score_penalty": 30,
        "description": "The website could not be loaded.",
    },
    "slow_load": {
        "name": "Slow load time (>4s)",
        "score_penalty": 12,
        "description": "Page loads slowly and may hurt SEO and conversions.",
    },
    "missing_viewport": {
        "name": "Not mobile-friendly",
        "score_penalty": 15,
        "description": "Missing viewport meta tag for responsive rendering.",
    },
    "missing_meta_title": {
        "name": "Missing title tag",
        "score_penalty": 8,
        "description": "No or empty title tag.",
    },
    "missing_meta_description": {
        "name": "Missing meta description",
        "score_penalty": 6,
        "description": "No description snippet for search engine results.",
    },
    "no_whatsapp_button": {
        "name": "No WhatsApp button",
        "score_penalty": 10,
        "description": "No WhatsApp contact link found.",
    },
    "no_google_maps_embed": {
        "name": "No Google Maps",
        "score_penalty": 8,
        "description": "No map embed found for local discovery.",
    },
    "no_social_links": {
        "name": "No social links",
        "score_penalty": 5,
        "description": "No major social profile links found.",
    },
    "no_contact_form": {
        "name": "No contact form",
        "score_penalty": 7,
        "description": "No contact form for inbound leads.",
    },
    "missing_phone": {
        "name": "No visible phone number",
        "score_penalty": 6,
        "description": "Phone number pattern not found.",
    },
    "outdated_copyright": {
        "name": "Outdated copyright",
        "score_penalty": 4,
        "description": "Footer year appears stale.",
    },
    "missing_og_tags": {
        "name": "Missing Open Graph tags",
        "score_penalty": 4,
        "description": "No social sharing tags detected.",
    },
    "missing_schema": {
        "name": "Missing schema markup",
        "score_penalty": 5,
        "description": "No LocalBusiness schema markup found.",
    },
}


async def analyze_website(url: str) -> dict[str, Any]:
    issues_found: list[str] = []
    reachable = True
    html = ""
    load_time_ms = 0

    if not url.startswith("http"):
        url = "https://" + url

    if not url.startswith("https://"):
        issues_found.append("no_https")

    try:
        start = time.time()
        response = requests.get(
            url,
            timeout=10,
            headers={"User-Agent": "LocalAuditBot/1.0 (+https://localauditai.com)"},
            allow_redirects=True,
        )
        load_time_ms = int((time.time() - start) * 1000)
        html = response.text
        if response.status_code >= 400:
            issues_found.append("site_unreachable")
            reachable = False
    except Exception:
        issues_found.append("site_unreachable")
        reachable = False

    if not reachable:
        return {
            "reachable": False,
            "issues": [{"id": i, **ISSUES_CONFIG[i]} for i in issues_found],
            "score": 0,
            "load_time_ms": 0,
            "html": "",
            "screenshot": None,
        }

    if load_time_ms > 4000:
        issues_found.append("slow_load")

    soup = BeautifulSoup(html, "html.parser")

    if not soup.find("meta", attrs={"name": "viewport"}):
        issues_found.append("missing_viewport")

    title = soup.find("title")
    if not title or not title.get_text(strip=True):
        issues_found.append("missing_meta_title")

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if not meta_desc or not meta_desc.get("content", "").strip():
        issues_found.append("missing_meta_description")

    html_lower = html.lower()
    if "wa.me" not in html_lower and "whatsapp" not in html_lower:
        issues_found.append("no_whatsapp_button")

    if (
        "maps.google" not in html_lower
        and "goo.gl/maps" not in html_lower
        and "maps.app.goo.gl" not in html_lower
    ):
        issues_found.append("no_google_maps_embed")

    social_patterns = ["facebook.com", "instagram.com", "twitter.com", "linkedin.com", "youtube.com"]
    if not any(p in html_lower for p in social_patterns):
        issues_found.append("no_social_links")

    forms = soup.find_all("form")
    has_contact_form = any(form.find("input", {"type": ["email", "text"]}) for form in forms)
    if not has_contact_form:
        issues_found.append("no_contact_form")

    phone_pattern = r"[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}"
    if not re.search(phone_pattern, html):
        issues_found.append("missing_phone")

    current_year = datetime.now().year
    copyright_pattern = "\\u00A9\\s*(\\d{4})"
    match = re.search(copyright_pattern, html)
    if match and int(match.group(1)) < current_year - 1:
        issues_found.append("outdated_copyright")

    if not soup.find("meta", property="og:title"):
        issues_found.append("missing_og_tags")

    if "localbusiness" not in html_lower and "application/ld+json" not in html_lower:
        issues_found.append("missing_schema")

    penalty = sum(ISSUES_CONFIG[i]["score_penalty"] for i in issues_found if i in ISSUES_CONFIG)
    score = max(0, 100 - penalty)

    return {
        "reachable": True,
        "issues": [{"id": i, **ISSUES_CONFIG[i]} for i in issues_found],
        "score": score,
        "load_time_ms": load_time_ms,
        "html": html,
        "screenshot": None,
    }


async def take_screenshot(url: str) -> bytes:
    if not url.startswith("http"):
        url = "https://" + url
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 LocalAuditBot/1.0",
        )
        page = await context.new_page()
        await page.goto(url, timeout=20000, wait_until="networkidle")
        screenshot = await page.screenshot(full_page=True, type="png")
        await browser.close()
    return screenshot
