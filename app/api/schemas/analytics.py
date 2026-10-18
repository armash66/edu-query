"""Pydantic schemas for academic analysis workspace endpoints."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class OutcomeDistributionItem(BaseModel):
    """Academic outcome category frequency."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(description="Outcome status name (e.g. 'Passed', 'Failed', 'Unresolved')")
    count: int = Field(ge=0, description="Number of students with this outcome")
    percentage: float = Field(ge=0.0, le=100.0, description="Percentage of total cohort")


class TopFailingCourseItem(BaseModel):
    """Course with high confirmed failure headcount and rate."""
    model_config = ConfigDict(extra="forbid")

    course_code: str = Field(description="Unique course identifier")
    course_name: str = Field(description="Full course name")
    enrolled_count: int = Field(ge=0, description="Total verified enrolled students")
    failed_count: int = Field(ge=0, description="Confirmed failing students")
    failure_rate_percent: float = Field(ge=0.0, le=100.0, description="Failure percentage within course")


class DivisionMetricItem(BaseModel):
    """Academic performance breakdown for a class division."""
    model_config = ConfigDict(extra="forbid")

    division: str = Field(description="Division name or code (e.g. 'A', 'B')")
    student_count: int = Field(ge=0, description="Total enrolled students in division")
    passed_count: int = Field(ge=0, description="Total passing students")
    failed_count: int = Field(ge=0, description="Total failing students")
    unresolved_count: int = Field(ge=0, description="Total students with unresolved results")
    pass_rate_percent: float = Field(ge=0.0, le=100.0, description="Passing percentage in division")


class ActionableFindingItem(BaseModel):
    """Deterministic academic finding or alert requiring faculty attention."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique finding identifier")
    severity: Literal["critical", "warning", "info"] = Field(description="Finding severity level")
    title: str = Field(description="Short human-readable title")
    metric: str = Field(description="Highlighted metric or figure (e.g. '24% Fail Rate', '3 Students')")
    description: str = Field(description="Detailed explanation with context")
    drill_down_url: str = Field(description="URL to investigate underlying filtered records")
    count: int = Field(ge=0, description="Count of affected students or subjects")


class AnalyticsOverviewResponse(BaseModel):
    """Executive academic analysis overview across the active marksheet dataset."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Response status")
    total_students: int = Field(ge=0, description="Total enrolled cohort size")
    total_courses: int = Field(ge=0, description="Total curriculum courses")
    passed_students: int = Field(ge=0, description="Students with confirmed passing marksheet outcome")
    failed_students: int = Field(ge=0, description="Students with confirmed failing marksheet outcome")
    unresolved_students: int = Field(ge=0, description="Students with unresolved or incomplete outcomes")
    conflicting_students: int = Field(ge=0, description="Students with contradictory outcome indicators")
    quality_score: float = Field(ge=0.0, le=100.0, description="Deterministic marksheet data integrity score")
    outcome_distribution: list[OutcomeDistributionItem] = Field(
        default_factory=list, description="Distribution across academic outcome categories"
    )
    top_failing_courses: list[TopFailingCourseItem] = Field(
        default_factory=list, description="Ranked list of courses by confirmed failures"
    )
    division_summary: list[DivisionMetricItem] = Field(
        default_factory=list, description="Performance metrics by class division"
    )
    findings: list[ActionableFindingItem] = Field(
        default_factory=list, description="Deterministic key findings requiring faculty attention"
    )


class DivisionCoursePerformanceItem(BaseModel):
    """Subject performance isolated to a specific division."""
    model_config = ConfigDict(extra="forbid")

    course_code: str = Field(description="Course code")
    course_name: str = Field(description="Course title")
    division: str = Field(description="Division name")
    enrolled: int = Field(ge=0, description="Students enrolled in this course within this division")
    failed: int = Field(ge=0, description="Failing students in this division")
    failure_rate_percent: float = Field(ge=0.0, le=100.0, description="Division failure percentage")


