# EduQuery — REST API Specification & Contract

## 1. Global API Conventions

### Base Path & Versioning
- All API routes (except the root liveness probe `GET /health`) are versioned under the `/api/v1` namespace.
- Format: JSON over HTTP/1.1 or HTTP/2.
- Character Encoding: UTF-8.

### Standard HTTP Status Codes

| Status Code | Meaning | Usage in EduQuery |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Request succeeded; response payload contains requested entity or report. |
| **`400 Bad Request`** | Client Error | Malformed query parameter, invalid division filter, or invalid pagination limits. |
| **`401 Unauthorized`** | Auth Missing/Invalid | Missing or invalid administrative import API key credentials. |
| **`404 Not Found`** | Resource Missing | Non-existent student ID, seat number, course code, or import session. |
| **`409 Conflict`** | Ambiguous Match / Conflict | Query matches multiple candidates, import session is expired, or blocking errors prevent activation. |
| **`413 Content Too Large`** | Size Exceeded | Uploaded workbook exceeds configured maximum upload size limit (default 25 MiB). |
| **`415 Unsupported Type`** | Format Unsupported | File extension is not `.xlsx` or magic bytes do not represent a valid OpenXML zip container. |
| **`422 Unprocessable`** | Validation Error | Request parameters failed validation, or workbook layout could not be parsed. |
| **`500 Server Error`** | Internal Failure | Unexpected server-side exception; returns generic error envelope without leaking stack traces or internal paths. |
| **`503 Unavailable`** | Service Unavailable | Database uninitialized, or import operations disabled due to missing configuration key. |

### Standard Error Response Envelopes

#### 1. Generic Client / Server Error
```json
{
  "status": "error",
  "error_code": "INVALID_PARAMETER",
  "message": "Division filter must be a non-empty string",
  "details": ["Parameter 'division' cannot be blank"]
}
```

#### 2. Not Found Envelope (`404 Not Found`)
```json
{
  "status": "not_found",
  "error_code": "STUDENT_NOT_FOUND",
  "query": "UNKNOWN_ID_999",
  "message": "No student record matched identifier 'UNKNOWN_ID_999'"
}
```

#### 3. Ambiguous Query Envelope (`409 Conflict`)
```json
{
  "status": "ambiguous",
  "error_code": "AMBIGUOUS_STUDENT_QUERY",
  "query": "Sharma",
  "message": "Query matches multiple students. Disambiguation required.",
  "candidates": [
    {
      "student_id": "STU_Alpha_01",
      "name": "Aarav Sharma",
      "seat_no": "SEAT-99A",
      "roll_no": "101",
      "division": "A"
    },
    {
      "student_id": "STU_Beta_02",
      "name": "Bhavya Sharma",
      "seat_no": "SEAT-99B",
      "roll_no": "102",
      "division": "A"
    }
  ]
}
```

---

## 2. Route Specifications

### 1. System Health & Liveness Probe

- **Endpoint**: `GET /health`
- **Purpose**: Liveness and readiness inspection for monitoring and deployment orchestrators.
- **Parameters**: None.
- **Response Schema (`200 OK`)**:
  ```json
  {
    "status": "healthy",
    "version": "3.0.0",
    "database": {
      "mode": "read_only",
      "connected": true,
      "students_count": 145,
      "courses_count": 27
    }
  }
  ```

---

### 2. Student Roster Listing & Search

- **Endpoint**: `GET /api/v1/students`
- **Purpose**: Paginated listing and filtering of students across the ingested marksheet.
- **Query Parameters**:
  - `query` (optional string): Case-insensitive partial name, roll number, seat number, or student ID.
  - `division` (optional string): Filter by division (e.g. `A`, `B`).
  - `result` (optional string): Filter by overall marksheet outcome (`PASSES`, `FAILS`, etc.).
  - `limit` (int, default `50`, min `1`, max `100`): Pagination page size.
  - `offset` (int, default `0`, min `0`): Pagination offset.
- **Response Schema (`200 OK`)**:
  ```json
  {
    "total": 145,
    "limit": 50,
    "offset": 0,
    "items": [
      {
        "student_id": "23108A0001",
        "seat_no": "5123401",
        "roll_no": "1",
        "name": "Advait Pandey",
        "division": "A",
        "level": "UG",
        "total_marks": 801.0,
        "overall_result": "PASSES",
        "sgpi": 9.85,
        "cgpa": 9.72
      }
    ]
  }
  ```

---

### 3. Student Performance Breakdown

