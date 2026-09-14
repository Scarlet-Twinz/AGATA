from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ReadinessTrace(Base):
    """Immutable snapshot of the evidence and rules behind a readiness evaluation."""

    __tablename__ = "readiness_traces"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    contractor_id: Mapped[UUID] = mapped_column(ForeignKey("contractors.id", ondelete="CASCADE"), index=True)
    compliance_check_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("compliance_checks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    engine_version: Mapped[str] = mapped_column(String(40), default="readiness-v2")
    score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30))
    explanation: Mapped[str] = mapped_column(Text, default="")
    requirements_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    evidence_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    blockers_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    change_set_snapshot: Mapped[list] = mapped_column(JSON, default=list)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
