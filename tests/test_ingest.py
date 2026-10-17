"""Unit tests for the EduQuery V3 ingestion engine."""
from __future__ import annotations

import tempfile
from pathlib import Path

import openpyxl
import pytest

from app.core.ingest import AmbiguousLayoutError, clean_text, detect_layout, ingest, parse_cell


def test_parse_cell_clean_numeric():
    val, flag, state = parse_cell("45")
    assert val == 45.0
    assert flag is None
    assert state == "marked"


def test_parse_cell_with_suffix_flags():
    val, flag, state = parse_cell("32F")
    assert val == 32.0
    assert flag == "F"
    assert state == "marked"

    val_e, flag_e, state_e = parse_cell("18E")
    assert val_e == 18.0
    assert flag_e == "E"
    assert state_e == "marked"


def test_parse_cell_absence_markers():
    val, flag, state = parse_cell("AB")
    assert val is None
    assert flag == "AB"
    assert state == "flagged"

    val_abs, flag_abs, state_abs = parse_cell("ABS")
    assert val_abs is None
    assert flag_abs == "ABS"
    assert state_abs == "flagged"


def test_parse_cell_blank_and_placeholders():
    val, flag, state = parse_cell("")
    assert val is None
    assert flag is None
    assert state == "not_enrolled"

    val_na, flag_na, state_na = parse_cell("N/A")
    assert val_na is None
    assert flag_na is None
    assert state_na == "uncalculated"

    val_dash, flag_dash, state_dash = parse_cell("-")
    assert val_dash is None
    assert flag_dash is None
    assert state_dash == "uncalculated"


def test_parse_cell_numeric_zero():
    val, flag, state = parse_cell("0")
    assert val == 0.0
    assert flag is None
    assert state == "marked"

    val_f, flag_f, state_f = parse_cell(0.0)
    assert val_f == 0.0
    assert flag_f is None
    assert state_f == "marked"


def test_ambiguous_layout_rejection():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "EmptySheet"
    ws.cell(1, 1, "OnlyOneCell")
    with pytest.raises(AmbiguousLayoutError):
        detect_layout(ws)


def test_missing_student_identity_rejection():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "NoIdentity"
    ws.cell(1, 1, "Subject 1")
    ws.cell(1, 2, "Subject 2")
    ws.cell(2, 1, 50)
    ws.cell(2, 2, 60)
    with pytest.raises(AmbiguousLayoutError, match="No student identity column"):
        detect_layout(ws)


def test_provenance_tracking():
    data_dir = Path(__file__).resolve().parent.parent / "data"
    sample_file = data_dir / "test1_commerce_same_layout.xlsx"
    if not sample_file.exists():
        pytest.skip(f"Sample file {sample_file} not found")

    con, rep = ingest(sample_file, db_path=":memory:")
    student_rows = con.execute("SELECT student_id, source_sheet, source_row FROM students LIMIT 5").fetchall()
    assert len(student_rows) == 5
    for sid, sheet, row in student_rows:
        assert sheet == "Sheet1"
        assert row >= 8

    score_rows = con.execute("SELECT student_id, course_code, source_sheet, source_row FROM scores LIMIT 5").fetchall()
    assert len(score_rows) == 5
    for sid, ccode, sheet, row in score_rows:
        assert sheet == "Sheet1"
        assert row >= 8
