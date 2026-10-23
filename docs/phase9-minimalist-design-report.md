# EduQuery — Phase 9: Minimalist Academic Intelligence & Progressive Disclosure Report

**Date:** October 18, 2026  
**System:** EduQuery Academic Analysis Workspace  
**Status:** Complete, Verified, All Tests Passing (236 Backend, 50 Frontend, 0 TypeScript Errors)  
**Safety Status:** V1 & V2 Untouched • Zero Git Staging or Commits • No Invariant Alterations  

---

## 1. Executive Summary & Objective

In Phase 8, EduQuery introduced an interactive investigation query engine and explainable multi-tier academic anomaly detection (combining deterministic rules, robust MAD Z-scores, and multivariate Isolation Forest). While analytically robust, the initial Phase 8 interface suffered from cognitive overload:
- Six equally prominent KPI cards competing for visual attention.
- 52 raw course-level anomaly findings shown simultaneously, creating the misleading impression that 52 students were in crisis when in reality only **18 unique students** were flagged across courses.
- A multi-row advanced filter builder thrust upon faculty immediately, cluttering the table.
- Raw algorithmic terminology, Z-score units, and tree-depth parameters permanently exposed without progressive disclosure.

**Phase 9 Objective:** Refine the academic analysis workspace into a minimal, information-dense, faculty-friendly analytical product. **Do not remove the intelligence — simplify how faculty access it.**

---

## 2. Initial Git State & Safety Invariants

Before any code modification in Phase 9, repository isolation and Git state were audited:
- **Git Branch:** `main` (commit `372ea95`).
- **Git Staging State:** 0 files staged (`git diff --staged` empty).
- **V1 (`edu-query`) and V2 (`eduquery-v2`):** 100% untouched and preserved.
- **Academic Classification Invariants:** Unresolved and missing marks are strictly never counted as passes; official grades and pass/fail statuses remain immutable; Isolation Forest decision values are strictly never labeled as probabilities of academic error or misconduct.
- **Baseline Test Verification:**
  - Python Pytest: 234 / 234 tests passing.
  - Vitest: 48 / 48 tests passing across 11 test files.
  - TypeScript: 0 errors (`tsc -b`).

---

## 3. UX Audit & Problems Identified in the Existing Interface

An in-depth audit of `frontend/src/pages/OverviewPage.tsx`, `frontend/src/pages/ExplorePage.tsx`, and supporting components revealed several critical usability issues:

| Area | Prior Phase 8 Implementation | Phase 9 Usability Problem | Resolution in Phase 9 |
| :--- | :--- | :--- | :--- |
| **KPI Strip** | 6 equally prominent KPI cards (Enrolled, Courses, Pass Rate, Failures, Anomalies, Integrity). | Visual noise; redundant metrics; failed students appeared in 3 different widgets at once. | Consolidated into **3 Primary Cards** (Cohort Size, Confirmed Pass Rate with explicit denominator, Records Needing Review). Secondary metrics integrated cleanly into subtitles. |
| **Pass Rate Denominator** | Displayed `91.0%` with subtitle `132 Students Cleared`. | Denominator omitted; risk of implying missing/unresolved grades are passed. | Explicit defined denominator: `132 of 145 students cleared all subjects (unresolved excluded)`. |
| **Needs Attention Panel** | Displayed all findings unranked with large banners. | Crowded the viewport on larger cohorts; lack of deterministic capping. | Documented deterministic ranking capping initial display at **top 3 high-value findings** with a toggle for "View All". |
| **Visualizations** | 4 large charts in 2x2 grid (Outcome donut, failing courses, division comparison, marks histogram). | Marks histogram duplicated the failure rate information and crowded out cohort patterns. | Retained 3 core charts; converted Marks Histogram into an expandable/collapsible secondary analysis section. |
| **Anomaly Findings** | 52 individual course cards displayed flatly. | Multiple findings flagging the same student across 3 or 4 courses overwhelmed faculty; misleading total. | Grouped into **18 Unique Student Records**. Synthesized plain-language headline; underlying course findings placed in a progressive disclosure expander. |
| **Anomaly Actions** | Only single-finding review toggle (`reviewAnomalyFinding`). | Faculty had to click 9 times to review 9 course findings for one student (`23108A0164`). | Added `reviewStudentAnomalies` endpoint and UI button to mark all findings for a student in one action. |
| **Explore Data Filters** | Filter builder with 5 fields, operators, and inputs open by default. | High cognitive friction for simple exploration; overwhelmed faculty looking for quick cohorts. | Implemented **3-Level Progressive Disclosure**: Level 1 (Search + Presets + Table), Level 2 (Compact "+ Add Filter" modal/card with removable chips), Level 3 (Collapsible Advanced AND/OR logic). |

---

## 4. Establishing a Minimal Visual System

