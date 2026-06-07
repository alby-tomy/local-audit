"""
Business discovery scraper.

LocalAudit AI discovers potential leads by searching for local businesses
in a given niche and city.  This module provides three discovery methods:

1. Web search scraping    — uses requests + BeautifulSoup against DuckDuckGo's
   no-JavaScript HTML endpoint to find individual business websites for
   "[niche] [city]" queries.  No API key required.

   NOTE: Google and Bing were evaluated first but both now return JS-gated
   interstitial / consent pages to plain HTTP clients (no parseable result
   markup at all), making them unusable for simple requests-based scraping.
   DuckDuckGo's html.duckduckgo.com endpoint still serves real, parseable
   organic results to non-JS clients — but like any search-engine scrape it
   is subject to anti-bot rate limiting that can block an IP for an
   unpredictable period.  When it returns nothing, `discover_businesses`
   automatically falls back to OpenStreetMap (see below).

2. OpenStreetMap directory — queries the free Overpass API for businesses
   tagged with the requested category AND a `website`/`contact:website`
   tag, near the geocoded city centre.  This is structured data, not a
   scrape, so it isn't subject to anti-bot blocking and reliably returns
   real businesses with working site URLs.  Used as the fallback whenever
   web search comes up empty (or is blocked).

3. Manual import          — accepts a list of dicts so users can paste in
   leads from spreadsheets, CRMs, or other data sources.

All discovery methods return a list of BusinessCandidate dicts:
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

_SEARCH_URL = "https://html.duckduckgo.com/html/"

# Result domains that are directories, aggregators, social networks, or
# "best of" content sites rather than an actual business's own website.
# Matched as a substring against the result URL, so regional TLDs like
# "tripadvisor.in" or "yelp.co.uk" are caught by "tripadvisor"/"yelp".
_DIRECTORY_KEYWORDS = [
    "yelp", "yellowpages", "tripadvisor", "facebook.com", "linkedin.com",
    "google.", "maps.google", "wikipedia.org", "trustpilot", "clutch.co",
    "bark.com", "checkatrade", "foursquare.com", "instagram.com",
    "pinterest.", "twitter.com", "x.com", "youtube.com", "reddit.com",
    "zomato.com", "swiggy.com", "justdial.com", "magicpin.in", "indiamart.com",
    "sulekha.com", "burrp.com", "dineout.co.in", "eazydiner.com",
    "restaurant-guru", "lonelyplanet.com", "timeout.com", "tripadvisor.",
]

# "THE 10 BEST...", "Top 5 Plumbers...", "Best Dentists in..." — these are
# always directory/listicle articles, never an individual business's site.
_LISTICLE_TITLE_RE = re.compile(
    r"^\s*(the\s+)?(top\s*\d*|best|\d+\s+(best|top))\b", re.IGNORECASE
)

# ── OpenStreetMap fallback (Nominatim geocoding + Overpass directory query) ──
# OSM asks that API consumers identify themselves with a descriptive User-Agent.
_OSM_HEADERS = {
    "User-Agent": "LocalAuditAI/1.0 (local business discovery; +https://localaudit.ai)",
}
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# The Overpass cluster exposes several load-balanced front-ends that hit
# different backend nodes — overpass-api.de intermittently returns 429/504
# under load, but lz4./z. subdomains often aren't affected at the same
# moment. Trying them in sequence avoids surfacing a transient single-node
# outage as "0 results". (Verified reachable via a live probe — third-party
# mirrors like kumi.systems and openstreetmap.ru were tried but proved
# unreachable/timed out from this environment.)
_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]
_OSM_SEARCH_RADIUS_M = 30000

# Maps a lower-cased niche term to an OSM tag/value pair used to filter the
# Overpass query.  Covers the most common local-service business categories;
# niches that don't match fall back to a free-text `name` search instead.
_NICHE_OSM_TAGS: dict[str, tuple[str, str]] = {
    "restaurant": ("amenity", "restaurant"),
    "restaurants": ("amenity", "restaurant"),
    "cafe": ("amenity", "cafe"),
    "coffee shop": ("amenity", "cafe"),
    "bar": ("amenity", "bar"),
    "pub": ("amenity", "pub"),
    "fast food": ("amenity", "fast_food"),
    "bakery": ("shop", "bakery"),
    "dentist": ("amenity", "dentist"),
    "doctor": ("amenity", "doctors"),
    "clinic": ("amenity", "clinic"),
    "hospital": ("amenity", "hospital"),
    "pharmacy": ("amenity", "pharmacy"),
    "veterinary": ("amenity", "veterinary"),
    "vet": ("amenity", "veterinary"),
    "lawyer": ("office", "lawyer"),
    "attorney": ("office", "lawyer"),
    "accountant": ("office", "accountant"),
    "estate agent": ("office", "estate_agent"),
    "real estate": ("office", "estate_agent"),
    "insurance": ("office", "insurance"),
    "plumber": ("craft", "plumber"),
    "electrician": ("craft", "electrician"),
    "carpenter": ("craft", "carpenter"),
    "painter": ("craft", "painter"),
    "roofer": ("craft", "roofer"),
    "hairdresser": ("shop", "hairdresser"),
    "salon": ("shop", "hairdresser"),
    "barber": ("shop", "hairdresser"),
    "beauty salon": ("shop", "beauty"),
    "spa": ("leisure", "spa"),
    "gym": ("leisure", "fitness_centre"),
    "fitness": ("leisure", "fitness_centre"),
    "hotel": ("tourism", "hotel"),
    "motel": ("tourism", "motel"),
    "guest house": ("tourism", "guest_house"),
    "mechanic": ("shop", "car_repair"),
    "auto repair": ("shop", "car_repair"),
    "car repair": ("shop", "car_repair"),
    "garage": ("shop", "car_repair"),
}


def discover_businesses(
    niche: str,
    city: str,
    num_results: int = 20,
    delay_seconds: float = 2.0,
) -> list[dict[str, Any]]:
    """Discover local businesses, automatically falling back across sources.

    Tries web-search scraping first (broadest coverage when it works), and
    if that returns nothing — whether because the niche+city combo genuinely
    has no indexed results or because the search engine is rate-limiting our
    IP — falls back to OpenStreetMap's structured directory data, which is
    immune to anti-bot blocking and reliably yields real businesses with
    working website URLs.

    Args:
        niche: Business category to search for (e.g. "dentist", "plumber").
        city: City to target (e.g. "Manchester", "Austin TX").
        num_results: Approximate number of businesses to discover.
        delay_seconds: Polite delay between the web-search requests.

    Returns:
        List of BusinessCandidate dicts (deduplicated by website domain).
    """
    businesses = _discover_via_web_search(niche, city, num_results, delay_seconds)

    if not businesses:
        logger.info(
            "Web search found nothing for '%s in %s' (likely rate-limited or no "
            "indexed results) — falling back to OpenStreetMap directory data.",
            niche, city,
        )
        businesses = _discover_via_openstreetmap(niche, city, num_results)

    return businesses


def _discover_via_web_search(
    niche: str,
    city: str,
    num_results: int = 20,
    delay_seconds: float = 2.0,
) -> list[dict[str, Any]]:
    """Discover local businesses by searching the web for their websites.

    Runs a couple of differently-phrased searches for businesses of the
    given niche in the given city and extracts individual business websites
    from the organic results (filtering out directories, social media, and
    "best of" listicle articles, which dominate generic local-search queries).

    Args:
        niche: Business category to search for (e.g. "dentist", "plumber").
        city: City to target (e.g. "Manchester", "Austin TX").
        num_results: Approximate number of businesses to discover.
        delay_seconds: Polite delay between the two search requests.

    Returns:
        List of BusinessCandidate dicts (may contain duplicates — caller deduplicates).
    """
    businesses = []
    queries = [
        f"{niche} {city} official website",
        f"{niche} near {city} contact",
    ]
    queries_needed = max(1, min(len(queries), -(-num_results // 10)))

    for i, query in enumerate(queries[:queries_needed]):
        try:
            resp = requests.post(_SEARCH_URL, data={"q": query}, headers=_HEADERS, timeout=15)
            if resp.status_code != 200:
                logger.warning("Search returned %d for query '%s'", resp.status_code, query)
                break

            soup = BeautifulSoup(resp.text, "html.parser")
            results = _parse_search_results(soup, city, niche)
            businesses.extend(results)
            logger.info("Query '%s': found %d candidate businesses", query, len(results))

            if i < queries_needed - 1:
                time.sleep(delay_seconds)

        except Exception as exc:
            logger.error("Business search failed for '%s': %s", query, exc)
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

    logger.info("Discovered %d unique businesses for '%s in %s'", len(unique), niche, city)
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

def _parse_search_results(
    soup: BeautifulSoup,
    city: str,
    niche: str,
) -> list[dict[str, Any]]:
    """Extract business data from a parsed DuckDuckGo HTML results page."""
    businesses = []

    # DuckDuckGo's no-JS HTML endpoint renders results as <div class="result">
    # blocks with the title/link in <a class="result__a"> and a text snippet
    # in <a class="result__snippet">.
    for result in soup.select("div.result"):
        link_el = result.select_one("a.result__a")
        snippet_el = result.select_one(".result__snippet")

        if not link_el:
            continue

        title = link_el.get_text(strip=True)
        href = link_el.get("href", "")
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""

        # Filter out directories/aggregators and "Top 10 Best ..." listicles —
        # these dominate generic local-search queries but aren't businesses.
        if _is_directory_url(href) or _LISTICLE_TITLE_RE.match(title):
            continue

        website = _normalise_url(href)
        if not website:
            continue

        phone = _extract_phone(snippet)

        businesses.append({
            "business_name": title,
            "website": website,
            "phone": phone,
            "city": city,
            "category": niche,
            "source": "web_search",
        })

    return businesses


def _is_directory_url(url: str) -> bool:
    """Return True if the URL belongs to a business directory, social network,
    review aggregator, or content site rather than an individual business."""
    return any(keyword in url.lower() for keyword in _DIRECTORY_KEYWORDS)


def _extract_phone(text: str) -> str:
    """Extract a phone number from a text string using regex."""
    match = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    return match.group(1).strip() if match else ""


def _normalise_url(url: str) -> str:
    """Add https:// scheme if missing; return empty string for non-URLs."""
    if not url:
        return ""
    url = url.strip()
    # DuckDuckGo sometimes wraps results in a redirect link like
    # "//duckduckgo.com/l/?uddg=<encoded target>&rut=...".
    if "uddg=" in url:
        from urllib.parse import parse_qs, unquote, urlparse
        query = parse_qs(urlparse(url).query)
        if "uddg" in query:
            url = unquote(query["uddg"][0])
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


