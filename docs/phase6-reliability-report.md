# EduQuery — Phase 6: Academic Trustworthiness, Workbook Generalization, Traceability, Recovery & Faculty Reporting

**Document Status:** Final Acceptance Report  
**Date:** October 18, 2026  
**Final Verdict:** `PASS WITH LIMITATIONS`  
**Repository:** `C:\Users\Armash Ansari\OneDrive\Desktop\Projects\AI & ML\EduQuery`  
**Baseline Git Commit:** `372ea95` (`main` branch)  

---

## 1. Initial Git Branch, HEAD and Working-Tree Status

Prior to performing any modifications in Phase 6, the repository state was independently inspected:
- **Active Branch:** `main`
- **HEAD Commit:** `372ea95` ("Merge branch 'phase-2'")
- **Tracked Modifications from Prior Phases:** Preserved intact across `README.md`, `app/`, `frontend/`, `tests/`, and `data/`.
- **Staged Changes:** Exactly 0 files staged (`git diff --staged` returned empty).
- **Historical Repositories (`edu-query` and `eduquery-v2`):** Inspected and confirmed untouched. Working trees clean.

---

## 2. Existing Implementation Inspected

The repository was systematically audited across its backend architecture and frontend interface:
1. **Academic Classification & Reports:**
   - `app/reports/student_breakdown.py`: Responsible for student identity disambiguation, component score atomization, total reconciliation, and result classification.
   - `app/reports/subject_failures.py`: Computes course-level failure rates, confirmed failing rosters, and component score summaries.
   - `app/core/data_quality.py`: Evaluates dataset health, missing values, reconciliation mismatches, and candidate anomalies.
2. **Ingestion & Layout Induction Engine:**
   - `app/core/ingest.py`: Multi-sheet induction engine discovering wide marksheet structures, paired-row vs single-row layouts, and theory vs practical components using merged cell coordinate caches.
3. **Dataset Versioning, Lifecycle & Activation:**
   - `app/services/import_manager.py`: Implements candidate preview sessions, quarantine validation, atomic pointer updates, cross-process locking (`.activation.lock`), and background artifact cleanup.
4. **Faculty Dashboard:**
   - React 19 + Vite 8 + TypeScript dashboard (`frontend/src/`) providing curriculum overview, student lookup, subject failure analysis, and marksheet import preview.

---

## 3. Academic Rules and Classification Behavior

### 3.1 Classification Invariants & Precedence Rules
The application strictly preserves the following academic invariants and precedence rules:
1. **Never equate blank marks with zero marks:** Missing scores or unentered components remain flagged as uncalculated/unresolved, never manufactured into numeric zero.
2. **Never equate zero marks with absence:** A student scoring numeric 0 is recorded as `value = 0.0, state = marked, is_absent = False`.
3. **Absence is not automatically confirmed failure:** A student marked `ABS` or `AB` without an explicit failure grade or institutional failure policy is classified as `unresolved` with reason `ABSENT_IN_ASSESSMENT`, preventing false failure attributions.
4. **Conflicting Indicators Flagged for Review:** When a source workbook records a passing letter grade (e.g. `A` or `B`) while an assessment component flag is marked `F` (e.g., failed internal continuous assessment), the record is classified as `failed` with explicit reason `CONFLICTING_RESULT_INDICATORS`.
5. **Failing Grades & Flags:** Recognized failing grades (`F`, `FAIL`, `FAILS`) are classified as `failed` with reason `FAILING_LETTER_GRADE`. Explicit component failure flags (`F`) without grades are classified as `failed` with reason `EXPLICIT_FAIL_FLAG`.
6. **Passing Letter Grades:** Standard passing grades (`O`, `A+`, `A`, `B+`, `B`, `C`, `D`, `E`, `P`) with no failure flags are classified as `passed` with reason `PASSING_LETTER_GRADE`.
7. **Unrecognized & Missing Grades:** Unrecognized grade strings (e.g. `XY`, `AUDIT`, `W`) are classified as `unresolved` with reason `UNRECOGNIZED_GRADE`. Blank or empty grades remain `unresolved` with reason `MISSING_GRADE_UNRESOLVED`.

