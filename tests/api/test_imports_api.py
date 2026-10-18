"""Comprehensive integration tests for secure workbook upload, preview, validation, and activation (Phase 3.4)."""
from __future__ import annotations

import asyncio
import io
import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

import duckdb
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app
from app.services.import_manager import cleanup_import_storage, get_import_session_status

TEST_IMPORT_KEY = "super-secret-admin-import-key-xyz"


@pytest.fixture
def temp_workspace():
    """Create isolated temporary workspace directory with initial active database."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        initial_db = tmp_path / "initial_active.duckdb"
        con = duckdb.connect(str(initial_db))
        init_database(con)
        populate_table(
            con,
            "students",
            [
                {
                    "student_id": "INIT_01",
                    "name": "Initial Student Alpha",
                    "seat_no": "SEAT_01",
                    "roll_no": "1",
                    "division": "A",
                    "result": "PASSES",
                }
            ],
        )
        populate_table(
            con,
            "courses",
            [
                {
                    "code": "INIT101",
                    "name": "Initial Course",
                    "kind": "theory",
                    "credits": 4.0,
                    "components": "TH",
                }
            ],
        )
        populate_table(con, "enrollment", [{"student_id": "INIT_01", "course_code": "INIT101"}])
        con.close()

        pointer_path = tmp_path / "active_dataset.json"
        settings = Settings(
            database_path=str(initial_db),
            import_api_key=TEST_IMPORT_KEY,
            data_dir=str(tmp_path),
            active_dataset_pointer_path=str(pointer_path),
            max_upload_size_bytes=25 * 1024 * 1024,
            import_session_ttl_seconds=3600,
        )
        app = create_app(settings)
        with TestClient(app) as client:
            yield {
                "client": client,
                "app": app,
                "settings": settings,
                "tmp_path": tmp_path,
                "initial_db": initial_db,
                "pointer_path": pointer_path,
            }


@pytest.fixture
def sample_xlsx_bytes():
    """Load valid test marksheet workbook bytes from data directory."""
    path = Path(__file__).resolve().parent.parent.parent / "data" / "test1_commerce_same_layout.xlsx"
    assert path.is_file(), f"Test fixture workbook missing at {path}"
    return path.read_bytes()


# =========================================================================
# Part 1: Authentication & Authorization Safeguards
# =========================================================================

def test_import_endpoints_disabled_when_no_key_configured(temp_workspace, sample_xlsx_bytes):
    """When EDUQUERY_IMPORT_API_KEY is unset, endpoints must return 503 IMPORT_DISABLED."""
    disabled_settings = Settings(
        database_path=str(temp_workspace["initial_db"]),
        import_api_key=None,
        data_dir=str(temp_workspace["tmp_path"]),
    )
    disabled_app = create_app(disabled_settings)
    with TestClient(disabled_app) as client:
        # Preview endpoint
        resp_p = client.post(
            "/api/v1/imports/preview",
            files={"file": ("wb.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": "any-key"},
        )
        assert resp_p.status_code == 503
        data_p = resp_p.json()
        assert data_p["status"] == "error"
        assert data_p["error_code"] == "IMPORT_DISABLED"

        # Confirm endpoint
        resp_c = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": "dummy-id"},
            headers={"X-EduQuery-Import-Key": "any-key"},
        )
        assert resp_c.status_code == 503
        assert resp_c.json()["error_code"] == "IMPORT_DISABLED"

        # Status inspection endpoint
        resp_s = client.get("/api/v1/imports/dummy-id", headers={"X-EduQuery-Import-Key": "any-key"})
        assert resp_s.status_code == 503
        assert resp_s.json()["error_code"] == "IMPORT_DISABLED"


def test_import_endpoints_reject_missing_credentials(temp_workspace, sample_xlsx_bytes):
    """Missing import key header must return 401 UNAUTHORIZED."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("wb.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert resp.status_code == 401
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "UNAUTHORIZED"
    assert "Missing" in data["message"]


