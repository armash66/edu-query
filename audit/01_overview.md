# EduQuery Project Audit: 01 - Executive Overview

## 1. Project Purpose & Summary (Plain Language)

**EduQuery** is an academic marksheet ingestion, verification, data quality auditing, and faculty analytics platform. Designed specifically for higher education institutions (such as colleges affiliated with Mumbai University and autonomous engineering faculties), EduQuery addresses the critical operational challenge of processing complex, heterogeneous, and unstandardized academic results stored in legacy spreadsheet formats.

In typical institutional operations, semester marks are tabulated in dense Microsoft Excel (`.xlsx`) workbooks featuring non-standard structures:
- **Multi-row / Paired-row student layouts:** A single student's record often spans two stacked rows where Row 1 holds candidate metadata (seat number, roll number, name) and course component marks (Internal Assessment, Mid-Semester, Term Work, Practical, Oral, Theory), while Row 2 holds overall credits earned, course grades, credit points, grade points ($C \times G$), and semester status.
- **Elective Subject Variations:** Students in different divisions or batches take different elective courses (e.g., Multidisciplinary Minors / MDM electives), meaning subjects are sparse or column-aligned inconsistently.
- **Marker / Assessment Ambiguities:** Absence indicators (`AB`, `ABS`), exemptions (`EX`), copy cases (`CC`), zero marks, and uncalculated formula cells appear in heterogeneous conventions.
- **Arithmetic & Grading Discrepancies:** Discrepancies between printed totals in administrative records and actual component summations ($IA + ESE \neq Total$) lead to erroneous grade cards and student disputes.

EduQuery solves this by providing:
1. **Automated Layout Induction & Ingestion Engine:** Automatically discovers table structures, header boundaries, and paired-row student records without requiring brittle hard-coded cell coordinates.
2. **Deterministic Data Integrity & Reconciliation:** Computes exact arithmetic reconciliations ($IA + TW + Oral + Theory$) against printed totals, tracks enrolled versus unenrolled courses, and flags mismatches.
3. **Multi-Tiered Anomaly Detection:** Applies deterministic boundary checks, robust statistical distributions (Median Absolute Deviation / MAD), and multivariate Isolation Forest models to isolate anomalous performance spikes, intra-student collapses, and potential transcription errors.
4. **Interactive Faculty Analytics & Investigation Workspace:** Provides curriculum failure analysis, division performance benchmarking, absent student audit rosters, single-student marksheet breakdowns, and an ad-hoc faceted investigation engine.
5. **Privacy-First Temporary Sessions:** Faculty can upload, preview, and audit semester marksheets in completely isolated, temporary sessions without persistent administrative database commitment or server-side credential leakage.

---

## 2. Technology Stack, Languages, Frameworks & Versions

The application is architected as a decoupled client-server system consisting of a Python FastAPI backend leveraging an in-process DuckDB columnar database and a TypeScript React Single Page Application (SPA).

### Backend Runtime & Dependencies
Derived verbatim from [requirements.txt](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/requirements.txt):

| Component / Library | Declared Version Constraint | Installed / Active Version | Purpose in Architecture |
| :--- | :--- | :--- | :--- |
| **Python** | `>=3.11` (Docker) | `3.14.2` (Local runtime) | Core backend programming language |
| **DuckDB** | `>=1.0.0` | `1.5.6` | In-process high-performance analytical columnar SQL database |
| **FastAPI** | `>=0.110.0` | `0.141.1` | Asynchronous REST API routing, OpenAPI schema generation, and request lifecycle |
| **Uvicorn** | `>=0.28.0` | `0.53.0` | High-performance ASGI HTTP production application server |
| **Pydantic** | `>=2.6.0` | `2.13.5` | Data validation, typed schemas, and serialization |
| **openpyxl** | `>=3.1.2` | `3.1.5` | Spreadsheet decoding, sheet discovery, cell value/formula reading |
| **pandas** | `>=2.2.0` | `2.2.3` | Matrix manipulation and tabular data structuring |
| **numpy** | `>=1.26.0` | `2.2.3` | Numerical array computations, vector operations, statistical distributions |
| **scikit-learn** | `>=1.4.0` | `1.8.0` | Multivariate Isolation Forest unsupervised anomaly detection |
| **HTTPX** | `>=0.27.0` | `0.28.1` | Asynchronous HTTP client for health probes, testing, and gateway checks |
| **python-multipart** | `>=0.0.9` | `0.0.20` | Streaming multipart/form-data workbook uploads |
| **PyJWT** | `>=2.8.0` | `2.11.0` | JWT validation for Cloudflare Access / institutional gateway authentication |
| **cryptography** | `>=42.0.0` | `46.0.5` | Cryptographic primitives, key signature checks, and hash verifications |
| **pytest** | `>=8.0.0` | `9.0.2` | Automated test runner and assertion framework |

### Frontend Runtime & Dependencies
Derived verbatim from [frontend/package.json](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/package.json):