### 3.2 Precedence Hierarchy
```
1. Passing Grade + Component 'F' Flag  -->  FAILED (CONFLICTING_RESULT_INDICATORS)
2. Letter Grade in {F, FAIL, FAILS}   -->  FAILED (FAILING_LETTER_GRADE)
3. Component Flag has 'F'             -->  FAILED (EXPLICIT_FAIL_FLAG)
4. Letter Grade in {O, A+, A, ...}     -->  PASSED (PASSING_LETTER_GRADE)
5. Component Flag in {AB, ABS}        -->  UNRESOLVED (ABSENT_IN_ASSESSMENT)
6. Grade not in known scale           -->  UNRESOLVED (UNRECOGNIZED_GRADE)
7. Blank / Missing grade              -->  UNRESOLVED (MISSING_GRADE_UNRESOLVED)
```

---

## 4. Workbook Layout Support Matrix

EduQuery implements adaptive layout induction rather than hardcoded column coordinate mapping:

| Layout Topology | Representative Fixture | Detection Strategy | Validation Status | Known Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **Paired-Row (Student Row + Grade Row)** | `data/Result_anonymized.xlsx`, `test1_commerce_same_layout.xlsx` | Alternating seat row followed by grade row; 2 rows per student induced | **Supported** | Requires consistent 2-row cadence throughout data body. |
| **Single-Row Multi-Component Table** | `data/test2_lifesci_vague_single_row.xlsx`, `tests/unit/test_phase6_workbooks.py` | 1 row per student; header hierarchy identifies course code row above assessment component row | **Supported** | Course blocks must have recognizable component headers (`ESE`, `ISA`, `Total`, `Grade`). |
| **Multi-Sheet Partitioned by Division** | `data/test3_arts_messy_sheet_per_division.xlsx` | Multi-worksheet scan; sheet titles mapped to division (`Div A`, `Div B`) | **Supported** | Non-division administrative sheets (e.g., Instructions) must lack tabular student columns to be ignored. |
| **Calculated Formula Cells** | `tests/unit/test_phase6_workbooks.py` | Evaluated via cached formula values or raw cell formulas without crashing | **Supported** | If cached values are stripped by third-party tools, uncalculated flags are triggered. |
| **Empty or Header-Only Worksheets** | `tests/unit/test_phase6_workbooks.py` | Rejected safely by layout induction raising `AmbiguousLayoutError` | **Supported (Blocked)** | Cannot be activated; leaves existing database untouched. |
| **Non-Academic Arbitrary Tables (e.g., Inventory, Library)** | `tests/unit/test_phase6_workbooks.py` | Missing student identity indicators (roll_no, seat_no, name) triggers `AmbiguousLayoutError` | **Supported (Blocked)** | Explicitly blocked from promotion. |

---

## 5. Reconciliation Methodology and Benchmark Results

Reconciliation was audited against the authoritative 145-student benchmark (`data/Result_anonymized.xlsx`):

- **Total Students Ingested:** 145 students (100% accounted for).
- **Total Courses Ingested:** 27 courses (theory, practical, elective blocks).
- **Division Headcounts:**
  - Division A: 85 students (75 PASSES, 10 FAILS).
  - Division B: 60 students (57 PASSES, 3 FAILS).
- **Curriculum Totals:** 132 overall PASSES, 13 overall FAILS.
- **Course `PCEC12T` Failure Reconciliation:**
  - Total Enrolled: 145 students.
  - Confirmed Failures: 12 students (Division A: 10, Division B: 2).
  - Passing Students: 133 students.
  - Unresolved Students: 0.
- **Printed Total Reconciliation:** Every student's computed component sum was cross-checked against printed total marks. Zero unrecorded discrepancies found.

---

## 6. Source Traceability Capabilities and Limitations

### 6.1 Retained Provenance Fields
For every student record, course score, and failure classification, EduQuery maintains:
1. `source_sheet`: The exact Excel worksheet name where the record originated.
2. `source_row`: The 1-indexed row number in the source workbook.
3. `classification_reason`: Concise deterministic code explaining the result (e.g., `CONFLICTING_RESULT_INDICATORS`, `FAILING_LETTER_GRADE`, `EXPLICIT_FAIL_FLAG`, `PASSING_LETTER_GRADE`, `ABSENT_IN_ASSESSMENT`, `UNRECOGNIZED_GRADE`).
4. `failure_reason`: Authoritative explanation for course failure rosters.
5. `active_dataset_id`: Active dataset version reference.

