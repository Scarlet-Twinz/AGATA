from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ContractorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: str | None = None
    phone: str | None = None


class ContractorResponse(ContractorCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    created_at: datetime


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None


class ProjectResponse(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str


class RequirementCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None


class RequirementResponse(RequirementCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class ProjectRequirementCreate(BaseModel):
    requirement_id: UUID


class ProjectRequirementResponse(BaseModel):
    id: UUID
    project_id: UUID
    requirement_id: UUID

    model_config = ConfigDict(from_attributes=True)


class DocumentCreate(BaseModel):
    contractor_id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    document_type: str = Field(min_length=1, max_length=100)
    expires_at: datetime | None = None
    storage_key: str | None = None


class DocumentResponse(DocumentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    created_at: datetime


class DocumentRequirementMatchResponse(BaseModel):
    id: UUID
    document_id: UUID
    requirement_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadinessResponse(BaseModel):
    project_id: UUID
    contractor_id: UUID
    score: int
    status: str
    explanation: str
    missing_requirements: list[str]


class DashboardProject(BaseModel):
    id: UUID
    name: str
    contractor_count: int
    readiness_score: int | None
    readiness_status: str | None


class DashboardResponse(BaseModel):
    company_name: str
    project_count: int
    contractor_count: int
    requirement_count: int
    evidence_count: int
    readiness_score: int | None
    ready_count: int
    attention_count: int
    not_ready_count: int
    expiring_count: int
    expired_count: int
    unmapped_count: int
    covered_requirement_count: int
    total_project_requirements: int
    projects: list[DashboardProject]
    recent_activity: list[str]
