# EduQuery V3: Comprehensive Paper-Grade System Audit & Empirical Benchmark
**Repository Version:** `v3.0.0-rc1` | **Git Commit:** `32caa740cd71b66210bc12a14bab1ab4344d835e`  
**Audit Completed:** November 1, 2026 | **Host OS:** Windows 11 Enterprise (x86_64)  
**Execution Runtime:** Python 3.14.2 (AMD64), Node.js v24.14.0, DuckDB 1.4.1, FastAPI 0.115.0, React 19  
**Audit Objective:** Gather every mathematical formulation, algorithm parameter, empirical benchmark number, architectural diagram, and operational limitation required to draft a journal submission on EduQuery without requiring repository or codebase access.

---

## 1. Audit Deliverables Index

The audit comprises 15 standalone markdown monographs, 6 publication-ready vector figures, 7 LaTeX booktabs snippets, 13 experiment CSV tables, 48 multi-viewport UI screenshots, and a complete dataset inventory:

| Document | Title & Focus | Key Citations & Contents | Status |
| :--- | :--- | :--- | :--- |
| **[`00_manifest.md`](00_manifest.md)** | System Manifest & Environment Specifications | Commit hash, hardware profile, pinned dependencies (pip/npm), LOC counts (67,232 lines across 761 non-VCS files), MIT license. | **COMPLETE** |
| **[`01_scope.md`](01_scope.md)** | Scope & Operational Boundary Matrix | Personas (HOD, Exam Cell, Faculty Advisor), 23-feature status table (`IMPLEMENTED`, `PARTIAL`, `NOT IMPLEMENTED`), negative boundaries. | **COMPLETE** |
| **[`02_architecture.md`](02_architecture.md)** | System Architecture & Database Schemas | 7-stage pipeline breakdown, 4 valid Mermaid diagrams (System, Dataflow, Deployment, Sequence), full DuckDB DDL schema, 72 REST endpoints. | **COMPLETE** |
| **[`03_algorithms.md`](03_algorithms.md)** | Mathematical Formulations & Algorithms | Layout Induction, Cell Parsing regex, Invariant Recomputation, 3-Tier Anomaly Detection, AST Predicate Compiler, HOD Faithfulness Verifier. | **COMPLETE** |
| **[`04_data.md`](04_data.md)** | Dataset Manifest & Planted Anomaly Catalog | 7 workbooks (145 UG Eng, 120 Commerce, 90 LifeSci, 100 Arts), cryptographic SHA-256 hashes, paired-row vs single-row stride discovery. | **COMPLETE** |
| **[`05_evaluation.md`](05_evaluation.md)** | Comprehensive Empirical Benchmark Report | Experiments A through J: parsing exact-match, 10-seed anomaly ablations, AST compiler benchmark, scaling latency, Axe accessibility. | **COMPLETE** |
| **[`06_ui_ux.md`](06_ui_ux.md)** | Ergonomics & Responsive UX Architecture | 8 pages $\times$ 3 viewports $\times$ 2 themes (48 screenshots), Monochrome Glass design system, 68.7% bundle drop, 38% click reduction. | **COMPLETE** |
| **[`07_security_privacy_ethics.md`](07_security_privacy_ethics.md)** | Security, Cryptographic Privacy & Ethics | PII egress proof (0 external calls), unrecoverable disk deletion test, zip-bomb & formula injection hardening, npm/pip audits, license compliance. | **COMPLETE** |
| **[`08_limitations.md`](08_limitations.md)** | System Limitations & Known Vulnerabilities | Negative results, AST keyword leakage on ambiguous courses, single-cohort HOD brief limitations, legacy `.xls` format rejection, scale ceilings. | **COMPLETE** |
| **[`09_reproducibility.md`](09_reproducibility.md)** | Clean-Machine Master Reproduction Guide | Step-by-step reproduction instructions from `git clone`, standalone master runner (`run_all_experiments.py`), expected benchmark output ranges. | **COMPLETE** |
| **[`10_metrics_master.md`](10_metrics_master.md)** | Master Citable Metrics Register | 57 rigorously cited metrics with exact numeric values, measurement units, reproducible commands/scripts, and commit hashes. | **COMPLETE** |
| **[`11_history.md`](11_history.md)** | Longitudinal Git Evolution & Design Iterations | 6 architectural phases (V1 Streamlit bloat $\to$ V2 Hybrid $\to$ V3 Vectorized OLAP), legacy vs modern comparison, 4 key architectural lessons. | **COMPLETE** |
| **[`12_claims_register.md`](12_claims_register.md)** | Paper Contributions & Prohibited Claims | 6 candidate journal contributions rated Strong/Moderate/Weak with required caveats, plus 5 prohibited paper claims. | **COMPLETE** |
| **[`13_reviewer_critique.md`](13_reviewer_critique.md)** | Hostile Peer Review & Defense Dossier | 20 penetrating reviewer objections across novelty, dataset size, baselines, ML utility, ethics, and privacy, with evidence and paper counters. | **COMPLETE** |
| **[`14_decisions_needed.md`](14_decisions_needed.md)** | Institutional Policy Decisions Requiring Author | 6 university policy ambiguities requiring human author determination (grace mark rules, grade scale definitions, suffix semantics). | **COMPLETE** |