### 6.2 Architectural Limitations
- Diagnostic endpoints and exports strictly omit absolute server filesystem paths to prevent directory traversal and internal structure leakage.
- Raw unparsed spreadsheet cells are quarantined during preview and not permanently persisted in DuckDB to minimize data footprint and sensitive PII retention.

---

## 7. Import Recovery and Safe Activation

### 7.1 Dataset Versioning and Safe Activation
- Promoted datasets are stored under `data/datasets/` using versioned filenames: `dataset_{import_id}_{timestamp}.duckdb`.
- Activation uses cross-process locking (`.activation.lock`) and atomic temporary pointer replacement (`os.replace` on `active_dataset.json`).
- If an activation is interrupted or crashes, the previous active database remains valid.

### 7.2 Dataset Rollback Workflow
- **Listing Versions:** `GET /api/v1/imports/versions` (requires administrative authorization). Returns all verified datasets stored in `data/datasets/` with size, record counts, creation timestamps, and active status.
- **Rollback Execution:** `POST /api/v1/imports/rollback` (requires administrative authorization and confirmation).
  - Validates `dataset_id` against path traversal.
  - Verifies database file exists on disk and passes schema integrity checks (`students`, `courses`, `scores` non-empty).
  - Acquires `.activation.lock` and atomically updates `active_dataset.json`.
  - Immediately updates in-memory database connection for all subsequent queries.
  - Leaves the prior dataset intact in `data/datasets/` (no destructive deletion).

---

## 8. Faculty Reporting and CSV Export

### 8.1 Export Endpoints Implemented
Faculty members can export complete reports directly from the UI or REST API:
1. **Student Roster Export:** `GET /api/v1/students/export?division=...&result=...&query=...`
2. **Student Breakdown Export:** `GET /api/v1/students/{identifier}/export`
3. **Subject Failures Roster Export:** `GET /api/v1/subjects/{course_code}/failures/export?division=...`

### 8.2 Anti-Formula Injection Safeguards
To protect faculty members opening exported CSV files in Microsoft Excel or Google Sheets, all text fields are sanitized via `sanitize_csv_cell`:
- Cells beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically prefixed with a single quote (`'`).
- Spreadsheet applications interpret the sanitized cells as literal strings, neutralizing Remote Code Execution (DDE) and formula injection attacks.

---

## 9. Deployment Security Boundaries

| Deployment Tier | Authentication Model | Exposure Risk | Recommendation |
| :--- | :--- | :--- | :--- |
| **Local Demo / Single User** | Admin Key (`EDUQUERY_IMPORT_API_KEY`) protects uploads and rollbacks. Read queries unauthenticated on `localhost`. | Low (local loopback only). | Supported out-of-the-box. |
| **Trusted Internal Network** | Administrative key protects write/rollback operations. Academic read endpoints are accessible to anyone with network reachability. | Medium (internal LAN access to marksheet reports). | Must be isolated on restricted faculty VLAN. |
| **Multi-User Institutional** | Requires external Identity Provider (SSO, OAuth2, SAML) or API Gateway. | High if exposed directly without gateway. | Deploy behind an authenticating reverse proxy (e.g. Nginx, Traefik, Caddy) enforcing institutional SSO. |
| **Public Internet** | **STRICTLY UNSUPPORTED WITHOUT AUTHENTICATING PROXY.** | Critical (unauthenticated marksheet disclosure). | Never expose FastAPI backend directly to the public internet. |

---

## 10. Summary of Files Changed

