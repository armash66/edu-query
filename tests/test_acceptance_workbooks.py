"""Acceptance verification tests across all candidate Excel marksheet workbooks."""
from __future__ import annotations

from pathlib import Path
import pytest

from app.core.ingest import ingest
from app.core.catalog import get_catalog

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_primary_acceptance_result_anonymized():
    """Verify primary acceptance workbook Result_anonymized.xlsx."""
    wb_path = DATA_DIR / "Result_anonymized.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")

    # 1. Structure discovery
    assert rep.sheets_accepted == ["Sheet1"]
    assert rep.layout["rows_per_student"] == 2, "Expected paired-row layout detection"

    # 2. Student and course counts
    assert rep.students_count == 145, f"Expected 145 students, got {rep.students_count}"
    assert rep.courses_count == 27, f"Expected 27 courses, got {rep.courses_count}"

    # 3. Divisions breakdown
    div_counts = dict(con.execute("SELECT division, COUNT(*) FROM students GROUP BY division").fetchall())
    assert div_counts == {"A": 85, "B": 60}, f"Expected Div A: 85, Div B: 60, got {div_counts}"

    # 4. Recorded result breakdown (132 PASSES, 13 FAILS)
    res_counts = dict(con.execute("SELECT result, COUNT(*) FROM students GROUP BY result").fetchall())
    assert res_counts.get("PASSES") == 132, f"Expected 132 PASSES, got {res_counts.get('PASSES')}"
    assert res_counts.get("FAILS") == 13, f"Expected 13 FAILS, got {res_counts.get('FAILS')}"

    # 5. Overall topper verification
    top_student = con.execute("""
        SELECT student_id, name, division, total_marks
        FROM students
        ORDER BY total_marks DESC NULLS LAST
        LIMIT 1
    """).fetchone()
    assert top_student is not None
    assert top_student[1] == "PANDEY ADVAIT KISHOR RUPALI"
    assert top_student[2] == "B"
    assert top_student[3] == 801.0

    # 6. Second and third performers
    top3 = con.execute("""
        SELECT name, total_marks
        FROM students
        ORDER BY total_marks DESC NULLS LAST
        LIMIT 3
    """).fetchall()
    assert top3[1][0] == "FERNANDES ISHAAN ANIL NEELAM"
    assert top3[1][1] == 790.0
    assert top3[2][0] == "CHAVAN SAHIL PRAKASH MEENA"
    assert top3[2][1] == 775.0

    # 7. Quality audit findings
    cat = get_catalog(con)
    assert cat["students_count"] == 145
    assert cat["courses_count"] == 27


def test_test1_commerce_same_layout():
    """Verify test1_commerce_same_layout.xlsx."""
    wb_path = DATA_DIR / "test1_commerce_same_layout.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.students_count == 60
    assert rep.courses_count == 10
    assert rep.sheets_accepted == ["Sheet1"]

    divs = sorted([r[0] for r in con.execute("SELECT DISTINCT division FROM students").fetchall()])
    assert divs == ["A", "B", "C"]


def test_test1_same_layout_10courses_3divs():
    """Verify test1_same_layout_10courses_3divs.xlsx."""
    wb_path = DATA_DIR / "test1_same_layout_10courses_3divs.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.students_count == 60
    assert rep.courses_count == 10
    assert rep.sheets_accepted == ["Sheet1"]

    divs = sorted([r[0] for r in con.execute("SELECT DISTINCT division FROM students").fetchall()])
    assert divs == ["A", "B", "C"]


def test_test2_lifesci_vague_single_row():
    """Verify test2_lifesci_vague_single_row.xlsx."""
    wb_path = DATA_DIR / "test2_lifesci_vague_single_row.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.students_count == 45
    assert rep.courses_count == 7
    assert rep.sheets_accepted == ["Results Oct"]
    assert rep.layout["rows_per_student"] == 1, "Expected single-row layout detection"

    # Batches check
    divs = sorted([r[0] for r in con.execute("SELECT DISTINCT division FROM students").fetchall()])
    assert divs == ["Batch 1", "Batch 2"]

    # Verify ABS flags captured
    abs_count = con.execute("SELECT COUNT(*) FROM scores WHERE flag='ABS'").fetchone()[0]
    assert abs_count > 0, "Expected ABS flags to be captured"


def test_test2_vague_single_row_batches():
    """Verify test2_vague_single_row_batches.xlsx."""
    wb_path = DATA_DIR / "test2_vague_single_row_batches.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.students_count == 45
    assert rep.courses_count == 7
    assert rep.sheets_accepted == ["Results Oct"]
    assert rep.layout["rows_per_student"] == 1


def test_test3_arts_messy_sheet_per_division():
    """Verify test3_arts_messy_sheet_per_division.xlsx multi-sheet ingestion."""
    wb_path = DATA_DIR / "test3_arts_messy_sheet_per_division.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.sheets_accepted == ["Div A", "Div B"], f"Expected both sheets accepted, got {rep.sheets_accepted}"
    assert rep.students_count == 50, f"Expected 50 combined students (25 Div A + 25 Div B), got {rep.students_count}"
    assert rep.courses_count == 8

    div_counts = dict(con.execute("SELECT division, COUNT(*) FROM students GROUP BY division").fetchall())
    assert div_counts == {"A": 25, "B": 25}, f"Expected Div A: 25, Div B: 25, got {div_counts}"


def test_test3_messy_sheet_per_division():
    """Verify test3_messy_sheet_per_division.xlsx multi-sheet ingestion."""
    wb_path = DATA_DIR / "test3_messy_sheet_per_division.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")

    con, rep = ingest(wb_path, db_path=":memory:")
    assert rep.sheets_accepted == ["Div A", "Div B"], f"Expected both sheets accepted, got {rep.sheets_accepted}"
    assert rep.students_count == 50, f"Expected 50 combined students (25 Div A + 25 Div B), got {rep.students_count}"
    assert rep.courses_count == 8

    div_counts = dict(con.execute("SELECT division, COUNT(*) FROM students GROUP BY division").fetchall())
    assert div_counts == {"A": 25, "B": 25}, f"Expected Div A: 25, Div B: 25, got {div_counts}"
