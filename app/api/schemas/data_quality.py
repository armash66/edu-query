"""Data quality audit report schemas for EduQuery V3 API."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

SeverityLevel = Literal["error", "warning", "info"]
HealthStatusLevel = Literal["Good", "Needs Attention", "Critical"]


class DataQualityFindingItem(BaseModel):
    """Specific integrity finding or anomaly detected during marksheet audit."""
    model_config = ConfigDict(extra="forbid")

    check_id: str = Field(description="Unique audit check rule identifier")
    severity: SeverityLevel = Field(description="Severity categorization ('error', 'warning', 'info')")
    title: str = Field(description="Descriptive summary of the integrity check")
    count: int = Field(ge=0, description="Total occurrences of this anomaly")
    problem: str = Field(description="Technical root cause of the finding")
    impact: str = Field(description="Impact on academic evaluation or transcript accuracy")
    recommended_action: str = Field(description="Remediation guidance for faculty or registry")
    details: list[str] = Field(default_factory=list, description="Specific row, student, or score examples")


class DataQualityResponse(BaseModel):
    """Overall marksheet data quality and integrity report."""
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(description="Marksheet or ingestion session identifier")
    health_status: HealthStatusLevel = Field(description="Overall health evaluation ('Good', 'Needs Attention', 'Critical')")
    quality_score: float = Field(ge=0.0, le=100.0, description="Normalized health score from 0.0 to 100.0")
    total_checks: int = Field(ge=0, description="Total automated audit rules evaluated")
    error_count: int = Field(ge=0, description="Total error-level violations detected")
    warning_count: int = Field(ge=0, description="Total warning-level anomalies detected")
    info_count: int = Field(ge=0, description="Total informational observations detected")
    findings: list[DataQualityFindingItem] = Field(
        default_factory=list, description="Array of audit findings and remediation recommendations"
    )