- **Endpoint**: `GET /api/v1/students/{identifier}/breakdown`
- **Purpose**: Exhaustive subject-wise pass/fail breakdown, component scores, and reconciliation for a single resolved student.
- **Path Parameter**:
  - `identifier` (string, required): Case-insensitive student ID, seat number, roll number, or exact/partial student name.
- **Resolution Precedence**:
  1. Exact / case-insensitive `student_id`.
  2. Exact / case-insensitive `seat_no`.
  3. Exact / trimmed `roll_no`.
  4. Exact case-insensitive `name`.
  5. Substring `name` with literal wildcard escaping.
- **Response Statuses**:
  - **`200 OK`**: Unique student resolved.
  - **`404 Not Found`**: No student matches query.
  - **`409 Conflict`**: Multiple candidates match; returns `AmbiguousStudentResponse`.
- **Response Schema (`200 OK`)**:
  ```json
  {
    "status": "success",
    "query": "23108a0032",
    "student": {
      "student_id": "23108A0032",
      "seat_no": "5123432",
      "roll_no": "32",
      "name": "Anonymized Student 32",
      "email": null,
      "division": "A",
      "level": "UG",
      "overall_result": "FAILS",
      "total_marks": 542.0,
      "total_credits": 24.0,
      "sgpi": 0.0,
      "cgpa": null
    },
    "total_enrolled": 12,
    "passed_count": 10,
    "failed_count": 2,
    "unresolved_count": 0,
    "subjects": [
      {
        "course_code": "PCEC12T",
        "course_name": "THEORY OF COMPUTER SCIENCE",
        "kind": "theory",
        "credits": 4.0,
        "components": {
          "ESE": {
            "component": "ESE",
            "marks": 18.0,
            "flag": "F",
            "state": "marked",
            "raw_text": "18 F"
          },
          "IA": {
            "component": "IA",
            "marks": 14.0,
            "flag": null,
            "state": "marked",
            "raw_text": "14"
          }
        },
        "total_marks": 32.0,
        "computed_marks_sum": 32.0,
        "total_match": true,
        "letter_grade": "F",
        "recorded_result": "failed",
        "flags": ["F"],
        "is_absent": false,
        "has_missing_marks": false,
        "has_uncalculated_total": false
      }
    ]
  }
  ```

---

### 4. Subject Catalog Listing

- **Endpoint**: `GET /api/v1/subjects`
- **Purpose**: List all academic subjects discovered in the marksheet catalog.
- **Query Parameters**:
  - `kind` (optional string): Filter by `theory` or `practical`.
  - `division` (optional string): Filter courses active for a specific division.
  - `limit` (int, default `50`), `offset` (int, default `0`).
- **Response Schema (`200 OK`)**:
  ```json
  {
    "total": 27,
    "limit": 50,
    "offset": 0,
    "items": [
      {
        "code": "PCEC12T",
        "name": "THEORY OF COMPUTER SCIENCE",
        "kind": "theory",
        "credits": 4.0,
        "components": ["IA", "ESE", "TOT1"],
        "enrolled_students_count": 145
      }
    ]
  }
  ```

---

### 5. Curriculum-Wide Subject Failure Summary

- **Endpoint**: `GET /api/v1/subjects/failure-summary`
- **Path Structure Note**:
  - This route has **2 path segments** (`subjects`, `failure-summary`).
  - Route 6 (`/subjects/{course_code}/failures`) has **3 path segments** (`subjects`, `{course_code}`, `failures`).
  - In Starlette / FastAPI routing, routes with different segment counts do not collide. Nevertheless, best practice dictates declaring static paths before parameterized path templates.
- **Query Parameters**:
  - `division` (optional string): Filter failure statistics by division (e.g. `?division=A`).
- **Response Schema (`200 OK`)**:
  ```json
  {
    "division_filter": null,
    "total_courses_evaluated": 27,
    "summary": [
      {
        "course_code": "PCEC12T",
        "course_name": "THEORY OF COMPUTER SCIENCE",
        "credits": 4.0,
        "kind": "theory",
        "division_filter": null,
        "total_enrolled": 145,
        "confirmed_failures_count": 12,
        "passed_count": 133,
        "unresolved_count": 0,
        "failure_rate_percent": 8.28
      }
    ]
  }
  ```

---

### 6. Subject-Wise Failure Roster & Component Diagnostics

- **Endpoint**: `GET /api/v1/subjects/{course_code}/failures`
- **Purpose**: Complete list of students who failed the specified course, with component breakdown.
- **Path Parameter**:
  - `course_code` (string, required): Course code (e.g. `PCEC12T`) or course name substring.
