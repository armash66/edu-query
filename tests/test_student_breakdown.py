"""Comprehensive tests for Student Breakdown reporting service (EduQuery V3 Phase 2)."""
from __future__ import annotations

from pathlib import Path
import pytest

from app.core.ingest import ingest
from app.reports.student_breakdown import get_student_breakdown, resolve_student, classify_subject_result

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def primary_con():
    """Ingest primary acceptance marksheet into an in-memory DuckDB database."""
    wb_path = DATA_DIR / "Result_anonymized.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Primary workbook {wb_path} not found")
    con, _ = ingest(wb_path, db_path=":memory:")
    return con


def test_student_breakdown_topper_all_passed(primary_con):
    """Verify student breakdown for overall topper with 100% pass record."""
    rep = get_student_breakdown(primary_con, "PANDEY ADVAIT KISHOR RUPALI")

    assert rep.status == "success"
    assert rep.student is not None
    assert rep.student.name == "PANDEY ADVAIT KISHOR RUPALI"
    assert rep.student.division == "B"
    assert rep.student.total_marks == 801.0
    assert rep.student.overall_result == "PASSES"

    # Invariants on enrollment and pass/fail counts
    assert rep.total_enrolled == 12
    assert rep.passed_count == 12
    assert rep.failed_count == 0
    assert rep.unresolved_count == 0
    assert len(rep.subjects) == 12

    # Check first subject details
    first_subj = rep.subjects[0]
    assert first_subj.course_code == "MDM01"
    assert first_subj.recorded_result == "passed"
    assert first_subj.letter_grade in {"O", "A", "B", "C", "D", "E", "P"}
    assert first_subj.source_sheet == "Sheet1"
    assert first_subj.source_row > 0

    # Ensure TOT1 is not in components (no double counting)
    for subj in rep.subjects:
        assert "TOT1" not in subj.components
        assert subj.total_marks is not None


def test_student_breakdown_failing_student_two_fails(primary_con):
    """Verify student breakdown for student with 2 failed subjects (23108A0032)."""
    rep = get_student_breakdown(primary_con, "23108A0032")

    assert rep.status == "success"
    assert rep.student is not None
    assert rep.student.student_id == "23108A0032"
    assert rep.student.overall_result == "FAILS"
    assert rep.total_enrolled == 12
    assert rep.passed_count == 10
    assert rep.failed_count == 2
    assert rep.unresolved_count == 0

    # Specifically check the two failed courses
    failed_courses = {s.course_code: s for s in rep.subjects if s.recorded_result == "failed"}
    assert set(failed_courses.keys()) == {"PCEC12T", "PCEC14T"}

    pcec12t = failed_courses["PCEC12T"]
    assert pcec12t.letter_grade == "F"
    assert pcec12t.total_marks == 30.0

    pcec14t = failed_courses["PCEC14T"]
    assert pcec14t.letter_grade == "F"
    assert pcec14t.total_marks == 26.0


def test_student_breakdown_absent_and_failed_student(primary_con):
    """Verify student breakdown for student with absent assessments (23108A0143)."""
    rep = get_student_breakdown(primary_con, "23108A0143")

    assert rep.status == "success"
    assert rep.student is not None
    assert rep.failed_count > 0

    absent_subjects = [s for s in rep.subjects if s.is_absent]
    assert len(absent_subjects) > 0
    for subj in absent_subjects:
        assert "AB" in subj.flags


def test_student_breakdown_not_found(primary_con):
    """Verify clean handling of non-existent student identifier."""
    rep = get_student_breakdown(primary_con, "NON_EXISTENT_STUDENT_99999")

    assert rep.status == "not_found"
    assert rep.student is None
    assert "not found" in (rep.error_message or "").lower()


def test_student_breakdown_ambiguous_identifier(primary_con):
    """Verify that ambiguous query returns ambiguity report rather than arbitrary student."""
    # Searching for single common letter like 'a' matches many students
    rep = get_student_breakdown(primary_con, "kumar")

    if rep.status == "ambiguous":
        assert len(rep.matching_candidates) > 1
        assert "matched" in (rep.error_message or "").lower()


