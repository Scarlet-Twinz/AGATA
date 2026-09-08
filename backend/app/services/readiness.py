from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Document, ProjectRequirement, ReadinessStatus, Requirement


def calculate_readiness(db: Session, company_id: UUID, project_id: UUID, contractor_id: UUID) -> dict:
    links = db.scalars(select(ProjectRequirement).where(ProjectRequirement.project_id == project_id)).all()
    requirement_ids = [link.requirement_id for link in links]
    requirements = db.scalars(select(Requirement).where(Requirement.id.in_(requirement_ids), Requirement.company_id == company_id)).all() if requirement_ids else []
    documents = db.scalars(select(Document).where(Document.company_id == company_id, Document.contractor_id == contractor_id)).all()

    now = datetime.now(timezone.utc)
    missing: list[str] = []
    satisfied = 0
    for requirement in requirements:
        matching = [d for d in documents if d.document_type.lower() == requirement.name.lower() and (d.expires_at is None or d.expires_at > now)]
        if matching:
            satisfied += 1
        else:
            missing.append(requirement.name)

    total = len(requirements)
    score = 100 if total == 0 else round((satisfied / total) * 100)
    status = ReadinessStatus.READY if score == 100 else ReadinessStatus.ATTENTION if score >= 60 else ReadinessStatus.NOT_READY
    explanation = "All required evidence is valid." if not missing else f"Missing or invalid evidence: {', '.join(missing)}."
    return {
        "project_id": project_id,
        "contractor_id": contractor_id,
        "score": score,
        "status": status.value,
        "explanation": explanation,
        "missing_requirements": missing,
    }
