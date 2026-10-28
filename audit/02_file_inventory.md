# EduQuery Project Audit: 02 - Comprehensive File Inventory

This inventory documents every file in the EduQuery repository (excluding `node_modules`, `.git`, `.pytest_cache`, and ephemeral build artifacts). Each entry details its purpose, primary interfaces, dependencies, runtime role, and approximate line count.

---

## 1. Backend Logic (`app/`)

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app/__init__.py` | Marks the `app` package root and defines module metadata. | `__version__ = "3.0.0"` | None $\rightarrow$ Package version string | Standard library | Runtime | 2 |
| `app/main.py` | FastAPI application factory, lifespan context, pointer recovery, and middleware setup. | `create_app`, `lifespan` | `Settings` $\rightarrow$ `FastAPI` instance | `fastapi`, `duckdb`, `app.api.router`, `app.config` | Runtime | 239 |
| `app/config.py` | Pydantic BaseSettings management for environment variables, paths, and limits. | `Settings`, `get_settings` | Environment variables $\rightarrow$ Typed configuration instance | `pydantic_settings`, `pathlib` | Runtime | 89 |
| `app/api/__init__.py` | Marks API module boundary. | None | None | None | Runtime | 1 |
| `app/api/router.py` | Aggregates and prefixes all API v1 endpoints under `/api/v1`. | `api_v1_router` | Sub-routers $\rightarrow$ Unified `APIRouter` | `fastapi`, sub-route modules | Runtime | 28 |
| `app/api/dependencies.py` | Dependency injection providers for database connections, sessions, and auth. | `get_db`, `get_active_session`, `verify_admin_key` | HTTP `Request` $\rightarrow$ `duckdb.DuckDBPyConnection`, session metadata | `fastapi`, `duckdb`, `app.core.database`, `app.services.session_manager` | Runtime | 132 |
| `app/api/routes/analytics.py` | Endpoints for high-level academic KPIs, distributions, and division comparisons. | `get_overview`, `get_distributions`, `get_division_comparison` | `get_db` $\rightarrow$ `AnalyticsOverviewResponse`, `DistributionsResponse` | `fastapi`, `app.services.analytics_service` | Runtime | 51 |
| `app/api/routes/anomaly.py` | Endpoints for multi-tier anomaly detection listing and faculty review actions. | `list_anomalies`, `review_anomaly`, `batch_review_anomalies` | Query parameters, review payload $\rightarrow$ `AnomalyListResponse`, confirmation | `fastapi`, `app.services.anomaly_detection` | Runtime | 170 |
| `app/api/routes/data_quality.py` | Surfaces automated data quality audit checks and findings. | `get_data_quality_report` | `get_db` $\rightarrow$ `DataQualityResponse` | `fastapi`, `app.services.data_quality_service` | Runtime | 14 |
| `app/api/routes/health.py` | Health and liveness probes for Docker container and host orchestrators. | `livez_probe`, `health_check` | HTTP `Request` $\rightarrow$ `HealthResponse` (200 or 503) | `fastapi`, `duckdb`, `app.config` | Runtime | 134 |
| `app/api/routes/imports.py` | Administrative import lifecycle (preview, confirm, versions, rollback). | `preview_import`, `confirm_import`, `list_versions`, `rollback_version` | Upload file, admin key $\rightarrow$ Ingestion preview, activation confirmation | `fastapi`, `app.services.import_manager` | Runtime | 198 |
| `app/api/routes/investigation.py` | Faceted academic query engine for ad-hoc filtering and student searches. | `execute_investigation_query`, `get_capabilities` | `InvestigationQueryRequest` $\rightarrow$ `InvestigationQueryResponse` | `fastapi`, `app.services.investigation_service` | Runtime | 79 |
| `app/api/routes/session.py` | Privacy-first temporary analysis session upload, confirmation, and status. | `upload_temporary_marksheet`, `confirm_session`, `get_session_info`, `delete_session` | Upload file, session cookie/header $\rightarrow$ Temporary session metadata | `fastapi`, `app.services.session_manager` | Runtime | 225 |
| `app/api/routes/students.py` | Student directory listings, marksheet breakdowns, and CSV roster exports. | `list_students`, `get_student_detail`, `export_students_csv` | Identifier, pagination, division filters $\rightarrow$ `StudentBreakdownResponse`, CSV | `fastapi`, `app.services.student_service`, `app.reports.student_breakdown` | Runtime | 206 |
| `app/api/routes/subjects.py` | Curriculum catalog, failure summaries, evaluation rosters, and Excel exports. | `list_subjects`, `get_course_detail`, `get_course_students_route`, `export_subject_roster` | Course code, division, status filter $\rightarrow$ Failure breakdown, roster, Excel | `fastapi`, `app.services.subject_service`, `app.services.export_service` | Runtime | 175 |
| `app/api/schemas/__init__.py` | Central export module for all Pydantic schemas. | Re-exports schemas | Modular imports $\rightarrow$ Central namespace | Sub-schema files | Runtime | 79 |
| `app/api/schemas/analytics.py` | Typed schemas for KPI metrics, score distributions, and division comparisons. | `AnalyticsOverviewResponse`, `DistributionsResponse`, `DivisionMetric` | Dict payloads $\rightarrow$ Validated JSON models | `pydantic` | Runtime | 148 |
| `app/api/schemas/anomaly.py` | Typed schemas for anomaly records, group summaries, and faculty reviews. | `AnomalyRecord`, `AnomalyReviewRequest`, `AnomalySummaryResponse` | Review requests $\rightarrow$ Validated payloads | `pydantic` | Runtime | 130 |
| `app/api/schemas/common.py` | Generic reusable schemas (pagination, errors, response wrappers). | `PaginatedResponse`, `ErrorResponse`, `StatusResponse` | Generic types `T` $\rightarrow$ Standardized envelope | `pydantic` | Runtime | 55 |
| `app/api/schemas/data_quality.py` | Schemas for data quality check findings and impacts. | `QualityFinding`, `DataQualityResponse` | Check findings $\rightarrow$ Serialized report | `pydantic` | Runtime | 30 |
| `app/api/schemas/health.py` | Schema for liveness and detailed health probes. | `HealthResponse`, `DatabaseHealth` | Probe data $\rightarrow$ Serialized health response | `pydantic` | Runtime | 18 |
| `app/api/schemas/imports.py` | Schemas for staging workbooks, layout previews, and version history. | `ImportPreviewResponse`, `ImportConfirmResponse`, `DatasetVersionItem` | Import payloads $\rightarrow$ Validated state | `pydantic` | Runtime | 132 |
| `app/api/schemas/investigation.py` | Schemas for filter predicates, presets, and query results. | `QueryCondition`, `InvestigationQueryRequest`, `InvestigationQueryResponse` | Query JSON $\rightarrow$ Validated predicate tree | `pydantic` | Runtime | 109 |
| `app/api/schemas/student.py` | Schemas for student summaries and multi-component marksheet breakdowns. | `StudentSummaryItem`, `StudentBreakdownResponse`, `ComponentScore` | DB rows $\rightarrow$ Detailed marksheet structure | `pydantic` | Runtime | 105 |
| `app/api/schemas/subject.py` | Schemas for course catalog entries, failure rates, and rosters. | `CourseItem`, `SubjectFailureResponse`, `SubjectStudentsResponse` | DB rows $\rightarrow$ Serialized curriculum metrics | `pydantic` | Runtime | 127 |
| `app/reports/__init__.py` | Analytical reporting package declarations. | None | None | Standard library | Runtime | 31 |
| `app/reports/student_breakdown.py` | Resolves student identity, compiles component marks, verifies arithmetic sum. | `get_student_breakdown`, `resolve_student_identifier` | `con`, identifier $\rightarrow$ `StudentBreakdownResponse` | `duckdb`, `app.core.models`, `app.api.schemas.student` | Runtime | 479 |
| `app/reports/subject_failures.py` | Computes course-level pass/fail rates, division partitions, and enrolled tallies. | `get_subject_failures`, `get_all_subject_failures` | `con`, course code $\rightarrow$ `SubjectFailureResponse` | `duckdb`, `app.core.catalog`, `app.api.schemas.subject` | Runtime | 439 |
| `app/services/__init__.py` | Service layer module declarations. | None | None | Standard library | Runtime | 16 |
| `app/services/analytics_service.py` | Aggregates classwide outcomes, score histograms, and division rankings. | `get_analytics_overview`, `get_score_distributions` | `con` $\rightarrow$ KPI dictionaries and distribution data | `duckdb`, `numpy` | Runtime | 541 |
| `app/services/anomaly_detection.py` | Implements 3-tier anomaly detection (Deterministic, MAD, Isolation Forest). | `run_anomaly_detection_pipeline`, `IsolationForestDetector` | `con`, `Settings` $\rightarrow$ Detected anomaly list | `duckdb`, `numpy`, `sklearn.ensemble`, `json` | Runtime | 725 |
| `app/services/data_quality_service.py` | Orchestrates data quality auditing across DuckDB tables. | `run_data_quality_checks` | `con` $\rightarrow$ List of `QualityFinding` | `duckdb`, `app.core.data_quality` | Runtime | 122 |
| `app/services/export_service.py` | Generates formatted Excel (`.xlsx`) and CSV reports for offline faculty use. | `export_absent_students_excel`, `export_subject_roster_excel` | `con`, filter params $\rightarrow$ Raw bytes buffer (`BytesIO`) | `openpyxl`, `duckdb`, `csv` | Runtime | 856 |
| `app/services/import_manager.py` | Manages permanent administrative dataset promotion, pointers, and rollback. | `stage_upload`, `confirm_import_candidate`, `rollback_active_dataset` | Uploaded file $\rightarrow$ Active dataset switch | `duckdb`, `pathlib`, `json`, `os` | Runtime | 745 |
| `app/services/investigation_service.py` | Translates user-defined predicate ASTs into safe parameterized SQL queries. | `query_investigation`, `get_investigation_capabilities` | `InvestigationQueryRequest` $\rightarrow$ Paginated matching students | `duckdb`, `pydantic` | Runtime | 573 |
| `app/services/session_manager.py` | Privacy sandbox managing ephemeral session databases and automatic pruning. | `create_temporary_session`, `confirm_temporary_session`, `cleanup_expired_sessions` | Uploaded workbook $\rightarrow$ Session ID & isolated DuckDB file | `duckdb`, `openpyxl`, `app.core.ingest`, `time` | Runtime | 519 |
| `app/services/student_service.py` | Student roster querying, text search across seat/roll/name, and pagination. | `list_students_service`, `search_students` | Search query, division, page $\rightarrow$ Student list and total count | `duckdb` | Runtime | 326 |
| `app/services/subject_service.py` | Course listing, enrollment counts, and student evaluation rosters with filters. | `list_courses_service`, `get_course_students_service` | Course code, status filter, search $\rightarrow$ Filtered student roster | `duckdb` | Runtime | 329 |

---

## 2. Data & Ingestion (`app/core/` and `data/`)

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app/core/__init__.py` | Marks the core ingestion and data engine package boundary. | None | None | None | Runtime | 3 |
| `app/core/catalog.py` | Course taxonomy definitions, code normalizations, and paired component mapping. | `get_catalog`, `classify_course_code` | Raw course code $\rightarrow$ Normalized code, course category, paired code | Standard library | Runtime | 70 |
| `app/core/database.py` | DuckDB connection lifecycle, WAL locks, and initial table DDL execution. | `get_db_connection`, `initialize_database_schema` | Database file path $\rightarrow$ Connected `duckdb.DuckDBPyConnection` | `duckdb`, `threading` | Runtime | 97 |
| `app/core/data_quality.py` | Pure SQL data verification checks (duplicates, orphaned scores, range checks). | `check_duplicate_students`, `check_mark_ranges`, `check_formula_inconsistencies` | `con` $\rightarrow$ Structured error and warning lists | `duckdb` | Runtime | 279 |
| `app/core/gateway_auth.py` | Validates Cloudflare Access institutional identity JWTs and public certificates. | `verify_cf_access_jwt`, `fetch_jwks_keys` | HTTP Authorization header $\rightarrow$ Authenticated identity or 401 | `jwt`, `cryptography`, `httpx` | Runtime | 258 |
| `app/core/ingest.py` | Layout discovery, paired-row student parsing, and DuckDB table population. | `ingest`, `detect_layout_profile`, `extract_student_records` | `.xlsx` file path $\rightarrow$ Populated DuckDB DB, `IngestionReport` | `openpyxl`, `duckdb`, `pandas`, `re` | Runtime | 621 |
| `app/core/models.py` | Core domain entities (Student, Course, Score, IngestionReport). | `Student`, `Course`, `ScoreRecord`, `IngestionReport` | Raw parameters $\rightarrow$ Typed domain instances | `dataclasses`, `typing` | Runtime | 120 |
| `data/active_dataset.json` | Atomic filesystem pointer referencing the currently active dataset. | JSON metadata | JSON file $\rightarrow$ Database path, dataset ID, student/course counts | Standard JSON | Runtime | 10 |

