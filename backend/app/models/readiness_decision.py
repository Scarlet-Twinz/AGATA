from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ReadinessDecisionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ReadinessDecision(Base):
    __tablename__ = "readiness_decisions"
    __table_args__ = (UniqueConstraint("project_id", "contractor_id", name="uq_readiness_decision_assignment"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    contractor_id: Mapped[UUID] = mapped_column(ForeignKey("contractors.id", ondelete="CASCADE"), index=True)
    status: Mapped[ReadinessDecisionStatus] = mapped_column(
        SAEnum(ReadinessDecisionStatus), default=ReadinessDecisionStatus.PENDING
    )
    decided_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
