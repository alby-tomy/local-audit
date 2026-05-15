from __future__ import annotations

import hashlib
from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .database import DatabaseClient, get_db


security = HTTPBearer(auto_error=False)


@dataclass
class TenantContext:
    id: UUID
    subscription_status: str
    credits_used: int
    credits_limit: int


def _api_key_hash(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


async def _tenant_from_api_key(api_key: str, db: DatabaseClient) -> TenantContext | None:
    key_hash = _api_key_hash(api_key)
    row = await db.fetch_one(
        """
        SELECT t.id, t.subscription_status, t.credits_used, t.credits_limit
        FROM api_keys ak
        JOIN tenants t ON t.id = ak.tenant_id
        WHERE ak.key_hash = $1
          AND ak.is_active = TRUE
          AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        """,
        key_hash,
    )
    if not row:
        return None
    return TenantContext(
        id=row["id"],
        subscription_status=row["subscription_status"] or "inactive",
        credits_used=row["credits_used"] or 0,
        credits_limit=row["credits_limit"] or 0,
    )


async def get_current_tenant(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    db: DatabaseClient = Depends(get_db),
) -> TenantContext:
    settings = get_settings()

    if x_api_key:
        tenant = await _tenant_from_api_key(x_api_key, db)
        if tenant:
            return tenant

    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant missing in token")

    row = await db.fetch_one(
        "SELECT id, subscription_status, credits_used, credits_limit FROM tenants WHERE id = $1",
        tenant_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    return TenantContext(
        id=row["id"],
        subscription_status=row["subscription_status"] or "inactive",
        credits_used=row["credits_used"] or 0,
        credits_limit=row["credits_limit"] or 0,
    )


async def check_credits(tenant: TenantContext, db: DatabaseClient) -> bool:  # noqa: ARG001
    if tenant.subscription_status not in {"active", "trialing"}:
        return False
    if tenant.credits_limit <= 0:
        return False
    return tenant.credits_used < tenant.credits_limit