---

## 3. Frontend Single Page Application (`frontend/src/`)

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/index.html` | HTML5 application shell, viewport setup, favicon, and script tag. | DOM Root (`<div id="root">`) | Browser request $\rightarrow$ Mounted DOM | None | Runtime | 16 |
| `frontend/src/main.tsx` | React 19 application bootstrapping and root DOM mounting. | `createRoot` | `<App />` $\rightarrow$ DOM `#root` | `react`, `react-dom/client`, `./App`, `./index.css` | Runtime | 9 |
| `frontend/src/App.tsx` | Client-side routing definitions, context provider wrapping, and home redirection. | `App`, `HomeRoute` | URL path $\rightarrow$ Page view component | `react-router-dom`, Contexts, Pages | Runtime | 60 |
| `frontend/src/App.css` | Legacy structural layout rules and container flex utilities. | CSS classes (`.app-container`, etc.) | Style sheet $\rightarrow$ Rendered styles | None | Runtime | 67 |
| `frontend/src/index.css` | Master CSS theme, CSS variables, utility tokens, and global `@media print` rules. | CSS theme variables, `@media print` | Style sheet $\rightarrow$ Layout, Typography, Print rendering | None | Runtime | 724 |
| `frontend/src/vite-env.d.ts` | TypeScript environment declarations for Vite client and environment variables. | Type definitions | Build context $\rightarrow$ Type awareness | `vite/client` | Runtime | 2 |
| `frontend/src/api/client.ts` | Centralized typed HTTP API client attaching session tokens and handling errors. | `request`, `getSessionToken`, `setSessionToken`, API methods | Endpoint + options $\rightarrow$ Deserialized data or `ApiError` | `./types` | Runtime | 901 |
| `frontend/src/api/types.ts` | TypeScript interface mirrors of backend Pydantic request and response schemas. | Interfaces & Types | None $\rightarrow$ Static compile-time verification | None | Runtime | 473 |
| `frontend/src/context/AdminKeyContext.tsx` | Context storing the optional administrative key in memory. | `AdminKeyProvider`, `useAdminKey` | React children $\rightarrow$ `adminKey` state and setter | `react` | Runtime | 37 |
| `frontend/src/context/HealthContext.tsx` | Context polling backend `/health` endpoint and tracking database connectivity. | `HealthProvider`, `useHealth` | React children $\rightarrow$ `health` state and `refreshHealth` | `react`, `../api/client` | Runtime | 46 |
| `frontend/src/context/SessionContext.tsx` | Context managing privacy-first temporary analysis session lifecycle. | `SessionProvider`, `useSession` | React children $\rightarrow$ `session`, `hasActiveSession`, `deleteSession` | `react`, `../api/client` | Runtime | 144 |
| `frontend/src/components/AdminKeyModal.tsx` | Modal dialog allowing faculty/administrators to enter an administrative API key. | `AdminKeyModal` | Open state, onSave callback $\rightarrow$ Key prompt UI | `react`, `lucide-react` | Runtime | 72 |
| `frontend/src/components/AppShell.tsx` | Main application layout with top navigation bar, collapsible sidebar, and delete session action. | `AppShell` | Context state, route $\rightarrow$ Shell layout with `<Outlet />` | `react`, `react-router-dom`, `lucide-react` | Runtime | 301 |
| `frontend/src/components/ConfirmDialog.tsx` | Reusable modal dialog for destructive actions (e.g., dataset delete or rollback). | `ConfirmDialog` | Confirmation title, message, onConfirm $\rightarrow$ Dialog UI | `react`, `lucide-react` | Runtime | 62 |
| `frontend/src/components/DisambiguationModal.tsx` | Modal presenting student matches when an ambiguous name or identifier is queried. | `DisambiguationModal` | List of student candidates $\rightarrow$ Selection callback | `react`, `lucide-react` | Runtime | 62 |
| `frontend/src/components/EmptyState.tsx` | Standardized empty placeholder when lists or search queries return 0 results. | `EmptyState` | Icon, title, description, action $\rightarrow$ Empty state UI | `react`, `lucide-react` | Runtime | 38 |
| `frontend/src/components/ErrorBanner.tsx` | Prominent alert banner displaying backend errors with a retry action button. | `ErrorBanner` | Error message, retry callback $\rightarrow$ Alert box | `react`, `lucide-react` | Runtime | 45 |
| `frontend/src/components/LoadingState.tsx` | Standardized spinner and loading message indicator. | `LoadingState` | Optional message $\rightarrow$ Animated spinner UI | `react`, `lucide-react` | Runtime | 24 |
| `frontend/src/components/Pagination.tsx` | Standardized pagination controls with page jumpers and row-count indicators. | `Pagination` | Current page, total items, page size $\rightarrow$ Pager UI | `react`, `lucide-react` | Runtime | 82 |
| `frontend/src/components/SearchBar.tsx` | Input box with clear button and debounced search triggers. | `SearchBar` | Search value, onChange callback $\rightarrow$ Input widget | `react`, `lucide-react` | Runtime | 48 |
| `frontend/src/components/StatusBadge.tsx` | Colored pill indicator for student statuses (PASS, FAIL, ABSENT, PROMOTED). | `StatusBadge` | Status string $\rightarrow$ Stylized badge element | `react` | Runtime | 49 |
| `frontend/src/components/charts/DivisionComparisonChart.tsx` | SVG-based grouped bar chart comparing performance metrics across divisions. | `DivisionComparisonChart` | Division metric records $\rightarrow$ Responsive SVG chart | `react` | Runtime | 114 |
| `frontend/src/components/charts/HorizontalRankingChart.tsx` | SVG bar chart displaying courses ranked by failure rates. | `HorizontalRankingChart` | Ranked course array $\rightarrow$ Interactive horizontal bar UI | `react` | Runtime | 96 |
| `frontend/src/components/charts/MarksHistogramChart.tsx` | SVG histogram showing distribution of total student marks in bucketed intervals. | `MarksHistogramChart` | Histogram bins $\rightarrow$ Frequency bar chart | `react` | Runtime | 118 |
| `frontend/src/components/charts/OutcomeDonutChart.tsx` | SVG donut chart illustrating pass vs fail vs absent student proportions. | `OutcomeDonutChart` | Pass, fail, absent counts $\rightarrow$ Proportional donut SVG | `react` | Runtime | 94 |
| `frontend/src/pages/AbsentStudentsPage.tsx` | Faculty audit roster listing all students with absent markers, supporting filtering, print, and export. | `AbsentStudentsPage` | Filter params $\rightarrow$ Absent student table, SheetJS / server export | `react`, `lucide-react`, `../api/client`, `../utils/excelExport` | Runtime | 697 |
| `frontend/src/pages/DataQualityPage.tsx` | Audit dashboard presenting data quality checks, severities, impacts, and actions. | `DataQualityPage` | Data quality API $\rightarrow$ Categorized finding cards | `react`, `lucide-react`, `../api/client` | Runtime | 257 |
| `frontend/src/pages/ExplorePage.tsx` | Interactive investigation engine with quick presets, filter builder, and data grid. | `ExplorePage` | Filter conditions $\rightarrow$ Query response table, drilldown links | `react`, `lucide-react`, `../api/client` | Runtime | 1176 |
| `frontend/src/pages/ImportPage.tsx` | Administrative interface for permanent dataset uploads, validation previews, and rollbacks. | `ImportPage` | Upload file, admin key $\rightarrow$ Staging preview, activation | `react`, `lucide-react`, `../api/client` | Runtime | 784 |
| `frontend/src/pages/OverviewPage.tsx` | Executive academic workspace showing KPI cards, outcome charts, and verified anomalies. | `OverviewPage` | Overview analytics API $\rightarrow$ Dashboard grid, review toggles | `react`, `lucide-react`, `../api/client` | Runtime | 650 |
| `frontend/src/pages/StudentDetailPage.tsx` | Individual student transcript breakdown detailing marks, reconciliations, and print marksheet. | `StudentDetailPage` | URL identifier $\rightarrow$ Detailed marksheet card, print trigger | `react`, `lucide-react`, `../api/client` | Runtime | 473 |
| `frontend/src/pages/StudentsPage.tsx` | Complete student cohort directory with division filters, search, and CSV export. | `StudentsPage` | Pagination & search filters $\rightarrow$ Student table, export action | `react`, `lucide-react`, `../api/client` | Runtime | 589 |
| `frontend/src/pages/SubjectDetailPage.tsx` | Detailed course performance breakdown with pass/fail/absent roster filters and print action. | `SubjectDetailPage` | URL courseCode, status filter $\rightarrow$ Evaluation roster, print view | `react`, `lucide-react`, `../api/client`, `../utils/excelExport` | Runtime | 891 |
| `frontend/src/pages/SubjectFailuresPage.tsx` | Curriculum-wide failure analysis table ranking all subjects by student failure count. | `SubjectFailuresPage` | Failure summary API $\rightarrow$ Ranked failure table | `react`, `lucide-react`, `../api/client` | Runtime | 301 |
| `frontend/src/pages/SubjectsCatalogPage.tsx` | Catalog listing all discovered courses, credit weighting, and component types. | `SubjectsCatalogPage` | Course catalog API $\rightarrow$ Course card grid | `react`, `lucide-react`, `../api/client` | Runtime | 244 |
| `frontend/src/pages/UploadPage.tsx` | Faculty onboarding upload experience with drag-and-drop dropzone, preview, and session activation. | `UploadPage` | Dropped `.xlsx` file $\rightarrow$ Layout card, session confirmation | `react`, `lucide-react`, `../api/client`, `../context/SessionContext` | Runtime | 752 |
| `frontend/src/utils/excelExport.ts` | Client-side SheetJS utility creating styled Excel workbooks for student and absent rosters. | `exportStudentsToExcel`, `exportAbsentStudentsToExcel` | JSON student records $\rightarrow$ Downloadable `.xlsx` binary blob | `xlsx` | Runtime | 275 |

