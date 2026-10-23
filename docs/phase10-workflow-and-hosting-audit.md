# EduQuery — Phase 10: Document-to-Insight Workflow, MDM Electives, Statistical Removal & Hosting Audit

## Executive Summary

Phase 10 prepares **EduQuery** for live faculty demonstration and multi-environment hosting. This milestone delivers:
1. **End-to-End Workflow Audit & Verification (Stages A through I):** Tracing the complete lifecycle from workbook drag-and-drop to executive reporting and crash recovery.
2. **First-Class MDM Elective Selection Semantics:** Strict mutual exclusivity verification, elimination of phantom unenrolled course records, and accurate enrollment denominators across all analytics.
3. **Statistical Outlier Decoupling (MAD Removal):** Removing noisy, non-actionable Robust Z-score flags from default faculty views, preserving deterministic marksheet integrity checks and Multivariate Isolation Forest ML outliers.
4. **Production Hosting Architecture:** Multi-stage containerization (`Dockerfile`), environment configuration separation (`.env.example`), atomic crash recovery pointers, dataset-scoped persistent moderation reviews, and Kubernetes/container health probes (`/health`, `/livez`, `/readyz`).

---

## 1. Document-to-Insight Workflow Audit (Stages A through I)

Every stage of marksheet ingestion, validation, and analytics was audited against production workloads:

| Stage | Name | Description & Invariants Enforced | Validation Status |
|---|---|---|---|
| **Stage A** | **Upload & Security Inspection** | Enforces max file size (25MB), magic bytes validation (`PK\x03\x04`), filename path traversal stripping (`..`, `/`), and OpenXML decompression bomb defense (<=100MB uncompressed, <=100:1 compression ratio). | **PASSED** (Tested against zip bomb, traversal attacks, and corrupt archives) |
| **Stage B** | **Layout Discovery & Preview** | Automated multi-row header induction, paired-row vs single-row detection, identity column mapping, and elective group discovery without mutating the active database. | **PASSED** (Discloses 145 students, 27 courses, strategy, and elective groups) |
| **Stage C** | **Integrity Verification & Audit** | Executes Checks 1–10 (duplicate IDs, out-of-range marks, arithmetic mismatches, absent vs 0 separation, ambiguous electives, and metadata conflicts). | **PASSED** (Quality score 96/100, health status `Needs Attention` due to non-blocking arithmetic discrepancies) |
| **Stage D** | **Dataset Activation & Pointer Switch** | Atomically promotes candidate database to versioned storage (`data/datasets/{id}.duckdb`) and writes active dataset pointer (`data/active_dataset.json`) with cross-process locking. | **PASSED** (Zero downtime, atomic `.tmp` + `os.replace` swap) |
| **Stage E** | **Faculty Academic Overview** | Computes pass/fail counts, outcome distributions, division comparisons, top failing subjects, and actionable guidance cards. | **PASSED** (120 passed, 20 failed, 5 unresolved across 145 students) |
| **Stage F** | **Subject Investigation & Denominators** | Resolves courses by code or fuzzy name. Enforces elective denominators counting *only* students actually enrolled in the elective. | **PASSED** (`MDMBD02` denominator = 63, `MDMBI02` = 9, `MDMIE02` = 41, `MDMRB02` = 32) |
| **Stage G** | **Student Investigation & Provenance** | Retrieves atomized component breakdown (ESE, ISA, MSE, PR, TW) with total reconciliation, letter grades, and exact source provenance (`source_sheet`, `source_row`). | **PASSED** (Verified on topper, multiple failures, and absent students) |
| **Stage H** | **Explainable Anomaly Moderation** | Surfaces deterministic calculation errors and Multivariate Isolation Forest candidates. Supports single-finding and student-level faculty reviews with moderation commentary. | **PASSED** (Persistent reviews survive reboots and are dataset-scoped) |
| **Stage I** | **Crash Recovery & Persistence Audit** | Restarts server with cold state and verifies active dataset recovery from pointer and persistent reviews file. | **PASSED** (Tested via simulated server reboot) |

---

## 2. MDM Elective Selection Semantics & Audit

