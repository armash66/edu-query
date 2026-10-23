# EduQuery - Testing and Verification Guide

## 1. Testing Philosophy

EduQuery enforces deterministic verification across all analytical, ingestion, security, and presentation layers. Because academic marks affect student transcripts and degree outcomes, the application requires 100% test pass rates across all test suites prior to deployment.

---

## 2. Test Execution Commands

### Full Test Suite Run (Backend + Frontend + Type Check + Build)

```bash
# 1. Run all backend tests
pytest -v

# 2. Run frontend unit and component tests
cd frontend
npm run test

# 3. Verify TypeScript strict types
node ./node_modules/typescript/bin/tsc -b

# 4. Verify frontend production build
npm run build
cd ..
```

---

## 3. Backend Test Suite Structure (Pytest)

The backend test suite contains **279 tests** organized into specific verification boundaries:

```text
tests/
├── api/
│   ├── test_analytics_api.py            # Overview metrics, charts, and division comparisons
│   ├── test_concurrency.py              # Multi-threaded read concurrency and worker stability
│   ├── test_data_quality_api.py         # Integrity scores and finding endpoints
│   ├── test_database_lifecycle.py       # DuckDB per-request lifecycle and connection closing
│   ├── test_health_api.py               # /health, /livez, and /readyz probe verification
│   ├── test_import_recovery_and_security.py # Crash recovery, staging isolation, zip-bomb checks
│   ├── test_imports_api.py              # Administrative import and candidate activation
│   ├── test_investigation_api.py        # Multi-condition query engine, presets, and sorting
│   ├── test_phase6_exports.py           # Authenticated CSV exports, headers, and formula escaping
│   ├── test_phase6_rollback.py          # Version listing, path traversal, and rollback
│   ├── test_phase7_e2e_integration.py   # Full upload-to-analysis application lifecycle
│   ├── test_security_gate_audit.py      # CORS, Cloudflare Access JWT, tickets, isolation (15 tests)
│   ├── test_security_resilience.py      # Malformed inputs, SQL injection, parameter escaping
│   ├── test_students_api.py             # Student roster, breakdown, pagination, disambiguation
│   └── test_subjects_api.py             # Course catalog, failure rates, and division filtering
├── unit/
│   ├── test_anomaly_detection.py        # Deterministic rules, MAD Z-score, Isolation Forest
│   ├── test_phase6_classification.py    # PASS/FAIL precedence, letter grades, absent components
│   └── test_phase6_workbooks.py         # Empty sheets, corrupted tables, formula evaluation
├── test_acceptance_workbooks.py         # Ground-truth tests across all 7 acceptance workbooks
├── test_api_schemas.py                  # Pydantic v2 contract serialization and validation
├── test_data_quality.py                 # Academic integrity Checks 1 to 10
├── test_identity_resolution.py          # Wildcard escaping and LIKE query safety
├── test_ingest.py                       # Cell parsing, provenance tracking, layout induction
├── test_mdm_electives.py                # Mutually exclusive electives and enrolled denominators
├── test_phase10_acceptance_workflow.py  # 18-step synthetic acceptance workflow
├── test_phase11_release_audit.py        # Security boundaries, SPA serving, archive limits
├── test_phase12_session_privacy.py      # Ephemeral sessions, TTL cleanup, deletion (11 tests)
├── test_student_breakdown.py            # Component breakdown, reconciliation, provenance
└── test_subject_failures.py             # Subject failure rates, denominators, partitions
```

---

## 4. Frontend Test Suite Structure (Vitest)

The frontend test suite contains **61 tests across 12 test files**:

```text
frontend/src/
├── api/
│   └── client.test.ts                   # API client, error parsing, requestBlob downloads (10 tests)
├── components/
│   └── Modals.test.tsx                  # DisambiguationModal and ConfirmDialog accessibility (7 tests)
└── pages/
    ├── DataQualityPage.test.tsx         # Finding cards, severity tabs, metrics (2 tests)
    ├── ExplorePage.test.tsx             # Presets, filter builder chips, AND/OR conditions (5 tests)
    ├── ImportPage.test.tsx              # Administrative key, preview, confirmation, rollback (7 tests)
    ├── OverviewPage.test.tsx            # Metric strip, comparison charts, review evidence (4 tests)
    ├── StudentDetailPage.test.tsx       # Component breakdown, reconciliation, disambiguation (5 tests)
    ├── StudentsPage.test.tsx            # Roster rendering, debounced search, division filter (4 tests)
    ├── SubjectDetailPage.test.tsx       # Subject failure roster with failing students (2 tests)
    ├── SubjectFailuresPage.test.tsx     # Failure rates, division filter, error banner (3 tests)
    ├── SubjectsCatalogPage.test.tsx     # Course catalog, modality filter, division filter (2 tests)
    └── UploadPage.test.tsx              # Upload dropzone, layout preview, privacy modes (10 tests)
```

---

## 5. Verified Ground Truth Across Acceptance Workbooks

The engine is continuously verified against 7 real-world and synthetic marksheets representing different curriculum formats and layout structures:

| Workbook | Curriculum Format | Sheets | Students | Courses | Scores | Key Invariants Verified |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `Result_anonymized.xlsx` | Mumbai University 3-tier merged | `Sheet1` | 145 | 27 | 13,775 | 132 PASSES, 13 FAILS; Div A: 85, Div B: 60; MDM Electives mutually exclusive (63+9+41+32=145). |
| `test1_commerce_same_layout.xlsx` | Commerce 3-division | `Sheet1` | 60 | 10 | 2,280 | Div A, B, C; unrecorded overall totals guarded. |
| `test1_same_layout_10courses_3divs.xlsx` | Standard 3-division | `Sheet1` | 60 | 10 | 2,280 | Div A, B, C partitioning. |
| `test2_lifesci_vague_single_row.xlsx` | Life Sciences single-row | `Results Oct` | 45 | 7 | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2; `ABS` flag handled. |
| `test2_vague_single_row_batches.xlsx` | Single-row synthetic | `Results Oct` | 45 | 7 | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2. |
| `test3_arts_messy_sheet_per_division.xlsx` | Multi-sheet Arts per-division | `Div A`, `Div B` | 50 | 8 | 1,500 | Both sheets accepted; Div A: 25, Div B: 25. |
| `test3_messy_sheet_per_division.xlsx` | Multi-sheet Engineering per-division | `Div A`, `Div B` | 50 | 8 | 1,500 | Both sheets accepted; Div A: 25, Div B: 25. |
| **Total Verified** | - | - | **455** | - | **23,765** | **Zero Silent Data Loss** |

---

## 6. Running Targeted Test Suites

### Run Security and Gateway Tests
```bash
pytest tests/api/test_security_gate_audit.py -v
```

### Run Session Privacy and Cleanup Tests
```bash
pytest tests/test_phase12_session_privacy.py -v
```

### Run Multi-Sheet Acceptance Workbook Tests
```bash
pytest tests/test_acceptance_workbooks.py -v
```

### Run Concurrency and Stress Tests
```bash
pytest tests/api/test_concurrency.py -v
```
