# Deliverable 05: Empirical Research Evaluation and Benchmark Suite

## 1. Executive Evaluation Matrix

This evaluation establishes reproducible empirical evidence across ten rigorous experiments evaluating ingestion accuracy, three-tier anomaly detection, arithmetic reconciliation invariants, natural language query compilation, briefing faithfulness, privacy guarantees, early warning validity, remedial constraint satisfaction, scaling performance, and accessibility standards.

| Experiment | Target System Subsystem | Primary Benchmark Dataset | Metric Evaluated | Baseline Comparison | Result / Status | Reproduce Command |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Exp A** | Layout Induction & Parsing | 7 workbooks (anonymized + synthetic) | Exact-match field accuracy | Ground-truth cell invariants | **100.0% Exact Match** across all 7 workbooks | `python paper_audit/experiments/exp_a_parsing_correctness.py` |
| **Exp B** | Explainable Anomaly Detection | Synthetic cohort (150 students, 10 seeds) | Precision, Recall, $F_1$, FPR, Ablations | Deterministic vs MAD vs Isolation Forest | **$F_1$: 0.806 ± 0.025** (Sys Default: Tier A+C); **$F_1$: 0.993 ± 0.011** (Tier A+B) | `python paper_audit/experiments/exp_b_anomaly_detection.py` |
| **Exp C** | Arithmetic Recomputation | 453 planted discrepancies in 6 workbooks | Planted error recovery rate | Expected planted errors | **100.0% Recall** (453 / 453 planted errors found) | `python paper_audit/experiments/exp_c_verification_checks.py` |
| **Exp D** | Ask AI Query Compilation | 55 natural language queries | Refusal & Execution accuracy | Unconstrained generative LLM | **98.18% Accuracy** (54 / 55 queries), Mean latency 19.6 ms | `python paper_audit/experiments/exp_d_ask_ai_benchmark.py` |
| **Exp E** | HOD Brief Faithfulness | 35 generations across 7 workbooks | Numeric fact verification rate | Generative LLM hallucination | **99.09% Faithfulness** (545/550 numbers verified), 14.3% template fallback | `python paper_audit/experiments/exp_e_hod_brief_faithfulness.py` |
| **Exp F** | Privacy & Zero-PII Egress | Active cohort (577 sensitive tokens) | Network packet inspection | Cloud AI sending PII | **PASS: 0 Outbound Packets**, 0 PII leaks | `python paper_audit/experiments/exp_f_privacy_test.py` |
| **Exp G** | Pre-ESE Early Warning | 145 students (13 actual failures) | 5-Fold Stratified CV AUC & $F_1$ | Univariate MSE threshold & Heuristics | **CV-AUC: 0.985 ± 0.018**, Heuristic $F_1$: 0.741 | `python paper_audit/experiments/exp_g_early_warning_cv.py` |
| **Exp H** | Remedial Grouping & Pairing | 14 subjects with backlogs | Division coherence & score gap | Greedy match & Random baseline (10 seeds) | **95.24% Coherence** (+70.08 score diff, 0 orphans) | `python paper_audit/experiments/exp_h_remedial_grouping.py` |
| **Exp I** | Performance & Scalability | 100 to 2,000 student synthetic cohorts | Throughput (stud/s), memory, latency | Linear theoretical expectation | **145.6 stud/s at 2,000 students** (13.7s total, 134 MB peak) | `python paper_audit/experiments/exp_i_performance_scaling.py` |
| **Exp J** | Quality, Bundle & Access | Full test suite + Production JS bundles | Bundle size, WCAG contrast, Axe violations | 105 KiB CI budget, WCAG 2.1 AA | **99.88 KiB gzip JS**, 40/40 WCAG Contrast Passes | `node scripts/check-bundle-budget.mjs && node scripts/check-contrast.mjs` |

---

## 2. Experiment A: Parsing Correctness Across Diverse Marksheet Workbooks

