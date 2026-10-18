"""Automated tests for Phase 12 Privacy-First Temporary Analysis Sessions & Deletion Lifecycle.

Verifies:
1. Temporary session creation does NOT mutate permanent dataset directory or pointer file.
2. Session-scoped database connection routing via X-EduQuery-Session-Token or cookie.
3. Strict isolation between concurrent sessions (zero data or review leakage).
4. Permanent session deletion completely purges server-side workspace, database, and reviews.
5. Idempotent deletion behavior.
6. Session expiration handling and automatic cleanup.
7. Mode B explicit opt-in to promote session to persistent storage.
"""
from __future__ import annotations

import io
import json
import os
import tempfile
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app
from app.services.session_manager import (
    cleanup_expired_sessions,
    confirm_temporary_session,
    delete_temporary_session,
    get_session_status,
)


@pytest.fixture
def temp_storage():
    """Create isolated temporary data directory."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        (tmp_path / "sessions").mkdir(parents=True, exist_ok=True)
        (tmp_path / "datasets").mkdir(parents=True, exist_ok=True)
        (tmp_path / "reviews").mkdir(parents=True, exist_ok=True)

        old_data_dir = os.environ.get("EDUQUERY_DATA_DIR")
        os.environ["EDUQUERY_DATA_DIR"] = str(tmp_path)
        yield tmp_path
        if old_data_dir is not None:
            os.environ["EDUQUERY_DATA_DIR"] = old_data_dir
        else:
            os.environ.pop("EDUQUERY_DATA_DIR", None)


def build_synthetic_xlsx_bytes(sheet_name: str = "Sheet1", student_id: str = "S01", student_name: str = "Alex") -> bytes:
    """Build a minimal valid Excel OpenXML marksheet buffer."""
    buf = io.BytesIO()
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name

    # Header structure matching 2-row layout
    ws.append(["Seat No", "Student Name", "Division", "CS101", None, "Total", "Result"])
    ws.append([None, None, None, "TH", "IA", None, None])
    ws.append(["1001", student_name, "A", 60, 20, 80, "PASSES"])

    wb.save(buf)
    return buf.getvalue()


def test_temporary_session_upload_and_preview_no_admin_key(temp_storage):
    """Verify upload succeeds without requiring any administrative key and does not mutate permanent data."""
    settings = Settings(
        app_env="production",
        database_path=str(temp_storage / "datasets" / "permanent_default.duckdb"),
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(temp_storage / "active_dataset.json"),
        import_api_key="admin-only-secret-never-needed-by-faculty",
    )
    test_app = create_app(settings)

    xlsx_bytes = build_synthetic_xlsx_bytes()

    with TestClient(test_app) as client:
        # 1. Upload workbook to /api/v1/session/upload (NO admin key header provided!)
        resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("my_marksheet.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["mode"] == "temporary"
        assert data["state"] == "preview_ready"
        assert data["students_count"] == 1
        assert "session_id" in data
        session_id = data["session_id"]

        # 2. Verify session cookie and header were set
        assert "eduquery_session" in resp.cookies
        assert resp.headers.get("X-EduQuery-Session-Token") == session_id

        # 3. Verify permanent storage was NOT modified!
        assert not (temp_storage / "active_dataset.json").exists()
        assert len(list((temp_storage / "datasets").glob("*.duckdb"))) == 0

        # 4. Verify files are stored strictly within data/sessions/{session_id}/
        session_dir = temp_storage / "sessions" / session_id
        assert session_dir.is_dir()
        assert (session_dir / "session.duckdb").is_file()
        assert (session_dir / "meta.json").is_file()
        # Original uploaded xlsx is deleted after ingestion
        assert not (session_dir / "quarantine.xlsx").exists()

        # 5. Confirm session
        resp_confirm = client.post(
            "/api/v1/session/confirm",
            json={"session_id": session_id},
        )
        assert resp_confirm.status_code == 200
        assert resp_confirm.json()["status"] == "active"

        # 6. Verify session status endpoint
        resp_status = client.get("/api/v1/session/status")
        assert resp_status.status_code == 200
        assert resp_status.json()["active"] is True
        assert resp_status.json()["session_id"] == session_id

        # 7. Query academic endpoints using the session cookie
        resp_students = client.get("/api/v1/students")
        assert resp_students.status_code == 200
        assert resp_students.json()["total"] == 1

        # 8. Query overview analytics using the session cookie
        resp_analytics = client.get("/api/v1/analytics/overview")
        assert resp_analytics.status_code == 200
        assert resp_analytics.json()["total_students"] == 1


def test_concurrent_sessions_isolated(temp_storage):
    """Verify two concurrent faculty sessions are strictly isolated with zero data or review leakage."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
    )
    test_app = create_app(settings)

    bytes_a = build_synthetic_xlsx_bytes(student_name="Student Alpha")
    bytes_b = build_synthetic_xlsx_bytes(student_name="Student Beta")

    with TestClient(test_app) as client_a, TestClient(test_app) as client_b:
        # Create session A
        resp_a = client_a.post("/api/v1/session/upload", files={"file": ("file_a.xlsx", bytes_a, "application/octet-stream")})
        token_a = resp_a.json()["session_id"]
        client_a.post("/api/v1/session/confirm", json={"session_id": token_a})

        # Create session B
        resp_b = client_b.post("/api/v1/session/upload", files={"file": ("file_b.xlsx", bytes_b, "application/octet-stream")})
        token_b = resp_b.json()["session_id"]
        client_b.post("/api/v1/session/confirm", json={"session_id": token_b})

        # Verify session A sees only Alpha
        students_a = client_a.get("/api/v1/students", headers={"X-EduQuery-Session-Token": token_a}).json()
        assert students_a["items"][0]["name"] == "Student Alpha"

        # Verify session B sees only Beta
        students_b = client_b.get("/api/v1/students", headers={"X-EduQuery-Session-Token": token_b}).json()
        assert students_b["items"][0]["name"] == "Student Beta"

        # Record anomaly review in session A
        # Create a mock review in session A
        from app.services.anomaly_detection import review_anomaly_finding
        review_anomaly_finding(
            finding_id="finding_123",
            reviewed=True,
            reviewer_name="Prof. A",
            notes="Session A only",
            dataset_id=f"session_{token_a}",
        )

        # Verify review file exists in session A's directory
        reviews_a_file = temp_storage / "sessions" / token_a / "reviews.json"
        assert reviews_a_file.is_file()
        assert "finding_123" in json.loads(reviews_a_file.read_text(encoding="utf-8"))

        # Verify session B directory does NOT have this review
        reviews_b_file = temp_storage / "sessions" / token_b / "reviews.json"
        assert not reviews_b_file.exists()


