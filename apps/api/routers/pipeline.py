"""
Pipeline router — trigger and monitor automation runs.

Endpoints:
- POST /api/pipeline/run        — start a new pipeline run (background task)
- GET  /api/pipeline/{run_id}   — poll run status and logs
- GET  /api/pipeline            — list recent runs
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..schemas.pipeline import PipelineRunRequest, PipelineRunResponse
from ..services.pipeline import PipelineRun, create_run, get_run, list_runs, run_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/run", response_model=PipelineRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_pipeline(
    body: PipelineRunRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kick off a pipeline run in the background and return immediately.

    The client polls GET /api/pipeline/{run_id} until status is
    "completed" or "failed".  The run is pre-registered in _active_runs
    via create_run() before the background task starts, so the poll
    endpoint always finds it.
    """
    # Pre-create and store the run so polling works from the first request
    run = create_run(niche=body.niche, city=body.city)

    background_tasks.add_task(
        run_pipeline,
        db=db,
        user_id=current_user.id,
        niche=body.niche,
        city=body.city,
        run=run,
        num_leads=body.num_leads,
        send_emails=body.send_emails,
        email_type=body.email_type,
        anthropic_api_key=current_user.anthropic_api_key,
        gmail_address=current_user.gmail_address,
        gmail_app_password=current_user.gmail_app_password,
    )

    logger.info(
        "Pipeline run %s queued by user %s — %s in %s",
        run.run_id, current_user.id, body.niche, body.city,
    )
    return _run_to_response(run)


@router.get("/{run_id}", response_model=PipelineRunResponse)
async def get_pipeline_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return current status and logs for a pipeline run by ID."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return _run_to_response(run)


@router.get("", response_model=list[PipelineRunResponse])
async def list_pipeline_runs(
    current_user: User = Depends(get_current_user),
):
    """List all recent pipeline runs (in-memory, resets on server restart)."""
    return [_run_to_response(r) for r in list_runs()]


def _run_to_response(run: PipelineRun) -> PipelineRunResponse:
    return PipelineRunResponse(
        run_id=run.run_id,
        status=run.status,
        niche=run.niche,
        city=run.city,
        total_discovered=run.total_discovered,
        total_analyzed=run.total_analyzed,
        total_contacted=run.total_contacted,
        total_skipped=run.total_skipped,
        logs=run.logs,
        started_at=run.started_at,
        completed_at=run.completed_at,
        error=run.error,
    )
