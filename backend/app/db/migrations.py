from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"
BASELINE_VERSIONS = {
    "001_level2a_auth_security.sql",
    "002_audit_event_created_at.sql",
    "003_workspace_invitation_security.sql",
    "004_rumi_conversations.sql",
    "004_workspace_rbac.sql",
    "005_evidence_intelligence.sql",
    "006_readiness_decisions.sql",
    "007_remediation_tasks.sql",
}


def _files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def run_migrations() -> None:
    """Apply versioned SQL migrations exactly once.

    Existing AGATA development databases were historically created with SQLAlchemy
    create_all plus manually-run numbered migrations. On first startup this runner
    detects that shape and records the known historical migrations as a baseline,
    then applies every migration added after the baseline. Fresh databases run the
    complete migration chain from 000 onward.
    """
    files = _files()
    if not files:
        raise RuntimeError("No AGATA database migrations were found")

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )

        applied = set(connection.scalars(text("SELECT version FROM schema_migrations")).all())
        core_exists = bool(connection.scalar(text("SELECT to_regclass('public.companies')")))

        if not applied and core_exists:
            for version in sorted(BASELINE_VERSIONS):
                connection.execute(
                    text("INSERT INTO schema_migrations(version) VALUES (:version) ON CONFLICT DO NOTHING"),
                    {"version": version},
                )
            applied.update(BASELINE_VERSIONS)

        for path in files:
            version = path.name
            if version in applied:
                continue
            sql = path.read_text(encoding="utf-8").strip()
            if sql:
                connection.exec_driver_sql(sql)
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (:version)"), {"version": version})
