# Deliverable 04: Dataset Provenance, Anonymization, Anomaly Injection, and Validity Threats

## 1. Dataset Inventory & Integrity Checksums

The evaluation of EduQuery V3 utilizes seven marksheet workbooks spanning authentic anonymized institutional records and controlled synthetic benchmarks across distinct academic disciplines.

### Checksums and File Profiles
| Workbook Filename | Academic Domain | File Size (Bytes) | Sheets | Rows | Max Cols | SHA-256 Checksum |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `Result_anonymized.xlsx` | Engineering (UG) | 158,649 | 1 | 303 | 118 | `a3c04018f48b2506e9874cb3ca36ba339dffab081eb65adbf66dc55d7fca1868` |
| `test1_commerce_same_layout.xlsx` | Commerce (B.Com) | 20,865 | 1 | 134 | 42 | `c9888c91ac1f68b25d2c20894be66299b9cf8019685aeeb7995a2d6742562479` |
| `test1_same_layout_10courses_3divs.xlsx` | Commerce (B.Com) | 20,800 | 1 | 134 | 42 | `ae6a597ec2484930601f01c7dbf07bbdf9ca0cfb4971c26156f2e20ff9a68093` |
| `test2_lifesci_vague_single_row.xlsx` | Life Sciences (B.Sc) | 13,171 | 1 | 54 | 33 | `98a8111db09582747d953930b80c3c6f62b8004f26b5d6e19191d4e73bfa9904` |
| `test2_vague_single_row_batches.xlsx` | Life Sciences (B.Sc) | 13,148 | 1 | 54 | 33 | `647b730b6d3add9eb43fc80d60d3d526746ce0ce25ca31aee47040d6c97a9f99` |
| `test3_arts_messy_sheet_per_division.xlsx` | Arts & Humanities (B.A) | 15,852 | 2 | 68 | 36 | `75253cc2ac7f40a996c567e7195d73ee0a1f061214088fb988229b4e54a9ca6e` |
| `test3_messy_sheet_per_division.xlsx` | Arts & Humanities (B.A) | 15,926 | 2 | 68 | 36 | `eaa7b6b21f72f2316e6378fb50e93245f778a462372f44760824cf9659a4b3d3` |

### Ingested Entity Counts & Structural Induction
All numbers were extracted by parsing each dataset into an isolated in-process DuckDB instance via [`app/core/ingest.py`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py):

