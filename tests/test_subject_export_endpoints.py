import io
import openpyxl
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_subject_export_pdf_endpoint():
    res = client.get("/api/v1/subjects/CE301/export-pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=\"EduQuery_CE301_All_Roster.pdf\"" in res.headers["content-disposition"]
    assert len(res.content) > 1000
    assert res.content.startswith(b"%PDF")

def test_subject_export_pdf_passed_and_failed_filters():
    res_p = client.get("/api/v1/subjects/CE301/export-pdf?report_type=passed")
    assert res_p.status_code == 200
    assert "Passed_Roster.pdf" in res_p.headers["content-disposition"]

    res_f = client.get("/api/v1/subjects/CE301/export-pdf?report_type=failed")
    assert res_f.status_code == 200
    assert "Failed_Roster.pdf" in res_f.headers["content-disposition"]

def test_subject_export_csv_endpoint():
    res = client.get("/api/v1/subjects/CE301/export-csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "EduQuery_CE301_All_Students.csv" in res.headers["content-disposition"]
    content_str = res.content.decode("utf-8")
    assert content_str.startswith("\ufeff")
    assert "Roll No" in content_str
    assert "Seat No" in content_str
    assert "Student Name" in content_str
    assert "Component Marks" in content_str
    assert "Total Marks" in content_str

def test_subject_export_format_query_param():
    res_pdf = client.get("/api/v1/subjects/CE301/export?format=pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"

    res_csv = client.get("/api/v1/subjects/CE301/export?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]

    res_xlsx = client.get("/api/v1/subjects/CE301/export?format=xlsx")
    assert res_xlsx.status_code == 200
    assert "spreadsheetml" in res_xlsx.headers["content-type"]

