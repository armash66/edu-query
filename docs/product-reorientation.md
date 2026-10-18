# EduQuery V3 — Product Reorientation: Academic Analysis Workspace Specification

**Date:** 2026-10-18  
**Scope:** Architecture and Information Architecture (IA) transformation from a static administration template into an interactive, faculty-centric academic analysis workspace.

---

## 1. Executive Summary & Problem Audit

### 1.1 The Current Problem
EduQuery V3 has established robust workbook ingestion, layout induction, DuckDB storage, atomic dataset rollback, and formula-injection-safe CSV exports. However, its user experience has drifted toward a generic administrative dashboard:
- **Static Overview:** Oversized vertical cards showing basic counts (Students: 145, Courses: 27) with no analytical depth.
- **Disconnected Pages:** Student roster, subject catalog, failure roster, and data quality are siloed in separate menu items without cross-navigation.
- **Lack of Visual Analytics:** No interactive charts, no division comparisons, no grade/marks distributions, and no multi-subject failure pattern detection.
- **Manual Inefficiency:** Faculty members seeking answers (e.g. *"Which division is struggling in Algorithms?"*, *"How many students failed both Theory and Lab?"*, *"Where are the conflicting grades?"*) must manually browse through disparate tables and cross-reference records.

### 1.2 Information Architecture Reorientation
We redesign EduQuery V3 into an **Academic Analysis Workspace** centered around 6 primary pillars:
1. **Analysis (`/`):** The default landing workspace providing high-density academic metrics, visual outcome distributions, subject failure rankings, cross-division performance charts, and an actionable "Needs Attention" findings panel.
2. **Explore Data (`/explore`):** A unified, searchable exploration engine with contextual multi-dimensional filters (student status, division, course, score ranges) and instant drill-down.
3. **Students (`/students` & `/students/:id`):** Student roster with rich individual academic performance, component atomization, reconciliation status, and source sheet/row provenance.
4. **Subjects (`/subjects` & `/subjects/:code`):** Curriculum catalog, course details, failure rosters, and division breakdown.
5. **Data Quality (`/data-quality`):** Deterministic marksheet validation, problem/impact/action diagnostic findings, and integrity scoring.
6. **Import & Datasets (`/imports`):** Safe candidate workbook preview, explicit activation, version history, and one-click atomic rollback.

---

## 2. Main Navigation & Page Hierarchy

The sidebar navigation is streamlined to 6 purposeful items:

```
┌──────────────────────────────────────────────┐
│  EduQuery V3                                 │
│  Academic Marks Analysis & Verification      │
├──────────────────────────────────────────────┤
│  [BarChart3]    Analysis          (/)        │  <- Default Primary View
│  [Compass]      Explore Data      (/explore) │  <- Unified Multi-Filter Exploration
│  [Users]        Students          (/students)│  <- Student Investigation
│  [BookOpen]     Subjects          (/subjects)│  <- Curriculum Diagnostics
│  [ShieldCheck]  Data Quality      (/data-quality)
│  [UploadCloud]  Import & Datasets (/imports) │  <- Dataset Versioning & Rollback
├──────────────────────────────────────────────┤
│  Active Dataset: dataset_xyz (Ready)         │
└──────────────────────────────────────────────┘
```

Existing deep links (`/failures`, `/subjects/:code/failures`, `/students/:id`) remain fully functional and integrated.

---

## 3. Analysis Registry Specification

The frontend and backend communicate through a typed **Analysis Registry** defining supported analytical capabilities:

