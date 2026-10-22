"""Typed configuration and environment settings for EduQuery V3."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Application settings with environment variable override support."""

    app_name: str = "EduQuery"
    app_version: str = "3.0.0"
    app_env: str = Field(default_factory=lambda: os.getenv("EDUQUERY_ENV", "development"))
    api_prefix: str = "/api/v1"

    # Database settings
    database_path: str = Field(
        default_factory=lambda: os.getenv("EDUQUERY_DATABASE_PATH")
        or os.getenv("EDUQUERY_DB_PATH")
        or "data/eduquery.duckdb"
    )

    # CORS settings: strictly explicit origins; regex is disabled by default to prevent lookalike/arbitrary domain bypass
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "EDUQUERY_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
            ).split(",")
            if origin.strip()
        ]
    )
    cors_origin_regex: str | None = Field(
        default_factory=lambda: os.getenv("EDUQUERY_CORS_ORIGIN_REGEX") or None
    )

    # Logging settings
    log_level: str = Field(default_factory=lambda: os.getenv("EDUQUERY_LOG_LEVEL", "INFO").upper())

    # Import and Storage settings
    import_api_key: str | None = Field(
        default_factory=lambda: os.getenv("EDUQUERY_IMPORT_API_KEY") or None
    )
    max_upload_size_bytes: int = Field(
        default_factory=lambda: int(os.getenv("EDUQUERY_MAX_UPLOAD_SIZE_BYTES", str(25 * 1024 * 1024)))
    )
    import_session_ttl_seconds: int = Field(
        default_factory=lambda: int(os.getenv("EDUQUERY_IMPORT_SESSION_TTL_SECONDS", "3600"))
    )
    active_dataset_pointer_path: str = Field(
        default_factory=lambda: os.getenv("EDUQUERY_ACTIVE_POINTER_PATH", "data/active_dataset.json")
    )
    data_dir: str = Field(default_factory=lambda: os.getenv("EDUQUERY_DATA_DIR", "data"))
    temporary_sessions_dir: str | None = Field(
        default_factory=lambda: os.getenv("EDUQUERY_TEMPORARY_SESSIONS_DIR") or None,
        description="Directory for isolated ephemeral temporary analysis sessions. When None, defaults to data_dir/sessions.",
    )
    frontend_dist_dir: str = Field(
        default_factory=lambda: os.getenv("EDUQUERY_FRONTEND_DIST_DIR", "frontend/dist")
    )

    # Faculty Identity Gateway settings (e.g. Cloudflare Access / Zero Trust)
    gateway_auth_required: bool = Field(
        default_factory=lambda: os.getenv("EDUQUERY_GATEWAY_AUTH_REQUIRED", "false").lower() in ("true", "1", "yes")
    )
    cf_access_team_domain: str | None = Field(
        default_factory=lambda: os.getenv("CF_ACCESS_TEAM_DOMAIN") or None
    )
    cf_access_aud: str | None = Field(
        default_factory=lambda: os.getenv("CF_ACCESS_AUD") or None
    )
    cf_access_certs_url: str | None = Field(
        default_factory=lambda: os.getenv("CF_ACCESS_CERTS_URL") or None
    )
    gateway_shared_secret: str | None = Field(
        default_factory=lambda: os.getenv("EDUQUERY_GATEWAY_SHARED_SECRET") or None
    )

    @property
    def is_production(self) -> bool:
        """Whether application is running in production mode."""
        return self.app_env.strip().lower() in ("production", "prod")

    @property
    def is_in_memory(self) -> bool:
        """Whether the configured database is an in-memory instance."""
        return self.database_path.strip().lower() == ":memory:"

    @property
    def resolved_database_path(self) -> Path | str:
        """Return Path object for file databases or ':memory:' string."""
        if self.is_in_memory:
            return ":memory:"
        return Path(self.database_path).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
