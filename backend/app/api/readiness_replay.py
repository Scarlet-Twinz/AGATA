from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Contractor, Project, ProjectContractor, User
from app.models.readiness_trace import ReadinessTrace
from app.services.rbac import require_permission
from app.services.readiness_intelligence import build_readiness_intelligence

router = APIRouter(prefix="/api/readiness", tags=["readiness-replay"])


def _names(items: list | None, key: str = "requirement_name") -> list[str]:
    return [str(item.get(key)) for item in (items or []) if item.get(key)]


def _trace_blocker_transition(trace: ReadinessTrace, previous: ReadinessTrace | None) -> tuple[list[str], list[str]]:
    """Return blocker changes only when a real prior snapshot exists."""
    if previous is None:
        return [], []
    current_blockers = set(_names(trace.blockers_snapshot))
    previous_blockers = set(_names(previous.blockers_snapshot))
    return sorted(current_blockers - previous_blockers), sorted(previous_blockers - current_blockers)


@router.get("/projects/{project_id}/contractors/{contractor_id}/replay/{trace_id}")
def readiness_replay(
    project_id: UUID,
    contractor_id: UUID,
    trace_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("readiness.view")),
):
    assignment = db.scalar(
        select(ProjectContractor)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(
            ProjectContractor.project_id == project_id,
            ProjectContractor.contractor_id == contractor_id,
            Project.company_id == user.company_id,
            Contractor.company_id == user.company_id,
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
    blockers_added, blockers_resolved = _trace_blocker_transition(trace, previous)

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
            "blockers_added": blockers_added,
            "blockers_resolved": blockers_resolved,
        },
    }


__all__ = ["_names", "_trace_blocker_transition", "router"]
