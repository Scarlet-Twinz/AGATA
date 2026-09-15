from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import (
    Contractor,
    Document,
    DocumentRequirementMatch,
    Project,
    ProjectContractor,
    ProjectRequirement,
    Requirement,
    User,
)
from app.models.evidence_intelligence import EvidenceIntelligence
from app.models.rumi import RumiConversation, RumiMessageRecord
from app.services.readiness import calculate_readiness
from app.services.rumi import stream_rumi

router = APIRouter(prefix="/api/rumi", tags=["rumi"])


class RumiMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=12000)


class RumiRequest(BaseModel):
    conversation_id: UUID | None = None
    messages: list[RumiMessage] = Field(min_length=1, max_length=20)


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationTitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: str
    created_at: datetime


def _workspace_context(db: Session, company_id) -> str:
    """Build the current company-scoped facts Rumi is allowed to explain."""
    contractors = db.scalars(select(Contractor).where(Contractor.company_id == company_id).order_by(Contractor.name.asc())).all()
    projects = db.scalars(select(Project).where(Project.company_id == company_id).order_by(Project.name.asc())).all()
    requirements = db.scalars(select(Requirement).where(Requirement.company_id == company_id).order_by(Requirement.name.asc())).all()
    documents = db.scalars(select(Document).where(Document.company_id == company_id).order_by(Document.created_at.desc())).all()
    intelligence_rows = db.scalars(
        select(EvidenceIntelligence).join(Document, Document.id == EvidenceIntelligence.document_id).where(Document.company_id == company_id)
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

    project_names = {project.id: project.name for project in projects}
    contractor_names = {contractor.id: contractor.name for contractor in contractors}
    intelligence_by_document = {item.document_id: item for item in intelligence_rows}
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
        "CURRENT READINESS (calculated now from the current requirement/evidence graph):",
    ]
    if assignments:
        for project_id, contractor_id in assignments:
            result = calculate_readiness(db, company_id, project_id, contractor_id)
            lines.append(
                f"- Project: {project_names.get(project_id, 'Unknown project')} | Contractor: {contractor_names.get(contractor_id, 'Unknown contractor')} | "
                f"Status: {result['status'].replace('_', ' ')} | Score: {result['score']}% | Explanation: {result['explanation']}"
            )
    else:
        lines.append("- No project-contractor assignments yet.")

    lines.extend(["", "PROJECTS AND ASSIGNMENTS:"])
    if projects:
        for project in projects:
            assigned = ", ".join(assigned_by_project.get(project.id, [])) or "none"
            reqs = ", ".join(requirements_by_project.get(project.id, [])) or "none"
            lines.append(f"- {project.name} | Contractors: {assigned} | Requirements: {reqs}")
    else:
        lines.append("- No projects yet.")

    lines.extend(["", "EVIDENCE INTELLIGENCE:"])
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
            intelligence = intelligence_by_document.get(document.id)
            if intelligence is None:
                intelligence_state = "legacy/no intelligence record"
            else:
                intelligence_state = (
                    f"verification={intelligence.verification_status}; review={intelligence.review_status}; "
                    f"source={intelligence.source_type}; confidence={intelligence.confidence if intelligence.confidence is not None else 'not set'}"
                )
                if intelligence.rejection_reason:
                    intelligence_state += f"; rejection_reason={intelligence.rejection_reason}"
            lines.append(
                f"- {document.name} | Type: {document.document_type} | Contractor: {contractor} | Status: {document.status} | "
                f"Expiry: {expiry} | Mapped requirements: {mapped} | Intelligence: {intelligence_state}"
            )
    else:
        lines.append("- No evidence records yet.")
    return "\n".join(lines)


