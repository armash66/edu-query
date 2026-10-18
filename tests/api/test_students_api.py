"""Integration tests for /api/v1/students endpoints."""
from __future__ import annotations

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.core.database import init_database, populate_table
from app.main import app


@pytest.fixture
def student_api_db():
    """Create controlled, isolated student records for API tests."""
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
        {"student_id": "STU_Alpha_01", "course_code": "CS102"},
        {"student_id": "STU_Beta_02", "course_code": "CS102"},
    ]
    populate_table(con, "enrollment", enrollments)

    scores = [
        # Student 1: passes both
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "component": "TH", "value": 70.0, "flag": None, "state": "marked", "raw_text": "70", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "component": "IA", "value": 18.0, "flag": None, "state": "marked", "raw_text": "18", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_Alpha_01", "course_code": "CS102", "component": "TH", "value": 65.0, "flag": None, "state": "marked", "raw_text": "65", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_Alpha_01", "course_code": "CS102", "component": "IA", "value": 17.0, "flag": None, "state": "marked", "raw_text": "17", "source_sheet": "Sheet1", "source_row": 10},
        # Student 2: fails CS101 with explicit F flag on ESE, passes CS102
        {"student_id": "STU_Beta_02", "course_code": "CS101", "component": "TH", "value": 20.0, "flag": "F", "state": "marked", "raw_text": "20 F", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "component": "IA", "value": 15.0, "flag": None, "state": "marked", "raw_text": "15", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_Beta_02", "course_code": "CS102", "component": "TH", "value": 60.0, "flag": None, "state": "marked", "raw_text": "60", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_Beta_02", "course_code": "CS102", "component": "IA", "value": 16.0, "flag": None, "state": "marked", "raw_text": "16", "source_sheet": "Sheet1", "source_row": 12},
    ]
    populate_table(con, "scores", scores)

    grades = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "letter": "A"},
        {"student_id": "STU_Alpha_01", "course_code": "CS102", "letter": "B"},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "letter": "F"},
        {"student_id": "STU_Beta_02", "course_code": "CS102", "letter": "B"},
    ]
    populate_table(con, "grades", grades)

    reconciliation = [
        {"student_id": "STU_Alpha_01", "course_code": "CS101", "printed_total": 88.0, "computed_total": 88.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_Alpha_01", "course_code": "CS102", "printed_total": 82.0, "computed_total": 82.0, "total_match": True, "grade": "B", "flags": ""},
        {"student_id": "STU_Beta_02", "course_code": "CS101", "printed_total": 35.0, "computed_total": 35.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_Beta_02", "course_code": "CS102", "printed_total": 76.0, "computed_total": 76.0, "total_match": True, "grade": "B", "flags": ""},
    ]
    populate_table(con, "reconciliation", reconciliation)

    return con


@pytest.fixture
def client(student_api_db):
    app.dependency_overrides[get_db] = lambda: student_api_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# 1. Roster Listing Tests
def test_students_roster_default_pagination(client):
    resp = client.get("/api/v1/students")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["limit"] == 50
    assert data["offset"] == 0
    assert len(data["items"]) == 3
    # Check no raw database internal fields leaked
    first = data["items"][0]
    assert "source_sheet" not in first
    assert "source_row" not in first


def test_students_roster_custom_pagination(client):
    resp = client.get("/api/v1/students?limit=2&offset=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["limit"] == 2
    assert data["offset"] == 1
    assert len(data["items"]) == 2


def test_students_roster_division_filter(client):
    resp_a = client.get("/api/v1/students?division=A")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["total"] == 2
    assert all(s["division"] == "A" for s in data_a["items"])

    resp_b = client.get("/api/v1/students?division=B")
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["total"] == 1
    assert data_b["items"][0]["student_id"] == "STU_Gamma_03"


def test_students_roster_result_filter(client):
    resp_pass = client.get("/api/v1/students?result=PASSES")
    assert resp_pass.status_code == 200
    assert resp_pass.json()["total"] == 2

    resp_fail = client.get("/api/v1/students?result=FAILS")
    assert resp_fail.status_code == 200
    assert resp_fail.json()["total"] == 1
    assert resp_fail.json()["items"][0]["student_id"] == "STU_Beta_02"


def test_students_roster_search_query(client):
    resp = client.get("/api/v1/students?query=Aarav")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["student_id"] == "STU_Alpha_01"


def test_students_roster_invalid_pagination(client):
    # limit < 1
    r1 = client.get("/api/v1/students?limit=0")
    assert r1.status_code == 422

    # limit > 100
    r2 = client.get("/api/v1/students?limit=101")
    assert r2.status_code == 422

    # offset < 0
    r3 = client.get("/api/v1/students?offset=-1")
    assert r3.status_code == 422


# 2. Student Breakdown Tests
def test_student_breakdown_resolved_success(client):
    resp = client.get("/api/v1/students/STU_Alpha_01/breakdown")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["student"]["student_id"] == "STU_Alpha_01"
    assert data["total_enrolled"] == 2
    assert data["passed_count"] == 2
    assert data["failed_count"] == 0
    assert len(data["subjects"]) == 2


def test_student_breakdown_failing_student_classification(client):
    resp = client.get("/api/v1/students/STU_Beta_02/breakdown")
    assert resp.status_code == 200
    data = resp.json()
    assert data["student"]["student_id"] == "STU_Beta_02"
    assert data["total_enrolled"] == 2
    assert data["passed_count"] == 1
    assert data["failed_count"] == 1
    # Check course CS101 is classified as failed
    cs101 = next(s for s in data["subjects"] if s["course_code"] == "CS101")
    assert cs101["recorded_result"] == "failed"
    assert cs101["letter_grade"] == "F"
    assert "F" in cs101["flags"]
    assert cs101["components"]["TH"]["flag"] == "F"


def test_student_breakdown_case_insensitive_lookup(client):
    resp_lower = client.get("/api/v1/students/stu_alpha_01/breakdown")
    assert resp_lower.status_code == 200
    assert resp_lower.json()["student"]["student_id"] == "STU_Alpha_01"

    resp_mixed = client.get("/api/v1/students/StU_aLpHa_01/breakdown")
    assert resp_mixed.status_code == 200
    assert resp_mixed.json()["student"]["student_id"] == "STU_Alpha_01"


def test_student_breakdown_unknown_identifier_returns_404(client):
    resp = client.get("/api/v1/students/UNKNOWN_ID_999/breakdown")
    assert resp.status_code == 404
    data = resp.json()
    assert data["status"] == "not_found"
    assert data["error_code"] == "STUDENT_NOT_FOUND"
    assert data["query"] == "UNKNOWN_ID_999"


def test_student_breakdown_ambiguous_identifier_returns_409(client):
    # 'Sharma' matches STU_Alpha_01 and STU_Beta_02
    resp = client.get("/api/v1/students/Sharma/breakdown")
    assert resp.status_code == 409
    data = resp.json()
    assert data["status"] == "ambiguous"
    assert data["error_code"] == "AMBIGUOUS_STUDENT_QUERY"
    assert len(data["candidates"]) == 2
    candidate_ids = {c["student_id"] for c in data["candidates"]}
    assert candidate_ids == {"STU_Alpha_01", "STU_Beta_02"}
