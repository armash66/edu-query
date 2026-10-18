# EduQuery V3 — Implementation Roadmap & Milestones

This document specifies the gated implementation sequence for transitioning EduQuery V3 from analytical report services into an enterprise-ready marksheet analysis platform.

Every milestone defines strict completion criteria, test requirements, and non-goals. Progression to subsequent milestones requires passing all quality gates.

---

## Milestone 3.1: API Schemas, Ground-Truth Reconciliation & Architecture Contracts

- **Status**: **COMPLETED**
- **Scope**:
  - Reconciled workbook ground truth against Phase 2 analytical outputs.
  - Formulated system architecture (`docs/architecture.md`), API contracts (`docs/api-contract.md`), and implementation roadmap (`docs/implementation-roadmap.md`).
  - Created Pydantic v2 schemas in `app/api/schemas/` for common error envelopes, health, students, subjects, and data quality.
  - Implemented isolated schema validation tests in `tests/test_api_schemas.py` (16 passing tests).
  - Preserved all 65 Phase 1 & 2 tests (81 total tests passing).

---

## Milestone 3.2: Operational FastAPI Backend API & Test Suite

- **Status**: **COMPLETED**
- **Scope**:
  - Implemented application factory `create_app()` and CORS / exception handlers in `app/main.py`.
  - Implemented typed environment configuration `Settings` in `app/config.py`.
  - Implemented request-scoped database lifecycle dependency `get_db` with `finally: con.close()` in `app/api/dependencies.py`.
  - Implemented application services in `app/services/` (`student_service.py`, `subject_service.py`, `data_quality_service.py`).
  - Implemented all 7 core endpoints under `app/api/routes/`:
    - `GET /health`: database connectivity, real counts or 503 if missing/empty.
    - `GET /api/v1/students`: paginated student roster, sorting, division/result filters.
    - `GET /api/v1/students/{identifier}/breakdown`: student subject breakdown, 404 on unknown, 409 on ambiguous.
    - `GET /api/v1/subjects`: course catalog with enrolled counts and kind filtering.
    - `GET /api/v1/subjects/failure-summary`: curriculum-wide failure summaries sorted descending.
    - `GET /api/v1/subjects/{course_code}/failures`: failure roster with paginated failing students and enrolled denominator.
    - `GET /api/v1/data-quality`: data-quality findings and audit score.
  - Implemented complete integration test suite in `tests/api/`:
    - `tests/api/test_health_api.py` (5 tests)
    - `tests/api/test_students_api.py` (11 tests)
    - `tests/api/test_subjects_api.py` (8 tests, including API-level ground-truth reconciliation)
    - `tests/api/test_data_quality_api.py` (2 tests)
    - `tests/api/test_security_resilience.py` (5 tests)
  - All 112 tests passing across entire test suite.

---

## Milestone 3.3: Production-Readiness Audit, Concurrency Tests & Backend Hardening

- **Status**: **COMPLETED**
- **Scope**:
  - Executed systematic database lifecycle audit across 8 failure modes (on-disk initialized, missing file, uninitialized file, corrupted file, valid empty schema, read-only enforcement, exception cleanup, failed request isolation).
  - Hardened `app/api/dependencies.py` to inspect schema tables and return clean HTTP 503 `DATABASE_UNAVAILABLE` when the database exists but is uninitialized, rather than crashing with 500.
  - Resolved settings resolution defect where `create_app(custom_settings)` was bypassed by dependency injection.
  - Implemented comprehensive database lifecycle test suite (`tests/api/test_database_lifecycle.py`, 9 tests).
  - Implemented concurrent API test suite (`tests/api/test_concurrency.py`, 7 tests) covering concurrent health checks, student rosters, breakdowns, subject failures, error isolation, and OS threadpool execution.
  - Conducted empirical load benchmark: 100 requests across 10 workers completed in 0.52s (~191 req/sec) with median latency 27.0ms and zero errors.
  - All 128 tests passing across the repository.

---

## Milestone 3.4: Secure Workbook Upload, Preview, Validation & Atomic Activation

- **Status**: **COMPLETED**
- **Scope**:
  - Implemented streaming upload with strict 25 MiB size cap and OpenXML zip package validation (`PK\x03\x04` and `[Content_Types].xml`).
  - Quarantined candidate staging in isolated DuckDB databases (`data/imports/candidates/candidate_<uuid>.duckdb`) without mutating active production datasets.
  - Implemented privacy-safe preview endpoint (`POST /api/v1/imports/preview`) exposing layout summaries, student/course counts, and data-quality findings with zero student PII and `active_dataset_changed: false`.
  - Implemented atomic confirmation and dataset activation (`POST /api/v1/imports/confirm`) promoting candidates to persistent versioned storage (`data/datasets/dataset_<timestamp>_<uuid>.duckdb`) with atomic pointer replacement (`data/active_dataset.json`).
  - Solved Windows file locking invariant: existing connections finish read-only operations without interruption; new requests bind immediately to the newly activated dataset.
  - Server restart recovery re-binds active dataset pointer on application startup.
  - Administrative authorization safeguard (`EDUQUERY_IMPORT_API_KEY`) via constant-time comparison (`secrets.compare_digest`).
  - Added full test suite in `tests/api/test_imports_api.py` (23 tests).
  - All 151 tests passing across entire repository.
- **Delivered Files**:
  - `app/config.py` (import settings, paths, limits)
  - `app/api/schemas/imports.py` (Pydantic v2 schemas)
  - `app/services/import_manager.py` (lifecycle, streaming, staging, activation, cleanup)
  - `app/api/routes/imports.py` (preview, confirm, and status routes)
  - `tests/api/test_imports_api.py` (23 end-to-end integration tests)

---

## Milestone 3.5: Import Recovery Audit, Security Hardening, and Dashboard-Readiness Gate

- **Status**: **COMPLETED**
- **Scope**:
  - Systematic failure-point audit across cases A–J (crash before promotion, promotion copy failure, pointer tmp file failure, `os.replace` failure, crash before HTTP response, recovery after intermediate states, corrupt/missing/empty pointer DB, path traversal in pointer JSON, cleanup during active use, cross-process concurrency).
  - Implementation of `CrossProcessLock` (atomic `O_CREAT | O_EXCL`) to serialize activations across worker processes.
  - Power-loss durability guarantees via explicit `flush()` and `os.fsync()` before atomic `os.replace`.
  - Containment checks: active dataset pointer targets and candidate databases must reside strictly within their designated directories.
  - Startup recovery hardening: verifies table schemas and `COUNT(*) > 0` before activating candidate from pointer file; falls back cleanly to default dataset if corrupted or empty.
  - Path traversal protection: session IDs validated against `^[a-zA-Z0-9_\-]{8,64}$`, uploaded filenames sanitized to base name.
  - Information leakage prevention: stripped `candidate_db_path`, `upload_path`, and raw Python exception stack traces from HTTP responses.
  - Added adversarial test suite `tests/api/test_import_recovery_and_security.py` (26 tests).
  - All 177 tests passing across entire repository.
- **Decision Outcome**: **READY FOR DASHBOARD** (with documented single-user admin auth limitations).

---

## Milestone 3.6: Frontend Dashboard & Production Deployment

- **Status**: **PENDING APPROVAL**
- **Scope**:
  - Modern faculty dashboard UI (Vanilla CSS / HTML / JS).
  - Production Dockerfile and deployment documentation.
- **Completion Criteria**:
  - End-to-end user workflows validated in real browser.

