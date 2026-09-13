from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import ComplianceCheck, Contractor, Document, DocumentRequirementMatch, Notification, Project, ProjectContractor, User
from app.models.evidence_intelligence import EvidenceIntelligence
from app.models.readiness_decision import ReadinessDecision
from app.schemas.domain import NotificationResponse, NotificationUnreadCount
from app.services.readiness import calculate_readiness

router = APIRouter(prefix="/api", tags=["notifications"])

def _days_until(value: datetime | None) -> int | None:
    if value is None: return None
    current = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return (current - datetime.now(timezone.utc)).days

def _sync_notifications(db: Session, user: User) -> None:
    current: dict[str, dict] = {}
    documents = db.scalars(select(Document).where(Document.company_id == user.company_id).order_by(Document.created_at.desc())).all()
    contractor_ids = {d.contractor_id for d in documents if d.contractor_id}
    contractors = {c.id:c.name for c in db.scalars(select(Contractor).where(Contractor.company_id == user.company_id, Contractor.id.in_(contractor_ids) if contractor_ids else False)).all()}
    document_ids = [d.id for d in documents]
    mapped_ids = {m.document_id for m in db.scalars(select(DocumentRequirementMatch).where(DocumentRequirementMatch.document_id.in_(document_ids) if document_ids else False)).all()}
    intelligence = {x.document_id:x for x in db.scalars(select(EvidenceIntelligence).join(Document, Document.id == EvidenceIntelligence.document_id).where(Document.company_id == user.company_id)).all()}
    for document in documents:
        if document.status != "active": continue
        days = _days_until(document.expires_at); name = contractors.get(document.contractor_id,"Unassigned")
        if days is not None and days < 0: current[f"evidence:{document.id}:expiry"]={"kind":"evidence_expired","severity":"critical","title":f"Evidence expired: {document.name}","description":f"{name}'s {document.document_type} evidence expired. Update or replace it before relying on this evidence for readiness.","href":"/evidence"}
        elif days is not None and days <= 30: current[f"evidence:{document.id}:expiry"]={"kind":"evidence_expiring","severity":"warning","title":f"Evidence expiring soon: {document.name}","description":f"{name}'s {document.document_type} evidence expires in {max(days,0)} day(s). Review it before it becomes invalid.","href":"/evidence"}
        if document.id not in mapped_ids: current[f"evidence:{document.id}:mapping"]={"kind":"evidence_unmapped","severity":"info","title":f"Evidence needs mapping: {document.name}","description":f"{document.name} is active but is not mapped to a requirement, so it cannot contribute to a readiness decision.","href":"/evidence"}
        item=intelligence.get(document.id)
        if item is not None and item.verification_status == "unverified": current[f"evidence:{document.id}:verification"]={"kind":"evidence_unverified","severity":"warning","title":f"Evidence needs verification: {document.name}","description":f"{document.name} has not been verified and should not be relied on as validated evidence yet.","href":"/evidence"}
        elif item is not None and item.verification_status == "rejected": current[f"evidence:{document.id}:verification"]={"kind":"evidence_rejected","severity":"critical","title":f"Evidence rejected: {document.name}","description":f"{document.name} was rejected during evidence review. Replace or correct it before relying on it for readiness.","href":"/evidence"}
        if item is not None and item.review_status == "pending": current[f"evidence:{document.id}:review"]={"kind":"evidence_requires_review","severity":"warning","title":f"Evidence review required: {document.name}","description":f"{document.name} is mapped but still requires review before it can contribute to a readiness decision.","href":"/evidence"}
    assignments=db.scalars(select(ProjectContractor).join(Project,Project.id==ProjectContractor.project_id).join(Contractor,Contractor.id==ProjectContractor.contractor_id).where(Project.company_id==user.company_id,Contractor.company_id==user.company_id)).all()
    checks=db.scalars(select(ComplianceCheck).where(ComplianceCheck.company_id==user.company_id).order_by(ComplianceCheck.checked_at.desc())).all(); latest={}
    for c in checks: latest.setdefault((c.project_id,c.contractor_id),c)
    decisions={ (d.project_id,d.contractor_id):d for d in db.scalars(select(ReadinessDecision).where(ReadinessDecision.company_id==user.company_id)).all() }
    projects={p.id:p.name for p in db.scalars(select(Project).where(Project.company_id==user.company_id)).all()}; names={c.id:c.name for c in db.scalars(select(Contractor).where(Contractor.company_id==user.company_id)).all()}
    for a in assignments:
        pn=projects.get(a.project_id,"Project"); cn=names.get(a.contractor_id,"Contractor"); key=(a.project_id,a.contractor_id); check=latest.get(key); source=f"readiness:{a.project_id}:{a.contractor_id}"
        if check is None: current[source]={"kind":"readiness_unevaluated","severity":"info","title":f"Readiness check needed: {cn}","description":f"{cn} is assigned to {pn}, but readiness has not been evaluated yet.","href":"/readiness"}; continue
        result=calculate_readiness(db,user.company_id,a.project_id,a.contractor_id); decision=decisions.get(key)
        if result["status"]=="not_ready":
            missing=result.get("missing_requirements") or []; detail=", ".join(missing[:3]) if missing else "required evidence"; current[source]={"kind":"readiness_not_ready","severity":"critical","title":f"Contractor not ready: {cn}","description":f"{cn} is not ready for {pn}. Missing or invalid evidence: {detail}.","href":f"/projects/{a.project_id}/contractors/{a.contractor_id}"}
        elif result["status"]=="attention": current[source]={"kind":"readiness_attention","severity":"warning","title":f"Readiness needs attention: {cn}","description":f"{cn} needs attention before being considered fully ready for {pn}.","href":f"/projects/{a.project_id}/contractors/{a.contractor_id}"}
        elif decision is None or decision.status.value=="pending": current[f"decision:{a.project_id}:{a.contractor_id}"]={"kind":"readiness_decision_pending","severity":"warning","title":f"Readiness ready for decision: {cn}","description":f"{cn} is Ready for {pn}. Review and record the organizational readiness decision.","href":f"/projects/{a.project_id}/contractors/{a.contractor_id}"}
        elif decision.status.value=="approved" and result["status"]!="ready": current[f"decision:{a.project_id}:{a.contractor_id}:stale"]={"kind":"readiness_decision_stale","severity":"critical","title":f"Approved readiness changed: {cn}","description":f"{cn}'s approved readiness for {pn} is no longer Ready. Review the current evidence and decision.","href":f"/projects/{a.project_id}/contractors/{a.contractor_id}"}
    existing=db.scalars(select(Notification).where(Notification.company_id==user.company_id)).all(); by_key={x.source_key:x for x in existing}
    for source,payload in current.items():
        item=by_key.get(source)
        if item is None: db.add(Notification(company_id=user.company_id,source_key=source,**payload))
        else:
            previous=item.kind; item.kind=payload["kind"]; item.severity=payload["severity"]; item.title=payload["title"]; item.description=payload["description"]; item.href=payload["href"]; item.status="active"
            if item.read_at is not None and previous != payload["kind"]: item.read_at=None
    for item in existing:
        if item.source_key not in current and item.status=="active": item.status="resolved"
    db.commit()

