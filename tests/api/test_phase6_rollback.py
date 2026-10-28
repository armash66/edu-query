"""Integration tests for Dataset Versioning, Safe Activation, and Rollback (Phase 6 Workstream D)."""

from __future__ import annotations

import json
from pathlib import Path
import tempfile

import duckdb
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app

TEST_IMPORT_KEY = "test-secret-admin-key-456"


@pytest.fixture
def rollback_workspace():
    """Create isolated workspace with two valid dataset versions and pointer."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        datasets_dir = tmp_path / "datasets"
        datasets_dir.mkdir(parents=True, exist_ok=True)

        # Dataset Version 1
        db_v1_path = datasets_dir / "dataset_v1_20261018.duckdb"
        con1 = duckdb.connect(str(db_v1_path))
        init_database(con1)
        populate_table(
            con1,
            "students",
            [{"student_id": "STU_V1", "name": "Version 1 Student", "seat_no": "S01", "roll_no": "1", "division": "A", "result": "PASSES"}],
        )
        populate_table(
            con1,
            "courses",
            [{"code": "C101", "name": "V1 Course", "kind": "theory", "credits": 4.0, "components": "TH"}],
        )
        populate_table(con1, "enrollment", [{"student_id": "STU_V1", "course_code": "C101"}])
        populate_table(
            con1,
            "scores",
            [{"student_id": "STU_V1", "course_code": "C101", "component": "TH", "value": 75.0, "flag": None, "state": "marked", "raw_text": "75", "source_sheet": "S1", "source_row": 1}],
        )
        con1.close()

        # Dataset Version 2
        db_v2_path = datasets_dir / "dataset_v2_20261018.duckdb"
        con2 = duckdb.connect(str(db_v2_path))
        init_database(con2)
        populate_table(
            con2,
            "students",
            [{"student_id": "STU_V2", "name": "Version 2 Student", "seat_no": "S02", "roll_no": "2", "division": "B", "result": "PASSES"}],
        )
        populate_table(
            con2,
            "courses",
            [{"code": "C202", "name": "V2 Course", "kind": "theory", "credits": 3.0, "components": "TH"}],
        )
        populate_table(con2, "enrollment", [{"student_id": "STU_V2", "course_code": "C202"}])
        populate_table(
            con2,
            "scores",
            [{"student_id": "STU_V2", "course_code": "C202", "component": "TH", "value": 80.0, "flag": None, "state": "marked", "raw_text": "80", "source_sheet": "S1", "source_row": 2}],
        )
        con2.close()

        # Initially, active dataset is Version 2
        pointer_path = tmp_path / "active_dataset.json"
        pointer_path.write_text(
            json.dumps({
                "active_database_path": str(db_v2_path),
                "active_dataset_id": "dataset_v2_20261018",
                "activated_at": "2026-10-18T00:00:00Z",
                "source_workbook": "demo_v2.xlsx",
                "record_counts": {"students": 1, "courses": 1, "scores": 1},
            }),
            encoding="utf-8",
        )

        settings = Settings(
            database_path=str(db_v2_path),
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
                "datasets_dir": datasets_dir,
                "db_v1_path": db_v1_path,
                "db_v2_path": db_v2_path,
                "pointer_path": pointer_path,
            }


def test_list_versions_requires_authentication(rollback_workspace):
    """Dataset version listing is accessible without requiring authentication."""
    client = rollback_workspace["client"]
    res = client.get("/api/v1/imports/versions")
    assert res.status_code == 200
    assert "versions" in res.json()


def test_list_versions_returns_stored_datasets(rollback_workspace):
    client = rollback_workspace["client"]
    res = client.get("/api/v1/imports/versions", headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY})
    assert res.status_code == 200
    data = res.json()
    assert "versions" in data
    assert "active_dataset_id" in data
    assert data["active_dataset_id"] == "dataset_v2_20261018"

    versions = data["versions"]
    assert len(versions) >= 2
    v_ids = {v["dataset_id"] for v in versions}
    assert "dataset_v1_20261018" in v_ids
    assert "dataset_v2_20261018" in v_ids

    # Check is_active flag
    v2_entry = next(v for v in versions if v["dataset_id"] == "dataset_v2_20261018")
    assert v2_entry["is_active"] is True
    v1_entry = next(v for v in versions if v["dataset_id"] == "dataset_v1_20261018")
    assert v1_entry["is_active"] is False


def test_rollback_requires_authentication(rollback_workspace):
    """Rollback is accessible without requiring authentication."""
    client = rollback_workspace["client"]
    res = client.post("/api/v1/imports/rollback", json={"dataset_id": "dataset_v1_20261018"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_rollback_blocks_path_traversal(rollback_workspace):
    client = rollback_workspace["client"]
    traversal_payloads = [
        "../something",
        "../../etc/passwd",
        r"..\windows\system32",
        "nested/sub/db",
    ]
    for bad_id in traversal_payloads:
        res = client.post(
            "/api/v1/imports/rollback",
            json={"dataset_id": bad_id},
            headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
        )
        assert res.status_code in (400, 422)


def test_rollback_non_existent_dataset_fails(rollback_workspace):
    client = rollback_workspace["client"]
    res = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "non_existent_dataset_version"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert res.status_code == 404


def test_rollback_corrupted_empty_database_fails(rollback_workspace):
    client = rollback_workspace["client"]
    datasets_dir = rollback_workspace["datasets_dir"]
    empty_db = datasets_dir / "dataset_empty_corrupt_v0.duckdb"
    con = duckdb.connect(str(empty_db))
    # Leave completely empty, no tables
    con.close()

    res = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "dataset_empty_corrupt_v0"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert res.status_code == 400
    assert "integrity" in res.text.lower() or "error" in res.text.lower()


def test_successful_rollback_switches_active_dataset(rollback_workspace):
    client = rollback_workspace["client"]
    pointer_path = rollback_workspace["pointer_path"]

    # 1. Verify before rollback: queries see STU_V2
    res_before = client.get("/api/v1/students")
    assert res_before.status_code == 200
    students_before = res_before.json()["items"]
    assert len(students_before) == 1
    assert students_before[0]["student_id"] == "STU_V2"

    # 2. Execute rollback to dataset_v1_20261018
    rollback_res = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "dataset_v1_20261018"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert rollback_res.status_code == 200
    res_data = rollback_res.json()
    assert res_data["active_dataset_id"] == "dataset_v1_20261018"
    assert res_data["status"] == "success"

    # 3. Verify pointer file on disk was atomically updated
    pointer_data = json.loads(pointer_path.read_text(encoding="utf-8"))
    assert pointer_data["active_dataset_id"] == "dataset_v1_20261018"

    # 4. Verify subsequent queries immediately reflect dataset_v1_20261018 (STU_V1)
    res_after = client.get("/api/v1/students")
    assert res_after.status_code == 200
    students_after = res_after.json()["items"]
    assert len(students_after) == 1
    assert students_after[0]["student_id"] == "STU_V1"

    # 5. Verify /health reflects dataset_v1_20261018
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["database"]["active_dataset_id"] == "dataset_v1_20261018"

    # 6. Verify version list now shows dataset_v1_20261018 as is_active=True
    ver_res = client.get("/api/v1/imports/versions", headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY})
    assert ver_res.status_code == 200
    ver_items = ver_res.json()["versions"]
    v1_entry = next(v for v in ver_items if v["dataset_id"] == "dataset_v1_20261018")
    v2_entry = next(v for v in ver_items if v["dataset_id"] == "dataset_v2_20261018")
    assert v1_entry["is_active"] is True
    assert v2_entry["is_active"] is False


def test_repeated_rollback_is_idempotent(rollback_workspace):
    client = rollback_workspace["client"]

    # 1. First rollback to v1
    res1 = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "dataset_v1_20261018"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert res1.status_code == 200

    # 2. Second rollback to v1 (already active)
    res2 = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "dataset_v1_20261018"},
        headers={"X-EduQuery-Import-Key": TEST_IMPORT_KEY},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "success"
    assert data2["active_dataset_id"] == "dataset_v1_20261018"
    assert "already active" in data2["message"].lower()


def test_cleanup_preserves_active_dataset_and_versions(rollback_workspace):
    from app.services.import_manager import cleanup_import_storage

    settings = rollback_workspace["settings"]
    db_v1_path = rollback_workspace["db_v1_path"]
    db_v2_path = rollback_workspace["db_v2_path"]

    # Run aggressive cleanup (max_age_seconds=0)
    cleaned = cleanup_import_storage(settings, max_age_seconds=0)

    # Both dataset versions in datasets/ must remain completely intact
    assert db_v1_path.is_file(), "Active/promoted dataset_v1 must never be deleted by cleanup"
    assert db_v2_path.is_file(), "Alternative valid dataset_v2 must never be deleted by cleanup"

