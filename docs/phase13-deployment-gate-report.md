# EduQuery — Phase 13 Deployment Gate Report: Excel Upload Workflow Resolution, Security Audit & Hosting Verification

**Evaluation Date**: 2026-10-18  
**Repository**: `EduQuery`  
**Overall Deployment Verdict**: `READY FOR CONTROLLED DEMO`  
*(Not Ready for Public Deployment until Cloudflare Access / Institutional SSO is configured)*

---

## Executive Summary & Gate Status Matrix

This report provides the complete release candidate audit, defect diagnosis, route authorization verification, storage lifecycle analysis, and deployment readiness assessment for EduQuery.

| Verification Boundary | Gate Status | Detail |
| :--- | :--- | :--- |
| **1. Local Verification** | **VERIFIED & PASSING** | Priority 0 Excel upload defect resolved. 57 frontend tests passing (100%), 260 backend tests passing (100%), TypeScript check clean (0 errors), production build passing. Full user journey (upload -> preview -> confirm -> overview -> delete) verified. |
| **2. Container Verification** | **STATIC CONFIG VALIDATED / RUNTIME UNEXECUTED** | Multi-stage non-root Dockerfile and `.dockerignore` audited and updated for dynamic port binding `${PORT:-8000}`. Local container execution could not be run because the Windows host Docker daemon service (`com.docker.service`) was stopped and requires elevated administrator privileges to launch. |
| **3. Render & Cloudflare Access** | **CONFIGURATION PREPARED / PUBLIC DEPLOYMENT BLOCKED** | Infrastructure blueprint `render.yaml` created with real configuration. Cloudflare Access Zero Trust integration architecture specified. Public deployment is strictly BLOCKED until real institutional Identity Provider (IdP) credentials and faculty email policies are configured. No fake credentials or placeholder email allowlists were invented. |

---

## 1. Priority 0 Excel Upload Fix Verification

The defect where selecting or uploading an Excel workbook appeared to do nothing has been diagnosed and permanently resolved across 8 interconnected failure points:

