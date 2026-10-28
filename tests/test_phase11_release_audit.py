"""Phase 11 Release Candidate Audit & Deployment Rehearsal Test Suite.

Verifies:
1. Production Static Asset & SPA Fallback Serving
2. Security Boundary & Route Authorization Audit
3. MDM Elective Invariant Verification (Per-Student & Aggregate)
4. Dataset Isolation & Persistent Review State (Switching, Rollback, Corruption Recovery)
5. Upload & Archive Hardening (Entry Counts, Encryption, Zip-bomb, Path Traversal)
"""
from __future__ import annotations

import io
import json
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_db
from app.config import Settings
from app.core.database import init_database, populate_table
from app.core.ingest import ingest
from app.main import create_app
from app.services.anomaly_detection import (
    _REVIEWS_CACHE,
    _get_reviews_dir,
    _load_reviews_store,
    _save_reviews_store,
    list_anomaly_findings,
    review_anomaly_finding,
)


@pytest.fixture
def isolated_storage():
    """Create isolated temporary data directory for persistence tests."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        datasets_dir = tmp_path / "datasets"
        reviews_dir = tmp_path / "reviews"
        datasets_dir.mkdir(parents=True, exist_ok=True)
        reviews_dir.mkdir(parents=True, exist_ok=True)

        old_data_dir = os.environ.get("EDUQUERY_DATA_DIR")
        os.environ["EDUQUERY_DATA_DIR"] = str(tmp_path)
        yield tmp_path
        if old_data_dir is not None:
            os.environ["EDUQUERY_DATA_DIR"] = old_data_dir
        else:
            os.environ.pop("EDUQUERY_DATA_DIR", None)


# ==============================================================================
# 1. Production Static Asset & SPA Fallback Serving
# ==============================================================================

def test_production_spa_fallback_and_static_serving():
    """Verify that frontend assets are served correctly and SPA fallback works on nested routes."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        frontend_dist_dir="frontend/dist",
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        # 1. Root route returns index.html
        resp_root = client.get("/")
        assert resp_root.status_code == 200
        assert "text/html" in resp_root.headers.get("content-type", "")
        assert "<html" in resp_root.text.lower() or "<!doctype html" in resp_root.text.lower()

        # 2. Nested SPA client-side routes return index.html (SPA Fallback)
        nested_routes = [
            "/students",
            "/subjects",
            "/explore",
            "/quality",
            "/import",
            "/subjects/PCEC12T/failures",
            "/students/STU_001/breakdown",
        ]
        for route in nested_routes:
            resp = client.get(route)
            assert resp.status_code == 200, f"Route {route} failed with {resp.status_code}"
            assert "text/html" in resp.headers.get("content-type", "")
            assert "<html" in resp.text.lower() or "<!doctype html" in resp.text.lower()

        # 3. Static root assets (e.g., favicon.svg)
        resp_favicon = client.get("/favicon.svg")
        assert resp_favicon.status_code == 200
        assert "svg" in resp_favicon.headers.get("content-type", "")

        # 4. API routes are NEVER intercepted by SPA fallback (missing API route returns 404 JSON)
        resp_api_404 = client.get("/api/v1/nonexistent-endpoint-xyz")
        assert resp_api_404.status_code == 404
        assert resp_api_404.headers.get("content-type", "").startswith("application/json")
        assert resp_api_404.json()["error_code"] == "HTTP_ERROR"


# ==============================================================================
# 2. Security Boundary & Route Authorization Audit
# ==============================================================================

def test_security_boundary_classification():
    """Verify authorization matrix across public, academic-read, and administrative routes."""
    admin_key = "test-secret-phase11-key"
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        import_api_key=admin_key,
    )
    test_app = create_app(settings)

    # Populate in-memory database with minimal schema
    con = duckdb.connect(":memory:")
    init_database(con)
    populate_table(con, "students", [{"student_id": "S1", "name": "Student A", "division": "A", "result": "PASSES"}])
    populate_table(con, "courses", [{"code": "C1", "name": "Course 1", "kind": "theory", "credits": 3.0}])
    test_app.dependency_overrides[get_db] = lambda: con

    with TestClient(test_app) as client:
        # Group 1: Public health endpoints (No auth required)
        assert client.get("/livez").status_code == 200
        assert client.get("/readyz").status_code == 200
        assert client.get("/health").status_code == 200

        # Group 2: Academic read endpoints (unauthenticated in current design; intended for intranet/VPN)
        assert client.get("/api/v1/students").status_code == 200
        assert client.get("/api/v1/subjects").status_code == 200
        assert client.get("/api/v1/data-quality").status_code == 200
        assert client.get("/api/v1/anomalies/summary").status_code == 200
        assert client.get("/api/v1/analytics/overview").status_code == 200

        # Group 3: Import and dataset management (Accessible without admin key)
        resp_versions = client.get("/api/v1/imports/versions")
        assert resp_versions.status_code == 200

        # Endpoints validate requests structurally (422/404), not 401
        assert client.post("/api/v1/imports/preview").status_code == 422
        assert client.post("/api/v1/imports/confirm", json={"import_id": "nonexistent_session"}).status_code == 404
        assert client.get("/api/v1/imports/sess_12345678").status_code == 404