def _get_conversation(db: Session, user: User, conversation_id: UUID) -> RumiConversation:
    conversation = db.scalar(
        select(RumiConversation).where(
            RumiConversation.id == conversation_id,
            RumiConversation.user_id == user.id,
            RumiConversation.company_id == user.company_id,
        )
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Rumi conversation not found")
    return conversation


def _get_or_create_conversation(db: Session, user: User, conversation_id: UUID | None) -> RumiConversation:
    if conversation_id is not None:
        return _get_conversation(db, user, conversation_id)
    conversation = db.scalar(
        select(RumiConversation)
        .where(RumiConversation.user_id == user.id, RumiConversation.company_id == user.company_id)
        .order_by(RumiConversation.updated_at.desc())
    )
    if conversation is None:
        conversation = RumiConversation(user_id=user.id, company_id=user.company_id, title="New conversation")
        db.add(conversation)
        db.flush()
    return conversation


def _conversation_history_context(db: Session, user: User, current_id: UUID) -> str:
    """Provide a compact, user-scoped index so Rumi can recall past conversations."""
    conversations = db.scalars(
        select(RumiConversation)
        .where(RumiConversation.user_id == user.id, RumiConversation.company_id == user.company_id)
        .order_by(RumiConversation.updated_at.desc())
        .limit(30)
    ).all()
    lines = ["RUMI CONVERSATION HISTORY (user-scoped memory; use only for questions about prior Rumi conversations):"]
    if not conversations:
        lines.append("- No previous conversations are available.")
        return "\n".join(lines)
    for conversation in conversations:
        messages = db.scalars(
            select(RumiMessageRecord)
            .where(RumiMessageRecord.conversation_id == conversation.id, RumiMessageRecord.role == "user")
            .order_by(RumiMessageRecord.created_at.asc())
            .limit(8)
        ).all()
        if not messages:
            continue
        questions = " | ".join(message.content.replace("\n", " ")[:220] for message in messages)
        marker = " current conversation" if conversation.id == current_id else ""
        lines.append(
            f"- Title: {conversation.title} | Created: {conversation.created_at.isoformat()} | Updated: {conversation.updated_at.isoformat()} |"
            f"{marker} User questions: {questions}"
        )
    return "\n".join(lines)


def _is_historical_trace_request(message: dict[str, str] | None) -> bool:
    if not message or message.get("role") != "user":
        return False
    content = message.get("content", "").lower()
    return "historical trace" in content and "readiness decision" in content


def _historical_system() -> dict[str, str]:
    return {
        "role": "system",
        "content": (
            "You are Rumi, the compliance intelligence assistant inside AGATA.\n\n"
            "HISTORICAL TRACE MODE: The user's supplied historical trace is the only authoritative source for this answer. "
            "Use its facts literally. Do not use current workspace data, prior conversation messages, names, or general assumptions to fill gaps. "
            "Do not say a requirement is 'not met', 'unsatisfied', 'missing', 'invalid', 'critical', or 'required' unless that exact condition is explicitly stated in the supplied trace. "
            "Do not turn an evidence count of zero into a claim that evidence was required, missing, invalid, expired, unverified, or unavailable for a requirement. "
            "Do not invent requirement meaning or operational details from requirement names. "
            "You may state that the listed requirements are blockers because the deterministic explanation says they block readiness. "
            "You may explain the operational significance of the supplied blocker/change-action counts, but do not invent a cause. "
            "Preserve the deterministic result exactly: Not Ready, 0%, with 2 of 2 requirements blocking readiness. "
            "If a fact is not in the trace, say it is not established by the trace. Keep the explanation concise and decision-focused."
        ),
    }


@router.get("/conversations/current", response_model=ConversationResponse)
def current_conversation(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ConversationResponse:
    conversation = _get_or_create_conversation(db, user, None)
    db.commit()
    return ConversationResponse.model_validate(conversation)


@router.get("/conversations", response_model=list[ConversationResponse])
def conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ConversationResponse]:
    items = db.scalars(
        select(RumiConversation).where(RumiConversation.user_id == user.id, RumiConversation.company_id == user.company_id).order_by(RumiConversation.updated_at.desc())
    ).all()
    return [ConversationResponse.model_validate(item) for item in items]


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def conversation_detail(conversation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ConversationResponse:
    return ConversationResponse.model_validate(_get_conversation(db, user, conversation_id))


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
def create_conversation(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ConversationResponse:
    conversation = RumiConversation(user_id=user.id, company_id=user.company_id, title="New conversation")
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(conversation_id: UUID, payload: ConversationTitleUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ConversationResponse:
    conversation = _get_conversation(db, user, conversation_id)
    conversation.title = payload.title.strip()
    if not conversation.title:
        raise HTTPException(status_code=422, detail="Conversation title cannot be empty")
    db.commit()
    db.refresh(conversation)
    return ConversationResponse.model_validate(conversation)


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    conversation = _get_conversation(db, user, conversation_id)
    db.delete(conversation)
    db.commit()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
def conversation_messages(conversation_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[MessageResponse]:
    conversation = _get_conversation(db, user, conversation_id)
    items = db.scalars(select(RumiMessageRecord).where(RumiMessageRecord.conversation_id == conversation.id).order_by(RumiMessageRecord.created_at.asc())).all()
    return [MessageResponse.model_validate(item) for item in items]


@router.post("/chat")
async def chat(payload: RumiRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> StreamingResponse:
    conversation = _get_or_create_conversation(db, user, payload.conversation_id)
    prior = db.scalars(select(RumiMessageRecord).where(RumiMessageRecord.conversation_id == conversation.id).order_by(RumiMessageRecord.created_at.asc())).all()
    incoming = [message.model_dump() for message in payload.messages]
    last_user = next((message for message in reversed(incoming) if message["role"] == "user"), None)
    if last_user and (not prior or prior[-1].content != last_user["content"] or prior[-1].role != "user"):
        db.add(RumiMessageRecord(conversation_id=conversation.id, role="user", content=last_user["content"]))
        db.commit()

    historical = _is_historical_trace_request(last_user)
    history = db.scalars(select(RumiMessageRecord).where(RumiMessageRecord.conversation_id == conversation.id).order_by(RumiMessageRecord.created_at.asc())).all()

    if historical:
        messages = [_historical_system(), last_user]
    else:
        context = _workspace_context(db, user.company_id)
        conversation_history = _conversation_history_context(db, user, conversation.id)
        system = {
            "role": "system",
            "content": (
                "You are Rumi, the compliance intelligence assistant inside AGATA. "
                "Use only the CURRENT AGATA WORKSPACE DATA below for business facts. It is authoritative. "
                "Never invent, guess, or infer company data. AGATA is a product/platform: always refer to AGATA as 'it', never 'he' or 'she'. "
                "Never infer a contractor's gender from a name; use the contractor's name or 'the contractor'. "
                "Do not expose database IDs unless the user explicitly asks. Prefer human-readable names.\n\n"
                "READINESS RULES: Report the exact current project-contractor result, including status, score, and explanation. "
                "Do not turn one project's result into a global contractor status. If multiple projects exist, show each relevant project. "
                "The current readiness facts are calculated from the current requirements and evidence, not from stale historical checks.\n\n"
                "EVIDENCE RULES: Use the evidence intelligence state when present. Explain actual attention reasons such as expired, expiring, unverified, rejected, requires review, invalid, or unmapped only when the supplied data supports them. "
                "Do not describe legacy/no-intelligence evidence as verified.\n\n"
                "CONVERSATION MEMORY RULES: You may use RUMI CONVERSATION HISTORY only to answer questions about the user's previous Rumi conversations. "
                "If asked what the user asked earlier, last week, on a particular date, or in a prior conversation, use the supplied history index and be explicit when the available index does not contain enough detail. "
                "Do not use conversation history as evidence for current workspace business facts.\n\n"
                "PRODUCT GUIDANCE RULES: Rumi is also AGATA's in-product guide. When the user asks how to create, find, review, upload, assign, manage, or navigate within AGATA, explain the workflow clearly and give a navigation action when a relevant destination exists. "
                "Use only these internal destinations: Projects=/projects; Contractors=/contractors; Requirements=/requirements; Evidence=/evidence; Readiness=/readiness; Remediation=/remediation; Rumi=/rumi; Insights=/insights; Notifications=/notifications; Team=/team; Settings=/settings; Billing & Plan=/billing; Usage=/usage; Audit Trail=/audit; Command Center=/dashboard. "
                "For a navigation action, use Markdown link syntax exactly like [Open Projects](/projects). Only use one of the destinations listed above. "
                "Do not claim that Rumi has performed an action unless the user explicitly asks for an available action and AGATA provides that action. When the user asks how to create something, guide them to the relevant workspace and describe the next steps; do not pretend to create it.\n\n"
                "GREETING/IDENTITY RULES: If asked who you are, say you are Rumi, AGATA's compliance intelligence assistant. Keep it brief. "
                "If the answer is not supported by the supplied data, say so instead of guessing. Keep answers concise and practical.\n\n"
                + context + "\n\n" + conversation_history
            ),
        }
        messages = [system, *[{"role": item.role, "content": item.content} for item in history]]

    async def body() -> AsyncIterator[str]:
        chunks: list[str] = []
        try:
            async for token in stream_rumi(messages):
                chunks.append(token)
                yield token
        finally:
            answer = "".join(chunks).strip()
            if answer:
                db.add(RumiMessageRecord(conversation_id=conversation.id, role="assistant", content=answer))
                conversation.updated_at = datetime.now(timezone.utc)
                if conversation.title in {"Rumi conversation", "New conversation"} and last_user:
                    conversation.title = last_user["content"][:160]
                db.commit()

    return StreamingResponse(body(), media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