| Package Name | Declared Version | Purpose in UI Architecture |
| :--- | :--- | :--- |
| **React** | `^19.2.8` | Core UI component hierarchy and virtual DOM rendering |
| **React DOM** | `^19.2.8` | DOM mounting and browser integration |
| **React Router DOM** | `^7.18.4` | Client-side routing, navigation, and URL parameter management |
| **Lucide React** | `^1.59.0` | Unified vector icon library |
| **xlsx (SheetJS)** | `^0.18.5` | Client-side workbook generation for audit exports and rosters |
| **TypeScript** | `~6.0.2` | Static type safety and interface enforcement |
| **Vite** | `^8.3.0` (active: `8.3.4`) | High-speed ESM development server and Rollup production bundler |
| **Vitest** | `^5.0.5` | Vite-native unit and component test runner |
| **@testing-library/react**| `^16.3.3` | React component testing harness |
| **@testing-library/jest-dom** | `^7.0.1` | DOM expectation matchers for test assertions |
| **JSDOM** | `^29.1.1` | Headless browser DOM simulation environment for Vitest |
| **Oxlint** | `^1.81.0` | High-performance Rust-based linter |

---

## 3. Repository Folder Tree (Up to 3 Levels Deep)

```
eduquery-v3/
├── .dockerignore                     # Docker build exclusions
├── .env.example                      # Reference environment variable declarations
├── .gitignore                        # Git exclusion specifications
├── Dockerfile                        # Multi-stage production container build (Node.js + Python)
├── pytest.ini                        # Pytest configuration and test paths
├── README.md                         # Main repository documentation
├── render.yaml                       # Render Blueprint declaration (Web Service spec)
├── requirements.txt                  # Python production runtime dependencies
├── vercel.json                       # Vercel root deployment configuration
├── app/                              # Backend application package
│   ├── config.py                     # Centralized Pydantic application settings
│   ├── main.py                       # FastAPI application factory & lifespan management
│   ├── __init__.py
│   ├── api/                          # REST API layer
│   │   ├── dependencies.py           # Dependency injection (DB connection, Auth, Security)
│   │   ├── router.py                 # API v1 router mounting
│   │   ├── routes/                   # Endpoint controller modules
│   │   │   ├── analytics.py          # Overview, distributions, failure pattern routes
│   │   │   ├── anomaly.py            # Anomaly listing and faculty review routes
│   │   │   ├── data_quality.py       # Data quality audit findings routes
│   │   │   ├── health.py             # Health check and livez probes
│   │   │   ├── imports.py            # Administrative import lifecycle & rollbacks
│   │   │   ├── investigation.py      # Faceted query engine routes
│   │   │   ├── session.py            # Privacy-first temporary analysis session routes
│   │   │   ├── students.py           # Student roster and marksheet breakdown routes
│   │   │   └── subjects.py           # Subject catalog, failure rates, student rosters
│   │   └── schemas/                  # Pydantic request/response data contracts
│   ├── core/                         # Ingestion, catalog, database lifecycle
│   │   ├── catalog.py                # Curriculum course classification & resolution
│   │   ├── database.py               # DuckDB connection lifecycle, locks, schema creation
│   │   ├── data_quality.py           # Automated data quality checks
│   │   ├── gateway_auth.py           # Cloudflare Access JWT validation
│   │   ├── ingest.py                 # Excel layout induction, paired-row parsing, DB writer
│   │   └── models.py                 # Core domain entity dataclasses
│   ├── reports/                      # Core analytical aggregators
│   │   ├── student_breakdown.py      # Individual student score reconciliation & marksheet
│   │   └── subject_failures.py       # Classwide & division course pass/fail calculations
│   └── services/                     # Business logic and coordination services
│       ├── analytics_service.py      # KPI metrics, outcome ratios, division benchmarking
│       ├── anomaly_detection.py      # Anomaly pipeline (Deterministic, MAD, Isolation Forest)
│       ├── data_quality_service.py   # Quality finding aggregation
│       ├── export_service.py         # CSV & Excel roster export generator
│       ├── import_manager.py         # Administrative dataset promotion & rollback
│       ├── investigation_service.py  # Structured predicate query execution
│       ├── session_manager.py        # Temporary session sandbox isolation
│       ├── student_service.py        # Student lookup and search service
│       └── subject_service.py        # Curriculum metrics and student rosters
├── data/                             # Data directory for databases and sample workbooks
│   ├── active_analysis.duckdb        # Temporary analysis database
│   ├── active_dataset.json           # Active dataset atomic pointer
│   ├── eduquery.duckdb               # Primary persistent DuckDB database
│   ├── Result_anonymized.xlsx        # Primary anonymized benchmark marksheet
│   ├── datasets/                     # Versioned persistent DuckDB database files
│   ├── imports/                      # Staged upload workbooks
│   ├── reviews/                      # Persisted faculty anomaly review decisions
│   └── sessions/                     # Isolated temporary faculty sessions
├── docs/                             # Engineering architecture, security & audit reports
│   ├── api-contract.md               # API route definitions and contract specs
│   ├── architecture.md               # System architecture and data flow documentation
│   ├── data-handling.md              # Ingestion rules and classification criteria
│   ├── deployment.md                 # Deployment, Docker, and hosting guides
│   ├── development.md                # Local setup instructions
│   ├── implementation-roadmap.md     # Engineering phases roadmap
│   ├── investigation-engine.md       # Ad-hoc query engine specification
│   ├── security.md                   # Security boundaries and access policies
│   ├── testing.md                    # Test execution and coverage guidelines
│   └── phase*-report.md              # Phase-by-phase implementation and audit records
├── frontend/                         # Vite + React TypeScript Single Page Application
│   ├── index.html                    # HTML document entrypoint
│   ├── package.json                  # Frontend dependencies and npm scripts
│   ├── vercel.json                   # Vercel SPA routing rewrite specification
│   ├── vite.config.ts                # Vite dev server, build, and test configuration
│   ├── public/                       # Static public assets (favicons, SVG icons)
│   └── src/                          # TypeScript source code
│       ├── App.css                   # Layout and utility CSS rules
│       ├── App.tsx                   # Client-side router hierarchy & route definitions
│       ├── index.css                 # Master theme design tokens, global & print CSS
│       ├── main.tsx                  # React DOM rendering entrypoint
│       ├── api/                      # API client, types, and error handling
│       ├── components/               # Reusable UI components & chart widgets
│       ├── context/                  # React contexts (HealthContext, SessionContext, AdminKeyContext)
│       ├── pages/                    # Route-level view components
│       └── utils/                    # Client-side helpers (e.g. SheetJS Excel export)
├── scripts/                          # Evaluation and benchmarking scripts
│   └── evaluate_anomaly_detection.py # Anomaly detection benchmark script
└── tests/                            # Automated test suite (288 tests)
    ├── api/                          # REST API integration tests
    └── unit/                         # Core ingestion and unit algorithm tests
```

