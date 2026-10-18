# EduQuery V3: Academic Marksheet Analysis Engine

EduQuery V3 is a deterministic, high-performance academic marksheet analysis workspace built for college faculty and university administrators.

It replaces the natural-language query and LoRA neural planning experiments of V1/V2 with a clean, verified, dashboard-first marksheet intelligence platform.

---

## 🎯 Core Capabilities & Architecture

- **Zero LLM / Neural Overhead**: Purely deterministic analytics and verified scikit-learn anomaly detection without PyTorch, Transformers, PEFT, or BitsAndBytes dependencies.
- **Multi-Sheet Ingestion**: Automatically detects heterogeneous layouts across wide sheets, merged headers, single-row vs paired-row formats, and multi-division worksheets (`Div A`, `Div B`).
- **MDM Elective Semantics (Phase 10)**: Enforces mutually exclusive single-choice elective selection (1 of $N$). Unselected alternatives produce 0 phantom scores/grades; failure rates and enrollment denominators strictly count enrolled students.
- **Full Traceability**: Invariant tracking of `source_sheet` and `source_row` for every student record and assessment score.
- **Academic Integrity Auditor**: Pre-validation of duplicate IDs, out-of-range marks, inconsistent printed totals vs. component sums, absent (`AB`) vs. zero distributions, and elective conflicts (Checks 9 & 10).
- **Curated Faculty Anomaly Insights (Phase 10)**: Decoupled 1D statistical noise (MAD outliers) from default views (`include_statistical=False`), focusing exclusively on deterministic calculation discrepancies and multivariate Isolation Forest outliers with persistent faculty review feedback.
- **Hosting Readiness & Containerization (Phase 10)**: Multi-stage Docker packaging, `/livez` and `/readyz` orchestration probes, dev/prod config separation, upload zip-bomb and path-traversal hardening.

---

## 📁 Repository Architecture

```text
eduquery-v3/
├── app/
│   ├── config.py              # Environment configuration & dev/prod separation
│   ├── main.py                # FastAPI application entry point & factory (create_app)
│   ├── core/                  # Core domain, ingestion, database, and validation
│   │   ├── catalog.py         # Metadata introspection & entity discovery
│   │   ├── database.py        # DuckDB table schemas & bulk-load primitives
│   │   ├── data_quality.py    # Academic integrity validator & anomaly detector (Checks 1-10)
│   │   ├── ingest.py          # Multi-sheet layout-inducing Excel ingestion & elective detector
│   │   └── models.py          # Strongly typed domain dataclasses
│   ├── reports/               # Analytical services
│   │   ├── student_breakdown.py # Student-wise performance breakdown service
│   │   └── subject_failures.py  # Subject-wise failure listing service
│   ├── services/              # API application services
│   │   ├── anomaly_detection.py # Tier A/B/C anomaly detector & review store
│   │   ├── data_quality_service.py # Data quality audit service
│   │   ├── student_service.py   # Student roster & breakdown orchestration
│   │   └── subject_service.py   # Course catalog & failure report orchestration
│   ├── api/                   # REST API layer
│   │   ├── router.py          # Master /api/v1 router
│   │   ├── dependencies.py    # Request-scoped database dependencies (get_db)
│   │   ├── routes/            # Thin HTTP route handlers
│   │   │   ├── anomaly.py       # GET /api/v1/anomalies & POST /api/v1/anomalies/review
│   │   │   ├── data_quality.py  # GET /api/v1/data-quality route
│   │   │   ├── health.py        # GET /health, /livez, and /readyz probes
│   │   │   ├── students.py      # Student roster & breakdown routes
│   │   │   └── subjects.py      # Catalog & failure routes
│   │   └── schemas/           # Pydantic v2 request/response contracts
│   └── static/                # Static assets & production frontend bundle
├── frontend/                  # Phase 4-8: React 19 + TypeScript Faculty Dashboard
│   ├── src/
│   │   ├── api/               # Typed API client matching backend contracts
│   │   ├── components/        # Accessible tables, badges, modals, pagination, evidence drawers
│   │   ├── context/           # Session-only in-memory AdminKey & Health contexts
│   │   └── pages/             # Overview, Explore, Students, Failures, Subjects, Quality, Import
│   └── dist/                  # Optimized production bundle
├── data/                      # Local acceptance marksheets & persistent storage
│   ├── reviews/               # Dataset-scoped faculty review decisions ({dataset_id}_reviews.json)
│   ├── active_dataset.json    # Atomically swapped active dataset pointer
│   └── Result_anonymized.xlsx # Primary acceptance marksheet
├── docs/                      # Architecture & specification documents
│   ├── api-contract.md        # Full REST endpoint schemas & error envelopes
│   ├── architecture.md        # System architecture, concurrency & domain boundaries
│   ├── implementation-roadmap.md # Gated milestone implementation plan
│   └── phase10-workflow-and-hosting-audit.md # End-to-end workflow audit & hosting readiness
├── tests/                     # Automated test suites (243 backend tests)
│   ├── api/                   # FastAPI integration, security, & lifecycle tests
│   ├── unit/                  # Anomaly detection, classification & workbook unit tests
│   ├── test_acceptance_workbooks.py # Verified ground-truth tests across all 7 workbooks
│   ├── test_mdm_electives.py  # MDM elective mutual exclusivity & denominator tests
│   └── test_phase10_acceptance_workflow.py # 18-step synthetic end-to-end workflow test
├── Dockerfile                 # Multi-stage production container build (Node 20 + Python 3.11)
├── .dockerignore              # Production container build exclusions
├── .env.example               # Configuration template for dev and production
├── pytest.ini                 # Pytest runner configuration
├── requirements.txt           # Minimal, lightweight dependencies
└── README.md
```

