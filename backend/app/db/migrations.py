from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


def _files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def run_migrations() -> None:
    """Apply versioned, forward-only SQL migrations exactly once.

    The existing AGATA SQL migrations are intentionally idempotent. That lets an
    older database that was created with SQLAlchemy create_all adopt the tracked
    migration history safely: the complete chain is reconciled once, then only
    newly numbered migrations run on later starts.
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
        for path in files:
            version = path.name
            if version in applied:
                continue
            sql = path.read_text(encoding="utf-8").strip()
            if sql:
                connection.exec_driver_sql(sql)
            connection.execute(
                text("INSERT INTO schema_migrations(version) VALUES (:version)"),
                {"version": version},
            )
