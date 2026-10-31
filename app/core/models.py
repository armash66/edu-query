"""Domain models and data structures for EduQuery V3."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Student:
    student_id: str
    seat_no: str | None = None
    roll_no: str | None = None
    name: str = ""
    email: str | None = None
    division: str | None = None
    level: str | None = None
    total_marks: float | None = None
    total_credits: float | None = None
    result: str | None = None
    sgpi: float | None = None
    cgpa: float | None = None
    source_sheet: str = ""
    source_row: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CourseComponent:
    component: str
    column: int
    raw_label: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CourseBlock:
    code: str
    name: str
    kind: str
    start_col: int
    end_col: int
    components: list[dict[str, Any]]
    credits_col: int | None
    total_col: int | None
    grade_col: int | None
    header_credits: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Course:
    code: str
    name: str
    kind: str = "theory"
    paired_code: str | None = None
    credits: float | None = None
    credits_raw: str | None = None
    components: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Score:
    student_id: str
    course_code: str
    component: str
    value: float | None = None
    flag: str | None = None
    state: str = "marked"  # "marked", "not_enrolled", "uncalculated", "flagged", "unparsed"
    raw_text: str | None = None
    grade: str | None = None
    source_sheet: str = ""
    source_row: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DataQualityFinding:
    check_id: str
    severity: str  # "error", "warning", "info"
    title: str
    count: int
    problem: str
    impact: str
    recommended_action: str
    details: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class DataQualityReport:
    session_id: str
    total_checks: int
    error_count: int
    warning_count: int
    info_count: int
    quality_score: float  # 0 to 100
    health_status: str  # "Good", "Needs Attention", "Critical"
    findings: list[DataQualityFinding] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "total_checks": self.total_checks,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "info_count": self.info_count,
            "quality_score": round(self.quality_score, 1),
            "health_status": self.health_status,
            "findings": [f.to_dict() for f in self.findings],
        }


@dataclass
class IngestionReport:
    input_path: str
    database_path: str
    fingerprint: str
    sheets_inspected: list[str]
    sheets_accepted: list[str]
    sheets_skipped: list[dict[str, str]]
    students_count: int
    courses_count: int
    scores_count: int
    enrollment_count: int
    reconciliation_count: int
    unparsed_scores_count: int
    flag_counts: dict[str, int]
    layout: dict[str, Any]
    layouts_by_sheet: dict[str, Any]
    data_quality: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
