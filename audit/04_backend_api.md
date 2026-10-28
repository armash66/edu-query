# EduQuery Project Audit: 04 - Backend REST API Specification

## 1. REST API Endpoint Catalog

All analytical and administrative endpoints are versioned under `/api/v1` (with the exception of orchestrator health probes `/livez` and `/health`).

Authentication Modes:
- **Public / Temporary Session:** Session identified via `X-EduQuery-Session-Token` header or `eduquery_session` cookie.
- **Administrative Key Required:** Protected by `X-EduQuery-Import-Key` or `Authorization: Bearer <key>`.
- **Institutional Gateway (Optional):** Validated via `Cf-Access-Jwt-Assertion` header when enabled (`EDUQUERY_GATEWAY_AUTH_REQUIRED=true`).

---

### 1.1 Health & Liveness Probes

#### `GET /livez`
- **Purpose:** Minimal container liveness probe (used by Docker HEALTHCHECK and Render).
- **Authentication:** None.
- **Request Parameters / Body:** None.
- **Response Shape:**
  ```json
  {
    "status": "alive",
    "version": "3.0.0"
  }
  ```
- **Example cURL:**
  ```bash
  curl -s http://127.0.0.1:8000/livez
  ```

#### `GET /health`
- **Purpose:** Comprehensive deep health check verifying database connectivity, active dataset state, student tallies, and course counts.
- **Authentication:** None.
- **Response Shape:** `HealthResponse`
  ```json
  {
    "status": "healthy",
    "version": "3.0.0",
    "database": {
      "mode": "read_only_file",
      "connected": true,
      "students_count": 145,
      "courses_count": 27,
      "active_dataset_id": "dataset_20261022_215257_7dc1725c",
      "activated_at": "2026-10-22T21:52:57.439961+00:00"
    }
  }
  ```
- **Status Codes:** `200 OK` when healthy; `503 Service Unavailable` if database is uninitialized, missing, or disconnected.

---

### 1.2 Privacy-First Session Lifecycle (`/api/v1/session`)

#### `POST /api/v1/session/upload`
- **Purpose:** Uploads an Excel marksheet workbook into an ephemeral, isolated temporary session.
- **Authentication:** None.
- **Request:** `multipart/form-data` with field `file` containing `.xlsx` binary workbook.
- **Response Shape:**
  ```json
  {
    "status": "success",
    "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "mode": "temporary",
    "state": "staged",
    "filename": "Semester_Result_Synthetic.xlsx",
    "students_count": 120,
    "courses_count": 10,
    "can_confirm": true,
    "blocking_errors": [],
    "preview": {
      "sheets_discovered": ["Sheet1"],
      "layout_profile": {
        "rows_per_student": 2,
        "header_row": 5,
        "student_count": 120,
        "course_count": 10
      },
      "sample_students": [
        {
          "student_id": "SYNTH_001",
          "seat_no": "1001",
          "roll_no": "23101",
          "name": "[REDACTED_STUDENT_NAME]",
          "division": "A",
          "total_marks": 745.0,
          "result": "PASSES"
        }
      ]
    }
  }
  ```
- **Headers Returned:** Sets `X-EduQuery-Session-Token: 3fa85f64-5717-4562-b3fc-2c963f66afa6` and `Set-Cookie: eduquery_session=...; HttpOnly; SameSite=Lax`.

#### `POST /api/v1/session/confirm`
- **Purpose:** Activates the staged temporary session for analytical querying.
- **Authentication:** Session token in header or cookie.
- **Request Body (Optional):**
  ```json
  {
    "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```
- **Response Shape:**
  ```json
  {
    "status": "active",
    "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "message": "Temporary session activated successfully for analysis"
  }
  ```

#### `GET /api/v1/session/status`
- **Purpose:** Retrieves the current state and record counts of the active session.
- **Authentication:** Session token.
- **Response Shape:**
  ```json
  {
    "active": true,
    "session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "mode": "temporary",
    "students_count": 120,
    "courses_count": 10,
    "expires_at": "2026-10-28T14:25:00Z"
  }
  ```

#### `DELETE /api/v1/session`
- **Purpose:** Purges the temporary session directory and deletes all temporary DuckDB files.
- **Authentication:** Session token.
- **Response Shape:**
  ```json
  {
    "status": "success",
    "message": "Temporary session purged completely from server"
  }
  ```

---

### 1.3 Academic Analytics (`/api/v1/analytics`)

