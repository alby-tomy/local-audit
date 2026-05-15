from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

import anthropic

from core.config import get_settings

settings = get_settings()
client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _clean_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


async def _threaded_create(**kwargs: Any) -> Any:
    return await asyncio.to_thread(client.messages.create, **kwargs)


async def generate_audit_report(
    business_name: str | None,
    website: str,
    city: str | None,
    issues: list[dict[str, Any]],
) -> str:
    issue_list = "\n".join(
        f"- {issue.get('name', issue.get('id', 'Issue'))}: {issue.get('description', '')}" for issue in issues
    )
    response = await _threaded_create(
        model=settings.CLAUDE_AUDIT_MODEL,
        max_tokens=500,
        system=(
            "You are a friendly web consultant. Write a short, personalized audit summary "
            "for a local business. Be specific and professional. Under 200 words. "
            "Plain text only. End with one clear call to action."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Business: {business_name or 'Local business'}\n"
                    f"City: {city or 'Unknown'}\n"
                    f"Website: {website}\n"
                    f"Issues found:\n{issue_list}\n\n"
                    "Write a personalized audit summary."
                ),
            }
        ],
    )
    return response.content[0].text


async def generate_html_fix(
    website_html: str,
    issue_type: str,
    issue_description: str,
    business_info: dict[str, Any],
) -> dict[str, Any]:
    fixable_issues = {
        "missing_viewport": "Add mobile viewport meta tag",
        "missing_meta_description": "Add meta description tag",
        "missing_meta_title": "Improve title tag",
        "no_whatsapp_button": "Add floating WhatsApp contact button",
        "no_google_maps_embed": "Add Google Maps embed",
        "missing_contact_form": "Add simple contact form",
        "no_social_links": "Add social media links to footer",
        "outdated_copyright": "Update copyright year in footer",
        "no_phone_display": "Add visible phone number",
        "missing_favicon": "Add favicon link tag",
        "missing_og_tags": "Add Open Graph meta tags",
        "missing_schema_markup": "Add LocalBusiness schema.org markup",
    }

    system_prompt = (
        "You are a senior web developer. Generate a minimal patch for one issue. "
        f"Issue: {fixable_issues.get(issue_type, issue_type)}. "
        "Output only valid JSON with keys patch_type, patch_code, replace_pattern, instructions, estimated_impact."
    )

    response = await _threaded_create(
        model=settings.CLAUDE_FIX_MODEL,
        max_tokens=2000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Issue: {issue_type}\n"
                    f"Issue description: {issue_description}\n"
                    f"Business info: {json.dumps(business_info)}\n"
                    f"HTML:\n{website_html[:8000]}\n"
                ),
            }
        ],
    )
    return _clean_json(response.content[0].text)


async def validate_fix_with_vision(
    screenshot_before: bytes,
    screenshot_after: bytes,
    issue_type: str,
) -> dict[str, Any]:
    response = await _threaded_create(
        model=settings.CLAUDE_FIX_MODEL,
        max_tokens=300,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Compare BEFORE and AFTER screenshots for issue {issue_type}. "
                            "Return JSON: {\"passed\": true/false, \"reason\": \"...\"}."
                        ),
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": base64.b64encode(screenshot_before).decode(),
                        },
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": base64.b64encode(screenshot_after).decode(),
                        },
                    },
                ],
            }
        ],
    )
    return _clean_json(response.content[0].text)