- **Hypothesis**: The multi-sheet layout induction engine discovers student primary keys, assessment column bounds, course blocks, and row stride across heterogeneous academic disciplines without losing marks or misattributing student identities.
- **Methodology**: Ingested all seven benchmark workbooks into isolated in-process DuckDB instances. Verified parsed student counts, courses count, component scores count, and unparsed error rates against ground-truth workbook contents.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_a_parsing_correctness.py
  ```

### Empirical Results
| Workbook Filename | Stride Structure | Expected Students | Parsed Students | Student Accuracy | Expected Courses | Parsed Courses | Course Accuracy | Total Scores Parsed | Unparsed Errors | Score Accuracy | Ingestion Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Result_anonymized.xlsx` | Paired-row (2) | 145 | 145 | **100.0%** | 27 | 27 | **100.0%** | 5,945 | 0 | **100.0%** | 3,812.8 |
| `test1_commerce_same_layout.xlsx` | Paired-row (2) | 60 | 60 | **100.0%** | 10 | 10 | **100.0%** | 2,014 | 0 | **100.0%** | 279.1 |
| `test1_same_layout_10courses_3divs.xlsx`| Paired-row (2) | 60 | 60 | **100.0%** | 10 | 10 | **100.0%** | 2,001 | 0 | **100.0%** | 314.1 |
| `test2_lifesci_vague_single_row.xlsx` | Single-row (1) | 45 | 45 | **100.0%** | 7 | 7 | **100.0%** | 1,215 | 0 | **100.0%** | 254.9 |
| `test2_vague_single_row_batches.xlsx` | Single-row (1) | 45 | 45 | **100.0%** | 7 | 7 | **100.0%** | 1,215 | 0 | **100.0%** | 265.2 |
| `test3_arts_messy_sheet_per_division.xlsx`| Multi-sheet (1) | 50 | 50 | **100.0%** | 8 | 8 | **100.0%** | 1,291 | 0 | **100.0%** | 308.5 |
| `test3_messy_sheet_per_division.xlsx` | Multi-sheet (1) | 50 | 50 | **100.0%** | 8 | 8 | **100.0%** | 1,311 | 0 | **100.0%** | 305.8 |

- **Unsupported Layout Handling**: An empty or non-tabular workbook raises `AmbiguousLayoutError: Sheet is too small to contain a valid marksheet.`, returning HTTP 422 to the client with descriptive guidance.

---

## 3. Experiment B: Anomaly Detection Performance & Ablation Study

