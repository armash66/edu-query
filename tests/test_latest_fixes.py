"""Automated tests verifying overnight fixes:
1. HOD Brief PDF Export (replacing notepad .txt).
2. Subject-wise toppers per division.
3. Pre-ESE early warning continuous internal evaluations (ISA/MSE).
4. Data quality review persistence and overview KPI synchronization.
"""
import duckdb
from fastapi.testclient import TestClient
from app.main import app
from app.services.export_service import export_hod_brief_pdf
from app.services.student_service import get_subject_toppers, get_early_warning_students
from app.services.overview_service import get_overview_summary

client = TestClient(app)


def test_export_hod_brief_pdf():
    con = duckdb.connect("data/datasets/f5589de919ea0291.duckdb", read_only=True)
    filename, pdf_bytes = export_hod_brief_pdf(con)
    assert filename == "EduQuery_Department_Head_Brief.pdf"
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


def test_subject_toppers_service():
    con = duckdb.connect("data/datasets/f5589de919ea0291.duckdb", read_only=True)
    toppers = get_subject_toppers(con)
    assert len(toppers) == 21  # 7 courses * 3 divisions
    # Check top scorer in Batch 1 for CE301
    b1_ce301 = next(t for t in toppers if t.division == "Batch 1" and t.course_code == "CE301")
    assert b1_ce301.student_id == "CV23-013"
    assert b1_ce301.score == 95.0
    assert b1_ce301.grade == "O"


def test_early_warning_service():
    con = duckdb.connect("data/datasets/f5589de919ea0291.duckdb", read_only=True)
    ew = get_early_warning_students(con)
    assert ew.total_at_risk == 5
    assert ew.critical_count == 2
    assert ew.moderate_count == 3
    sids = [s.student_id for s in ew.students]
    assert "CV23-051" in sids  # critical failure across 7 subjects in ISA
    assert "CV23-042" in sids  # critical failure across 5 subjects in ISA


def test_overview_needs_attention_zero_when_clean():
    con = duckdb.connect("data/datasets/f5589de919ea0291.duckdb", read_only=True)
    summary = get_overview_summary(con)
    assert summary.kpis.needs_attention_count == 0
    assert len(summary.needs_attention) == 0


def test_api_subject_toppers():
    resp = client.get("/api/v1/students/subject-toppers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 21
    assert len(data["items"]) == 21


def test_api_early_warning():
    resp = client.get("/api/v1/students/early-warning")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_at_risk"] == 5
    assert data["critical_count"] == 2


def test_api_hod_brief_pdf():
    resp = client.get("/api/v1/reports/hod-brief/export-pdf")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "EduQuery_Department_Head_Brief.pdf" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"%PDF")

