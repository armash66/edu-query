"""Common pagination, error, and disambiguation schemas for EduQuery V3 API."""
from __future__ import annotations

from typing import Any, Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(default=50, ge=1, le=100, description="Maximum number of items to return (1-100)")
    offset: int = Field(default=0, ge=0, description="Number of items to skip from beginning")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic wrapper for paginated collections."""
    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0, description="Total number of items matching filter criteria")
    limit: int = Field(ge=1, description="Page limit applied")
    offset: int = Field(ge=0, description="Page offset applied")
    items: list[T] = Field(default_factory=list, description="Array of items on current page")


class ErrorResponse(BaseModel):
    """Standard error response envelope."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="error", description="Response status ('error')")
    error_code: str = Field(description="Machine-readable error classification code")
    message: str = Field(description="Human-readable explanation of the error")
    details: list[str] = Field(default_factory=list, description="Optional diagnostic details")


class NotFoundErrorResponse(BaseModel):
    """Standard 404 response envelope for missing students or courses."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="not_found", description="Status code indicating entity was not found")
    error_code: str = Field(description="Machine-readable error code (e.g. 'STUDENT_NOT_FOUND')")
    query: str = Field(description="Original search query or identifier requested")
    message: str = Field(description="User-friendly message explaining the missing entity")


class CandidateSummary(BaseModel):
    """Disambiguation summary for a candidate student."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    name: str = Field(description="Student full name")
    seat_no: str | None = Field(default=None, description="Seat number if recorded")
    roll_no: str | None = Field(default=None, description="Roll number if recorded")
    division: str | None = Field(default=None, description="Class division if recorded")


class AmbiguousStudentResponse(BaseModel):
    """Standard 409 response envelope when student query matches multiple candidates."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="ambiguous", description="Status code indicating ambiguous query")
    error_code: str = Field(default="AMBIGUOUS_STUDENT_QUERY", description="Classification error code")
    query: str = Field(description="Original query that matched multiple candidates")
    message: str = Field(description="Explanation that disambiguation is required")
    candidates: list[CandidateSummary] = Field(description="List of matching candidate students")


class AmbiguousCourseResponse(BaseModel):
    """Standard 409 response envelope when course query matches multiple distinct courses."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="ambiguous", description="Status code indicating ambiguous query")
    error_code: str = Field(default="AMBIGUOUS_COURSE_QUERY", description="Classification error code")
    query: str = Field(description="Original course query or name")
    message: str = Field(description="Explanation that disambiguation is required")
    candidates: list[dict[str, Any]] = Field(description="List of matching course candidates")