Phase 9 implemented a restrained, professional academic design system:
1. **Neutral Backgrounds & Thin Borders:** Replaced heavy nested card shadows with clean `1px solid var(--border-color)` (#e2e8f0) and subtle neutral canvas (#f8fafc).
2. **Strict Color Palette:**
   - Primary Action & Links: Royal Blue (`#2563eb`).
   - Confirmed Pass: Forest Emerald (`#10b981`, `#065f46`).
   - Confirmed Failure: Muted Crimson (`#ef4444`, `#991b1b`).
   - Academic Review Required: Warm Amber (`#f59e0b`, `#92400e`).
   - Method Badges: Neutral slate and light blue accents.
3. **Typography & Hierarchy:** Clear font hierarchy with high contrast, legible numbers, aligned table columns, and elimination of unnecessary all-caps headers.
4. **No Card-Within-Card Duplication:** Information grouped by logical hierarchy rather than enclosing every single statistic in a separate bordered card.

---

## 5. Analysis Landing Page Redesign (`OverviewPage.tsx`)

The landing page now directly and immediately answers the three core faculty questions:
1. **How is the cohort performing?**
2. **What needs attention?**
3. **Where should faculty investigate next?**

### A. Compact Dataset Context
A slender header strip displays:
- Active Dataset ID (`dataset-2026-sem4`) with green live status dot.
- Verified student count (`145 Enrolled Students across 27 Courses • Verified in DuckDB`).
- Unobtrusive navigation shortcuts (`Explore Data`, `Datasets & Rollback`).

### B. Three Primary Metrics
1. **Cohort Size (`145`):** Total verified students evaluated across `27` assessed curriculum courses.
2. **Confirmed Overall Pass Rate (`91.0%`):** Strict denominator clearly stated: `132 of 145 students cleared all subjects (unresolved excluded)`.
3. **Records Requiring Review (`18`):** Unifies confirmed failures and anomalous patterns: `13 confirmed failures • 18 flagged students • 96% data integrity audit`.

### C. Needs Attention (Top 3 Deterministic Prioritization)
- Strictly limited to at most 3 high-value findings on initial view.
- Ranked by deterministic criteria:
  1. Subjects with unusually high failure rates with enrollment (e.g. `CS-401: 28.5% failure rate across 60 students`).
  2. Students with multiple confirmed subject failures (e.g. `8 students failing 2 or more subjects`).
  3. Material data-quality conflicts or arithmetic reconciliation mismatches.
- Clear count, 1-sentence detection summary, and direct "Investigate" link to supporting records.
- "View All" toggle button allows inspecting all findings when needed without initial clutter.

### D. Outcome Summary & Secondary Analyses
- **Cohort Outcome Distribution:** Native SVG Donut chart displaying counts and percentages (`132 Passed [91.0%]`, `13 Failed [9.0%]`). Slices link directly to `/explore`.
- **Highest Failing Subjects:** Horizontal ranking chart showing top 5 courses by failure rate.
- **Division Performance Comparison:** Bar comparison chart comparing Division A vs Division B pass rates.
- **Cohort Marks & Grade Distribution:** Secondary collapsible section containing the score histogram and letter grade breakdown.

---

## 6. Anomaly Detection Deduplication & Progressive Disclosure

### Deduplication Semantics
The 52 anomaly findings in the database represent **18 unique students**:
- Student `23108A0164`: 9 findings across 6 courses.
- Student `23108A0148`: 6 findings across 4 courses.
- Student `23108A0155`: 5 findings across 4 courses.
- Student `23108A0146`: 4 findings across 3 courses.

Displaying 52 raw cards gave faculty the false impression of an unmanageable crisis. Phase 9 synthesizes these findings into **18 Grouped Anomaly Records**:
- **Backend Model (`GroupedAnomalyRecord`):** Contains `student_id`, `student_name`, `division`, `findings_count`, `methods`, `categories`, `highest_severity`, `headline`, `all_reviewed`, `record_link`, and the full list of `findings`.
- **Headline Synthesis:** Plain-language synthesis according to detection tier:
  - Calculation discrepancies (Tier A): *"Mark calculation discrepancy detected (9 findings across 6 courses)"*.
  - Robust Z-score + Isolation Forest (Tier B + C): *"Statistical deviation & multivariate outlier pattern (6 findings across 4 courses)"*.
  - Robust Z-score only (Tier B): *"Statistical deviation from course medians (4 findings in 3 courses)"*.
  - Isolation Forest only (Tier C): *"Multivariate performance pattern flagged by Isolation Forest"*.

### Progressive Disclosure Interaction
1. **Default View:** Faculty see a clean card with Student Name, ID, Division, highest severity badge, synthesized headline, "Inspect Record" link, "Mark Reviewed" button, and a "View Evidence" button.
2. **Expanded View (On-Demand):** Clicking "View Evidence" opens the drawer displaying:
   - "Underlying Evidence & Method Disclosures".
   - Each course's specific anomaly finding with its score label (e.g. `Robust Z = -3.42` or `Mismatch: 12 marks`).
   - Plain-language explanation of what was detected.
   - Specific method limitation disclaimers (e.g. *"Does not prove administrative fraud"*, *"Isolation Forest score represents tree depth, not probability of error"*).
   - Provenance tracking: worksheet name and spreadsheet row number.
   - Individual item review toggle button.
3. **Student-Level Bulk Review Action:**
   - Endpoint: `POST /api/v1/anomalies/students/{student_id}/review`.
   - Allows faculty to moderate all findings for a student with a single click.

---

## 7. Explore Data Engine Simplification (`ExplorePage.tsx`)

The interactive investigation engine now operates on three clear progressive disclosure levels:

### Level 1: Immediate Exploration
- Universal search bar supporting Student ID, Name, Roll No, Seat No.
- Quick Presets:
  - `All Students`: Instant reset to full cohort.
  - `Failing 2+ Subjects`: Filters for multi-subject failure cohort.
  - `All Failures`: Filters for confirmed academic failures.
  - `Passed Students`: Filters for cleared students.
  - `Division A` / `Division B`: Cohort partitioning.
- Active Conditions Strip: Active filters rendered as removable chips with `×` button.
- Live record count and active query explanation.
- Compact, responsive data table with aligned numeric metrics, status badges, and direct links to student breakdown.

### Level 2: Compact "+ Add Filter" Condition Editor
- Clicking the `+ Add Filter` button opens a clean, single-condition editor card.
- Faculty choose:
  1. Field (`division`, `result`, `course_code`, `multi_fails`, `failed_subject_count`, `total_marks`, `sgpi`).
  2. Operator (`is`, `is not`, `is at least >=`, `is at most <=`, `between`).
  3. Value (dynamic dropdown for choices/courses, number input, or boolean toggle).
- Clicking "Apply Filter" appends the condition as an active removable chip, immediately updates the table, and preserves all unrelated filters.

### Level 3: Advanced Conditions & Query Builder
- Clicking `Filter Builder` opens the full multi-condition logic editor.
- Supports `Match ALL (AND)` vs `Match ANY (OR)` boolean logic.
- Numbered condition rows (`#1`, `#2`, ...) with individual field, operator, and value pickers.
- All Phase 8 dynamic query engine capabilities and test contracts are 100% preserved.

---

## 8. Verification Results

### A. Python Backend Test Suite
```bash
python -m pytest tests/
```
- **Total Tests Passed:** **236 / 236** (100% passing).
- **Execution Time:** ~3 minutes across all synthetic and primary acceptance workbooks.
- **New Unit Tests Added:**
  - `test_anomaly_grouping_and_unique_record_counts`: Validated grouping of multiple course findings by student, distinct unique student counts, and synthesized plain-language headlines.
  - `test_student_level_review_action`: Validated student-level bulk review moderation, state persistence, and `all_reviewed` resolution.

### B. Frontend Vitest Suite
```bash
npm test -- --run
```
- **Total Tests Passed:** **50 / 50** across 11 test files (100% passing).
- **New Frontend Tests Added:**
  - `OverviewPage.test.tsx`: Validated grouped anomaly records rendering (Alice Johnson), evidence drawer expansion, source limitation disclaimers, and student-level review action triggering `reviewStudentAnomalies`.
  - `ExplorePage.test.tsx`: Validated Level 2 "+ Add Filter" single condition editor opening, applying condition, rendering removable chip, and chip removal.

### C. TypeScript Compilation & Production Build
- Strict compilation check: `node ./node_modules/typescript/bin/tsc -b` &rarr; **0 errors**.
- Production build: `npm run build` &rarr; Built successfully in 854ms (`dist/assets/index-BOq7or0u.js` 428.65 kB, gzip 116.93 kB).

---

## 9. Visual Browser Audit Verification

A real-browser visual session was conducted using Chrome on the running local instance (`http://localhost:5173`):
1. **Overview Page (`/`):**
   - Verified the 3 primary metric cards (Cohort Size, Confirmed Pass Rate `91.0%` with `132 of 145`, Records Requiring Review `18`).
   - Verified the "Needs Attention" panel displaying top-3 prioritized findings with "View All" toggle.
   - Verified the outcome distribution donut chart, failing subjects ranking, and division comparison.
   - Verified the Anomaly Detection section displaying 18 grouped student cards instead of 52 repetitive cards.
   - Verified that clicking "View Evidence" on Student `23108A0164` cleanly expands the progressive disclosure drawer showing individual course findings, Z-scores, and limitation disclaimers.
   - Verified clicking "Mark Reviewed" toggles review status cleanly.
2. **Explore Data Page (`/explore`):**
   - Verified Level 1 search and presets ("Failing 2+ Subjects", "All Failures", "Passed Students").
   - Verified Level 2 "+ Add Filter" condition editor and condition chips (`Division is A ×`).
   - Verified chip removal independently clears that filter.
   - Verified Level 3 "Filter Builder" toggle opens the AND/OR builder with `#1` condition rows.
   - Verified table sorting, pagination, and CSV export.

---

## 10. Final Git State & Safety Audit

- **Uncommitted Changes Preserved:** Exactly as required by Safety Rule #2 and #3.
- **Git Status:** 0 files staged for commit.
- **V1 (`edu-query`) and V2 (`eduquery-v2`):** Zero files modified or accessed.
- **Phase 9 Scope Adherence:** No new ML models added; no mock data introduced; all 236 backend and 50 frontend tests passing.