---

## 4. How to Run Locally and Deployment Architecture

### Running Locally

Running EduQuery locally requires two concurrent processes: the FastAPI backend and the Vite frontend dev server.

#### Step 1: Environment Setup & Backend Launch
```powershell
# In the repository root:
# 1. Ensure Python dependencies are installed
pip install -r requirements.txt

# 2. Launch FastAPI with Uvicorn
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend initializes on `http://127.0.0.1:8000`. It automatically recovers the active dataset from `data/active_dataset.json` (pointing to `data/eduquery.duckdb`). Health status can be verified at `http://127.0.0.1:8000/livez` and `http://127.0.0.1:8000/health`.

#### Step 2: Frontend Launch
```powershell
# In a second terminal, navigate to the frontend directory:
cd frontend

# 1. Install Node dependencies
npm install

# 2. Launch Vite development server
npm run dev
```
The frontend starts on `http://localhost:5173/`. 
In development mode, `frontend/vite.config.ts` automatically proxies `/api` and `/health` requests to `http://127.0.0.1:8000`, eliminating any CORS issues during local development.

---

### Production Deployment Architecture

EduQuery uses a decoupled cloud deployment:

```
+--------------------------------------------------------------------------+
|                            USER BROWSER                                  |
+--------------------------------------------------------------------------+
      |                                              |
      | 1. Static HTML/CSS/JS (SPA)                  | 2. REST API /session/upload
      v                                              v    and analytical queries
+--------------------------------+       +---------------------------------+
|      VERCEL EDGE NETWORK       |       |          RENDER CLOUD           |
| (https://edu-query-hazel.      |       | (https://edu-query.onrender.com)|
|  vercel.app)                   |       +---------------------------------+
+--------------------------------+       | Docker Container:               |
| Static Vite Build Output:      |       | - Python 3.11 Runtime           |
| - index.html                   |       | - Uvicorn ASGI Server           |
| - assets/index-[hash].js       |       | - FastAPI App                   |
| - assets/index-[hash].css      |       | - Embedded DuckDB Engine        |
| - vercel.json SPA rewrites     |       | - Ephemeral /tmp sessions       |
+--------------------------------+       +---------------------------------+
```

1. **Frontend on Vercel (`https://edu-query-hazel.vercel.app`):**
   - Configured via root [vercel.json](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/vercel.json) and [frontend/vercel.json](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/vercel.json).
   - Build Command: `cd frontend && npm install && npm run build` (outputs to `frontend/dist`).
   - Clean URLs and client-side rewrites route all paths (`/(.*)`) to `/index.html`.
   - The frontend runtime connects to the backend API via `VITE_API_BASE_URL=https://edu-query.onrender.com`.

2. **Backend API on Render (`https://edu-query.onrender.com`):**
   - Configured via [render.yaml](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/render.yaml) and [Dockerfile](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/Dockerfile).
   - Built as a multi-stage Docker container running Python 3.11-slim with Uvicorn on port 8000 (`uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2`).
   - CORS is configured to allow `https://.*\.vercel\.app` origins.
   - Live health probe endpoint is exposed at `/livez`.

