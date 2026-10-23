# EduQuery — Phase 11: Release Candidate Audit and Deployment Rehearsal Report

**Audit Date**: October 18, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Target Repository**: `c:\Users\Armash Ansari\OneDrive\Desktop\Projects\AI & ML\EduQuery`  
**Current Git Branch**: `main`  
**Base Commit**: `372ea95 feat(phase1): initial commit for EduQuery foundation, ingestion engine, data quality validator, and test suite`  

---

## 1. Executive Summary & Final Readiness Verdict

### Final Verdict: `READY WITH LIMITATIONS`
(Qualified as `READY FOR CONTROLLED DEMO` when deployed behind an institutional gateway/VPN with persistent volume storage).

EduQuery has achieved deterministic mathematical precision, full single-choice MDM elective semantics, high-precision noise-reduced anomaly detection, and production-ready SPA static asset serving.

| Evaluation Area | Status | Verified Finding / Limitation |
| :--- | :---: | :--- |
| **MDM Elective Invariants** | **VERIFIED** | 145 students partitioned with 100% mutual exclusivity (63+9+41+32=145). Zero phantom scores/grades. Denominators strictly count enrolled students. |
| **Production SPA Serving** | **VERIFIED** | FastAPI mounts `frontend/dist/assets` and provides full HTML fallback for nested SPA routes (`/students`, `/subjects`, etc.). |
| **Dataset Isolation & Review** | **VERIFIED** | Reviews are dataset-scoped (`{dataset_id}_reviews.json`). Switching datasets causes zero review leakage. Corrupt review files recover safely. |
| **Upload & Archive Hardening** | **VERIFIED** | Max upload size (25 MiB), zip-bomb uncompressed limit (100 MiB), entry count limit (1,000 files), and encrypted zip detection strictly enforced. |
| **Security Boundaries** | **LIMITED** | Import endpoints protected by admin key; however, academic read and review endpoints are unauthenticated and require an institutional gateway / reverse-proxy. |
| **Docker Container Daemon** | **LIMITED** | Multi-stage Dockerfile and `.dockerignore` hardened with non-root user (`eduquery`); however, local host Docker daemon was stopped and could not run without admin privileges. |
| **Automated Test Suites** | **100% PASS** | **251/251 Pytest backend tests passed**; **50/50 Vitest frontend tests passed**; **TypeScript: 0 errors**. |

---

## 2. Git State & Safety Audit

### Initial vs. Final Git State
- **Branch**: `main` (up to date with `origin/main`).
- **HEAD Commit**: `372ea95 feat(phase1): initial commit for EduQuery foundation...`.
- **Staged Files**: **0 files staged** across the entire lifecycle.
- **Untracked / Modified Files**: All working tree changes remain strictly in uncommitted local files in `EduQuery`.
- **Workspace Isolation**:
  - `c:\Users\Armash Ansari\OneDrive\Desktop\Projects\AI & ML\edu-query` (V1): **Clean working tree, untouched**.
  - `c:\Users\Armash Ansari\OneDrive\Desktop\Projects\AI & ML\eduquery-v2` (V2): **Clean working tree, untouched**.
- **Student Privacy & PII**: Zero student names, roll numbers, or marks leaked in commit logs, reports, or console streams.

---

## 3. Production Build & Container Architecture

### A. Frontend Production Bundle
Executed command: `npm run build` in `frontend/`:
- **TypeScript Compiler (`tsc -b`)**: 0 type errors.
- **Vite Production Bundler**:
  - `dist/index.html`: `0.45 kB` (gzip: `0.29 kB`)
  - `dist/assets/index-vQHlcLIW.css`: `10.63 kB` (gzip: `2.84 kB`)
  - `dist/assets/index-DPMDKH8r.js`: `430.40 kB` (gzip: `117.29 kB`)
  - Output duration: `727ms`.
- **Zero Secrets Embedded**: Code inspection of bundle verified no API keys, tokens, or environment secrets are baked into client JavaScript chunks.