---

## 2. Publication-Ready Vector Figures & Tables

All figures are generated in vector SVG format (grayscale-safe, high-contrast, publication typography), paired with raw CSV source data and formatted LaTeX `.tex` snippets in `paper_audit/figures/` and `paper_audit/tables/`:

### Figures (`paper_audit/figures/`)
1. **[`fig1_system_architecture.svg`](figures/fig1_system_architecture.svg)** (`.csv`): High-level system architecture showing decoupled React 19 SPA, upload-hardened gateway, in-memory DuckDB OLAP engine, and air-gapped egress.
2. **[`fig2_data_pipeline.svg`](figures/fig2_data_pipeline.svg)** (`.csv`): Seven-stage sequential data transformation pipeline from multi-layout Excel intake to audited PDF/Excel report egress.
3. **[`fig3_anomaly_pr_curves.svg`](figures/fig3_anomaly_pr_curves.svg)** (`.csv`): Isolation Forest contamination sensitivity curve ($c \in [0.01, 0.15]$), precision-recall tradeoff, and the system operating point ($c=0.05$).
4. **[`fig4_anomaly_confusion_matrices.svg`](figures/fig4_anomaly_confusion_matrices.svg)** (`.csv`): 2x2 empirical confusion matrix heatmaps comparing Tier A, Tier C, System Default (Tier A+C), and the High-Recall Ensemble (Tier A+B).
5. **[`fig5_latency_scaling.svg`](figures/fig5_latency_scaling.svg)** (`.csv`): Dual-panel scalability profile showing ingestion wall-clock runtime vs cohort size ($N=100$ to $2,000$), alongside cold hit vs warm API response latencies.
6. **[`fig6_ui_responsive_grid.svg`](figures/fig6_ui_responsive_grid.svg)** (`.csv`): Responsive layout transformations across Desktop ($1440\text{px}$), Tablet ($768\text{px}$), and Mobile ($390\text{px}$) viewports, paired with design token specs.
7. **[`CAPTIONS.md`](figures/CAPTIONS.md)**: Full journal caption text for Figures 1 through 6.

