"""Regression tests for Faculty Reporting and CSV Export with Anti-Formula Injection (Phase 6 Workstream E)."""

import csv
import io
import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.core.database import init_database, populate_table
from app.main import app
from app.services.export_service import sanitize_csv_cell


@pytest.fixture
def export_test_db():
    """Create controlled, isolated records for export tests."""
    con = duckdb.connect(":memory:")
    init_database(con)

    students = [
        {
            "student_id": "STU_Alpha_01",
            "seat_no": "SEAT-99A",
            "roll_no": "101",
            "name": "Aarav Sharma",
            "division": "A",
            "result": "PASSES",
            "sgpi": 9.2,
            "total_marks": 750.0,
            "source_sheet": "Sheet1",
            "source_row": 10,
        },
        {
            "student_id": "STU_Beta_02",
            "seat_no": "SEAT-99B",
            "roll_no": "102",
            "name": "Bhavya Sharma",
            "division": "A",
            "result": "FAILS",
            "sgpi": 0.0,
            "total_marks": 520.0,
            "source_sheet": "Sheet1",
            "source_row": 12,
        },
        {
            "student_id": "STU_Gamma_03",
            "seat_no": "SEAT-100C",
            "roll_no": "201",
            "name": "Chetan Verma",
            "division": "B",
            "result": "PASSES",
            "sgpi": 8.1,
            "total_marks": 680.0,
            "source_sheet": "Sheet1",
            "source_row": 14,
        },
    ]
    populate_table(con, "students", students)

    courses = [
        {"code": "CS101", "name": "Algorithms", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        {"code": "CS102", "name": "Operating Systems", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
    ]
    populate_table(con, "courses", courses)

    enrollments = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101"},
        {"student_id": "STU_Beta_02", "course_code": "CS101"},
        {"student_id": "STU_Gamma_03", "course_code": "CS101"},
    ]
    populate_table(con, "enrollment", enrollments)

    scores = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "component": "TH", "value": 70.0, "flag": None, "state": "marked", "raw_text": "70", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "component": "IA", "value": 18.0, "flag": None, "state": "marked", "raw_text": "18", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "component": "TH", "value": 20.0, "flag": "F", "state": "marked", "raw_text": "20 F", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "component": "IA", "value": 15.0, "flag": None, "state": "marked", "raw_text": "15", "source_sheet": "Sheet1", "source_row": 12},
    ]
    populate_table(con, "scores", scores)

    grades = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "letter": "A"},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "letter": "F"},
    ]
    populate_table(con, "grades", grades)

    reconciliation = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "printed_total": 88.0, "computed_total": 88.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "printed_total": 35.0, "computed_total": 35.0, "total_match": True, "grade": "F", "flags": "F"},
    ]
    populate_table(con, "reconciliation", reconciliation)

    return con


@pytest.fixture
def client(export_test_db):
    app.dependency_overrides[get_db] = lambda: export_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_sanitize_csv_cell_neutralizes_formula_injection():
    # Formula injection characters: =, @, \t, \r, and non-numeric expressions starting with +, -
    assert sanitize_csv_cell("=CMD|' /C calc'!A0") == "'=CMD|' /C calc'!A0"
    assert sanitize_csv_cell("+SUM(A1:A10)") == "'+SUM(A1:A10)"
    assert sanitize_csv_cell("-CMD|' /C calc'!A0") == "'-CMD|' /C calc'!A0"
    assert sanitize_csv_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_csv_cell("\tTabbed") == "'\tTabbed"
    assert sanitize_csv_cell("\rCarriage") == "'\rCarriage"

    # Legitimate numbers (integers, floats, and signed numeric strings) must be preserved
    assert sanitize_csv_cell(-50) == "-50"
    assert sanitize_csv_cell(-12.5) == "-12.5"
    assert sanitize_csv_cell("+10") == "+10"
    assert sanitize_csv_cell("-50") == "-50"
    assert sanitize_csv_cell(100) == "100"
    assert sanitize_csv_cell(0) == "0"
    assert sanitize_csv_cell(0.0) == "0.0"

    # Safe text remains unchanged
    assert sanitize_csv_cell("PCEC12T") == "PCEC12T"
    assert sanitize_csv_cell("John Doe") == "John Doe"
    assert sanitize_csv_cell(None) == ""


