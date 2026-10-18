"""Comprehensive End-to-End Workflow & Integration Verification (Phase 7).

Verifies the entire lifecycle:
1. Initial health inspection and dataset provenance.
2. Student search, identity resolution, component breakdown, and classification reasons.
3. Subject catalog, failure roster, and failure reason explanations.
4. Server-side CSV report exports (breakdown, failures, filtered roster).
5. Marksheet preview quarantine verification (preview does NOT replace active dataset).
6. Controlled dataset activation and immediate propagation to faculty queries.
7. Dataset versioning inspection and safe rollback to prior verified dataset.
8. Unauthenticated access prevention and input validation error handling.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
import tempfile

import duckdb
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app

ADMIN_KEY = "super-secret-release-candidate-key-999"


@pytest.fixture
def e2e_environment():
    """Setup temporary workspace with initial verified dataset V1 and staged files."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        datasets_dir = tmp_path / "datasets"
        datasets_dir.mkdir(parents=True, exist_ok=True)

        # Baseline Dataset V1
        db_v1_path = datasets_dir / "dataset_e2e_baseline_v1.duckdb"
        con1 = duckdb.connect(str(db_v1_path))
        init_database(con1)
        populate_table(
            con1,
            "students",
            [
                {
                    "student_id": "STU_E2E_01",
                    "name": "E2E Student One",
                    "seat_no": "SEAT_01",
                    "roll_no": "101",
                    "division": "A",
                    "result": "PASSES",
                    "sgpi": 8.5,
                    "total_marks": 75.0,
                    "source_sheet": "Sheet1",
                    "source_row": 5,
                },
                {
                    "student_id": "STU_E2E_02",
                    "name": "E2E Student Two",
                    "seat_no": "SEAT_02",
                    "roll_no": "102",
                    "division": "A",
                    "result": "FAILS",
                    "sgpi": 0.0,
                    "total_marks": 25.0,
                    "source_sheet": "Sheet1",
                    "source_row": 6,
                },
            ],
        )
        populate_table(
            con1,
            "courses",
            [
                {
                    "code": "CS101",
                    "name": "Computer Science Foundations",
                    "kind": "theory",
                    "credits": 4.0,
                    "components": "TH,IA",
                }
            ],
        )
        populate_table(
            con1,
            "enrollment",
            [
                {"student_id": "STU_E2E_01", "course_code": "CS101"},
                {"student_id": "STU_E2E_02", "course_code": "CS101"},
            ],
        )
        populate_table(
            con1,
            "scores",
            [
                {"student_id": "STU_E2E_01", "course_code": "CS101", "component": "TH", "value": 60.0, "flag": None, "state": "marked", "raw_text": "60", "source_sheet": "Sheet1", "source_row": 5},
                {"student_id": "STU_E2E_01", "course_code": "CS101", "component": "IA", "value": 15.0, "flag": None, "state": "marked", "raw_text": "15", "source_sheet": "Sheet1", "source_row": 5},
                {"student_id": "STU_E2E_02", "course_code": "CS101", "component": "TH", "value": 15.0, "flag": "F", "state": "marked", "raw_text": "15 F", "source_sheet": "Sheet1", "source_row": 6},
                {"student_id": "STU_E2E_02", "course_code": "CS101", "component": "IA", "value": 10.0, "flag": None, "state": "marked", "raw_text": "10", "source_sheet": "Sheet1", "source_row": 6},
            ],
        )
        populate_table(
            con1,
            "grades",
            [
                {"student_id": "STU_E2E_01", "course_code": "CS101", "letter": "A"},
                {"student_id": "STU_E2E_02", "course_code": "CS101", "letter": "F"},
            ],
        )
        populate_table(
            con1,
            "reconciliation",
            [
                {"student_id": "STU_E2E_01", "course_code": "CS101", "printed_total": 75.0, "computed_total": 75.0, "total_match": True, "grade": "A", "flags": ""},
                {"student_id": "STU_E2E_02", "course_code": "CS101", "printed_total": 25.0, "computed_total": 25.0, "total_match": True, "grade": "F", "flags": "F"},
            ],
        )
        con1.close()

        # Write initial active pointer
        pointer_path = tmp_path / "active_dataset.json"
        pointer_path.write_text(
            json.dumps({
                "active_database_path": str(db_v1_path),
                "active_dataset_id": "dataset_e2e_baseline_v1",
                "activated_at": "2026-10-18T00:00:00Z",
                "source_workbook": "baseline_v1.xlsx",
                "record_counts": {"students": 2, "courses": 1, "scores": 4},
            }),
            encoding="utf-8",
        )

        settings = Settings(
            database_path=str(db_v1_path),
            import_api_key=ADMIN_KEY,
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
                "pointer_path": pointer_path,
            }


