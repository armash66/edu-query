# Deliverable 10: Master Metrics Registry (One Table of Every Paper Citation)

Every quantitative value cited or citable in the paper is recorded below with its exact value, measurement unit, producing script or source command, git commit hash, and verification status.

| Metric Description | Quantitative Value | Unit | Source File / Command | Git Commit | Verification Status |
| :--- | :---: | :---: | :--- | :---: | :---: |
| **Audited Git Commit** | `32caa740cd71b66210bc12a14bab1ab4344d835e` | hash | `git rev-parse HEAD` | `32caa74` | VERIFIED |
| **Total Codebase Lines of Code (LOC)** | 67,232 | lines | `paper_audit/experiments/loc_stats.txt` | `32caa74` | VERIFIED |
| **Python Codebase LOC** | 30,555 | lines | `paper_audit/experiments/loc_stats.txt` | `32caa74` | VERIFIED |
| **TypeScript / TSX Codebase LOC** | 25,062 | lines | `paper_audit/experiments/loc_stats.txt` | `32caa74` | VERIFIED |
| **Total Non-VCS Audited Files** | 761 | files | `paper_audit/experiments/loc_stats.txt` | `32caa74` | VERIFIED |
| **Codebase Filesystem Footprint** | 47.31 | MiB | `Get-ChildItem -Recurse \| Measure-Object` | `32caa74` | VERIFIED |
| **Registered FastAPI OpenAPI Endpoints** | 72 | endpoints | `paper_audit/experiments/api_routes.json` | `32caa74` | VERIFIED |
| **Total Pinned Python Dependencies** | 297 | packages | `paper_audit/experiments/pip_freeze.txt` | `32caa74` | VERIFIED |
| **Total Frontend Dependencies** | 104 | packages | `paper_audit/experiments/npm_list.json` | `32caa74` | VERIFIED |
| **Primary Real Benchmark Students** | 145 | students | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Primary Real Benchmark Courses** | 27 | courses | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Primary Real Benchmark Score Cells** | 5,945 | cells | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Primary Real Absentee Headcount** | 48 | students | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Primary Real Failure Headcount** | 13 | students | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Primary Real Passing Headcount** | 132 | students | `data/Result_anonymized.xlsx` | `32caa74` | VERIFIED |
| **Workbook Layout Parsing Accuracy** | 100.0 | % | `paper_audit/experiments/exp_a_parsing_results.csv` | `32caa74` | VERIFIED |
| **Planted Arithmetic Discrepancies Total**| 453 | errors | `paper_audit/experiments/exp_c_verification_results.csv`| `32caa74` | VERIFIED |
| **Planted Arithmetic Discrepancies Found**| 453 | errors | `paper_audit/experiments/exp_c_verification_results.csv`| `32caa74` | VERIFIED |
| **Planted Invariant Recall Rate** | 100.0 | % | `paper_audit/experiments/exp_c_verification_results.csv`| `32caa74` | VERIFIED |
| **Tier A (Deterministic) Precision** | 1.000 ± 0.000 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A (Deterministic) Recall** | 0.571 ± 0.000 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A (Deterministic) FPR** | 0.000 ± 0.000 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+C (System Default) Precision** | 0.897 ± 0.040 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+C (System Default) Recall** | 0.733 ± 0.024 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+C (System Default) F1 Score** | 0.806 ± 0.025 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+C (System Default) FPR** | 0.014 ± 0.006 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+B (Deterministic + MAD) F1** | 0.993 ± 0.011 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Tier A+B Recall Rate** | 1.000 ± 0.000 | ratio | `paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | `32caa74` | VERIFIED |
| **Ask AI Evaluated Queries** | 55 | queries | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **Ask AI Refusal Accuracy** | 98.18 | % | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **Ask AI Filter Exact Match** | 98.18 | % | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **Ask AI Execution Accuracy** | 98.18 | % | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **Ask AI Mean Translation Latency** | 19.61 | ms | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **Ask AI P95 Translation Latency** | 51.40 | ms | `paper_audit/experiments/exp_d_ask_ai_summary.json` | `32caa74` | VERIFIED |
| **HOD Brief Numerical Faithfulness** | 99.09 | % | `paper_audit/experiments/exp_e_hod_brief_summary.json` | `32caa74` | VERIFIED |
| **HOD Brief Verified Numbers Count** | 545 / 550 | numbers | `paper_audit/experiments/exp_e_hod_brief_summary.json` | `32caa74` | VERIFIED |
| **HOD Brief Template Fallback Rate** | 14.29 | % | `paper_audit/experiments/exp_e_hod_brief_summary.json` | `32caa74` | VERIFIED |
| **HOD Brief Mean Generation Latency** | 38.50 | ms | `paper_audit/experiments/exp_e_hod_brief_summary.json` | `32caa74` | VERIFIED |
| **Monitored PII Sensitive Tokens** | 577 | tokens | `paper_audit/experiments/exp_f_privacy_report.json` | `32caa74` | VERIFIED |
| **Outbound External Sockets Attempted** | 0 | sockets | `paper_audit/experiments/exp_f_privacy_report.json` | `32caa74` | VERIFIED |
| **Outbound PII Transmission Rate** | 0.0 | % | `paper_audit/experiments/exp_f_privacy_report.json` | `32caa74` | VERIFIED |
| **Pre-ESE Early Warning 5-Fold CV AUC** | 0.985 ± 0.018 | AUC | `paper_audit/experiments/exp_g_early_warning_summary.json` | `32caa74` | VERIFIED |
| **Pre-ESE Early Warning Heuristic Prec** | 71.4 | % | `app/services/student_service.py:483` | `32caa74` | VERIFIED |
| **Pre-ESE Early Warning Heuristic Rec** | 76.9 | % | `app/services/student_service.py:484` | `32caa74` | VERIFIED |
| **Pre-ESE Early Warning Heuristic F1** | 74.1 | % | `app/services/student_service.py:485` | `32caa74` | VERIFIED |
| **Remedial Pairing Division Coherence** | 95.24 | % | `paper_audit/experiments/exp_h_remedial_results.csv` | `32caa74` | VERIFIED |
| **Remedial Pairing Quality Score Diff** | +70.08 | marks | `paper_audit/experiments/exp_h_remedial_results.csv` | `32caa74` | VERIFIED |
| **Remedial Pairing Orphan Tutees** | 0.0 | students | `paper_audit/experiments/exp_h_remedial_results.csv` | `32caa74` | VERIFIED |
| **Remedial Pairing Heuristic Latency** | 0.062 | ms | `paper_audit/experiments/exp_h_remedial_results.csv` | `32caa74` | VERIFIED |
| **Ingestion Runtime (100 students)** | 1.006 | s | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Ingestion Runtime (500 students)** | 2.388 | s | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Ingestion Runtime (1,000 students)** | 5.982 | s | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Ingestion Runtime (2,000 students)** | 13.737 | s | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Ingestion Peak RAM (2,000 students)** | 134.13 | MiB | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Max Ingestion Throughput** | 209.4 | stud/s | `paper_audit/experiments/exp_i_ingestion_scaling.csv` | `32caa74` | VERIFIED |
| **Overview API Warm Latency** | 44.70 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Students API Warm Latency** | 56.01 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Subjects API Warm Latency** | 64.07 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Absent Students API Warm Latency** | 54.00 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Anomaly Findings API Warm Latency** | 168.11 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **HOD Brief API Warm Latency** | 56.22 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Ask AI API Warm Latency** | 38.66 | ms | `paper_audit/experiments/exp_i_endpoint_latencies.csv` | `32caa74` | VERIFIED |
| **Initial Client JS Bundle (Raw)** | 322.83 | KiB | `node scripts/check-bundle-budget.mjs` | `32caa74` | VERIFIED |
| **Initial Client JS Bundle (Gzip)** | 99.88 | KiB | `node scripts/check-bundle-budget.mjs` | `32caa74` | VERIFIED |
| **Enforced CI Bundle Budget (Gzip)** | 105.00 | KiB | `scripts/check-bundle-budget.mjs:67` | `32caa74` | VERIFIED |
| **Application Code Bundle (Gzip)** | 13.39 | KiB | `scripts/check-bundle-budget.mjs:51` | `32caa74` | VERIFIED |
| **WCAG 2.1 AA Contrast Checks Passed** | 40 / 40 | checks | `node scripts/check-contrast.mjs` | `32caa74` | VERIFIED |
| **Backend Pytest Tests Passing** | 311 / 324 | tests | `pytest tests/` | `32caa74` | VERIFIED |
| **Frontend Vitest Tests Passing** | 102 / 107 | tests | `npm --prefix frontend test` | `32caa74` | VERIFIED |
| **V1 to V3 Bundle Size Reduction** | -93.3 | % | `1 - (99.88 / 1480.0)` | `32caa74` | VERIFIED |
| **V1 to V3 Navigation Reduction** | -55.6 | % | `1 - (8 / 18)` | `32caa74` | VERIFIED |
| **V1 to V3 Failure Inspect Efficiency** | +71.4 | % | `1 - (2 / 7 clicks)` | `32caa74` | VERIFIED |
| **V1 to V3 Reconciliation Audit Gain** | +88.9 | % | `1 - (1 / 9 clicks)` | `32caa74` | VERIFIED |
| **V1 to V3 Merit List Export Gain** | +66.7 | % | `1 - (2 / 6 clicks)` | `32caa74` | VERIFIED |
| **V1 to V3 Absent Grouping Gain** | +87.5 | % | `1 - (1 / 8 clicks)` | `32caa74` | VERIFIED |
| **V1 to V3 Notice Drafting Gain** | +72.7 | % | `1 - (3 / 11 clicks)` | `32caa74` | VERIFIED |
| **Frontend Production Vulnerabilities** | 0 | count | `npm audit --prefix frontend` | `32caa74` | VERIFIED |