### Ground Truth in `Result_anonymized.xlsx`
Detailed analysis of the reference examination workbook revealed:
- **Compulsory Foundation Course:** `MDM01` (Skill & Competency Development-1) is taken by **all 145 students**.
- **Mutually Exclusive Elective Pool:** Students select exactly **1 of 4** multidisciplinary electives:
  - `MDMBD02` (Financial Basics for Engineers and Technopreneurs): **63 students**
  - `MDMBI02` (Algorithms and Data Structures in Bioinformatics): **9 students**
  - `MDMIE02` (Startup Planning and Development): **41 students**
  - `MDMRB02` (Machine Vision and Robotic Perception): **32 students**
  - **Sum of Elective Enrollments:** $63 + 9 + 41 + 32 = 145$ students (100% mutually exclusive, 0 unassigned, 0 multi-assigned).

### Problem Solved
Prior to Phase 10, the ingestion loop initialized empty score entries for all assessment blocks across all students, generating **7,830 phantom empty rows** for unenrolled electives with `value=None` and `reconciliation.total_match=False`. This corrupted elective failure rates, inflated database tables, and caused unassigned students to appear in reconciliation tables.

### Implementation Fixes
1. **Strict Enrollment Gating (`app/core/ingest.py`):**
   ```python
   has_cell_data = bool(
       any(clean_text(v) for v in raw_values.values())
       or clean_text(raw_total)
       or clean_text(raw_cr)
       or (grade is not None and clean_text(grade) != "")
   )
   is_enrolled = has_cell_data or is_explicitly_selected
   if not is_enrolled:
       continue
   ```
   Unenrolled electives generate **0 scores, 0 grades, and 0 reconciliation rows**.
2. **Automated Elective Group Discovery (`detect_elective_groups`):**
   Groups elective course codes sharing common prefixes (e.g. `MDM*`), computes enrollment counts per alternative, checks mutual exclusivity, and discloses group metadata in the import preview:
   ```json
   {
     "group_id": "mdm_electives",
     "group_name": "Multidisciplinary Minor Electives",
     "course_codes": ["MDMBD02", "MDMBI02", "MDMIE02", "MDMRB02"],
     "selection_mode": "single_choice",
     "total_students": 145,
     "assigned_count": 145,
     "unassigned_count": 0,
     "multi_assigned_count": 0,
     "is_mutually_exclusive": true,
     "status": "valid"
   }
   ```
3. **Data Quality Audit Checks:**
   - **Check 9 (`ambiguous_elective_selection` & `unassigned_elective`):** Flags students enrolled in multiple mutually exclusive electives or unassigned students.
   - **Check 10 (`elective_selection_score_conflict`):** Flags conflicts where student registration metadata conflicts with marks recorded in another elective column.
4. **Denominators in Analytics & Reports:**
   Course failure rate calculation queries `WHERE course_code = ?` against `enrollment`, ensuring `total_enrolled` reflects *only* enrolled students (e.g. 63 for `MDMBD02`, not 145).

---

## 3. Statistical Feature Removal & Anomaly Moderation

### Rationale for Removing Robust Z-Score (MAD) from Default Views
- **High False Positive Rate:** Robust Z-score / MAD evaluates each course in 1D space. Normal bell-curve tails and legitimate high performers in difficult courses produced **40 statistical outlier flags** across the 145-student cohort.
- **Faculty Feedback:** Academic deans and teachers found 1D statistical outliers unhelpful and noisy; they wanted to focus on **objective calculation discrepancies** and **multivariate structural anomalies** (e.g. high volatility across components, extreme fail ratios relative to cohort performance).
- **Decoupled Architecture:** Statistical MAD analysis is decoupled from the default faculty workflow (`include_statistical=False` by default). The default finding count drops from **52 noisy items to 12 high-value findings**:
  - **4 Deterministic Discrepancies:** Arithmetic calculation sum mismatches where component marks sum differs from printed marksheet total.
  - **8 Multivariate Isolation Forest Outliers:** Multi-dimensional academic feature interactions (mean normalized score, dispersion volatility, max mismatch, failure ratio, total marks ratio).
- **Benchmark Reproducibility:** Robust Z-Score / MAD remains fully accessible for empirical research and comparative evaluations via `include_statistical=True` query parameter and the `/api/v1/anomalies/evaluation` benchmark endpoint.

### Dataset-Scoped Persistent Review Store
- Reviews are stored on disk in `data/reviews/{dataset_id}_reviews.json`.
- Moderation commentary and review toggles survive server restarts, rollbacks, and version activations without leaking across datasets.
- Implements atomic writes via temporary file and `os.replace`.

---