- **Query Parameters**:
  - `division` (optional string): Filter roster by division (`A` or `B`).
  - `limit` (int, default `50`, min `1`, max `100`), `offset` (int, default `0`, min `0`).
- **Ground-Truth Invariants**:
  - Verified on `Result_anonymized.xlsx`:
    - Class-wide: `145` enrolled, `12` confirmed failures (8.28%).
    - Division A (`?division=A`): `85` enrolled, `10` confirmed failures (11.76%).
    - Division B (`?division=B`): `60` enrolled, `2` confirmed failures (3.33%).
    - Total confirmed failures reconcile: $10 + 2 = 12$.
- **Response Schema (`200 OK`)**:
  ```json
  {
    "status": "success",
    "course_code": "PCEC12T",
    "course_name": "THEORY OF COMPUTER SCIENCE",
    "division_filter": "A",
    "credits": 4.0,
    "kind": "theory",
    "total_enrolled": 85,
    "confirmed_failures_count": 10,
    "passed_count": 75,
    "unresolved_count": 0,
    "failure_rate_percent": 11.76,
    "limit": 50,
    "offset": 0,
    "failing_students": [
      {
        "student_id": "23108A0032",
        "name": "Anonymized Student 32",
        "roll_no": "32",
        "seat_no": "5123432",
        "division": "A",
        "course_code": "PCEC12T",
        "course_name": "THEORY OF COMPUTER SCIENCE",
        "total_marks": 32.0,
        "letter_grade": "F",
        "flags": ["F"],
        "is_absent": false,
        "components": {
          "ESE": {
            "component": "ESE",
            "marks": 18.0,
            "flag": "F",
            "state": "marked",
            "raw_text": "18 F"
          },
          "IA": {
            "component": "IA",
            "marks": 14.0,
            "flag": null,
            "state": "marked",
            "raw_text": "14"
          }
        }
      }
    ]
  }
  ```

---

### 7. Marksheet Data Quality & Anomaly Report

- **Endpoint**: `GET /api/v1/data-quality`
- **Purpose**: Overall marksheet integrity score, count of anomalies, and detailed audit findings.
- **Scoring Semantics (Deterministic Rule Penalty)**:
  - Base score: `100.0`.
  - Penalties: `error` finding subtracts `25.0` points; `warning` finding subtracts `10.0` points; `info` finding applies `0.0` penalty.
  - Formula: $\text{quality\_score} = \max(0.0, 100.0 - (25.0 \times N_{\text{error}} + 10.0 \times N_{\text{warning}}))$.
  - Health status mapping:
    - `"Critical"` if $N_{\text{error}} > 0$.
    - `"Needs Attention"` if $N_{\text{error}} = 0$ and $N_{\text{warning}} > 0$.
    - `"Good"` if $N_{\text{error}} = 0$ and $N_{\text{warning}} = 0$.
  - Empty dataset: When the database contains 0 student records, returns `session_id="empty"`, `total_checks=0`, `quality_score=100.0`, and a single informational finding with `check_id="empty_dataset"`.
- **Parameters**: None.
- **Response Schema (`200 OK`)**:
  ```json
  {
    "session_id": "Result_anonymized",
    "health_status": "Good",
    "quality_score": 98.5,
    "total_checks": 7,
    "error_count": 0,
    "warning_count": 1,
    "info_count": 0,
    "findings": [
      {
        "check_id": "INCONSISTENT_TOTALS",
        "severity": "warning",
        "title": "Sum of component marks does not match printed course total",
        "count": 3,
        "problem": "Computed sum differs from printed marksheet total",
        "impact": "Possible transcript discrepancy",
        "recommended_action": "Verify printed marksheet row against manual grading sheets",
        "details": ["Student 23108A0045 course PCEC14T: printed 45, computed 44"]
      }
    ]
  }
  ```

---

### 2.5 Workbook Import & Activation Endpoints (Phase 3.4)

#### 1. Upload & Generate Safe Preview (`POST /api/v1/imports/preview`)
Uploads a candidate marksheet workbook, ingests it into an isolated candidate database, runs the full academic data-quality audit, and generates a safe preview without mutating the active production dataset.

