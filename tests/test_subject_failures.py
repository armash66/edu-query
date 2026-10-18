"""Comprehensive tests for Subject Failure listing service (EduQuery V3 Phase 2)."""
from __future__ import annotations

from pathlib import Path
import pytest

from app.core.ingest import ingest
from app.reports.subject_failures import get_subject_failures, list_all_subjects_failure_summary, resolve_course

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def primary_con():
    """Ingest primary acceptance marksheet into an in-memory DuckDB database."""
    wb_path = DATA_DIR / "Result_anonymized.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Primary workbook {wb_path} not found")
    con, _ = ingest(wb_path, db_path=":memory:")
    return con


def test_subject_failures_pcec12t_classwide(primary_con):
    """Verify class-wide failure listing for PCEC12T (Theory of Computer Science)."""
    rep = get_subject_failures(primary_con, "PCEC12T")

    assert rep.status == "success"
    assert rep.course_code == "PCEC12T"
    assert rep.course_name == "THEORY OF COMPUTER SCIENCE"
    assert rep.division_filter is None

    # Invariants on enrollment and failure counts
    assert rep.total_enrolled == 145
    assert rep.confirmed_failures_count == 12
    assert rep.passed_count == 133
    assert rep.unresolved_count == 0
    assert len(rep.failing_students) == 12
    assert abs(rep.failure_rate_percent - 8.28) < 0.05

    # Check that all failing students have confirmed fail grades
    for student in rep.failing_students:
        assert student.letter_grade == "F"
        assert student.course_code == "PCEC12T"
        assert student.total_marks is not None
        assert student.source_sheet == "Sheet1"
        assert student.source_row > 0
        assert len(student.components) > 0


def test_subject_failures_pcec12t_division_a(primary_con):
    """Verify division A filter for PCEC12T (Theory of Computer Science)."""
    rep = get_subject_failures(primary_con, "PCEC12T", division="A")

    assert rep.status == "success"
    assert rep.division_filter == "A"
    assert rep.total_enrolled == 85
    assert rep.confirmed_failures_count == 10
    assert len(rep.failing_students) == 10
    assert abs(rep.failure_rate_percent - 11.76) < 0.05

    for student in rep.failing_students:
        assert student.division == "A"


def test_subject_failures_pcec12t_division_b(primary_con):
    """Verify division B filter for PCEC12T (Theory of Computer Science)."""
    rep = get_subject_failures(primary_con, "PCEC12T", division="B")

    assert rep.status == "success"
    assert rep.division_filter == "B"
    assert rep.total_enrolled == 60
    assert rep.confirmed_failures_count == 2
    assert len(rep.failing_students) == 2
    assert abs(rep.failure_rate_percent - 3.33) < 0.05

    for student in rep.failing_students:
        assert student.division == "B"


def test_subject_failures_pcec14t_division_breakdown(primary_con):
    """Verify division breakdown for PCEC14T (Analog & Digital Communications)."""
    rep_all = get_subject_failures(primary_con, "PCEC14T")
    rep_div_a = get_subject_failures(primary_con, "PCEC14T", division="A")
    rep_div_b = get_subject_failures(primary_con, "PCEC14T", division="B")

    assert rep_all.confirmed_failures_count == 6
    assert rep_div_a.confirmed_failures_count == 6
    assert rep_div_b.confirmed_failures_count == 0


def test_subject_failures_elective_enrolled_only(primary_con):
    """Verify elective courses only consider students actually enrolled in the elective."""
    rep = get_subject_failures(primary_con, "MDMBD02")

    assert rep.status == "success"
    assert rep.course_code == "MDMBD02"
    # Only 63 students enrolled in this elective out of 145 total
    assert rep.total_enrolled == 63
    assert rep.confirmed_failures_count == 3
    assert len(rep.failing_students) == 3


def test_subject_failures_resolve_by_course_name(primary_con):
    """Verify resolution of course by human-readable course name."""
    rep = get_subject_failures(primary_con, "Theory of Computer Science")

    assert rep.status == "success"
    assert rep.course_code == "PCEC12T"
    assert rep.confirmed_failures_count == 12