def test_session_deletion_purges_all_server_artifacts(temp_storage):
    """Verify DELETE /api/v1/session completely erases workspace, DuckDB, reviews, and invalidates session."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
    )
    test_app = create_app(settings)

    xlsx_bytes = build_synthetic_xlsx_bytes()

    with TestClient(test_app) as client:
        # 1. Create and confirm session
        upload_resp = client.post("/api/v1/session/upload", files={"file": ("demo.xlsx", xlsx_bytes, "application/octet-stream")})
        session_id = upload_resp.json()["session_id"]
        client.post("/api/v1/session/confirm", json={"session_id": session_id})

        session_dir = temp_storage / "sessions" / session_id
        assert session_dir.is_dir()

        # 2. Delete session
        del_resp = client.delete("/api/v1/session")
        assert del_resp.status_code == 200
        assert del_resp.json()["status"] == "deleted"

        # 3. Verify server directory is COMPLETELY ERASED
        assert not session_dir.exists()

        # 4. Verify subsequent queries fail with session unavailable / not found
        resp_status = client.get("/api/v1/session/status")
        assert resp_status.json()["active"] is False

        # Querying students with deleted session token returns 503 DATABASE_UNAVAILABLE
        resp_after = client.get("/api/v1/students", headers={"X-EduQuery-Session-Token": session_id})
        assert resp_after.status_code == 503

        # 5. Idempotent deletion: second delete succeeds gracefully
        del_again = client.delete("/api/v1/session", headers={"X-EduQuery-Session-Token": session_id})
        assert del_again.status_code == 200
        assert del_again.json()["status"] == "deleted"


def test_session_expiration_and_cleanup(temp_storage):
    """Verify expired sessions are rejected and pruned by the cleanup service."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
        import_session_ttl_seconds=1,  # 1 second TTL
    )
    test_app = create_app(settings)

    xlsx_bytes = build_synthetic_xlsx_bytes()

    with TestClient(test_app) as client:
        # Create session
        upload_resp = client.post("/api/v1/session/upload", files={"file": ("demo.xlsx", xlsx_bytes, "application/octet-stream")})
        session_id = upload_resp.json()["session_id"]
        session_dir = temp_storage / "sessions" / session_id

        # Manually backdate expiration in meta.json to simulate passage of time
        meta_file = session_dir / "meta.json"
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        meta["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        meta_file.write_text(json.dumps(meta), encoding="utf-8")

        # Query status: should report inactive/expired and prune
        status_resp = client.get("/api/v1/session/status", headers={"X-EduQuery-Session-Token": session_id})
        assert status_resp.json()["active"] is False

        # Verify session directory was pruned
        assert not session_dir.exists()


def test_mode_b_save_to_permanent_storage(temp_storage):
    """Verify Mode B explicit opt-in promotes temporary session to institutional persistent storage."""
    pointer_path = temp_storage / "active_dataset.json"
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(pointer_path),
    )
    test_app = create_app(settings)

    xlsx_bytes = build_synthetic_xlsx_bytes(student_name="Permanent Student")

    with TestClient(test_app) as client:
        # 1. Create and confirm temporary session
        upload_resp = client.post("/api/v1/session/upload", files={"file": ("save_me.xlsx", xlsx_bytes, "application/octet-stream")})
        session_id = upload_resp.json()["session_id"]
        client.post("/api/v1/session/confirm", json={"session_id": session_id})

        # 2. Save session to permanent institutional storage
        save_resp = client.post("/api/v1/session/save", headers={"X-EduQuery-Session-Token": session_id})
        assert save_resp.status_code == 200
        saved_data = save_resp.json()
        assert saved_data["status"] == "saved"
        assert "dataset_id" in saved_data

        # 3. Verify permanent storage now has dataset and active pointer
        assert pointer_path.is_file()
        pointer_meta = json.loads(pointer_path.read_text(encoding="utf-8"))
        assert pointer_meta["active_dataset_id"] == saved_data["dataset_id"]
        assert Path(pointer_meta["active_database_path"]).is_file()