def test_import_endpoints_reject_invalid_credentials(temp_workspace, sample_xlsx_bytes):
    """Incorrect import key must return 401 UNAUTHORIZED."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("wb.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": "wrong-secret-key"},
    )
    assert resp.status_code == 401
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "UNAUTHORIZED"
    assert "Invalid" in data["message"]


def test_import_endpoints_accept_valid_credentials(temp_workspace, sample_xlsx_bytes):
    """Valid credentials via X-EduQuery-Import-Key and Authorization Bearer must be accepted."""
    client = temp_workspace["client"]

    # 1. Via X-EduQuery-Import-Key
    resp1 = client.post(
        "/api/v1/imports/preview",
        files={"file": ("wb.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp1.status_code == 200
    assert resp1.json()["state"] == "preview_ready"

    # 2. Via Authorization Bearer header
    resp2 = client.post(
        "/api/v1/imports/preview",
        files={"file": ("wb2.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {TEST_IMPORT_KEY}"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["state"] == "preview_ready"


# =========================================================================
# Part 2: Upload Validation & Defensive Ingestion
# =========================================================================

def test_upload_unsupported_file_extension(temp_workspace):
    """Non-xlsx files (.csv, .xls, .txt) must be rejected with 415 UNSUPPORTED_FILE_TYPE."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("marks.csv", b"col1,col2\n1,2", "text/csv")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 415
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "UNSUPPORTED_FILE_TYPE"


def test_upload_empty_file(temp_workspace):
    """Uploading a 0-byte file must be rejected with 422 EMPTY_FILE."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("empty.xlsx", b"", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 422
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "EMPTY_FILE"


def test_upload_invalid_magic_bytes_spoofed_mime(temp_workspace):
    """File claiming to be .xlsx but lacking PK zip magic bytes must be rejected with 415."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("corrupt.xlsx", b"NOT_A_ZIP_CONTAINER_DATA", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 415
    data = resp.json()
    assert data["status"] == "error"
    assert data["error_code"] == "INVALID_WORKBOOK_HEADER"


