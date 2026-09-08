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


class ReadinessResponse(BaseModel):
    project_id: UUID
    contractor_id: UUID
    score: int
    status: str
    explanation: str
    missing_requirements: list[str]
