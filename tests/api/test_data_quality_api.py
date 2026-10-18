"""Integration tests for /api/v1/data-quality endpoint."""
from __future__ import annotations

import json
import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.core.database import init_database, populate_table
from app.main import app


@pytest.fixture
def empty_db():
    con = duckdb.connect(":memory:")
    init_database(con)
    return con


@pytest.fixture
def quality_db():
    con = duckdb.connect(":memory:")
    init_database(con)

    # Ingest synthetic layout profile
    con.execute("INSERT INTO layout_profiles (fingerprint, layout_spec) VALUES ('audit_test_session', '{}')")

    # Populate students with a deliberate duplicate ID anomaly
    students = [
        {"student_id": "STU_DUP", "name": "Student A", "seat_no": "S01", "roll_no": "1", "division": "A", "result": "PASSES"},
        {"student_id": "STU_DUP", "name": "Student B", "seat_no": "S02", "roll_no": "2", "division": "A", "result": "FAILS"},
        {"student_id": "STU_03", "name": "Student C", "seat_no": "S03", "roll_no": "3", "division": "B", "result": "PASSES"},
    ]
    populate_table(con, "students", students)

    # Record synthetic finding
    findings = [
        {
            "check_id": "duplicate_student_id",
            "severity": "error",
            "title": "Duplicate Student Identifiers",
            "count": 1,
            "problem": "1 student identifier appears multiple times.",
            "impact": "Headcounts and rankings corrupted.",
            "recommended_action": "Deduplicate student rows.",
            "details_json": json.dumps(["Student ID: STU_DUP"]),
        }
    ]
    populate_table(con, "quality_findings", findings)

    return con


def test_data_quality_empty_dataset():
    """Verify empty dataset returns distinguished empty response without crashing."""
    con = duckdb.connect(":memory:")
    init_database(con)
    app.dependency_overrides[get_db] = lambda: con

    with TestClient(app) as client:
        resp = client.get("/api/v1/data-quality")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "empty"
        assert data["total_checks"] == 0
        assert data["quality_score"] == 100.0
        assert len(data["findings"]) == 1
        assert data["findings"][0]["check_id"] == "empty_dataset"

    app.dependency_overrides.clear()


def test_data_quality_populated_findings(quality_db):
    """Verify recorded data quality findings serialize accurately with calculated score."""
    app.dependency_overrides[get_db] = lambda: quality_db

    with TestClient(app) as client:
        resp = client.get("/api/v1/data-quality")
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == "audit_test_session"
        assert data["error_count"] == 1
        assert data["health_status"] == "Critical"
        assert data["quality_score"] == 75.0  # 100 - (1 * 25)
        assert len(data["findings"]) == 1
        f = data["findings"][0]
        assert f["check_id"] == "duplicate_student_id"
        assert f["severity"] == "error"

    app.dependency_overrides.clear()
