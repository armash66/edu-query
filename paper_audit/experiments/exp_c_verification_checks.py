import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import json
import csv
from pathlib import Path
from app.core.ingest import ingest
from app.services.anomaly_detection import detect_all_anomalies

workbooks = [
    ("test1_commerce_same_layout.xlsx", 97, 0),
    ("test1_same_layout_10courses_3divs.xlsx", 104, 0),
    ("test2_lifesci_vague_single_row.xlsx", 41, 0),
    ("test2_vague_single_row_batches.xlsx", 42, 0),
    ("test3_arts_messy_sheet_per_division.xlsx", 82, 0),
    ("test3_messy_sheet_per_division.xlsx", 87, 0),
    ("Result_anonymized.xlsx", 0, 0),
]

verification_results = []

for wb_name, expected_mismatches, expected_boundary in workbooks:
    wb_path = Path("data") / wb_name
    con, rep = ingest(wb_path, db_path=":memory:")
    
    # 1. Total arithmetic mismatches discovered in reconciliation table
    recon_rows = con.execute("""
        SELECT student_id, course_code, printed_total, computed_total, ABS(printed_total - computed_total) as diff
        FROM reconciliation
        WHERE printed_total IS NOT NULL AND computed_total IS NOT NULL
          AND ABS(printed_total - computed_total) > 0.05
    """).fetchall()
    found_mismatches = len(recon_rows)

    # 2. Out-of-bounds component scores (< 0 or > 100/150)
    bound_rows = con.execute("""
        SELECT student_id, course_code, component, value
        FROM scores
        WHERE value IS NOT NULL AND (
            (component != 'TOT1' AND (value < 0 OR value > 100)) OR
            (component = 'TOT1' AND (value < 0 OR value > 150))
        )
    """).fetchall()
    found_boundary = len(bound_rows)

    # 3. Anomaly detection service results (Tier A)
    findings, meta = detect_all_anomalies(con, include_statistical=False)
    det_findings = [f for f in findings if f.method == "deterministic_rule"]

    mismatch_recall = 1.0 if expected_mismatches == 0 and found_mismatches == 0 else (
        found_mismatches / expected_mismatches if expected_mismatches > 0 else 1.0
    )

    verification_results.append({
        "workbook": wb_name,
        "expected_mismatches": expected_mismatches,
        "found_mismatches": found_mismatches,
        "mismatches_missed": max(0, expected_mismatches - found_mismatches),
        "mismatch_recall_pct": round(mismatch_recall * 100, 2),
        "found_boundary_violations": found_boundary,
        "tier_a_findings_count": len(det_findings),
        "isolation_forest_findings_count": meta["isolation_forest_count"],
        "verification_status": "PASS" if found_mismatches == expected_mismatches else "GAP",
    })

with open("paper_audit/experiments/exp_c_verification_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(verification_results[0].keys()))
    writer.writeheader()
    writer.writerows(verification_results)

with open("paper_audit/experiments/exp_c_verification_results.json", "w", encoding="utf-8") as f:
    json.dump(verification_results, f, indent=2)

print("Experiment C (Verification Checks) Prepared & Logged.")
for r in verification_results:
    print(f"{r['workbook']:<42} | Exp: {r['expected_mismatches']:<3} | Found: {r['found_mismatches']:<3} | Recall: {r['mismatch_recall_pct']}% | Status: {r['verification_status']}")