### LaTeX Booktabs Tables (`paper_audit/tables/`)
- **`table1_dataset_inventory.tex`** (`.csv`): Institutional & synthetic dataset inventory, student/score counts, layout strides, and SHA-256 hashes.
- **`table2_parsing_accuracy.tex`** (`.csv`): Field-level layout induction and exact-match parsing accuracy ($100.0\%$).
- **`table3_anomaly_detection_ablations.tex`** (`.csv`): 10-seed ablation benchmark across anomaly detection tiers (Precision, Recall, $F_1$, FPR, Runtime).
- **`table4_ask_ai_benchmark.tex`** (`.csv`): Ask AI schema-constrained predicate compiler benchmark ($N=55$ queries, $98.18\%$ AST match, $19.61\text{ ms}$).
- **`table5_ingestion_scaling.tex`** (`.csv`): Ingestion scalability, throughput (stud/s), and peak RAM across cohort sizes ($100$ to $2,000$).
- **`table6_remedial_grouping.tex`** (`.csv`): Remedial peer-tutor grouping constraint satisfaction vs Greedy and Random baselines ($95.24\%$ division coherence).
- **`table7_endpoint_latency.tex`** (`.csv`): Analytical REST API latency profile (cold hit vs warm mean/median/P95).

---

## 3. Dataset & Planted Ground Truth Assets (`paper_audit/data/`)

- **`checksums.sha256`**: Cryptographic SHA-256 hashes of all primary workbooks.
- **`dataset_inventory.csv`**: Machine-readable inventory of institutional and synthetic cohorts.
- **`planted_anomalies_ground_truth.csv`**: Record-level ground truth mapping for the anomaly detection benchmark ($N=150$ students, 21 positive anomalies, 129 controls).
- **`synthetic_cohort_specs.csv`**: Parameter specifications and random seeds used to generate the scaling workbooks.
- **`README.md`**: Protocol documentation regarding student PII anonymization and synthetic demographic replacement.

---

## 4. Key Empirical Findings (Paper Highlights)

1. **Ingestion & Induction Accuracy:**
   - **$100.0\%$ Exact-Match Field Parsing:** Across all 7 institutional and synthetic test workbooks ($N=500$ students, $14,992$ score records), layout stride ($r=1$ vs $r=2$) was identified autonomously without user configuration.
   - **$100.0\%$ Invariant Discrepancy Recall:** $453 / 453$ planted arithmetic sum discrepancies across 6 test workbooks were detected with zero misses.
2. **Anomaly Detection Tier Tradeoffs (10 Random Seeds):**
   - **Tier A (Deterministic):** Precision $= 1.000$, False Positive Rate $= 0.000$, Latency $= 0.08\text{ ms}$. Perfect for official administrative marksheet audits.
   - **System Default (Tier A + C):** $F_1 = 0.806 \pm 0.025$, Precision $= 0.897 \pm 0.040$, Recall $= 0.733 \pm 0.024$. Deliberately decouples Tier B (Robust MAD Z-score) from default faculty dashboards to suppress alert fatigue caused by stellar student outliers.
   - **High-Recall Ensemble (Tier A + B):** $F_1 = 0.993 \pm 0.011$, Recall $= 1.000$, Precision $= 0.987 \pm 0.021$. Ideal for exhaustive forensic marksheet audits.
3. **Ask AI Query Engine (Zero External LLM / Zero PII Egress):**
   - Implemented as a Schema-Constrained Predicate AST Compiler translating natural language queries directly into parameterized DuckDB SQL.
   - **$98.18\%$ AST Exact Match:** $54 / 55$ benchmark queries compiled correctly.
   - **$100.0\%$ Refusal Accuracy on Statistical & Out-of-Scope Prompts:** Refuses predictive and non-academic queries with zero hallucination.
   - **Zero PII Egress:** Network surveillance confirmed $0$ bytes of student names, marks, or metadata exit the local machine.
   - **Mean Latency:** $19.61\text{ ms}$ (vs $>1,200\text{ ms}$ for cloud LLM APIs).
4. **Sub-Linear Scalability:**
   - Ingestion runtime scales from $1.006\text{ s}$ ($100$ students, $6.67\text{ MB}$ RAM) to $13.737\text{ s}$ ($2,000$ students, $64,000$ scores, $134.13\text{ MB}$ RAM). Peak ingestion throughput reaches $209.4\text{ students/sec}$.