def test_upload_oversized_file(temp_workspace):
    """Uploading content exceeding max_upload_size_bytes must return 413 and delete partial file."""
    # Create app with small 10 KB size limit
    low_limit_settings = Settings(
        database_path=str(temp_workspace["initial_db"]),
        import_api_key=TEST_IMPORT_KEY,
        data_dir=str(temp_workspace["tmp_path"]),
        max_upload_size_bytes=10 * 1024,  # 10 KB
    )
    low_limit_app = create_app(low_limit_settings)
    big_content = b"PK\x03\x04" + b"X" * (20 * 1024)  # 20 KB

    with TestClient(low_limit_app) as client:
        resp = client.post(
            "/api/v1/imports/preview",
            files={"file": ("big.xlsx", big_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert resp.status_code == 413
        data = resp.json()
        assert data["status"] == "error"
        assert data["error_code"] == "FILE_TOO_LARGE"

    # Verify no partial uploads remain in uploads dir
    uploads_dir = temp_workspace["tmp_path"] / "imports" / "uploads"
    if uploads_dir.exists():
        assert len(list(uploads_dir.glob("*.xlsx"))) == 0


def test_upload_filename_path_traversal_sanitization(temp_workspace, sample_xlsx_bytes):
    """Path traversal sequences in filename must never escape or dictate the filesystem path."""
    client = temp_workspace["client"]
    traversal_name = "../../../../../etc/passwd.xlsx"
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": (traversal_name, sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Safe display filename sanitized
    assert ".." not in data["workbook"]["filename"]
    assert "/" not in data["workbook"]["filename"]
    assert "\\" not in data["workbook"]["filename"]

    # Verify physical file stored with generated UUID, not user string
    uploads_dir = temp_workspace["tmp_path"] / "imports" / "uploads"
    for f in uploads_dir.iterdir():
        assert f.name.startswith("upload_")
        assert "passwd" not in f.name


def test_upload_corrupt_zip_fails_gracefully(temp_workspace):
    """Zip file that lacks OpenXML structure returns 415; corrupt spreadsheet XML returns 422."""
    client = temp_workspace["client"]

    # 1. Zip lacking [Content_Types].xml -> 415 INVALID_WORKBOOK_CONTAINER
    buf1 = io.BytesIO()
    with zipfile.ZipFile(buf1, "w") as z:
        z.writestr("unrelated.txt", "not an excel sheet")
    corrupt_zip_bytes = buf1.getvalue()

    resp1 = client.post(
        "/api/v1/imports/preview",
        files={"file": ("corrupt1.xlsx", corrupt_zip_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp1.status_code == 415
    data1 = resp1.json()
    assert data1["status"] == "error"
    assert data1["error_code"] == "INVALID_WORKBOOK_CONTAINER"

    # 2. Zip with [Content_Types].xml but corrupt excel structure -> 422 WORKBOOK_PARSE_FAILED
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w") as z:
        z.writestr("[Content_Types].xml", "<Types></Types>")
        z.writestr("xl/workbook.xml", "<malformed>")
    corrupt_xml_bytes = buf2.getvalue()

    resp2 = client.post(
        "/api/v1/imports/preview",
        files={"file": ("corrupt2.xlsx", corrupt_xml_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp2.status_code == 422
    data2 = resp2.json()
    assert data2["status"] == "error"
    assert data2["error_code"] == "WORKBOOK_PARSE_FAILED"

    # Verify temporary files were cleaned up
    candidates_dir = temp_workspace["tmp_path"] / "imports" / "candidates"
    if candidates_dir.exists():
        assert len(list(candidates_dir.glob("*.duckdb"))) == 0


# =========================================================================
# Part 3: Preview Correctness & Candidate Isolation
# =========================================================================

def test_preview_creates_candidate_without_mutating_active_dataset(temp_workspace, sample_xlsx_bytes):
    """Previewing a workbook must ingest into candidate DuckDB and leave active dataset unchanged."""
    client = temp_workspace["client"]

    # Check baseline active roster (1 student)
    resp_init = client.get("/api/v1/students")
    assert resp_init.status_code == 200
    assert resp_init.json()["total"] == 1
    assert resp_init.json()["items"][0]["student_id"] == "INIT_01"

    # Post preview with sample workbook (which has 60 students)
    resp_preview = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce_marksheet.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_preview.status_code == 200
    preview_data = resp_preview.json()

    assert preview_data["state"] == "preview_ready"
    assert preview_data["can_confirm"] is True
    assert preview_data["active_dataset_changed"] is False
    assert preview_data["students_count"] == 60
    assert preview_data["courses_count"] == 10
    assert len(preview_data["blocking_errors"]) == 0
    assert preview_data["data_quality"]["health_status"] in ("Good", "Needs Attention", "Critical")

    # Invariant: active dataset must still have 1 student!
    resp_check = client.get("/api/v1/students")
    assert resp_check.status_code == 200
    assert resp_check.json()["total"] == 1
    assert resp_check.json()["items"][0]["student_id"] == "INIT_01"


def test_preview_response_contains_no_student_pii(temp_workspace, sample_xlsx_bytes):
    """The preview response must not expose individual student names, roll numbers, or raw marks."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    text = resp.text.lower()
    # Confirm no PII keys exist at top level
    data = resp.json()
    assert "students" not in data or not isinstance(data.get("students"), list)
    assert "roll_no" not in text
    assert "seat_no" not in text


# =========================================================================
# Part 4: Confirmation & Atomic Activation
# =========================================================================

def test_confirm_valid_import_activates_dataset(temp_workspace, sample_xlsx_bytes):
    """Confirming a preview session activates the candidate dataset, and subsequent requests read it."""
    client = temp_workspace["client"]

    # 1. Upload preview
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_p.status_code == 200
    import_id = resp_p.json()["import_id"]

    # 2. Confirm import
    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 200
    confirm_data = resp_c.json()
    assert confirm_data["state"] == "activated"
    assert confirm_data["students_count"] == 60
    assert confirm_data["courses_count"] == 10
    active_dataset_id = confirm_data["active_dataset_id"]
    assert active_dataset_id.startswith("dataset_")

    # 3. Verify new requests IMMEDIATELY observe the activated dataset (60 students)
    resp_students = client.get("/api/v1/students")
    assert resp_students.status_code == 200
    assert resp_students.json()["total"] == 60

    # 4. Verify /health reflects new dataset counts
    resp_h = client.get("/health")
    assert resp_h.status_code == 200
    assert resp_h.json()["database"]["students_count"] == 60
    assert resp_h.json()["database"]["courses_count"] == 10

    # 5. Verify pointer file exists on disk
    pointer_path = temp_workspace["pointer_path"]
    assert pointer_path.is_file()
    pointer_data = json.loads(pointer_path.read_text(encoding="utf-8"))
    assert pointer_data["active_dataset_id"] == active_dataset_id
    assert pointer_data["students_count"] == 60


def test_confirm_idempotency(temp_workspace, sample_xlsx_bytes):
    """Calling confirm multiple times on the same session must return success without mutating state."""
    client = temp_workspace["client"]
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]

    # First confirmation
    resp_c1 = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c1.status_code == 200
    dataset_id1 = resp_c1.json()["active_dataset_id"]

    # Second confirmation (idempotent)
    resp_c2 = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c2.status_code == 200
    assert resp_c2.json()["active_dataset_id"] == dataset_id1
    assert "already been activated" in resp_c2.json()["message"]


def test_confirm_unknown_session_returns_404(temp_workspace):
    """Confirming a non-existent import_id must return 404 NOT_FOUND."""
    client = temp_workspace["client"]
    resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": "nonexistent_session_id"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 404
    data = resp.json()
    assert data["status"] == "not_found"
    assert data["error_code"] == "IMPORT_SESSION_NOT_FOUND"


def test_confirm_expired_session_returns_409(temp_workspace, sample_xlsx_bytes):
    """An expired import session cannot be confirmed (HTTP 409)."""
    # Create app with negative TTL (instant expiration)
    expired_settings = Settings(
        database_path=str(temp_workspace["initial_db"]),
        import_api_key=TEST_IMPORT_KEY,
        data_dir=str(temp_workspace["tmp_path"]),
        import_session_ttl_seconds=-10,  # Expired upon creation
    )
    app = create_app(expired_settings)
    with TestClient(app) as client:
        resp_p = client.post(
            "/api/v1/imports/preview",
            files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        import_id = resp_p.json()["import_id"]

        resp_c = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": import_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert resp_c.status_code == 409
        data = resp_c.json()
        assert data["status"] == "conflict"
        assert data["error_code"] == "IMPORT_SESSION_EXPIRED"


def test_confirm_candidate_missing_preserves_active_database(temp_workspace, sample_xlsx_bytes):
    """If the candidate database file was unexpectedly removed prior to confirmation, active DB is untouched."""
    client = temp_workspace["client"]
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]

    # Delete the candidate duckdb file manually
    cand_path = temp_workspace["tmp_path"] / "imports" / "candidates" / f"candidate_{import_id}.duckdb"
    cand_path.unlink()

    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 500
    assert resp_c.json()["error_code"] == "CANDIDATE_DATABASE_MISSING"

    # Verify active dataset remains intact with original 1 student
    resp_st = client.get("/api/v1/students")
    assert resp_st.status_code == 200
    assert resp_st.json()["total"] == 1


def test_confirm_candidate_corrupt_preserves_active_database(temp_workspace, sample_xlsx_bytes):
    """If candidate database fails integrity check (e.g. empty file), activation is aborted."""
    client = temp_workspace["client"]
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]

    # Corrupt candidate file
    cand_path = temp_workspace["tmp_path"] / "imports" / "candidates" / f"candidate_{import_id}.duckdb"
    cand_path.write_text("corrupted content", encoding="utf-8")

    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 422
    assert resp_c.json()["error_code"] == "CANDIDATE_INTEGRITY_CHECK_FAILED"

    # Active dataset is preserved
    resp_st = client.get("/api/v1/students")
    assert resp_st.status_code == 200
    assert resp_st.json()["total"] == 1


# =========================================================================
# Part 5: Lifecycle, Concurrency, and Restart Recovery
# =========================================================================

def test_restart_recovery_reloads_active_dataset_pointer(temp_workspace, sample_xlsx_bytes):
    """When the server restarts, create_app must reload the active dataset from the pointer file."""
    client = temp_workspace["client"]

    # 1. Preview and confirm import
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]
    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 200
    activated_id = resp_c.json()["active_dataset_id"]

    # 2. Simulate server restart: create a completely new app instance using same settings
    rebooted_app = create_app(temp_workspace["settings"])
    assert rebooted_app.state.active_dataset_id == activated_id

    # 3. New client against rebooted app immediately queries activated dataset (60 students)
    with TestClient(rebooted_app) as reboot_client:
        resp_roster = reboot_client.get("/api/v1/students")
        assert resp_roster.status_code == 200
        assert resp_roster.json()["total"] == 60


def test_concurrent_reads_during_activation_remain_valid(temp_workspace, sample_xlsx_bytes):
    """Active readers on previous dataset must not crash or fail during promotion (Windows handle safety)."""
    client = temp_workspace["client"]
    initial_db = temp_workspace["initial_db"]

    # Keep a read-only connection open to initial database
    con_reader = duckdb.connect(str(initial_db), read_only=True)
    initial_count = con_reader.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    assert initial_count == 1

    # Perform preview and activation of new dataset while reader is open
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]
    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 200

    # Existing reader continues reading without WinError 32
    count_after = con_reader.execute("SELECT COUNT(*) FROM students").fetchone()[0]
    assert count_after == 1
    con_reader.close()

    # New API queries seamlessly read the 60 students from newly activated dataset
    resp_new = client.get("/api/v1/students")
    assert resp_new.status_code == 200
    assert resp_new.json()["total"] == 60


def test_cleanup_import_storage_protects_active_dataset(temp_workspace, sample_xlsx_bytes):
    """Storage cleanup removes expired/failed temporary files and never deletes active promoted database."""
    client = temp_workspace["client"]

    # Preview and activate
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]
    resp_c = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp_c.status_code == 200

    # Run cleanup
    cleaned = cleanup_import_storage(temp_workspace["settings"])
    assert cleaned >= 0

    # Verify active promoted database still exists and is queryable
    pointer_data = json.loads(temp_workspace["pointer_path"].read_text(encoding="utf-8"))
    active_path = Path(pointer_data["active_database_path"])
    assert active_path.is_file()

    con = duckdb.connect(str(active_path), read_only=True)
    assert con.execute("SELECT COUNT(*) FROM students").fetchone()[0] == 60
    con.close()


def test_session_with_blocking_errors_cannot_confirm(temp_workspace):
    """An import session in validation_failed state with blocking errors cannot be confirmed (HTTP 409)."""
    client = temp_workspace["client"]
    dirs_sessions = temp_workspace["tmp_path"] / "imports" / "sessions"
    dirs_sessions.mkdir(parents=True, exist_ok=True)
    import_id = "test_blocked_session_id"
    session_file = dirs_sessions / f"{import_id}.json"
    session_file.write_text(
        json.dumps(
            {
                "import_id": import_id,
                "state": "validation_failed",
                "can_confirm": False,
                "blocking_errors": ["Workbook contains zero accepted student records."],
                "candidate_db_path": str(temp_workspace["tmp_path"] / "cand.duckdb"),
            }
        ),
        encoding="utf-8",
    )

    resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 409
    data = resp.json()
    assert data["status"] == "conflict"
    assert data["error_code"] == "INVALID_STATE_TRANSITION"


def test_concurrent_confirmations_serialized_safely(temp_workspace, sample_xlsx_bytes):
    """Concurrent confirmation attempts are safely serialized via activation lock without corrupting state."""
    from concurrent.futures import ThreadPoolExecutor

    client = temp_workspace["client"]
    resp_p = client.post(
        "/api/v1/imports/preview",
        files={"file": ("commerce.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    import_id = resp_p.json()["import_id"]

    def do_confirm():
        return client.post(
            "/api/v1/imports/confirm",
            json={"import_id": import_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(do_confirm) for _ in range(4)]
        results = [f.result() for f in futures]

    # Every concurrent request must succeed with 200 (one performs activation, others receive idempotent response)
    for r in results:
        assert r.status_code == 200
        assert r.json()["state"] == "activated"
        assert r.json()["students_count"] == 60

    # Active dataset is valid
    resp_st = client.get("/api/v1/students")
    assert resp_st.status_code == 200
    assert resp_st.json()["total"] == 60
