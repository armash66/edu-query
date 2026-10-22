"""Automated test suite for student absence management and Excel workbook exports."""
from __future__ import annotations

import io
from pathlib import Path
import duckdb
import openpyxl
import pytest

from app.reports.student_breakdown import (
    StudentSubjectCounts,
    get_students_subject_counts_batch,
)
from app.services.export_service import (
    _apply_workbook_styles,
    _safe_float,
    _safe_int,
    export_absent_students_excel,
    export_students_roster_excel,
    export_subject_students_excel,
    sanitize_cell_text,
)
from app.services.student_service import (
    list_absent_components,
    list_absent_students,
    list_students,
)

DATA_DIR = Path("data")
DB_PATH = DATA_DIR / "eduquery.duckdb"


@pytest.fixture
def db_conn() -> duckdb.DuckDBPyConnection:
    if not DB_PATH.exists():
        pytest.skip("eduquery.duckdb does not exist in data directory")
    con = duckdb.connect(str(DB_PATH), read_only=True)
    yield con
    con.close()


def test_sanitize_cell_text_formula_injection():
    """Verify formula injection triggers are properly quoted, while legitimate numbers are preserved."""
    # Formulas with dangerous prefix
    assert sanitize_cell_text("=1+1") == "'=1+1"
    assert sanitize_cell_text("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_cell_text("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert sanitize_cell_text("-cmd|' /C calc'!A0") == "'-cmd|' /C calc'!A0"
    assert sanitize_cell_text("\tTAB_INJECT") == "'\tTAB_INJECT"
    assert sanitize_cell_text("\rCR_INJECT") == "'\rCR_INJECT"

    # Legitimate numbers should NOT be quoted
    assert sanitize_cell_text(42) == "42"
    assert sanitize_cell_text(85.5) == "85.5"
    assert sanitize_cell_text("-5") == "-5"
    assert sanitize_cell_text("+12.5") == "+12.5"

    # Normal text
    assert sanitize_cell_text("PATEL ATHARV") == "PATEL ATHARV"
    assert sanitize_cell_text(None) == ""
    assert sanitize_cell_text("") == ""


def test_safe_numeric_conversions():
    """Verify safe float and int conversion never raises unhandled ValueError on dirty data."""
    assert _safe_float(45.5) == 45.5
    assert _safe_float("45.5") == 45.5
    assert _safe_float("AB") is None
    assert _safe_float("--") is None
    assert _safe_float("N/A") is None
    assert _safe_float(None) is None

    assert _safe_int(10) == 10
    assert _safe_int("10") == 10
    assert _safe_int("AB") is None
    assert _safe_int(None) is None


def test_distinct_absent_subject_counts(db_conn):
    """Verify multiple absent components in the same subject do not inflate distinct subject count."""
    # Student 23108A0143 is absent in both ESE and MSE of PCEC13T, plus other subjects
    res = get_students_subject_counts_batch(db_conn, ["23108A0143"])
    assert "23108A0143" in res
    counts = res["23108A0143"]
    assert isinstance(counts, StudentSubjectCounts)
    assert counts.passed == 4
    assert counts.failed == 8
    # Absent count is exactly 6 distinct subjects
    assert counts.absent == 6


def test_list_absent_students_service(db_conn):
    """Verify list_absent_students retrieves absent component events with student metrics."""
    res = list_absent_students(db_conn, limit=20)
    assert res.total > 0
    assert len(res.items) > 0

    first = res.items[0]
    assert first.student_id
    assert first.course_code
    assert first.component in ("ESE", "MSE", "ISA")
    assert first.raw_text in ("A", "AB", "ABS", "ABSENT")
    assert first.passed_subject_count >= 0
    assert first.failed_subject_count >= 0
    assert first.absent_subject_count > 0


def test_list_absent_components(db_conn):
    """Verify distinct absent components endpoint returns recognized evaluation components."""
    comps = list_absent_components(db_conn)
    assert len(comps) > 0
    for c in comps:
        assert c != "TOT1"


def test_student_roster_excel_export_structure(db_conn):
    """Verify student roster Excel export has text identifiers, valid numeric cells, and absent count."""
    filename, excel_bytes = export_students_roster_excel(db_conn, division="A")
    assert filename == "student_roster.xlsx"
    assert len(excel_bytes) > 1000

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    assert "Student Roster" in wb.sheetnames
    ws = wb["Student Roster"]

    # Header checks
    headers = [cell.value for cell in ws[1]]
    assert "Student ID" in headers
    assert "Roll No" in headers
    assert "Seat No" in headers
    assert "Passed Subjects" in headers
    assert "Failed Subjects" in headers
    assert "Absent Subjects" in headers

    # Verify column widths are capped and not blown out by headers
    for col_letter in ("A", "B", "C", "D", "K", "L", "M"):
        width = ws.column_dimensions[col_letter].width
        assert width is not None
        assert 10 <= width <= 45

    # Check data row format
    id_cell = ws.cell(row=2, column=1)
    roll_cell = ws.cell(row=2, column=3)
    seat_cell = ws.cell(row=2, column=4)
    assert id_cell.data_type == "s"
    assert roll_cell.data_type == "s"
    assert seat_cell.data_type == "s"
    assert id_cell.number_format == "@"
    assert roll_cell.number_format == "@"
    assert seat_cell.number_format == "@"


def test_subject_absent_students_excel_export(db_conn):
    """Verify subject-level absent students Excel export filters only students with absent status or marks."""
    status, filename, excel_bytes = export_subject_students_excel(db_conn, "PCEC13T", report_type="absent")
    assert status == 200
    assert "Absent_Students.xlsx" in filename
    assert len(excel_bytes) > 500

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb.active
    assert "Absent Students" in ws.title

    # Header is at row 5
    headers = [cell.value for cell in ws[5]]
    assert "Roll No" in headers
    assert "Seat No" in headers
    assert "Component Marks" in headers
    assert "Status" in headers

    # Verify column A width is reasonable, not 179
    col_a_width = ws.column_dimensions["A"].width
    assert col_a_width is not None
    assert col_a_width <= 45

    # Verify records present have absent markers in component marks
    for row_idx in range(6, ws.max_row + 1):
        comp_marks = str(ws.cell(row=row_idx, column=6).value or "")
        flags = str(ws.cell(row=row_idx, column=10).value or "")
        assert "AB" in comp_marks or "ABS" in comp_marks or "AB" in flags or "ABS" in flags


def test_absent_students_excel_export_all(db_conn):
    """Verify dedicated absent students workbook export."""
    filename, excel_bytes = export_absent_students_excel(db_conn)
    assert "absent_students" in filename
    assert len(excel_bytes) > 1000

    wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
    ws = wb.active
    assert ws.title == "Absent Students"

    headers = [cell.value for cell in ws[4]]
    assert "Roll No" in headers
    assert "Absent Component" in headers
    assert "Absent Marker" in headers
    assert "Passed Subjects" in headers
    assert "Failed Subjects" in headers
    assert "Absent Subjects" in headers

    # Verify row count matches
    assert ws.max_row > 4