| Analysis ID | Human Name | Description | Required Fields | Available Filters | Output Type | Drill-Down Target |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `overall_outcome` | Cohort Outcome Distribution | Breakdown of confirmed pass, confirmed fail, and unresolved records across cohort. | `students.result` | Division | Donut / Bar Chart | `/explore?result={status}` |
| `subject_failures` | Subject Failure Ranking | Ranked list of courses by confirmed failure count & failure percentage with correct enrollment denominators. | `courses.code`, `scores.flag`, `grades.letter` | Division, Modality | Horizontal Bar Chart | `/subjects/{code}/failures` |
| `division_comparison` | Division Performance Comparison | Headcount, overall pass rate, and subject-specific failure rates across class divisions. | `students.division`, `enrollment` | Division | Grouped Bar Chart | `/explore?division={div}` |
| `marks_distribution` | Marks & Grade Distribution | Score ranges and awarded letter grade frequencies for enrolled courses. | `reconciliation.printed_total`, `grades.letter` | Course, Division | Histogram / Range Distribution | `/explore?course={code}` |
| `failure_patterns` | Multi-Subject Failure Patterns | Distribution of students failing 1, 2, 3+ subjects, and frequently co-failing subject pairs. | `reconciliation.grade`, `scores.flag` | Division | Frequency Matrix | `/explore?multi_fails=true` |
| `data_quality_alerts` | Anomaly & Consistency Findings | Actionable findings for conflicting grades, out-of-range marks, and printed vs. computed total mismatches. | `quality_findings` | Severity | Alert Cards | `/data-quality` |

---

## 4. Backend Analytics Architecture

To avoid loading entire datasets into the client or executing arbitrary browser SQL, a unified analytics router `app/api/routes/analytics.py` and service `app/services/analytics_service.py` provide efficient, parameterized DuckDB aggregations:

### 4.1 Endpoints
1. `GET /api/v1/analytics/overview`
   - **Metrics:** Total enrolled students, total courses, overall passed, overall failed, unresolved count, data quality score.
   - **Outcome Distribution:** Exact counts and percentages for `passed`, `failed`, `unresolved`.
   - **Top Failing Subjects:** Top 5 courses by failure count with enrolled denominators and failure rates.
   - **Division Summary:** Headcount and pass rate by division.
   - **Actionable Findings:** Deterministic alerts (e.g. courses with >20% failure rate, students failing multiple courses, conflicting grade count, reconciliation mismatch count).
2. `GET /api/v1/analytics/division-comparison`
   - Returns per-division academic outcome breakdown and course-level failure breakdown across divisions.
3. `GET /api/v1/analytics/failure-patterns`
   - Returns counts of students failing exactly 1, 2, 3, 4+ subjects, list of multi-failing students, and top co-failing subject pairs.
4. `GET /api/v1/analytics/distributions`
   - Returns 10-point bucket score distribution and letter grade distribution for a specified course (or cohort-wide).

---

## 5. Unified Explore Data Page (`/explore`)

Instead of requiring faculty to search across separate pages:
- **Global Search:** Immediate lookup by student name, seat number, roll number, or course code.
- **Coordinated Filter Bar:**
  - Division filter (All, Div A, Div B, ...)
  - Academic Outcome filter (All, Passed, Failed, Unresolved, Conflicting)
  - Subject filter (All or specific catalog course)
  - Failure Severity filter (Single failure vs. 2+ Multiple failures)
- **Interactive Results Table:**
  - Explicit column sizing preventing text wrapping.
  - Aligned numeric marks, credit totals, SGPI/CGPA.
  - Distinct status badges for Passed, Failed, Unresolved, Conflicting, Absent.
  - Direct quick-action links to Student Detail (`/students/:id`) and Course Detail (`/subjects/:code/failures`).
- **CSV Export:** Complete export of the filtered investigation dataset with formula-injection defenses.

---

## 6. Visualization & Design System

### 6.1 Native SVG Visualizations
In compliance with the lightweight bundle requirement, charts are implemented as custom, accessible SVG components:
- **OutcomeDonutChart:** Displays Pass/Fail/Unresolved proportion with centered total, segment hover details, and click-to-filter callback.
- **HorizontalRankingBar:** Compares courses by failure rate with tooltips showing `failing_count / total_enrolled`.
- **DivisionComparisonBar:** Visualizes division pass rates side-by-side with clear denominators.
- **MultiFailureHistogram:** Visualizes students failing 1, 2, 3, 4+ subjects.

### 6.2 Table Layout Improvements
- Elimination of text clipping and overlapping headers.
- Fixed column widths for `Seat/Roll No`, `Division`, `Total Marks`, `SGPI`, `Status`, `Actions`.
- Subtle hover transitions and keyboard-accessible modal dialogs.
