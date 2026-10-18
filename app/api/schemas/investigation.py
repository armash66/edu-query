"""Pydantic schemas for the Interactive Investigation Engine."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

from app.api.schemas.student import StudentSummaryItem

InvestigationField = Literal[
    "student_id",
    "name",
    "seat_no",
    "roll_no",
    "division",
    "result",
    "course_code",
    "multi_fails",
    "failed_subject_count",
    "total_marks",
    "sgpi",
    "cgpa",
    "query",
]

InvestigationOperator = Literal[
    "eq",
    "neq",
    "contains",
    "gte",
    "lte",
    "between",
    "in",
]

InvestigationLogic = Literal["AND", "OR"]


class InvestigationCondition(BaseModel):
    """Single filter condition within an investigation group."""

    field: InvestigationField = Field(..., description="Target field to evaluate")
    operator: InvestigationOperator = Field(..., description="Comparison operator")
    value: Any = Field(..., description="Value to match against (scalar, range, or list)")


class InvestigationFilterGroup(BaseModel):
    """Group of conditions combined with boolean logic (AND/OR)."""

    logic: InvestigationLogic = Field(default="AND", description="Boolean combiner")
    conditions: list[InvestigationCondition] = Field(
        default_factory=list,
        max_length=10,
        description="List of filter conditions (max 10)",
    )


class InvestigationQueryRequest(BaseModel):
    """Complete investigation query request payload."""

    group: InvestigationFilterGroup | None = Field(
        default=None,
        description="Filter condition group",
    )
    search: str | None = Field(
        default=None,
        description="Free-text search across student identifiers and name",
    )
    sort_by: Literal[
        "student_id",
        "name",
        "roll_no",
        "seat_no",
        "division",
        "total_marks",
        "sgpi",
        "cgpa",
        "result",
    ] | None = Field(
        default="division",
        description="Column to sort by",
    )
    sort_dir: Literal["asc", "desc"] = Field(
        default="asc",
        description="Sort direction",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=200,
        description="Page item limit (1 to 200)",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Pagination offset",
    )


class InvestigationQueryResponse(BaseModel):
    """Response containing paginated investigation results and context."""

    total: int = Field(..., description="Total matching student records")
    cohort_total: int = Field(..., description="Total students in cohort")
    limit: int = Field(..., description="Page limit")
    offset: int = Field(..., description="Page offset")
    items: list[StudentSummaryItem] = Field(..., description="Matching student summaries")
    active_explanation: str = Field(..., description="Human-readable explanation of active conditions")


class FieldCapability(BaseModel):
    """Specification of an allowed investigation field."""

    field: str
    label: str
    data_type: Literal["string", "number", "boolean", "choice"]
    supported_operators: list[InvestigationOperator]
    choices: list[str] | None = None
    min_value: float | None = None
    max_value: float | None = None


class InvestigationCapabilitiesResponse(BaseModel):
    """Registry of supported investigation fields, operators, and options."""

    status: str = "success"
    fields: list[FieldCapability]
    max_conditions: int = 10
    supported_logic: list[InvestigationLogic] = ["AND", "OR"]
