"""
Settings router — manage per-user API keys and credentials.

Endpoints:
- GET   /api/settings — get current user settings
- PATCH /api/settings — update credentials
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..schemas.settings import SettingsResponse, SettingsUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(current_user: User = Depends(get_current_user)):
    """Return current user settings.

    API key values are never returned in full — only whether they are configured.
    This prevents accidental key exposure through the API.
    """
    return SettingsResponse(
        full_name=current_user.full_name,
        email=current_user.email,
        anthropic_api_key_set=bool(current_user.anthropic_api_key),
        gmail_address=current_user.gmail_address,
        gmail_configured=bool(current_user.gmail_address and current_user.gmail_app_password),
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user settings.  Only provided fields are changed."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.anthropic_api_key is not None:
        current_user.anthropic_api_key = body.anthropic_api_key or None
    if body.gmail_address is not None:
        current_user.gmail_address = body.gmail_address or None
    if body.gmail_app_password is not None:
        current_user.gmail_app_password = body.gmail_app_password or None

    await db.commit()
    await db.refresh(current_user)

    logger.info("Settings updated for user %s", current_user.email)
    return SettingsResponse(
        full_name=current_user.full_name,
        email=current_user.email,
        anthropic_api_key_set=bool(current_user.anthropic_api_key),
        gmail_address=current_user.gmail_address,
        gmail_configured=bool(current_user.gmail_address and current_user.gmail_app_password),
    )
