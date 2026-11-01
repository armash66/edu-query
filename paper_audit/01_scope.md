# Deliverable 01: Scope, Feature Inventory, and Operational Taxonomy

## 1. System Mission and Target Users

EduQuery V3 is an on-premises, privacy-preserving analytical engine and academic marksheet audit system. It is engineered specifically for higher education institutions that manage wide, complex examination marksheets generated in spreadsheet formats (e.g., Microsoft Excel `.xlsx`). The system ingests raw multi-division marksheets, performs layout induction without rigid schema prerequisites, executes automated arithmetic reconciliation, detects academic anomalies across deterministic and machine learning tiers, flags pre-examination at-risk students, and produces publication-ready institutional reports.

### Target User Personas
1. **Head of Department (HOD)**:
   - *Use Cases*: Needs rapid executive visibility into cohort pass/fail percentages, curriculum bottlenecks (subjects with abnormal failure rates), division performance disparities, and official merit commendations.
   - *Workflow*: Reviews the 1-Page Fact-Verified HOD Executive Brief, monitors division comparisons, and reviews summary failure patterns.
2. **Examination Cell Controller / Examination Officer**:
   - *Use Cases*: Responsible for marksheet ingestion integrity, arithmetic verification (validating that printed student totals equal the exact sum of internal and external assessment components), detecting out-of-bounds marks (e.g., typos like 125/100 or negative marks), managing official merit lists, and issuing student result slips.
   - *Workflow*: Uploads raw Excel workbooks, audits data quality findings, resolves reconciliation discrepancies, and exports verified Excel/PDF rosters.
3. **Faculty Mentor / Academic Class Advisor**:
   - *Use Cases*: Identifies chronically absent students across course components (ESE, MSE, ISA), tracks students at risk of semester failure prior to final examinations, drafts personalized remedial counseling notices, and generates peer-tutoring groups.
   - *Workflow*: Filters absent student rosters, reviews early warning indicators, reviews explainable anomaly findings, and dispatches standardized notice templates.

---

## 2. Explicit Negative Scope (What the System Does NOT Do)

To ensure academic integrity, ethical compliance, and institutional safety, the system explicitly excludes the following capabilities:
1. **No Cloud LLM PII Egress**: The system does NOT transmit student names, roll numbers, registration keys, or marks to remote commercial LLM APIs (e.g., OpenAI, Google Gemini Cloud, Anthropic). All query parsing and briefing engines run locally and deterministically.
2. **No Autonomous Grade Alteration**: The system NEVER modifies, moderates, curves, or overrides official marksheet records. Anomaly detection findings are advisory only; official outcomes remain identical to the source workbook unless administrative re-upload occurs.
3. **No Speculative Outcome Prediction**: The system does NOT perform speculative multi-year career forecasting, dropout prediction, or grading regression. Early warning indicators are strictly based on deterministic thresholds of recorded continuous assessments (MSE/ISA).
4. **No Scanned or Image-Based OCR Ingestion**: The system operates on structured and semi-structured spreadsheet workbooks (`.xlsx`). It does not ingest scanned physical marksheet papers, mobile photos, or unparsed raster PDFs.
5. **No Replacement of University SIS**: EduQuery is an analytical auditing and reporting layer, not a transactional Student Information System (SIS) for course registration, fee collection, or hostel management.

---

## 3. Comprehensive Feature Status & Operational Taxonomy

Every capability in EduQuery V3 is classified by its implementation status (**IMPLEMENTED**, **PARTIAL**, or **NOT IMPLEMENTED**), its operational paradigm (**Deterministic**, **Statistical**, or **Machine Learning / LLM**), and the exact code evidence.