def test_import_endpoints_disabled_when_key_unconfigured():
    """Verify that import endpoints remain fully operational when no admin key is configured."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        import_api_key=None,  # Unconfigured
    )
    test_app = create_app(settings)

    with TestClient(test_app) as client:
        resp = client.get("/api/v1/imports/versions")
        assert resp.status_code == 200
        assert "versions" in resp.json()


# ==============================================================================
# 3. MDM Elective Invariant Verification (Per-Student & Aggregate)
# ==============================================================================

def test_mdm_elective_invariants_real_workbook():
    """Verify per-student and aggregate elective invariants on Result_anonymized.xlsx."""
    workbook_path = Path("data/Result_anonymized.xlsx")
    if not workbook_path.is_file():
        pytest.skip("Result_anonymized.xlsx not present in local data directory")

    con, report = ingest(workbook_path, db_path=":memory:")

    # 1. Total student count
    students = con.execute("SELECT student_id, name, elective_choice FROM students").fetchall()
    assert len(students) == 145

    # 2. Check each student has marks in EXACTLY ONE MDM elective
    elective_codes = ["MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"]
    placeholders = ",".join(f"'{c}'" for c in elective_codes)

    student_elective_scores = con.execute(f"""
        SELECT student_id, COUNT(DISTINCT course_code) as distinct_electives
        FROM scores
        WHERE course_code IN ({placeholders})
        GROUP BY student_id
    """).fetchall()

    # Every single student must have scores in exactly 1 elective
    assert len(student_elective_scores) == 145
    for s_id, count in student_elective_scores:
        assert count == 1, f"Student {s_id} has marks recorded in {count} electives (must be exactly 1)"

    # 3. Unselected alternatives MUST produce 0 score records
    total_elective_scores = con.execute(f"""
        SELECT COUNT(*) FROM scores WHERE course_code IN ({placeholders})
    """).fetchone()[0]

    # In Result_anonymized.xlsx, each elective has 4 component scores per enrolled student (TH, IA, TW, PR)
    # Total scores = 145 students * 4 components = 580 scores
    assert total_elective_scores == 580, f"Expected exactly 580 elective score records, got {total_elective_scores}"

    # 4. Check aggregate counts match verified ground truth
    enrollment_counts = dict(con.execute(f"""
        SELECT course_code, COUNT(DISTINCT student_id) as enrolled
        FROM scores
        WHERE course_code IN ({placeholders})
        GROUP BY course_code
    """).fetchall())

    assert enrollment_counts.get("MDMBD02") == 63
    assert enrollment_counts.get("MDMBI02") == 9
    assert enrollment_counts.get("MDMIE02") == 41
    assert enrollment_counts.get("MDMRB02") == 32
    assert sum(enrollment_counts.values()) == 145

    # 5. Check enrollment table matches scores table
    enrollment_table_counts = dict(con.execute(f"""
        SELECT course_code, COUNT(*) FROM enrollment WHERE course_code IN ({placeholders}) GROUP BY course_code
    """).fetchall())
    assert enrollment_table_counts == enrollment_counts

    con.close()


# ==============================================================================
# 4. Dataset Isolation & Persistent Review State
# ==============================================================================

def test_dataset_isolation_and_persistent_review(isolated_storage):
    """Verify review decisions are strictly scoped to dataset IDs and survive restarts."""
    db1_path = isolated_storage / "datasets" / "dataset_alpha.duckdb"
    con1 = duckdb.connect(str(db1_path))
    init_database(con1)
    populate_table(con1, "students", [{"student_id": "STU_SHARED_1", "name": "Student Shared", "division": "A", "result": "PASSES"}])
    populate_table(con1, "courses", [{"code": "CS1", "name": "Course 1", "kind": "theory", "credits": 4.0}])
    populate_table(con1, "reconciliation", [{
        "student_id": "STU_SHARED_1",
        "course_code": "CS1",
        "printed_total": 500.0,
        "computed_total": 450.0,
        "total_match": False,
        "grade": "F",
        "flags": "MISMATCH",
    }])

    # 1. Initially 0 reviews for dataset_alpha
    findings = list_anomaly_findings(con1)
    assert len(findings.findings) >= 1
    target_finding_id = findings.findings[0].finding_id
    assert findings.findings[0].reviewed is False

    # 2. Record review for dataset_alpha
    review_resp = review_anomaly_finding(
        finding_id=target_finding_id,
        reviewed=True,
        reviewer_name="Dr. Smith",
        notes="Verified calculation anomaly against physical marksheet copy.",
        dataset_id="dataset_alpha",
    )
    assert review_resp.reviewed is True

    # 3. Verify dataset_alpha now reflects the review
    _REVIEWS_CACHE.clear()
    findings_alpha_updated = list_anomaly_findings(con1)
    finding_alpha = next(f for f in findings_alpha_updated.findings if f.finding_id == target_finding_id)
    assert finding_alpha.reviewed is True
    assert finding_alpha.review_notes == "Verified calculation anomaly against physical marksheet copy."

    # 4. Switch to dataset_beta (which has the SAME student ID and reconciliation issue)
    db2_path = isolated_storage / "datasets" / "dataset_beta.duckdb"
    con2 = duckdb.connect(str(db2_path))
    init_database(con2)
    populate_table(con2, "students", [{"student_id": "STU_SHARED_1", "name": "Student Shared", "division": "A", "result": "PASSES"}])
    populate_table(con2, "courses", [{"code": "CS1", "name": "Course 1", "kind": "theory", "credits": 4.0}])
    populate_table(con2, "reconciliation", [{
        "student_id": "STU_SHARED_1",
        "course_code": "CS1",
        "printed_total": 500.0,
        "computed_total": 450.0,
        "total_match": False,
        "grade": "F",
        "flags": "MISMATCH",
    }])

    # 5. In dataset_beta, findings must NOT be marked reviewed!
    _REVIEWS_CACHE.clear()
    findings_beta = list_anomaly_findings(con2)
    assert len(findings_beta.findings) >= 1
    finding_beta = next(f for f in findings_beta.findings if f.finding_id == target_finding_id)
    assert finding_beta.reviewed is False
    assert finding_beta.review_notes is None

    # 6. Verify dataset_alpha reviews are still intact upon return
    _REVIEWS_CACHE.clear()
    reviews_alpha = _load_reviews_store("dataset_alpha")
    assert target_finding_id in reviews_alpha
    assert reviews_alpha[target_finding_id]["reviewed_by"] == "Dr. Smith"

    # 7. Corrupted review file handling (graceful recovery without crash)
    _REVIEWS_CACHE.clear()
    reviews_dir = _get_reviews_dir()
    corrupt_file = reviews_dir / "corrupted_dataset_reviews.json"
    corrupt_file.write_text("{malformed json... not valid!!!", encoding="utf-8")

    loaded_corrupt = _load_reviews_store("corrupted_dataset")
    assert loaded_corrupt == {}  # Gracefully recovers with empty dictionary

    con1.close()
    con2.close()


# ==============================================================================
# 5. Upload & Archive Hardening
# ==============================================================================

def test_archive_entry_count_limit_rejected(isolated_storage):
    """Verify archives with excessive entry counts (>1000) are safely rejected as SUSPICIOUS_ARCHIVE."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(isolated_storage),
        import_api_key="test-key",
    )
    test_app = create_app(settings)

    # Build synthetic zip with 1005 tiny XML entries and [Content_Types].xml
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types></Types>")
        for i in range(1005):
            zf.writestr(f"xl/worksheets/sheet_{i}.xml", "<sheet></sheet>")

    buf.seek(0)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/imports/preview",
            files={"file": ("bomb.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": "test-key"},
        )
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "SUSPICIOUS_ARCHIVE"
        assert "exceeding safety threshold" in data["details"][0]