# ── OpenStreetMap fallback helpers ───────────────────────────────────────────

def _discover_via_openstreetmap(
    niche: str,
    city: str,
    num_results: int = 20,
) -> list[dict[str, Any]]:
    """Discover real local businesses from OpenStreetMap's free directory data.

    Geocodes the city via Nominatim, then queries the Overpass API for places
    tagged with the niche's OSM category AND a `website`/`contact:website`
    tag — so every result returned already has a real site to analyze. This
    is structured data rather than a scrape, so it sidesteps the anti-bot
    blocking that plagues search-engine-based discovery entirely.

    Args:
        niche: Business category (e.g. "restaurant", "dentist").
        city: City to search around (e.g. "Kochi").
        num_results: Approximate number of businesses to return.

    Returns:
        List of BusinessCandidate dicts with source "openstreetmap".
    """
    coords = _geocode_city(city)
    if not coords:
        logger.warning("OpenStreetMap: could not geocode city '%s'", city)
        return []
    lat, lon = coords

    tag_clause = _resolve_osm_tag_clause(niche)
    radius = _OSM_SEARCH_RADIUS_M
    overpass_query = f"""
    [out:json][timeout:30];
    (
      node[{tag_clause}]["website"](around:{radius},{lat},{lon});
      way[{tag_clause}]["website"](around:{radius},{lat},{lon});
      node[{tag_clause}]["contact:website"](around:{radius},{lat},{lon});
      way[{tag_clause}]["contact:website"](around:{radius},{lat},{lon});
    );
    out center {num_results * 3};
    """

    elements = _query_overpass(overpass_query)
    if elements is None:
        logger.error("OpenStreetMap discovery failed for '%s in %s'", niche, city)
        return []

    businesses = []
    seen_domains: set[str] = set()
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        website = _normalise_url(tags.get("website") or tags.get("contact:website") or "")
        if not name or not website:
            continue

        domain = _extract_domain(website)
        if domain and domain in seen_domains:
            continue
        if domain:
            seen_domains.add(domain)

        businesses.append({
            "business_name": name,
            "website": website,
            "phone": tags.get("phone") or tags.get("contact:phone") or "",
            "city": city,
            "category": niche,
            "source": "openstreetmap",
        })

    logger.info(
        "OpenStreetMap: found %d businesses with websites for '%s in %s'",
        len(businesses), niche, city,
    )
    return businesses[:num_results]