---

## 🚀 Setup & Local Execution

### 1. Supported Python Environments
- **Supported Python Versions**: Python `3.11`, `3.12`, `3.13`, and `3.14` (verified on Python `3.14.2`).
- Operating Systems: Windows, macOS, Linux.

### 2. Environment Setup & Dependency Installation
Create and activate an isolated virtual environment:
```bash
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate
```

Install declared runtime dependencies:
```bash
pip install -r requirements.txt
```

Declared runtime dependencies:
- `duckdb>=1.0.0`
- `openpyxl>=3.1.2`
- `pandas>=2.2.0`
- `numpy>=1.26.0`
- `scikit-learn>=1.4.0`
- `pydantic>=2.6.0`
- `pydantic-settings>=2.2.0`
- `fastapi>=0.110.0`
- `uvicorn>=0.28.0`
- `httpx>=0.27.0`
- `pytest>=8.0.0`

### 3. Database & Runtime Configuration
EduQuery V3 uses DuckDB for ultra-fast in-process SQL execution. Configuration is managed via environment variables (with defaults):

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `EDUQUERY_DB_PATH` | `data/eduquery.duckdb` | Path to persistent DuckDB database file, or `:memory:` |
| `EDUQUERY_ENV` | `development` | Runtime environment (`development`, `testing`, `production`) |
| `EDUQUERY_CORS_ORIGINS` | `["*"]` | Allowed CORS origins (JSON array or comma-delimited) |
| `EDUQUERY_IMPORT_API_KEY` | `None` | Administrative API key required for workbook upload and activation |
| `EDUQUERY_MAX_UPLOAD_SIZE_BYTES` | `26214400` | Maximum upload size bound in bytes (default 25 MiB) |
| `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` | `3600` | Expiration lifetime for preview sessions in seconds (default 1 hour) |
| `EDUQUERY_DATA_DIR` | `data` | Base directory for datasets, pointer file, reviews, and import staging |

### 4. Start the API Locally
Start the FastAPI application using Uvicorn:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Or run via Python module:
```bash
python -m uvicorn app.main:app --reload
```

### 5. Health Probes Verification
Inspect application availability using standard and container orchestration probes:
```bash
# Standard application health & database statistics
curl -s http://127.0.0.1:8000/health

# Container liveness probe (HTTP 200 OK if process is responsive)
curl -s http://127.0.0.1:8000/livez

# Container readiness probe (HTTP 200 OK if active DuckDB is queryable, HTTP 503 if unready)
curl -s http://127.0.0.1:8000/readyz
```

Expected response from `/health` when database is connected:
```json
{
  "status": "healthy",
  "version": "3.0.0",
  "database": {
    "mode": "read_only_file",
    "connected": true,
    "students_count": 145,
    "courses_count": 27
  }
}
```

### 6. Available Endpoints

| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | No | Application status and connected database record counts |
| `GET` | `/livez` | No | Container orchestration liveness probe |
| `GET` | `/readyz` | No | Container orchestration readiness probe (validates database queryability) |
| `GET` | `/api/v1/students` | No | Paginated student roster (`limit`, `offset`, `query`, `division`, `result`) |
| `GET` | `/api/v1/students/{identifier}/breakdown` | No | Student subject breakdown, component marks, provenance & reconciliation |
| `GET` | `/api/v1/subjects` | No | Course catalog with component structures, elective tags, and enrolled headcounts |
| `GET` | `/api/v1/subjects/failure-summary` | No | Curriculum-wide subject failure rates sorted descending |
| `GET` | `/api/v1/subjects/{course_code}/failures` | No | Subject failure roster with failing students and enrolled denominator |
| `GET` | `/api/v1/data-quality` | No | Marksheet data-quality findings (Checks 1-10) and integrity score |
| `GET` | `/api/v1/anomalies` | No | Calculation discrepancies & Isolation Forest outliers (`include_statistical=false` default) |
| `POST` | `/api/v1/anomalies/review` | No | Record faculty review feedback/dismissal (stored persistently per dataset) |
| `POST` | `/api/v1/imports/preview` | **Admin Key** | Upload workbook, stage candidate DuckDB, return preview with elective groups |
| `POST` | `/api/v1/imports/confirm` | **Admin Key** | Confirm preview session and atomically activate candidate dataset |
| `GET` | `/api/v1/imports/{import_id}` | **Admin Key** | Inspect status and metadata of an import session |

---

## 🏛️ MDM Elective Semantics & Data Integrity (Phase 10)

In university marksheet structures like Mumbai University, students choose **1 of $N$ electives** (e.g. 1 out of 4 Multidisciplinary Minor courses: `MDMBD02`, `MDMBI02`, `MDMIE02`, `MDMRB02`).

EduQuery V3 enforces strict elective semantics:
1. **Mutually Exclusive Selection**:
   - Students are enrolled in exactly one elective course within an elective group.
   - In `Result_anonymized.xlsx`, enrollments partition perfectly without overlap:
     - `MDMBD02` (Big Data): **63** students
     - `MDMBI02` (Business Intelligence): **9** students
     - `MDMIE02` (Industrial Engineering): **41** students
     - `MDMRB02` (Robotics): **32** students
     - Total: **145 students** (100% of cohort accounted for, exactly 1 per student).
2. **Zero Phantom Records**:
   - Unselected elective alternatives generate **0 rows** in the `scores` table.
   - Unenrolled electives produce no phantom passing or failing grades, and no misleading reconciliation alerts.
3. **Accurate Enrolled Denominators**:
   - Course catalogs and failure summary reports use `enrolled_count` as the denominator, never the entire class cohort.
   - Example: A failure in `MDMBI02` calculates against 9 enrolled students, not 145.
4. **Automated Academic Integrity Checks**:
   - **Check 9 (`ambiguous_elective_selection` & `unassigned_elective`)**: Flags students with multiple marks recorded across competing electives, or students with zero elective selection.
   - **Check 10 (`elective_selection_score_conflict`)**: Flags discrepancies where student metadata declares an elective choice conflicting with recorded marksheet rows.
5. **Import Disclosures**:
   - The Stage 1 upload preview surfaces detected elective groups, option lists, and detected enrollment counts before faculty confirm activation.

---

## 🔍 Noise-Reduced Faculty Anomaly Insights (Phase 10)

EduQuery V3 provides a multi-tiered anomaly detection architecture designed to maximize faculty trust and eliminate alert fatigue:

- **Default Clean View (`include_statistical=False`)**:
  - Focuses strictly on actionable, verifiable issues:
    - **Tier A (Deterministic Calculation Discrepancies)**: Component sums that do not reconcile with official printed totals, boundary violations, or invalid grades.
    - **Tier C (Multivariate Isolation Forest)**: Non-linear multivariate outliers (e.g., student excelling across all theoretical subjects but displaying catastrophic marks in a single practical course).
  - Drops default findings from 52 noisy alerts down to **12 high-precision findings**.
- **Internal / Benchmark Reproducibility (`include_statistical=True`)**:
  - Preserves Tier B Median Absolute Deviation (MAD) robust Z-score evaluation for analytical auditing and synthetic benchmark verification without polluting default faculty screens.
- **Persistent Faculty Review Loop**:
  - Faculty can mark findings as `reviewed`, add notes, or dismiss candidates.
  - Reviews are persisted per-dataset in `data/reviews/{dataset_id}_reviews.json` using atomic temporary file writes (`.tmp` + `os.replace`) ensuring complete crash resilience.

