from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.contractor_management import router as contractor_management_router
from app.api.dashboard_consistency import router as dashboard_consistency_router
from app.api.evidence_management import router as evidence_management_router
from app.api.insights import router as insights_router
from app.api.notifications import router as notifications_router
from app.api.project_workflow import router as project_workflow_router
from app.api.readiness_management import router as readiness_management_router
from app.api.requirement_management import router as requirement_management_router
from app.api.resources import router as resources_router
from app.api.rumi import router as rumi_router
from app.api.workspace_admin import router as workspace_admin_router
from app.api.workspace_invitations import router as workspace_invitations_router
from app.core.config import get_settings
from app.db.session import Base, engine
from app.models import auth_security  # noqa: F401
from app.models import entities  # noqa: F401
from app.models import workspace  # noqa: F401

settings = get_settings()


def ensure_development_schema() -> None:
    """Apply local schema compatibility changes not handled by create_all."""
    if settings.app_env != "development":
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE workspace_invitations ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64)"))
        connection.execute(text("ALTER TABLE workspace_invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ"))
        connection.execute(text("ALTER TABLE workspace_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ"))
        # Secure invitations do not persist raw tokens. Older local databases
        # may still have the legacy token column marked NOT NULL.
        connection.execute(text("ALTER TABLE workspace_invitations ALTER COLUMN token DROP NOT NULL"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_workspace_invitations_token_hash ON workspace_invitations (token_hash) WHERE token_hash IS NOT NULL"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_workspace_invitations_expires_at ON workspace_invitations (expires_at)"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "development":
        Base.metadata.create_all(bind=engine)
        ensure_development_schema()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
app.include_router(dashboard_consistency_router)
app.include_router(resources_router)
app.include_router(project_workflow_router)
app.include_router(requirement_management_router)
app.include_router(contractor_management_router)
app.include_router(evidence_management_router)
app.include_router(readiness_management_router)
app.include_router(notifications_router)
app.include_router(rumi_router)
app.include_router(insights_router)
app.include_router(workspace_invitations_router)
app.include_router(workspace_admin_router)
app.include_router(audit_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agata-api"}


@app.get("/database", tags=["system"])
def database_health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
