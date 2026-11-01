import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import json
from pathlib import Path
from app.core.ingest import ingest

workbooks = [
    "Result_anonymized.xlsx",
    "test1_commerce_same_layout.xlsx",
    "test1_same_layout_10courses_3divs.xlsx",
    "test2_lifesci_vague_single_row.xlsx",
    "test2_vague_single_row_batches.xlsx",
    "test3_arts_messy_sheet_per_division.xlsx",
    "test3_messy_sheet_per_division.xlsx",
]

report_data = []

for wb_name in workbooks:
    wb_path = Path("data") / wb_name
    try:
        con, rep = ingest(wb_path, db_path=":memory:")
        students = con.execute("SELECT count(*) FROM students").fetchone()[0]
        courses = con.execute("SELECT count(*) FROM courses").fetchone()[0]
        scores = con.execute("SELECT count(*) FROM scores").fetchone()[0]
        grades = con.execute("SELECT count(*) FROM grades").fetchone()[0]
        recons = con.execute("SELECT count(*) FROM reconciliation").fetchone()[0]
        mismatches = con.execute("SELECT count(*) FROM reconciliation WHERE ABS(printed_total - computed_total) > 0.05").fetchone()[0]
        absents = con.execute("SELECT count(DISTINCT student_id) FROM scores WHERE UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS', 'ABSENT')").fetchone()[0]
        passed = con.execute("SELECT count(*) FROM students WHERE UPPER(result) LIKE '%PASS%'").fetchone()[0]
        failed = con.execute("SELECT count(*) FROM students WHERE UPPER(result) LIKE '%FAIL%'").fetchone()[0]
        
        stride = rep.layout.get("rows_per_student", 1) if rep.layout else 1
        sheet_count = len(rep.sheets_accepted)

        report_data.append({
            "workbook": wb_name,
            "status": "SUCCESS",
            "students": students,
            "courses": courses,
            "scores": scores,
            "grades": grades,
            "reconciliations": recons,
            "arithmetic_mismatches": mismatches,
            "absent_students": absents,
            "passed": passed,
            "failed": failed,
            "stride": stride,
            "sheet_count": sheet_count,
            "sheets_accepted": rep.sheets_accepted
        })
    except Exception as exc:
        report_data.append({
            "workbook": wb_name,
            "status": f"ERROR: {str(exc)}"
        })

with open("paper_audit/experiments/ingestion_audit_summary.json", "w", encoding="utf-8") as f:
    json.dump(report_data, f, indent=2)

print(f"{'Workbook':<42} | {'Students':<8} | {'Courses':<7} | {'Scores':<8} | {'Stride':<6} | {'Mismatches':<10}")
print("-" * 95)
for r in report_data:
    if r['status'] == "SUCCESS":
        print(f"{r['workbook']:<42} | {r['students']:<8} | {r['courses']:<7} | {r['scores']:<8} | {r['stride']:<6} | {r['arithmetic_mismatches']:<10}")
    else:
        print(f"{r['workbook']:<42} | {r['status']}")
