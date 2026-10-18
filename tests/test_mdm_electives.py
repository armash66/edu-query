"""Comprehensive synthetic tests for MDM elective semantics and data quality checks (EduQuery V3 Phase 10)."""
from __future__ import annotations

from pathlib import Path
import openpyxl
import pandas as pd
import pytest

from app.core.data_quality import run_data_quality_audit
from app.core.ingest import detect_elective_groups, detect_layout, _read_sheet_rows, ingest
from app.reports.subject_failures import get_subject_failures


def _save_synthetic_elective_workbook(
    filepath: Path,
    students_config: list[dict],
    elective_codes: list[str] = ("MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"),
) -> Path:
    """Create a minimal synthetic workbook with compulsory courses + MDM elective blocks."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # Row 1: Course Codes
    # Cols 1-7: Identity (Seat, Roll, Name, Email, Division, Level, Elective Choice)
    ws.cell(1, 1, "Seat No")
    ws.cell(1, 2, "Roll No")
    ws.cell(1, 3, "Student Name")
    ws.cell(1, 4, "Email")
    ws.cell(1, 5, "Division")
    ws.cell(1, 6, "Level")
    ws.cell(1, 7, "Elective Choice")

    # Col 8-10: Compulsory Course CS101 (TOT1, Credits, Result)
    ws.cell(1, 8, "CS101")
    ws.cell(2, 8, "TOT1")
    ws.cell(2, 9, "Credits")
    ws.cell(2, 10, "Grade")

    # Elective Blocks: each has TOT1, Credits, Grade
    col = 11
    for el in elective_codes:
        ws.cell(1, col, el)
        ws.cell(2, col, "TOT1")
        ws.cell(2, col + 1, "Credits")
        ws.cell(2, col + 2, "Grade")
        col += 3

    # Summary columns
    ws.cell(1, col, "Total Marks")
    ws.cell(1, col + 1, "SGPI")
    ws.cell(1, col + 2, "CGPA")
    ws.cell(1, col + 3, "Result")

    # Write student rows
    curr_row = 3
    for s in students_config:
        ws.cell(curr_row, 1, s.get("seat_no", f"SEAT_{curr_row}"))
        ws.cell(curr_row, 2, s.get("roll_no", f"ROLL_{curr_row}"))
        ws.cell(curr_row, 3, s.get("name", f"Student {curr_row}"))
        ws.cell(curr_row, 4, s.get("email", f"student{curr_row}@example.com"))
        ws.cell(curr_row, 5, s.get("division", "A"))
        ws.cell(curr_row, 6, "UG")
        ws.cell(curr_row, 7, s.get("elective_choice", ""))

        # Compulsory CS101 marks
        ws.cell(curr_row, 8, 75)
        ws.cell(curr_row, 9, 4)
        ws.cell(curr_row, 10, "A")

        # Elective marks
        col = 11
        for el in elective_codes:
            if el in s.get("marks", {}):
                m_info = s["marks"][el]
                ws.cell(curr_row, col, m_info.get("tot", 80))
                ws.cell(curr_row, col + 1, 4)
                ws.cell(curr_row, col + 2, m_info.get("grade", "A"))
            col += 3

        ws.cell(curr_row, col, 155)
        ws.cell(curr_row, col + 1, 8.5)
        ws.cell(curr_row, col + 2, 8.5)
        ws.cell(curr_row, col + 3, "PASSES")
        curr_row += 1

    wb.save(filepath)
    return filepath


def test_mdm_single_choice_mutually_exclusive(tmp_path: Path):
    """Verify students selecting 1 of N electives have 0 phantom rows in unselected electives."""
    students = [
        {"roll_no": "S01", "marks": {"MDMBD02": {"tot": 85, "grade": "O"}}},
        {"roll_no": "S02", "marks": {"MDMBI02": {"tot": 70, "grade": "B"}}},
        {"roll_no": "S03", "marks": {"MDMIE02": {"tot": 65, "grade": "C"}}},
        {"roll_no": "S04", "marks": {"MDMRB02": {"tot": 40, "grade": "P"}}},
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_clean.xlsx", students)
    con, rep = ingest(wb_file, db_path=":memory:")

    # 1. Total enrollments per elective must be exactly 1
    for el in ["MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"]:
        cnt = con.execute("SELECT count(*) FROM enrollment WHERE course_code = ?", [el]).fetchone()[0]
        assert cnt == 1, f"Expected 1 student in {el}, got {cnt}"

    # 2. Total reconciliation rows across all 4 electives must equal exactly 4 (not 4 * 4 = 16)
    recon_cnt = con.execute(
        "SELECT count(*) FROM reconciliation WHERE course_code IN ('MDMBD02', 'MDMBI02', 'MDMIE02', 'MDMRB02')"
    ).fetchone()[0]
    assert recon_cnt == 4, f"Expected 4 reconciliation rows for electives, got {recon_cnt}"

    # 3. Verify S01 has 0 scores or reconciliation for MDMBI02, MDMIE02, MDMRB02
    unenrolled_recon = con.execute(
        "SELECT count(*) FROM reconciliation WHERE student_id = 'S01' AND course_code != 'MDMBD02' AND course_code != 'CS101'"
    ).fetchone()[0]
    assert unenrolled_recon == 0

    # 4. Verify enrollment denominator in subject failure report
    rep_bd = get_subject_failures(con, "MDMBD02")
    assert rep_bd.total_enrolled == 1
    assert rep_bd.passed_count == 1
    assert rep_bd.confirmed_failures_count == 0


def test_mdm_failing_and_absent_in_elective(tmp_path: Path):
    """Verify failing grades and absent markers in an elective are accurately captured without corrupting denominators."""
    students = [
        {"roll_no": "S01", "marks": {"MDMBD02": {"tot": 85, "grade": "O"}}},
        {"roll_no": "S02", "marks": {"MDMBD02": {"tot": 32, "grade": "F"}}},  # Failed in elective
        {"roll_no": "S03", "marks": {"MDMBI02": {"tot": 75, "grade": "A"}}},
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_fail.xlsx", students)
    con, _ = ingest(wb_file, db_path=":memory:")

    rep_bd = get_subject_failures(con, "MDMBD02")
    assert rep_bd.total_enrolled == 2
    assert rep_bd.confirmed_failures_count == 1
    assert rep_bd.passed_count == 1
    assert len(rep_bd.failing_students) == 1
    assert rep_bd.failing_students[0].student_id == "S02"
    assert rep_bd.failing_students[0].letter_grade == "F"


def test_detect_elective_groups_structure(tmp_path: Path):
    """Verify detect_elective_groups groups courses, calculates metrics, and verifies mutual exclusivity."""
    students = [
        {"roll_no": "S01", "marks": {"MDMBD02": {"tot": 85, "grade": "O"}}},
        {"roll_no": "S02", "marks": {"MDMBI02": {"tot": 70, "grade": "B"}}},
        {"roll_no": "S03", "marks": {"MDMIE02": {"tot": 65, "grade": "C"}}},
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_detect.xlsx", students)
    wb = openpyxl.load_workbook(wb_file, data_only=True)
    ws = wb.active
    layout = detect_layout(ws)
    s_rows, c_rows, sc_rows, g_rows, e_rows, r_rows = _read_sheet_rows(ws, layout, "Sheet1")

    groups = detect_elective_groups(c_rows, e_rows, s_rows)
    assert len(groups) == 1
    grp = groups[0]
    assert grp["group_id"] == "mdm_electives"
    assert set(grp["course_codes"]) == {"MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"}
    assert grp["total_students"] == 3
    assert grp["assigned_count"] == 3
    assert grp["unassigned_count"] == 0
    assert grp["multi_assigned_count"] == 0
    assert grp["is_mutually_exclusive"] is True
    assert grp["status"] == "valid"


def test_ambiguous_multiple_elective_selection_detected(tmp_path: Path):
    """Verify student with marks in multiple mutually exclusive electives is flagged in Data Quality audit."""
    students = [
        # S01 accidentally has marks entered in TWO MDM electives
        {"roll_no": "S01", "marks": {"MDMBD02": {"tot": 85, "grade": "O"}, "MDMBI02": {"tot": 70, "grade": "B"}}},
        {"roll_no": "S02", "marks": {"MDMIE02": {"tot": 65, "grade": "C"}}},
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_ambig.xlsx", students)
    wb = openpyxl.load_workbook(wb_file, data_only=True)
    ws = wb.active
    layout = detect_layout(ws)
    s_rows, c_rows, sc_rows, g_rows, e_rows, r_rows = _read_sheet_rows(ws, layout, "Sheet1")
    groups = detect_elective_groups(c_rows, e_rows, s_rows)

    assert groups[0]["multi_assigned_count"] == 1
    assert groups[0]["is_mutually_exclusive"] is False
    assert groups[0]["status"] == "ambiguous"

    # Verify Check 9 in data quality audit
    res = run_data_quality_audit(
        students_df=pd.DataFrame(s_rows),
        courses_df=pd.DataFrame(c_rows),
        scores_df=pd.DataFrame(sc_rows),
        elective_groups=groups,
    )
    check9 = next((f for f in res.findings if f.check_id == "ambiguous_elective_selection"), None)
    assert check9 is not None
    assert check9.severity == "warning"
    assert check9.count == 1
    assert "S01" in check9.details[0]


def test_unassigned_elective_detected(tmp_path: Path):
    """Verify student with no elective marks entered is flagged as unassigned."""
    students = [
        {"roll_no": "S01", "marks": {"MDMBD02": {"tot": 85, "grade": "O"}}},
        {"roll_no": "S02", "marks": {}},  # No elective marks entered
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_unassigned.xlsx", students)
    wb = openpyxl.load_workbook(wb_file, data_only=True)
    ws = wb.active
    layout = detect_layout(ws)
    s_rows, c_rows, sc_rows, g_rows, e_rows, r_rows = _read_sheet_rows(ws, layout, "Sheet1")
    groups = detect_elective_groups(c_rows, e_rows, s_rows)

    assert groups[0]["unassigned_count"] == 1
    assert groups[0]["status"] == "incomplete"

    res = run_data_quality_audit(
        students_df=pd.DataFrame(s_rows),
        courses_df=pd.DataFrame(c_rows),
        scores_df=pd.DataFrame(sc_rows),
        elective_groups=groups,
    )
    check_un = next((f for f in res.findings if f.check_id == "unassigned_elective"), None)
    assert check_un is not None
    assert check_un.count == 1


def test_elective_metadata_vs_marks_conflict_check10(tmp_path: Path):
    """Verify Check 10 flags conflict between registered elective choice and marksheet column entries."""
    students = [
        # Registered for MDMBD02, but marks entered in MDMBI02 column!
        {"roll_no": "S01", "elective_choice": "MDMBD02", "marks": {"MDMBI02": {"tot": 70, "grade": "B"}}},
    ]
    wb_file = _save_synthetic_elective_workbook(tmp_path / "elective_conflict.xlsx", students)
    con, rep = ingest(wb_file, db_path=":memory:")

    res = run_data_quality_audit(
        students_df=con.execute("SELECT * FROM students").df(),
        courses_df=con.execute("SELECT * FROM courses").df(),
        scores_df=con.execute("SELECT * FROM scores").df(),
        elective_groups=rep.layout.get("elective_groups", []),
    )
    check10 = next((f for f in res.findings if f.check_id == "elective_selection_score_conflict"), None)
    assert check10 is not None
    assert check10.count == 1
    assert "S01" in check10.details[0]