@router.get("/notifications",response_model=list[NotificationResponse])
def list_notifications(status:str=Query(default="active",pattern="^(active|all)$"),db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    _sync_notifications(db,user); q=select(Notification).where(Notification.company_id==user.company_id)
    if status=="active": q=q.where(Notification.status=="active")
    return db.scalars(q.order_by(Notification.created_at.desc())).all()

@router.get("/notifications/unread-count",response_model=NotificationUnreadCount)
def unread_count(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    _sync_notifications(db,user); count=len(db.scalars(select(Notification).where(Notification.company_id==user.company_id,Notification.status=="active",Notification.read_at.is_(None))).all()); return NotificationUnreadCount(unread_count=count)

@router.patch("/notifications/{notification_id}/read",response_model=NotificationResponse)
def mark_read(notification_id:UUID,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    item=db.scalar(select(Notification).where(Notification.id==notification_id,Notification.company_id==user.company_id))
    if not item: raise HTTPException(status_code=404,detail="Notification not found")
    item.read_at=datetime.now(timezone.utc); db.commit(); db.refresh(item); return item

@router.post("/notifications/read-all",response_model=NotificationUnreadCount)
def mark_all_read(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    _sync_notifications(db,user); items=db.scalars(select(Notification).where(Notification.company_id==user.company_id,Notification.status=="active",Notification.read_at.is_(None))).all(); now=datetime.now(timezone.utc)
    for item in items: item.read_at=now
    db.commit(); return NotificationUnreadCount(unread_count=0)
