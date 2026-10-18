"""Health inspection and system status schemas for EduQuery V3 API."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DatabaseHealthInfo(BaseModel):
    """Database connectivity and loaded entity metrics."""
    model_config = ConfigDict(extra="forbid")

    mode: str = Field(description="Database mode ('in_memory' or 'read_only_file')")
    connected: bool = Field(description="Whether active DuckDB connection is responding")
    students_count: int | None = Field(default=None, ge=0, description="Count of ingested students, if loaded")
    courses_count: int | None = Field(default=None, ge=0, description="Count of ingested courses, if loaded")
    active_dataset_id: str | None = Field(default=None, description="Active dataset ID or version")
    activated_at: str | None = Field(default=None, description="Timestamp of dataset activation if known")


class HealthResponse(BaseModel):
    """Root health and liveness probe response."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="healthy", description="Application status indicator")
    version: str = Field(default="3.0.0", description="EduQuery semantic version")
    database: DatabaseHealthInfo = Field(description="Database connectivity diagnostics")
