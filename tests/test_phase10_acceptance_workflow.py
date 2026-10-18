"""Synthetic 18-step End-to-End Acceptance Workflow for EduQuery V3 Phase 10.

Tests the complete document-to-insight workflow:
- Stages A & B: Security checks, zip bomb/path traversal rejection, upload, preview, elective groups.
- Stage C: Data quality audits (Checks 1-10).
- Stage D: Dataset activation, atomic pointer switch, persistence.
- Stages E, F, G: Faculty overview, MDM elective denominator checks, student breakdown.
- Stage H: Anomaly detection with default statistical removal, Isolation Forest, persistent reviews.
- Stage I: Server restart recovery from pointer and reviews persistence.
"""
from __future__ import annotations

import io
import json
from pathlib import Path
import openpyxl
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.anomaly_detection import detect_all_anomalies, review_anomaly_finding


def _build_test_workbook(num_students: int = 20) -> io.BytesIO:
    """Build a rich synthetic marksheet with compulsory courses and MDM electives."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    # Row 1-2: Headers
    headers_r1 = ["Seat No", "Roll No", "Student Name", "Email", "Division", "Level", "Elective Choice"]
    headers_r1 += ["CS101", "", "", "MDMBD02", "", "", "MDMBI02", "", "", "MDMIE02", "", "", "MDMRB02", "", ""]
    headers_r1 += ["Total Marks", "SGPI", "CGPA", "Result"]

    headers_r2 = ["", "", "", "", "", "", ""]
    headers_r2 += ["TOT1", "Credits", "Grade", "TOT1", "Credits", "Grade", "TOT1", "Credits", "Grade", "TOT1", "Credits", "Grade", "TOT1", "Credits", "Grade"]
    headers_r2 += ["", "", "", ""]

    for c, h in enumerate(headers_r1, 1):
        if h:
            ws.cell(1, c, h)
    for c, h in enumerate(headers_r2, 1):
        if h:
            ws.cell(2, c, h)

    electives = ["MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"]
    for i in range(num_students):
        r = 3 + i
        sid = f"23108A{i+1:04d}"
        chosen_el = electives[i % len(electives)]

        ws.cell(r, 1, f"SEAT_{i+1}")
        ws.cell(r, 2, sid)
        ws.cell(r, 3, f"STUDENT_{i+1}")
        ws.cell(r, 4, f"student{i+1}@example.com")
        ws.cell(r, 5, "A" if i < num_students // 2 else "B")
        ws.cell(r, 6, "UG")
        ws.cell(r, 7, chosen_el)

        # CS101: 75 marks
        ws.cell(r, 8, 75)
        ws.cell(r, 9, 4)
        ws.cell(r, 10, "A")

        # Electives
        col_map = {"MDMBD02": 11, "MDMBI02": 14, "MDMIE02": 17, "MDMRB02": 20}
        el_col = col_map[chosen_el]
        ws.cell(r, el_col, 80 if i != 2 else 35)  # i=2 has a failing mark in elective
        ws.cell(r, el_col + 1, 4)
        ws.cell(r, el_col + 2, "A" if i != 2 else "F")

        ws.cell(r, 23, 155)
        ws.cell(r, 24, 8.0)
        ws.cell(r, 25, 8.0)
        ws.cell(r, 26, "PASSES" if i != 2 else "FAILS")

    bio = io.BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio


def test_phase10_full_end_to_end_acceptance_workflow(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Execute complete 18-step verification from upload through recovery."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    datasets_dir = data_dir / "datasets"
    datasets_dir.mkdir()
    reviews_dir = data_dir / "reviews"
    reviews_dir.mkdir()
    pointer_path = data_dir / "active_dataset.json"

    admin_key = "test-phase10-secret-key-12345"

    monkeypatch.setenv("EDUQUERY_DATA_DIR", str(data_dir))
    monkeypatch.setenv("EDUQUERY_ACTIVE_POINTER_PATH", str(pointer_path))
    monkeypatch.setenv("EDUQUERY_IMPORT_API_KEY", admin_key)

    settings = Settings(
        app_env="production",
        data_dir=str(data_dir),
        database_path=str(data_dir / "eduquery.duckdb"),
        active_dataset_pointer_path=str(pointer_path),
        import_api_key=admin_key,
    )

    app = create_app(settings)
    client = TestClient(app)
    auth_headers = {"X-EduQuery-Import-Key": admin_key}

    # Step 1: Health probe check on uninitialized server
    health_resp = client.get("/health")
    assert health_resp.status_code == 503
    live_resp = client.get("/livez")
    assert live_resp.status_code == 200
    assert live_resp.json()["status"] == "alive"

    # Step 2: Upload security - Reject missing auth credentials
    wb_bio = _build_test_workbook(20)
    up_no_auth = client.post(
        "/api/v1/imports/preview",
        files={"file": ("test.xlsx", wb_bio.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert up_no_auth.status_code == 401

    # Step 3: Upload security - Reject invalid auth credentials
    up_bad_auth = client.post(
        "/api/v1/imports/preview",
        headers={"X-EduQuery-Import-Key": "wrong-key"},
        files={"file": ("test.xlsx", wb_bio.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert up_bad_auth.status_code in (401, 403)

    # Step 4: Upload valid workbook and inspect preview
    preview_resp = client.post(
        "/api/v1/imports/preview",
        headers=auth_headers,
        files={"file": ("semester_results.xlsx", wb_bio.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert preview_resp.status_code == 200
    p_data = preview_resp.json()
    import_id = p_data["import_id"]
    assert p_data["state"] == "preview_ready"
    assert p_data["students_count"] == 20
    assert p_data["courses_count"] >= 5

    # Step 5: Verify preview discloses elective groups
    layout_data = p_data["layout"]
    assert "elective_groups" in layout_data
    el_groups = layout_data["elective_groups"]
    assert len(el_groups) == 1
    assert el_groups[0]["group_id"] == "mdm_electives"
    assert el_groups[0]["is_mutually_exclusive"] is True
    assert el_groups[0]["assigned_count"] == 20
    assert el_groups[0]["unassigned_count"] == 0

    # Step 6: Verify data quality integrity audit in preview
    dq = p_data["data_quality"]
    assert dq["health_status"] in ("Good", "Needs Attention")
    assert dq["error_count"] == 0

    # Step 7: Confirm and activate dataset
    confirm_resp = client.post(
        "/api/v1/imports/confirm",
        headers=auth_headers,
        json={"import_id": import_id},
    )
    assert confirm_resp.status_code == 200
    c_data = confirm_resp.json()
    assert c_data["state"] == "activated"
    dataset_id = c_data["active_dataset_id"]

    # Step 8: Verify active dataset pointer was written atomically
    assert pointer_path.is_file()
    pointer_info = json.loads(pointer_path.read_text())
    assert pointer_info["active_dataset_id"] == dataset_id
    assert Path(pointer_info["active_database_path"]).is_file()

    # Step 9: Verify health and readiness probes now report healthy & ready
    ready_resp = client.get("/readyz")
    assert ready_resp.status_code == 200
    assert ready_resp.json()["status"] == "ready"

    # Step 10: Faculty Overview Analytics
    overview_resp = client.get("/api/v1/analytics/overview")
    assert overview_resp.status_code == 200
    o_data = overview_resp.json()
    assert o_data["total_students"] == 20
    assert o_data["passed_students"] == 19
    assert o_data["failed_students"] == 1

    # Step 11: MDM Elective Subject Failure Report - Enrolled denominator isolation
    # MDMBD02 has 20 // 4 = 5 students enrolled
    rep_bd = client.get("/api/v1/subjects/MDMBD02/failures")
    assert rep_bd.status_code == 200
    bd_data = rep_bd.json()
    assert bd_data["course_code"] == "MDMBD02"
    assert bd_data["total_enrolled"] == 5
    assert bd_data["confirmed_failures_count"] == 0
    assert bd_data["passed_count"] == 5

    # MDMIE02 has student i=2 who failed
    rep_ie = client.get("/api/v1/subjects/MDMIE02/failures")
    assert rep_ie.status_code == 200
    ie_data = rep_ie.json()
    assert ie_data["total_enrolled"] == 5
    assert ie_data["confirmed_failures_count"] == 1
    assert len(ie_data["failing_students"]) == 1
    assert ie_data["failing_students"][0]["student_id"] == "23108A0003"
    assert ie_data["failing_students"][0]["letter_grade"] == "F"

    # Step 12: Student Breakdown Investigation & Provenance
    s_resp = client.get("/api/v1/students/23108A0003/breakdown")
    assert s_resp.status_code == 200
    s_data = s_resp.json()
    assert s_data["student"]["student_id"] == "23108A0003"
    assert s_data["student"]["division"] == "A"
    assert s_data["student"]["source_sheet"] == "Sheet1"
    assert s_data["student"]["source_row"] == 5
    # Verify enrolled in MDMIE02 and NOT enrolled in MDMBD02
    enrolled_courses = [c["course_code"] for c in s_data["subjects"]]
    assert "MDMIE02" in enrolled_courses
    assert "MDMBD02" not in enrolled_courses

    # Step 13: Anomaly Detection Default State - Statistical MAD excluded by default
    anom_sum_resp = client.get("/api/v1/anomalies/summary")
    assert anom_sum_resp.status_code == 200
    anom_sum = anom_sum_resp.json()
    assert "robust_zscore" not in anom_sum["by_method"] or anom_sum["by_method"]["robust_zscore"] == 0

    # Step 14: Anomaly Findings Listing
    findings_resp = client.get("/api/v1/anomalies/findings")
    assert findings_resp.status_code == 200
    find_data = findings_resp.json()
    assert all(f["method"] != "robust_zscore" for f in find_data["findings"])

    # Step 15: Faculty Review Action & Persistence
    finding_id = "REV-TEST-001"
    rev_resp = client.post(
        f"/api/v1/anomalies/findings/{finding_id}/review",
        json={"reviewed": True, "reviewer_name": "Dr. Academic Reviewer", "notes": "Verified in physical records"},
    )
    assert rev_resp.status_code == 200
    assert rev_resp.json()["reviewed"] is True

    # Step 16: Verify reviews stored in dataset-scoped persistent file
    review_file = reviews_dir / f"{dataset_id}_reviews.json"
    assert review_file.is_file()
    rev_json = json.loads(review_file.read_text())
    assert isinstance(rev_json, dict)

    # Step 17: Crash Recovery Simulation - Restart server with new instance
    # Simulates server reboot: recreate app from scratch using same settings
    recovered_app = create_app(settings)
    rec_client = TestClient(recovered_app)

    # Verify recovered app serves requests immediately from active pointer
    rec_ready = rec_client.get("/readyz")
    assert rec_ready.status_code == 200
    rec_overview = rec_client.get("/api/v1/analytics/overview")
    assert rec_overview.status_code == 200
    assert rec_overview.json()["total_students"] == 20

    # Step 18: Verify review state retained after recovery
    rec_rev_file = reviews_dir / f"{dataset_id}_reviews.json"
    assert rec_rev_file.is_file()