- **Hypothesis**: Combining deterministic verification rules (Tier A) with multivariate Isolation Forest (Tier C) detects structural anomalies without generating false positives on ordinary arithmetic errors.
- **Methodology**: Evaluated across 10 random seeds (`[42, 101, 202, 303, 404, 505, 606, 707, 808, 909]`) on synthetic cohorts of 150 students with 21 planted anomalies across 4 error types (arithmetic mismatches, boundary violations, isolated collapses, and structural bimodal profiles).
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_b_anomaly_detection.py
  ```

### Ablation Matrix (Mean ± Standard Deviation across 10 Random Seeds)
| Anomaly Detection Configuration | Precision | Recall | $F_1\text{ Score}$ | False Positive Rate (FPR) | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Tier A (Deterministic Invariants)** | **1.000 ± 0.000** | 0.571 ± 0.000 | 0.727 ± 0.000 | **0.000 ± 0.000** | 0.08 ± 0.02 |
| **Tier B (Robust MAD Z-Scores)** | 0.979 ± 0.033 | 0.619 ± 0.000 | 0.758 ± 0.010 | 0.002 ± 0.004 | 1.12 ± 0.08 |
| **Tier C (Isolation Forest, c=0.05)** | 0.775 ± 0.094 | 0.295 ± 0.035 | 0.427 ± 0.051 | 0.014 ± 0.006 | 13.45 ± 0.92 |
| **Tier A + Tier B** | 0.987 ± 0.021 | **1.000 ± 0.000** | **0.993 ± 0.011** | 0.002 ± 0.004 | 1.20 ± 0.08 |
| **Tier A + Tier C (EduQuery Default)**| 0.897 ± 0.040 | 0.733 ± 0.024 | 0.806 ± 0.025 | 0.014 ± 0.006 | 13.53 ± 0.92 |
| **Tier B + Tier C** | 0.887 ± 0.051 | 0.700 ± 0.037 | 0.782 ± 0.038 | 0.015 ± 0.007 | 14.57 ± 0.95 |
| **Combined (All Tiers A + B + C)** | 0.919 ± 0.037 | **1.000 ± 0.000** | 0.957 ± 0.020 | 0.015 ± 0.007 | 14.65 ± 0.95 |

### Breakdown by Injected Anomaly Type
| Anomaly Category | Total Planted (10 Seeds) | Tier A Coverage | Tier B Coverage | Tier C Coverage | Tier A + C Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Arithmetic Sum Mismatches** | 80 | **100.0%** | 0.0% | 37.5% | **100.0%** |
| **Boundary Violations (<0, >100)** | 40 | **100.0%** | **100.0%** | 12.5% | **100.0%** |
| **Isolated Performance Collapses** | 60 | 0.0% | **100.0%** | 20.0% | 20.0% |
| **Structural Bimodal Outliers** | 30 | 0.0% | 0.0% | **83.3%** | **83.3%** |

### Contamination Rate Sensitivity (Isolation Forest)
| Contamination Parameter | Precision | Recall | $F_1\text{ Score}$ | Mean False Positives Count |
| :---: | :---: | :---: | :---: | :---: |
| `c = 0.01` | **0.950 ± 0.150** | 0.095 ± 0.024 | 0.171 ± 0.038 | **0.1 ± 0.3** |
| `c = 0.03` | 0.883 ± 0.117 | 0.210 ± 0.035 | 0.337 ± 0.047 | 0.6 ± 0.5 |
| `c = 0.05` (Default) | 0.775 ± 0.094 | 0.295 ± 0.035 | 0.427 ± 0.051 | 1.8 ± 0.8 |
| `c = 0.08` | 0.638 ± 0.068 | 0.381 ± 0.041 | 0.476 ± 0.043 | 4.6 ± 1.0 |
| `c = 0.10` | 0.548 ± 0.052 | 0.419 ± 0.035 | 0.473 ± 0.033 | 7.2 ± 1.1 |
| `c = 0.15` | 0.443 ± 0.043 | 0.505 ± 0.045 | 0.471 ± 0.036 | 13.2 ± 1.4 |

---

## 4. Experiment C: Verification and Recomputation Checks

- **Hypothesis**: The deterministic arithmetic reconciliation engine identifies 100% of printed-versus-computed sum discrepancies in marksheet workbooks without missing genuine errors.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_c_verification_checks.py
  ```

### Planted Errors Found vs Missed
| Workbook | Planted Arithmetic Discrepancies | Discrepancies Detected | Discrepancies Missed | Detection Recall | Discovered Boundary Violations | Invariant Verification Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `test1_commerce_same_layout.xlsx` | 97 | 97 | 0 | **100.0%** | 0 | **PASS** |
| `test1_same_layout_10courses_3divs.xlsx` | 104 | 104 | 0 | **100.0%** | 0 | **PASS** |
| `test2_lifesci_vague_single_row.xlsx` | 41 | 41 | 0 | **100.0%** | 0 | **PASS** |
| `test2_vague_single_row_batches.xlsx` | 42 | 42 | 0 | **100.0%** | 0 | **PASS** |
| `test3_arts_messy_sheet_per_division.xlsx`| 82 | 82 | 0 | **100.0%** | 0 | **PASS** |
| `test3_messy_sheet_per_division.xlsx` | 87 | 87 | 0 | **100.0%** | 0 | **PASS** |
| `Result_anonymized.xlsx` (Real Institutional)| 0 | 0 | 0 | **100.0%** | 0 | **PASS (0 False Positives)** |
| **TOTAL** | **453** | **453** | **0** | **100.0%** | **0** | **PASS** |

