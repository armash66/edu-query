# Interactive Academic Investigation Engine — Specification & Implementation

## 1. Overview & Purpose

The **Interactive Academic Investigation Engine** in EduQuery replaces rigid, disconnected administrative filters with a flexible, validated multi-condition query builder. It enables faculty members to explore cohort performance, discover co-failing patterns, isolate students by marks or SGPI bands, and drill down into supporting academic evidence.

---

## 2. Query Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   Frontend (React 19 + TypeScript)              │
│  - Quick Presets Strip (Failing 2+, Confirmed Failures, Divs)     │
│  - Multi-Condition Builder (Field, Operator, Value, Remove)      │
│  - Logic Toggle: Match ALL (AND) vs Match ANY (OR)               │
│  - Active Condition Chips with 1-click removal                   │
│  - AbortController Request Cancellation                          │
│  - Synchronized non-sensitive URL search parameters              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ POST /api/v1/investigation/query
                                 │ (Typed Pydantic Request)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Backend Investigation Service                  │
│  - Field & Operator Whitelist Validation (Strict Pydantic)       │
│  - Complexity Limits: Max 10 conditions per group                │
│  - Parameterized DuckDB SQL Generation (? parameters)            │
│  - Deterministic Ordering: NULLS LAST, student_id ASC            │
│  - Human-readable Active Explanation Generation                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Parameterized SQL
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                        DuckDB Analytical DB                      │
│  - Exact Matching Headcount Query                                │
│  - Deterministic Paginated Row Retrieval                         │
│  - Formula-Safe CSV Export Streaming                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Supported Fields, Operators, and Semantics

The investigation engine restricts query construction to validated fields with documented academic semantics:

| Field | Data Type | Supported Operators | Academic Semantics |
| :--- | :--- | :--- | :--- |
| `division` | Choice (`A`, `B`, `C`) | `eq`, `neq`, `in` | Official classroom division assigned to the student. |
| `result` | Choice (`PASSES`, `FAILS`, `UNRESOLVED`) | `eq`, `neq`, `in` | Official or verified academic outcome. |
| `course_code` | Choice (e.g. `PCEC12T`, `MDM01`) | `eq`, `neq`, `in` | Enrolled subject verified in curriculum enrollment table. |
| `failed_subject_count` | Number ($0 \le N \le 20$) | `gte`, `lte`, `eq` | Number of distinct courses where student has an active failing grade or flag. |
| `multi_fails` | Boolean (`true` / `false`) | `eq` | Fast indicator for students failing 2 or more distinct courses. |
| `total_marks` | Number ($0 \le M \le 1000$) | `gte`, `lte`, `eq`, `between` | Sum of student's marks across enrolled subjects. |
| `sgpi` | Number ($0 \le \text{SGPI} \le 10$) | `gte`, `lte`, `eq`, `between` | Semester Grade Performance Index. |
| `cgpa` | Number ($0 \le \text{CGPA} \le 10$) | `gte`, `lte`, `eq`, `between` | Cumulative Grade Point Average. |
| `student_id` | String | `contains`, `eq` | Unique student roll number or institutional key. |
| `name` | String | `contains`, `eq` | Student legal or marksheet name. |

---

## 4. Parameterized SQL Translation & Safety

Arbitrary SQL injection is completely prevented through multiple layers of defense:

1. **Strict Whitelisting**: Field names and operators must match Pydantic `Literal` definitions. Unrecognized fields are rejected at the FastAPI boundary with HTTP 422.
2. **Parameterized Placeholders**: All user-supplied values are bound using `?` positional parameters.
3. **LIKE Pattern Escaping**: Text searches use `escape_like_pattern()` escaping `%`, `_`, and `!` characters with `ESCAPE '!'`.
4. **Complexity Capping**: Max 10 conditions are permitted per query group, preventing deep recursive or denial-of-service query payloads.

---

## 5. State Synchronization & Request Cancellation

- **URL Synchronization**: The non-sensitive filter configuration is mirrored to URL search parameters (`?query=...&division=A&result=FAILS&multi_fails=true&logic=AND`). Student marks or private tokens are never stored in URLs.
- **Request Cancellation**: The frontend uses `AbortController`. When a faculty member rapidly modifies filter conditions, the active `AbortController.abort()` cancels prior in-flight requests, preventing stale network responses from overwriting current results.

---

## 6. Formula-Safe CSV Export

When exporting the matching cohort via `POST /api/v1/investigation/export-csv`:
- All cells starting with spreadsheet formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically prepended with a single quote (`'`), preventing remote code execution or formula injection in Excel and Google Sheets.
- Pure signed numeric values (e.g. `+10.5` or `-5`) are preserved without unnecessary quote prefixing.
