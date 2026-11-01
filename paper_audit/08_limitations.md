# Deliverable 08: System Limitations, Known Bugs, and Scientific Caveats

## 1. Known Failure Modes and Software Defects

In accordance with the Evidence Rule, all observed limitations and edge-case failures are documented without sanitization:

1. **Ask AI Keyword Leakage Bug**:
   - *Manifestation*: The query `"Who won the football world cup?"` bypasses the academic relevance filter and executes against DuckDB, returning the full cohort list (145 records).
   - *Root Cause*: The pronoun `"who"` was included in `academic_keywords` ([`app/services/ai_service.py:92`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L92)) to support questions like `"Who failed in Div A?"`. Standalone interrogative pronouns without domain context trigger false-positive relevance classifications.
2. **HOD Brief Template Fallback on Single Cohorts**:
   - *Manifestation*: In workbooks without explicit division columns (e.g., small single-class cohorts in `test2` and `test3`), `generate_hod_brief` triggered template fallback in 14.3% of test runs.
   - *Root Cause*: In the absence of division splits, the fallback narrative template was triggered because dynamic division text keys did not match the rigid allowed-number verification audit.
3. **Legacy Test Header Mismatches**:
   - *Manifestation*: 13 tests failed in the backend test suite during full regression runs.
   - *Root Cause*: 7 tests expected the active dataset pointer to reference `Result_anonymized.xlsx` rather than a civil engineering test dataset, 1 test expected `limit <= 100` rather than the updated `limit <= 1000` parameter, and 2 export tests expected legacy CSV column names (`Name` vs `Student Name`).

---

## 2. Unsupported Marksheet Layouts and Formats

EduQuery V3 does NOT support the following input formats:
1. **Legacy Binary Excel (`.xls`)**: Files created in Microsoft Excel 97–2003 binary format (BIFF8) are rejected at the upload boundary with HTTP 415. Only OpenXML `.xlsx` containers are supported.
2. **Raster Images and Scanned PDFs**: Marksheets stored as scanned mobile photographs, fax images, or unparsed raster PDFs cannot be ingested. The system possesses zero Optical Character Recognition (OCR) capabilities.
3. **Three-Row or Four-Row Student Strides**: The layout induction engine supports single-row stride ($stride=1$) and paired-row stride ($stride=2$). Workbooks where a student's marks span three or four alternating rows (e.g., Row 1: Marks, Row 2: Grades, Row 3: Credits, Row 4: Remarks) fail layout induction with `AmbiguousLayoutError`.
4. **Transposed Marksheet Matrices**: Layouts where students are represented as columns and examination subjects are represented as rows are unsupported.
5. **Multi-Semester Composite Sheets**: Workbooks attempting to merge all 8 undergraduate semesters into a single continuous row with repeating identical course codes trigger column collision errors.

---

## 3. Scale and Resource Limits

Ingestion and analytical querying were empirically validated up to 2,000 students (64,000 score cells) with the following observed limits:
1. **Cohort Size Ceiling**: Single-workbook ingestion is memory-bounded by openpyxl's DOM tree construction. Workbooks exceeding 10,000 students in a single sheet may experience severe memory pressure ($> 1\text{ GB RAM}$) and slow decompression.
2. **Concurrent User Limit**: In-process DuckDB enforces single-writer / multi-reader concurrency. While concurrent reads scale across CPU threads, simultaneous multi-user workbook imports must be queued through the session manager lock.
3. **Elective Course Sparsity**: In institutions with extensive open electives, specialized subjects with fewer than 10 enrolled students fail the minimum cohort depth threshold ($N < 10$) for Tier B robust statistical MAD calculation.

---

## 4. Machine Learning & Statistical Caveats

1. **Isolation Forest Sample Size Gate**: The multivariate Isolation Forest requires a minimum of 15 valid multi-course students ($N \ge 15$). Small cohorts ($N < 15$) automatically bypass ML and rely exclusively on Tier A deterministic invariants.
2. **Severe Class Imbalance in Early Warning**: In the engineering benchmark cohort, final ESE failures accounted for only 13 out of 145 students ($8.97\%$). Supervised classifiers trained on such extreme class imbalance require balanced class weighting and risk overfitting to idiosyncrasies of specific courses.
3. **Tier B False-Positive Alert Fatigue**: Robust Z-Score scaling using Median Absolute Deviation ($Z_{robust} \ge 3.0$) identifies students whose marks diverge significantly from the median. In academic practice, exceptional students who legitimately score 98/100 in a subject with a median of 55 are statistical outliers but represent academic excellence rather than errors. This necessitated decoupling Tier B from default faculty views.

---

## 5. Things Never Tested (Empirical Blind Spots)

The following configurations were never evaluated during development and represent unverified domains:
1. **Right-to-Left (RTL) Scripts**: Never tested with Arabic, Persian, or Hebrew marksheet headers.
2. **Non-Latin Character Encodings**: Marksheets using non-UTF-8 legacy code pages (e.g., Windows-1252 with regional Indian script fonts like Kruti Dev or Shree Lipi) were never tested and will likely fail regex header matching.
3. **Non-Standard GPA Grading Scales**: Grading systems using reverse GPA scales (e.g., German 1.0 = best, 5.0 = fail) or percentage-only marks without grade points were never tested.
4. **Adversarial Security Penetration**: The system was tested with fuzzing and zip-bombs, but formal hostile red-team penetration testing (e.g. testing zero-day openpyxl vulnerabilities) was not conducted.

