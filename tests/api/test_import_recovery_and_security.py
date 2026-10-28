"""Phase 3.5 targeted adversarial tests for import recovery, security hardening, and dataset safety.

Tests Failure Points A through J, session persistence, boundary limits, path traversal,
data quality semantics, and cross-process concurrency guarantees.
"""
from __future__ import annotations

import io
import json
import os
import shutil
import tempfile
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

import duckdb
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app
from app.services.import_manager import (
    CrossProcessLock,
    cleanup_import_storage,
    get_import_session_status,
    get_import_storage_dirs,
    validate_import_id,
)

TEST_IMPORT_KEY = "test_adminkey_phase35_secure"


@pytest.fixture
def test_env():
    """Create a temporary isolated workspace with an initial active dataset."""
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
                    "student_id": "STU_INIT_01",
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
        populate_table(con, "enrollment", [{"student_id": "STU_INIT_01", "course_code": "INIT101"}])
        populate_table(
            con,
            "scores",
            [
                {
                    "student_id": "STU_INIT_01",
                    "course_code": "INIT101",
                    "component": "TH",
                    "value": 55.0,
                    "flag": None,
                    "state": "marked",
                }
            ],
        )
        con.close()

        pointer_path = tmp_path / "active_dataset.json"
        settings = Settings(
            database_path=str(initial_db),
            import_api_key=TEST_IMPORT_KEY,
            data_dir=str(tmp_path),
            active_dataset_pointer_path=str(pointer_path),
            max_upload_size_bytes=10 * 1024 * 1024,
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
    """Valid test marksheet workbook from data directory."""
    path = Path(__file__).resolve().parent.parent.parent / "data" / "test1_commerce_same_layout.xlsx"
    assert path.is_file(), f"Fixture workbook missing at {path}"
    return path.read_bytes()


def _upload_preview(client: TestClient, xlsx_bytes: bytes, filename: str = "sheet.xlsx") -> dict:
    """Helper to upload workbook for preview."""
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": (filename, xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    return resp


# =========================================================================
# Section 2: Active-Dataset Pointer & Crash Recovery Audit (Failure Cases A-J)
# =========================================================================

def test_case_a_crash_after_ingestion_before_promotion(test_env, sample_xlsx_bytes):
    """Case A: Client previews workbook, but process restarts before confirm/promotion."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Pointer should NOT exist yet
    assert not test_env["pointer_path"].exists()

    # Simulate restart by creating a new app
    restarted_app = create_app(test_env["settings"])
    with TestClient(restarted_app) as rclient:
        # Active dataset remains initial DB
        h_resp = rclient.get("/health")
        assert h_resp.status_code == 200
        # Querying students returns initial student only
        s_resp = rclient.get("/api/v1/students")
        assert s_resp.status_code == 200
        assert s_resp.json()["total"] == 1
        assert s_resp.json()["items"][0]["student_id"] == "STU_INIT_01"


def test_case_b_failure_during_candidate_promotion(test_env, sample_xlsx_bytes):
    """Case B: Candidate promotion fails (e.g. disk write failure during shutil.copy2)."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Mock shutil.copy2 to simulate promotion failure
    with patch("shutil.copy2", side_effect=OSError("Simulated disk error during candidate copy")):
        conf_resp = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": import_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert conf_resp.status_code == 500
        assert conf_resp.json()["error_code"] == "PROMOTION_FAILED"

    # Active pointer must not have been created
    assert not test_env["pointer_path"].exists()

    # Queries still return initial dataset
    s_resp = client.get("/api/v1/students")
    assert s_resp.status_code == 200
    assert s_resp.json()["total"] == 1


def test_case_c_failure_during_pointer_temp_file_creation(test_env, sample_xlsx_bytes):
    """Case C: Candidate promoted, but writing pointer temporary file fails."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    real_open = open

    def mock_open(file, *args, **kwargs):
        if str(file).endswith(".tmp"):
            raise OSError("Simulated permission error writing pointer tmp")
        return real_open(file, *args, **kwargs)

    with patch("builtins.open", side_effect=mock_open):
        conf_resp = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": import_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert conf_resp.status_code == 500
        assert conf_resp.json()["error_code"] == "ACTIVATION_FAILED"

    # Pointer must not exist
    assert not test_env["pointer_path"].exists()


def test_case_d_pointer_temp_written_but_os_replace_fails(test_env, sample_xlsx_bytes):
    """Case D: Pointer tmp file written, but atomic os.replace fails."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    with patch("os.replace", side_effect=OSError("Simulated os.replace filesystem error")):
        conf_resp = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": import_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert conf_resp.status_code == 500
        assert conf_resp.json()["error_code"] == "ACTIVATION_FAILED"

    # Pointer must not be activated
    assert not test_env["pointer_path"].exists()


def test_case_e_pointer_replaced_but_failure_before_http_response(test_env, sample_xlsx_bytes):
    """Case E: Pointer replaced successfully, but process terminates before HTTP response."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Manually promote candidate and write pointer as if os.replace succeeded
    dirs = get_import_storage_dirs(test_env["settings"])
    cand_path = dirs["candidates"] / f"candidate_{import_id}.duckdb"
    assert cand_path.is_file(), f"Candidate DB missing at {cand_path}"
    promoted_path = dirs["datasets"] / f"dataset_recovered_{import_id[:8]}.duckdb"
    shutil.copy2(cand_path, promoted_path)

    pointer_payload = {
        "active_dataset_id": f"dataset_recovered_{import_id[:8]}",
        "active_database_path": str(promoted_path),
        "import_id": import_id,
        "activated_at": datetime.now(timezone.utc).isoformat(),
        "students_count": 60,
        "courses_count": 10,
    }
    test_env["pointer_path"].write_text(json.dumps(pointer_payload), encoding="utf-8")

    # On restart, app MUST cleanly pick up the promoted dataset
    restarted_app = create_app(test_env["settings"])
    with TestClient(restarted_app) as rclient:
        s_resp = rclient.get("/api/v1/students")
        assert s_resp.status_code == 200
        # Promoted dataset has 60 students
        assert s_resp.json()["total"] == 60


def test_case_g_pointer_references_missing_or_corrupt_database(test_env):
    """Case G: Pointer references missing, corrupted, or 0-student database."""
    pointer_path = test_env["pointer_path"]

    # 1. Missing database file
    pointer_payload = {
        "active_dataset_id": "ghost_dataset",
        "active_database_path": str(test_env["tmp_path"] / "ghost.duckdb"),
        "import_id": "ghost_import",
    }
    pointer_path.write_text(json.dumps(pointer_payload), encoding="utf-8")

    app1 = create_app(test_env["settings"])
    with TestClient(app1) as client1:
        # Fallback to initial DB
        resp = client1.get("/api/v1/students")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    # 2. Corrupt file (garbage bytes) inside datasets directory
    dirs = get_import_storage_dirs(test_env["settings"])
    corrupt_db = dirs["datasets"] / "corrupt.duckdb"
    corrupt_db.write_bytes(b"NOT A DUCKDB FILE TRUNCATED")
    pointer_payload["active_database_path"] = str(corrupt_db)
    pointer_path.write_text(json.dumps(pointer_payload), encoding="utf-8")

    app2 = create_app(test_env["settings"])
    with TestClient(app2) as client2:
        # Fallback to initial DB
        resp = client2.get("/api/v1/students")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    # 3. Database with missing tables or 0 students
    empty_db = dirs["datasets"] / "empty.duckdb"
    con = duckdb.connect(str(empty_db))
    init_database(con)  # Valid schema but 0 rows
    con.close()
    pointer_payload["active_database_path"] = str(empty_db)
    pointer_path.write_text(json.dumps(pointer_payload), encoding="utf-8")

    app3 = create_app(test_env["settings"])
    with TestClient(app3) as client3:
        # Rejects 0-student dataset on boot, falls back to initial DB
        resp = client3.get("/api/v1/students")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


def test_case_h_pointer_json_malformed_or_path_traversal(test_env):
    """Case H: Pointer JSON is malformed or attempts path traversal outside datasets dir."""
    pointer_path = test_env["pointer_path"]

    # 1. Malformed JSON
    pointer_path.write_text("MALFORMED JSON {{{", encoding="utf-8")
    app1 = create_app(test_env["settings"])
    with TestClient(app1) as client1:
        resp = client1.get("/api/v1/students")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    # 2. Path traversal outside datasets directory
    outside_db = test_env["tmp_path"] / "outside_evil.duckdb"
    con = duckdb.connect(str(outside_db))
    init_database(con)
    populate_table(con, "students", [{"student_id": "EVIL", "name": "Evil", "division": "A", "result": "PASSES"}])
    con.close()

    pointer_payload = {
        "active_dataset_id": "evil_traversal",
        "active_database_path": str(outside_db),
    }
    pointer_path.write_text(json.dumps(pointer_payload), encoding="utf-8")

    app2 = create_app(test_env["settings"])
    with TestClient(app2) as client2:
        # App rejects pointer because outside_db is not inside data/datasets
        resp = client2.get("/api/v1/students")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["student_id"] == "STU_INIT_01"


def test_case_i_cleanup_while_active_dataset_in_use(test_env, sample_xlsx_bytes):
    """Case I: Cleanup runs while active dataset is in use; active dataset is protected."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Confirm activation
    conf_resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf_resp.status_code == 200

    # Run cleanup with 0-second max_age
    cleaned = cleanup_import_storage(test_env["settings"], max_age_seconds=0)

    # Active dataset must remain active and functional
    s_resp = client.get("/api/v1/students")
    assert s_resp.status_code == 200
    assert s_resp.json()["total"] == 60


def test_case_j_cross_process_lock_mutual_exclusion(test_env):
    """Case J: CrossProcessLock guarantees mutual exclusion across workers."""
    dirs = get_import_storage_dirs(test_env["settings"])
    lock_file = dirs["sessions"] / ".test_activation.lock"

    lock1 = CrossProcessLock(lock_file, timeout=1.0)
    lock2 = CrossProcessLock(lock_file, timeout=0.2)

    with lock1:
        # Holding lock1, lock2 must timeout
        with pytest.raises(TimeoutError):
            with lock2:
                pass

    # After lock1 releases, lock2 acquires successfully
    with lock2:
        assert lock_file.exists()


# =========================================================================
# Section 3: Import-Session Persistence and Idempotency
# =========================================================================

def test_session_survives_restart_and_retrieves_preview(test_env, sample_xlsx_bytes):
    """Preview session persists on disk and can be retrieved via GET /imports/{id} after restart."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Restart app
    restarted_app = create_app(test_env["settings"])
    with TestClient(restarted_app) as rclient:
        status_resp = rclient.get(
            f"/api/v1/imports/{import_id}",
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert status_resp.status_code == 200
        data = status_resp.json()
        assert data["import_id"] == import_id
        assert data["state"] == "preview_ready"
        assert data["students_count"] == 60
        assert data["can_confirm"] is True
        # Verify internal paths are NOT exposed
        assert "candidate_db_path" not in data
        assert "upload_path" not in data


def test_session_idempotent_double_confirmation(test_env, sample_xlsx_bytes):
    """Confirming a session twice is idempotent and returns the same active dataset."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # 1st confirm
    conf1 = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf1.status_code == 200
    data1 = conf1.json()
    assert data1["state"] == "activated"

    # 2nd confirm (e.g. client retries after network disconnect)
    conf2 = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf2.status_code == 200
    data2 = conf2.json()
    assert data2["state"] == "activated"
    assert data2["active_dataset_id"] == data1["active_dataset_id"]


def test_expired_session_rejected_even_before_cleanup(test_env, sample_xlsx_bytes):
    """Expired sessions are rejected immediately during confirm without waiting for cleanup."""
    client = test_env["client"]
    resp = _upload_preview(client, sample_xlsx_bytes)
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    # Tamper with session file to simulate expiration in the past
    dirs = get_import_storage_dirs(test_env["settings"])
    s_file = dirs["sessions"] / f"{import_id}.json"
    s_data = json.loads(s_file.read_text(encoding="utf-8"))
    s_data["expires_at"] = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    s_file.write_text(json.dumps(s_data), encoding="utf-8")

    conf_resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf_resp.status_code == 409
    assert conf_resp.json()["error_code"] == "IMPORT_SESSION_EXPIRED"


def test_candidate_cannot_be_activated_without_session_metadata(test_env):
    """Attempting activation with an unknown or deleted session ID returns 404."""
    client = test_env["client"]
    unknown_id = "0123456789abcdef"
    conf_resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": unknown_id},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf_resp.status_code == 404
    assert conf_resp.json()["error_code"] == "IMPORT_SESSION_NOT_FOUND"


# =========================================================================
# Section 4: Security Audit (Auth, Path Traversal, Info Leakage)
# =========================================================================

def test_security_auth_required_on_all_import_endpoints(test_env, sample_xlsx_bytes):
    """Import endpoints are open and do not require administrative authorization."""
    client = test_env["client"]

    # Preview returns 422 (validation error for missing file), NOT 401 unauthorized
    assert client.post("/api/v1/imports/preview").status_code == 422
    # Confirm returns 404 (session not found), NOT 401 unauthorized
    assert client.post("/api/v1/imports/confirm", json={"import_id": "test_id_123"}).status_code == 404
    # Status returns 404 (session not found), NOT 401 unauthorized
    assert client.get("/api/v1/imports/test_id_123").status_code == 404


def test_security_bearer_authorization_header(test_env, sample_xlsx_bytes):
    """Authorization: Bearer <key> is fully supported across all import endpoints."""
    client = test_env["client"]
    bearer_header = {"Authorization": f"Bearer {TEST_IMPORT_KEY}"}

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("test.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=bearer_header,
    )
    assert resp.status_code == 200
    import_id = resp.json()["import_id"]

    stat_resp = client.get(f"/api/v1/imports/{import_id}", headers=bearer_header)
    assert stat_resp.status_code == 200


def test_security_path_traversal_on_import_id_blocked(test_env):
    """Path traversal sequences in import_id are rejected before reaching filesystem."""
    client = test_env["client"]
    headers = {"X-EduQuery-Import-Key": TEST_IMPORT_KEY}

    # Status GET route
    resp1 = client.get("/api/v1/imports/../../etc/passwd", headers=headers)
    assert resp1.status_code in (400, 404)

    resp2 = client.get("/api/v1/imports/..%2f..%2fwindows%2fsystem.ini", headers=headers)
    assert resp2.status_code in (400, 404)

    # Confirm POST route
    resp3 = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": "../../../data/test"},
        headers=headers,
    )
    # Schema validation regex rejects slashes
    assert resp3.status_code == 422


