# Deliverable 12: Candidate Academic Contributions and Prohibited Claims Register

## 1. Candidate Paper Contributions Matrix

This register classifies all candidate contributions suitable for academic publication, rated by evidence strength (**Strong**, **Moderate**, or **Weak**), accompanied by exact code evidence and required scientific caveats.

| # | Candidate Contribution Claim | Claimed Scientific Advancement | Evidence Path in Repo | Evidence Strength | Mandatory Paper Caveat |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **C1** | **Dynamic Multi-Sheet Layout Induction** | Infers table coordinates, multi-row header keywords, course blocks, and student stride (single vs paired row) without pre-registered column schemas. | [`app/core/ingest.py:154-380`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/core/ingest.py#L154-L380)<br>`paper_audit/experiments/exp_a_parsing_results.csv` | **STRONG** | Restricted to OpenXML `.xlsx` spreadsheets; unsupported for scanned raster PDFs, arbitrary 3+ row strides, or transposed student matrices. |
| **C2** | **3-Tier Explainable Academic Anomaly Detection** | Decouples mathematical marksheet reconciliation errors (Tier A) from non-parametric statistical outliers (Tier B) and multivariate pattern anomalies (Tier C). | [`app/services/anomaly_detection.py`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py)<br>`paper_audit/experiments/exp_b_anomaly_detection_summary.csv` | **STRONG** | Tier B is decoupled from default faculty views to prevent false-positive alert fatigue on top students; Tier C requires cohort size $N \ge 15$. |
| **C3** | **Zero-PII Schema-Constrained Query Compiler** | Translates natural language queries into deterministic DuckDB SQL predicate ASTs in $<20\text{ ms}$ with zero PII egress and zero numerical hallucination. | [`app/services/ai_service.py:98-247`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L98-L247)<br>`paper_audit/experiments/exp_d_ask_ai_results.csv`<br>`paper_audit/experiments/exp_f_privacy_report.json` | **STRONG** | Grammar is rule-based and constrained to defined schema fields; interrogative keywords (e.g. "who") can bypass non-academic rejection guards. |
| **C4** | **Automated Numeric Verification for Executive Briefs** | Synthesizes institutional executive briefs with an automated numerical extraction audit verifying that 100% of narrative figures match database ground truth. | [`app/services/ai_service.py:249-420`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/ai_service.py#L249-L420)<br>`paper_audit/experiments/exp_e_hod_brief_results.csv` | **MODERATE** | Generates narrative from structured templates rather than open-ended text; triggers rigid template fallback in $14.3\%$ of single-cohort workbooks. |
| **C5** | **Ultra-Lightweight Ergonomic Client Architecture** | Delivers a WCAG 2.1 AA compliant marksheet auditing interface in an initial JavaScript bundle of **99.88 KiB gzip** with zero heavy client chart libraries. | [`scripts/check-bundle-budget.mjs`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/scripts/check-bundle-budget.mjs)<br>[`scripts/check-contrast.mjs`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/scripts/check-contrast.mjs) | **MODERATE** | Dense spreadsheet matrices containing 25+ courses require horizontal scrolling on narrow tablet and mobile viewports. |
| **C6** | **Pre-ESE Early Warning Heuristic Model** | Flags students at critical risk of course failure based on continuous internal evaluations (MSE/ISA) prior to final examination sittings. | [`app/services/student_service.py:403-491`](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/student_service.py#L403-L491)<br>`paper_audit/experiments/exp_g_early_warning_summary.json` | **WEAK** / **MODERATE** | Evaluated on an authentic engineering cohort with small positive class ($N=13$ failures out of 145); cannot anticipate unforeseen exam absences. |

---

## 2. Prohibited Claims Register (What the Paper Must NOT Claim)

To preserve scientific integrity and avoid reviewer rejection, paper authors **must NOT** make the following claims:

1. **DO NOT Claim to be a General Generative AI / Large Language Model**:
   - *Reason*: EduQuery does NOT train, fine-tune, or host a generative transformer. Its "Ask AI" component is a compiled domain-specific regular-expression predicate parser that translates query tokens into DuckDB SQL. Describing this as a "Novel Educational LLM" would be scientifically fraudulent.
2. **DO NOT Claim Universal Format Agnosticism**:
   - *Reason*: The ingestion engine is engineered specifically for spreadsheet tables (`.xlsx`). It cannot ingest scanned image marksheets, paper photos, raw text, or unstructured Word documents.
3. **DO NOT Claim Multi-Institutional Cross-Country Generalizability**:
   - *Reason*: The primary authentic marksheet dataset (`Result_anonymized.xlsx`) originates from a single engineering institution operating under the University of Mumbai Choice Based Credit System (CBCS). While synthetic datasets cover commerce and arts, empirical generalization to North American letter-only systems or European ECTS scales has not been field-tested.
4. **DO NOT Claim Autonomous Grading or Result Finalization**:
   - *Reason*: EduQuery is an auditing and reporting decision-support tool. It never modifies grades. The legal responsibility for declaration remains exclusively with human institutional examination committees.
5. **DO NOT Claim Formal Regulatory Privacy Certifications**:
   - *Reason*: The architecture provides local storage and zero network egress, but claiming official certification under FERPA, GDPR, or DPDP 2023 requires formal institutional institutional accreditation and legal compliance audits.