---

## 4. Tests (`tests/` and `frontend/src/**/*.test.tsx`)

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `frontend/src/test/setup.ts` | Vitest testing setup registering Jest DOM matchers. | Setup script | Test runner context $\rightarrow$ Configured DOM matchers | `@testing-library/jest-dom` | Test-only | 1 |
| `frontend/src/api/client.test.ts` | Unit tests verifying API client URL construction, session headers, and error handling. | `describe('API Client')` | Mock HTTP fetch $\rightarrow$ Verified headers & exceptions | `vitest`, `../api/client` | Test-only | 196 |
| `frontend/src/utils/excelExport.test.ts` | Tests validating client-side SheetJS Excel generation and workbook structures. | `describe('excelExport')` | Sample rows $\rightarrow$ Verified worksheet columns | `vitest`, `../utils/excelExport` | Test-only | 142 |
| `frontend/src/components/Modals.test.tsx` | Component tests validating modal accessibility, focus trapping, and Escape key handling. | `describe('Modal Accessibility')` | Synthetic key events $\rightarrow$ Verified modal callbacks | `vitest`, `@testing-library/react` | Test-only | 158 |
| `frontend/src/pages/AbsentStudentsPage.test.tsx` | Component tests for absent students table filtering, pagination, and print roster trigger. | `describe('AbsentStudentsPage')` | Mock API $\rightarrow$ Verified table rows & print invocation | `vitest`, `@testing-library/react` | Test-only | 245 |
| `frontend/src/pages/DataQualityPage.test.tsx` | Component tests for data quality audit finding rendering and severity tab filtering. | `describe('DataQualityPage')` | Mock quality API $\rightarrow$ Verified finding cards | `vitest`, `@testing-library/react` | Test-only | 103 |
| `frontend/src/pages/ExplorePage.test.tsx` | Component tests for investigation presets, filter builder conditions, and search execution. | `describe('ExplorePage')` | Click events $\rightarrow$ Filter chip assertions | `vitest`, `@testing-library/react` | Test-only | 200 |
| `frontend/src/pages/ImportPage.test.tsx` | Tests for file validation, admin key prompts, preview cards, and rollback confirmations. | `describe('ImportPage')` | Mock import API $\rightarrow$ Verified buttons & dialogs | `vitest`, `@testing-library/react` | Test-only | 386 |
| `frontend/src/pages/OverviewPage.test.tsx` | Tests for KPI metrics strip, outcome charts, and anomaly review verification toggles. | `describe('OverviewPage')` | Mock overview API $\rightarrow$ Verified card values | `vitest`, `@testing-library/react` | Test-only | 243 |
| `frontend/src/pages/StudentDetailPage.test.tsx` | Tests for marksheet component breakdown rendering, arithmetic sums, and disambiguation. | `describe('StudentDetailPage')` | Mock student API $\rightarrow$ Verified marksheet breakdown | `vitest`, `@testing-library/react` | Test-only | 252 |
| `frontend/src/pages/StudentsPage.test.tsx` | Tests for student roster rendering, search query debounce, and error banners. | `describe('StudentsPage')` | Mock students API $\rightarrow$ Verified roster table | `vitest`, `@testing-library/react` | Test-only | 175 |
| `frontend/src/pages/SubjectDetailPage.test.tsx` | Tests for subject pass/fail roster filtering and dedicated print roster action button. | `describe('SubjectDetailPage')` | Mock course API $\rightarrow$ Verified filtered roster & print | `vitest`, `@testing-library/react` | Test-only | 254 |
| `frontend/src/pages/SubjectFailuresPage.test.tsx` | Tests for curriculum failure summary table rendering and retry action on error. | `describe('SubjectFailuresPage')` | Mock failure API $\rightarrow$ Verified failure rankings | `vitest`, `@testing-library/react` | Test-only | 107 |
| `frontend/src/pages/SubjectsCatalogPage.test.tsx` | Tests for course catalog card grid rendering. | `describe('SubjectsCatalogPage')` | Mock catalog API $\rightarrow$ Verified course cards | `vitest`, `@testing-library/react` | Test-only | 79 |
| `frontend/src/pages/UploadPage.test.tsx` | Tests for faculty upload dropzone, file extension validation, and preview cards. | `describe('UploadPage')` | File drop simulation $\rightarrow$ Verified layout card | `vitest`, `@testing-library/react` | Test-only | 468 |
| `tests/__init__.py` | Marks root test package. | None | None | None | Test-only | 1 |
| `tests/api/__init__.py` | Marks API test package. | None | None | None | Test-only | 1 |
| `tests/api/test_analytics_api.py` | API integration tests for `/analytics/overview`, `/distributions`, and `/division-comparison`. | Test functions | TestClient requests $\rightarrow$ HTTP 200 & validated JSON | `pytest`, `fastapi.testclient` | Test-only | 153 |
| `tests/api/test_concurrency.py` | Tests validating multithreaded DuckDB concurrency without lock contention or deadlocks. | Test functions | Concurrent thread pool requests $\rightarrow$ Verified 200 responses | `pytest`, `concurrent.futures` | Test-only | 239 |
| `tests/api/test_data_quality_api.py` | API tests for `/data-quality` with empty and populated datasets. | Test functions | TestClient $\rightarrow$ Verified finding lists | `pytest`, `fastapi.testclient` | Test-only | 73 |
| `tests/api/test_database_lifecycle.py` | Validates read-only connection enforcement, exception handling, and connection cleanup. | Test functions | Malformed queries $\rightarrow$ Verified cleanup & safety | `pytest`, `duckdb` | Test-only | 231 |
| `tests/api/test_health_api.py` | Tests for `/livez` and `/health` under uninitialized, missing, and healthy database states. | Test functions | TestClient $\rightarrow$ 200 / 503 verification | `pytest`, `fastapi.testclient` | Test-only | 87 |
| `tests/api/test_import_recovery_and_security.py` | Stress tests for crash recovery, atomic pointer replacement, path traversal, and payload limits. | Test functions | Simulated crashes $\rightarrow$ Verified atomic pointer | `pytest`, `pathlib` | Test-only | 672 |
| `tests/api/test_imports_api.py` | Integration tests for administrative import endpoints, auth credentials, and previews. | Test functions | TestClient $\rightarrow$ Verified key authorization | `pytest`, `fastapi.testclient` | Test-only | 617 |
| `tests/api/test_investigation_api.py` | API tests for ad-hoc predicate queries, boolean combinations, and pagination. | Test functions | Query payloads $\rightarrow$ Filtered student results | `pytest`, `fastapi.testclient` | Test-only | 167 |
| `tests/api/test_phase6_exports.py` | Tests validating CSV and Excel roster export content, character escaping, and MIME types. | Test functions | Export endpoints $\rightarrow$ Verified CSV & XLSX bytes | `pytest`, `fastapi.testclient` | Test-only | 205 |
| `tests/api/test_phase6_rollback.py` | Tests verifying dataset version listing, rollback authorization, and rollback idempotency. | Test functions | Rollback API $\rightarrow$ Verified active dataset switch | `pytest`, `fastapi.testclient` | Test-only | 228 |
| `tests/api/test_phase7_e2e_integration.py` | End-to-end integration tests chaining upload, preview, confirmation, query, and review. | Test functions | Full workflow simulation $\rightarrow$ Verified state transitions | `pytest`, `fastapi.testclient` | Test-only | 292 |
| `tests/api/test_security_gate_audit.py` | Security audit tests for Cloudflare Access gateway JWT validation and header spoofing. | Test functions | Mocked JWTs $\rightarrow$ 200 or 401 response | `pytest`, `jwt` | Test-only | 342 |
| `tests/api/test_security_resilience.py` | Tests for malicious file payloads, oversized uploads, and zip bomb rejections. | Test functions | Malicious inputs $\rightarrow$ HTTP 400 / 413 / 422 | `pytest`, `fastapi.testclient` | Test-only | 99 |
| `tests/api/test_students_api.py` | Integration tests for `/students` listing, search filtering, and marksheet breakdowns. | Test functions | TestClient $\rightarrow$ Verified student records | `pytest`, `fastapi.testclient` | Test-only | 204 |
| `tests/api/test_subjects_api.py` | Integration tests for `/subjects` catalog, failure rates, and status filtering (`passed`/`failed`). | Test functions | TestClient $\rightarrow$ Verified course rosters | `pytest`, `fastapi.testclient` | Test-only | 224 |
| `tests/test_absent_and_excel_exports.py` | Tests verifying absent student identification and Excel binary formatting. | Test functions | Workbooks $\rightarrow$ Verified absent markers & bytes | `pytest`, `openpyxl` | Test-only | 166 |
| `tests/test_acceptance_workbooks.py` | Acceptance verification against primary anonymized institutional workbooks. | Test functions | `Result_anonymized.xlsx` $\rightarrow$ Verified student counts (145) | `pytest`, `app.core.ingest` | Test-only | 122 |
| `tests/test_api_schemas.py` | Validation tests ensuring Pydantic models reject invalid inputs and serialize correctly. | Test functions | Raw dictionaries $\rightarrow$ Verified Pydantic validation | `pytest`, `pydantic` | Test-only | 376 |
| `tests/test_data_quality.py` | Unit tests for data quality SQL rules on synthetic duplicate and corrupted data. | Test functions | Corrupted DB $\rightarrow$ Verified finding count | `pytest`, `app.core.data_quality` | Test-only | 108 |
| `tests/test_identity_resolution.py` | Tests student identification resolution by seat number, roll number, or exact/fuzzy name. | Test functions | Query strings $\rightarrow$ Resolved student ID or disambiguation | `pytest`, `app.reports.student_breakdown` | Test-only | 378 |
| `tests/test_ingest.py` | Unit tests for core ingestion engine, layout detection, and column header mapping. | Test functions | Sample workbooks $\rightarrow$ IngestionReport assertions | `pytest`, `app.core.ingest` | Test-only | 85 |
| `tests/test_mdm_electives.py` | Validates handling of multidisciplinary minor electives with sparse enrollment. | Test functions | Multi-elective workbook $\rightarrow$ Correct enrolled course counts | `pytest`, `app.core.ingest` | Test-only | 212 |
| `tests/test_phase10_acceptance_workflow.py` | Workflow acceptance tests covering upload staging, review decisions, and roster verification. | Test functions | Full workflow $\rightarrow$ Verified persistence | `pytest`, `app.services.import_manager` | Test-only | 227 |
| `tests/test_phase11_release_audit.py` | Release candidate audit verifying security boundaries, elective invariants, and reviews. | Test functions | Audit suites $\rightarrow$ Release readiness verification | `pytest` | Test-only | 355 |
| `tests/test_phase12_session_privacy.py` | Tests privacy-first temporary session isolation, concurrent sessions, and auto-cleanup. | Test functions | Ephemeral sessions $\rightarrow$ Verified disk isolation & cleanup | `pytest`, `app.services.session_manager` | Test-only | 364 |
| `tests/test_student_breakdown.py` | Tests student breakdown for toppers, failing students, absent records, and provenance. | Test functions | Student IDs $\rightarrow$ Verified mark component summations | `pytest`, `app.reports.student_breakdown` | Test-only | 169 |
| `tests/test_subject_failures.py` | Tests course-level failure aggregations, division breakdowns, and missing grade exclusions. | Test functions | Course codes $\rightarrow$ Verified pass/fail percentages | `pytest`, `app.reports.subject_failures` | Test-only | 161 |
| `tests/unit/test_anomaly_detection.py` | Unit tests for deterministic mismatches, robust Z-score MAD, and Isolation Forest. | Test functions | Synthetic marks $\rightarrow$ Verified anomaly classifications | `pytest`, `app.services.anomaly_detection` | Test-only | 201 |
| `tests/unit/test_phase6_classification.py` | Tests grade classification rules (pass, fail, absent, unresolved, conflicting). | Test functions | Raw grades/scores $\rightarrow$ Classified status | `pytest`, `app.core.ingest` | Test-only | 79 |
| `tests/unit/test_phase6_workbooks.py` | Tests workbook edge cases: empty sheets, single-row tables, uncalculated formula cells. | Test functions | Malformed workbooks $\rightarrow$ Safe rejection / handling | `pytest`, `openpyxl` | Test-only | 131 |