def test_fresh_visitor_session_status_inactive(temp_storage):
    """Verify fresh visitor without cookie or active dataset receives active=False, mode=None."""
    settings = Settings(
        app_env="production",
        database_path=str(temp_storage / "datasets" / "permanent_default.duckdb"),
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(temp_storage / "active_dataset.json"),
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        resp = client.get("/api/v1/session/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active"] is False
        assert data["mode"] is None
        assert data.get("session_id") is None


def test_upload_rejection_invalid_extension(temp_storage):
    """Verify non-.xlsx uploads are rejected with 415 Unsupported Media Type."""
    settings = Settings(
        app_env="production",
        database_path=str(temp_storage / "datasets" / "permanent_default.duckdb"),
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(temp_storage / "active_dataset.json"),
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("report.pdf", b"%PDF-1.4...", "application/pdf")},
        )
        assert resp.status_code == 415
        assert "UNSUPPORTED_FILE_TYPE" in resp.text or "supported" in resp.text.lower()


def test_upload_rejection_invalid_magic_bytes(temp_storage):
    """Verify files named .xlsx but lacking PK magic bytes are rejected with 415."""
    settings = Settings(
        app_env="production",
        database_path=str(temp_storage / "datasets" / "permanent_default.duckdb"),
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(temp_storage / "active_dataset.json"),
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("fake.xlsx", b"NOT_A_ZIP_FILE_AT_ALL", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 415
        assert "INVALID_WORKBOOK_CONTAINER" in resp.text or "magic bytes" in resp.text.lower()


def test_upload_rejection_empty_file(temp_storage):
    """Verify empty 0-byte uploads are rejected with 422."""
    settings = Settings(
        app_env="production",
        database_path=str(temp_storage / "datasets" / "permanent_default.duckdb"),
        data_dir=str(temp_storage),
        active_dataset_pointer_path=str(temp_storage / "active_dataset.json"),
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("empty.xlsx", b"", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 422
        assert "EMPTY_FILE" in resp.text or "empty" in resp.text.lower()


def test_session_status_returns_can_confirm_and_blocking_errors(temp_storage):
    """Verify get_session_status includes can_confirm and blocking_errors."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
    )
    test_app = create_app(settings)
    xlsx_bytes = build_synthetic_xlsx_bytes()

    with TestClient(test_app) as client:
        upload_resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("status_check.xlsx", xlsx_bytes, "application/octet-stream")},
        )
        assert upload_resp.status_code == 200
        session_id = upload_resp.json()["session_id"]

        status_resp = client.get("/api/v1/session/status", headers={"X-EduQuery-Session-Token": session_id})
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert "can_confirm" in status_data
        assert status_data["can_confirm"] is True
        assert "blocking_errors" in status_data
        assert isinstance(status_data["blocking_errors"], list)
        assert len(status_data["blocking_errors"]) == 0
        assert status_data["mode"] == "temporary"


def test_session_confirm_blocked_when_blocking_errors_present(temp_storage):
    """Verify activation is rejected with 409 Conflict when can_confirm is False or blocking errors exist."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(temp_storage),
    )
    test_app = create_app(settings)
    xlsx_bytes = build_synthetic_xlsx_bytes()

    with TestClient(test_app) as client:
        upload_resp = client.post(
            "/api/v1/session/upload",
            files={"file": ("blocked_test.xlsx", xlsx_bytes, "application/octet-stream")},
        )
        session_id = upload_resp.json()["session_id"]
        session_dir = temp_storage / "sessions" / session_id

        # Simulate presence of blocking errors in session metadata
        meta_file = session_dir / "meta.json"
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        meta["can_confirm"] = False
        meta["blocking_errors"] = ["Out-of-range marks detected in component ISA"]
        meta_file.write_text(json.dumps(meta), encoding="utf-8")

        # Attempt to confirm session: should be rejected with 409 Conflict
        confirm_resp = client.post(
            "/api/v1/session/confirm",
            json={"session_id": session_id},
        )
        assert confirm_resp.status_code == 409
        body = confirm_resp.json()
        error_code = body.get("error_code") or body.get("detail", {}).get("error_code")
        details = body.get("details") or body.get("detail", {}).get("details", [])
        assert error_code == "BLOCKING_ERRORS_PRESENT"
        assert any("Out-of-range marks" in str(d) for d in details)


