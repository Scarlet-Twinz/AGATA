from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import DocumentRequirementMatch, Project, ProjectRequirement, Requirement, User
from app.schemas.domain import RequirementResponse

router = APIRouter(prefix="/api", tags=["requirement-management"])


class RequirementUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None


def _company_requirement_or_404(db: Session, requirement_id: UUID, company_id: UUID) -> Requirement:
    requirement = db.scalar(
        select(Requirement).where(
            Requirement.id == requirement_id,
            Requirement.company_id == company_id,
        )
    )
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return requirement


def _company_project_or_404(db: Session, project_id: UUID, company_id: UUID) -> Project:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.company_id == company_id)
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/requirements/{requirement_id}", response_model=RequirementResponse)
def update_requirement(
    requirement_id: UUID,
    payload: RequirementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    requirement = _company_requirement_or_404(db, requirement_id, user.company_id)
    requirement.name = payload.name.strip()
    requirement.description = payload.description.strip() if payload.description else None
    db.commit()
    db.refresh(requirement)
    return requirement


@router.delete("/requirements/{requirement_id}", status_code=204)
def delete_requirement(
    requirement_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    requirement = _company_requirement_or_404(db, requirement_id, user.company_id)
    used_in_projects = db.scalar(
        select(ProjectRequirement.id).where(ProjectRequirement.requirement_id == requirement_id).limit(1)
    )
    used_by_evidence = db.scalar(
        select(DocumentRequirementMatch.id).where(DocumentRequirementMatch.requirement_id == requirement_id).limit(1)
    )
    if used_in_projects or used_by_evidence:
        raise HTTPException(
            status_code=409,
            detail="This requirement is still in use. Remove its project and evidence mappings before deleting it.",
        )
    db.delete(requirement)
    db.commit()


@router.delete("/projects/{project_id}/requirements/{requirement_id}", status_code=204)
def detach_requirement_from_project(
    project_id: UUID,
    requirement_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _company_project_or_404(db, project_id, user.company_id)
    _company_requirement_or_404(db, requirement_id, user.company_id)
    link = db.scalar(
        select(ProjectRequirement).where(
            ProjectRequirement.project_id == project_id,
            ProjectRequirement.requirement_id == requirement_id,
        )
    )
    if not link:
        raise HTTPException(status_code=404, detail="Requirement is not attached to this project")
    db.delete(link)
    db.commit()
