# EduQuery V3: Academic Marksheet Analysis Engine

EduQuery V3 is a deterministic, high-performance academic marksheet analysis workspace built for college faculty and university administrators.

It replaces the natural-language query and LoRA neural planning experiments of V1/V2 with a clean, verified, dashboard-first marksheet intelligence platform.

---

## 🎯 Phase 1 Objective: Verified Ingestion & Academic Integrity

Phase 1 establishes a rock-solid foundation:
- **Zero LLM / Neural Overhead**: No PyTorch, Transformers, PEFT, or BitsAndBytes dependencies.
- **Multi-Sheet Ingestion**: Automatically detects heterogeneous layouts across wide sheets, merged headers, single-row vs paired-row formats, and multi-division worksheets (`Div A`, `Div B`).
- **Full Traceability**: Invariant tracking of `source_sheet` and `source_row` for every student record and assessment score.
- **Academic Integrity Auditor**: Pre-validation of duplicate IDs, out-of-range marks, inconsistent printed totals vs. component sums, and absent (`AB`) vs. zero distributions.

---

## 📁 Repository Architecture

```text
eduquery-v3/
├── app/
│   ├── core/                  # Core domain, ingestion, database, and validation
│   │   ├── catalog.py         # Metadata introspection & entity discovery
│   │   ├── database.py        # DuckDB table schemas & bulk-load primitives
│   │   ├── data_quality.py    # Academic integrity validator & anomaly detector
│   │   ├── ingest.py          # Multi-sheet layout-inducing Excel ingestion engine
│   │   └── models.py          # Strongly typed domain dataclasses
│   ├── reports/               # Analytical services (Phase 2)
│   ├── api/                   # REST API endpoints (Phase 3)
│   └── static/                # Modern faculty dashboard UI (Phase 3)
├── data/                      # Local acceptance marksheets (git-ignored for privacy)
│   ├── Result_anonymized.xlsx
│   ├── test1_commerce_same_layout.xlsx
│   ├── test1_same_layout_10courses_3divs.xlsx
│   ├── test2_lifesci_vague_single_row.xlsx
│   ├── test2_vague_single_row_batches.xlsx
│   ├── test3_arts_messy_sheet_per_division.xlsx
│   └── test3_messy_sheet_per_division.xlsx
├── tests/                     # Automated test suites
│   ├── test_acceptance_workbooks.py # Verified ground-truth tests across all 7 workbooks
│   ├── test_data_quality.py   # Anomaly detection unit tests
│   └── test_ingest.py         # Parsing, layout induction, & provenance unit tests
├── pytest.ini                 # Pytest runner configuration
├── requirements.txt           # Minimal, lightweight dependencies
└── README.md
```

---

## 🚀 Setup & Testing

### 1. Requirements
Install the lightweight, rock-solid dependencies:
```bash
pip install -r requirements.txt
```

Dependencies:
- `duckdb>=1.0.0`
- `openpyxl>=3.1.2`
- `pandas>=2.2.0`
- `numpy>=1.26.0`
- `pytest>=8.0.0`

### 2. Run Test Suite
Run all automated unit and acceptance tests:
```bash
pytest
```
*Current test pass rate: 20/20 passed in ~2 seconds.*

---

## 📊 Verified Ground Truth Across Acceptance Workbooks

| Workbook | Domain / Format | Sheets Accepted | Students | Courses | Scores | Key Invariant Verified |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `Result_anonymized.xlsx` | Mumbai University 3-tier merged | `Sheet1` | **145** | **27** | 13,775 | 132 PASSES, 13 FAILS; Div A: 85, Div B: 60; Topper: Advait Pandey (801.0) |
| `test1_commerce_same_layout.xlsx` | Commerce 3-division | `Sheet1` | **60** | **10** | 2,280 | Div A, B, C; Unrecorded overall totals guarded |
| `test1_same_layout_10courses_3divs.xlsx` | Standard 3-division | `Sheet1` | **60** | **10** | 2,280 | Div A, B, C |
| `test2_lifesci_vague_single_row.xlsx` | Life Sciences single-row | `Results Oct` | **45** | **7** | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2; `ABS` flag handled |
| `test2_vague_single_row_batches.xlsx` | Single-row synthetic | `Results Oct` | **45** | **7** | 1,215 | Single-row layout (`rows_per_student=1`); Batch 1 & 2 |
| `test3_arts_messy_sheet_per_division.xlsx` | Multi-sheet Arts per-division | `Div A`, `Div B` | **50** | **8** | 1,500 | Both sheets accepted; Div A: 25, Div B: 25 |
| `test3_messy_sheet_per_division.xlsx` | Multi-sheet Engineering per-division | `Div A`, `Div B` | **50** | **8** | 1,500 | Both sheets accepted; Div A: 25, Div B: 25 |
| **Total** | — | — | **455** | — | **23,765** | **100% Verified With Zero Silent Data Loss** |
