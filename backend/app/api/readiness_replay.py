from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ProjectContractor, User
from app.models.readiness_trace import ReadinessTrace
from app.services.rbac import require_permission
from app.services.readiness_intelligence import build_readiness_intelligence

router = APIRouter(prefix="/api/readiness", tags=["readiness-replay"])


def _names(items: list | None, key: str = "requirement_name") -> list[str]:
    return [str(item.get(key)) for item in (items or []) if item.get(key)]


@router.get("/projects/{project_id}/contractors/{contractor_id}/replay/{trace_id}")
def readiness_replay(
    project_id: UUID,
    contractor_id: UUID,
    trace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    assignment = db.scalar(
        select(ProjectContractor).where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
        )
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Contractor is not assigned to this project")

    trace = db.scalar(
        select(ReadinessTrace).where(
            ReadinessTrace.id == trace_id,
            ReadinessTrace.company_id == user.company_id,
            ReadinessTrace.project_id == project_id,
            ReadinessTrace.contractor_id == contractor_id,
        )
    )
    if trace is None:
        raise HTTPException(status_code=404, detail="Readiness trace not found")

    previous = db.scalar(
        select(ReadinessTrace)
        .where(
            ReadinessTrace.company_id == user.company_id,
            ReadinessTrace.project_id == project_id,
            ReadinessTrace.contractor_id == contractor_id,
            ReadinessTrace.created_at < trace.created_at,
        )
        .order_by(ReadinessTrace.created_at.desc())
        .limit(1)
    )
    current = build_readiness_intelligence(db, user.company_id, project_id, contractor_id)

    current_blockers = set(_names(trace.blockers_snapshot))
    previous_blockers = set(_names(previous.blockers_snapshot if previous else None))
    return {
        "trace_id": trace.id,
        "project_id": project_id,
        "contractor_id": contractor_id,
        "captured_at": trace.created_at,
        "engine_version": trace.engine_version,
        "fingerprint": trace.fingerprint,
        "is_current": trace.fingerprint == current["fingerprint"],
        "state": {
            "score": trace.score,
            "status": trace.status,
            "explanation": trace.explanation,
            "requirements": trace.requirements_snapshot or [],
            "evidence": trace.evidence_snapshot or [],
            "blockers": trace.blockers_snapshot or [],
            "change_set": trace.change_set_snapshot or [],
        },
        "transition": {
            "from_trace_id": previous.id if previous else None,
            "from_score": previous.score if previous else None,
            "from_status": previous.status if previous else None,
            "score_delta": trace.score - previous.score if previous else None,
            "status_changed": bool(previous and trace.status != previous.status),
            "blockers_added": sorted(current_blockers - previous_blockers) if previous else [],
            "blockers_resolved": sorted(previous_blockers - current_blockers) if previous else [],
        },
    }


__all__ = ["router"]
