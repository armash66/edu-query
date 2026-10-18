"""Integration tests for /api/v1/subjects endpoints and ground-truth reconciliation."""
from __future__ import annotations

from pathlib import Path
import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.core.database import init_database, populate_table
from app.core.ingest import ingest
from app.main import app

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


@pytest.fixture
def subject_api_db():
    """Create controlled synthetic subject and failure data."""
    con = duckdb.connect(":memory:")
    init_database(con)

    students = [
        {"student_id": "STU_01", "name": "Student A1", "seat_no": "S01", "roll_no": "1", "division": "A", "result": "PASSES", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_02", "name": "Student A2", "seat_no": "S02", "roll_no": "2", "division": "A", "result": "FAILS", "source_sheet": "Sheet1", "source_row": 11},
        {"student_id": "STU_03", "name": "Student B1", "seat_no": "S03", "roll_no": "3", "division": "B", "result": "PASSES", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_04", "name": "Student B2", "seat_no": "S04", "roll_no": "4", "division": "B", "result": "FAILS", "source_sheet": "Sheet1", "source_row": 13},
    ]
    populate_table(con, "students", students)

    courses = [
        {"code": "CS101", "name": "Theory of Computing", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        {"code": "CS102", "name": "Theory of Programming", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        {"code": "CS103L", "name": "Computing Lab", "kind": "practical", "credits": 2.0, "components": "PR"},
    ]
    populate_table(con, "courses", courses)

    # CS101 has all 4 enrolled; STU_02 and STU_04 fail
    enrollments = [
        {"student_id": "STU_01", "course_code": "CS101"},
        {"student_id": "STU_02", "course_code": "CS101"},
        {"student_id": "STU_03", "course_code": "CS101"},
        {"student_id": "STU_04", "course_code": "CS101"},
        # Elective CS103L has only Division A enrolled
        {"student_id": "STU_01", "course_code": "CS103L"},
        {"student_id": "STU_02", "course_code": "CS103L"},
    ]
    populate_table(con, "enrollment", enrollments)

    scores = [
        {"student_id": "STU_01", "course_code": "CS101", "component": "TH", "value": 60.0, "flag": None, "state": "marked", "raw_text": "60", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_02", "course_code": "CS101", "component": "TH", "value": 25.0, "flag": "F", "state": "marked", "raw_text": "25 F", "source_sheet": "Sheet1", "source_row": 11},
        {"student_id": "STU_03", "course_code": "CS101", "component": "TH", "value": 75.0, "flag": None, "state": "marked", "raw_text": "75", "source_sheet": "Sheet1", "source_row": 12},
        {"student_id": "STU_04", "course_code": "CS101", "component": "TH", "value": 20.0, "flag": "F", "state": "marked", "raw_text": "20 F", "source_sheet": "Sheet1", "source_row": 13},
        {"student_id": "STU_01", "course_code": "CS103L", "component": "PR", "value": 45.0, "flag": None, "state": "marked", "raw_text": "45", "source_sheet": "Sheet1", "source_row": 10},
        {"student_id": "STU_02", "course_code": "CS103L", "component": "PR", "value": 40.0, "flag": None, "state": "marked", "raw_text": "40", "source_sheet": "Sheet1", "source_row": 11},
    ]
    populate_table(con, "scores", scores)

    grades = [
        {"student_id": "STU_01", "course_code": "CS101", "letter": "B"},
        {"student_id": "STU_02", "course_code": "CS101", "letter": "F"},
        {"student_id": "STU_03", "course_code": "CS101", "letter": "A"},
        {"student_id": "STU_04", "course_code": "CS101", "letter": "F"},
        {"student_id": "STU_01", "course_code": "CS103L", "letter": "A"},
        {"student_id": "STU_02", "course_code": "CS103L", "letter": "B"},
    ]
    populate_table(con, "grades", grades)

    reconciliation = [
        {"student_id": "STU_01", "course_code": "CS101", "printed_total": 75.0, "computed_total": 75.0, "total_match": True, "grade": "B", "flags": ""},
        {"student_id": "STU_02", "course_code": "CS101", "printed_total": 35.0, "computed_total": 35.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_03", "course_code": "CS101", "printed_total": 90.0, "computed_total": 90.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_04", "course_code": "CS101", "printed_total": 30.0, "computed_total": 30.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_01", "course_code": "CS103L", "printed_total": 45.0, "computed_total": 45.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_02", "course_code": "CS103L", "printed_total": 40.0, "computed_total": 40.0, "total_match": True, "grade": "B", "flags": ""},
    ]
    populate_table(con, "reconciliation", reconciliation)

    return con


@pytest.fixture
def client(subject_api_db):
    app.dependency_overrides[get_db] = lambda: subject_api_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# 1. Course Catalog Tests
def test_subjects_catalog_listing(client):
    resp = client.get("/api/v1/subjects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    codes = [c["code"] for c in data["items"]]
    assert codes == ["CS101", "CS102", "CS103L"]


def test_subjects_catalog_kind_filtering(client):
    resp_th = client.get("/api/v1/subjects?kind=theory")
    assert resp_th.status_code == 200
    assert resp_th.json()["total"] == 2

    resp_pr = client.get("/api/v1/subjects?kind=practical")
    assert resp_pr.status_code == 200
    assert resp_pr.json()["total"] == 1
    assert resp_pr.json()["items"][0]["code"] == "CS103L"


# 2. Failure Summary Routing & Content Tests
def test_subjects_failure_summary_routing_and_ordering(client):
    resp = client.get("/api/v1/subjects/failure-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_courses_evaluated"] >= 1
    # CS101 has 2 failures, CS103L has 0 failures; sorted descending
    top = data["summary"][0]
    assert top["course_code"] == "CS101"
    assert top["confirmed_failures_count"] == 2
    assert top["total_enrolled"] == 4
    assert top["failure_rate_percent"] == 50.0


# 3. Subject Failure Roster Tests
def test_subject_failures_classwide(client):
    resp = client.get("/api/v1/subjects/CS101/failures")
    assert resp.status_code == 200
    data = resp.json()
    assert data["course_code"] == "CS101"
    assert data["total_enrolled"] == 4
    assert data["confirmed_failures_count"] == 2
    assert data["failure_rate_percent"] == 50.0
    assert len(data["failing_students"]) == 2
    failing_ids = {s["student_id"] for s in data["failing_students"]}
    assert failing_ids == {"STU_02", "STU_04"}


def test_subject_failures_division_filtering_and_reconciliation(client):
    resp_a = client.get("/api/v1/subjects/CS101/failures?division=A")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["division_filter"] == "A"
    assert data_a["total_enrolled"] == 2
    assert data_a["confirmed_failures_count"] == 1
    assert data_a["failing_students"][0]["student_id"] == "STU_02"

    resp_b = client.get("/api/v1/subjects/CS101/failures?division=B")
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["division_filter"] == "B"
    assert data_b["total_enrolled"] == 2
    assert data_b["confirmed_failures_count"] == 1
    assert data_b["failing_students"][0]["student_id"] == "STU_04"

    # Reconciliation
    assert data_a["confirmed_failures_count"] + data_b["confirmed_failures_count"] == 2


def test_subject_with_zero_confirmed_failures(client):
    """A subject with 0 confirmed failures returns 200, confirmed_failures_count == 0, and failing_students == []."""
    resp = client.get("/api/v1/subjects/CS103L/failures")
    assert resp.status_code == 200
    data = resp.json()
    assert data["course_code"] == "CS103L"
    assert data["total_enrolled"] == 2
    assert data["confirmed_failures_count"] == 0
    assert data["failure_rate_percent"] == 0.0
    assert data["failing_students"] == []



def test_subject_failures_unknown_course_returns_404(client):
    resp = client.get("/api/v1/subjects/UNKNOWN_COURSE_999/failures")
    assert resp.status_code == 404
    data = resp.json()
    assert data["status"] == "not_found"
    assert data["error_code"] == "COURSE_NOT_FOUND"


def test_subject_failures_ambiguous_name_returns_409(client):
    # Query 'Theory of' matches both CS101 and CS102
    resp = client.get("/api/v1/subjects/Theory of/failures")
    assert resp.status_code == 409
    data = resp.json()
    assert data["status"] == "ambiguous"
    assert data["error_code"] == "AMBIGUOUS_COURSE_QUERY"
    assert len(data["candidates"]) == 2


# 4. Verified Ground-Truth Workbook Acceptance Integration
def test_real_workbook_ground_truth_reconciliation_via_api():
    wb_path = DATA_DIR / "Result_anonymized.xlsx"
    if not wb_path.exists():
        pytest.skip("Result_anonymized.xlsx not found")

    con, _ = ingest(wb_path, db_path=":memory:")
    app.dependency_overrides[get_db] = lambda: con

    with TestClient(app) as test_client:
        # Class-wide PCEC12T
        resp_all = test_client.get("/api/v1/subjects/PCEC12T/failures")
        assert resp_all.status_code == 200
        data_all = resp_all.json()
        assert data_all["course_code"] == "PCEC12T"
        assert data_all["course_name"] == "THEORY OF COMPUTER SCIENCE"
        assert data_all["total_enrolled"] == 145
        assert data_all["confirmed_failures_count"] == 12
        assert len(data_all["failing_students"]) == 12
        assert abs(data_all["failure_rate_percent"] - 8.28) < 0.05

        # Division A
        resp_a = test_client.get("/api/v1/subjects/PCEC12T/failures?division=A")
        assert resp_a.status_code == 200
        data_a = resp_a.json()
        assert data_a["total_enrolled"] == 85
        assert data_a["confirmed_failures_count"] == 10
        assert len(data_a["failing_students"]) == 10
        assert abs(data_a["failure_rate_percent"] - 11.76) < 0.05

        # Division B
        resp_b = test_client.get("/api/v1/subjects/PCEC12T/failures?division=B")
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        assert data_b["total_enrolled"] == 60
        assert data_b["confirmed_failures_count"] == 2
        assert len(data_b["failing_students"]) == 2
        assert abs(data_b["failure_rate_percent"] - 3.33) < 0.05

        # Ground-truth mathematical reconciliation
        assert data_a["confirmed_failures_count"] + data_b["confirmed_failures_count"] == data_all["confirmed_failures_count"]
        assert data_a["total_enrolled"] + data_b["total_enrolled"] == data_all["total_enrolled"]

    app.dependency_overrides.clear()
