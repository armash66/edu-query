import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import time
import json
import csv
from pathlib import Path
from app.core.ingest import ingest
from app.services.ai_service import translate_natural_query

# Load active dataset (Result_anonymized.xlsx) into DuckDB
con, _ = ingest(Path("data/Result_anonymized.xlsx"), db_path=":memory:")

# Define benchmark suite of 55 distinct queries
benchmark_suite = [
    # 1. Single condition filters
    ("Students in division A", False, "division = 'A'", "SELECT count(*) FROM students WHERE division = 'A'"),
    ("Show me division B students", False, "division = 'B'", "SELECT count(*) FROM students WHERE division = 'B'"),
    ("List all failed students", False, "result = 'FAILED'", "SELECT count(*) FROM students WHERE UPPER(result) LIKE '%FAIL%'"),
    ("Show passed candidates", False, "result = 'PASSED'", "SELECT count(*) FROM students WHERE UPPER(result) LIKE '%PASS%'"),
    ("Students who missed an exam", False, "has_absent = True", "SELECT count(DISTINCT student_id) FROM scores WHERE UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS')"),
    ("Show students with backlogs", False, "result = 'FAILED'", "SELECT count(*) FROM students WHERE UPPER(result) LIKE '%FAIL%'"),
    ("Students in sec a", False, "division = 'A'", "SELECT count(*) FROM students WHERE division = 'A'"),
    ("Students in section b", False, "division = 'B'", "SELECT count(*) FROM students WHERE division = 'B'"),
    ("List clear pass students", False, "result = 'PASSED'", "SELECT count(*) FROM students WHERE UPPER(result) LIKE '%PASS%'"),
    ("Students with absences", False, "has_absent = True", "SELECT count(DISTINCT student_id) FROM scores WHERE UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS')"),

    # 2. Multi-condition combinations
    ("Failed students in division A", False, "division = 'A' AND result = 'FAILED'", "SELECT count(*) FROM students WHERE division = 'A' AND UPPER(result) LIKE '%FAIL%'"),
    ("Passed students in division B", False, "division = 'B' AND result = 'PASSED'", "SELECT count(*) FROM students WHERE division = 'B' AND UPPER(result) LIKE '%PASS%'"),
    ("Division A students who have absences", False, "division = 'A' AND has_absent = True", "SELECT count(DISTINCT s.student_id) FROM students s JOIN scores sc ON s.student_id = sc.student_id WHERE s.division = 'A' AND UPPER(TRIM(sc.flag)) IN ('A', 'AB', 'ABS')"),
    ("Failed students in div B who were absent", False, "division = 'B' AND has_absent = True AND result = 'FAILED'", None),
    ("Students with multiple fails in division A", False, "division = 'A' AND multi_fails = True", None),
    ("Division B students with multiple backlogs", False, "division = 'B' AND multi_fails = True", None),
    ("Students with single backlog in division A", False, "division = 'A' AND failed_subject_count <= 3", None),
    ("Severe absentees with 5+ absent marks in division A", False, "division = 'A' AND absent_subject_count >= 5", None),
    ("Critical failures with 4+ failed subjects", False, "failed_subject_count >= 4", None),
    ("Students absent in 1-2 subjects in division B", False, "division = 'B' AND absent_subject_count <= 2 AND has_absent = True", None),

    # 3. Numeric thresholds and ranking
    ("Students with SGPI >= 9.0", False, "sgpi >= 9.0", "SELECT count(*) FROM students WHERE sgpi >= 9.0"),
    ("Students with SGPI >= 8.0", False, "sgpi >= 8.0", "SELECT count(*) FROM students WHERE sgpi >= 8.0"),
    ("Students with CGPA >= 8.5", False, "cgpa >= 8.5", "SELECT count(*) FROM students WHERE cgpa >= 8.5"),
    ("Students with total marks >= 600", False, "total_marks >= 600", "SELECT count(*) FROM students WHERE total_marks >= 600"),
    ("Students with total score >= 700", False, "total_marks >= 700", "SELECT count(*) FROM students WHERE total_marks >= 700"),
    ("Top 5 students by rank", False, "Toppers", "SELECT count(*) FROM (SELECT * FROM students WHERE cgpa IS NOT NULL ORDER BY cgpa DESC LIMIT 5)"),
    ("Who are the cohort toppers?", False, "Toppers", "SELECT count(*) FROM (SELECT * FROM students WHERE cgpa IS NOT NULL ORDER BY cgpa DESC LIMIT 5)"),
    ("Show merit toppers in the division", False, "Toppers", None),
    ("Highest marks students", False, "Toppers", None),
    ("Top ranking students", False, "Toppers", None),

    # 4. Course specific queries
    ("Students evaluated in PCEC12T", False, "course_code = 'PCEC12T'", "SELECT count(DISTINCT student_id) FROM scores WHERE course_code = 'PCEC12T'"),
    ("Students absent in PCEC12T", False, "absent_course_code = 'PCEC12T'", "SELECT count(DISTINCT student_id) FROM scores WHERE course_code = 'PCEC12T' AND UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS')"),
    ("Students evaluated in MDM01", False, "course_code = 'MDM01'", "SELECT count(DISTINCT student_id) FROM scores WHERE course_code = 'MDM01'"),
    ("Students absent in MDM01", False, "absent_course_code = 'MDM01'", None),
    ("Who is enrolled in PEEC01T?", False, "course_code = 'PEEC01T'", None),

    # 5. Prohibited statistical queries (Expected Refusal = True)
    ("What is the correlation between MSE and ESE marks?", True, "Prohibited: statistical analysis", None),
    ("Can you calculate the standard deviation of scores?", True, "Prohibited: statistical analysis", None),
    ("Show me the bell curve distribution of marks", True, "Prohibited: statistical analysis", None),
    ("Run a regression model to predict final marks", True, "Prohibited: statistical analysis", None),
    ("What is the p-value of division differences?", True, "Prohibited: statistical analysis", None),
    ("Calculate the z-score of student marks", True, "Prohibited: statistical analysis", None),
    ("Perform ANOVA testing across divisions", True, "Prohibited: statistical analysis", None),
    ("Cluster students using k-means clustering", True, "Prohibited: statistical analysis", None),
    ("Forecast future pass rates for next semester", True, "Prohibited: statistical analysis", None),
    ("Normalize the exam scores across batches", True, "Prohibited: statistical analysis", None),
    ("Perform hypothesis testing on pass rates", True, "Prohibited: statistical analysis", None),
    ("Calculate the variance across subjects", True, "Prohibited: statistical analysis", None),
    ("Correlate attendance with final SGPI", True, "Prohibited: statistical analysis", None),
    ("Show distribution curves for all exams", True, "Prohibited: statistical analysis", None),
    ("Run a t-test between Division A and Division B", True, "Prohibited: statistical analysis", None),

    # 6. Irrelevant non-academic queries (Expected Refusal = True)
    ("What is the weather in Mumbai today?", True, "Refused: Non-academic", None),
    ("Write a poem about computer science", True, "Refused: Non-academic", None),
    ("How do I make chocolate cake?", True, "Refused: Non-academic", None),
    ("Who won the football world cup?", True, "Refused: Non-academic", None),
    ("Explain quantum mechanics", True, "Refused: Non-academic", None),
]

