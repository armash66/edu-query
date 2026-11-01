import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
import tracemalloc
from pathlib import Path
import openpyxl
from app.core.ingest import ingest

def generate_scaling_workbook(num_students: int, path: Path):
    """Generate a realistic paired-row marksheet workbook with N students and 8 courses."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cohort Results"
    
    courses = ["CS101", "CS102", "CS103", "CS104", "MATH101", "PHYS101", "ME101", "EE101"]
    
    # Row 1: Course titles
    # Row 2: Assessment components (ESE, IA, TW, TOT1, GRADE, CREDITS)
    # Stride = 2
    header1 = ["Seat No", "Roll No", "Candidate Name", "Division"]
    header2 = ["", "", "", ""]
    
    for c in courses:
        header1.extend([f"[{c}] Course {c}", "", "", "", "", ""])
        header2.extend(["ESE", "IA", "TW", "TOT1", "GRADE", "CREDITS"])
    
    header1.extend(["Total Marks", "SGPI", "Result"])
    header2.extend(["", "", ""])
    
    ws.append(header1)
    ws.append(header2)
    
    for i in range(1, num_students + 1):
        div = "A" if i <= num_students // 2 else "B"
        seat = f"22{i+1000:04d}"
        roll = f"23108A{i:04d}"
        name = f"Student Synthetic {i}"
        
        row1 = [seat, roll, name, div]
        row2 = ["", "", "", ""]
        
        tot_m = 0
        for _ in courses:
            ese = 45 + (i % 30)
            ia = 18 + (i % 10)
            tw = 20 + (i % 5)
            c_tot = ese + ia + tw
            tot_m += c_tot
            row1.extend([ese, ia, tw, c_tot, "", 3.0])
            row2.extend(["", "", "", "", "A", 3.0])
            
        row1.extend([tot_m, 8.2, "PASSED"])
        row2.extend(["", "", ""])
        
        ws.append(row1)
        ws.append(row2)
        
    wb.save(path)

cohort_sizes = [100, 500, 1000, 2000]
scaling_results = []
bench_dir = Path("paper_audit/experiments/scaling_benchmarks")
bench_dir.mkdir(parents=True, exist_ok=True)

print("Starting Workbook Ingestion Scaling Benchmark (100 to 2000 students)...")

for n in cohort_sizes:
    wb_file = bench_dir / f"bench_{n}_students.xlsx"
    print(f"Generating synthetic workbook for {n} students...")
    generate_scaling_workbook(n, wb_file)
    wb_size_mb = round(wb_file.stat().st_size / (1024 * 1024), 2)
    
    tracemalloc.start()
    t0 = time.perf_counter()
    con, rep = ingest(wb_file, db_path=":memory:")
    elapsed_sec = round(time.perf_counter() - t0, 3)
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    peak_mb = round(peak_mem / (1024 * 1024), 2)
    total_scores = con.execute("SELECT count(*) FROM scores").fetchone()[0]
    total_students = con.execute("SELECT count(*) FROM students").fetchone()[0]
    
    scaling_results.append({
        "students": n,
        "workbook_file_size_mb": wb_size_mb,
        "ingestion_runtime_sec": elapsed_sec,
        "throughput_students_per_sec": round(n / elapsed_sec, 1) if elapsed_sec > 0 else 0,
        "peak_memory_mb": peak_mb,
        "total_scores_inserted": total_scores,
        "students_inserted": total_students,
    })
    print(f"Finished {n} students: {elapsed_sec}s | Peak Mem: {peak_mb} MB | Scores: {total_scores}")

# Cleanup generated benchmark files to conserve storage
for n in cohort_sizes:
    (bench_dir / f"bench_{n}_students.xlsx").unlink(missing_ok=True)

with open("paper_audit/experiments/exp_i_ingestion_scaling.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(scaling_results[0].keys()))
    writer.writeheader()
    writer.writerows(scaling_results)

with open("paper_audit/experiments/exp_i_ingestion_scaling.json", "w", encoding="utf-8") as f:
    json.dump(scaling_results, f, indent=2)

print("Scaling Benchmark Complete. Results saved to CSV and JSON.")

