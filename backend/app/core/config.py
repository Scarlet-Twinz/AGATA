from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AGATA API"
    app_env: str = "development"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/agata"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    frontend_url: str = "http://localhost:5173"
    resend_api_key: str = ""
    email_from: str = "AGATA <onboarding@resend.dev>"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:3b-instruct"
    ollama_timeout_seconds: int = 120
    auth_verification_expire_minutes: int = 30
    auth_reset_expire_minutes: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_runtime_safety(self) -> "Settings":
        if self.access_token_expire_minutes <= 0:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero")
        if self.ollama_timeout_seconds <= 0:
            raise ValueError("OLLAMA_TIMEOUT_SECONDS must be greater than zero")

        if self.app_env.lower() == "production":
            if self.secret_key in {"change-me", "", "replace-with-a-long-random-development-secret"}:
                raise ValueError("SECRET_KEY must be explicitly configured in production")
            if len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")
            if not self.cors_origins.strip() or "*" in self.cors_origin_list:
                raise ValueError("CORS_ORIGINS must contain explicit production origins")
            if any(host in self.database_url.lower() for host in ("127.0.0.1", "localhost")):
                raise ValueError("DATABASE_URL must point to a non-local database in production")
            if self.ollama_base_url.startswith(("http://127.0.0.1", "http://localhost")):
                raise ValueError("OLLAMA_BASE_URL must point to a reachable production Rumi service")

        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
