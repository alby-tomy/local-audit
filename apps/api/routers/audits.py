from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from core.database import DatabaseClient, get_db
from core.security import check_credits, get_current_tenant
from schemas.audits import AuditCreate, AuditResponse
from services.queue_service import enqueue_audit, enqueue_fix

router = APIRouter(prefix="/audits", tags=["audits"])


@router.post("/", response_model=AuditResponse, status_code=202)
async def create_audit(
    payload: AuditCreate,
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> AuditResponse:
    if not await check_credits(tenant, db):
        raise HTTPException(status_code=429, detail="Credit limit reached. Upgrade your plan.")

    audit = await db.fetch_one(
        """
        INSERT INTO audits (tenant_id, website_url, business_name, niche, city, country, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *
        """,
        tenant.id,
        str(payload.website_url),
        payload.business_name,
        payload.niche,
        payload.city,
        payload.country,
    )
    if not audit:
        raise HTTPException(status_code=500, detail="Failed to create audit")

    await db.execute("UPDATE tenants SET credits_used = credits_used + 1 WHERE id = $1", tenant.id)
    await enqueue_audit(str(audit["id"]), str(tenant.id), str(payload.website_url))
    return AuditResponse(**audit)


@router.get("/", response_model=list[AuditResponse])
async def list_audits(
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> list[AuditResponse]:
    rows = await db.fetch_all(
        "SELECT * FROM audits WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100",
        tenant.id,
    )
    return [AuditResponse(**row) for row in rows]


@router.get("/{audit_id}", response_model=AuditResponse)
async def get_audit(
    audit_id: UUID,
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> AuditResponse:
    audit = await db.fetch_one(
        "SELECT * FROM audits WHERE id = $1 AND tenant_id = $2",
        audit_id,
        tenant.id,
    )
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return AuditResponse(**audit)


@router.post("/{audit_id}/fix", status_code=202)
async def request_fix(
    audit_id: UUID,
    tenant=Depends(get_current_tenant),
    db: DatabaseClient = Depends(get_db),
) -> dict[str, str]:
    audit = await db.fetch_one(
        "SELECT * FROM audits WHERE id = $1 AND tenant_id = $2 AND status = 'completed'",
        audit_id,
        tenant.id,
    )
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found or not completed")

    issues = audit.get("issues") or []
    for issue in issues:
        await enqueue_fix(str(audit_id), str(tenant.id), issue)

    return {"message": f"Fix jobs enqueued for {len(issues)} issues", "audit_id": str(audit_id)}