def _query_overpass(query: str) -> list[dict[str, Any]] | None:
    """POST a query to Overpass, trying multiple public mirrors in sequence.

    The free Overpass instances are volunteer-run and intermittently return
    429 (rate limited) or 504 (overloaded) — these are transient per-instance
    issues, so rather than retrying the same overloaded instance, we move on
    to the next mirror in _OVERPASS_URLS immediately. This resolves transient
    outages without surfacing them to the user as "0 results".

    Returns None (not []) on a hard failure so the caller can distinguish
    "no results" from "couldn't even ask".
    """
    for i, url in enumerate(_OVERPASS_URLS):
        try:
            resp = requests.post(url, data={"data": query}, headers=_OSM_HEADERS, timeout=40)
            if resp.status_code in (429, 504):
                logger.warning(
                    "Overpass mirror %s returned %d — trying next mirror", url, resp.status_code,
                )
                continue
            resp.raise_for_status()
            return resp.json().get("elements", [])
        except Exception as exc:
            logger.warning("Overpass mirror %s failed (%s) — trying next mirror", url, exc)
            if i < len(_OVERPASS_URLS) - 1:
                time.sleep(2)
            continue

    logger.error("All Overpass mirrors failed for query")
    return None


def _geocode_city(city: str) -> tuple[float, float] | None:
    """Resolve a city name to (lat, lon) coordinates via Nominatim."""
    try:
        resp = requests.get(
            _NOMINATIM_URL,
            params={"q": city, "format": "json", "limit": 1},
            headers=_OSM_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        logger.error("Geocoding failed for city '%s': %s", city, exc)
        return None


def _resolve_osm_tag_clause(niche: str) -> str:
    """Map a free-text niche to an Overpass tag-filter clause.

    Known categories (restaurant, dentist, plumber, ...) resolve to their
    canonical OSM tag/value pair. Unknown niches fall back to a
    case-insensitive match against the place's `name`, so arbitrary user
    input still produces a usable query.
    """
    key = niche.strip().lower()
    if key in _NICHE_OSM_TAGS:
        tag, value = _NICHE_OSM_TAGS[key]
        return f'"{tag}"="{value}"'
    if key.endswith("s") and key[:-1] in _NICHE_OSM_TAGS:
        tag, value = _NICHE_OSM_TAGS[key[:-1]]
        return f'"{tag}"="{value}"'

    escaped = re.sub(r'(["\\])', r"\\\1", niche.strip())
    return f'"name"~"{escaped}",i'
