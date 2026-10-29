"""Pydantic schemas for additive Overview summary endpoint."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class OverviewDatasetMeta(BaseModel):
    """Metadata regarding active marksheet dataset and session lifecycle."""

    id: str = Field(..., description="Unique dataset or session identifier")
    name: str = Field(..., description="Human-readable dataset name")
    status_label: str = Field(..., description="Plain status label ('Saved dataset' or 'Temporary session')")
    is_temporary: bool = Field(default=False, description="Whether active dataset is in a temporary session")
    expires_in_minutes: int | None = Field(default=None, description="Minutes until session expires if temporary")


class OverviewKpis(BaseModel):
    """Core academic cohort KPIs."""

    total_students: int = Field(..., description="Total enrolled cohort students")
    total_courses: int = Field(..., description="Total curriculum courses")
    passed_students: int = Field(..., description="Students with confirmed passing status")
    failed_students: int = Field(..., description="Students with confirmed failing status")
    absent_students: int = Field(..., description="Students absent across all evaluations")
    pass_rate_percent: float = Field(..., description="Cohort pass rate percentage (passed / total)")
    divisions_count: int = Field(..., description="Total class divisions")
    needs_attention_count: int = Field(..., description="Distinct students flagged for review")
    sgpi_average: float | None = Field(default=None, description="Arithmetic mean SGPI for passed students")
    sgpi_median: float | None = Field(default=None, description="Median SGPI for passed students")
    students_with_sgpi: int = Field(..., description="Number of students with valid SGPI")
    students_without_sgpi: int = Field(..., description="Number of students excluded from SGPI (failed/absent)")


class OverviewFlaggedStudent(BaseModel):
    """Flagged student item for the Needs Attention card."""

    student_id: str = Field(..., description="Student seat/roll or identifier")
    student_name: str = Field(..., description="Student full name")
    severity: Literal["info", "warning", "critical"] = Field(..., description="Anomaly severity level")
    reason: str = Field(..., description="One-line plain-language explanation of why student was flagged")
    finding_id: str = Field(..., description="Unique anomaly finding identifier")
    record_link: str = Field(..., description="Link to inspect student record")
    evidence: str | None = Field(default=None, description="Verifiable facts and data")
    recommended_action: str | None = Field(default=None, description="Recommended faculty review action")


class OutcomeCountPercent(BaseModel):
    """Count and percentage representation for academic outcomes."""

    count: int = Field(..., description="Number of students")
    percentage: float = Field(..., description="Percentage of cohort")


class DivisionResultRow(BaseModel):
    """Division-level enrollment and passing performance."""

    division: str = Field(..., description="Division name, e.g. 'Division A'")
    division_code: str = Field(..., description="Raw division code, e.g. 'A'")
    passed: int = Field(..., description="Students passed in this division")
    enrolled: int = Field(..., description="Total students enrolled in this division")
    pass_rate_percent: float = Field(..., description="Pass rate within this division (passed / enrolled)")


class OverviewResults(BaseModel):
    """Results card breakdown: outcome counts and per-division breakdown."""

    passed: OutcomeCountPercent
    failed: OutcomeCountPercent
    absent: OutcomeCountPercent
    divisions: list[DivisionResultRow] = Field(default_factory=list)


class SgpiHistogramBin(BaseModel):
    """Single bin for SGPI score distribution histogram."""

    bin_label: str = Field(..., description="Range label, e.g. '8-9'")
    min_val: float = Field(..., description="Inclusive lower bound")
    max_val: float = Field(..., description="Upper bound")
    count: int = Field(..., description="Number of students in this bin")
    percentage: float = Field(..., description="Percentage of students with SGPI")


class OverviewSgpiDistribution(BaseModel):
    """SGPI histogram distribution and summary statistics."""

    average: float | None = Field(default=None, description="Mean SGPI")
    median: float | None = Field(default=None, description="Median SGPI")
    students_with_sgpi: int = Field(..., description="Count of students with valid SGPI")
    students_without_sgpi: int = Field(..., description="Count of students without SGPI (failed)")
    bins: list[SgpiHistogramBin] = Field(default_factory=list)


class OverviewHardestSubject(BaseModel):
    """Single course entry for Hardest Subjects ranking."""

    course_code: str = Field(..., description="Course code, e.g. 'PCEC12T'")
    course_title: str = Field(..., description="Course title")
    failed_count: int = Field(..., description="Students who failed this course")
    enrolled_count: int = Field(..., description="Total students enrolled")
    failure_rate_percent: float = Field(..., description="Failure rate percentage")
    tier: Literal["neutral", "amber", "red"] = Field(
        ...,
        description="Color tier based on failure rate: <5% neutral, 5-15% amber, >15% red",
    )


class OverviewHighlight(BaseModel):
    """Deterministic server-computed insight sentence."""

    id: str = Field(..., description="Unique insight key")
    text: str = Field(..., description="Deterministic plain language insight sentence")
    url: str = Field(..., description="Target drill-down URL")


class OverviewTopperStudent(BaseModel):
    """Top-performing student by CGPA."""

    rank: int = Field(..., description="Cohort rank with tie handling")
    student_id: str = Field(..., description="Student identifier")
    name: str = Field(..., description="Student name")
    division: str = Field(..., description="Division code")
    cgpa: float = Field(..., description="Cumulative GPA score")
    sgpi: float | None = Field(default=None, description="Semester SGPI score")


class ClassDistributionItem(BaseModel):
    """Student count across university grade classification bands."""

    band: str = Field(..., description="University classification band")
    count: int = Field(..., description="Number of students in this band")
    percentage: float = Field(..., description="Percentage of cohort")
    min_cgpa: float | None = Field(default=None, description="Minimum CGPA boundary")


class OverviewSummaryResponse(BaseModel):
    """Unified payload for the Overview page."""

    dataset: OverviewDatasetMeta
    kpis: OverviewKpis
    needs_attention: list[OverviewFlaggedStudent] = Field(default_factory=list)
    results: OverviewResults
    sgpi_distribution: OverviewSgpiDistribution
    hardest_subjects: list[OverviewHardestSubject] = Field(default_factory=list)
    highlights: list[OverviewHighlight] = Field(default_factory=list)
    toppers: list[OverviewTopperStudent] = Field(default_factory=list)
    class_distribution: list[ClassDistributionItem] = Field(default_factory=list)
    level_breakdown: list[DivisionResultRow] = Field(default_factory=list)

