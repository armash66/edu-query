import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
import re
from pathlib import Path
from app.core.ingest import ingest
from app.services.ai_service import generate_hod_brief

workbooks = [
    "Result_anonymized.xlsx",
    "test1_commerce_same_layout.xlsx",
    "test1_same_layout_10courses_3divs.xlsx",
    "test2_lifesci_vague_single_row.xlsx",
    "test2_vague_single_row_batches.xlsx",
    "test3_arts_messy_sheet_per_division.xlsx",
    "test3_messy_sheet_per_division.xlsx",
]

# We will run 5 iterations per workbook across all 7 workbooks = 35 total generations
runs = []
verified_count = 0
fallback_count = 0
total_numbers_seen = 0
matched_numbers_seen = 0

for wb_name in workbooks:
    con, _ = ingest(Path("data") / wb_name, db_path=":memory:")
    for iter_idx in range(5):
        t0 = time.perf_counter()
        brief = generate_hod_brief(con)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        narrative = brief.narrative
        facts = brief.facts_used
        
        # Extract all numbers from narrative
        numbers = re.findall(r"\b\d+(?:\.\d+)?\b", narrative)
        
        allowed = set()
        for v in facts.values():
            allowed.add(str(v))
            if isinstance(v, (int, float)):
                if isinstance(v, float) and v.is_integer():
                    allowed.add(str(int(v)))
                elif isinstance(v, int):
                    allowed.add(f"{v}.0")

        # Allow '1' for "1-page summary" or singular counts if applicable
        unverified = [n for n in numbers if n not in allowed and n not in {"1"}]
        
        is_faithful = len(unverified) == 0
        faithfulness_pct = ((len(numbers) - len(unverified)) / len(numbers) * 100.0) if numbers else 100.0
        
        if brief.verified and is_faithful:
            verified_count += 1
        else:
            fallback_count += 1

        total_numbers_seen += len(numbers)
        matched_numbers_seen += (len(numbers) - len(unverified))

        runs.append({
            "workbook": wb_name,
            "iteration": iter_idx + 1,
            "total_extracted_numbers": len(numbers),
            "unverified_numbers_count": len(unverified),
            "unverified_numbers": ",".join(unverified) if unverified else "None",
            "faithfulness_pct": round(faithfulness_pct, 2),
            "verified_flag": brief.verified,
            "fallback_applied": not brief.verified,
            "cohort_total": facts.get("cohort_total"),
            "latency_ms": round(latency_ms, 2)
        })

# Write CSV
with open("paper_audit/experiments/exp_e_hod_brief_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(runs[0].keys()))
    writer.writeheader()
    writer.writerows(runs)

summary = {
    "total_generations": len(runs),
    "verified_generations": verified_count,
    "fallback_to_template_count": fallback_count,
    "fallback_rate_pct": round((fallback_count / len(runs)) * 100, 2),
    "total_numbers_audited": total_numbers_seen,
    "matched_numbers_count": matched_numbers_seen,
    "overall_faithfulness_pct": round((matched_numbers_seen / total_numbers_seen) * 100, 2),
    "mean_latency_ms": round(sum(r["latency_ms"] for r in runs) / len(runs), 2)
}

with open("paper_audit/experiments/exp_e_hod_brief_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("Experiment E (HOD Brief Faithfulness) Complete:")
print(f"Total Generations: {summary['total_generations']}")
print(f"Overall Number Faithfulness: {summary['overall_faithfulness_pct']}% ({matched_numbers_seen}/{total_numbers_seen} numbers)")
print(f"Fallback-to-Template Rate: {summary['fallback_rate_pct']}% ({fallback_count}/{len(runs)})")
print(f"Mean Generation Latency: {summary['mean_latency_ms']} ms")

