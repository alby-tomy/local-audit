from __future__ import annotations

from typing import Any

from .scraper_service import analyze_website, take_screenshot
from .storage_service import upload_file


async def run_audit(audit_id: str, website_url: str) -> dict[str, Any]:
    analysis = await analyze_website(website_url)
    screenshot_url: str | None = None
    if analysis.get("reachable"):
        screenshot = await take_screenshot(website_url)
        screenshot_url = await upload_file(f"audits/{audit_id}/before.png", screenshot, "image/png")
    return {
        **analysis,
        "screenshot_url": screenshot_url,
    }