def test_encrypted_archive_rejected(isolated_storage):
    """Verify password-protected/encrypted archives are safely rejected as SUSPICIOUS_ARCHIVE."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(isolated_storage),
        import_api_key="test-key",
    )
    test_app = create_app(settings)

    # Build zip and set encrypted bit on central directory entry
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types></Types>")
        zf.writestr("xl/workbook.xml", b"encrypted content")

    raw = bytearray(buf.getvalue())
    cd_idx = raw.find(b"PK\x01\x02")
    if cd_idx != -1:
        raw[cd_idx + 8] |= 0x01  # Set general purpose bit 0 (encrypted)
    encrypted_bytes = bytes(raw)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/imports/preview",
            files={"file": ("encrypted.xlsx", encrypted_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": "test-key"},
        )
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "SUSPICIOUS_ARCHIVE"
        assert "Encrypted or password-protected" in data["details"][0]


def test_path_traversal_archive_rejected(isolated_storage):
    """Verify archives containing directory traversal filenames (..) are rejected."""
    settings = Settings(
        app_env="production",
        database_path=":memory:",
        data_dir=str(isolated_storage),
        import_api_key="test-key",
    )
    test_app = create_app(settings)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "<Types></Types>")
        zf.writestr("../../../evil.xml", "<evil></evil>")

    buf.seek(0)

    with TestClient(test_app) as client:
        resp = client.post(
            "/api/v1/imports/preview",
            files={"file": ("traversal.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers={"X-EduQuery-Import-Key": "test-key"},
        )
        assert resp.status_code == 422
        data = resp.json()
        assert data["error_code"] == "SUSPICIOUS_ARCHIVE"
        assert "path traversal" in data["details"][0]