## 4. Hosting Readiness & Deployment Architecture

### 1. Multi-Stage Containerization (`Dockerfile`)
- **Stage 1 (Frontend Builder):** Uses `node:20-alpine`, runs `npm ci` and `npm run build` to produce clean static bundles in `frontend/dist`.
- **Stage 2 (Runtime):** Uses `python:3.11-slim` with `curl` for container health checks, installs `requirements.txt`, copies built frontend assets, sets non-root-compatible file permissions, and runs `uvicorn` with 2 worker processes.

### 2. Environment Configuration (`.env.example`)
Configurable environment variables for development and production environments:
- `EDUQUERY_ENV`: `production` vs `development`
- `EDUQUERY_DATABASE_PATH`: Path to DuckDB file
- `EDUQUERY_DATA_DIR`: Base directory for datasets, quarantine, reviews, and pointers
- `EDUQUERY_ACTIVE_POINTER_PATH`: Path to active dataset pointer JSON
- `EDUQUERY_IMPORT_API_KEY`: Secret administrative token required for upload, preview, and rollback
- `EDUQUERY_CORS_ORIGINS`: Restricted comma-separated allowed origins (e.g. `https://faculty.college.edu`)
- `EDUQUERY_MAX_UPLOAD_SIZE_BYTES`: Max file upload limit (default 25MB)
- `EDUQUERY_IMPORT_SESSION_TTL_SECONDS`: Session TTL (default 1 hour)

### 3. Container Orchestration Health Probes
- `GET /health`: Comprehensive database status, student count, course count, and active dataset ID. Returns HTTP 200 if database initialized, HTTP 503 if uninitialized.
- `GET /livez`: Fast liveness probe returning HTTP 200 if ASGI process is running.
- `GET /readyz`: Readiness probe returning HTTP 200 only when DuckDB is active and schema tables exist.

### 4. Upload Hardening
- OpenXML decompression bomb defense: checks uncompressed size <= 100MB, ratio <= 100:1, rejects entries with `..` or leading `/`.
- Session ID validation: regex `^[a-zA-Z0-9_\-]+$` rejects path traversal payloads.
- Constant-time string comparison for API key verification.

---

## 5. Synthetic 18-Step Acceptance Test Results

An end-to-end acceptance script (`tests/test_phase10_acceptance_workflow.py`) executes the full 18-step verification pipeline:
1. `GET /health` and `GET /livez` on uninitialized cold server -> Verified.
2. `POST /api/v1/imports/preview` without auth key -> Rejected (401).
3. `POST /api/v1/imports/preview` with invalid key -> Rejected (401/403).
4. `POST /api/v1/imports/preview` with valid workbook -> Accepted (200), preview generated.
5. Elective group disclosure in preview -> Verified (`mdm_electives`, 100% mutual exclusivity).
6. Data quality audit report in preview -> Verified (health status, 0 blocking errors).
7. `POST /api/v1/imports/confirm` -> Dataset confirmed and activated.
8. Active dataset pointer written atomically -> Verified (`data/active_dataset.json`).
9. `GET /readyz` probe -> Healthy and ready (200).
10. `GET /api/v1/analytics/overview` -> 20 students, pass/fail counts matching ground truth.
11. MDM elective subject failure report -> Verified accurate enrolled denominators (5 enrolled, not 20).
12. Student breakdown investigation & provenance -> Verified source coordinates (`Sheet1:row 5`).
13. Anomaly detection default summary -> Robust Z-score excluded by default.
14. Anomaly findings listing -> 0 `robust_zscore` findings returned to faculty.
15. Faculty review toggle action -> Finding marked reviewed with moderator commentary.
16. Persistent reviews file written -> Verified in `data/reviews/{dataset_id}_reviews.json`.
17. Server reboot simulation -> Cold app instance recovers active dataset from pointer.
18. Post-reboot review retention -> Moderation status retained intact.

**Result: 18/18 STEPS PASSED (100%).**

---

## 6. Test Suite Summary

- **Frontend Vitest Suite:** 50/50 tests passed across 11 test suites.
- **Frontend TypeScript Compiler (`tsc -b`):** 0 errors.
- **Backend Pytest Suite:** 243/243 tests passed across all unit, integration, security, and acceptance modules.
- **Safety Invariant:** 0 files staged for commit; V1 (`edu-query`) and V2 (`eduquery-v2`) unmodified.