---

## 5. Evaluation & Benchmarking (`scripts/`)

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `scripts/evaluate_anomaly_detection.py` | Reproducible benchmark evaluating Deterministic, MAD, and Isolation Forest anomaly models. | `generate_synthetic_cohort`, `evaluate_deterministic_baseline`, `evaluate_isolation_forest` | Synthetic cohort (150 students, 21 anomalies) $\rightarrow$ Precision, Recall, FPR, Runtime report | `numpy`, `sklearn.ensemble`, `json`, `time` | Evaluation | 348 |

---

## 6. Training & ML Scaffolding

| Path | Purpose (1-2 sentences) | Key Functions / Classes | Inputs $\rightarrow$ Outputs | Imports / Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *No neural training files* | **Zero Neural Network / LLM Bloat:** EduQuery intentionally contains no neural network weights, PyTorch/TensorFlow models, fine-tuning datasets, or LoRA adapters. Unsupervised ML is strictly Scikit-Learn `IsolationForest` integrated at runtime in `app/services/anomaly_detection.py` and evaluated via `scripts/evaluate_anomaly_detection.py`. | None | None | None | Architectural Invariant | 0 |

---

## 7. Documentation (`docs/` and root `README.md`)

| Path | Purpose (1-2 sentences) | Key Content / Topics | Audience | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `README.md` | Primary project overview, feature matrix, installation instructions, and architecture diagrams. | Setup, features, API summary, hosting guide | Developers & Faculty | Active Docs | 266 |
| `docs/README.md` | Index and navigation table for all architectural and engineering documentation. | Document index and reading guide | Engineering team | Active Docs | 29 |
| `docs/anomaly-detection-methodology.md` | Theoretical and practical specification of the 3-tier anomaly detection pipeline. | Deterministic rules, MAD formulas, Isolation Forest hyperparams | ML Engineers & Architects | Active Docs | 92 |
| `docs/api-contract.md` | Exhaustive REST API specification detailing all endpoints, status codes, and schemas. | Endpoint tables, request/response JSON shapes | Frontend & Backend devs | Active Docs | 445 |
| `docs/architecture.md` | High-level system architecture, ingestion pipelines, database schemas, and threat model. | System diagrams, component boundaries, concurrency | System Architects | Active Docs | 151 |
| `docs/data-handling.md` | Ingestion invariants, paired-row layout specs, elective handling, and grade rules. | Excel cell parsing, uncalculated formulas, absent markers | Data Engineers | Active Docs | 88 |
| `docs/deployment.md` | Production deployment guide for Docker, Render, Vercel, and Cloudflare Access. | Container specifications, environment variables, health probes | DevOps & SysAdmins | Active Docs | 208 |
| `docs/development.md` | Local development setup guide, virtual environment setup, and test runner commands. | Local setup, Vite proxy, Pytest execution | Contributors | Active Docs | 132 |
| `docs/implementation-roadmap.md` | Historical roadmap documenting engineering milestones from Phase 1 through 13. | Phase milestones, deliverables, release gates | Product Management | Historical Docs | 87 |
| `docs/investigation-engine.md` | Technical specification of the ad-hoc query engine, predicate grammar, and SQL compilation. | Query AST, allowed fields, safe SQL translation | Backend Developers | Active Docs | 66 |
| `docs/product-reorientation.md` | Strategic rationale for pivoting from conversational LLM query bots to deterministic faculty analytics. | Problem analysis, LLM failure modes in marks calculation, determinism | Stakeholders | Strategy Docs | 92 |
| `docs/repository-cleanup-report.md` | Audit log documenting removal of legacy Streamlit apps, stale scripts, and dead code. | Cleaned assets, removed dependencies, verified tests | Quality Assurance | Historical Docs | 119 |
| `docs/security.md` | Security architecture detailing authentication, authorization, session isolation, and PII protection. | Cloudflare Access, API key enforcement, PII scrubbing | Security Auditors | Active Docs | 79 |
| `docs/testing.md` | Comprehensive testing strategy, fixture documentation, and coverage criteria. | Unit, API, and frontend test suites | Developers & QA | Active Docs | 107 |
| `docs/phase5-acceptance-report.md` | Verification report of Phase 5 acceptance testing across real institutional marksheets. | Test outcomes, dataset assertions | Engineering | Historical Docs | 169 |
| `docs/phase6-reliability-report.md` | Reliability verification covering rollbacks, exports, and concurrency. | Crash recovery, atomic pointer, multithreaded benchmarks | Engineering | Historical Docs | 174 |
| `docs/phase7-release-candidate-report.md`| End-to-end integration and release candidate verification report. | E2E test results, OpenAPI contract audit | Engineering | Historical Docs | 231 |
| `docs/phase8-implementation-report.md` | Documentation of frontend implementation phase. | Component architecture, responsive views | Frontend Team | Historical Docs | 60 |
| `docs/phase9-minimalist-design-report.md`| Design review and UI polish report implementing clean institutional aesthetic. | Design tokens, color contrast, layout improvements | Designers & Devs | Historical Docs | 173 |
| `docs/phase10-workflow-and-hosting-audit.md` | Hosting and deployment audit covering Render and Vercel infrastructure. | Cloud service configuration, proxy setups | DevOps | Historical Docs | 133 |
| `docs/phase11-release-candidate-report.md`| Comprehensive quality and security release gate audit. | Security audit, elective invariants, test matrix | Release Team | Historical Docs | 180 |
| `docs/phase12-product-and-privacy-report.md`| Product audit covering privacy-first temporary sessions and PII protections. | Ephemeral sessions, zero data retention mode | Privacy & Compliance | Historical Docs | 144 |
| `docs/phase13-deployment-gate-report.md`| Final pre-production deployment verification report. | Pre-flight checklists, production benchmarks | Release Team | Historical Docs | 189 |
| `frontend/README.md` | Frontend quickstart and development instructions. | Vite commands, Vitest execution | Frontend Devs | Active Docs | 32 |