class DivisionComparisonResponse(BaseModel):
    """Cross-division comparative academic metrics."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Response status")
    divisions: list[DivisionMetricItem] = Field(
        default_factory=list, description="Summary performance by division"
    )
    course_breakdown: list[DivisionCoursePerformanceItem] = Field(
        default_factory=list, description="Course-level failure breakdown across divisions"
    )


class MultiFailingStudentItem(BaseModel):
    """Student with confirmed failures across multiple distinct subjects."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Student identifier")
    name: str = Field(description="Student name")
    roll_no: str | None = Field(default=None, description="Roll number")
    seat_no: str | None = Field(default=None, description="Seat number")
    division: str | None = Field(default=None, description="Division")
    failed_courses_count: int = Field(ge=1, description="Number of courses failed")
    failed_courses: list[str] = Field(default_factory=list, description="List of failed course codes")


class CoFailingSubjectPair(BaseModel):
    """Pair of courses frequently failed together by the same students."""
    model_config = ConfigDict(extra="forbid")

    course_a: str = Field(description="First course code")
    course_b: str = Field(description="Second course code")
    co_fail_count: int = Field(ge=1, description="Number of students failing both courses")


class FailurePatternsResponse(BaseModel):
    """Multi-subject failure patterns and co-occurrence diagnostics."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Response status")
    failure_count_histogram: dict[str, int] = Field(
        default_factory=dict, description="Distribution of students failing N courses ('1_course', '2_courses', etc.)"
    )
    multi_failing_students: list[MultiFailingStudentItem] = Field(
        default_factory=list, description="Roster of students failing 2 or more subjects"
    )
    co_failing_pairs: list[CoFailingSubjectPair] = Field(
        default_factory=list, description="Subject pairs with frequent concurrent failures"
    )


class DistributionBucket(BaseModel):
    """Score range bucket for marks histogram."""
    model_config = ConfigDict(extra="forbid")

    label: str = Field(description="Score range label (e.g. '0-39', '40-49', '50-59')")
    min_val: float = Field(description="Minimum range value")
    max_val: float = Field(description="Maximum range value")
    count: int = Field(ge=0, description="Count of scores in this range")


class GradeFrequency(BaseModel):
    """Letter grade awarded frequency."""
    model_config = ConfigDict(extra="forbid")

    grade: str = Field(description="Letter grade (e.g. 'O', 'A+', 'A', 'B', 'C', 'D', 'P', 'F')")
    count: int = Field(ge=0, description="Award count")
    percentage: float = Field(ge=0.0, le=100.0, description="Percentage of evaluated cohort")


class DistributionsResponse(BaseModel):
    """Score histograms and grade distributions."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Response status")
    course_code: str | None = Field(default=None, description="Course filtered, or None for cohort total marks")
    total_records: int = Field(ge=0, description="Total marks evaluated")
    score_buckets: list[DistributionBucket] = Field(
        default_factory=list, description="Score histogram buckets"
    )
    grade_frequencies: list[GradeFrequency] = Field(
        default_factory=list, description="Grade letter frequencies"
    )


class AnalysisRegistryItem(BaseModel):
    """Metadata for a registered analytical capability."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(description="Unique capability identifier")
    name: str = Field(description="Human-readable title")
    category: str = Field(description="Analytical category (e.g. 'Performance', 'Comparison', 'Patterns')")
    description: str = Field(description="Analytical purpose")
    available: bool = Field(default=True, description="Whether active dataset has required data fields")
    drill_down_path: str = Field(description="Frontend drill-down path")
    supports_csv: bool = Field(default=True, description="Whether analysis can be exported as CSV")


class AnalysisRegistryResponse(BaseModel):
    """Registered analytical capabilities list."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Response status")
    analyses: list[AnalysisRegistryItem] = Field(default_factory=list, description="List of registered analyses")
