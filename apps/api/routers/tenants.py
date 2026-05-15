from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.database import DatabaseClient, get_db
from core.security import get_current_tenant
from schemas.tenants import TenantSummary

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/me", response_model=TenantSummary)
async def get_current_tenant_profile(
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> TenantSummary:
    row = await db.fetch_one(
        """
        SELECT id, name, slug, subscription_status, credits_used, credits_limit, billing_cycle_end
        FROM tenants
        WHERE id = $1
        """,
        tenant.id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return TenantSummary(**row)

