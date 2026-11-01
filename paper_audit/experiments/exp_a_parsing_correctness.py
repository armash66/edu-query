import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
from pathlib import Path
import openpyxl
from app.core.ingest import ingest, AmbiguousLayoutError

workbooks = [
    ("Result_anonymized.xlsx", "paired_row", 145, 27),
    ("test1_commerce_same_layout.xlsx", "paired_row", 60, 10),
    ("test1_same_layout_10courses_3divs.xlsx", "paired_row", 60, 10),
    ("test2_lifesci_vague_single_row.xlsx", "single_row", 45, 7),
    ("test2_vague_single_row_batches.xlsx", "single_row", 45, 7),
    ("test3_arts_messy_sheet_per_division.xlsx", "multi_sheet", 50, 8),
    ("test3_messy_sheet_per_division.xlsx", "multi_sheet", 50, 8),
]

results = []
field_matches = []

for fname, layout_type, exp_students, exp_courses in workbooks:
    fpath = Path("data") / fname
    t0 = time.perf_counter()
    con, rep = ingest(fpath, db_path=":memory:")
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    students_actual = con.execute("SELECT count(*) FROM students").fetchone()[0]
    courses_actual = con.execute("SELECT count(*) FROM courses").fetchone()[0]
    scores_actual = con.execute("SELECT count(*) FROM scores").fetchone()[0]
    unparsed_scores = con.execute("SELECT count(*) FROM scores WHERE state = 'unparsed'").fetchone()[0]
    null_names = con.execute("SELECT count(*) FROM students WHERE name IS NULL OR name = ''").fetchone()[0]
    null_results = con.execute("SELECT count(*) FROM students WHERE result IS NULL OR result = ''").fetchone()[0]

    # Student match accuracy
    student_acc = 1.0 if students_actual == exp_students else students_actual / exp_students
    course_acc = 1.0 if courses_actual == exp_courses else courses_actual / exp_courses
    field_acc = (scores_actual - unparsed_scores) / scores_actual if scores_actual > 0 else 0.0

    results.append({
        "workbook": fname,
        "layout_type": layout_type,
        "expected_students": exp_students,
        "actual_students": students_actual,
        "student_accuracy": round(student_acc * 100, 2),
        "expected_courses": exp_courses,
        "actual_courses": courses_actual,
        "course_accuracy": round(course_acc * 100, 2),
        "total_scores": scores_actual,
        "unparsed_scores": unparsed_scores,
        "score_parsing_accuracy": round(field_acc * 100, 2),
        "missing_identity_rate": round((null_names / students_actual) * 100, 2) if students_actual else 0.0,
        "missing_result_rate": round((null_results / students_actual) * 100, 2) if students_actual else 0.0,
        "runtime_ms": round(elapsed_ms, 2)
    })

# Save CSV
with open("paper_audit/experiments/exp_a_parsing_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
    writer.writeheader()
    writer.writerows(results)

# Test unsupported layout failure reporting
unsupported_tests = []
tiny_wb = openpyxl.Workbook()
ws = tiny_wb.active
ws.title = "Empty"
tiny_wb_path = Path("paper_audit/experiments/tiny_unsupported.xlsx")
tiny_wb.save(tiny_wb_path)

try:
    ingest(tiny_wb_path, db_path=":memory:")
    unsupported_tests.append({"case": "Empty Sheet", "caught": False, "error": None})
except Exception as e:
    unsupported_tests.append({"case": "Empty Sheet", "caught": True, "error": type(e).__name__ + ": " + str(e)})

tiny_wb_path.unlink(missing_ok=True)

with open("paper_audit/experiments/exp_a_unsupported_handling.json", "w", encoding="utf-8") as f:
    json.dump(unsupported_tests, f, indent=2)

print("Experiment A (Parsing Correctness) Complete. Results saved to CSV and JSON.")
for r in results:
    print(f"{r['workbook']:<42} | StudAcc: {r['student_accuracy']}% | CourseAcc: {r['course_accuracy']}% | ScoreAcc: {r['score_parsing_accuracy']}% | Time: {r['runtime_ms']}ms")

