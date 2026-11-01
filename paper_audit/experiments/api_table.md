| Method | Path | Summary / Description | Tags |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/absent-students` | Get Absent Students Route | students |
| `GET` | `/api/v1/absent-students/export` | Export Absent Students Excel Route | students |
| `GET` | `/api/v1/absent-students/export-excel` | Export Absent Students Excel Route | students |
| `POST` | `/api/v1/ai/ask` | Translate natural query into schema predicate AST and execute deterministically | AI Assistant |
| `GET` | `/api/v1/ai/hod-brief` | Generate 1-page executive performance brief verified against ground-truth facts | AI Assistant |
| `POST` | `/api/v1/ai/notice-draft` | Generate institutional notice template with placeholders | AI Assistant |
| `GET` | `/api/v1/analytics/distributions` | Get Distributions Endpoint | Analytics |
| `GET` | `/api/v1/analytics/division-comparison` | Get Division Comparison Endpoint | Analytics |
| `GET` | `/api/v1/analytics/failure-patterns` | Get Failure Patterns Endpoint | Analytics |
| `GET` | `/api/v1/analytics/overview` | Get Overview Endpoint | Analytics |
| `GET` | `/api/v1/analytics/registry` | Get Registry Endpoint | Analytics |
| `GET` | `/api/v1/anomalies/evaluation` | Get empirical research evaluation report comparing deterministic, statistical, and ML baselines | Anomaly Detection |
| `GET` | `/api/v1/anomalies/findings` | List paginated explainable academic anomaly findings with optional filters | Anomaly Detection |
| `POST` | `/api/v1/anomalies/findings/{finding_id}/review` | Update faculty review status and moderation notes for an anomaly finding | Anomaly Detection |
| `POST` | `/api/v1/anomalies/students/{student_id}/review` | Update faculty review status for all anomaly findings concerning a specific student | Anomaly Detection |
| `GET` | `/api/v1/anomalies/summary` | Get aggregated anomaly detection metrics across deterministic, statistical, and ML methods | Anomaly Detection |
| `GET` | `/api/v1/data-quality` | Get Data Quality Route | Data Quality |
| `POST` | `/api/v1/data-quality/review` | Record Quality Review Route | Data Quality |
| `POST` | `/api/v1/imports/confirm` | Confirm Workbook Import | Imports |
| `POST` | `/api/v1/imports/preview` | Preview Workbook Upload | Imports |
| `POST` | `/api/v1/imports/rollback` | Rollback Dataset | Imports |
| `GET` | `/api/v1/imports/versions` | Get Dataset Versions List | Imports |
| `GET` | `/api/v1/imports/{import_id}` | Get Import Status | Imports |
| `GET` | `/api/v1/investigation/capabilities` | Get supported investigation fields, operators, and dataset options | Investigation Engine |
| `POST` | `/api/v1/investigation/export-csv` | Download unpaginated formula-safe CSV export of matching investigation records | Investigation Engine |
| `POST` | `/api/v1/investigation/export-excel` | Download unpaginated Excel .xlsx export of matching investigation records | Investigation Engine |
| `POST` | `/api/v1/investigation/export/xlsx` | Download unpaginated Excel .xlsx export of matching investigation records (alias) | Investigation Engine |
| `POST` | `/api/v1/investigation/query` | Execute multi-condition investigation query with live count and pagination | Investigation Engine |
| `GET` | `/api/v1/overview/summary` | Get Overview Summary Endpoint | Overview |
| `GET` | `/api/v1/reports/analysis-dossier/export` | Export Analysis Report Route | Reports |
| `GET` | `/api/v1/reports/analysis-report/export` | Export Analysis Report Route | Reports |
| `GET` | `/api/v1/reports/backlogs/export` | Export Backlogs Route | Reports |
| `GET` | `/api/v1/reports/hod-brief/export-pdf` | Export Hod Brief Pdf Route | Reports |
| `GET` | `/api/v1/reports/mail-merge/export` | Export Mail Merge Route | Reports |
| `GET` | `/api/v1/reports/merit-list/export` | Export Merit List Route | Reports |
| `GET` | `/api/v1/reports/slips` | Get Student Slips Route | Reports |
| `GET` | `/api/v1/reports/slips/export-pdf` | Export Student Slips Pdf Route | Reports |
| `DELETE` | `/api/v1/session` | Permanently delete current temporary session and all server-side records | Analysis Session |
| `POST` | `/api/v1/session/confirm` | Confirm preview and activate the temporary session for analysis | Analysis Session |
| `POST` | `/api/v1/session/delete` | Permanently delete current temporary session (POST fallback) | Analysis Session |
| `POST` | `/api/v1/session/download-ticket` | Generate a single-use short-lived ticket for direct file downloads | Analysis Session |
| `POST` | `/api/v1/session/sample` | Load anonymized sample dataset for instant analysis exploration | Analysis Session |
| `POST` | `/api/v1/session/save` | Explicit opt-in to save current temporary dataset to institutional storage | Analysis Session |
| `GET` | `/api/v1/session/status` | Check current active session or permanent dataset status | Analysis Session |
| `POST` | `/api/v1/session/upload` | Upload marksheet into an isolated temporary analysis session | Analysis Session |
| `GET` | `/api/v1/students` | Get Students | Students |
| `GET` | `/api/v1/students/absent` | Get Absent Students Route | Students |
| `GET` | `/api/v1/students/absent/components` | Get Absent Components Route | Students |
| `GET` | `/api/v1/students/absent/export` | Export Absent Students Excel Route | Students |
| `GET` | `/api/v1/students/absent/export-excel` | Export Absent Students Excel Route | Students |
| `GET` | `/api/v1/students/absent/export/xlsx` | Export Absent Students Excel Route | Students |
| `GET` | `/api/v1/students/early-warning` | Get pre-ESE at-risk early warning roster | Students |
| `GET` | `/api/v1/students/export` | Export Students Route | Students |
| `GET` | `/api/v1/students/export-excel` | Export Students Excel Route | Students |
| `GET` | `/api/v1/students/export/xlsx` | Export Students Excel Route | Students |
| `GET` | `/api/v1/students/subject-toppers` | Get division-wise highest scorers for each subject | Students |
| `GET` | `/api/v1/students/{identifier}/breakdown` | Get Student Breakdown Route | Students |
| `GET` | `/api/v1/students/{identifier}/export` | Export Student Breakdown Route | Students |
| `GET` | `/api/v1/students/{identifier}/export-excel` | Export Student Breakdown Excel Route | Students |
| `GET` | `/api/v1/subjects` | Get Subjects | Subjects |
| `GET` | `/api/v1/subjects/absent/export` | Export Absent Subjects Excel Route | Subjects |
| `GET` | `/api/v1/subjects/absent/export/xlsx` | Export Absent Subjects Excel Route | Subjects |
| `GET` | `/api/v1/subjects/failure-summary` | Get Failure Summary | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/export-csv` | Export Course Students Csv Route | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/export-excel` | Export Course Students Excel Route | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/export-pdf` | Export Course Students Pdf Route | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/failures` | Get Course Failures | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/failures/export` | Export Course Failures Route | Subjects |
| `GET` | `/api/v1/subjects/{course_code}/students` | Get Course Students Route | Subjects |
| `GET` | `/health` | Health Check | Health |
| `GET` | `/livez` | Liveness probe for container orchestration | Health |
| `GET` | `/readyz` | Readiness probe for container orchestration | Health |