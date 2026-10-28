# EduQuery Project Audit: 10 - Machine Learning & AI Status Report

## 1. Architectural Strategy: The "Zero Neural Bloat" Decision

A central architectural decision in EduQuery—documented in [docs/product-reorientation.md](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/docs/product-reorientation.md)—was the deliberate elimination of neural language models (LLMs), deep learning transformers, and text-to-SQL generation.

### Why Generative AI Was Rejected for Academic Marksheets:
1. **Arithmetic Inexactness & Hallucination Risk:** Generative language models predict probabilistic token sequences; they do not compute exact arithmetic. When calculating student CGPAs, SGPIs, and credit point summations ($\sum C_i \times G_i$), an LLM has a non-zero probability of generating inaccurate marks, creating legal and institutional liability.
2. **Tabular Context Window Limits:** An institutional marksheet workbook containing 150 to 2,000 students across 27 subjects exceeds token context boundaries and produces quadratic latency overheads.
3. **Determinism as a Core Value:** Faculty, examination registrars, and university controllers require reproducible, auditable verification where the same query executed twice yields the exact same verifiable row data with mathematical certainty.

---

## 2. Machine Learning Inventory

EduQuery’s ML capability is restricted to **unsupervised, statistically grounded anomaly detection** implemented via Scikit-Learn.

| Component / File | Algorithm / Technique | Runtime State | What It Does | Runs End-to-End? | Model Artifact Exists? | Role in Production |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `app/services/anomaly_detection.py` | **Multivariate Isolation Forest (`sklearn.ensemble.IsolationForest`)** | Active Runtime | Extracts 5 normalized student performance features (`mean_score`, `dispersion`, `max_mismatch`, `fail_ratio`, `tot_ratio`). Fits 100 isolation trees to flag structural anomalies. | **Yes** (integrated into anomaly detection pipeline) | **No** (fits dynamically on active cohort in ~100ms; no static `.pkl` required) | Production Tier C Anomaly Detector |
| `app/services/anomaly_detection.py` | **Median Absolute Deviation (MAD) & Robust Z-Scores** | Active Runtime | Computes course-level median and non-parametric dispersion ($MAD \times 1.4826$) to detect score anomalies robust to cohort outliers. | **Yes** (integrated into anomaly detection pipeline) | **N/A** (Pure mathematical vector formula) | Production Tier B Anomaly Detector |
| `scripts/evaluate_anomaly_detection.py` | **Synthetic Cohort Benchmark Harness** | Evaluation / Benchmark | Generates a 150-student synthetic marksheet cohort with 21 ground-truth labeled anomalies to evaluate precision, recall, and false positive rates. | **Yes** (runs standalone from CLI) | **N/A** (Synthetic data generator script) | Offline QA & Methodology Validation |
| `docs/anomaly-detection-methodology.md` | **Mathematical Specification** | Documentation | Formal documentation of contamination hyperparameters ($c = 0.05$), non-parametric z-score bounds ($|z| \ge 3.0$), and honest failure modes. | **N/A** (Specification document) | **N/A** | Technical Specification |

---

## 3. Detailed Component Deep-Dive

### 3.1 Multivariate Isolation Forest (`IsolationForestDetector`)
- **Location:** [app/services/anomaly_detection.py](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/app/services/anomaly_detection.py) (Lines 200–280)
- **Feature Vector per Student:**
  $$X_i = \left[ \frac{\mu_i}{100}, \frac{\sigma_i}{100}, \max_j |\Delta_{ij}|, \frac{\text{fails}_i}{N}, \frac{\text{total}_i}{\text{max\_cohort\_total}} \right]$$
  where $\mu_i$ is student mean mark, $\sigma_i$ is score standard deviation, $\Delta_{ij}$ is printed vs computed mark mismatch in course $j$, and $\text{fails}_i$ is the count of failed courses.
- **Hyperparameters:**
  - `n_estimators = 100`
  - `contamination = 0.05` (assumes top 5% most isolated points are anomalous)
  - `random_state = 42` (guarantees deterministic, reproducible isolation trees)
  - `n_jobs = 1`
- **Dynamic Training Invariant:**
  The model trains on the fly when the active dataset contains $\ge 30$ students. If the cohort size is $<30$, the pipeline skips Tier C Isolation Forest and relies strictly on Tier A (Deterministic rules) and Tier B (Robust statistical MAD) to avoid small-sample overfitting.
- **Execution Performance:** Fits and scores 150 students in **$102.24\text{ ms}$**.

---

## 4. Stubbed, Planned or Abandoned AI Features

| Feature / Artifact Concept | Initial Concept | Current Status | Verdict / Action for Redesign |
| :--- | :--- | :--- | :--- |
| **Conversational Chat Bot** | Natural language text box answering questions like *"Who topped the class?"* | **Abandoned (Replaced by Structured Investigation Engine)** | Keep abandoned. The faceted filter builder in `/explore` provides 100% deterministic, instant queries without LLM hallucination risks or OpenAI API cost overheads. |
| **HuggingFace / PyTorch Fine-Tuning** | Fine-tuning a small open model (e.g. Llama-3-8B / Mistral) on marksheet JSON schemas. | **Never Implemented (Zero Bloat Invariant)** | Excluded by design. Maintains `requirements.txt` container footprint under 50MB. |
| **Neural OCR Marksheet Parser** | Vision-language models (e.g. Florence-2 / Donut) reading scanned marksheet PDFs. | **Not Implemented (Future Roadmap Proposal)** | If institutions demand paper marksheet scanning in a future phase, integrate an isolated microservice rather than bloating the core web application. |
| **Automated Grading Curve Predictor** | Regression model predicting student SGPI outcomes based on midterm scores. | **Planned / Proposal Only** | Feasible using lightweight Scikit-Learn linear models; not currently present in the codebase. |