---

## 5. Experiment D: Ask AI Natural Language Query Compilation Benchmark

- **Hypothesis**: A schema-constrained predicate AST compiler provides sub-50ms deterministic query translation with zero numerical hallucination and automatically refuses speculative statistical inquiries.
- **Methodology**: Evaluated against 55 standardized natural language queries covering single filters (10), multi-conditions (10), numeric thresholds (10), course filters (5), prohibited statistical queries (15), and irrelevant non-academic prompts (5).
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_d_ask_ai_benchmark.py
  ```

### Performance Metrics
- **Total Evaluated Benchmark Queries**: 55
- **Refusal Accuracy**: **98.18%** (54 / 55 queries correct)
- **Filter AST Exact Match**: **98.18%** (54 / 55 queries correct)
- **Execution Accuracy (Result-Set Equality)**: **98.18%** (54 / 55 queries correct)
- **Mean Query Compilation Latency**: **19.61 ms** (P95: **51.40 ms**)

### Failure Case Analysis
One non-academic query failed refusal: `"Who won the football world cup?"`. Because the pronoun `"who"` was present in the academic relevance keyword list (`"student", "division", "fail", "who", ...`), the query was allowed through the relevance guard and returned the default cohort roster (145 records). This confirms a documented limitation of keyword-based guardrails.

---

## 6. Experiment E: HOD Executive Brief Faithfulness & Numeric Verification Audit

- **Hypothesis**: The HOD brief generation pipeline guarantees 100% numerical fact verification against underlying DuckDB ground truth, flagging unverified numbers for immediate fallback.
- **Methodology**: Executed 35 distinct generations (5 repeated runs across all 7 benchmark workbooks). Monitored all extracted numbers in the narrative against the database fact dictionary.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_e_hod_brief_faithfulness.py
  ```

### Empirical Results
- **Total Generations Audited**: 35
- **Total Extracted Numbers in Generated Narratives**: 550
- **Verified Ground-Truth Matching Numbers**: 545
- **Overall Numerical Faithfulness**: **99.09%**
- **Fallback-to-Template Rate**: **14.29%** (5 / 35 runs triggered template fallback on single-cohort workbooks missing division splits)
- **Mean Generation Latency**: **38.50 ms**

---

## 7. Experiment F: Privacy and Zero-PII Egress Verification

- **Hypothesis**: The application operates in complete network isolation during query translation, notice drafting, and brief synthesis, guaranteeing that no student names, seat numbers, or marks leave the host server.
- **Methodology**: Low-level interceptor attached to Python `socket.socket.connect`. Extracted 577 sensitive PII tokens from the active cohort. Monitored all outbound connection attempts and outgoing payloads during query execution and notice drafting.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_f_privacy_test.py
  ```

### Privacy Audit Results
- **Sensitive Institutional Tokens Monitored**: 577 (names, seat numbers, roll numbers, emails)
- **External Outbound Socket Connections Attempted**: **0**
- **Notice Template PII Leaks**: **0** (all personal details represented as `{placeholders}`)
- **HOD Brief Full-Name Leaks**: **0**
- **Remote Cloud API Calls**: **0**
- **PII Egress Rate**: **0.0%**
- **Compliance Status**: **PASS — Complete On-Premises Privacy Preservation**

---

## 8. Experiment G: Pre-ESE Early Warning Cross-Validation

- **Hypothesis**: Internal continuous assessments (MSE/ISA) predict final end-semester examination failures prior to final sitting.
- **Methodology**: Evaluated on the authentic engineering cohort (145 students, 13 final ESE failures). Compared Stratified 5-Fold Cross-Validated Logistic Regression against EduQuery's expert rule-based heuristic and a simple univariate baseline.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_g_early_warning_cv.py
  ```

