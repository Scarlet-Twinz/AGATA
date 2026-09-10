from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.project_workflow import router as project_workflow_router
from app.api.requirement_management import router as requirement_management_router
from app.api.resources import router as resources_router
from app.api.rumi import router as rumi_router
from app.core.config import get_settings
from app.db.session import Base, engine
from app.models import entities  # noqa: F401


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Safe for an empty development database. Production migrations will replace this.
    if settings.app_env == "development":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"] ,
)

app.include_router(auth_router)
app.include_router(resources_router)
app.include_router(project_workflow_router)
app.include_router(requirement_management_router)
app.include_router(rumi_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agata-api"}


@app.get("/database", tags=["system"])
def database_health() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
