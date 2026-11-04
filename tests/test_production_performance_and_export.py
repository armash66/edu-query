"""Automated regression and verification test suite for production performance,
session restoration, Excel provenance headers, and failed-subject query translation.
"""
from __future__ import annotations

import io
import duckdb
import openpyxl
import pytest

from app.api.schemas.investigation import (
    InvestigationQueryRequest,
    InvestigationFilterGroup,
    InvestigationCondition,
)
from app.core.database import init_database, populate_table
from app.services.export_service import (
    export_investigation_excel,
    export_students_roster_excel,
    export_absent_students_excel,
    export_merit_list_excel,
    export_failed_absent_excel,
)
from app.services.investigation_service import execute_investigation_query
from app.services.ai_service import translate_natural_query


@pytest.fixture
def test_db():
    """Create an in-memory DuckDB database with verified synthetic students and reconciliation records."""
    con = duckdb.connect(":memory:")
    init_database(con)

    # 4 students: 2 pass all, 1 fails 1 subject, 1 fails 2 subjects
    populate_table(
        con,
        "students",
        [
            {
                "student_id": "STU_P1",
                "name": "Alice Pass",
                "seat_no": "SEAT_01",
                "roll_no": "R01",
                "division": "A",
                "level": "UG",
                "total_marks": 750.0,
                "result": "PASSES",
                "sgpi": 9.5,
                "cgpa": 9.2,
                "source_sheet": "Sheet1",
                "source_row": 8,
            },
            {
                "student_id": "STU_P2",
                "name": "=HYPERLINK(\"http://evil.com\")",  # formula injection attempt
                "seat_no": "SEAT_02",
                "roll_no": "R02",
                "division": "A",
                "level": "UG",
                "total_marks": 710.0,
                "result": "PASSES",
                "sgpi": 8.8,
                "cgpa": 8.5,
                "source_sheet": "Sheet1",
                "source_row": 10,
            },
            {
                "student_id": "STU_F1",
                "name": "Bob SingleFail",
                "seat_no": "SEAT_03",
                "roll_no": "R03",
                "division": "B",
                "level": "UG",
                "total_marks": 520.0,
                "result": "FAILS",
                "sgpi": 5.2,
                "cgpa": 5.5,
                "source_sheet": "Sheet1",
                "source_row": 12,
            },
            {
                "student_id": "STU_F2",
                "name": "Charlie MultiFail",
                "seat_no": "SEAT_04",
                "roll_no": "R04",
                "division": "B",
                "level": "UG",
                "total_marks": 410.0,
                "result": "FAILS",
                "sgpi": 3.8,
                "cgpa": 4.1,
                "source_sheet": "Sheet1",
                "source_row": 14,
            },
        ],
    )

    populate_table(
        con,
        "courses",
        [
            {"code": "CS101", "name": "Algorithms", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
            {"code": "CS102", "name": "Operating Systems", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        ],
    )

    # Reconciliation grades
    populate_table(
        con,
        "reconciliation",
        [
            # STU_P1: pass both
            {"student_id": "STU_P1", "course_code": "CS101", "grade": "A", "printed_total": 85.0, "computed_total": 85.0, "total_match": True, "flags": ""},
            {"student_id": "STU_P1", "course_code": "CS102", "grade": "O", "printed_total": 92.0, "computed_total": 92.0, "total_match": True, "flags": ""},
            # STU_P2: pass both
            {"student_id": "STU_P2", "course_code": "CS101", "grade": "B", "printed_total": 70.0, "computed_total": 70.0, "total_match": True, "flags": ""},
            {"student_id": "STU_P2", "course_code": "CS102", "grade": "A", "printed_total": 80.0, "computed_total": 80.0, "total_match": True, "flags": ""},
            # STU_F1: fail CS101, pass CS102 (1 fail)
            {"student_id": "STU_F1", "course_code": "CS101", "grade": "F", "printed_total": 28.0, "computed_total": 28.0, "total_match": True, "flags": "F"},
            {"student_id": "STU_F1", "course_code": "CS102", "grade": "C", "printed_total": 55.0, "computed_total": 55.0, "total_match": True, "flags": ""},
            # STU_F2: fail both CS101 and CS102 (2 fails)
            {"student_id": "STU_F2", "course_code": "CS101", "grade": "F", "printed_total": 22.0, "computed_total": 22.0, "total_match": True, "flags": "F"},
            {"student_id": "STU_F2", "course_code": "CS102", "grade": "FAIL", "printed_total": 19.0, "computed_total": 19.0, "total_match": True, "flags": "F"},
        ],
    )

    # Scores table for absent / provenance
    populate_table(
        con,
        "scores",
        [
            {"student_id": "STU_P1", "course_code": "CS101", "component": "TH", "raw_text": "70", "value": 70.0, "flag": None, "source_sheet": "Sheet1", "source_row": 8},
            {"student_id": "STU_F1", "course_code": "CS101", "component": "TH", "raw_text": "AB", "value": None, "flag": "AB", "source_sheet": "Sheet1", "source_row": 12},
        ],
    )

    return con


def test_investigation_excel_source_sheet_and_row_headers(test_db):
    """Test 5, 6, 7: Investigation export contains 15 headers, Source Sheet at N5, Source Row at O5."""
    filename, content = export_investigation_excel(
        con=test_db,
        where_sql="1=1",
        params=[],
        order_clause="student_id ASC",
        explanation="Test Cohort",
    )
    assert filename == "EduQuery_Academic_Investigation.xlsx"

    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb["Investigation Results"]

    # Header Row 5 assertions
    assert ws.cell(row=5, column=1).value == "Student ID"
    assert ws.cell(row=5, column=2).value == "Student Name"
    assert ws.cell(row=5, column=13).value == "Absent Subjects"
    assert ws.cell(row=5, column=14).value == "Source Sheet"
    assert ws.cell(row=5, column=15).value == "Source Row"

    # Verify Col N and Col O styling
    for col in (14, 15):
        cell = ws.cell(row=5, column=col)
        assert cell.fill.start_color.rgb == "001E293B"
        assert cell.font.color.rgb == "00FFFFFF"
        assert cell.font.bold is True

    # Verify widths >= 14
    assert ws.column_dimensions["N"].width >= 14.0
    assert ws.column_dimensions["O"].width >= 12.0

    # Test 8: Data row provenance matches source
    row6_sid = ws.cell(row=6, column=1).value
    assert row6_sid == "STU_F1"
    assert ws.cell(row=6, column=14).value == "Sheet1"
    assert ws.cell(row=6, column=15).value == 12

    # Verify auto-filter range covers entire data table (A5:O9)
    assert ws.auto_filter.ref == "A5:O9"


def test_investigation_excel_formula_injection_protection(test_db):
    """Test 10: Formula injection protection prevents leading =, +, -, @ execution."""
    filename, content = export_investigation_excel(
        con=test_db,
        where_sql="student_id = 'STU_P2'",
        params=[],
        order_clause="student_id ASC",
        explanation="Formula injection test",
    )
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active

    name_val = str(ws.cell(row=6, column=2).value or "")
    # Sanitized cell must not begin with a raw '='
    assert not name_val.startswith("=")
    assert "'" in name_val or name_val.startswith(" ") or name_val.startswith("'")


def test_failed_subject_count_zero_and_edge_cases(test_db):
    """Test 11: failed_subject_count query handles = 0, <= 0, <= 1, and >= 1 accurately."""
    # 1. = 0 (Passing students: STU_P1, STU_P2)
    req_eq_0 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="eq", value=0)],
        )
    )
    res_eq_0 = execute_investigation_query(test_db, req_eq_0)
    assert res_eq_0.total == 2
    matched_ids = {s.student_id for s in res_eq_0.items}
    assert matched_ids == {"STU_P1", "STU_P2"}

    # 2. <= 0 (Same as = 0)
    req_lte_0 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="lte", value=0)],
        )
    )
    res_lte_0 = execute_investigation_query(test_db, req_lte_0)
    assert res_lte_0.total == 2

    # 3. <= 1 (Students with 0 or 1 fail: STU_P1, STU_P2, STU_F1)
    req_lte_1 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="lte", value=1)],
        )
    )
    res_lte_1 = execute_investigation_query(test_db, req_lte_1)
    assert res_lte_1.total == 3
    assert {s.student_id for s in res_lte_1.items} == {"STU_P1", "STU_P2", "STU_F1"}

    # 4. >= 1 (Students with at least 1 fail: STU_F1, STU_F2)
    req_gte_1 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="gte", value=1)],
        )
    )
    res_gte_1 = execute_investigation_query(test_db, req_gte_1)
    assert res_gte_1.total == 2
    assert {s.student_id for s in res_gte_1.items} == {"STU_F1", "STU_F2"}

    # 5. multi_fails == True (>= 2 fails: STU_F2)
    req_multi = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="multi_fails", operator="eq", value=True)],
        )
    )
    res_multi = execute_investigation_query(test_db, req_multi)
    assert res_multi.total == 1
    assert res_multi.items[0].student_id == "STU_F2"


