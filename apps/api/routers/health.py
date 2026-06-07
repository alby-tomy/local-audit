"""Health check endpoint — used by Docker, load balancers, and monitoring."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Return 200 OK when the API is running and ready to serve traffic."""
    return {"status": "ok", "service": "LocalAudit AI API"}