### B. FastAPI Static Asset Serving & SPA Navigation (Fixed in Phase 11)
- **Defect Found**: FastAPI in `app/main.py` previously only registered API and health routers. In a standalone production build or container, visiting `/` or refreshing on client-side routes (`/students`, `/explore`, etc.) returned HTTP 404.
- **Fix Implemented**:
  1. Added `frontend_dist_dir` to `app/config.py` (defaults to `"frontend/dist"`).
  2. In `app/main.py`, mounted `/assets` via `StaticFiles(directory="frontend/dist/assets")`.
  3. Added catch-all route `@app.get("/{full_path:path}")` serving `frontend/dist/index.html` for all non-API paths, while preserving HTTP 404 for missing API routes (`/api/v1/*`).
  4. Verified in `test_production_spa_fallback_and_static_serving` (HTTP 200 on `/`, `/students`, `/subjects`, `/subjects/PCEC12T/failures`, `/explore`, `/quality`, `/import`, `/favicon.svg`).

### C. Container Packaging & Privilege Hardening (Dockerfile & .dockerignore)
- **Dockerfile Audit**:
  - **Stage 1 (Builder)**: `node:20-alpine` builds static frontend assets.
  - **Stage 2 (Runtime)**: `python:3.11-slim` installs minimal requirements from `requirements.txt`.
  - **Non-Root Execution**: Added dedicated system user `eduquery` (`uid: 10001`, `gid: 10001`). Application runs under `USER eduquery` with no root privileges.
  - **Data Leak Prevention**: Removed `COPY data/ ./data`. Development `.xlsx` workbooks and local `.duckdb` files are never copied into container layers.
- **.dockerignore Audit**:
  - Hardened to explicitly exclude `.env`, `.env.*`, `data/*.xlsx`, `data/*.duckdb`, `data/datasets/*`, `data/reviews/*`, `tests/`, and `docs/`.
- **Host Execution Limitation**:
  - `docker --version` reports Docker CLI v29.2.1.
  - Windows service `com.docker.service` (Docker Desktop Service) was stopped on the host. Starting Windows services requires elevated Administrator privileges not available in this user shell.
  - Therefore, container execution (`docker build` / `docker run`) could not be executed directly on the host. Production runtime was verified via isolated Python/ASGI environments.

---

## 4. Hosting Compatibility & Storage Architecture

### A. Persistent Storage Requirements
EduQuery requires persistent writable storage mounted to `/app/data` (or directory configured via `EDUQUERY_DATA_DIR`):

| File / Subdirectory | Purpose | Persistence Requirement |
| :--- | :--- | :--- |
| `/app/data/active_dataset.json` | Active dataset pointer file | **Mandatory**: Determines active database on container restart |
| `/app/data/datasets/*.duckdb` | Immutable versioned DuckDB databases | **Mandatory**: Persists historical and active academic datasets |
| `/app/data/reviews/*.json` | Faculty review decisions & notes | **Mandatory**: Persists review feedback and dismissed anomalies |
| `/app/data/imports/uploads/` | Quarantined incoming workbook uploads | Ephemeral: Cleaned up automatically after staging |
| `/app/data/imports/candidates/` | Candidate staging databases | Ephemeral: Retained for preview TTL (default 1 hour) |

### B. Failure Modes & Edge Case Handling
1. **Crash Recovery**: When the application boots, `create_app` inspects `active_dataset.json`. If valid, it verifies table existence (`students`, `courses`) and student counts before adopting it.
2. **Corrupted Reviews**: If a review state JSON file is corrupted or truncated, `_load_reviews_store` catches the error, logs a warning, and gracefully initializes an empty dictionary without crashing the application.
3. **Write Atomicity**: Review saves use atomic `.tmp` file writes followed by `os.replace` to prevent corrupted states during unexpected termination.
4. **Unsupported Hosting Platforms**: Purely ephemeral container platforms (e.g. basic stateless Cloud Run or Heroku without persistent volume attachments) are **explicitly unsupported** because dataset activations and review feedback will be lost upon container recycling.

---

## 5. Security Boundary & Authorization Matrix

Inspection of all routes in `app/api/routes/`:

| Endpoint | Method | Classification | Auth Enforced | Security Guidance |
| :--- | :---: | :--- | :---: | :--- |
| `/health` | `GET` | Public Health Probe | None | Safe for public load-balancer probes |
| `/livez` | `GET` | Liveness Probe | None | Safe for Kubernetes orchestration |
| `/readyz` | `GET` | Readiness Probe | None | Safe for Kubernetes orchestration |
| `/api/v1/imports/preview` | `POST` | Admin Dataset Ingestion | `EDUQUERY_IMPORT_API_KEY` | Protected (constant-time token check) |
| `/api/v1/imports/confirm` | `POST` | Admin Dataset Activation | `EDUQUERY_IMPORT_API_KEY` | Protected (constant-time token check) |
| `/api/v1/imports/versions` | `GET` | Admin Dataset History | `EDUQUERY_IMPORT_API_KEY` | Protected (constant-time token check) |
| `/api/v1/imports/rollback` | `POST` | Admin Version Rollback | `EDUQUERY_IMPORT_API_KEY` | Protected (constant-time token check) |
| `/api/v1/imports/{import_id}` | `GET` | Admin Import Status | `EDUQUERY_IMPORT_API_KEY` | Protected (constant-time token check) |
| `/api/v1/students` | `GET` | Academic Data Read | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/students/{id}/breakdown` | `GET` | Academic Data Read | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/students/export` | `GET` | Academic CSV Export | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/subjects` | `GET` | Course Catalog Read | **None** | Internal intranet access |
| `/api/v1/subjects/failure-summary` | `GET` | Failure Analytics Read | **None** | Internal intranet access |
| `/api/v1/subjects/{code}/failures` | `GET` | Failure Roster Read | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/data-quality` | `GET` | Quality Audit Read | **None** | Internal intranet access |
| `/api/v1/anomalies/summary` | `GET` | Anomaly Summary Read | **None** | Internal intranet access |
| `/api/v1/anomalies/findings` | `GET` | Anomaly Findings Read | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/anomalies/findings/{id}/review` | `POST` | Anomaly Review Action | **None** | **Must be protected by institutional gateway/VPN** |
| `/api/v1/analytics/*` | `GET` | Academic Workspace Read | **None** | Internal intranet access |
| `/api/v1/investigation/*` | `POST` | Investigation Engine Read | **None** | **Must be protected by institutional gateway/VPN** |

> [!WARNING]
> **Production Deployment Requirement**: Academic read endpoints and anomaly review actions are unauthenticated in the core application. EduQuery is designed to be hosted behind an **institutional reverse-proxy** (e.g. Nginx with Basic Auth, AWS ALB with OIDC/Cognito, Cloudflare Access, or a campus VPN). It must **never** be exposed directly to the public internet without an authentication gateway.

---

## 6. MDM Elective Invariant Verification

Evaluated on Mumbai University marksheet `Result_anonymized.xlsx`:

1. **Per-Student Invariant**:
   - Every one of the **145 students** has marks recorded in **exactly 1 elective course**.
   - Zero students have multiple elective marks.
   - Zero students have missing elective enrollment.
2. **Zero Phantom Rows**:
   - Unselected alternatives generate **0 rows** in the `scores` table.
   - Total elective scores across all 4 courses: **580 score records** ($145 \text{ students} \times 4 \text{ components: TH, IA, TW, PR}$).
3. **Accurate Enrolled Denominators**:
   - `MDMBD02` (Big Data): **63 enrolled**
   - `MDMBI02` (Business Intelligence): **9 enrolled**
   - `MDMIE02` (Industrial Engineering): **41 enrolled**
   - `MDMRB02` (Robotics): **32 enrolled**
   - Sum: $63 + 9 + 41 + 32 = \mathbf{145 \text{ enrolled students}}$.
4. **Failure Rate Isolation**:
   - A failing student in `MDMBI02` calculates failure percentage against 9 enrolled students ($11.1\%$), never against the whole cohort of 145 ($0.68\%$).
   - Student failure counts include only enrolled courses.

---

## 7. Upload & Archive Hardening Verification

Verified in `tests/test_phase11_release_audit.py`:

| Threat / Edge Case | Test Description | Status |
| :--- | :--- | :---: |
| **Excessive Archive Entries** | Upload zip with 1,005 entries -> rejected with HTTP 422 `SUSPICIOUS_ARCHIVE` | ✅ VERIFIED |
| **Encrypted Archives** | Upload zip with bit 0 set in central directory header -> rejected with HTTP 422 `SUSPICIOUS_ARCHIVE` | ✅ VERIFIED |
| **Path Traversal Filenames** | Upload zip with `../../evil.xml` -> rejected with HTTP 422 `SUSPICIOUS_ARCHIVE` | ✅ VERIFIED |
| **Decompression Bomb Ratio** | Decompression expansion ratio $> 100:1$ or uncompressed size $> 100\text{ MiB}$ -> rejected | ✅ VERIFIED |
| **File Size Boundary** | Upload stream $> 25\text{ MiB}$ -> terminated with HTTP 413 `FILE_TOO_LARGE` | ✅ VERIFIED |
| **Non-Zip Container** | Magic bytes other than `PK\x03\x04` -> rejected with HTTP 415 `INVALID_WORKBOOK_CONTAINER` | ✅ VERIFIED |
| **Non-xlsx Extension** | Upload with `.xls`, `.csv`, `.xlsm` -> rejected with HTTP 415 `UNSUPPORTED_FILE_TYPE` | ✅ VERIFIED |
| **Formula Execution** | Cells loaded with openpyxl `data_only=True` without evaluating active macros or formulas | ✅ VERIFIED |

---

## 8. Complete Deployment Acceptance Rehearsal

Executed synthetic workflow test (`tests/test_phase10_acceptance_workflow.py` and `tests/test_phase11_release_audit.py`):

1. **Process Startup**: Fast initialization, configuration resolution, database connectivity.
2. **Liveness & Readiness**: `GET /livez` (200), `GET /readyz` (200).
3. **Upload Hardening**: Rejected invalid, encrypted, oversized, and malicious files.
4. **Safe Preview**: Isolated candidate database, elective groups detection, zero mutations to active dataset.
5. **Authorized Activation**: Atomic pointer swap (`data/active_dataset.json`), hot runtime reconnection.
6. **Academic Workspace**: Overview metrics, failure summaries, division comparisons, student dossiers.
7. **Anomaly Findings & Review**: Deterministic calculation errors, multivariate Isolation Forest, persistent review saved.
8. **Crash Resilience**: Application reboot recovers active dataset from pointer file and preserves review states.
9. **Safe Rollback**: Versioned datasets listed, rollback executed atomically with immediate query consistency.

---

## 9. Operational Readiness Checklist

- [x] **Environment Variables**:
  - `EDUQUERY_ENV=production`
  - `EDUQUERY_DATABASE_PATH=/app/data/eduquery.duckdb`
  - `EDUQUERY_DATA_DIR=/app/data`
  - `EDUQUERY_ACTIVE_POINTER_PATH=/app/data/active_dataset.json`
  - `EDUQUERY_IMPORT_API_KEY=<strong-random-key>`
  - `EDUQUERY_CORS_ORIGINS=["https://eduquery.institution.edu"]`
- [x] **Persistent Storage**: Mount `/app/data` to persistent volume.
- [x] **Health Check Command**: `curl -f http://localhost:8000/livez || exit 1`.
- [x] **Backup Procedure**: Snapshot `/app/data` (includes `active_dataset.json`, `datasets/`, and `reviews/`).
- [x] **Restore Procedure**: Restore `/app/data` directory and restart container.
- [x] **Log Handling**: No student PII or raw grades printed to standard output or error logs.

---

## 10. Test Execution Results

| Test Suite | Tests Run | Passed | Failed | Duration | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Pytest Full Backend Suite** | **251** | **251** | **0** | **44.90s** | ✅ PASS |
| **Vitest Full Frontend Suite** | **50** | **50** | **0** | **8.46s** | ✅ PASS |
| **Frontend TypeScript (`tsc -b`)** | — | — | **0 errors** | **2.60s** | ✅ PASS |
| **Frontend Production Build** | — | — | **0 errors** | **0.73s** | ✅ PASS |
| **Phase 11 Release Audit Suite** | **8** | **8** | **0** | **2.64s** | ✅ PASS |
| **Total Automated Tests** | **301** | **301** | **0** | — | ✅ 100% PASS |

---

## 11. Final Verdict Explanation

**Verdict: `READY WITH LIMITATIONS`**
(Suitable for `CONTROLLED DEMO` when deployed in an internal network or behind an authentication proxy).

### Limitations to Address Before Unrestricted Public Multi-User Deployment:
1. **Academic Read Authentication**: Endpoints under `/api/v1/students*`, `/api/v1/subjects*`, and `/api/v1/anomalies*` are currently unauthenticated. The application must be hosted behind a reverse proxy or VPN with institutional SSO/OIDC.
2. **Local Docker Daemon**: Container verification on the local host was limited by the Windows Docker Desktop service being in a stopped state. Execution in a Linux CI/CD pipeline (e.g. GitHub Actions) with native Docker access is recommended for the final container image push.
3. **Storage Persistence**: Deployment requires persistent block storage for `/app/data`; stateless serverless runtimes are unsupported.
