"""Security, injection safety, and error resilience integration tests."""
from __future__ import annotations

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import DatabaseUnavailableError, get_db
from app.core.database import init_database, populate_table
from app.main import app


@pytest.fixture
def test_db():
    con = duckdb.connect(":memory:")
    init_database(con)
    populate_table(
        con,
        "students",
        [
            {"student_id": "STU_Alpha_01", "name": "Aarav Sharma", "seat_no": "S01", "roll_no": "1", "division": "A", "result": "PASSES"},
            {"student_id": "STU_Special", "name": "Special 100% Student", "seat_no": "S02", "roll_no": "2", "division": "A", "result": "PASSES"},
        ],
    )
    populate_table(
        con,
        "courses",
        [{"code": "CS101", "name": "Computer Science", "kind": "theory", "credits": 4.0, "components": "TH"}],
    )
    populate_table(con, "enrollment", [{"student_id": "STU_Alpha_01", "course_code": "CS101"}])
    populate_table(con, "grades", [{"student_id": "STU_Alpha_01", "course_code": "CS101", "letter": "A"}])
    populate_table(con, "reconciliation", [{"student_id": "STU_Alpha_01", "course_code": "CS101", "printed_total": 85.0, "computed_total": 85.0, "total_match": True, "grade": "A", "flags": ""}])
    return con


@pytest.fixture
def client(test_db):
    app.dependency_overrides[get_db] = lambda: test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# 1. SQL Injection Parameterization Tests
def test_sql_injection_student_breakdown_safe(client, test_db):
    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE students; --",
        "STU_Alpha_01' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL --",
        "%' OR 1=1 --",
    ]
    for payload in payloads:
        resp = client.get(f"/api/v1/students/{payload}/breakdown")
        assert resp.status_code == 404
        data = resp.json()
        assert data["status"] == "not_found"
        assert data["error_code"] == "STUDENT_NOT_FOUND"

    # Verify table integrity preserved
    count = test_db.execute("SELECT count(*) FROM students").fetchone()[0]
    assert count == 2


def test_sql_injection_course_failures_safe(client, test_db):
    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE courses; --",
        "CS101' OR 1=1 --",
    ]
    for payload in payloads:
        resp = client.get(f"/api/v1/subjects/{payload}/failures")
        assert resp.status_code == 404
        assert resp.json()["status"] == "not_found"

    # Verify courses table preserved
    count = test_db.execute("SELECT count(*) FROM courses").fetchone()[0]
    assert count == 1


# 2. Wildcard Literal Safety Tests
def test_literal_wildcard_search_safety(client):
    # Search for '100%' should find 'Special 100% Student' without broad matching
    resp = client.get("/api/v1/students?query=100%")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["student_id"] == "STU_Special"

    # Search for '%%%' matches zero students
    resp_blank = client.get("/api/v1/students?query=%%%")
    assert resp_blank.status_code == 200
    assert resp_blank.json()["total"] == 0


# 3. Validation and Error Masking Tests
def test_invalid_pagination_returns_422(client):
    resp = client.get("/api/v1/students?limit=invalid_number")
    assert resp.status_code == 422
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "VALIDATION_ERROR"
    assert len(data["details"]) > 0


def test_internal_server_error_masks_details():
    def broken_db():
        raise RuntimeError("Secret internal path C:\\secrets\\db.key crashed")

    app.dependency_overrides[get_db] = broken_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        resp = test_client.get("/api/v1/students")
        assert resp.status_code == 500
        data = resp.json()
        assert data["status"] == "error"
        assert data["error_code"] == "INTERNAL_SERVER_ERROR"
        # Confirm no internal stack trace or secret path is leaked
        assert "secrets" not in str(data)
        assert "Traceback" not in str(data)

    app.dependency_overrides.clear()
