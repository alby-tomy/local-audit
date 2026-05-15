from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from core.database import DatabaseClient, get_db
from core.security import get_current_tenant
from services.queue_service import enqueue_deletion

router = APIRouter(prefix="/gdpr", tags=["gdpr"])


@router.get("/export")
async def export_data(
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> dict[str, object]:
    tenant_row = await db.fetch_one("SELECT * FROM tenants WHERE id = $1", tenant.id)
    users = await db.fetch_all(
        "SELECT email, full_name, role, created_at FROM users WHERE tenant_id = $1",
        tenant.id,
    )
    audits = await db.fetch_all("SELECT * FROM audits WHERE tenant_id = $1", tenant.id)
    fixes = await db.fetch_all("SELECT * FROM fixes WHERE tenant_id = $1", tenant.id)
    deliveries = await db.fetch_all("SELECT * FROM deliveries WHERE tenant_id = $1", tenant.id)

    return {
        "tenant": tenant_row,
        "users": users,
        "audits": audits,
        "fixes": fixes,
        "deliveries": deliveries,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


@router.delete("/delete-account")
async def request_deletion(
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> dict[str, str]:
    await db.execute(
        "UPDATE tenants SET deletion_requested_at = NOW() WHERE id = $1",
        tenant.id,
    )
    await enqueue_deletion(str(tenant.id), delay_days=30)
    return {
        "message": "Account scheduled for deletion in 30 days. Contact support to cancel before execution.",
    }

