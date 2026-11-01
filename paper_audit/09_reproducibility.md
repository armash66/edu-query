# Deliverable 09: Reproducibility Protocol and Experiment Replication Guide

## 1. Environment & Dependency Setup from a Clean Machine

All measurements and empirical results in this audit can be reproduced from scratch on a clean Linux, macOS, or Windows workstation.

### Hardware & Software Prerequisites
- **Operating System**: Windows 11, Ubuntu 22.04 LTS, or macOS 14+
- **Python Runtime**: Python 3.11.x through 3.14.x (`python --version`)
- **Node.js Runtime**: Node.js v20.x through v24.x (`node --version`)
- **Package Managers**: `pip` (Python), `npm` (Node.js)

### Step 1: Clone Repository and Checkout Commit
```bash
git clone https://github.com/organization/eduquery-v3.git
cd eduquery-v3
git checkout 32caa740cd71b66210bc12a14bab1ab4344d835e
```

### Step 2: Configure Python Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Upgrade pip and install pinned dependencies
pip install --upgrade pip
pip install -r paper_audit/experiments/pip_freeze.txt
```

### Step 3: Install Frontend Dependencies & Verify Bundles
```bash
npm --prefix frontend install
npm --prefix frontend run check:contrast
npm --prefix frontend run check:budget
```

---

## 2. One-Command Master Experiment Replication

To execute all empirical benchmarks and regenerate all CSV and JSON result artifacts in one command:
```bash
python paper_audit/experiments/run_all_experiments.py
```
*Expected Execution Time*: Approximately 35 to 45 seconds total.

---

## 3. Individual Experiment Execution & Expected Outputs

### Experiment A: Parsing Correctness Across Diverse Workbooks
- **Command**:
  ```bash
  python paper_audit/experiments/exp_a_parsing_correctness.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_a_parsing_results.csv`
  - `paper_audit/experiments/exp_a_unsupported_handling.json`
- **Expected Output**:
  - 100.0% extraction accuracy across all 7 workbooks for student records, course blocks, and assessment marks.
  - Runtime: $\approx 3.8\text{ s}$ for `Result_anonymized.xlsx`, $\approx 250-315\text{ ms}$ for synthetic sheets.

### Experiment B: Anomaly Detection Ablation & Sensitivity
- **Command**:
  ```bash
  python paper_audit/experiments/exp_b_anomaly_detection.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_b_anomaly_detection_summary.csv`
  - `paper_audit/experiments/exp_b_all_runs.csv`
  - `paper_audit/experiments/exp_b_contamination_sensitivity.csv`
  - `paper_audit/experiments/exp_b_type_detection_rates.json`
- **Expected Output**:
  - Tier A (Deterministic): Precision $1.000 \pm 0.000$, Recall $0.571 \pm 0.000$, FPR $0.000 \pm 0.000$.
  - Tier A + Tier C (Default): Precision $0.897 \pm 0.040$, Recall $0.733 \pm 0.024$, $F_1 = 0.806 \pm 0.025$.
  - Tier A + Tier B: Precision $0.987 \pm 0.021$, Recall $1.000 \pm 0.000$, $F_1 = 0.993 \pm 0.011$.

### Experiment C: Verification and Invariant Recomputation Checks
- **Command**:
  ```bash
  python paper_audit/experiments/exp_c_verification_checks.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_c_verification_results.csv`
  - `paper_audit/experiments/exp_c_verification_results.json`
- **Expected Output**:
  - 100.0% recall on 453 planted arithmetic discrepancies across 6 test workbooks.
  - 0 false positives on `Result_anonymized.xlsx`.

### Experiment D: Ask AI Natural Language Query Compilation Benchmark
- **Command**:
  ```bash
  python paper_audit/experiments/exp_d_ask_ai_benchmark.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_d_ask_ai_results.csv`
  - `paper_audit/experiments/exp_d_ask_ai_summary.json`
- **Expected Output**:
  - Total queries: 55. Refusal accuracy: 98.18%. Execution accuracy: 98.18%.
  - Mean latency: $\approx 19.6\text{ ms}$, P95: $\approx 51.4\text{ ms}$.

### Experiment E: HOD Executive Brief Faithfulness & Numeric Verification
- **Command**:
  ```bash
  python paper_audit/experiments/exp_e_hod_brief_faithfulness.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_e_hod_brief_results.csv`
  - `paper_audit/experiments/exp_e_hod_brief_summary.json`
- **Expected Output**:
  - 35 generations across 7 workbooks.
  - Overall number faithfulness: 99.09% (545/550 numbers matched).
  - Fallback-to-template rate: 14.29% (5/35 runs).
  - Mean latency: $\approx 38.5\text{ ms}$.

### Experiment F: Privacy and Zero-PII Egress Verification Test
- **Command**:
  ```bash
  python paper_audit/experiments/exp_f_privacy_test.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_f_privacy_report.json`
- **Expected Output**:
  - Outbound socket connections attempted: 0.
  - Notice template PII leaks: 0.
  - HOD brief name leaks: 0.
  - PII egress rate: 0.0%. Status: PASS.

### Experiment G: Pre-ESE Early Warning Cross-Validation
- **Command**:
  ```bash
  python paper_audit/experiments/exp_g_early_warning_cv.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_g_early_warning_summary.csv`
  - `paper_audit/experiments/exp_g_early_warning_summary.json`
- **Expected Output**:
  - Stratified 5-Fold Logistic Regression CV-AUC: $0.985 \pm 0.018$.
  - Rule-based heuristic: Precision 71.4%, Recall 76.9%, $F_1 = 74.1\%$.

### Experiment H: Remedial Grouping and Matchmaking Benchmark
- **Command**:
  ```bash
  python paper_audit/experiments/exp_h_remedial_grouping.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_h_remedial_results.csv`
  - `paper_audit/experiments/exp_h_remedial_results.json`
- **Expected Output**:
  - Same-division coherence: 95.24% (EduQuery) vs 30.95% (Greedy) vs 47.38% (Random).
  - Score differential: $+70.08$ marks. Orphans: 0.0. Latency: $< 0.1\text{ ms}$.

### Experiment I: Ingestion Scalability & API Latencies
- **Commands**:
  ```bash
  python paper_audit/experiments/exp_i_performance_scaling.py
  python paper_audit/experiments/exp_i_endpoint_latency.py
  ```
- **Output Artifacts**:
  - `paper_audit/experiments/exp_i_ingestion_scaling.csv`
  - `paper_audit/experiments/exp_i_ingestion_scaling.json`
  - `paper_audit/experiments/exp_i_endpoint_latencies.csv`
  - `paper_audit/experiments/exp_i_endpoint_latencies.json`
- **Expected Output**:
  - Ingestion runtime: 1.0s (100 students) to 13.7s (2,000 students / 64,000 scores).
  - Peak memory: 6.7 MB (100 students) to 134.1 MB (2,000 students).
  - Warm API latencies: Overview 44.7 ms, Students 56.0 ms, Subjects 64.1 ms, Absentees 54.0 ms, Ask AI 38.7 ms.

---

## 4. Test Suite and Static Audits

```bash
# Run backend test suite
pytest tests/

# Run frontend unit tests
npm --prefix frontend test

# Run accessibility contrast audit
node scripts/check-contrast.mjs

# Run frontend bundle budget verification
node scripts/check-bundle-budget.mjs
```