def test_export_students_roster_csv_success(client):
    response = client.get("/api/v1/students/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "student_roster.csv" in response.headers["content-disposition"]

    reader = csv.reader(io.StringIO(response.text))
    title_row = next(reader)
    assert "# EduQuery V3" in title_row[0]
    headers = next(reader)
    assert "Student ID" in headers
    assert "Name" in headers
    assert "Overall Result" in headers

    rows = list(reader)
    assert len(rows) == 3, f"Expected 3 student rows in export, got {len(rows)}"


def test_export_students_roster_with_division_filter(client):
    response = client.get("/api/v1/students/export?division=A")
    assert response.status_code == 200
    reader = csv.reader(io.StringIO(response.text))
    _ = next(reader)  # title
    headers = next(reader)
    div_idx = headers.index("Division")
    rows = list(reader)
    assert len(rows) == 2
    for row in rows:
        assert row[div_idx] == "A"


def test_export_student_breakdown_csv_success(client):
    response = client.get("/api/v1/students/STU_Beta_02/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "student_STU_Beta_02_breakdown.csv" in response.headers["content-disposition"]

    text = response.text
    assert "Course Code" in text
    assert "CS101" in text
    assert "Classification Reason" in text
    assert "FAILING_LETTER_GRADE" in text


def test_export_student_breakdown_not_found(client):
    response = client.get("/api/v1/students/NON_EXISTENT_STUDENT_999/export")
    assert response.status_code == 404
    data = response.json()
    assert data.get("status") == "not_found" or "error_message" in data


def test_export_subject_failures_csv_success(client):
    response = client.get("/api/v1/subjects/CS101/failures/export")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "subject_CS101_failures.csv" in response.headers["content-disposition"]

    text = response.text
    assert "Failure Reason" in text
    assert "Seat No" in text
    assert "SEAT-99B" in text
    assert "FAILING_LETTER_GRADE" in text


def test_export_subject_failures_not_found(client):
    response = client.get("/api/v1/subjects/INVALID_COURSE_CODE_404/failures/export")
    assert response.status_code == 404
    data = response.json()
    assert data.get("status") == "not_found" or "error_message" in data


def test_export_students_roster_empty_filter(client):
    response = client.get("/api/v1/students/export?division=NON_EXISTENT_DIV")
    assert response.status_code == 200
    reader = csv.reader(io.StringIO(response.text))
    _ = next(reader)  # title
    headers = next(reader)
    rows = list(reader)
    assert len(rows) == 0, "Expected zero student rows for non-existent division"
    assert "Student ID" in headers


def test_export_csv_escapes_commas_quotes_and_preserves_unicode(export_test_db):
    # Insert student with commas, quotes, and unicode characters
    populate_table(
        export_test_db,
        "students",
        [{
            "student_id": "STU_Unicode_99",
            "name": 'Sharma, Jr. "Top Ranker" (आदित्य शर्मा)',
            "seat_no": "SEAT-UNICODE",
            "roll_no": "999",
            "division": "U",
            "result": "PASSES",
            "sgpi": 10.0,
            "total_marks": 800.0,
            "source_sheet": "Sheet1",
            "source_row": 99,
        }],
    )

    app.dependency_overrides[get_db] = lambda: export_test_db
    with TestClient(app) as test_client:
        response = test_client.get("/api/v1/students/export?division=U")
        assert response.status_code == 200
        reader = csv.reader(io.StringIO(response.text))
        _ = next(reader)  # title
        headers = next(reader)
        rows = list(reader)
        assert len(rows) == 1
        row = rows[0]
        assert len(row) == len(headers), "Each row must strictly match header length"
        name_idx = headers.index("Name")
        assert row[name_idx] == 'Sharma, Jr. "Top Ranker" (आदित्य शर्मा)'
    app.dependency_overrides.clear()