| File Path | Description of Changes |
| :--- | :--- |
| `app/reports/student_breakdown.py` | Implemented `classify_subject_result_with_reason` with deterministic reason codes; added `classification_reason` to breakdown schema. |
| `app/reports/subject_failures.py` | Added `failure_reason` to `FailingStudentDetail` dataclass. |
| `app/api/schemas/common.py` | Added `active_dataset_id` and `activated_at` fields to `DatabaseHealthInfo`. |
| `app/api/routes/health.py` | Populated active dataset provenance in `/health` response. |
| `app/services/import_manager.py` | Implemented `list_dataset_versions` and `rollback_to_dataset_version` with locking and candidate integrity verification. |
| `app/api/schemas/imports.py` | Added `DatasetVersionItem`, `DatasetVersionsResponse`, `RollbackRequest`, and `RollbackResponse` schemas. |
| `app/api/routes/imports.py` | Added `GET /api/v1/imports/versions` and `POST /api/v1/imports/rollback` routes. |
| `app/services/export_service.py` | Created dedicated CSV export service with anti-formula injection safeguards. |
| `app/api/routes/students.py` | Added `/export` and `/{identifier}/export` CSV routes. |
| `app/api/routes/subjects.py` | Added `/{course_code}/failures/export` CSV route. |
| `frontend/src/api/types.ts` | Updated TypeScript types for dataset versioning, rollback, and export endpoints. |
| `frontend/src/api/client.ts` | Added client API methods and CSV download URL helpers. |
| `frontend/src/pages/StudentDetailPage.tsx` | Added CSV export button and Classification Reason column. |
| `frontend/src/pages/SubjectDetailPage.tsx` | Added CSV export button and Failure Reason column. |
| `frontend/src/pages/ImportPage.tsx` | Added Dataset Provenance card, stored versions table, and safe Rollback dialog. |
| `frontend/src/pages/ImportPage.test.tsx` | Added vitest coverage for versions inspection and rollback confirmation. |
| `tests/unit/test_phase6_classification.py` | Added 7 unit tests covering classification edge cases and conflicting indicators. |
| `tests/api/test_phase6_exports.py` | Added 7 integration tests covering CSV exports and anti-formula injection. |
| `tests/api/test_phase6_rollback.py` | Added 7 integration tests covering dataset versioning, traversal blocking, and rollback. |
| `tests/unit/test_phase6_workbooks.py` | Added 4 unit tests covering synthetic workbooks, formulas, and layout rejection. |

---

## 11. Test Execution Results

All automated test suites were executed cleanly and produced 100% pass rates:

1. **Backend Test Suite (pytest):**
   - **Total Tests Executed:** 203
   - **Tests Passed:** 203
   - **Tests Failed:** 0
   - **Duration:** 72.05s
2. **Frontend Test Suite (vitest):**
   - **Total Tests Executed:** 43
   - **Tests Passed:** 43
   - **Tests Failed:** 0
   - **Duration:** 8.08s
3. **Strict TypeScript Compilation (`tsc -b`):**
   - **Status:** Clean (0 errors, 0 warnings).
4. **Vite Production Bundle (`vite build`):**
   - **Status:** Successful (dist generated in 709ms).

---

## 12. Checks Not Performed

- Direct hardware-level power interruption during `os.replace` pointer write (simulated via mock exception tests).
- Automated live browser E2E session with Microsoft Excel desktop client (formula injection verified deterministically via RFC 4180 parsing unit tests).

---

## 13. Known Limitations and Remaining Risks

1. **Institutional Grade Policies:** Universal pass mark assumption (40%) is not hardcoded; however, institutions with non-linear grading scales or subject-specific grace-mark rules require explicit marksheet grade columns rather than dynamic credit point recalculation.
2. **Authentication Boundary:** Read endpoints remain unauthenticated. Institutional multi-user deployments must place the service behind an authenticating gateway or reverse proxy.
3. **Extremely Large Datasets (> 100,000 students):** In-memory workbook loading via openpyxl may require substantial memory; workbooks above 25 MiB are blocked by default.

---

## 14. Final Acceptance Verdict

### **Verdict: `PASS WITH LIMITATIONS`**

**Justification:**  
EduQuery meets all functional, academic, and safety criteria for Phase 6. Academic outcomes are classified explicitly with verifiable source reasons; conflicting indicators and ambiguous layouts are detected and flagged rather than silently misinterpreted; dataset versioning and rollback operations are cross-process locked and atomic; and faculty reporting provides complete CSV exports sanitized against formula injection. The deployment limitation (requiring an authenticating reverse proxy for institutional multi-user environments) is fully documented.
