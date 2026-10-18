"""Pydantic schemas for workbook upload, preview, and confirmation workflow."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

from app.api.schemas.data_quality import DataQualityFindingItem, HealthStatusLevel

ImportState = Literal[
    "uploaded",
    "validating",
    "preview_ready",
    "validation_failed",
    "confirmed",
    "activated",
    "expired",
    "failed",
]


class SafeWorkbookMeta(BaseModel):
    """Sanitized metadata about the uploaded workbook without exposing filesystem paths."""
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(description="Sanitized display filename of uploaded workbook")
    file_size_bytes: int = Field(ge=0, description="Total size in bytes")
    sha256: str = Field(description="Cryptographic SHA-256 hash of workbook content")
    content_type: str = Field(description="MIME type or detected format")


class ElectiveCourseInfo(BaseModel):
    """Enrolled count breakdown for an elective course within a group."""
    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Course code identifier")
    name: str = Field(description="Course full title")
    enrolled_count: int = Field(ge=0, description="Number of students enrolled in this alternative")


class ElectiveGroupSummary(BaseModel):
    """Discovered elective offering group (e.g. MDM choices)."""
    model_config = ConfigDict(extra="forbid")

    group_id: str = Field(description="Elective group identifier")
    group_name: str = Field(description="Display title of elective group")
    course_codes: list[str] = Field(description="Course codes comprising this elective group")
    courses: list[ElectiveCourseInfo] = Field(default_factory=list, description="Course-level breakdown")
    selection_mode: str = Field(default="single_choice", description="Selection rule (e.g. single_choice)")
    total_students: int = Field(ge=0, description="Total students in cohort")
    assigned_count: int = Field(ge=0, description="Students with a valid single elective selected")
    unassigned_count: int = Field(ge=0, description="Students with no elective choice recorded")
    multi_assigned_count: int = Field(ge=0, description="Students with ambiguous multiple selections")
    is_mutually_exclusive: bool = Field(description="Whether elective options are strictly mutually exclusive")
    status: str = Field(description="Validation status ('valid', 'ambiguous', 'incomplete')")
    ambiguities: list[str] = Field(default_factory=list, description="Diagnostic messages for unassigned or conflicting choices")


class LayoutSummary(BaseModel):
    """Summary of discovered worksheet layout structure."""
    model_config = ConfigDict(extra="forbid")

    strategy: str = Field(description="Primary detected layout pattern (e.g. paired_row, single_row)")
    sheets_inspected: list[str] = Field(default_factory=list, description="All worksheet names examined")
    sheets_accepted: list[str] = Field(default_factory=list, description="Worksheets successfully parsed")
    sheets_skipped: list[dict[str, str]] = Field(default_factory=list, description="Sheets skipped with diagnostic reasons")
    elective_groups: list[ElectiveGroupSummary] = Field(default_factory=list, description="Discovered elective course groups")


class DataQualityPreview(BaseModel):
    """Integrity audit summary for candidate marksheet."""
    model_config = ConfigDict(extra="forbid")

    health_status: HealthStatusLevel = Field(description="Overall health evaluation ('Good', 'Needs Attention', 'Critical')")
    quality_score: float = Field(ge=0.0, le=100.0, description="Audit penalty score from 0.0 to 100.0")
    total_checks: int = Field(ge=0, description="Total automated audit checks evaluated")
    error_count: int = Field(ge=0, description="Count of blocking error-level findings")
    warning_count: int = Field(ge=0, description="Count of non-blocking warning-level findings")
    info_count: int = Field(ge=0, description="Count of informational findings")
    findings: list[DataQualityFindingItem] = Field(default_factory=list, description="Safe findings without student PII")


class ImportPreviewResponse(BaseModel):
    """Safe, detailed preview of an uploaded candidate marksheet."""
    model_config = ConfigDict(extra="forbid")

    import_id: str = Field(description="Unique opaque import session identifier")
    state: ImportState = Field(description="Current import lifecycle state")
    created_at: str = Field(description="ISO 8601 session creation timestamp")
    expires_at: str = Field(description="ISO 8601 session expiration timestamp")
    workbook: SafeWorkbookMeta = Field(description="Sanitized workbook properties")
    layout: LayoutSummary = Field(description="Multi-sheet layout discovery summary")
    students_count: int = Field(ge=0, description="Discovered student count in candidate dataset")
    courses_count: int = Field(ge=0, description="Discovered course count in candidate dataset")
    scores_count: int = Field(ge=0, description="Discovered atomized component score count")
    enrollment_count: int = Field(ge=0, description="Verified student-course enrollment pairs")
    reconciliation_count: int = Field(ge=0, description="Reconciled course-level mark records")
    data_quality: DataQualityPreview = Field(description="Pre-activation academic data-quality audit")
    can_confirm: bool = Field(description="Whether candidate has zero blocking errors and is ready for activation")
    blocking_errors: list[str] = Field(default_factory=list, description="Reasons preventing confirmation, if any")
    active_dataset_changed: bool = Field(default=False, description="Invariant: preview never mutates active dataset")


class ImportConfirmRequest(BaseModel):
    """Request payload to confirm and activate a candidate dataset."""
    model_config = ConfigDict(extra="forbid")

    import_id: str = Field(
        min_length=8,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Import session identifier from preview step",
    )


class ImportConfirmResponse(BaseModel):
    """Result of dataset confirmation and atomic activation."""
    model_config = ConfigDict(extra="forbid")

    import_id: str = Field(description="Confirmed import session identifier")
    state: ImportState = Field(description="Activated state ('activated')")
    activated_at: str = Field(description="ISO 8601 activation timestamp")
    students_count: int = Field(ge=0, description="Active student count")
    courses_count: int = Field(ge=0, description="Active course count")
    active_dataset_id: str = Field(description="Authoritative active dataset version identifier")
    message: str = Field(description="User-facing confirmation message")


class DatasetVersionItem(BaseModel):
    """Metadata summary of a stored persistent dataset version."""
    model_config = ConfigDict(extra="forbid")

    dataset_id: str = Field(description="Unique dataset version identifier")
    is_active: bool = Field(description="Whether this dataset version is currently active")
    created_at: str = Field(description="ISO 8601 file modification or creation timestamp")
    students_count: int = Field(ge=0, description="Number of students in dataset")
    courses_count: int = Field(ge=0, description="Number of courses in dataset")
    size_bytes: int = Field(ge=0, description="Database file size in bytes")


class DatasetVersionsResponse(BaseModel):
    """List of all available persistent dataset versions for audit and rollback."""
    model_config = ConfigDict(extra="forbid")

    active_dataset_id: str | None = Field(default=None, description="Currently active dataset identifier")
    total_versions: int = Field(ge=0, description="Count of stored dataset versions")
    versions: list[DatasetVersionItem] = Field(default_factory=list, description="Available version records")


class RollbackRequest(BaseModel):
    """Request payload to safely roll back to a previously validated dataset version."""
    model_config = ConfigDict(extra="forbid")

    dataset_id: str = Field(
        min_length=8,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Dataset version identifier to restore as active",
    )


class RollbackResponse(BaseModel):
    """Outcome of dataset rollback operation."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Rollback status indicator")
    previous_dataset_id: str | None = Field(default=None, description="Previously active dataset identifier")
    active_dataset_id: str = Field(description="Newly activated dataset identifier")
    students_count: int = Field(ge=0, description="Restored dataset student count")
    courses_count: int = Field(ge=0, description="Restored dataset course count")
    activated_at: str = Field(description="ISO 8601 rollback activation timestamp")
    message: str = Field(description="User-facing confirmation message")

