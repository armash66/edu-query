"""Student roster and breakdown response schemas for EduQuery V3 API."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

ComponentState = Literal["marked", "not_enrolled", "uncalculated", "flagged", "unparsed"]
SubjectResult = Literal["passed", "failed", "unresolved"]


class StudentSummaryItem(BaseModel):
    """Compact summary of student demographic and marksheet metrics."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    roll_no: str | None = Field(default=None, description="Class roll number")
    name: str = Field(description="Student full name")
    division: str | None = Field(default=None, description="Class division")
    level: str | None = Field(default=None, description="Degree or academic level")
    total_marks: float | None = Field(default=None, description="Printed total marks across marksheet")
    overall_result: str | None = Field(default=None, description="Marksheet recorded overall outcome")
    sgpi: float | None = Field(default=None, description="Semester Grade Performance Index")
    cgpa: float | None = Field(default=None, description="Cumulative Grade Point Average")
    passed_subject_count: int = Field(default=0, ge=0, description="Count of passed distinct subjects")
    failed_subject_count: int = Field(default=0, ge=0, description="Count of confirmed failed distinct subjects")
    absent_subject_count: int = Field(default=0, ge=0, description="Count of distinct subjects with verified absent marks")
    unresolved_subject_count: int = Field(default=0, ge=0, description="Count of unresolved distinct subjects")
    failed_courses: list[str] = Field(default_factory=list, description="Course codes where student failed")
    absent_courses: list[str] = Field(default_factory=list, description="Course codes where student was absent")


class AbsentStudentItem(BaseModel):
    """Student examination instance record with verified absent marker."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    roll_no: str | None = Field(default=None, description="Class roll number")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    name: str = Field(description="Student full name")
    division: str | None = Field(default=None, description="Class division")
    course_code: str = Field(description="Subject code")
    course_name: str = Field(description="Subject title")
    component: str = Field(description="Examination component code (e.g. ESE, MSE, IA)")
    raw_text: str | None = Field(default=None, description="Raw absent marker from marksheet (e.g. AB, A)")
    marks: float | None = Field(default=None, description="Numeric marks if recorded")
    total_marks: float | None = Field(default=None, description="Student total marks across marksheet")
    overall_result: str | None = Field(default=None, description="Marksheet recorded overall student result")
    passed_subject_count: int = Field(default=0, ge=0, description="Count of distinct passed subjects")
    failed_subject_count: int = Field(default=0, ge=0, description="Count of distinct failed subjects")
    absent_subject_count: int = Field(default=0, ge=0, description="Count of distinct subjects with absent marks")
    source_sheet: str | None = Field(default=None, description="Source worksheet")
    source_row: int | None = Field(default=None, description="Source row in worksheet")


class ComponentScoreSchema(BaseModel):
    """Atomized score for a specific course component (e.g. ESE, IA, PR, OR)."""
    model_config = ConfigDict(extra="forbid")

    component: str = Field(description="Component identifier code (e.g. 'ESE', 'IA')")
    marks: float | None = Field(default=None, description="Numeric marks awarded (null if absent or uncalculated)")
    flag: str | None = Field(default=None, description="Component-level flag (e.g. 'F', '@', '*')")
    state: ComponentState = Field(description="Component evaluation state")
    raw_text: str | None = Field(default=None, description="Exact cell text recorded in original marksheet")


class StudentSubjectBreakdownSchema(BaseModel):
    """Subject performance breakdown for a single course."""
    model_config = ConfigDict(extra="forbid")

    course_code: str = Field(description="Unique course code identifier")
    course_name: str = Field(description="Full academic course title")
    kind: str = Field(description="Course modality ('theory' or 'practical')")
    credits: float | None = Field(default=None, description="Assigned course credits")
    components: dict[str, ComponentScoreSchema] = Field(
        default_factory=dict, description="Dictionary of atomized component scores keyed by component name"
    )
    total_marks: float | None = Field(default=None, description="Printed course total marks from marksheet")
    computed_marks_sum: float | None = Field(default=None, description="Sum of atomized component values")
    total_match: bool | None = Field(default=None, description="Whether printed total matches computed sum")
    letter_grade: str | None = Field(default=None, description="Awarded course letter grade")
    recorded_result: SubjectResult = Field(description="Classified outcome ('passed', 'failed', 'unresolved')")
    flags: list[str] = Field(default_factory=list, description="All flags associated with course components")
    is_absent: bool = Field(default=False, description="Whether student was recorded absent in any component")
    has_missing_marks: bool = Field(default=False, description="Whether any enrolled component has missing marks")
    has_uncalculated_total: bool = Field(default=False, description="Whether total marks were not calculable")
    classification_reason: str | None = Field(
        default=None, description="Documented rule or reason for outcome classification"
    )
    source_sheet: str | None = Field(default=None, description="Source worksheet name")
    source_row: int | None = Field(default=None, description="Source row number in worksheet")


class StudentIdentitySchema(BaseModel):
    """Complete demographic profile of a student."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    roll_no: str | None = Field(default=None, description="Class roll number")
    name: str = Field(description="Student full name")
    email: str | None = Field(default=None, description="Student email if recorded")
    division: str | None = Field(default=None, description="Class division")
    level: str | None = Field(default=None, description="Degree or academic level")
    overall_result: str | None = Field(default=None, description="Marksheet recorded overall outcome")
    total_marks: float | None = Field(default=None, description="Printed marksheet total marks")
    total_credits: float | None = Field(default=None, description="Total earned or attempted credits")
    sgpi: float | None = Field(default=None, description="Semester Grade Performance Index")
    cgpa: float | None = Field(default=None, description="Cumulative Grade Point Average")
    source_sheet: str | None = Field(default=None, description="Source worksheet name")
    source_row: int | None = Field(default=None, description="Source row number in worksheet")


