"""
Email extraction service.

Attempts to find a contact email address for a given business website by:
1. Scanning the homepage for mailto: links
2. Visiting common contact page URLs (/contact, /about, /contact-us)
3. Regex-scanning page text for email-shaped strings
4. Checking structured data (JSON-LD schema.org markup)

Returns None gracefully if no email is found — the pipeline should still
create a lead record and mark email as unknown rather than crashing.
"""

import logging
import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Contact page slug candidates — tried in order
_CONTACT_SLUGS = [
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/get-in-touch",
    "/reach-us",
]

# Regex pattern for email addresses.
# We deliberately exclude common false-positives (image files, example.com).
_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b"
)
_IGNORED_DOMAINS = {"example.com", "domain.com", "email.com", "sentry.io", "wixpress.com"}
_IGNORED_EXTENSIONS = {".png", ".jpg", ".gif", ".svg", ".webp"}


def find_email(website_url: str, timeout: int = 8) -> str | None:
    """Return the first valid contact email found on *website_url*, or None.

    Args:
        website_url: Base URL of the business website.
        timeout: Per-request HTTP timeout in seconds.

    Returns:
        Email address string, or None if none could be found.
    """
    base = _get_base_url(website_url)
    headers = {"User-Agent": "LocalAuditBot/1.0 (+https://localauditai.com)"}

    # Phase 1: Check homepage
    email = _extract_from_url(website_url, headers, timeout)
    if email:
        logger.info("Found email on homepage for %s: %s", website_url, email)
        return email

    # Phase 2: Try known contact page paths
    for slug in _CONTACT_SLUGS:
        candidate_url = urljoin(base, slug)
        email = _extract_from_url(candidate_url, headers, timeout)
        if email:
            logger.info("Found email at %s: %s", candidate_url, email)
            return email

    logger.info("No email found for %s", website_url)
    return None


def _extract_from_url(url: str, headers: dict, timeout: int) -> str | None:
    """Fetch *url* and attempt to extract an email from its content."""
    try:
        response = requests.get(url, headers=headers, timeout=timeout, verify=False)  # noqa: S501
        if response.status_code >= 400:
            return None
        return _parse_email(response.text)
    except Exception as exc:
        logger.debug("Could not fetch %s for email extraction: %s", url, exc)
        return None


def _parse_email(html: str) -> str | None:
    """Extract the best email from raw HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # Priority 1: mailto: links — most reliable signal
    for tag in soup.find_all("a", href=True):
        href = tag["href"]
        if href.startswith("mailto:"):
            email = href[7:].split("?")[0].strip()
            if _is_valid_email(email):
                return email

    # Priority 2: JSON-LD structured data (schema.org ContactPoint / Organization)
    for script in soup.find_all("script", type="application/ld+json"):
        text = script.get_text()
        matches = _EMAIL_RE.findall(text)
        for m in matches:
            if _is_valid_email(m):
                return m

    # Priority 3: Regex scan of the full page text
    text = soup.get_text(separator=" ")
    matches = _EMAIL_RE.findall(text)
    for m in matches:
        if _is_valid_email(m):
            return m

    return None


def _is_valid_email(email: str) -> bool:
    """Return True if the email looks real and is not a placeholder or asset path."""
    if not email or "@" not in email:
        return False
    domain = email.split("@")[-1].lower()
    if domain in _IGNORED_DOMAINS:
        return False
    # Reject paths that accidentally matched (e.g. image@2x.png)
    if any(email.lower().endswith(ext) for ext in _IGNORED_EXTENSIONS):
        return False
    return True


def _get_base_url(url: str) -> str:
    """Return scheme + netloc from a full URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"