| Workbook | Ingested Students | Courses | Score Cells | Stride | Reconciliations | Arithmetic Mismatches | Absent Students | Passed | Failed |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Result_anonymized.xlsx` | **145** | **27** | **5,945** | 2 | 1,455 | **0** | **48** | **132** | **13** |
| `test1_commerce_same_layout.xlsx` | 60 | 10 | 2,014 | 2 | 600 | 97 | 6 | 48 | 12 |
| `test1_same_layout_10courses_3divs.xlsx` | 60 | 10 | 2,001 | 2 | 600 | 104 | 7 | 46 | 14 |
| `test2_lifesci_vague_single_row.xlsx` | 45 | 7 | 1,215 | 1 | 315 | 41 | 3 | 38 | 7 |
| `test2_vague_single_row_batches.xlsx` | 45 | 7 | 1,215 | 1 | 315 | 42 | 3 | 38 | 7 |
| `test3_arts_messy_sheet_per_division.xlsx` | 50 | 8 | 1,291 | 1 | 400 | 82 | 4 | 41 | 9 |
| `test3_messy_sheet_per_division.xlsx` | 50 | 8 | 1,311 | 1 | 400 | 87 | 4 | 40 | 10 |

---

## 2. Anonymization Methodology for Institutional Records

The primary benchmark dataset (`Result_anonymized.xlsx`) is derived from an actual engineering cohort marksheet from a university-affiliated engineering institute. To prevent student re-identification, the dataset underwent a multi-step anonymization pipeline:

1. **Student Name Substitution**: Real candidate names were replaced with randomly sampled Indian names from a composite first-name/patronymic/surname generator (e.g., `Mishra Pooja Mohan Usha`, `Iyer Kavya Mahesh Madhuri`).
2. **Roll Number Masking**: Institutional roll numbers were replaced with synthetic structured tokens (`23108A0001` to `23108A0150`) matching the division prefix and batch pattern without leaking admission ranks.
3. **Seat Number Substitution**: Examination seat numbers were re-mapped to sequential 6-digit synthetic identifiers (`224901` to `225050`).
4. **Email Address Scrubbing**: Replaced with synthetic placeholder strings formatted as `firstname.lastname{rand}@example.com`.
5. **Preservation of Authentic Academic Relationships**: All assessment scores (ESE, ISA, MSE, TW, PR), component totals, credits, SGPI, and pass/fail indicators were preserved intact. This ensures that genuine academic distributions, course difficulty variances, and absentee correlations remain completely realistic.

---

## 3. Synthetic Benchmark Generation & Planted Anomaly Map

To evaluate anomaly detection algorithms against verifiable ground truth, controlled synthetic cohorts were generated via NumPy random generators (`default_rng(seed=42)`) with labeled anomalies.

### Planted Anomaly Taxonomies
1. **Arithmetic Printed vs Computed Discrepancies**:
   - *Mechanism*: $\text{printed\_total} = \text{computed\_total} \pm \delta$, where $\delta \in [6.0, 15.0]$.
   - *Target*: Simulates spreadsheet formula overwrite or transcription error.
   - *Locations in Synthetic Cohort*: 8 students (`ANOM_ARITH_01` through `ANOM_ARITH_08`).
2. **Boundary Violations (Typographical Outliers)**:
   - *Mechanism*: Injecting score values $< 0$ ($-5.0$) or $> 100$ ($125.0$) into discrete course assessments.
   - *Locations in Synthetic Cohort*: 4 students (`ANOM_BOUND_01` through `ANOM_BOUND_04`).
3. **Isolated Performance Collapses (Intra-Student Outliers)**:
   - *Mechanism*: High-performing students (ability mean $\mu = 82.0$, scores $75-95$) who experience an extreme isolated collapse in one exam ($8.0$ marks).
   - *Locations in Synthetic Cohort*: 6 students (`ANOM_COLLAPSE_01` through `ANOM_COLLAPSE_06`).
4. **Multivariate Structural Bimodal Profiles**:
   - *Mechanism*: Students exhibiting severe alternating volatility across courses (e.g., scoring $96, 18, 92, 14, 88, 20$).
   - *Locations in Synthetic Cohort*: 3 students (`ANOM_MULTI_01` through `ANOM_MULTI_03`).

---

## 4. Threats to External Validity

1. **Single-Institution Curricular Biases**: The primary real dataset (`Result_anonymized.xlsx`) originates from a Mumbai University-affiliated engineering college operating under the Choice Based Credit System (CBCS / NEP 2020). Grading schemas that do not use 10-point SGPI/CGPA scales or that use percentage-only classifications require configuration adjustments.
2. **Stride and Paired-Row Assumptions**: The layout induction engine assumes that paired-row marksheets store grades/credits directly in the row immediately below student marks. While this covers standard university marksheet templates, arbitrary three-row or alternating-header strides are currently unsupported.
3. **Synthetic Anomaly Distribution**: While planted anomalies reflect documented spreadsheet error modes (data entry errors, missing sum ranges, typo bounds), real-world fraud or intentional tampering may be subtler (e.g., modifying component marks directly so that the sum remains mathematically consistent).
4. **Elective Course Sparsity**: In cohorts with highly fragmented elective offerings (e.g., 20+ specialized electives where each course has fewer than 10 students), statistical baselines (Tier B MAD) automatically disable themselves due to insufficient cohort depth ($N < 10$).

