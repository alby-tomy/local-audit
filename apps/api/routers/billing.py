from __future__ import annotations

from fastapi import APIRouter, Depends

from core.database import DatabaseClient, get_db
from core.security import get_current_tenant

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/usage")
async def usage_summary(
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> dict[str, int | str]:
    row = await db.fetch_one(
        "SELECT subscription_status, credits_used, credits_limit FROM tenants WHERE id = $1",
        tenant.id,
    )
    if not row:
        return {"subscription_status": "inactive", "credits_used": 0, "credits_limit": 0}

    remaining = max(0, int(row["credits_limit"] or 0) - int(row["credits_used"] or 0))
    return {
        "subscription_status": row["subscription_status"] or "inactive",
        "credits_used": int(row["credits_used"] or 0),
        "credits_limit": int(row["credits_limit"] or 0),
        "credits_remaining": remaining,
    }