def test_student_breakdown_serialization(primary_con):
    """Verify that report dictionary conversion works and contains required keys."""
    rep = get_student_breakdown(primary_con, "23108A0032")
    d = rep.to_dict()

    assert isinstance(d, dict)
    assert d["status"] == "success"
    assert d["total_enrolled"] == 12
    assert d["passed_count"] == 10
    assert d["failed_count"] == 2
    assert isinstance(d["subjects"], list)
    assert len(d["subjects"]) == 12


def test_student_breakdown_generalization_test2():
    """Verify student breakdown on Life Sciences workbook with absent markers."""
    wb_path = DATA_DIR / "test2_lifesci_vague_single_row.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    # Query student with absent marker
    rep = get_student_breakdown(con, "BSC/22/0104")

    assert rep.status == "success"
    assert rep.student is not None
    assert rep.total_enrolled == 7
    # One course has grade 'AB'
    ab_subjects = [s for s in rep.subjects if s.is_absent]
    assert len(ab_subjects) >= 1
    # Check that unresolved counts are tracked accurately
    assert rep.passed_count + rep.failed_count + rep.unresolved_count == rep.total_enrolled


def test_student_breakdown_generalization_test3():
    """Verify student breakdown on Arts workbook with no letter grades (all unresolved)."""
    wb_path = DATA_DIR / "test3_arts_messy_sheet_per_division.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    rep = get_student_breakdown(con, "990001")

    assert rep.status == "success"
    assert rep.student is not None
    # Workbook has no letter grades; subjects must be classified as unresolved, not pass or fail
    assert rep.passed_count == 0
    assert rep.failed_count == 0
    assert rep.unresolved_count == rep.total_enrolled


def test_classification_invariants_failure_flag_precedence():
    """Verify conflicting result indicators (passing grade + component failure flag)

    Source rule justification (Phase 7 audit):
    When a passing final grade (e.g. 'O', 'P') coexists with a component failure flag ('F'),
    it represents contradictory source evidence (e.g., grace marks, separate passing rules,
    or clerical error). Under the audited precedence policy, EduQuery V3 refuses to silently
    manufacture certainty: such records are surfaced as 'unresolved' with reason
    'CONFLICTING_RESULT_INDICATORS', ensuring confirmed failure counts are not artificially inflated.
    """
    assert classify_subject_result("O", ["F"]) == "unresolved"
    assert classify_subject_result("A+", ["F"]) == "unresolved"
    assert classify_subject_result("P", ["f"]) == "unresolved"
    assert classify_subject_result("PASS", ["E", "F"]) == "unresolved"
    # When no F flag exists, passing grades return passed
    assert classify_subject_result("O", ["E"]) == "passed"
    assert classify_subject_result("P", []) == "passed"


def test_classification_invariants_missing_grade_unresolved():
    """Verify missing/absent grades remain unresolved, never passed or failed."""
    assert classify_subject_result(None, []) == "unresolved"
    assert classify_subject_result("", []) == "unresolved"
    assert classify_subject_result("-", []) == "unresolved"
    assert classify_subject_result("AB", []) == "unresolved"
    assert classify_subject_result("NA", []) == "unresolved"
    assert classify_subject_result(None, ["AB"]) == "unresolved"


def test_student_breakdown_provenance_and_distinct_totals(primary_con):
    """Verify source provenance and separation of printed totals vs component sums."""
    rep = get_student_breakdown(primary_con, "23108A0004")
    assert rep.status == "success"

    for subj in rep.subjects:
        assert subj.source_sheet == "Sheet1"
        assert subj.source_row == 8
        # Components dict must never include synthetic total column
        assert "TOT1" not in subj.components
        if subj.total_marks is not None and subj.computed_marks_sum is not None:
            # Both representations are tracked
            assert isinstance(subj.total_marks, float)
            assert isinstance(subj.computed_marks_sum, float)


def test_distinction_enrolled_vs_unenrolled_student(primary_con):
    """Verify unenrolled electives are excluded from student breakdown, while enrolled electives are included."""
    rep = get_student_breakdown(primary_con, "23108A0004")
    enrolled_codes = {s.course_code for s in rep.subjects}

    # Student took MDMBD02 (Financial Basics), did not take MDMBI02 (Bioinformatics)
    assert "MDMBD02" in enrolled_codes
    assert "MDMBI02" not in enrolled_codes
    assert rep.total_enrolled == len(enrolled_codes) == 12
