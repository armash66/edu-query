"""Integration tests for application startup and /health endpoint."""
from __future__ import annotations

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import app, create_app


@pytest.fixture
def clean_client():
    """Create a client with no dependency overrides."""
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def populated_db():
    """Create an in-memory DuckDB database with verified synthetic records."""
    con = duckdb.connect(":memory:")
    init_database(con)
    populate_table(
        con,
        "students",
        [
            {"student_id": "STU_01", "name": "Student One", "seat_no": "S01", "roll_no": "1", "division": "A", "result": "PASSES"},
            {"student_id": "STU_02", "name": "Student Two", "seat_no": "S02", "roll_no": "2", "division": "B", "result": "FAILS"},
        ],
    )
    populate_table(
        con,
        "courses",
        [
            {"code": "CS101", "name": "Computer Science I", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
        ],
    )
    return con


def test_app_routes_registered(clean_client):
    """Verify all required API endpoints are registered in OpenAPI schema."""
    resp = clean_client.get("/openapi.json")
    assert resp.status_code == 200
    paths = resp.json()["paths"]
    expected_paths = {
        "/health",
        "/api/v1/students",
        "/api/v1/students/{identifier}/breakdown",
        "/api/v1/subjects",
        "/api/v1/subjects/failure-summary",
        "/api/v1/subjects/{course_code}/failures",
        "/api/v1/data-quality",
    }
    assert expected_paths.issubset(set(paths.keys()))


def test_health_missing_database_returns_503():
    """Verify /health returns 503 and connected=False when database file is missing."""
    missing_app = create_app(Settings(database_path="missing_test_db_non_existent.duckdb"))
    with TestClient(missing_app) as client:
        resp = client.get("/health")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "unhealthy"
        assert data["database"]["connected"] is False
        assert data["database"]["students_count"] is None
        assert data["database"]["courses_count"] is None


def test_health_empty_tables_returns_503(clean_client):
    """Verify /health returns 503 when database is connected but uninitialized (no tables)."""
    con_empty = duckdb.connect(":memory:")
    app.dependency_overrides[get_db] = lambda: con_empty
    resp = clean_client.get("/health")
    assert resp.status_code == 503
    data = resp.json()
    assert data["status"] == "unhealthy"
    assert data["database"]["connected"] is False


def test_health_healthy_database_returns_200(clean_client, populated_db):
    """Verify /health returns 200 with real student and course counts from database."""
    app.dependency_overrides[get_db] = lambda: populated_db
    resp = clean_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"]["connected"] is True
    assert data["database"]["students_count"] == 2
    assert data["database"]["courses_count"] == 1


def test_application_factory_independent_configuration():
    """Verify create_app creates independent application instances without state leaks."""
    app1 = create_app()
    app2 = create_app()
    assert app1 is not app2
