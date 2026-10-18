"""Unit tests for the EduQuery V3 academic integrity and data-quality auditor."""
from __future__ import annotations

import pandas as pd
import pytest

from app.core.data_quality import run_data_quality_audit


def test_duplicate_student_id_detection():
    students_df = pd.DataFrame([
        {"student_id": "STU01", "name": "Student A", "division": "A"},
        {"student_id": "STU01", "name": "Student A Copy", "division": "B"},
        {"student_id": "STU02", "name": "Student B", "division": "A"},
    ])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([{"student_id": "STU01", "course_code": "C1", "component": "TOT1", "value": 50.0, "flag": None, "state": "marked"}])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_dup")
    assert report.error_count >= 1
    dup_finding = next((f for f in report.findings if f.check_id == "duplicate_student_id"), None)
    assert dup_finding is not None
    assert dup_finding.severity == "error"
    assert dup_finding.count == 1
    assert report.health_status == "Critical"


def test_missing_student_id_detection():
    students_df = pd.DataFrame([
        {"student_id": "STU01", "name": "Student A"},
        {"student_id": "", "name": "Anonymous Student"},
        {"student_id": None, "name": "Ghost Student"},
    ])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame()

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_missing_id")
    assert report.error_count >= 1
    missing_finding = next((f for f in report.findings if f.check_id == "missing_student_id"), None)
    assert missing_finding is not None
    assert missing_finding.count == 2


def test_out_of_range_marks_detection_warning():
    """Verify out-of-range marks generate a prominent non-blocking data quality warning, not an error."""
    students_df = pd.DataFrame([{"student_id": "STU01", "name": "Student A"}])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([
        {"student_id": "STU01", "course_code": "C1", "component": "TOT1", "value": 115.0, "flag": None, "state": "marked"},
        {"student_id": "STU01", "course_code": "C1", "component": "ISA", "value": -5.0, "flag": None, "state": "marked"},
        {"student_id": "STU01", "course_code": "C1", "component": "ESE", "value": 85.0, "flag": None, "state": "marked"},
    ])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_range")
    assert report.error_count == 0
    assert report.warning_count >= 1
    range_finding = next((f for f in report.findings if f.check_id == "out_of_range_marks"), None)
    assert range_finding is not None
    assert range_finding.severity == "warning"
    assert range_finding.count == 2
    assert "78" not in range_finding.title or "2" in range_finding.title
    assert "Some entries fall outside the expected marks range" in range_finding.problem


def test_inconsistent_totals_detection():
    students_df = pd.DataFrame([{"student_id": "STU01", "name": "Student A"}])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([
        {"student_id": "STU01", "course_code": "C1", "component": "ISA", "value": 20.0, "flag": None, "state": "marked"},
        {"student_id": "STU01", "course_code": "C1", "component": "ESE", "value": 30.0, "flag": None, "state": "marked"},
        # Sum is 50, but printed total is 65!
        {"student_id": "STU01", "course_code": "C1", "component": "TOT1", "value": 65.0, "flag": None, "state": "marked"},
    ])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_inconsistent")
    assert report.warning_count >= 1
    mismatch_finding = next((f for f in report.findings if f.check_id == "inconsistent_totals"), None)
    assert mismatch_finding is not None
    assert mismatch_finding.count == 1
    assert mismatch_finding.severity == "warning"


def test_absent_vs_zero_separation():
    students_df = pd.DataFrame([{"student_id": "STU01", "name": "Student A"}])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([
        {"student_id": "STU01", "course_code": "C1", "component": "ISA", "value": None, "flag": "AB", "state": "flagged"},
        {"student_id": "STU01", "course_code": "C1", "component": "ESE", "value": 0.0, "flag": None, "state": "marked"},
    ])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_abs_vs_zero")
    abs_finding = next((f for f in report.findings if f.check_id == "absent_vs_zero"), None)
    assert abs_finding is not None
    assert abs_finding.severity == "info"
    assert abs_finding.count == 2


def test_negative_marks_alone_do_not_block_activation():
    """Verify negative marks create warning without generating blocking error."""
    students_df = pd.DataFrame([{"student_id": "STU01", "name": "Student A"}])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([
        {"student_id": "STU01", "course_code": "C1", "component": "ESE", "value": -10.0, "flag": None, "state": "marked"},
    ])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_neg")
    assert report.error_count == 0
    assert report.warning_count == 1
    finding = next((f for f in report.findings if f.check_id == "out_of_range_marks"), None)
    assert finding is not None
    assert finding.severity == "warning"
    assert finding.count == 1
    # Check that privacy is maintained: no student names in details
    for d in finding.details:
        assert "Student A" not in d


def test_component_over_100_generates_warning():
    """Verify component marks > 100 generate a non-blocking warning."""
    students_df = pd.DataFrame([{"student_id": "STU01", "name": "Student A"}])
    courses_df = pd.DataFrame([{"code": "C1", "name": "Course 1"}])
    scores_df = pd.DataFrame([
        {"student_id": "STU01", "course_code": "C1", "component": "ESE", "value": 110.0, "flag": None, "state": "marked"},
    ])

    report = run_data_quality_audit(students_df, courses_df, scores_df, session_id="test_over_100")
    assert report.error_count == 0
    assert report.warning_count == 1
    finding = next((f for f in report.findings if f.check_id == "out_of_range_marks"), None)
    assert finding is not None
    assert finding.severity == "warning"
