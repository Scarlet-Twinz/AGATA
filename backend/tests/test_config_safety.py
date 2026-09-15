import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(
            _env_file=None,
            app_env="production",
            secret_key="change-me",
            database_url="postgresql+psycopg://agata:secret@db.example.com:5432/agata",
            cors_origins="https://app.example.com",
            ollama_base_url="https://rumi.example.com",
        )


def test_production_rejects_local_database_and_ollama() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            _env_file=None,
            app_env="production",
            secret_key="a" * 48,
            database_url="postgresql+psycopg://agata:secret@127.0.0.1:5432/agata",
            cors_origins="https://app.example.com",
            ollama_base_url="https://rumi.example.com",
        )

    with pytest.raises(ValidationError, match="OLLAMA_BASE_URL"):
        Settings(
            _env_file=None,
            app_env="production",
            secret_key="a" * 48,
            database_url="postgresql+psycopg://agata:secret@db.example.com:5432/agata",
            cors_origins="https://app.example.com",
            ollama_base_url="http://127.0.0.1:11434",
        )


def test_production_accepts_explicit_external_services() -> None:
    settings = Settings(
        _env_file=None,
        app_env="production",
        secret_key="a" * 48,
        database_url="postgresql+psycopg://agata:secret@db.example.com:5432/agata",
        cors_origins="https://app.example.com,https://www.example.com",
        ollama_base_url="https://rumi.example.com",
    )

    assert settings.cors_origin_list == ["https://app.example.com", "https://www.example.com"]