def test_ask_ai_natural_language_queries(test_db):
    """Test Ask AI maps natural language queries to intended AST predicates."""
    # "at least one failed subject" -> failed_subject_count >= 1
    resp1 = translate_natural_query(test_db, "Find students with at least one failed subject")
    assert resp1.results is not None
    assert resp1.results.total == 2

    # "0 failed subjects" -> failed_subject_count == 0
    resp2 = translate_natural_query(test_db, "Show students with zero failed subjects")
    assert resp2.results is not None
    assert resp2.results.total == 2


def test_all_excel_exports_audit(test_db):
    """Test 9: Audit all Excel export functions to ensure valid headers and column alignments."""
    # 1. Student roster
    fn, content = export_students_roster_excel(test_db)
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    assert ws.cell(row=1, column=1).value == "Student ID"
    assert ws.cell(row=1, column=14).value == "Source Sheet"
    assert ws.cell(row=1, column=15).value == "Source Row"
    assert ws.max_column == 15

    # 2. Absent students
    fn, content = export_absent_students_excel(test_db)
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    assert ws.cell(row=4, column=1).value == "Roll No"
    assert ws.cell(row=4, column=15).value == "Source Sheet"
    assert ws.cell(row=4, column=16).value == "Source Row"
    assert ws.max_column == 16

    # 3. Merit list
    fn, content = export_merit_list_excel(test_db)
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    assert ws.cell(row=1, column=1).value == "Rank"
    assert ws.cell(row=1, column=2).value == "Student ID"
    assert ws.max_column == 12

    # 4. Failed / absent actionable roster
    fn, content = export_failed_absent_excel(test_db)
    wb = openpyxl.load_workbook(io.BytesIO(content))
    ws = wb.active
    assert ws.cell(row=1, column=1).value == "Student ID"
    assert ws.cell(row=1, column=8).value == "Failed Subjects Count"
    assert ws.max_column == 13