#### `GET /api/v1/analytics/overview`
- **Purpose:** High-level executive KPI metrics, pass/fail counts, and division benchmarks.
- **Authentication:** Session token.
- **Response Shape:** `AnalyticsOverviewResponse`
  ```json
  {
    "dataset_id": "dataset_20261022_215257_7dc1725c",
    "total_students": 145,
    "total_courses": 27,
    "pass_count": 132,
    "fail_count": 13,
    "pass_rate_percent": 91.03,
    "average_marks": 542.8,
    "highest_marks": 801.0,
    "topper_student": {
      "student_id": "23108B0012",
      "name": "[REDACTED_TOPPER_NAME]",
      "division": "B",
      "total_marks": 801.0
    },
    "divisions": [
      {
        "division": "A",
        "total_students": 85,
        "passed": 79,
        "failed": 6,
        "pass_rate": 92.94,
        "average_marks": 548.2
      },
      {
        "division": "B",
        "total_students": 60,
        "passed": 53,
        "failed": 7,
        "pass_rate": 88.33,
        "average_marks": 535.1
      }
    ],
    "unverified_anomalies_count": 4
  }
  ```

#### `GET /api/v1/analytics/distributions`
- **Purpose:** Frequency bins of student mark distributions and SGPI/grade counts.
- **Authentication:** Session token.
- **Response Shape:** `DistributionsResponse`
  ```json
  {
    "histogram_bins": [
      {"range_label": "300-399", "count": 12},
      {"range_label": "400-499", "count": 35},
      {"range_label": "500-599", "count": 52},
      {"range_label": "600-699", "count": 38},
      {"range_label": "700-799", "count": 7},
      {"range_label": "800-899", "count": 1}
    ],
    "grades_distribution": {
      "O": 18,
      "A": 44,
      "B": 51,
      "C": 19,
      "F": 13
    }
  }
  ```

---

### 1.4 Student Roster & Marksheet Breakdown (`/api/v1/students`)

#### `GET /api/v1/students`
- **Purpose:** Paginated student list supporting text search across names, seat numbers, roll numbers, and division filters.
- **Query Parameters:**
  - `page`: int (default: 1)
  - `page_size`: int (default: 20, max: 100)
  - `division`: string (optional, e.g. "A" or "B")
  - `result`: string (optional, e.g. "PASSES" or "FAILS")
  - `search`: string (optional search term)
- **Response Shape:** `PaginatedResponse[StudentSummaryItem]`
  ```json
  {
    "items": [
      {
        "student_id": "23108A0004",
        "seat_no": "1004",
        "roll_no": "23104",
        "name": "[REDACTED_NAME]",
        "division": "A",
        "total_marks": 612.0,
        "total_credits": 24.0,
        "result": "PASSES",
        "sgpi": 8.42,
        "failed_subjects_count": 0
      }
    ],
    "total": 145,
    "page": 1,
    "page_size": 20,
    "total_pages": 8
  }
  ```

#### `GET /api/v1/students/{identifier}`
- **Purpose:** Full transcript marksheet breakdown for an individual student. Supports lookups by student ID, seat number, roll number, or exact/fuzzy student name.
- **Response Shape:** `StudentBreakdownResponse`
  ```json
  {
    "student": {
      "student_id": "23108A0004",
      "seat_no": "1004",
      "roll_no": "23104",
      "name": "[REDACTED_NAME]",
      "division": "A",
      "total_marks": 612.0,
      "total_credits": 24.0,
      "result": "PASSES",
      "sgpi": 8.42
    },
    "courses": [
      {
        "course_code": "PCEC12T",
        "course_name": "COMMUNICATION SYSTEMS",
        "credits": 4.0,
        "letter_grade": "A",
        "status": "passed",
        "printed_total": 78.0,
        "computed_total": 78.0,
        "total_match": true,
        "components": [
          {"component": "IA", "value": 18.0, "max_marks": 20.0, "flag": null},
          {"component": "ESE", "value": 60.0, "max_marks": 80.0, "flag": null}
        ]
      }
    ],
    "disambiguation_candidates": []
  }
  ```
- **Disambiguation Response (HTTP 300 / Ambiguous Match):** If a name query matches multiple students, `courses` is empty and `disambiguation_candidates` contains matching student summaries.

---

### 1.5 Curriculum & Course Performance (`/api/v1/subjects`)

#### `GET /api/v1/subjects`
- **Purpose:** Lists all curriculum subjects with enrollment counts and pass/fail statistics.
- **Response Shape:** `list[CourseItem]`
  ```json
  [
    {
      "code": "PCEC12T",
      "name": "COMMUNICATION SYSTEMS",
      "credits": 4.0,
      "enrolled_count": 145,
      "passed_count": 133,
      "failed_count": 12,
      "failure_rate": 8.28
    }
  ]
  ```

#### `GET /api/v1/subjects/{course_code}/students`
- **Purpose:** Filterable student roster enrolled in a specific subject.
- **Query Parameters:**
  - `status`: string (optional: `all`, `passed`, `failed`, `absent`)
  - `search`: string (optional: filter by name or roll number)
  - `division`: string (optional: "A", "B")
- **Response Shape:** `SubjectStudentsResponse`
  ```json
  {
    "course_code": "PCEC12T",
    "course_name": "COMMUNICATION SYSTEMS",
    "total_enrolled": 145,
    "students": [
      {
        "student_id": "23108A0015",
        "seat_no": "1015",
        "roll_no": "23115",
        "name": "[REDACTED_NAME]",
        "division": "A",
        "letter_grade": "F",
        "status": "failed",
        "printed_total": 31.0,
        "computed_total": 31.0,
        "components_text": "IA: 11, ESE: 20"
      }
    ],
    "total": 12
  }
  ```