1. **Process Routing**: Eliminated orphaned background Uvicorn daemon serving stale router table; re-launched with active reload.
2. **React Component Lifecycle**: Removed global `loading` unmounting guard in [App.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/App.tsx) and [SessionContext.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/context/SessionContext.tsx) that caused `<UploadPage />` to vanish in-flight and remount blank on error.
3. **File Input Reset**: Added `e.target.value = ''` in [UploadPage.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/pages/UploadPage.tsx) so re-selecting the exact same workbook reliably fires `onChange`.
4. **CORS Credential Alignment**: Changed fallback `cors_origins` in [app/config.py](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/app/config.py) from `["*"]` to explicit local ports (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:8000`, `http://127.0.0.1:8000`), resolving browser credential rejection.
5. **Multipart Boundary Preservation**: Explicitly stripped default `Content-Type: application/json` in [client.ts](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/api/client.ts) when `body instanceof FormData`, enabling standard multipart boundary calculation.
6. **Session Inactive Classification**: Fixed `check_session_status` in [app/api/routes/session.py](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/app/api/routes/session.py) to check `active_dataset.json` rather than raw database existence, ensuring fresh visitors receive `active: false, mode: null`.
7. **Preview Layout Compatibility**: Added `sheets` and `format_notes` aliases in [session_manager.py](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/app/services/session_manager.py) and safe property fallbacks in [UploadPage.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/pages/UploadPage.tsx), preventing `Cannot read properties of undefined (reading 'join')` exceptions.
8. **Actionable Validation Display**: Surfaced blocking data quality errors in a dedicated warning banner in [UploadPage.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/frontend/src/pages/UploadPage.tsx) and disabled the confirm button with descriptive tooltips when `can_confirm === false`.

---

## 2. API Route Authentication & Authorization Audit

All application endpoints under `/api/v1` were audited for access control, parameter validation, and session isolation:

| Route Path | HTTP Method | Protection / Dependency | Session Isolation & Behavior |
| :--- | :--- | :--- | :--- |
| `/api/v1/session/upload` | `POST` | Open to Faculty / In-flight guard | Generates cryptographically secure session ID (`token_urlsafe(24)`). Sets `HttpOnly; SameSite=Lax` cookie and `X-EduQuery-Session-Token` header. Streams into isolated directory `data/sessions/{id}/`. |
| `/api/v1/session/status` | `GET` | Cookie or Token Header | Validates token regex `^[a-zA-Z0-9_\-]{16,64}$`. Returns session status or `active: false, mode: null`. |
| `/api/v1/session/confirm` | `POST` | Cookie or Token Header | Validates preview state and enforces `can_confirm`. Rejects with 409 if blocking errors exist. Transitions session state to `active`. |
| `/api/v1/session` | `DELETE` | Cookie or Token Header | Completely removes `data/sessions/{id}/` from disk, purges review cache, and deletes cookie. Idempotent (returns 200 even if already deleted). |
| `/api/v1/session/save` | `POST` | Cookie or Token Header | Explicit opt-in only. Promotes temporary session to persistent storage `data/datasets/` and updates institutional pointer. |
| `/api/v1/students` | `GET` | `Depends(get_db)` | Scoped to active session DuckDB or active institutional dataset. Returns 503 if no session or database initialized. |
| `/api/v1/students/export` | `GET` | `Depends(get_db)` | Scoped to active session. Streams CSV directly in memory (`io.StringIO`). Anti-formula injection enabled. |
| `/api/v1/students/{id}/breakdown` | `GET` | `Depends(get_db)` | Scoped to active session. Reconciles raw components to course total. Resolves name/ID/seat disambiguation (404/409). |
| `/api/v1/students/{id}/export` | `GET` | `Depends(get_db)` | Scoped to active session. Streams student breakdown CSV directly in memory. Zero disk writes. |
| `/api/v1/subjects` | `GET` | `Depends(get_db)` | Scoped to active session. Lists courses with student enrollment headcounts. |
| `/api/v1/subjects/failure-summary`| `GET` | `Depends(get_db)` | Scoped to active session. Sorts courses by verified failure rate descending. |
| `/api/v1/subjects/{code}/failures`| `GET` | `Depends(get_db)` | Scoped to active session. Lists failing students for course with atomized component marks. |
| `/api/v1/subjects/{code}/failures/export` | `GET` | `Depends(get_db)` | Scoped to active session. Streams failure roster CSV directly in memory. |
| `/api/v1/analytics/overview` | `GET` | `Depends(get_db)` | Scoped to active session. Computes classwide pass rate, top failing courses, and data quality findings. |
| `/api/v1/analytics/division-comparison` | `GET` | `Depends(get_db)` | Scoped to active session. Compares pass/fail distributions across sections. |
| `/api/v1/analytics/failure-patterns` | `GET` | `Depends(get_db)` | Scoped to active session. Identifies multi-subject failure cohorts. |
| `/api/v1/analytics/distributions` | `GET` | `Depends(get_db)` | Scoped to active session. Generates score histograms. |
| `/api/v1/anomalies/summary` | `GET` | `Depends(get_db)` | Scoped to active session. Returns anomaly counts by method and review state. |
| `/api/v1/anomalies/findings` | `GET` | `Depends(get_db)` | Scoped to active session. Returns explainable anomaly items. |
| `/api/v1/anomalies/findings/{id}/review` | `POST` | `Depends(get_db)` | Scoped to active session. Saves moderation tags into `data/sessions/{id}/reviews.json`. |
| `/api/v1/anomalies/students/{id}/review` | `POST` | `Depends(get_db)` | Scoped to active session. Batches reviews for student into session-scoped file. |
| `/api/v1/investigation/capabilities` | `GET` | `Depends(get_db)` | Scoped to active session. Returns allowed fields and operators. |
| `/api/v1/investigation/query` | `POST` | `Depends(get_db)` | Scoped to active session. Executes parameterized query without string interpolation. |
| `/api/v1/investigation/export-csv` | `POST` | `Depends(get_db)` | Scoped to active session. Streams matching investigation cohort in memory. |
| `/api/v1/data-quality` | `GET` | `Depends(get_db)` | Scoped to active session. Returns data quality findings and health score. |
| `/api/v1/imports/*` | `ALL` | `verify_import_authorization` | Administrative only. Requires `EDUQUERY_IMPORT_API_KEY`. Disabled (503) if key unconfigured; returns 401 if missing/invalid. |
| `/health`, `/livez`, `/readyz` | `GET` | Public / Operational Probes | Non-sensitive system health metrics (status, version, database connection state). |

---

## 3. Session Ownership, Isolation & Memory/Storage Protection

1. **Session Token Validation**:
   - Every session ID is validated against the strict regular expression `^[a-zA-Z0-9_\-]{16,64}$`. Any token failing this pattern triggers an immediate 400 Bad Request error, preventing path traversal attacks (e.g. `../../`).
2. **Cookie Security**:
   - `Set-Cookie: eduquery_session=...; HttpOnly; SameSite=Lax; Path=/`.
   - The `Secure` flag is enforced dynamically when running in production under HTTPS or behind an SSL-terminating reverse proxy (`X-Forwarded-Proto: https`).
3. **Workspace Segregation**:
   - Ephemeral session files are isolated under `data/sessions/{session_id}/`.
   - Ingested `.xlsx` files are deleted from disk immediately after parsing.
   - DuckDB session databases (`session.duckdb`) are opened in `read_only=True` mode for all analytical and report queries.
   - Cross-session access is blocked: each request strictly resolves its connection path from its own validated session token.
4. **Export Hygiene**:
   - CSV exports are generated entirely in memory via `io.StringIO()`. No export files are written to disk.
   - Cell values are sanitized against spreadsheet formula injection by prepending a single quote (`'`) to any untrusted string starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.
5. **PII and Log Hygiene**:
   - Zero student names, seat numbers, roll numbers, credentials, or raw marks are logged.
   - Application logs record only anonymous session IDs, HTTP methods, and structural record counts.

---

## 4. Deletion, Expiry & Process Restart Audit

1. **Explicit Deletion (`DELETE /api/v1/session`)**:
   - Executes `delete_temporary_session`: invokes Python garbage collection to release file locks, removes `data/sessions/{session_id}/` recursively via `shutil.rmtree`, purges in-memory review caches (`_REVIEWS_CACHE`), and clears client cookies. Verified idempotent.
2. **Inactivity Expiration**:
   - Sessions older than `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` (default: 3600 seconds) are automatically detected and pruned during upload requests and server startup.
   - Any query arriving with an expired token is rejected with `DatabaseUnavailableError("Your analysis session has expired due to inactivity. Please upload your marksheet again.")`.
3. **Server Restart Behavior**:
   - On process startup, the FastAPI lifespan event executes `cleanup_expired_sessions` to purge abandoned sessions.
   - Unexpired active sessions persist in their dedicated directories and remain queryable by their respective token holders.
   - If a permanent institutional dataset was activated, it is recovered from `data/active_dataset.json` only if the file points to a verified database within the authorized `data/datasets/` directory.
4. **Log & Infrastructure Scope Limitation**:
   - Application-level deletion guarantees that all server-side session files, DuckDB tables, and review notes are purged from the filesystem.
   - **Important Limitation**: Application-level deletion does **not** erase host OS system logs, reverse-proxy access logs (e.g., Render or Cloudflare request logs recording IP addresses and URLs), or external backups.

---

## 5. Containerization Audit

The multi-stage [Dockerfile](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/Dockerfile) was audited:
- **Build Stage**: Uses `node:20-alpine` to compile TypeScript and build the React 19 SPA via `npm ci && npm run build`.
- **Runtime Stage**: Uses `python:3.11-slim`, installs requirements, creates dedicated directories (`/app/data/datasets`, `/app/data/reviews`, `/app/data/sessions`), and creates non-root user `eduquery:eduquery` (UID 10001).
- **Dynamic Port Binding**: CMD and healthcheck configured with `sh -c` to bind to `${PORT:-8000}`, ensuring compatibility with Render and custom container orchestrators.
- **Local Container Execution Status**:
  - The Docker CLI (`version 29.2.1`) is installed on the host machine.
  - However, the local Windows service `com.docker.service` (Docker Desktop Engine) was in `Stopped` state.
  - Attempting to start the service from powershell exited with code 1 due to lack of administrative elevation.
  - Consequently, container runtime execution could not be performed on this local host and is recorded as **STATICALLY VALIDATED / RUNTIME UNEXECUTED LOCALLY**.

---

## 6. Render Configuration & Cloudflare Access Integration

### Render Blueprint Configuration
The infrastructure configuration [render.yaml](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/EduQuery/render.yaml) was created:
```yaml
services:
  - type: web
    name: EduQuery
    env: docker
    dockerfilePath: Dockerfile
    plan: starter
    region: oregon
    numInstances: 1
    healthCheckPath: /livez
    disk:
      name: eduquery-data
      mountPath: /app/data
      sizeGB: 10
    envVars:
      - key: EDUQUERY_ENV
        value: production
      - key: EDUQUERY_DATA_DIR
        value: /app/data
      - key: EDUQUERY_DATABASE_PATH
        value: /app/data/eduquery.duckdb
      - key: EDUQUERY_ACTIVE_POINTER_PATH
        value: /app/data/active_dataset.json
      - key: EDUQUERY_IMPORT_SESSION_TTL_SECONDS
        value: "3600"
      - key: EDUQUERY_MAX_UPLOAD_SIZE_BYTES
        value: "26214400"
      - key: EDUQUERY_LOG_LEVEL
        value: INFO
      - key: EDUQUERY_CORS_ORIGINS
        sync: false
      - key: EDUQUERY_IMPORT_API_KEY
        generateValue: true
```

### Cloudflare Access Zero Trust Integration
To protect student confidentiality and prevent unauthorized public access, public deployment must be fronted by Cloudflare Zero Trust:

1. **Reverse Proxy & Ingress Architecture**:
   - Public Internet traffic reaches the institutional custom domain (e.g. `eduquery.institution.edu`).
   - Cloudflare Access intercepts the connection and prompts the faculty member for authentication via their institutional Identity Provider (Google Workspace / Microsoft Entra ID).
   - Upon successful verification, Cloudflare injects identity headers (`Cf-Access-Authenticated-User-Email` and `Cf-Access-Jwt-Assertion`) and forwards the request to the origin service on Render.
2. **Public Deployment Blocker**:
   - Real institutional IdP credentials (Client ID, Client Secret, Directory Tenant ID) and verified institutional email domains are **not available** in this local repository.
   - In accordance with our security principles, no placeholder credentials or imaginary email allowlists were invented.
   - **Public deployment remains strictly BLOCKED** until the institution's IT administrator completes the following remaining manual steps:
     1. Deploy the Render service using `render.yaml`.
     2. Add a Custom Domain in Render pointing to the application.
     3. In the Cloudflare Zero Trust dashboard, create an Access Application for the custom domain.
     4. Configure the institutional Identity Provider (SAML 2.0 / OIDC / Google / Microsoft) and restrict access to authorized faculty email domains or user groups.
     5. Enable Cloudflare Access Service Token or JWT validation on origin ingress.

---

## 7. Verification Test Suite Summary

### Frontend Test Results (Vitest)
```
Command: npm test (in frontend/)
Result:  12 test files passed, 57 tests passed (0 failures)
Duration: 5.73s
```
All upload, disambiguation, pagination, overview, subject detail, student detail, investigation, and modal accessibility test suites passed cleanly.

### TypeScript Type-Checking
```
Command: node ./node_modules/typescript/bin/tsc -b (in frontend/)
Result:  Exit code 0 (0 errors)
```

### Frontend Production Build
```
Command: npm run build (in frontend/)
Result:  Vite production bundle built in 412ms
Output:  dist/index.html (0.45 kB), dist/assets/index-*.css (10.63 kB), dist/assets/index-*.js (431.13 kB)
```

### Backend Test Results (Pytest)
```
Command: python -m pytest tests/ -v
Result:  260 passed in 44.54s (0 failures)
```
All 260 tests passed, covering:
- Phase 12 session privacy, upload validation, concurrent isolation, and server erasure.
- Phase 11 static asset serving, security boundaries, and archive safety.
- Phase 10 end-to-end acceptance workflows and server restart recovery.
- MDM single-choice mutually exclusive elective invariants.
- Academic classification rules and deterministic total reconciliation.
- Isolation Forest anomaly detection and persistent faculty review stores.

---

## 8. Final Release Recommendation

**Verdict**: `READY FOR CONTROLLED DEMO`

- **Permitted Use**: Controlled demonstrations on `localhost` or secured private intranet networks. Faculty can upload marksheets, review detected layout structures, explore cohort analytics, inspect subject failures, flag explainable anomalies, and permanently delete their session and data.
- **Restricted Use**: **Public deployment is blocked** until the institution provisions Cloudflare Zero Trust authentication to enforce institutional single sign-on ahead of the application.
