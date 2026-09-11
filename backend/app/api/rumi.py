from collections.abc import AsyncIterator
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    ComplianceCheck,
    Contractor,
    Document,
    DocumentRequirementMatch,
    Project,
    ProjectContractor,
    ProjectRequirement,
    Requirement,
    User,
)
from app.services.rumi import stream_rumi

router = APIRouter(prefix="/api/rumi", tags=["rumi"])


class RumiMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=12000)


class RumiRequest(BaseModel):
    messages: list[RumiMessage] = Field(min_length=1, max_length=20)


def _workspace_context(db: Session, company_id) -> str:
    """Build a compact, company-scoped snapshot for Rumi.

    Rumi is an explainer, so the backend supplies current facts instead of
    asking the model to guess or invent workspace records.
    """
    contractors = db.scalars(
        select(Contractor)
        .where(Contractor.company_id == company_id)
        .order_by(Contractor.name.asc())
    ).all()
    projects = db.scalars(
        select(Project)
        .where(Project.company_id == company_id)
        .order_by(Project.name.asc())
    ).all()
    requirements = db.scalars(
        select(Requirement)
        .where(Requirement.company_id == company_id)
        .order_by(Requirement.name.asc())
    ).all()
    documents = db.scalars(
        select(Document)
        .where(Document.company_id == company_id)
        .order_by(Document.created_at.desc())
    ).all()
    assignments = db.execute(
        select(ProjectContractor.project_id, ProjectContractor.contractor_id)
        .join(Project, Project.id == ProjectContractor.project_id)
        .join(Contractor, Contractor.id == ProjectContractor.contractor_id)
        .where(Project.company_id == company_id, Contractor.company_id == company_id)
    ).all()
    project_requirements = db.execute(
        select(ProjectRequirement.project_id, Requirement.name)
        .join(Project, Project.id == ProjectRequirement.project_id)
        .join(Requirement, Requirement.id == ProjectRequirement.requirement_id)
        .where(Project.company_id == company_id, Requirement.company_id == company_id)
    ).all()
    matches = db.execute(
        select(DocumentRequirementMatch.document_id, Requirement.name)
        .join(Document, Document.id == DocumentRequirementMatch.document_id)
        .join(Requirement, Requirement.id == DocumentRequirementMatch.requirement_id)
        .where(Document.company_id == company_id, Requirement.company_id == company_id)
    ).all()
    checks = db.scalars(
        select(ComplianceCheck)
        .where(ComplianceCheck.company_id == company_id)
        .order_by(ComplianceCheck.checked_at.desc())
    ).all()

    project_names = {project.id: project.name for project in projects}
    contractor_names = {contractor.id: contractor.name for contractor in contractors}
    latest_checks: dict[tuple[object, object], ComplianceCheck] = {}
    for check in checks:
        key = (check.project_id, check.contractor_id)
        if key not in latest_checks:
            latest_checks[key] = check

    assigned_by_project: dict[object, list[str]] = {}
    for project_id, contractor_id in assignments:
        assigned_by_project.setdefault(project_id, []).append(contractor_names.get(contractor_id, "Unknown contractor"))

    requirements_by_project: dict[object, list[str]] = {}
    for project_id, requirement_name in project_requirements:
        requirements_by_project.setdefault(project_id, []).append(requirement_name)

    mapped_by_document: dict[object, list[str]] = {}
    for document_id, requirement_name in matches:
        mapped_by_document.setdefault(document_id, []).append(requirement_name)

    now = datetime.now(timezone.utc)
    lines = [
        "CURRENT AGATA WORKSPACE DATA (authoritative backend snapshot):",
        f"Projects: {len(projects)} | Contractors: {len(contractors)} | Requirements: {len(requirements)} | Evidence: {len(documents)}",
        "",
        "READINESS (latest recorded check for each project + contractor pair):",
    ]
    if latest_checks:
        for check in latest_checks.values():
            status = check.status.value.replace("_", " ")
            missing = ""
            if check.explanation:
                missing = f" | Explanation: {check.explanation}"
            lines.append(
                f"- Project: {project_names.get(check.project_id, 'Unknown project')} | "
                f"Contractor: {contractor_names.get(check.contractor_id, 'Unknown contractor')} | "
                f"Status: {status} | Score: {check.score}%{missing}"
            )
    else:
        lines.append("- No readiness checks have been recorded yet.")

    lines.extend(["", "PROJECTS AND ASSIGNMENTS:"])
    if projects:
        for project in projects:
            assigned = ", ".join(assigned_by_project.get(project.id, [])) or "none"
            reqs = ", ".join(requirements_by_project.get(project.id, [])) or "none"
            lines.append(f"- {project.name} | Contractors: {assigned} | Requirements: {reqs}")
    else:
        lines.append("- No projects yet.")

    lines.extend(["", "EVIDENCE:"])
    if documents:
        for document in documents:
            if document.expires_at is None:
                expiry = "no expiry"
            elif document.expires_at <= now:
                expiry = "expired"
            else:
                expiry = document.expires_at.date().isoformat()
            mapped = ", ".join(mapped_by_document.get(document.id, [])) or "unmapped"
            contractor = contractor_names.get(document.contractor_id, "unassigned")
            lines.append(
                f"- {document.name} | Type: {document.document_type} | Contractor: {contractor} | "
                f"Status: {document.status} | Expiry: {expiry} | Mapped requirements: {mapped}"
            )
    else:
        lines.append("- No evidence records yet.")

    return "\n".join(lines)


@router.post("/chat")
async def chat(
    payload: RumiRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    context = _workspace_context(db, user.company_id)
    system = {
        "role": "system",
        "content": (
            "You are Rumi, the compliance intelligence assistant inside AGATA. "
            "Answer questions using the CURRENT AGATA WORKSPACE DATA supplied below. "
            "Treat that data as authoritative for this response. Never invent contractors, "
            "projects, requirements, evidence, readiness statuses, scores, or other business facts. "
            "If the data does not contain the answer, say that clearly and ask for the missing "
            "information. For readiness questions, answer directly with the matching project, "
            "contractor, status, score, and explanation when available. Keep answers concise and practical.\n\n"
            + context
        ),
    }
    messages = [system, *[message.model_dump() for message in payload.messages]]

    async def body() -> AsyncIterator[str]:
        async for token in stream_rumi(messages):
            yield token

    return StreamingResponse(
        body(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
