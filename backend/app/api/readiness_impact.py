from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import ProjectContractor, User
from app.services.rbac import require_permission
from app.services.readiness_intelligence import build_readiness_intelligence, simulate_readiness

router = APIRouter(prefix="/api/readiness", tags=["readiness-impact"])


class ReadinessImpactItem(BaseModel):
    action_key: str
    action_type: str
    label: str
    projected_score: int
    score_delta: int
    projected_status: str
    resolved_requirements: list[str]
    remaining_blockers: list[str]
    impact_rank: int


class ReadinessImpactResponse(BaseModel):
    project_id: UUID
    contractor_id: UUID
    current_score: int
    current_status: str
    items: list[ReadinessImpactItem]


@router.get("/projects/{project_id}/contractors/{contractor_id}/impact", response_model=ReadinessImpactResponse)
def readiness_impact(
    project_id: UUID,
    contractor_id: UUID,
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

    intelligence = build_readiness_intelligence(db, user.company_id, project_id, contractor_id)
    items: list[ReadinessImpactItem] = []

    for action in intelligence["minimum_change_set"]:
        if action["action_type"] == "repair_evidence":
            evidence_ids = [UUID(action["document_id"])]
            requirement_ids: list[UUID] = []
            action_key = f"repair:{action['document_id']}"
            label = f"Repair {action['document_name']}"
        else:
            evidence_ids = []
            requirement_ids = [UUID(action["requirement_id"])]
            action_key = f"provide:{action['requirement_id']}"
            label = f"Provide {action['requirement_name']}"

        projected = simulate_readiness(
            db,
            user.company_id,
            project_id,
            contractor_id,
            evidence_ids,
            requirement_ids,
        )
        items.append(
            ReadinessImpactItem(
                action_key=action_key,
                action_type=action["action_type"],
                label=label,
                projected_score=projected["projected_score"],
                score_delta=projected["score_delta"],
                projected_status=projected["projected_status"],
                resolved_requirements=projected["resolved_requirements"],
                remaining_blockers=projected["remaining_blockers"],
                impact_rank=0,
            )
        )

    items.sort(key=lambda item: (-item.score_delta, len(item.remaining_blockers), item.label.lower()))
    ranked = [item.model_copy(update={"impact_rank": index + 1}) for index, item in enumerate(items)]

    return ReadinessImpactResponse(
        project_id=project_id,
        contractor_id=contractor_id,
        current_score=intelligence["score"],
        current_status=intelligence["status"],
        items=ranked,
    )
