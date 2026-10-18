"""Isolated unit tests for EduQuery V3 Pydantic v2 API schemas."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.schemas.common import (
    AmbiguousCourseResponse,
    AmbiguousStudentResponse,
    CandidateSummary,
    ErrorResponse,
    NotFoundErrorResponse,
    PaginatedResponse,
    PaginationParams,
)
from app.api.schemas.data_quality import (
    DataQualityFindingItem,
    DataQualityResponse,
)
from app.api.schemas.health import (
    DatabaseHealthInfo,
    HealthResponse,
)
from app.api.schemas.student import (
    ComponentScoreSchema,
    StudentBreakdownResponse,
    StudentIdentitySchema,
    StudentSubjectBreakdownSchema,
    StudentSummaryItem,
)
from app.api.schemas.subject import (
    CourseItem,
    FailingStudentItem,
    SubjectFailureResponse,
    SubjectFailureSummaryItem,
    SubjectFailureSummaryResponse,
)


# 1. Health Response Tests
def test_health_response_serialization():
    health = HealthResponse(
        status="healthy",
        version="3.0.0",
        database=DatabaseHealthInfo(
            mode="read_only_file",
            connected=True,
            students_count=145,
            courses_count=27,
        ),
    )
    data = health.model_dump()
    assert data["status"] == "healthy"
    assert data["version"] == "3.0.0"
    assert data["database"]["connected"] is True
    assert data["database"]["students_count"] == 145
    assert data["database"]["courses_count"] == 27


def test_health_response_rejects_extra_fields():
    with pytest.raises(ValidationError):
        HealthResponse(
            status="healthy",
            version="3.0.0",
            database=DatabaseHealthInfo(mode="in_memory", connected=True),
            unexpected_field="disallowed",  # Extra field forbidden by ConfigDict
        )


# 2. Pagination & Common Envelope Tests
def test_pagination_params_defaults_and_bounds():
    # Defaults
    p_def = PaginationParams()
    assert p_def.limit == 50
    assert p_def.offset == 0

    # Custom valid
    p_custom = PaginationParams(limit=25, offset=100)
    assert p_custom.limit == 25
    assert p_custom.offset == 100

    # Invalid: limit < 1
    with pytest.raises(ValidationError):
        PaginationParams(limit=0)

    # Invalid: limit > 100
    with pytest.raises(ValidationError):
        PaginationParams(limit=101)

    # Invalid: offset < 0
    with pytest.raises(ValidationError):
        PaginationParams(offset=-1)


def test_generic_paginated_response():
    item = StudentSummaryItem(
        student_id="STU_001",
        name="Test Student",
        division="A",
        overall_result="PASSES",
    )
    resp = PaginatedResponse[StudentSummaryItem](
        total=1,
        limit=50,
        offset=0,
        items=[item],
    )
    assert resp.total == 1
    assert len(resp.items) == 1
    assert resp.items[0].student_id == "STU_001"


# 3. Error Envelope Tests
def test_error_response_serialization():
    err = ErrorResponse(
        error_code="INVALID_FILTER",
        message="Division filter not recognized",
        details=["Allowed divisions: A, B"],
    )
    d = err.model_dump()
    assert d["status"] == "error"
    assert d["error_code"] == "INVALID_FILTER"
    assert len(d["details"]) == 1


def test_not_found_response_serialization():
    nf = NotFoundErrorResponse(
        error_code="STUDENT_NOT_FOUND",
        query="STU_999",
        message="Student with ID STU_999 not found",
    )
    d = nf.model_dump()
    assert d["status"] == "not_found"
    assert d["query"] == "STU_999"


def test_ambiguous_student_response_serialization():
    amb = AmbiguousStudentResponse(
        query="Smith",
        message="Multiple candidates match 'Smith'",
        candidates=[
            CandidateSummary(student_id="STU_01", name="Alice Smith", division="A"),
            CandidateSummary(student_id="STU_02", name="Bob Smith", division="B"),
        ],
    )
    d = amb.model_dump()
    assert d["status"] == "ambiguous"
    assert d["error_code"] == "AMBIGUOUS_STUDENT_QUERY"
    assert len(d["candidates"]) == 2
    assert d["candidates"][0]["student_id"] == "STU_01"


# 4. Student Breakdown & Nullable Tests
def test_student_breakdown_serialization_full():
    comp = ComponentScoreSchema(
        component="ESE",
        marks=45.0,
        flag=None,
        state="marked",
        raw_text="45",
    )
    subj = StudentSubjectBreakdownSchema(
        course_code="CS101",
        course_name="Data Structures",
        kind="theory",
        credits=4.0,
        components={"ESE": comp},
        total_marks=45.0,
        computed_marks_sum=45.0,
        total_match=True,
        letter_grade="A",
        recorded_result="passed",
        flags=[],
    )
    identity = StudentIdentitySchema(
        student_id="STU_100",
        seat_no="SEAT-01",
        roll_no="1",
        name="Aarav Sharma",
        email=None,
        division="A",
        level="UG",
        overall_result="PASSES",
        total_marks=45.0,
        total_credits=4.0,
        sgpi=8.5,
        cgpa=8.2,
    )
    report = StudentBreakdownResponse(
        query="STU_100",
        student=identity,
        total_enrolled=1,
        passed_count=1,
        failed_count=0,
        unresolved_count=0,
        subjects=[subj],
    )
    d = report.model_dump()
    assert d["status"] == "success"
    assert d["student"]["name"] == "Aarav Sharma"
    assert d["total_enrolled"] == 1
    assert d["passed_count"] == 1
    assert len(d["subjects"]) == 1
    assert d["subjects"][0]["course_code"] == "CS101"


def test_student_breakdown_nullable_handling():
    # Nullable marks, absent state, uncalculated totals
    comp = ComponentScoreSchema(
        component="PR",
        marks=None,
        flag="AB",
        state="flagged",
        raw_text="AB",
    )
    subj = StudentSubjectBreakdownSchema(
        course_code="CS102",
        course_name="Computer Networks",
        kind="practical",
        credits=None,
        components={"PR": comp},
        total_marks=None,
        computed_marks_sum=None,
        total_match=None,
        letter_grade="AB",
        recorded_result="unresolved",
        flags=["AB"],
        is_absent=True,
        has_missing_marks=True,
        has_uncalculated_total=True,
    )
    identity = StudentIdentitySchema(
        student_id="STU_UNRES",
        seat_no=None,
        roll_no=None,
        name="Absent Student",
        email=None,
        division=None,
        level=None,
        overall_result=None,
        total_marks=None,
        total_credits=None,
        sgpi=None,
        cgpa=None,
    )
    report = StudentBreakdownResponse(
        query="STU_UNRES",
        student=identity,
        total_enrolled=1,
        passed_count=0,
        failed_count=0,
        unresolved_count=1,
        subjects=[subj],
    )
    d = report.model_dump()
    assert d["student"]["seat_no"] is None
    assert d["subjects"][0]["total_marks"] is None
    assert d["subjects"][0]["components"]["PR"]["marks"] is None
    assert d["subjects"][0]["is_absent"] is True
    assert d["unresolved_count"] == 1


# 5. Component States & Subject Result Literal Validations
def test_component_states_literal_validation():
    # Valid states
    for valid_state in ["marked", "not_enrolled", "uncalculated", "flagged", "unparsed"]:
        c = ComponentScoreSchema(component="TH", marks=50.0, state=valid_state)
        assert c.state == valid_state

    # Invalid state
    with pytest.raises(ValidationError):
        ComponentScoreSchema(component="TH", marks=50.0, state="invalid_state")


def test_subject_result_literal_validation():
    # Valid results
    for valid_res in ["passed", "failed", "unresolved"]:
        s = StudentSubjectBreakdownSchema(
            course_code="C1",
            course_name="Course 1",
            kind="theory",
            recorded_result=valid_res,
        )
        assert s.recorded_result == valid_res

    # Invalid result
    with pytest.raises(ValidationError):
        StudentSubjectBreakdownSchema(
            course_code="C1",
            course_name="Course 1",
            kind="theory",
            recorded_result="speculative_pass",
        )


# 6. Subject Failure Response Tests
def test_subject_failure_response_serialization():
    failing_stu = FailingStudentItem(
        student_id="STU_FAIL_01",
        name="Failing Student",
        roll_no="10",
        seat_no="SEAT-10",
        division="A",
        course_code="PCEC12T",
        course_name="THEORY OF COMPUTER SCIENCE",
        total_marks=32.0,
        letter_grade="F",
        flags=["F"],
        is_absent=False,
        components={
            "ESE": ComponentScoreSchema(component="ESE", marks=18.0, flag="F", state="marked", raw_text="18 F"),
            "IA": ComponentScoreSchema(component="IA", marks=14.0, flag=None, state="marked", raw_text="14"),
        },
    )
    resp = SubjectFailureResponse(
        course_code="PCEC12T",
        course_name="THEORY OF COMPUTER SCIENCE",
        division_filter="A",
        credits=4.0,
        kind="theory",
        total_enrolled=85,
        confirmed_failures_count=10,
        passed_count=75,
        unresolved_count=0,
        failure_rate_percent=11.76,
        limit=50,
        offset=0,
        failing_students=[failing_stu],
    )
    d = resp.model_dump()
    assert d["course_code"] == "PCEC12T"
    assert d["confirmed_failures_count"] == 10
    assert d["total_enrolled"] == 85
    assert len(d["failing_students"]) == 1
    assert d["failing_students"][0]["components"]["ESE"]["flag"] == "F"


def test_subject_failure_rate_bounds():
    # Invalid failure_rate > 100.0
    with pytest.raises(ValidationError):
        SubjectFailureResponse(
            course_code="C1",
            course_name="Course 1",
            total_enrolled=10,
            confirmed_failures_count=11,
            passed_count=0,
            unresolved_count=0,
            failure_rate_percent=110.0,
        )


# 7. Subject Failure Summary Response Tests
def test_subject_failure_summary_response_serialization():
    item1 = SubjectFailureSummaryItem(
        course_code="PCEC12T",
        course_name="THEORY OF COMPUTER SCIENCE",
        credits=4.0,
        kind="theory",
        division_filter=None,
        total_enrolled=145,
        confirmed_failures_count=12,
        passed_count=133,
        unresolved_count=0,
        failure_rate_percent=8.28,
    )
    resp = SubjectFailureSummaryResponse(
        division_filter=None,
        total_courses_evaluated=1,
        summary=[item1],
    )
    d = resp.model_dump()
    assert d["total_courses_evaluated"] == 1
    assert d["summary"][0]["confirmed_failures_count"] == 12


# 8. Data Quality Response Tests
def test_data_quality_response_serialization():
    finding = DataQualityFindingItem(
        check_id="INCONSISTENT_TOTALS",
        severity="warning",
        title="Sum of components does not match total",
        count=3,
        problem="Computed sum differs from printed marksheet total",
        impact="Possible transcript discrepancy",
        recommended_action="Verify against physical evaluation record",
        details=["Row 10: printed 45, computed 44"],
    )
    resp = DataQualityResponse(
        session_id="Result_anonymized",
        health_status="Good",
        quality_score=98.5,
        total_checks=7,
        error_count=0,
        warning_count=1,
        info_count=0,
        findings=[finding],
    )
    d = resp.model_dump()
    assert d["session_id"] == "Result_anonymized"
    assert d["health_status"] == "Good"
    assert d["quality_score"] == 98.5
    assert len(d["findings"]) == 1
    assert d["findings"][0]["severity"] == "warning"


def test_data_quality_invalid_severity_rejected():
    with pytest.raises(ValidationError):
        DataQualityFindingItem(
            check_id="C1",
            severity="catastrophic",  # Invalid severity literal
            title="T",
            count=1,
            problem="P",
            impact="I",
            recommended_action="R",
        )
