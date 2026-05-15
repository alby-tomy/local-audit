from __future__ import annotations

import httpx

from core.config import get_settings

settings = get_settings()


async def send_delivery_email(to_email: str, subject: str, html: str) -> None:
    payload = {
        "from": settings.FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()

