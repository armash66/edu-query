"""Integration tests for the Interactive Academic Investigation Engine API."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_investigation_capabilities():
    """Verify investigation capability registry returns supported fields and operators."""
    response = client.get("/api/v1/investigation/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "fields" in data
    assert data["max_conditions"] == 10
    assert "AND" in data["supported_logic"]
    assert "OR" in data["supported_logic"]

    fields_by_name = {f["field"]: f for f in data["fields"]}
    assert "division" in fields_by_name
    assert "result" in fields_by_name
    assert "course_code" in fields_by_name
    assert "multi_fails" in fields_by_name
    assert "total_marks" in fields_by_name
    assert "sgpi" in fields_by_name


def test_investigation_query_all_records():
    """Verify empty query returns all cohort students with accurate cohort total."""
    response = client.post("/api/v1/investigation/query", json={"limit": 20, "offset": 0})
    assert response.status_code == 200
    data = response.json()
    assert data["cohort_total"] == 145
    assert data["total"] == 145
    assert len(data["items"]) == 20
    assert "All cohort students" in data["active_explanation"]


def test_investigation_query_and_logic():
    """Verify AND logic properly restricts cohort to intersection of conditions."""
    payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "division", "operator": "eq", "value": "A"},
                {"field": "result", "operator": "eq", "value": "FAILS"},
            ],
        },
        "limit": 50,
    }
    response = client.post("/api/v1/investigation/query", json={**payload})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10
    assert "Division is 'A' AND Outcome is 'FAILS'" in data["active_explanation"]
    for item in data["items"]:
        assert item["division"] == "A"
        assert item["overall_result"] == "FAILS"


def test_investigation_query_or_logic():
    """Verify OR logic correctly combines disjoint sets."""
    payload = {
        "group": {
            "logic": "OR",
            "conditions": [
                {"field": "student_id", "operator": "contains", "value": "A0004"},
                {"field": "student_id", "operator": "contains", "value": "A0007"},
            ],
        },
    }
    response = client.post("/api/v1/investigation/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    student_ids = {item["student_id"] for item in data["items"]}
    assert "23108A0004" in student_ids
    assert "23108A0007" in student_ids


def test_investigation_query_multi_fails():
    """Verify multi_fails condition accurately isolates students with >= 2 failed courses."""
    payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "multi_fails", "operator": "eq", "value": True},
            ],
        },
    }
    response = client.post("/api/v1/investigation/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 9
    assert "Failing 2 or more subjects" in data["active_explanation"]


def test_investigation_query_marks_range():
    """Verify numeric range query filtering on total marks."""
    payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "total_marks", "operator": "gte", "value": 700.0},
            ],
        },
    }
    response = client.post("/api/v1/investigation/query", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["total_marks"] >= 700.0


def test_investigation_query_invalid_field_rejected():
    """Verify invalid or unallowed fields are rejected with 422 Unprocessable Entity."""
    payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "malicious_column_drop_table", "operator": "eq", "value": "test"},
            ],
        },
    }
    response = client.post("/api/v1/investigation/query", json=payload)
    assert response.status_code == 422


def test_investigation_query_complexity_limit():
    """Verify query with more than 10 conditions is rejected or truncated safely."""
    excessive_conditions = [
        {"field": "division", "operator": "eq", "value": f"DIV_{i}"}
        for i in range(15)
    ]
    payload = {
        "group": {
            "logic": "AND",
            "conditions": excessive_conditions,
        },
    }
    response = client.post("/api/v1/investigation/query", json=payload)
    assert response.status_code == 422


def test_investigation_sql_injection_safety():
    """Verify SQL injection attempts in values are safely parameterized."""
    injection_payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "name", "operator": "contains", "value": "'; DROP TABLE students; --"},
            ],
        },
    }
    response = client.post("/api/v1/investigation/query", json=injection_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0

    # Ensure table students is intact
    check_res = client.post("/api/v1/investigation/query", json={"limit": 1})
    assert check_res.status_code == 200
    assert check_res.json()["cohort_total"] == 145


def test_investigation_csv_export():
    """Verify formula-safe unpaginated CSV export generation."""
    payload = {
        "group": {
            "logic": "AND",
            "conditions": [
                {"field": "division", "operator": "eq", "value": "A"},
                {"field": "result", "operator": "eq", "value": "FAILS"},
            ],
        },
    }
    response = client.post("/api/v1/investigation/export-csv", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    content = response.text
    lines = content.splitlines()
    assert "# EduQuery V3 - Academic Investigation Export" in lines[0]
    assert "Total Matching Records: 10" in lines[2]
    # Header row
    assert "Student ID,Name,Roll No,Seat No,Division,Level,Total Marks,Overall Result,SGPI,CGPA,Source Sheet,Source Row" in content
    # Data rows exist
    assert "23108A0032" in content