5. **Client Bundle & Interaction Ergonomics:**
   - Initial JS bundle compressed to $99.88\text{ KiB}$ gzip ($13.39\text{ KiB}$ application code), a $68.7\%$ reduction compared to legacy marksheet dashboards.
   - Interaction task steps reduced by $38\%$ across 5 core academic workflows.
   - $40 / 40$ WCAG 2.1 AA accessibility contrast checks passed in both light and dark modes.

---

## 5. Clean-Machine Reproduction Guide

To independently reproduce all empirical results, tables, and figures from a clean checkout:

```powershell
# 1. Clone repository and verify commit
git clone https://github.com/armash-a/eduquery-v3.git
cd eduquery-v3
git checkout 32caa740cd71b66210bc12a14bab1ab4344d835e

# 2. Setup Python environment and dependencies
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install duckdb scikit-learn scipy openpyxl reportlab

# 3. Execute Master Benchmark Runner
python paper_audit/experiments/run_all_experiments.py

# 4. Generate All Vector Figures, LaTeX Tables, and CSVs
python paper_audit/experiments/generate_remaining_audit_assets.py

# 5. Verify Generated Checksums
Get-FileHash -Algorithm SHA256 Result_anonymized.xlsx, test1_commerce_same_layout.xlsx
```

---

## 6. Audit Status Checklist

| Requirement | Audit Deliverable | Status | Evidence File |
| :--- | :--- | :--- | :--- |
| Commit hash, OS, dependencies, LOC | `00_manifest.md` | **COMPLETE** | `experiments/system_manifest.json`, `experiments/loc_stats.json` |
| Scope, personas, 23-feature status | `01_scope.md` | **COMPLETE** | `01_scope.md` (Section 3 Feature Matrix) |
| Pipeline, Mermaid diagrams, DDL, APIs | `02_architecture.md` | **COMPLETE** | `02_architecture.md`, `experiments/api_routes.json` |
| Algorithm pseudocode, params, formulas | `03_algorithms.md` | **COMPLETE** | `03_algorithms.md` (Verbatim constants & LaTeX formulas) |
| Dataset inventory, hashes, planted errors | `04_data.md`, `/data/` | **COMPLETE** | `data/checksums.sha256`, `data/planted_anomalies_ground_truth.csv` |
| Empirical experiments A through J | `05_evaluation.md` | **COMPLETE** | `experiments/exp_*.csv`, `experiments/exp_*.json` |
| 48 responsive screenshots & UX review | `06_ui_ux.md` | **COMPLETE** | `screenshots/*.png` (48 responsive captures) |
| Security hardening, PII egress, audits | `07_security_privacy_ethics.md` | **COMPLETE** | `experiments/session_deletion_proof.json`, `experiments/exp_f_privacy_report.json` |
| Negative results, limits, scale ceilings | `08_limitations.md` | **COMPLETE** | `08_limitations.md` (8 identified operational limits) |
| Reproduction steps from clean machine | `09_reproducibility.md` | **COMPLETE** | `experiments/run_all_experiments.py` |
| Master citable metrics table (57 entries) | `10_metrics_master.md` | **COMPLETE** | `10_metrics_master.md` |
| Longitudinal git history (6 phases) | `11_history.md` | **COMPLETE** | `11_history.md` |
| Paper claims register & prohibitions | `12_claims_register.md` | **COMPLETE** | `12_claims_register.md` |
| Hostile peer review (20 objections) | `13_reviewer_critique.md` | **COMPLETE** | `13_reviewer_critique.md` |
| Institutional decisions needed by author | `14_decisions_needed.md` | **COMPLETE** | `14_decisions_needed.md` |
| 6 Vector SVG figures + CSVs + captions | `figures/` | **COMPLETE** | `figures/fig1_*.svg` to `figures/fig6_*.svg`, `figures/CAPTIONS.md` |
| 7 LaTeX booktabs tables + matching CSVs | `tables/` | **COMPLETE** | `tables/table1_*.tex` to `tables/table7_*.tex` |
| Master Zip Archive at repository root | `/paper_audit.zip` | **COMPLETE** | Generated in final step |

**Audit Result:** All deliverables are **100% COMPLETE** with zero partial or blocked items.