| Feature / Subsystem | Implementation Status | Operational Paradigm | Model / Algorithm / Library | Code Location & Evidence |
| :--- | :---: | :---: | :---: | :--- |
| **Multi-Sheet Layout Induction** | **IMPLEMENTED** | Deterministic | Regex pattern matching + Merged-cell coordinate map $O(1)$ | [`app/core/ingest.py:154-380`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py#L154-L380) |
| **Stride Discovery (Paired-Row vs Single-Row)** | **IMPLEMENTED** | Deterministic | Alternating primary key empty-row heuristic | [`app/core/ingest.py:353-358`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py#L353-L358) |
| **Cell Parsing & Suffix Stripping** | **IMPLEMENTED** | Deterministic | Regex `FLAG_RE` extracting number, flag, state | [`app/core/ingest.py:72-133`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py#L72-L133) |
| **In-Process Analytical OLAP** | **IMPLEMENTED** | Deterministic | DuckDB 1.4.1 relational engine | [`app/core/database.py:10-90`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/database.py#L10-L90) |
| **Anti-Formula Injection Shield** | **IMPLEMENTED** | Deterministic | Formula character escaping (`=`, `+`, `-`, `@`, `\t`, `\r`) | [`app/services/export_service.py:53-79`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/export_service.py#L53-L79) |
| **Zip-Bomb & Upload Hardening** | **IMPLEMENTED** | Deterministic | Magic byte check (`PK\x03\x04`), 100MB uncompressed limit, 100x ratio cap | [`app/services/session_manager.py:165-255`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/session_manager.py#L165-L255) |
| **Ephemeral Session Workspaces** | **IMPLEMENTED** | Deterministic | Opaque token generation (`secrets.token_urlsafe`), directory isolation, atomic purge | [`app/services/session_manager.py:146-212`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/session_manager.py#L146-L212) |
| **Reconciliation Checks** | **IMPLEMENTED** | Deterministic | Component sum vs printed total (`\|printed - computed\| > 0.05`) | [`app/core/ingest.py:535-585`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py#L535-L585) |
| **Tier A Anomaly Detection** | **IMPLEMENTED** | Deterministic | Arithmetic gap rule + Out-of-bounds bounds rule | [`app/services/anomaly_detection.py:246-372`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py#L246-L372) |
| **Tier B Anomaly Detection** | **IMPLEMENTED** | Statistical | Non-parametric Median Absolute Deviation (MAD) ($Z_{robust} \ge 3.0$) | [`app/services/anomaly_detection.py:378-468`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py#L378-L468) |
| **Tier C Anomaly Detection** | **IMPLEMENTED** | Machine Learning | Multivariate Isolation Forest (`n_estimators=100`, `contamination=0.05`, `random_state=42`) | [`app/services/anomaly_detection.py:470-680`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py#L470-L680) |
| **Faculty Moderation Reviews** | **IMPLEMENTED** | Deterministic | Thread-safe atomic JSON store per session/dataset | [`app/services/anomaly_detection.py:43-140`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py#L43-L140) |
| **Pre-ESE Early Warning Roster** | **IMPLEMENTED** | Deterministic | Continuous internal evaluation thresholds (MSE < 8/10, ISA < 16/24) | [`app/services/student_service.py:403-491`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/student_service.py#L403-L491) |
| **Merit List & Competition Tie-Breaking** | **IMPLEMENTED** | Deterministic | Multi-key sort (CGPA $\rightarrow$ SGPI $\rightarrow$ Marks $\rightarrow$ Seat $\rightarrow$ Roll $\rightarrow$ Name) + 1224 rank | [`app/services/export_service.py:1353-1446`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/export_service.py#L1353-L1446) |
| **Remedial Student Grouping** | **PARTIAL** | Deterministic | Curriculum backlog identification implemented; automated bipartite peer-match solver omitted | [`app/services/analytics_service.py:270-300`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/analytics_service.py#L270-L300) |
| **Ask AI Query Assistant** | **IMPLEMENTED** | Deterministic | Rule-based Schema-Constrained Predicate AST Compiler (Zero External LLM) | [`app/services/ai_service.py:98-247`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L98-L247) |
| **Prohibited Query Refusal** | **IMPLEMENTED** | Deterministic | Regex filter rejecting speculative statistical modeling and non-academic queries | [`app/services/ai_service.py:48-96`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L48-L96) |
| **HOD Executive Brief Generator** | **IMPLEMENTED** | Deterministic | Ground-truth fact extraction JSON + verified narrative synthesizer | [`app/services/ai_service.py:249-389`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L249-L389) |
| **HOD Brief Numeric Verification Audit** | **IMPLEMENTED** | Deterministic | Automated extraction checking that 100% of narrative numbers match fact JSON | [`app/services/ai_service.py:391-420`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L391-L420) |
| **Notice & Letter Drafting** | **IMPLEMENTED** | Deterministic | Institutional templates with client/server-side `{placeholder}` substitutions | [`app/services/ai_service.py:423-468`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L423-L468) |
| **Absentee Tracking & Grouping** | **IMPLEMENTED** | Deterministic | Multi-component aggregation (ESE, MSE, ISA) + student multi-absence grouping | [`app/api/routes/absent_students.py:32-225`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/api/routes/absent_students.py#L32-L225) |
| **Student Result Slips (PDF)** | **IMPLEMENTED** | Deterministic | ReportLab 4.4.1 canvas generation | [`app/services/export_service.py:1000-1250`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/export_service.py#L1000-L1250) |
| **Multi-Format Exports (XLSX, CSV, PDF)**| **IMPLEMENTED** | Deterministic | openpyxl, Python standard csv, ReportLab | [`app/services/export_service.py:1-2285`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/export_service.py#L1-L2285) |

---

## 4. Key Architectural Takeaway on "AI" in EduQuery

While the system user interface presents "Ask AI", "HOD Brief", and "Notice Drafting", **the underlying implementation uses NO cloud LLMs or generative neural networks**.

This design choice was deliberate:
1. **Zero Hallucination Guarantee**: In academic grading, numerical hallucination (e.g. inventing a grade, passing a failed student, or miscalculating SGPI) is fatal. The predicate compiler maps queries directly into SQL expressions executed by DuckDB.
2. **Absolute Privacy Compliance**: Sending student marksheets to commercial third-party LLMs violates international student privacy standards (FERPA, GDPR, India Digital Personal Data Protection Act 2023). In EduQuery, zero PII ever leaves the server boundaries.
3. **Reproducibility**: Query translation and narrative brief generation produce identical, verifiable results across repeated executions on the same database state.