- **Content-Type**: `multipart/form-data`
- **Authentication**: Required (`X-EduQuery-Import-Key: <key>` or `Authorization: Bearer <key>`)
- **Parameters**: `file` (binary form field containing `.xlsx` workbook)
- **Response Schema (`200 OK`)**:
  ```json
  {
    "import_id": "8f828a2b530549c7ab56a3106368d1ab",
    "state": "preview_ready",
    "created_at": "2026-10-17T18:00:00Z",
    "expires_at": "2026-10-17T19:00:00Z",
    "workbook": {
      "filename": "commerce_marksheet.xlsx",
      "file_size_bytes": 20865,
      "sha256": "4a72d73b0a70195a6c3f683411b2cf47eef03dbdf6485078516d2ca010f37b71",
      "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    "layout": {
      "strategy": "paired_row",
      "sheets_inspected": ["Sheet1"],
      "sheets_accepted": ["Sheet1"],
      "sheets_skipped": []
    },
    "students_count": 60,
    "courses_count": 10,
    "scores_count": 2280,
    "enrollment_count": 600,
    "reconciliation_count": 600,
    "data_quality": {
      "health_status": "Good",
      "quality_score": 100.0,
      "total_checks": 8,
      "error_count": 0,
      "warning_count": 0,
      "info_count": 0,
      "findings": []
    },
    "can_confirm": true,
    "blocking_errors": [],
    "active_dataset_changed": false
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid administrative import key.
  - `413 Content Too Large`: File exceeds configured maximum size (default 25 MiB).
  - `415 Unsupported Media Type`: Non-xlsx extension, missing PK zip magic bytes, or invalid OpenXML container.
  - `422 Unprocessable Content`: Empty upload, corrupt spreadsheet XML, zero accepted student records.
  - `503 Service Unavailable`: Administrative key not configured (`EDUQUERY_IMPORT_API_KEY`).

#### 2. Confirm & Atomically Activate Import (`POST /api/v1/imports/confirm`)
Validates candidate database integrity, promotes the candidate to persistent versioned storage, atomically updates the active dataset pointer, and hot-swaps the runtime query connection.

- **Content-Type**: `application/json`
- **Authentication**: Required (`X-EduQuery-Import-Key: <key>` or `Authorization: Bearer <key>`)
- **Request Body**:
  ```json
  {
    "import_id": "8f828a2b530549c7ab56a3106368d1ab"
  }
  ```
- **Response Schema (`200 OK`)**:
  ```json
  {
    "import_id": "8f828a2b530549c7ab56a3106368d1ab",
    "state": "activated",
    "activated_at": "2026-10-17T18:05:00Z",
    "students_count": 60,
    "courses_count": 10,
    "active_dataset_id": "dataset_20261017_180500_8f828a2b",
    "message": "Workbook dataset successfully activated. All subsequent queries will target this dataset."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid administrative import key.
  - `404 Not Found`: Import session does not exist or has expired.
  - `409 Conflict`: Session expired, candidate contains blocking validation errors, or invalid state.
  - `422 Unprocessable Content`: Candidate database failed pre-activation schema and table verification.
  - `500 Server Error`: Promotion or pointer file swap failed; active dataset remains unchanged.

#### 3. Inspect Import Session (`GET /api/v1/imports/{import_id}`)
Retrieves metadata and current status for an ongoing or completed import session.

- **Authentication**: Required (`X-EduQuery-Import-Key: <key>` or `Authorization: Bearer <key>`)
- **Response Schema (`200 OK`)**: Session metadata object.
- **Error Responses**: `401 Unauthorized`, `404 Not Found`, `503 Service Unavailable`.

---

## 3. Privacy, Data Safety & Provenance Rules

1. **Denominators for Electives**:
   - The total enrolled count (`total_enrolled`) in failure reports represents strictly the students who are enrolled in that specific course (`len(enrollment where course_code = ?)`), **never** the total student count of the entire college.
2. **Reconciliation Fields**:
   - APIs expose both `total_marks` (printed marksheet value) and `computed_marks_sum` (sum of component scores) so faculty can verify audit integrity.
3. **Component States**:
   - Valid component states exposed in responses: `marked`, `not_enrolled`, `uncalculated`, `flagged`, `unparsed`.
   - Blank and zero marks are strictly separated: a blank or uncalculated score has `marks=None` and `state="uncalculated"`, whereas a true numerical zero has `marks=0.0` and `state="marked"`.
4. **Administrative Import Key Safeguard (Phase 3.4)**:
   - Workbook preview and confirmation require administrative credentials via `X-EduQuery-Import-Key` or `Authorization: Bearer <key>`.
   - Credential verification uses constant-time string comparison (`secrets.compare_digest`) to prevent timing side-channels.
   - Keys are never logged, returned in responses, or committed to source control.
   - If `EDUQUERY_IMPORT_API_KEY` is not set, import operations are disabled with HTTP 503 `IMPORT_DISABLED`.
   - This provides an essential development guardrail protecting dataset integrity prior to multi-tenant role-based access control (RBAC).
