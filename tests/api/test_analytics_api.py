"""Integration tests for /api/v1/analytics endpoints."""
from __future__ import annotations

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.core.database import init_database, populate_table
from app.main import app


@pytest.fixture
def analytics_test_db():
    """Create controlled multi-course, multi-division marksheet database for analytics tests."""
    con = duckdb.connect(":memory:")
    init_database(con)

    # 4 students across 2 divisions:
    # S1 (Div A): passes all
    # S2 (Div A): fails CS101 only
    # S3 (Div B): fails CS101 and CS102 (multi-fail)
    # S4 (Div B): passes all
    students = [
        {"student_id": "STU_01", "name": "Student One", "seat_no": "A1", "roll_no": "101", "division": "A", "result": "PASSES", "total_marks": 170.0},
        {"student_id": "STU_02", "name": "Student Two", "seat_no": "A2", "roll_no": "102", "division": "A", "result": "FAILS", "total_marks": 110.0},
        {"student_id": "STU_03", "name": "Student Three", "seat_no": "B1", "roll_no": "201", "division": "B", "result": "FAILS", "total_marks": 90.0},
        {"student_id": "STU_04", "name": "Student Four", "seat_no": "B2", "roll_no": "202", "division": "B", "result": "PASSES", "total_marks": 160.0},
    ]
    populate_table(con, "students", students)

    courses = [
        {"code": "CS101", "name": "Algorithms", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        {"code": "CS102", "name": "Database Systems", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
    ]
    populate_table(con, "courses", courses)

    enrollment = [
        {"student_id": "STU_01", "course_code": "CS101"},
        {"student_id": "STU_01", "course_code": "CS102"},
        {"student_id": "STU_02", "course_code": "CS101"},
        {"student_id": "STU_02", "course_code": "CS102"},
        {"student_id": "STU_03", "course_code": "CS101"},
        {"student_id": "STU_03", "course_code": "CS102"},
        {"student_id": "STU_04", "course_code": "CS101"},
        {"student_id": "STU_04", "course_code": "CS102"},
    ]
    populate_table(con, "enrollment", enrollment)

    reconciliation = [
        {"student_id": "STU_01", "course_code": "CS101", "printed_total": 85.0, "computed_total": 85.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_01", "course_code": "CS102", "printed_total": 85.0, "computed_total": 85.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_02", "course_code": "CS101", "printed_total": 35.0, "computed_total": 35.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_02", "course_code": "CS102", "printed_total": 75.0, "computed_total": 75.0, "total_match": True, "grade": "B", "flags": ""},
        {"student_id": "STU_03", "course_code": "CS101", "printed_total": 30.0, "computed_total": 30.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_03", "course_code": "CS102", "printed_total": 32.0, "computed_total": 32.0, "total_match": True, "grade": "F", "flags": "F"},
        {"student_id": "STU_04", "course_code": "CS101", "printed_total": 80.0, "computed_total": 80.0, "total_match": True, "grade": "A", "flags": ""},
        {"student_id": "STU_04", "course_code": "CS102", "printed_total": 80.0, "computed_total": 80.0, "total_match": True, "grade": "A", "flags": ""},
    ]
    populate_table(con, "reconciliation", reconciliation)

    return con


@pytest.fixture
def client(analytics_test_db):
    app.dependency_overrides[get_db] = lambda: analytics_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_analytics_overview_endpoint(client):
    """Verify /api/v1/analytics/overview returns exact metrics, distributions, and findings."""
    resp = client.get("/api/v1/analytics/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_students"] == 4
    assert data["total_courses"] == 2
    assert data["passed_students"] == 2
    assert data["failed_students"] == 2
    assert data["unresolved_students"] == 0

    # Outcome distribution
    dist = {d["status"]: d["count"] for d in data["outcome_distribution"]}
    assert dist["Passed"] == 2
    assert dist["Failed"] == 2

    # Top failing courses (CS101 has 2 fails / 4 enrolled = 50%; CS102 has 1 fail / 4 enrolled = 25%)
    top = data["top_failing_courses"]
    assert len(top) == 2
    assert top[0]["course_code"] == "CS101"
    assert top[0]["failed_count"] == 2
    assert top[0]["failure_rate_percent"] == 50.0

    # Division summary
    divs = {d["division"]: d for d in data["division_summary"]}
    assert divs["A"]["student_count"] == 2
    assert divs["A"]["passed_count"] == 1
    assert divs["A"]["failed_count"] == 1
    assert divs["B"]["student_count"] == 2

    # Deterministic findings
    assert len(data["findings"]) >= 1
    finding_ids = [f["id"] for f in data["findings"]]
    assert "highest_failing_course" in finding_ids
    assert "multi_subject_failures" in finding_ids


def test_division_comparison_endpoint(client):
    """Verify /api/v1/analytics/division-comparison returns comparative division data."""
    resp = client.get("/api/v1/analytics/division-comparison")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["divisions"]) == 2
    assert len(data["course_breakdown"]) == 4  # 2 courses * 2 divisions


def test_failure_patterns_endpoint(client):
    """Verify /api/v1/analytics/failure-patterns detects multi-course failures and co-occurrences."""
    resp = client.get("/api/v1/analytics/failure-patterns")
    assert resp.status_code == 200
    data = resp.json()

    # Histogram: 1 student (STU_02) fails 1 course; 1 student (STU_03) fails 2 courses
    hist = data["failure_count_histogram"]
    assert hist["1_course"] == 1
    assert hist["2_courses"] == 1

    # Multi failing students roster
    multi = data["multi_failing_students"]
    assert len(multi) == 1
    assert multi[0]["student_id"] == "STU_03"
    assert multi[0]["failed_courses_count"] == 2
    assert set(multi[0]["failed_courses"]) == {"CS101", "CS102"}

    # Co-failing pairs
    pairs = data["co_failing_pairs"]
    assert len(pairs) == 1
    assert pairs[0]["course_a"] == "CS101"
    assert pairs[0]["course_b"] == "CS102"
    assert pairs[0]["co_fail_count"] == 1


def test_distributions_endpoint(client):
    """Verify /api/v1/analytics/distributions returns score buckets and grade frequencies."""
    # Cohort-wide marks distribution
    resp = client.get("/api/v1/analytics/distributions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_records"] == 4
    assert len(data["score_buckets"]) > 0

    # Course-specific marks distribution
    resp_cs = client.get("/api/v1/analytics/distributions?course_code=CS101")
    assert resp_cs.status_code == 200
    data_cs = resp_cs.json()
    assert data_cs["course_code"] == "CS101"
    assert data_cs["total_records"] == 4
    # Grades: 2 'A', 2 'F'
    grades = {g["grade"]: g["count"] for g in data_cs["grade_frequencies"]}
    assert grades["A"] == 2
    assert grades["F"] == 2


def test_analysis_registry_endpoint(client):
    """Verify /api/v1/analytics/registry returns all 6 analytical capabilities."""
    resp = client.get("/api/v1/analytics/registry")
    assert resp.status_code == 200
    data = resp.json()
    analyses = data["analyses"]
    assert len(analyses) == 6
    ids = {a["id"] for a in analyses}
    assert ids == {
        "overall_outcome",
        "subject_failures",
        "division_comparison",
        "failure_patterns",
        "distributions",
        "data_quality_alerts",
    }
