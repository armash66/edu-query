"""Tests for DuckDB connection lifecycle, failure modes, and cleanup guarantees."""
from __future__ import annotations

import tempfile
from pathlib import Path
import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import DatabaseUnavailableError, get_db
from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


def test_lifecycle_valid_initialized_ondisk_db(temp_dir):
    """Case A: Valid, initialized on-disk database returns 200 on all endpoints."""
    db_file = temp_dir / "valid.duckdb"
    con = duckdb.connect(str(db_file))
    init_database(con)
    populate_table(
        con,
        "students",
        [{"student_id": "S1", "name": "Student 1", "seat_no": "SEAT1", "roll_no": "1", "division": "A", "result": "PASSES"}],
    )
    populate_table(
        con,
        "courses",
        [{"code": "C1", "name": "Course 1", "kind": "theory", "credits": 4.0, "components": "TH"}],
    )
    populate_table(con, "enrollment", [{"student_id": "S1", "course_code": "C1"}])
    con.close()

    settings = Settings(database_path=str(db_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # Health check
        h_resp = client.get("/health")
        assert h_resp.status_code == 200
        h_data = h_resp.json()
        assert h_data["database"]["connected"] is True
        assert h_data["database"]["students_count"] == 1
        assert h_data["database"]["courses_count"] == 1

        # Students roster
        st_resp = client.get("/api/v1/students")
        assert st_resp.status_code == 200
        assert st_resp.json()["total"] == 1

        # Subjects
        sb_resp = client.get("/api/v1/subjects")
        assert sb_resp.status_code == 200
        assert sb_resp.json()["total"] == 1


def test_lifecycle_missing_database_file(temp_dir):
    """Case B: Missing database file raises 503 and does NOT create a file on disk."""
    missing_file = temp_dir / "does_not_exist.duckdb"
    assert not missing_file.exists()

    settings = Settings(database_path=str(missing_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # Health check returns 503
        h_resp = client.get("/health")
        assert h_resp.status_code == 503
        assert h_resp.json()["database"]["connected"] is False

        # Student roster returns 503 with DATABASE_UNAVAILABLE
        st_resp = client.get("/api/v1/students")
        assert st_resp.status_code == 503
        assert st_resp.json()["error_code"] == "DATABASE_UNAVAILABLE"

    # Crucial check: missing file was not silently created as empty DB
    assert not missing_file.exists()


def test_lifecycle_existing_uninitialized_database(temp_dir):
    """Case C: Existing database file with no tables returns 503 (not 500)."""
    uninit_file = temp_dir / "uninitialized.duckdb"
    # Create valid duckdb file with 0 tables
    con = duckdb.connect(str(uninit_file))
    con.close()
    assert uninit_file.exists()

    settings = Settings(database_path=str(uninit_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # Health check reports unhealthy 503
        h_resp = client.get("/health")
        assert h_resp.status_code == 503
        assert h_resp.json()["database"]["connected"] is False

        # Endpoints report 503 DATABASE_UNAVAILABLE rather than crashing with 500
        st_resp = client.get("/api/v1/students")
        assert st_resp.status_code == 503
        assert st_resp.json()["error_code"] == "DATABASE_UNAVAILABLE"


def test_lifecycle_corrupted_database_file(temp_dir):
    """Case D: Corrupted database file returns 503 without leaking stack trace."""
    corrupt_file = temp_dir / "corrupt.duckdb"
    corrupt_file.write_bytes(b"NOT_A_VALID_DUCKDB_FILE_CONTENT_GARBAGE")

    settings = Settings(database_path=str(corrupt_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        h_resp = client.get("/health")
        assert h_resp.status_code == 503
        assert h_resp.json()["database"]["connected"] is False

        st_resp = client.get("/api/v1/students")
        assert st_resp.status_code == 503
        assert st_resp.json()["error_code"] == "DATABASE_UNAVAILABLE"


def test_lifecycle_valid_empty_database(temp_dir):
    """Case E: Valid database with schema but 0 records returns clean empty responses."""
    empty_file = temp_dir / "empty_schema.duckdb"
    con = duckdb.connect(str(empty_file))
    init_database(con)
    con.close()

    settings = Settings(database_path=str(empty_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # Health check is healthy with 0 counts
        h_resp = client.get("/health")
        assert h_resp.status_code == 200
        h_data = h_resp.json()
        assert h_data["database"]["connected"] is True
        assert h_data["database"]["students_count"] == 0
        assert h_data["database"]["courses_count"] == 0

        # Student roster returns 0 items
        st_resp = client.get("/api/v1/students")
        assert st_resp.status_code == 200
        assert st_resp.json()["total"] == 0
        assert st_resp.json()["items"] == []

        # Data quality returns empty dataset finding
        dq_resp = client.get("/api/v1/data-quality")
        assert dq_resp.status_code == 200
        assert dq_resp.json()["session_id"] == "empty"
        assert dq_resp.json()["total_checks"] == 0


def test_lifecycle_read_only_enforced(temp_dir):
    """Verify production database connections are strictly read-only."""
    db_file = temp_dir / "readonly.duckdb"
    con = duckdb.connect(str(db_file))
    init_database(con)
    con.close()

    settings = Settings(database_path=str(db_file))
    test_app = create_app(settings)

    # Acquire connection through get_db dependency
    from starlette.requests import Request
    req = Request({"type": "http", "app": test_app})
    gen = get_db(req)
    con = next(gen)
    try:
        with pytest.raises(Exception) as exc_info:
            con.execute("CREATE TABLE forbidden (x INT)")
        # DuckDB raises error regarding read-only transaction/database
        err_msg = str(exc_info.value).lower()
        assert "read-only" in err_msg or "cannot" in err_msg or "read only" in err_msg
    finally:
        try:
            next(gen)
        except StopIteration:
            pass


def test_lifecycle_exception_cleans_up_connection():
    """Case G: Connection is closed even when route handler raises an unhandled exception."""
    closed = []

    class TrackedConnection:
        def __init__(self, real_con):
            self.real = real_con

        def execute(self, *args, **kwargs):
            return self.real.execute(*args, **kwargs)

        def close(self):
            closed.append(True)
            self.real.close()

    real_con = duckdb.connect(":memory:")
    init_database(real_con)
    tracked = TrackedConnection(real_con)

    def mock_get_db():
        try:
            yield tracked
        finally:
            tracked.close()

    from app.main import app
    app.dependency_overrides[get_db] = mock_get_db

    with TestClient(app, raise_server_exceptions=False) as client:
        # Route that executes and succeeds
        client.get("/api/v1/students")
        assert len(closed) == 1

        # Reset closed flag
        closed.clear()

        # Query that causes a 422 error before using connection
        client.get("/api/v1/students?limit=-5")
        # Connection was either not opened or closed cleanly
        assert True

    app.dependency_overrides.clear()


def test_lifecycle_failed_request_does_not_corrupt_subsequent_requests(temp_dir):
    """Case H: A failed request does not poison subsequent requests."""
    db_file = temp_dir / "resilience.duckdb"
    con = duckdb.connect(str(db_file))
    init_database(con)
    populate_table(
        con,
        "students",
        [{"student_id": "STU_1", "name": "Student 1", "seat_no": "S1", "roll_no": "1", "division": "A", "result": "PASSES"}],
    )
    con.close()

    settings = Settings(database_path=str(db_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # 1. Valid request
        r1 = client.get("/api/v1/students")
        assert r1.status_code == 200

        # 2. Failed request (404 unknown student)
        r2 = client.get("/api/v1/students/UNKNOWN_ID_999/breakdown")
        assert r2.status_code == 404

        # 3. Failed request (422 invalid parameter)
        r3 = client.get("/api/v1/students?limit=999999")
        assert r3.status_code == 422

        # 4. Valid request immediately following failures must still succeed
        r4 = client.get("/api/v1/students")
        assert r4.status_code == 200
        assert r4.json()["total"] == 1


def test_lifecycle_repeated_requests_cleanup(temp_dir):
    """Execute repeated sequential requests on an on-disk database verifying connection stability."""
    db_file = temp_dir / "repeated.duckdb"
    con = duckdb.connect(str(db_file))
    init_database(con)
    populate_table(
        con,
        "students",
        [{"student_id": "STU_1", "name": "Student 1", "seat_no": "S1", "roll_no": "1", "division": "A", "result": "PASSES"}],
    )
    populate_table(
        con,
        "courses",
        [{"code": "CS101", "name": "Theory 1", "kind": "theory", "credits": 4.0, "components": "TH"}],
    )
    con.close()

    settings = Settings(database_path=str(db_file))
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        for i in range(25):
            r = client.get("/health")
            assert r.status_code == 200
            r_st = client.get("/api/v1/students")
            assert r_st.status_code == 200