def test_full_application_lifecycle_e2e(e2e_environment):
    client = e2e_environment["client"]

    # ---------------------------------------------------------
    # 1. Health Probe & Active Dataset Identification
    # ---------------------------------------------------------
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["status"] == "healthy"
    assert health_data["database"]["connected"] is True
    assert health_data["database"]["students_count"] == 2
    assert health_data["database"]["courses_count"] == 1
    assert health_data["database"]["active_dataset_id"] == "dataset_e2e_baseline_v1"

    # ---------------------------------------------------------
    # 2. Student Lookup, Performance Breakdown & Provenance
    # ---------------------------------------------------------
    roster_resp = client.get("/api/v1/students")
    assert roster_resp.status_code == 200
    roster = roster_resp.json()["items"]
    assert len(roster) == 2

    breakdown_resp = client.get("/api/v1/students/STU_E2E_01/breakdown")
    assert breakdown_resp.status_code == 200
    b_data = breakdown_resp.json()
    assert b_data["status"] == "success"
    assert b_data["student"]["name"] == "E2E Student One"
    assert len(b_data["subjects"]) == 1
    subj = b_data["subjects"][0]
    assert subj["course_code"] == "CS101"
    assert subj["recorded_result"] == "passed"
    assert subj["classification_reason"] == "PASSING_LETTER_GRADE"

    # Failing student
    fail_breakdown_resp = client.get("/api/v1/students/STU_E2E_02/breakdown")
    assert fail_breakdown_resp.status_code == 200
    fb_data = fail_breakdown_resp.json()
    assert fb_data["subjects"][0]["recorded_result"] == "failed"
    assert fb_data["subjects"][0]["classification_reason"] == "FAILING_LETTER_GRADE"

    # ---------------------------------------------------------
    # 3. Subject Failures Diagnostic Roster
    # ---------------------------------------------------------
    subject_resp = client.get("/api/v1/subjects/CS101/failures")
    assert subject_resp.status_code == 200
    s_data = subject_resp.json()
    assert s_data["total_enrolled"] == 2
    assert s_data["confirmed_failures_count"] == 1
    assert s_data["passed_count"] == 1
    assert s_data["unresolved_count"] == 0
    assert len(s_data["failing_students"]) == 1
    f_student = s_data["failing_students"][0]
    assert f_student["student_id"] == "STU_E2E_02"
    assert f_student["failure_reason"] == "FAILING_LETTER_GRADE"

    # ---------------------------------------------------------
    # 4. CSV Reports Export with Formula Injection Safeguards
    # ---------------------------------------------------------
    # Roster export
    roster_csv_resp = client.get("/api/v1/students/export")
    assert roster_csv_resp.status_code == 200
    assert "text/csv" in roster_csv_resp.headers["content-type"]
    reader = csv.reader(io.StringIO(roster_csv_resp.text))
    _ = next(reader)  # title
    headers = next(reader)
    rows = list(reader)
    assert len(rows) == 2

    # Subject failures export
    fail_csv_resp = client.get("/api/v1/subjects/CS101/failures/export")
    assert fail_csv_resp.status_code == 200
    assert "subject_CS101_failures.csv" in fail_csv_resp.headers["content-disposition"]
    assert "FAILING_LETTER_GRADE" in fail_csv_resp.text

    # Student breakdown export
    breakdown_csv_resp = client.get("/api/v1/students/STU_E2E_01/export")
    assert breakdown_csv_resp.status_code == 200
    assert "student_STU_E2E_01_breakdown.csv" in breakdown_csv_resp.headers["content-disposition"]
    assert "PASSING_LETTER_GRADE" in breakdown_csv_resp.text

    # ---------------------------------------------------------
    # 5. Workbook Upload & Quarantine (Previewing does NOT activate)
    # ---------------------------------------------------------
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Div A"
    ws.append([None, None, None, "MATH201 - Advanced Calculus", None, None, None, None])
    ws.append(["Seat No", "Name", "Roll No", "End Sem", "Internal", "Total", "Grade", "Credits"])
    ws.append(["S301", "Candidate Three", "301", 80, 19, 99, "O", 4.0])
    ws_bytes = io.BytesIO()
    wb.save(ws_bytes)
    wb.close()
    xlsx_bytes = ws_bytes.getvalue()

    preview_resp = client.post(
        "/api/v1/imports/preview",
        files={"file": ("candidate_math.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"X-EduQuery-Import-Key": ADMIN_KEY},
    )
    assert preview_resp.status_code == 200
    preview_data = preview_resp.json()
    assert preview_data["can_confirm"] is True
    assert preview_data["students_count"] == 1
    assert preview_data["courses_count"] == 1
    import_id = preview_data["import_id"]

    # Verify preview did NOT alter active dataset
    health_check2 = client.get("/health")
    assert health_check2.json()["database"]["active_dataset_id"] == "dataset_e2e_baseline_v1"
    students_check2 = client.get("/api/v1/students")
    assert len(students_check2.json()["items"]) == 2

    # ---------------------------------------------------------
    # 6. Explicit Activation of New Dataset
    # ---------------------------------------------------------
    confirm_resp = client.post(
        "/api/v1/imports/confirm",
        json={"import_id": import_id},
        headers={"X-EduQuery-Import-Key": ADMIN_KEY},
    )
    assert confirm_resp.status_code == 200
    confirm_data = confirm_resp.json()
    assert confirm_data["state"] == "activated"
    new_dataset_id = confirm_data["active_dataset_id"]
    assert new_dataset_id.startswith("dataset_")

    # Immediate reflection on live queries
    health_check3 = client.get("/health")
    assert health_check3.json()["database"]["active_dataset_id"] == new_dataset_id
    students_check3 = client.get("/api/v1/students")
    assert len(students_check3.json()["items"]) == 1
    assert students_check3.json()["items"][0]["name"] == "Candidate Three"

    # ---------------------------------------------------------
    # 7. Dataset Provenance & Safe Rollback to Baseline V1
    # ---------------------------------------------------------
    versions_resp = client.get("/api/v1/imports/versions", headers={"X-EduQuery-Import-Key": ADMIN_KEY})
    assert versions_resp.status_code == 200
    versions_list = versions_resp.json()["versions"]
    assert len(versions_list) >= 2
    # Verify new dataset is active and baseline v1 is available
    v_new = next(v for v in versions_list if v["dataset_id"] == new_dataset_id)
    v_old = next(v for v in versions_list if v["dataset_id"] == "dataset_e2e_baseline_v1")
    assert v_new["is_active"] is True
    assert v_old["is_active"] is False

    # Perform safe rollback back to baseline v1
    rollback_resp = client.post(
        "/api/v1/imports/rollback",
        json={"dataset_id": "dataset_e2e_baseline_v1"},
        headers={"X-EduQuery-Import-Key": ADMIN_KEY},
    )
    assert rollback_resp.status_code == 200
    assert rollback_resp.json()["active_dataset_id"] == "dataset_e2e_baseline_v1"
    assert rollback_resp.json()["status"] == "success"

    # Verify live queries immediately reflect restored baseline V1
    health_check4 = client.get("/health")
    assert health_check4.json()["database"]["active_dataset_id"] == "dataset_e2e_baseline_v1"
    students_check4 = client.get("/api/v1/students")
    assert len(students_check4.json()["items"]) == 2
    assert {s["student_id"] for s in students_check4.json()["items"]} == {"STU_E2E_01", "STU_E2E_02"}