class StudentBreakdownResponse(BaseModel):
    """Comprehensive single-student academic performance report."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Report status indicator ('success')")
    query: str = Field(description="Original search query or identifier requested")
    student: StudentIdentitySchema = Field(description="Resolved student demographic identity")
    total_enrolled: int = Field(ge=0, description="Total courses student is enrolled in")
    passed_count: int = Field(ge=0, description="Count of confirmed passed subjects")
    failed_count: int = Field(ge=0, description="Count of confirmed failed subjects")
    unresolved_count: int = Field(ge=0, description="Count of unresolved subject outcomes")
    subjects: list[StudentSubjectBreakdownSchema] = Field(
        default_factory=list, description="List of per-subject performance breakdowns"
    )


class EarlyWarningBacktestMetrics(BaseModel):
    """Honest documented backtest performance metrics of early warning heuristic."""

    precision_percent: float = Field(..., description="Precision percentage on test dataset")
    recall_percent: float = Field(..., description="Recall percentage on test dataset")
    f1_percent: float = Field(..., description="F1-score percentage")
    dataset_name: str = Field(..., description="Benchmark dataset name")
    actual_failures_count: int = Field(..., description="Actual failures in dataset")
    correctly_flagged_count: int = Field(..., description="True positives correctly flagged before ESE")


class EarlyWarningStudentItem(BaseModel):
    """Student identified as at-risk based on continuous internal evaluation marks."""

    student_id: str
    seat_no: str
    roll_no: str | None = None
    name: str
    division: str
    risk_level: Literal["critical", "moderate"]
    avg_mse: float | None = None
    avg_isa: float | None = None
    internal_absences_count: int = 0
    reasons: list[str] = Field(default_factory=list, description="Plain-language risk explanations")


class EarlyWarningResponse(BaseModel):
    """Response containing pre-ESE at-risk early warning list and backtest metrics."""

    total_at_risk: int
    critical_count: int
    moderate_count: int
    backtest: EarlyWarningBacktestMetrics
    students: list[EarlyWarningStudentItem]


class SubjectTopperItem(BaseModel):
    """Division-level highest scorer for a specific course."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Student identifier")
    name: str = Field(description="Student full name")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    roll_no: str | None = Field(default=None, description="Class roll number")
    division: str = Field(description="Division/cohort batch")
    course_code: str = Field(description="Subject code")
    course_name: str | None = Field(default=None, description="Descriptive subject title")
    score: float = Field(description="Final total marks achieved in subject")
    grade: str | None = Field(default=None, description="Letter grade awarded")


class SubjectToppersResponse(BaseModel):
    """Collection of subject toppers grouped by course and division."""
    model_config = ConfigDict(extra="forbid")

    total: int = Field(description="Total subject topper recognitions")
    items: list[SubjectTopperItem] = Field(default_factory=list, description="List of subject topper awards")