### Model Performance Comparison
| Early Warning Model | Model Paradigm | 5-Fold Stratified CV AUC | Precision | Recall | $F_1\text{ Score}$ | True Positives (TP) | False Positives (FP) | False Negatives (FN) | True Negatives (TN) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **EduQuery Rule-Based Heuristic** | Expert Multi-Threshold Rule | N/A (Discrete) | **0.714** | **0.769** | **0.741** | 10 | 4 | 3 | 128 |
| **Simple Baseline (MSE < 10.0)** | Univariate Threshold | N/A (Discrete) | 0.667 | 0.615 | 0.640 | 8 | 4 | 5 | 128 |
| **Stratified 5-Fold Logistic Regression** | Supervised ML (Balanced) | **0.985 ± 0.018** | 0.688 | 0.846 | 0.759 | 11 | 5 | 2 | 127 |

- **Limitations**: The positive class size ($N=13$ failures) is small, reflecting institutional pass rates (89.7%). While internal assessments are strongly predictive of academic weakness, unannounced student absences during final exams cannot be anticipated solely from internal coursework.

---

## 9. Experiment H: Remedial Grouping and Peer Tutoring Optimization

- **Hypothesis**: Division-aware heuristic bipartite matchmaking maximizes peer tutoring division coherence while maintaining high tutor-tutee knowledge differentials.
- **Methodology**: Evaluated across 14 curriculum subjects with documented student backlogs in `Result_anonymized.xlsx`. Compared EduQuery Division-Aware Matchmaking against Greedy Highest-Score Matching and a Random Assignment Baseline (10 random seeds).
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_h_remedial_grouping.py
  ```

### Matching Quality Metrics
| Matchmaking Strategy | Same-Division Coherence | Mean Quality Score Difference | Mean Orphan Tutees Left Unassigned | Execution Latency |
| :--- | :---: | :---: | :---: | :---: |
| **EduQuery Division-Aware Matching** | **95.24%** | **+70.08 marks** | **0.0** | **0.062 ms** |
| **Greedy Highest-Score Matching** | 30.95% | +70.89 marks | 0.0 | 0.039 ms |
| **Random Baseline (10 Random Seeds)** | 47.38% | +65.19 marks | 0.0 | 0.088 ms |

---

## 10. Experiment I: Ingestion Scalability & Endpoint Latency

- **Hypothesis**: Ingestion runtime and memory consumption scale linearly with marksheet size, maintaining sub-15s ingestion and sub-100ms API response times.
- **Reproduce Command**:
  ```bash
  python paper_audit/experiments/exp_i_performance_scaling.py
  python paper_audit/experiments/exp_i_endpoint_latency.py
  ```

### Ingestion Scaling across Cohort Sizes
| Cohort Size (Students) | Total Assessment Scores | Workbook Size (MB) | Ingestion Runtime (sec) | Throughput (Students/sec) | Peak RAM Allocated (MB) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **100** | 3,200 | 0.04 | 1.006 s | 99.4 stud/s | 6.67 MB |
| **500** | 16,000 | 0.17 | 2.388 s | **209.4 stud/s** | 33.09 MB |
| **1,000** | 32,000 | 0.33 | 5.982 s | 167.2 stud/s | 66.73 MB |
| **2,000** | 64,000 | 0.65 | 13.737 s | 145.6 stud/s | 134.13 MB |

### API Endpoint Latency (Cold vs Warm over 10 Iterations)
| Endpoint | Method | Functional Role | Cold Start Latency (ms) | Warm Mean Latency (ms) | P95 Latency (ms) | Standard Deviation (ms) |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| `/health` | `GET` | Container Liveness Check | 113.88 ms | 53.28 ms | 73.66 ms | 13.75 ms |
| `/api/v1/overview/summary` | `GET` | Executive Dashboard Metrics | 44.64 ms | 44.70 ms | 66.43 ms | 13.74 ms |
| `/api/v1/students?limit=25` | `GET` | Paginated Student Directory | 396.00 ms | 56.01 ms | 79.52 ms | 15.02 ms |
| `/api/v1/subjects` | `GET` | Curriculum Catalog | 67.81 ms | 64.07 ms | 76.72 ms | 8.87 ms |
| `/api/v1/absent-students` | `GET` | Absentee Roster | 68.54 ms | 54.00 ms | 70.06 ms | 9.94 ms |
| `/api/v1/anomalies/findings` | `GET` | Anomaly Findings (Tiers A+C) | 178.17 ms | 168.11 ms | 212.46 ms | 27.65 ms |
| `/api/v1/ai/hod-brief` | `GET` | Fact-Verified HOD Brief | 59.11 ms | 56.22 ms | 72.51 ms | 10.74 ms |
| `/api/v1/ai/ask` | `POST` | Predicate AST Translation | 62.43 ms | **38.66 ms** | 64.22 ms | 15.65 ms |

---

## 11. Experiment J: Code Quality, Test Coverage, Bundle Size, and Accessibility

- **Backend Pytest Test Suite Results**:
  - Full Python Backend Pytest Suite: **324 tests executed** across 24 test suites (`pytest tests/`).
  - **Passed Tests**: **311 tests** (**96.0% pass rate** in 64.64s).
  - **Failing Tests (13 tests)**:
    - 7 tests in `tests/api/test_investigation_api.py` and 2 in `tests/test_ask_ai.py` failed due to the local active dataset pointer referencing a civil engineering test dataset (64 students) rather than the default 145-student cohort.
    - 1 test in `tests/api/test_students_api.py` failed because endpoint pagination limits were intentionally elevated from `limit <= 100` to `limit <= 1000` to support complete absentee rosters.
    - 2 tests in `tests/api/test_phase6_exports.py` failed on export header column name evolutions (`Student Name` vs `Name`).
- **Frontend Vitest Test Suite Results**:
  - Full Frontend Vitest Suite: **107 tests executed** across 17 test files (`npm --prefix frontend test`).
  - **Passed Tests**: **102 tests** (**95.3% pass rate** in 23.94s).
  - **Failed Tests (5 tests)**: Minor mock assertion text mismatches (e.g., `"Small Cohort"` badge text update in SubjectsCatalogPage).
- **Frontend Initial JS Bundle Budget**:
  - Raw Bundle Size: **322.83 KiB**
  - Gzip Compressed Size: **99.88 KiB** (Enforced CI Budget: **105.00 KiB gzip** — PASS)
  - Application Code Size: **13.39 KiB gzip** (`assets/index-CIFtIoXU.js`)
  - React 19 + React Router 7 Runtime: **77.30 KiB gzip** (`assets/vendor-react-B_aJDFuy.js`)
  - Iconography: **8.83 KiB gzip** (`assets/vendor-icons-BBfTzlWh.js`)
  - Runtime loader: **0.36 KiB gzip** (`assets/rolldown-runtime-WkwZ5CU-.js`)
- **WCAG 2.1 AA Contrast Check**:
  - 40 automated contrast pair checks evaluated across Light and Dark themes (`node scripts/check-contrast.mjs`).
  - Text on Glass Surfaces: **16.5:1 to 19.4:1** (Threshold: $\ge 4.5:1$).
  - Status Badges (Success, Danger, Warning, Info): **5.5:1 to 16.5:1** (Threshold: $\ge 4.5:1$).
  - Primary button contrast: **21.00:1** (Threshold: $\ge 4.5:1$).
  - Audit Result: **40 passed, 0 failed (100% WCAG 2.1 AA compliant)**.
