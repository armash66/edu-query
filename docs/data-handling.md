# EduQuery V3 - Data Handling and Academic Invariants

## 1. Overview

EduQuery V3 is engineered to ingest raw, unstandardized university marksheet workbooks without manual pre-formatting or data alterations. This document defines the ingestion lifecycle, layout induction rules, absence-versus-zero semantics, elective enrollment handling, data quality checks, and deterministic academic classification invariants.

---

## 2. Workbook Ingestion and Layout Induction

Higher-education marksheets (such as those from Mumbai University and affiliated autonomous colleges) exhibit complex structural variations:
- Multi-tier merged header rows (e.g., Course Name -> Assessment Component -> Max/Min marks).
- Single-row vs. paired-row layouts (where student information spans 1 or 2 rows per student).
- Heterogeneous worksheets per division (`Div A`, `Div B`) or single wide sheets.
- Irregular formula cells, uppercase absence markers, and suffix failure indicators.

### Ingestion Lifecycle (`app/core/ingest.py`)

1. **Quarantine and Inspection**:
   - Upload streams are bounded to 25 MiB.
   - Files are validated against OpenXML magic bytes (`PK\x03\x04` and `[Content_Types].xml`).
   - The archive is scanned for zip bombs (uncompressed XML ratio checked against a 100 MiB limit) and path traversal in internal entry names.

2. **Sheet Cataloging and Profile Induction (`app/core/catalog.py`)**:
   - Openpyxl inspects sheet dimensions, merged cell ranges, and header tokens.
   - Layout classifier identifies header bands, student identity anchor columns (Seat No, Roll No, Student Name), and course blocks.

3. **Cell Token Parsing**:
   - Numeric values are extracted with floating-point precision.
   - Absence markers (`AB`, `ABS`, `A`) are recognized and mapped to state `flagged` with raw text preserved.
   - Suffix flags (e.g. `24#`, `35*`) are stripped for numeric evaluation while flags are captured in the score record.
   - Formula cells without pre-cached calculated values are preserved as uncalculated rather than coerced to zero.

4. **Provenance Attachment**:
   - Every parsed student record and score item records its origin:
     - `source_sheet`: The worksheet tab name.
     - `source_row`: The 1-indexed row number in the physical Excel file.
   - Discrepancies can be cross-referenced directly against physical marksheet printouts.

---

## 3. Absence vs. Numeric Zero Distinction

A fundamental requirement of academic data integrity is distinguishing valid zero marks from non-attendance:

- **Numeric Zero (`0.0`)**: Indicates a student appeared for the assessment component and earned zero marks. Stored as `numeric_value = 0.0`, `state = 'marked'`.
- **Absent Marker (`AB`, `ABS`)**: Indicates the student did not sit for the examination. Stored as `numeric_value = NULL`, `state = 'flagged'`, `raw_text = 'AB'`.
- **Unenrolled / Unassigned Component**: Indicates the component does not apply to the student (e.g. unselected elective). Stored with state `'not_enrolled'`, producing zero phantom scores.

The engine never converts absent markers to numeric zero, and never converts numeric zero to absent.

---

## 4. Multidisciplinary Minor (MDM) Elective Semantics

In Indian university semester curricula, students choose exactly 1 elective from an approved elective group (e.g. Multidisciplinary Minor group: `MDM-EC`, `MDM-CS`, `MDM-ME`, `MDM-EE`).

### Invariants Enforced

1. **Mutually Exclusive Selection (1 of N)**:
   - Students are enrolled in exactly one elective within an elective group.
   - In `Result_anonymized.xlsx`, all 145 students partition cleanly across the 4 options:
     - `MDMBD02` (Big Data): 63 students
     - `MDMBI02` (Business Intelligence): 9 students
     - `MDMIE02` (Industrial Engineering): 41 students
     - `MDMRB02` (Robotics): 32 students
     - Total: 145 students (100% of cohort accounted for).

2. **Accurate Enrolled Denominators**:
   - Subject catalogs and failure rosters calculate failure percentages using `enrolled_count` as the denominator, never the entire class cohort.
   - Example: A single failure in `MDMBI02` yields a failure rate of 11.1% (1 of 9 enrolled), not 0.69% (1 of 145).

3. **Zero Phantom Records**:
   - Unselected elective alternatives generate 0 rows in the DuckDB `scores` table.
   - Unselected alternatives generate no phantom passing or failing grades, and no misleading reconciliation alerts.

---

## 5. Data Quality Checks (Checks 1 to 10)

The validation engine runs 10 academic integrity checks prior to cohort activation:

| Check ID | Check Name | Severity | Problem Description |
| :--- | :--- | :--- | :--- |
| `duplicate_student_identities` | Check 1 | Error (Blocks Activation) | Multiple student records share identical seat numbers or roll numbers. |
| `missing_student_identifiers` | Check 2 | Error (Blocks Activation) | Student rows missing mandatory seat number or student identifier. |
| `unparseable_score_cells` | Check 3 | Error (Blocks Activation) | Score cells containing corrupted or unparseable text. |
| `out_of_range_marks` | Check 4 | Warning (Non-blocking) | Score entries fall outside the expected marks range (negative or > 100). |
| `printed_total_mismatch` | Check 5 | Warning (Non-blocking) | Printed total score does not match the sum of atomized component marks. |
| `component_absence_anomaly` | Check 6 | Warning (Non-blocking) | Student marked absent in an assessment component despite a passing final grade. |
| `inconsistent_result_indicators`| Check 7 | Warning (Non-blocking) | Conflict between overall result (e.g. PASSES) and individual course grades (e.g. F). |
| `high_component_absence_rate` | Check 8 | Info | Component absence rate exceeds 20% across the cohort. |
| `ambiguous_elective_selection`| Check 9 | Warning (Non-blocking) | Student has marks recorded across competing electives, or zero elective selection. |
| `elective_metadata_vs_marks` | Check 10 | Warning (Non-blocking) | Discrepancy between student metadata elective choice and recorded marksheet rows. |

### Out-of-Range Marks Handling

In `Result_anonymized.xlsx`, 78 students have total scores exceeding 100 in MDM elective courses because the composite total includes ESE (max 50) + ISA (max 44) + MSE (max 30) = max 124.

- **Non-Blocking Treatment**: Check 4 surfaces these entries as a prominent warning notice:
  - Title: **Data quality warning: 78 score entries need review**
  - Problem: *"Some entries fall outside the expected marks range. You can continue to explore the cohort, but affected calculations may be incomplete until these entries are reviewed."*
- **No Silent Modification**: Raw marks are never clamped, truncated, or coerced to 100.
- **Activation Preserved**: The `can_confirm` status evaluates to `True`, enabling faculty to proceed with cohort analysis while retaining full visibility into the affected course entries.

---

## 6. Deterministic Academic Classification Rules

Pass/fail determination is evaluated using verified academic classification rules:

1. **Passing Outcomes**:
   - Letter grades of `O`, `A`, `B`, `C`, `D`, or `P` with no active failure flags are classified as `PASSED`.
2. **Failing Outcomes**:
   - Letter grades of `F` are classified as `FAILED`.
   - Explicit failure indicators (e.g. `*`, `#`, or result text `FAILS`) unconditionally take precedence over passing letter grades.
3. **Unresolved Outcomes**:
   - Blank, missing, unrecognized, or conflicting grades are classified as `UNRESOLVED` and surfaced for faculty review.
4. **Cohorts and Divisions**:
   - Class-wide failure counts strictly equal the sum of division failure counts:
     $$\sum \text{Failures}_{\text{division}} = \text{Failures}_{\text{class-wide}}$$