def test_failed_subject_hardened_flag_permutations():
    """Test exact token flag matching across all required permutations:
    F, AB,F, AB,E,F, E, AB, empty flags, NULL flags, and unrelated tokens (OFFLINE, FIRST_CLASS).
    """
    con = duckdb.connect(":memory:")
    init_database(con)

    students = [
        {"student_id": "STU_1", "name": "Single F Flag", "division": "A", "level": "UG", "result": "FAILS", "seat_no": "S1", "roll_no": "R1"},
        {"student_id": "STU_2", "name": "AB,F Flag", "division": "A", "level": "UG", "result": "FAILS", "seat_no": "S2", "roll_no": "R2"},
        {"student_id": "STU_3", "name": "AB,E,F Flag", "division": "A", "level": "UG", "result": "FAILS", "seat_no": "S3", "roll_no": "R3"},
        {"student_id": "STU_4", "name": "E Flag (Exempt/Grace)", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S4", "roll_no": "R4"},
        {"student_id": "STU_5", "name": "AB Flag (Absent Only)", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S5", "roll_no": "R5"},
        {"student_id": "STU_6", "name": "Empty Flag", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S6", "roll_no": "R6"},
        {"student_id": "STU_7", "name": "NULL Flag", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S7", "roll_no": "R7"},
        {"student_id": "STU_8", "name": "OFFLINE Flag (Not F)", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S8", "roll_no": "R8"},
        {"student_id": "STU_9", "name": "FIRST_CLASS Flag (Not F)", "division": "A", "level": "UG", "result": "PASSES", "seat_no": "S9", "roll_no": "R9"},
    ]
    populate_table(con, "students", students)

    reconciliation = [
        {"student_id": "STU_1", "course_code": "C1", "grade": "F", "flags": "F", "printed_total": 20.0, "computed_total": 20.0, "total_match": True},
        {"student_id": "STU_2", "course_code": "C1", "grade": None, "flags": "AB,F", "printed_total": 0.0, "computed_total": 0.0, "total_match": True},
        {"student_id": "STU_3", "course_code": "C1", "grade": None, "flags": "AB,E,F", "printed_total": 10.0, "computed_total": 10.0, "total_match": True},
        {"student_id": "STU_4", "course_code": "C1", "grade": "D", "flags": "E", "printed_total": 45.0, "computed_total": 45.0, "total_match": True},
        {"student_id": "STU_5", "course_code": "C1", "grade": "AB", "flags": "AB", "printed_total": 0.0, "computed_total": 0.0, "total_match": True},
        {"student_id": "STU_6", "course_code": "C1", "grade": "A", "flags": "", "printed_total": 80.0, "computed_total": 80.0, "total_match": True},
        {"student_id": "STU_7", "course_code": "C1", "grade": "B", "flags": None, "printed_total": 70.0, "computed_total": 70.0, "total_match": True},
        {"student_id": "STU_8", "course_code": "C1", "grade": None, "flags": "OFFLINE", "printed_total": 50.0, "computed_total": 50.0, "total_match": True},
        {"student_id": "STU_9", "course_code": "C1", "grade": None, "flags": "FIRST_CLASS", "printed_total": 75.0, "computed_total": 75.0, "total_match": True},
    ]
    populate_table(con, "reconciliation", reconciliation)

    # Query: students with >= 1 failed subjects
    # Must match ONLY STU_1, STU_2, STU_3
    # Must NOT match STU_4 (E), STU_5 (AB), STU_6 (empty), STU_7 (NULL), STU_8 (OFFLINE), STU_9 (FIRST_CLASS)
    req_gte_1 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="gte", value=1)],
        )
    )
    res_gte_1 = execute_investigation_query(con, req_gte_1)
    matched_ids = {s.student_id for s in res_gte_1.items}
    assert matched_ids == {"STU_1", "STU_2", "STU_3"}, f"Expected STU_1, STU_2, STU_3 but got {matched_ids}"

    # Query: students with = 0 failed subjects
    # Must match STU_4, STU_5, STU_6, STU_7, STU_8, STU_9 (6 students)
    req_eq_0 = InvestigationQueryRequest(
        group=InvestigationFilterGroup(
            logic="AND",
            conditions=[InvestigationCondition(field="failed_subject_count", operator="eq", value=0)],
        )
    )
    res_eq_0 = execute_investigation_query(con, req_eq_0)
    matched_eq_0 = {s.student_id for s in res_eq_0.items}
    assert matched_eq_0 == {"STU_4", "STU_5", "STU_6", "STU_7", "STU_8", "STU_9"}, f"Unexpected zero fails match: {matched_eq_0}"
    con.close()
