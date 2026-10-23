"""Subject listing and failure report schemas for EduQuery V3 API."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from app.api.schemas.student import ComponentScoreSchema


class CourseItem(BaseModel):
    """Academic course metadata."""
    model_config = ConfigDict(extra="forbid")

    code: str = Field(description="Unique course code identifier")
    name: str = Field(description="Full academic course title")
    kind: str = Field(default="theory", description="Modality ('theory' or 'practical')")
    credits: float | None = Field(default=None, description="Course credit value")
    components: list[str] = Field(default_factory=list, description="List of recognized component tags")
    enrolled_students_count: int | None = Field(default=None, ge=0, description="Total verified enrolled students")
    passed_students_count: int | None = Field(default=None, ge=0, description="Total confirmed passed students")
    failed_students_count: int | None = Field(default=None, ge=0, description="Total confirmed failed students")
    absent_students_count: int | None = Field(default=None, ge=0, description="Total distinct students with absent marks in this course")


class FailingStudentItem(BaseModel):
    """Detailed record of a student confirmed to have failed a course."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    name: str = Field(description="Student full name")
    roll_no: str | None = Field(default=None, description="Class roll number")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    division: str | None = Field(default=None, description="Class division")
    course_code: str = Field(description="Course code failed")
    course_name: str = Field(description="Full course title")
    total_marks: float | None = Field(default=None, description="Recorded course total marks")
    letter_grade: str | None = Field(default=None, description="Awarded course letter grade")
    flags: list[str] = Field(default_factory=list, description="Failure or warning flags")
    is_absent: bool = Field(default=False, description="Whether failure was due to absence")
    components: dict[str, ComponentScoreSchema] = Field(
        default_factory=dict, description="Atomized component marks for this course"
    )
    failure_reason: str | None = Field(
        default=None, description="Documented rule or reason for failure classification"
    )
    source_sheet: str | None = Field(default=None, description="Source worksheet name")
    source_row: int | None = Field(default=None, description="Source row number in worksheet")


class SubjectFailureResponse(BaseModel):
    """Comprehensive course failure diagnostic report."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Report status indicator ('success')")
    course_code: str = Field(description="Canonical course code")
    course_name: str = Field(description="Full course title")
    division_filter: str | None = Field(default=None, description="Division filter applied, if any")
    credits: float | None = Field(default=None, description="Course credits")
    kind: str | None = Field(default=None, description="Course kind ('theory' or 'practical')")
    total_enrolled: int = Field(ge=0, description="Denominator: total students enrolled in this course")
    confirmed_failures_count: int = Field(ge=0, description="Numerator: total confirmed failing students")
    passed_count: int = Field(ge=0, description="Total confirmed passing students")
    unresolved_count: int = Field(ge=0, description="Total students with unresolved results")
    failure_rate_percent: float = Field(ge=0.0, le=100.0, description="Percentage failure rate within enrolled cohort")
    limit: int = Field(default=50, ge=1, description="Page limit applied to failing_students")
    offset: int = Field(default=0, ge=0, description="Page offset applied to failing_students")
    failing_students: list[FailingStudentItem] = Field(
        default_factory=list, description="Paginated roster of confirmed failing students"
    )


class SubjectFailureSummaryItem(BaseModel):
    """Single course entry within curriculum failure summary."""
    model_config = ConfigDict(extra="forbid")

    course_code: str = Field(description="Unique course code identifier")
    course_name: str = Field(description="Full academic course title")
    credits: float | None = Field(default=None, description="Course credit value")
    kind: str | None = Field(default=None, description="Course kind ('theory' or 'practical')")
    division_filter: str | None = Field(default=None, description="Division filter applied, if any")
    total_enrolled: int = Field(ge=0, description="Total students enrolled in course")
    confirmed_failures_count: int = Field(ge=0, description="Total confirmed failing students")
    passed_count: int = Field(ge=0, description="Total confirmed passing students")
    unresolved_count: int = Field(ge=0, description="Total unresolved outcomes")
    failure_rate_percent: float = Field(ge=0.0, le=100.0, description="Calculated failure percentage")


class SubjectFailureSummaryResponse(BaseModel):
    """Curriculum-wide failure rate overview across all courses."""
    model_config = ConfigDict(extra="forbid")

    division_filter: str | None = Field(default=None, description="Division filter applied, if any")
    total_courses_evaluated: int = Field(ge=0, description="Total distinct courses in catalog")
    summary: list[SubjectFailureSummaryItem] = Field(
        default_factory=list, description="Array of courses sorted by failure count descending"
    )


class SubjectStudentItem(BaseModel):
    """Student record enrolled in a subject with status and component marks."""
    model_config = ConfigDict(extra="forbid")

    student_id: str = Field(description="Canonical student identifier")
    name: str = Field(description="Student full name")
    roll_no: str | None = Field(default=None, description="Class roll number")
    seat_no: str | None = Field(default=None, description="Examination seat number")
    division: str | None = Field(default=None, description="Class division")
    course_code: str = Field(description="Course code")
    course_name: str = Field(description="Full course title")
    total_marks: float | None = Field(default=None, description="Recorded course total marks")
    letter_grade: str | None = Field(default=None, description="Awarded course letter grade")
    status: str = Field(description="Pass/fail outcome: 'passed', 'failed', 'absent', or 'unresolved'")
    flags: list[str] = Field(default_factory=list, description="Associated flags")
    is_absent: bool = Field(default=False, description="Whether student was recorded absent")
    components: dict[str, ComponentScoreSchema] = Field(
        default_factory=dict, description="Atomized component marks for this course"
    )
    failure_reason: str | None = Field(
        default=None, description="Documented rule or reason for failure or status"
    )
    source_sheet: str | None = Field(default=None, description="Source worksheet name")
    source_row: int | None = Field(default=None, description="Source row number in worksheet")


class SubjectStudentsResponse(BaseModel):
    """Unified course report showing both passed and failed students together."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(default="success", description="Report status indicator ('success')")
    course_code: str = Field(description="Canonical course code")
    course_name: str = Field(description="Full course title")
    division_filter: str | None = Field(default=None, description="Division filter applied, if any")
    result_filter: str | None = Field(default=None, description="Result filter applied, if any")
    credits: float | None = Field(default=None, description="Course credits")
    kind: str | None = Field(default=None, description="Course kind ('theory' or 'practical')")
    total_enrolled: int = Field(ge=0, description="Total verified enrolled records")
    passed_count: int = Field(ge=0, description="Number of passed students")
    failed_count: int = Field(ge=0, description="Number of failed students")
    absent_count: int = Field(ge=0, description="Number of absent records")
    unresolved_count: int = Field(ge=0, description="Number of records excluded/unclassified from pass/fail")
    pass_percentage: float = Field(ge=0.0, le=100.0, description="Pass percentage calculated from eligible denominator")
    denominator_explanation: str = Field(
        default="Pass percentage is calculated as: Passed / (Passed + Failed) among classified eligible students.",
        description="Explanation of the denominator used for pass percentage calculation",
    )
    total: int = Field(ge=0, description="Total matching student records under active filters")
    limit: int = Field(default=50, ge=1, description="Page limit")
    offset: int = Field(default=0, ge=0, description="Page offset")
    students: list[SubjectStudentItem] = Field(
        default_factory=list, description="Paginated roster of enrolled students"
    )