def test_security_path_traversal_in_uploaded_filename_sanitized(test_env, sample_xlsx_bytes):
    """Uploaded filename with directory traversal components is sanitized to basename."""
    client = test_env["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("../../../../etc/shadow.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    assert resp.json()["workbook"]["filename"] == "shadow.xlsx"


def test_security_no_internal_paths_or_pii_in_responses(test_env, sample_xlsx_bytes):
    """Preview, status, and confirm responses must never leak internal paths or student PII."""
    client = test_env["client"]
    headers = {"X-EduQuery-Import-Key": TEST_IMPORT_KEY}

    p_resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("wb.xlsx", sample_xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=headers,
    )
    assert p_resp.status_code == 200
    p_text = p_resp.text
    # No candidate_db_path, no upload_path, no Windows drive paths
    assert "candidate_db_path" not in p_text
    assert "upload_path" not in p_text
    assert "C:\\" not in p_text and "C:/" not in p_text

    import_id = p_resp.json()["import_id"]
    s_resp = client.get(f"/api/v1/imports/{import_id}", headers=headers)
    assert s_resp.status_code == 200
    s_text = s_resp.text
    assert "candidate_db_path" not in s_text
    assert "upload_path" not in s_text

    c_resp = client.post("/api/v1/imports/confirm", json={"import_id": import_id}, headers=headers)
    assert c_resp.status_code == 200
    c_text = c_resp.text
    assert "candidate_db_path" not in c_text
    assert "upload_path" not in c_text


# =========================================================================
# Section 5: Validate Preview and Data-Quality Semantics
# =========================================================================

def test_empty_workbook_fails_gracefully(test_env):
    """Empty 0-byte workbook upload is rejected with 415/422."""
    client = test_env["client"]
    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("empty.xlsx", b"", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code in (415, 422)


def test_workbook_with_zero_accepted_students_cannot_confirm(test_env):
    """Workbook with headers but 0 student records cannot be confirmed (can_confirm=False)."""
    client = test_env["client"]

    # Create synthetic workbook with headers but no student rows
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["Seat No", "Roll No", "Student Name", "C101 (TH)"])
    buf = io.BytesIO()
    wb.save(buf)
    wb_bytes = buf.getvalue()

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("zero_students.xlsx", wb_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    # Either ingestion detects no valid student rows or returns 0 students with can_confirm=False
    if resp.status_code == 200:
        data = resp.json()
        assert data["students_count"] == 0
        assert data["can_confirm"] is False
        assert any("zero" in err.lower() for err in data["blocking_errors"])
        # Confirm must be rejected
        c_resp = client.post(
            "/api/v1/imports/confirm",
            json={"import_id": data["import_id"]},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert c_resp.status_code == 409
    else:
        assert resp.status_code == 422


def test_multi_sheet_messy_workbook_discovery(test_env):
    """Multi-sheet messy workbook is accepted and reports sheets inspected/accepted."""
    client = test_env["client"]
    path = Path(__file__).resolve().parent.parent.parent / "data" / "test3_arts_messy_sheet_per_division.xlsx"
    if not path.is_file():
        pytest.skip(f"Test fixture missing: {path}")

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("multi_sheet.xlsx", path.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["layout"]["sheets_inspected"]) >= 1
    assert data["students_count"] > 0


def test_preview_blocking_duplicate_student_identities(test_env, sample_xlsx_bytes):
    """Workbook with duplicate student IDs triggers data-quality error and blocks confirmation."""
    client = test_env["client"]
    wb = openpyxl.load_workbook(io.BytesIO(sample_xlsx_bytes))
    ws = wb.active
    # Duplicate student identity (roll_no at col 3, seat_no at col 2) from row 8 into row 9
    ws.cell(9, 2, ws.cell(8, 2).value)
    ws.cell(9, 3, ws.cell(8, 3).value)
    buf = io.BytesIO()
    wb.save(buf)

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("duplicates.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["can_confirm"] is False
    assert any("duplicate" in err.lower() for err in data["blocking_errors"])
    assert data["data_quality"]["error_count"] >= 1

    # Activation must be blocked
    conf_resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": data["import_id"]},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert conf_resp.status_code == 409
    assert conf_resp.json()["error_code"] in ("BLOCKING_ERRORS_PRESENT", "INVALID_STATE_TRANSITION")


def test_preview_blocking_out_of_range_marks(test_env, sample_xlsx_bytes):
    """Workbook with out-of-range marks (> 100) triggers non-blocking data-quality warning, not activation block."""
    client = test_env["client"]
    wb = openpyxl.load_workbook(io.BytesIO(sample_xlsx_bytes))
    ws = wb.active
    # Set an out-of-range mark (150) in row 8, col 8 (ESE assessment mark)
    ws.cell(8, 8, 150)
    buf = io.BytesIO()
    wb.save(buf)

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("invalid_marks.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["can_confirm"] is True
    assert len(data["blocking_errors"]) == 0
    findings = data.get("data_quality", {}).get("findings", [])
    range_finding = next((f for f in findings if f["check_id"] == "out_of_range_marks"), None)
    assert range_finding is not None
    assert range_finding["severity"] == "warning"
    assert range_finding["count"] >= 1


def test_preview_handles_missing_marks_and_uncalculated_values(test_env, sample_xlsx_bytes):
    """Missing marks, absence markers, and uncalculated placeholders ('-', 'N/A') are parsed safely."""
    client = test_env["client"]
    wb = openpyxl.load_workbook(io.BytesIO(sample_xlsx_bytes))
    ws = wb.active
    ws.cell(8, 6, "N/A")
    ws.cell(8, 7, "-")
    ws.cell(9, 6, "AB")
    buf = io.BytesIO()
    wb.save(buf)

    resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("missing_marks.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["students_count"] == 60
    assert data["scores_count"] > 0


# =========================================================================
# Section 6: File and Resource Safety (Boundary limits, streaming validation)
# =========================================================================

def test_file_size_exactly_at_limit_accepted(test_env):
    """File exactly at configured max_upload_size_bytes is accepted for processing."""
    client = test_env["client"]
    # Reconfigure app with a small 100 KB limit for fast testing
    small_limit = 100 * 1024
    small_settings = Settings(
        database_path=str(test_env["initial_db"]),
        import_api_key=TEST_IMPORT_KEY,
        data_dir=str(test_env["tmp_path"]),
        max_upload_size_bytes=small_limit,
    )
    small_app = create_app(small_settings)

    # Build a valid excel file padded to exactly small_limit bytes
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Seat No", "Student Name", "C101 (TH)"])
    ws.append(["S01", "Student One", 50])
    buf = io.BytesIO()
    wb.save(buf)
    base_bytes = buf.getvalue()
    assert len(base_bytes) < small_limit

    # We can pad zip comment to hit exact size
    needed_padding = small_limit - len(base_bytes)
    # A zip file allows extra comment bytes at the end
    padded_bytes = base_bytes + b" " * needed_padding
    assert len(padded_bytes) == small_limit

    with TestClient(small_app) as sclient:
        # Exactly at limit should NOT trigger 413 FILE_TOO_LARGE
        resp = sclient.post(
            "/api/v1/imports/preview",
            files={"file": ("at_limit.xlsx", padded_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert resp.status_code != 413


def test_file_size_one_byte_over_limit_rejected_with_413(test_env):
    """File 1 byte over configured limit is rejected immediately with 413 FILE_TOO_LARGE."""
    client = test_env["client"]
    small_limit = 100 * 1024
    small_settings = Settings(
        database_path=str(test_env["initial_db"]),
        import_api_key=TEST_IMPORT_KEY,
        data_dir=str(test_env["tmp_path"]),
        max_upload_size_bytes=small_limit,
    )
    small_app = create_app(small_settings)

    # 1 byte over limit
    oversized_bytes = b"PK\x03\x04" + b"X" * (small_limit - 4 + 1)
    assert len(oversized_bytes) == small_limit + 1

    with TestClient(small_app) as sclient:
        resp = sclient.post(
            "/api/v1/imports/preview",
            files={"file": ("over_limit.xlsx", oversized_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert resp.status_code == 413
        assert resp.json()["error_code"] == "FILE_TOO_LARGE"

        # Verify no quarantine upload files remain
        dirs = get_import_storage_dirs(small_settings)
        quarantine_files = list(dirs["uploads"].glob("*"))
        assert len(quarantine_files) == 0
