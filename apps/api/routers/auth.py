"""
Authentication router.

Provides:
- POST /api/auth/register — create a new user account
- POST /api/auth/token   — login and receive a JWT (OAuth2 form)
- POST /api/auth/login   — login with JSON body (frontend convenience)
- GET  /api/auth/me      — return current user profile
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..models.user import User
from ..schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account and return a JWT.

    Rejects duplicate email addresses with a 409 Conflict response so the
    frontend can show a clear "email already in use" message.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("New user registered: %s", user.email)
    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.post("/token", response_model=TokenResponse)
async def login_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 password flow login — accepts username (email) + password form data.

    This endpoint exists so FastAPI's Swagger UI /docs "Authorize" button works.
    """
    return await _authenticate(form.username, form.password, db)


@router.post("/login", response_model=TokenResponse)
async def login_json(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """JSON body login — convenience endpoint for the Next.js frontend."""
    return await _authenticate(body.email, body.password, db)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


async def _authenticate(email: str, password: str, db: AsyncSession) -> TokenResponse:
    """Shared login logic used by both login endpoints."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    token = create_access_token(subject=user.id)
    logger.info("User logged in: %s", user.email)
    return TokenResponse(access_token=token)