---

## 8. Configuration & Deployment

| Path | Purpose (1-2 sentences) | Key Configuration Keys | Inputs $\rightarrow$ Outputs | Depends On | Status | Approx Lines |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `.dockerignore` | Specifies files and patterns excluded from Docker container build context. | Ignored paths (`node_modules`, `.git`, `.venv`) | Build context filter | Docker | Config | 24 |
| `.env.example` | Reference template declaring all configurable environment variables. | `EDUQUERY_ENV`, `EDUQUERY_DATA_DIR`, `EDUQUERY_DATABASE_PATH` | Reference | None | Config | 46 |
| `.gitignore` | Specifies git repository exclusion rules for caches, builds, and environments. | Python caches, Node dist, test output | Git filter | Git | Config | 58 |
| `Dockerfile` | Multi-stage production container build (Stage 1: Vite build; Stage 2: Python runtime). | `FROM node:20-alpine`, `FROM python:3.11-slim` | Source repo $\rightarrow$ Production container | Docker | Deploy | 57 |
| `pytest.ini` | Configures pytest test discovery paths, warning filters, and asyncio mode. | `testpaths = tests`, `asyncio_mode = strict` | Test runner options | Pytest | Config | 7 |
| `render.yaml` | Render Blueprint infrastructure specification for web service deployment. | Service type `web`, env `docker`, plan `free`, `/livez` health | Render cloud $\rightarrow$ Deployed service | Render Cloud | Deploy | 38 |
| `requirements.txt` | Python production runtime dependencies with version pins. | `duckdb`, `fastapi`, `uvicorn`, `openpyxl`, `sklearn` | Pip installer $\rightarrow$ Installed packages | Pip | Config | 14 |
| `vercel.json` | Root Vercel configuration routing build commands to frontend and rewriting SPA paths. | `buildCommand`, `outputDirectory`, `rewrites` | Vercel build $\rightarrow$ Hosted SPA | Vercel Edge | Deploy | 12 |
| `frontend/.env.example` | Frontend environment variable reference. | `VITE_API_BASE_URL` | Reference | Vite | Config | 5 |
| `frontend/.gitignore` | Frontend git exclusions (e.g., `dist/`, `node_modules/`). | Exclusions | Git | Git | Config | 24 |
| `frontend/.oxlintrc.json` | Linter configuration for Rust-based Oxlint. | Rule configurations | Oxlint | Oxlint | Config | 8 |
| `frontend/package.json` | Node.js project manifest, dependencies, and npm scripts. | `scripts` (`dev`, `build`, `test`), `dependencies` | npm install $\rightarrow$ Node modules | npm | Config | 33 |
| `frontend/package-lock.json` | Exact pinned dependency tree lockfile. | Pinned hashes & versions | npm | npm | Config | 3584 |
| `frontend/tsconfig.json` | TypeScript project reference configuration. | `references` | TypeScript compiler | TypeScript | Config | 7 |
| `frontend/tsconfig.app.json` | TypeScript compiler configuration for React application source. | `target: ES2022`, `jsx: react-jsx`, `strict: true` | TypeScript compiler | TypeScript | Config | 24 |
| `frontend/tsconfig.node.json`| TypeScript compiler configuration for Vite configuration files. | `target: ES2023` | TypeScript compiler | TypeScript | Config | 21 |
| `frontend/vercel.json` | Directory-level Vercel configuration for frontend builds. | `buildCommand: npm run build`, `outputDirectory: dist` | Vercel Edge | Vercel Edge | Deploy | 12 |
| `frontend/vite.config.ts` | Vite configuration specifying React plugin, Vitest environment, and dev proxy. | `plugins: [react()]`, `server.proxy` | Vite runner $\rightarrow$ Dev server / bundle | Vite, Vitest | Config | 24 |