---

## 🐳 Hosting Readiness & Production Deployment (Phase 10)

EduQuery V3 is packaged as a lightweight, production-ready container image:

### 1. Build Production Container
```bash
docker build -t eduquery-v3:latest .
```

### 2. Run with Persistent Data Storage
```bash
docker run -d \
  --name eduquery-app \
  -p 8000:8000 \
  -e EDUQUERY_ENV=production \
  -e EDUQUERY_IMPORT_API_KEY="your-secure-admin-token" \
  -e EDUQUERY_CORS_ORIGINS='["https://eduquery.yourinstitution.edu"]' \
  -v eduquery_data:/app/data \
  eduquery-v3:latest
```

### 3. Production Architecture Highlights
- **Multi-Stage Build**: Node 20 compiles the React frontend to static assets (`dist/`), which are then served directly by the optimized Python 3.11 slim runtime via FastAPI.
- **Persistent Volumes**: DuckDB database files, the active dataset pointer (`data/active_dataset.json`), and faculty review decisions (`data/reviews/`) persist inside `/app/data`.
- **Upload Hardening**:
  - Max upload size enforced at HTTP gateway (`25 MiB`).
  - Zip-bomb defense: Inspects uncompressed openpyxl XML structures and enforces uncompressed size ratios (`MAX_UNCOMPRESSED_BYTES = 100 MiB`).
  - Path traversal protection: File uploads sanitized with `secure_filename`.
- **Kubernetes / Container Orchestration Ready**:
  - Liveness probe: `GET /livez`
  - Readiness probe: `GET /readyz`

---

## 🧪 Automated Test Suite

EduQuery V3 enforces 100% test pass rates across both backend and frontend layers:

### Backend Test Suite (Pytest)
```bash
pytest
```
*Pass Rate: **243/243 passed** in ~100s (100% pass rate).*
- `tests/test_acceptance_workbooks.py`: Verified ground-truth across all 7 real-world and synthetic workbooks.
- `tests/test_mdm_electives.py`: 6 tests verifying mutually exclusive electives, denominators, and Checks 9 & 10.
- `tests/test_phase10_acceptance_workflow.py`: Comprehensive 18-step end-to-end acceptance test covering upload security, preview, activation, health probes, faculty overview, elective denominators, student breakdown with provenance, anomaly detection, review persistence, and crash recovery.
- `tests/api/`: Integration tests for concurrency, security, lifecycle, and route handlers.
- `tests/unit/`: Unit tests for anomaly detection, classification rules, and formula parsing.

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm run test
```
*Pass Rate: **50/50 passed** across 11 test suites.*

### Frontend TypeScript Check
```bash
cd frontend
node ./node_modules/typescript/bin/tsc -b
```
*Result: **0 errors**.*

---

## 📊 Verified Ground Truth Across Acceptance Workbooks

| Workbook | Domain / Format | Sheets Accepted | Students | Courses | Scores | Key Invariant Verified |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `Result_anonymized.xlsx` | Mumbai University 3-tier merged | `Sheet1` | **145** | **27** | 13,775 | 132 PASSES, 13 FAILS; Div A: 85, Div B: 60; MDM Electives mutually exclusive (63+9+41+32=145) |
| `test1_commerce_same_layout.xlsx` | Commerce 3-division | `Sheet1` | **60** | **10** | 2,280 | Div A, B, C; Unrecorded overall totals guarded |
| `test1_same_layout_10courses_3divs.xlsx` | Standard 3-division | `Sheet1` | **60** | **10** | 2,280 | Div A, B, C |
| `test2_lifesci_vague_single_row.xlsx` | Life Sciences single-row | `Results Oct` | **45** | **7** | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2; `ABS` flag handled |
| `test2_vague_single_row_batches.xlsx` | Single-row synthetic | `Results Oct` | **45** | **7** | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2 |
| `test3_arts_messy_sheet_per_division.xlsx` | Multi-sheet Arts per-division | `Div A`, `Div B` | **50** | **8** | 1,500 | Both sheets accepted; Div A: 25, Div B: 25 |
| `test3_messy_sheet_per_division.xlsx` | Multi-sheet Engineering per-division | `Div A`, `Div B` | **50** | **8** | 1,500 | Both sheets accepted; Div A: 25, Div B: 25 |
| **Total** | — | — | **455** | — | **23,765** | **100% Verified With Zero Silent Data Loss** |
