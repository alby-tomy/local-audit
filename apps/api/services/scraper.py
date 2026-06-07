"""
Business discovery scraper.

LocalAudit AI discovers potential leads by searching for local businesses
in a given niche and city.  This module provides two discovery methods:

1. Google Search scraping  — uses requests + BeautifulSoup to scrape the
   organic search results for "[niche] in [city]" queries.  No API key
   required; respects robots.txt by using standard browser headers.

2. Manual import          — accepts a list of dicts so users can paste in
   leads from spreadsheets, CRMs, or other data sources.

NOTE: Google Maps scraping requires Playwright and is far more comprehensive
but also slower and requires Playwright to be installed.  The search-based
method is the default; the Maps method is behind a feature flag.

All scrapers return a list of BusinessCandidate dicts:
{
    "business_name": str,
    "website": str | None,
    "phone": str | None,
    "city": str,
    "category": str,
    "source": str,
}
"""

import logging
import re
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def scrape_google_search(
    niche: str,
    city: str,
    num_results: int = 20,
    delay_seconds: float = 2.0,
) -> list[dict[str, Any]]:
    """Discover businesses by scraping Google organic search results.

    Performs multiple paginated searches for "[niche] in [city] website"
    and extracts business names and websites from result snippets.

    Args:
        niche: Business category to search for (e.g. "dentist", "plumber").
        city: City to target (e.g. "Manchester", "Austin TX").
        num_results: Approximate number of businesses to discover.
        delay_seconds: Polite delay between requests to avoid rate limiting.

    Returns:
        List of BusinessCandidate dicts (may contain duplicates — caller deduplicates).
    """
    businesses = []
    query = f"{niche} in {city}"
    pages_needed = max(1, num_results // 10)

    for page in range(pages_needed):
        start = page * 10
        url = f"https://www.google.com/search?q={requests.utils.quote(query)}&start={start}"

        try:
            resp = requests.get(url, headers=_HEADERS, timeout=10)
            if resp.status_code != 200:
                logger.warning("Google search returned %d for query '%s'", resp.status_code, query)
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            results = _parse_google_results(soup, city, niche)
            businesses.extend(results)
            logger.info("Page %d: found %d results for '%s'", page + 1, len(results), query)

            if page < pages_needed - 1:
                time.sleep(delay_seconds)

        except Exception as exc:
            logger.error("Google scrape failed for '%s' page %d: %s", query, page, exc)
            break

    # Deduplicate by website domain
    seen_domains: set[str] = set()
    unique = []
    for b in businesses:
        domain = _extract_domain(b.get("website", ""))
        if domain and domain not in seen_domains:
            seen_domains.add(domain)
            unique.append(b)
        elif not b.get("website"):
            unique.append(b)

    logger.info("Scraped %d unique businesses for '%s in %s'", len(unique), niche, city)
    return unique[:num_results]


def import_manual(
    raw_leads: list[dict[str, Any]],
    niche: str = "",
    city: str = "",
) -> list[dict[str, Any]]:
    """Normalise a list of manually provided lead dicts.

    Accepts loose input (e.g. from CSV import) and returns cleaned
    BusinessCandidate dicts.  Missing fields default to empty strings.

    Args:
        raw_leads: List of dicts from user input.
        niche: Default category if not specified per-row.
        city: Default city if not specified per-row.

    Returns:
        List of normalised BusinessCandidate dicts.
    """
    results = []
    for row in raw_leads:
        results.append({
            "business_name": row.get("business_name") or row.get("name", "Unknown"),
            "website": _normalise_url(row.get("website") or row.get("url", "")),
            "phone": row.get("phone", ""),
            "email": row.get("email", ""),
            "city": row.get("city", city),
            "category": row.get("category") or row.get("niche", niche),
            "source": "manual",
        })
    return results


# ── Private helpers ───────────────────────────────────────────────────────────

def _parse_google_results(
    soup: BeautifulSoup,
    city: str,
    niche: str,
) -> list[dict[str, Any]]:
    """Extract business data from a parsed Google SERP page."""
    businesses = []

    # Google renders results as <div class="g"> blocks
    for result in soup.select("div.g"):
        title_el = result.select_one("h3")
        link_el = result.select_one("a[href]")
        snippet_el = result.select_one("div.VwiC3b")

        if not title_el or not link_el:
            continue

        title = title_el.get_text(strip=True)
        href = link_el.get("href", "")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""

        # Filter out non-business results (directories, Wikipedia, etc.)
        if _is_directory_url(href):
            continue

        website = _normalise_url(href)
        if not website:
            continue

        # Extract phone from snippet if available
        phone = _extract_phone(snippet)

        businesses.append({
            "business_name": title,
            "website": website,
            "phone": phone,
            "city": city,
            "category": niche,
            "source": "google_search",
        })

    return businesses


def _is_directory_url(url: str) -> bool:
    """Return True if the URL belongs to a business directory or aggregator."""
    directories = [
        "yelp.com", "yellowpages.com", "tripadvisor.com", "facebook.com",
        "linkedin.com", "google.com", "maps.google", "wikipedia.org",
        "trustpilot.com", "clutch.co", "bark.com", "checkatrade.com",
    ]
    return any(d in url for d in directories)


def _extract_phone(text: str) -> str:
    """Extract a phone number from a text string using regex."""
    match = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    return match.group(1).strip() if match else ""


def _normalise_url(url: str) -> str:
    """Add https:// scheme if missing; return empty string for non-URLs."""
    if not url:
        return ""
    url = url.strip()
    if url.startswith("/url?q="):
        url = url[7:].split("&")[0]
    if not url.startswith(("http://", "https://")):
        if "." in url and " " not in url:
            url = "https://" + url
        else:
            return ""
    return url


def _extract_domain(url: str) -> str:
    """Return just the domain portion of a URL for deduplication."""
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return ""