#### `GET /api/v1/subjects/absent`
- **Purpose:** Classwide audit roster of all students possessing absence markers (`AB`, `ABS`).
- **Query Parameters:**
  - `limit`: int (default: 50, max: 100)
  - `offset`: int (default: 0)
  - `division`: string (optional)
  - `course_code`: string (optional)
  - `search`: string (optional)
- **Response Shape:** `PaginatedResponse[AbsentStudentItem]`

---

### 1.6 Interactive Investigation Engine (`/api/v1/investigation`)

#### `POST /api/v1/investigation/query`
- **Purpose:** Executes safe, parameterized ad-hoc boolean filter queries.
- **Request Shape:** `InvestigationQueryRequest`
  ```json
  {
    "conditions": [
      {
        "field": "division",
        "operator": "eq",
        "value": "A"
      },
      {
        "field": "status",
        "operator": "eq",
        "value": "failed"
      }
    ],
    "combinator": "and",
    "limit": 50,
    "offset": 0
  }
  ```
- **Allowed Fields:** `division`, `status`, `result`, `total_marks`, `sgpi`, `failed_count`, `course_code`.
- **Allowed Operators:** `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`.
- **Response Shape:** `InvestigationQueryResponse` (matching student records with active predicate chips and pagination).

---

## 2. Vercel Serverless Architecture & Entry Point Analysis

### Important Architectural Reality:
EduQuery **does not use Vercel Serverless Functions (Python `api/` handlers)**. The backend runs exclusively on **Render** inside a containerized Uvicorn ASGI server. Vercel serves solely as a Global Edge CDN for the compiled Vite React Single Page Application.

### Root `vercel.json` (Verbatim)
From [vercel.json](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/vercel.json):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Frontend `frontend/vercel.json` (Verbatim)
From [frontend/vercel.json](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/vercel.json):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Architectural Rationale for Running on Render Instead of Vercel Serverless:
1. **DuckDB Native Binaries:** DuckDB requires native C++ shared libraries (`_duckdb.cpython-*.so`). In standard AWS Lambda / Vercel Serverless runtimes, native extensions face strict binary compatibility limits and cold-start unpack latency.
2. **Columnar Database File Locks & Connection Caching:** DuckDB manages POSIX file locks. Serverless functions spin up ephemeral frozen execution contexts where file locks and multi-process concurrency can collide. On Render, a long-lived process caches read-only DuckDB connection pools.
3. **Session Filesystem Persistence:** Temporary analysis sessions store an isolated DuckDB file in `/tmp/eduquery-sessions/{session_id}`. On serverless architectures, `/tmp` is wiped across invocations or routed to different execution containers, breaking multi-request session persistence unless backed by external S3/Redis infrastructure.

---

## 3. Cold Start & Import Lifecycle Analysis

### Dependencies (`requirements.txt` Verbatim)
```
# EduQuery V3 — Core Dependencies (Zero Neural/LLM Bloat)
duckdb>=1.0.0
openpyxl>=3.1.2
pandas>=2.2.0
numpy>=1.26.0
pytest>=8.0.0
pydantic>=2.6.0
fastapi>=0.110.0
uvicorn>=0.28.0
httpx>=0.27.0
python-multipart>=0.0.9
scikit-learn>=1.4.0
pyjwt>=2.8.0
cryptography>=42.0.0
```

### Cold-Start Bottlenecks & Heavy Imports

| Library / Module | Import Latency (Approx) | What Runs at Import Time | Cold Start Impact |
| :--- | :--- | :--- | :--- |
| **`duckdb`** | ~180 ms | Loads C++ binary engine (`_duckdb.pyd` / `.so`), registers vector types | Moderate |
| **`sklearn.ensemble`** | ~350 ms | Compiles Cython trees, imports scipy/numpy BLAS matrix bindings | Heavy |
| **`pandas` & `numpy`** | ~240 ms | Inits NumPy C-API, BLAS/LAPACK threads, timezone tables | Moderate |
| **`cryptography`** | ~110 ms | Loads OpenSSL C-bindings (`_cffi_backend`) | Low-Moderate |
| **`openpyxl`** | ~80 ms | Prepares XML schema parsers and styling registries | Low |
| **Total Import Chain:** | **~960 ms** | App factory setup, router compilation, pointer file recovery | **~1.1 seconds** |

### Free-Tier Hosting Latency Profile:
- **Application Startup (Process execution):** ~1.1 to 1.8 seconds.
- **Render Free-Tier Spin-Up Delay:** ~50 to 55 seconds (Render halts free-tier containers after 15 minutes of inactivity; waking up involves spinning up a container instance, pulling layers, starting Uvicorn, and passing `/livez`).
- **Warm In-Process Execution Time:** Analytical queries execute in 15 to 45 ms once warm.