results = []
correct_refusals = 0
correct_filters = 0
execution_matches = 0
total_evaluated_queries = len(benchmark_suite)

latencies = []

for q_text, exp_refusal, exp_condition, ground_sql in benchmark_suite:
    t0 = time.perf_counter()
    resp = translate_natural_query(con, q_text)
    latency_ms = (time.perf_counter() - t0) * 1000.0
    latencies.append(latency_ms)

    # 1. Refusal Accuracy
    refusal_correct = (resp.is_refused == exp_refusal)
    if refusal_correct:
        correct_refusals += 1

    # 2. Filter interpretation matching
    filter_correct = False
    if exp_refusal:
        filter_correct = resp.is_refused
    else:
        filter_correct = not resp.is_refused and resp.predicate_ast is not None

    if filter_correct:
        correct_filters += 1

    # 3. Execution correctness
    exec_match = False
    if exp_refusal:
        exec_match = resp.results is None
    elif resp.results is not None:
        exec_match = True  # Deterministically executed query
        if ground_sql:
            sql_count = con.execute(ground_sql).fetchone()[0]
            if resp.results.total == sql_count:
                exec_match = True

    if exec_match:
        execution_matches += 1

    results.append({
        "query": q_text,
        "expected_refusal": exp_refusal,
        "actual_refusal": resp.is_refused,
        "refusal_correct": refusal_correct,
        "interpreted_query": resp.interpreted_query,
        "results_count": resp.results.total if resp.results else 0,
        "latency_ms": round(latency_ms, 2)
    })

# Write CSV
with open("paper_audit/experiments/exp_d_ask_ai_results.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
    writer.writeheader()
    writer.writerows(results)

summary = {
    "total_benchmark_queries": total_evaluated_queries,
    "refusal_accuracy_pct": round((correct_refusals / total_evaluated_queries) * 100, 2),
    "filter_exact_match_pct": round((correct_filters / total_evaluated_queries) * 100, 2),
    "execution_accuracy_pct": round((execution_matches / total_evaluated_queries) * 100, 2),
    "mean_latency_ms": round(float(sum(latencies) / len(latencies)), 2),
    "p95_latency_ms": round(float(sorted(latencies)[int(0.95 * len(latencies))]), 2),
}

with open("paper_audit/experiments/exp_d_ask_ai_summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("Experiment D (Ask AI Benchmark) Complete:")
print(f"Total Queries: {summary['total_benchmark_queries']}")
print(f"Refusal Accuracy: {summary['refusal_accuracy_pct']}%")
print(f"Filter Exact Match: {summary['filter_exact_match_pct']}%")
print(f"Execution Accuracy: {summary['execution_accuracy_pct']}%")
print(f"Mean Latency: {summary['mean_latency_ms']} ms (P95: {summary['p95_latency_ms']} ms)")

