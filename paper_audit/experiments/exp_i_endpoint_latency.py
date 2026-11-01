import sys
import os
import time
import json
import csv
import urllib.request
import urllib.error

base_url = "http://127.0.0.1:8000"

endpoints = [
    ("GET", "/health", "Health Check"),
    ("GET", "/api/v1/overview/summary", "Overview Summary"),
    ("GET", "/api/v1/students?limit=25", "Student Roster (Paginated)"),
    ("GET", "/api/v1/subjects", "Course Catalog"),
    ("GET", "/api/v1/absent-students", "Absent Students Roster"),
    ("GET", "/api/v1/anomalies/findings?limit=25", "Anomaly Findings"),
    ("GET", "/api/v1/ai/hod-brief", "HOD Executive Brief"),
    ("POST", "/api/v1/ai/ask", "Ask AI Query"),
]

post_payloads = {
    "/api/v1/ai/ask": json.dumps({"query": "Who failed in division A?"}).encode('utf-8')
}

latency_results = []

print("Starting Endpoint Latency Benchmark (Cold vs Warm 10 runs)...")

for method, path, name in endpoints:
    url = base_url + path
    headers = {"Content-Type": "application/json"}
    payload = post_payloads.get(path, None) if method == "POST" else None
    
    # 1. Cold Run
    t0 = time.perf_counter()
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.status
            body = resp.read()
    except Exception as e:
        code = 500
        body = b""
    cold_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    
    # 2. Warm Runs (10 iterations)
    warm_latencies = []
    for _ in range(10):
        t0 = time.perf_counter()
        req = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                _ = resp.read()
        except Exception:
            pass
        warm_latencies.append((time.perf_counter() - t0) * 1000.0)
    
    warm_mean = round(float(sum(warm_latencies) / len(warm_latencies)), 2)
    warm_median = round(float(sorted(warm_latencies)[len(warm_latencies)//2]), 2)
    warm_p95 = round(float(sorted(warm_latencies)[int(0.95 * len(warm_latencies))]), 2)
    warm_std = round(float(import_numpy_std := (sum((x - warm_mean)**2 for x in warm_latencies) / len(warm_latencies))**0.5), 2)

    latency_results.append({
        "endpoint": path,
        "method": method,
        "name": name,
        "status_code": code,
        "cold_latency_ms": cold_ms,
        "warm_mean_ms": warm_mean,
        "warm_median_ms": warm_median,
        "warm_p95_ms": warm_p95,
        "warm_std_ms": warm_std,
    })
    print(f"{name:<28} | Cold: {cold_ms:<7} ms | Warm Mean: {warm_mean:<6} ms (P95: {warm_p95:<6} ms)")

with open("paper_audit/experiments/exp_i_endpoint_latencies.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(latency_results[0].keys()))
    writer.writeheader()
    writer.writerows(latency_results)

with open("paper_audit/experiments/exp_i_endpoint_latencies.json", "w", encoding="utf-8") as f:
    json.dump(latency_results, f, indent=2)

print("Endpoint Latency Benchmark Complete.")