def test_subject_failures_ambiguous_course_query(primary_con):
    """Verify that ambiguous query returns ambiguity report rather than arbitrary course."""
    rep = get_subject_failures(primary_con, "Communications")

    assert rep.status == "ambiguous"
    assert len(rep.matching_courses) > 1
    assert "matched" in (rep.error_message or "").lower()


def test_subject_failures_not_found(primary_con):
    """Verify clean handling of non-existent course identifier."""
    rep = get_subject_failures(primary_con, "COMPUTATIONAL_GENOMICS_404")

    assert rep.status == "not_found"
    assert "not found" in (rep.error_message or "").lower()


def test_subject_failures_serialization(primary_con):
    """Verify dictionary serialization for API/export."""
    rep = get_subject_failures(primary_con, "PCEC12T", division="A")
    d = rep.to_dict()

    assert isinstance(d, dict)
    assert d["status"] == "success"
    assert d["course_code"] == "PCEC12T"
    assert d["division_filter"] == "A"
    assert d["total_enrolled"] == 85
    assert d["confirmed_failures_count"] == 10
    assert isinstance(d["failing_students"], list)
    assert len(d["failing_students"]) == 10


def test_all_subjects_failure_summary(primary_con):
    """Verify ranking and summary of failure metrics across all courses."""
    summary = list_all_subjects_failure_summary(primary_con)

    assert len(summary) > 0
    # First course has highest failure count
    assert summary[0]["course_code"] == "PCEC12T"
    assert summary[0]["confirmed_failures_count"] == 12

    # Verify descending ordering
    counts = [s["confirmed_failures_count"] for s in summary]
    assert counts == sorted(counts, reverse=True)


def test_subject_failures_generalization_test1():
    """Verify failure listing on Commerce generalization workbook."""
    wb_path = DATA_DIR / "test1_commerce_same_layout.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    rep = get_subject_failures(con, "22COM108")

    assert rep.status == "success"
    assert rep.course_code == "22COM108"
    assert rep.confirmed_failures_count == 2
    assert len(rep.failing_students) == 2


def test_subject_failures_generalization_test2():
    """Verify failure listing on Life Sciences generalization workbook."""
    wb_path = DATA_DIR / "test2_lifesci_vague_single_row.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    rep = get_subject_failures(con, "BIO-4056 - Cell Biology")

    assert rep.status == "success"
    assert rep.confirmed_failures_count == 2
    assert len(rep.failing_students) == 2


def test_division_partition_reconciliation(primary_con):
    """Verify that exhaustive division partitions (Div A + Div B) reconcile exactly with classwide totals."""
    courses = [r[0] for r in primary_con.execute("SELECT code FROM courses").fetchall()]

    for c in courses:
        rep_all = get_subject_failures(primary_con, c)
        rep_a = get_subject_failures(primary_con, c, division="A")
        rep_b = get_subject_failures(primary_con, c, division="B")

        # Enrollment reconciliation
        assert rep_a.total_enrolled + rep_b.total_enrolled == rep_all.total_enrolled
        # Failure reconciliation
        assert rep_a.confirmed_failures_count + rep_b.confirmed_failures_count == rep_all.confirmed_failures_count
        # Student list reconciliation
        assert len(rep_a.failing_students) + len(rep_b.failing_students) == len(rep_all.failing_students)


def test_missing_grades_never_counted_as_failures():
    """Verify courses with missing grades are tracked as unresolved, never confirmed failures."""
    wb_path = DATA_DIR / "test3_arts_messy_sheet_per_division.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    courses = [r[0] for r in con.execute("SELECT code FROM courses").fetchall()]

    for c in courses:
        rep = get_subject_failures(con, c)
        assert rep.confirmed_failures_count == 0
        assert len(rep.failing_students) == 0
        assert rep.unresolved_count == rep.total_enrolled
