# EduQuery V3 - Frontend Application

The faculty-facing web application for EduQuery V3 provides college faculty and departmental administrators with a dashboard for inspecting student marks rosters, curriculum-wide subject failure rates, data quality audits, and marksheet analysis workflows.

---

## Technology Stack

- Runtime: Node.js >= 18 (Verified on Node v24.14.0)
- Framework: React 19 + TypeScript (Strict typing enabled with `verbatimModuleSyntax`)
- Build Tool: Vite with HMR and production bundling
- Routing: React Router 7 (`react-router-dom`)
- Icons: Lucide React
- Styling: Native CSS design tokens and component stylesheets
- Testing: Vitest + React Testing Library + `@testing-library/jest-dom`

---

## Quick Start

### 1. Prerequisites and Installation

Navigate to the `frontend/` directory:

```bash
cd frontend
npm install
```

### 2. Start the FastAPI Backend

In a separate terminal, launch the EduQuery V3 backend from the repository root:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Start the Frontend Development Server

```bash
npm run dev
```

The application will be accessible at:
`http://localhost:5173`

---

## Configuration and Environment Variables

| Variable | Default (Local Dev) | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `""` (Empty string) | API root URL. When empty, Vite dev server automatically proxies `/api` and `/health` requests to `http://127.0.0.1:8000`. Set explicitly when connecting to an external or remote API host (e.g. `https://eduquery-api.onrender.com`). |

Security Notice: Never put administrative keys or credentials into `VITE_*` environment variables or `.env` files. Vite embeds all `VITE_*` variables directly into client-side JavaScript bundles.

---

## Privacy Modes and Upload Workflow

EduQuery V3 implements a privacy-first workflow on the `/upload` page:

1. **Temporary Analysis (Default, Zero Persistence)**:
   - Workbooks are uploaded and ingested into an isolated ephemeral DuckDB session in temporary server memory.
   - All server artifacts are deleted upon clicking "Delete Session & Clear Data" or when the idle TTL expires.
   - No permanent files are written to the persistent institutional database.

2. **Institutional Storage (Opt-In Only)**:
   - Faculty can explicitly choose to retain the dataset into institutional storage (`/app/data/datasets`).
   - Requires providing a dataset name before activation.

3. **Client-Side Blob Downloads**:
   - Roster and failure report CSV exports are requested via authenticated `fetch` calls and saved as client-side `Blob` objects.
   - Tokens are passed via request headers or single-use tickets, avoiding exposure in query strings.

---

## Running Tests and Validation

### Run Frontend Unit and Component Tests
```bash
npm run test
```
Current test baseline: **61/61 passing** across 12 test suites.

### Run TypeScript Strict Type Checks
```bash
node ./node_modules/typescript/bin/tsc -b
```

### Build Production Bundle
```bash
npm run build
```
Production assets are generated in `frontend/dist/`.

---

## Application Modules and Route Map

| Route | Page | Purpose |
| :--- | :--- | :--- |
| `/` | `OverviewPage` | Metric strip, actionable findings, division comparisons, and quick actions. |
| `/upload` | `UploadPage` | Privacy-first marksheet upload (.xlsx), detected cohort preview, data quality warnings, and privacy mode selection. |
| `/explore` | `ExplorePage` | Interactive investigation engine with quick presets, multi-condition filter builder, AND/OR logic, and search. |
| `/students` | `StudentsPage` | Student marks roster with search, division filter, outcome filter, pagination, and CSV export. |
| `/students/:identifier` | `StudentDetailPage` | Student breakdown: component marks, computed sums vs printed totals, total match verification, and disambiguation. |
| `/failures` | `SubjectFailuresPage` | Curriculum-wide failure analysis: sortable table of failure counts, enrolled denominators, and exact failure rates. |
| `/subjects/:courseCode/failures` | `SubjectDetailPage` | Subject failure roster with component mark breakdowns, enrolled students, and confirmed failures. |
| `/subjects` | `SubjectsCatalogPage` | Course catalog with modality (theory/practical) and division filtering. |
| `/data-quality` | `DataQualityPage` | Marksheet structural audit: integrity score, severity filters, problem descriptions, impact explanations, and actions. |
| `/imports` | `ImportPage` | Administrative dataset management, candidate staging, and dataset rollback interface. |

---

## Troubleshooting Common Issues

1. **Cannot connect to backend (`NETWORK_ERROR`)**:
   - Ensure the FastAPI server is running on `http://127.0.0.1:8000`.
   - Verify health probe response: `http://127.0.0.1:8000/livez`.
   - If using a custom port or remote host, set `VITE_API_BASE_URL` in `frontend/.env`.

2. **`HTTP 503 DATABASE_UNAVAILABLE` on student or subject queries**:
   - No active dataset is loaded in memory or institutional storage.
   - Navigate to `/upload` and upload an Excel marksheet to start an analysis session.

3. **CORS Error in Browser Console**:
   - Verify `EDUQUERY_CORS_ORIGINS` on the backend includes the frontend origin (e.g. `http://localhost:5173`).
