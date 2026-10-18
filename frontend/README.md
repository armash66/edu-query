# EduQuery V3 — Faculty Dashboard (Phase 4)

The faculty-facing web application for EduQuery V3, providing college faculty with an intuitive, deterministic dashboard to inspect student marks rosters, curriculum-wide subject failure rates, data quality audits, and safe marksheet imports.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js >= 18 (Tested on Node v24.14.0)
- **Framework**: React 19 + TypeScript (Strict typing enabled with `verbatimModuleSyntax`)
- **Build Tool**: Vite 8 with HMR and fast production bundling
- **Routing**: React Router 7 (`react-router-dom`)
- **Icons**: Lucide React
- **Styling**: Native CSS tokens and components (Academic university administration design system)
- **Testing**: Vitest + React Testing Library + `@testing-library/jest-dom`

---

## 🚀 Quick Start

### 1. Prerequisites & Installation

Ensure you are in the `frontend/` directory:

```bash
cd frontend
npm install
```

### 2. Start the FastAPI Backend

In a separate terminal, launch the EduQuery V3 backend:

```bash
# In eduquery-v3 root directory
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

Optionally set your administrative import key if you plan to upload and activate marksheets:

```bash
# Windows PowerShell
$env:EDUQUERY_IMPORT_API_KEY = "your-admin-secret-key"
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

### 3. Start the Frontend Development Server

```bash
npm run dev
```

The application will be accessible at:
👉 **`http://localhost:5173`**

---

## ⚙️ Configuration & Environment Variables

| Variable | Default (Local Dev) | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `""` (Empty string) | API root URL. When empty, Vite dev server automatically proxies `/api` and `/health` requests to `http://127.0.0.1:8000`. Set explicitly if connecting to an external or remote API host (e.g. `http://api.eduquery.internal:8000`). |

> [!CAUTION]
> **Security Boundary**: Never put administrative keys or credentials into `VITE_*` environment variables or `.env` files. Vite embeds all `VITE_*` variables directly into client-side JavaScript bundles.

---

## 🔑 Administrative Import Key Workflow

EduQuery V3 workbook imports and dataset activations are protected by an administrative key:

1. **In-Memory Storage**: The administrative import key is collected through the UI dialog and held **strictly in memory** for the current browser session.
2. **Zero Client Persistence**: The key is **never** written to `localStorage`, `sessionStorage`, cookies, browser history, or console logs.
3. **Targeted Delivery**: The key is sent exclusively to workbook preview (`POST /api/v1/imports/preview`), confirmation (`POST /api/v1/imports/confirm`), and import status endpoints via the `X-EduQuery-Import-Key` header.
4. **Session Clearing**: Faculty can click the key indicator in the top navigation bar to clear the key from memory at any time.

---

## 🧪 Running Tests & Build Validation

### Run Frontend Unit & Component Tests
```bash
npm run test
```
*Current test suite: **34/34 passing** across 9 test files.*

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

## 🧭 Application Modules & Route Map

| Route | Page | Purpose |
| :--- | :--- | :--- |
| `/` | `OverviewPage` | Live backend health, enrolled student headcount, course count, data quality rating, and quick workflows. |
| `/students` | `StudentsPage` | Student marks roster with debounced search, division filter, outcome filter, and pagination. |
| `/students/:identifier` | `StudentDetailPage` | Comprehensive student breakdown: component marks, computed component sums vs. printed totals, total match verification, and HTTP 409 ambiguous query candidate resolution dialog. |
| `/failures` | `SubjectFailuresPage` | Curriculum-wide failure analysis: sortable table of failure counts, enrolled denominators, and exact backend failure rates. |
| `/subjects/:courseCode/failures` | `SubjectDetailPage` | Subject failure roster: confirmed failing students, component mark breakdowns, and clean zero-failures view. |
| `/subjects` | `SubjectsCatalogPage` | Course catalog with modality (theory/practical) and division filtering. |
| `/data-quality` | `DataQualityPage` | Marksheet structural audit: integrity score, severity filters, problem descriptions, impact explanations, and recommended actions. |
| `/imports` | `ImportPage` | Marksheet workbook upload (.xlsx), client-side 25MB precheck, safe candidate preview without PII, blocking error guards, and explicit activation confirmation. |

---

## ⚠️ Troubleshooting & Common Connection Errors

1. **`Cannot connect to EduQuery backend at local server` (`NETWORK_ERROR`)**:
   - Ensure the FastAPI server is running (`http://127.0.0.1:8000`).
   - Check if `/health` responds: open `http://127.0.0.1:8000/health` in your browser.
   - If using a custom port, update `vite.config.ts` proxy or set `VITE_API_BASE_URL`.

2. **`HTTP 503 DATABASE_UNAVAILABLE` on student or subject queries**:
   - The database has not had a marksheet activated yet.
   - Navigate to `/imports`, set your admin key, upload your Excel marksheet, preview it, and activate the dataset.

3. **`HTTP 401 UNAUTHORIZED` during Marksheet Upload or Activation**:
   - The admin key provided does not match the server's configured `EDUQUERY_IMPORT_API_KEY`.
   - Click "Set Admin Key" in the top bar to update the session key.

4. **`HTTP 503 IMPORT_DISABLED`**:
   - The backend server was started without `EDUQUERY_IMPORT_API_KEY` defined in the environment.
   - Restart FastAPI with `$env:EDUQUERY_IMPORT_API_KEY="your-key"`.
