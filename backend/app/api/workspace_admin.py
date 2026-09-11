from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import Company, Contractor, Document, Project, Requirement, User

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.get("/summary")
def workspace_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company_id = user.company_id
    company = db.scalar(select(Company).where(Company.id == company_id))
    return {
        "company": {"id": str(company.id), "name": company.name} if company else None,
        "counts": {
            "projects": db.scalar(select(func.count()).select_from(Project).where(Project.company_id == company_id)) or 0,
            "contractors": db.scalar(select(func.count()).select_from(Contractor).where(Contractor.company_id == company_id)) or 0,
            "requirements": db.scalar(select(func.count()).select_from(Requirement).where(Requirement.company_id == company_id)) or 0,
            "evidence": db.scalar(select(func.count()).select_from(Document).where(Document.company_id == company_id)) or 0,
            "users": db.scalar(select(func.count()).select_from(User).where(User.company_id == company_id)) or 0,
        },
    }


@router.get("/team")
def workspace_team(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    users = db.scalars(select(User).where(User.company_id == user.company_id).order_by(User.full_name.asc())).all()
    return [
        {"id": str(item.id), "name": item.full_name, "email": item.email, "joined_at": item.created_at}
        for item in users
    ]


@router.get("/profile")
def workspace_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    return {
        "company": {"id": str(company.id), "name": company.name} if company else None,
        "user": {"id": str(user.id), "name": user.full_name, "email": user.email},
    }
