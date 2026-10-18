"""Analytical report services for EduQuery V3 (Phase 2)."""
from app.reports.student_breakdown import (
    ComponentScoreDetail,
    StudentBreakdownReport,
    StudentIdentity,
    StudentSubjectBreakdown,
    classify_subject_result,
    get_student_breakdown,
    resolve_student,
)
from app.reports.subject_failures import (
    FailingStudentDetail,
    SubjectFailureReport,
    get_subject_failures,
    list_all_subjects_failure_summary,
    resolve_course,
)

__all__ = [
    "ComponentScoreDetail",
    "StudentBreakdownReport",
    "StudentIdentity",
    "StudentSubjectBreakdown",
    "classify_subject_result",
    "get_student_breakdown",
    "resolve_student",
    "FailingStudentDetail",
    "SubjectFailureReport",
    "get_subject_failures",
    "list_all_subjects_failure_summary",
    "resolve_course",
]
