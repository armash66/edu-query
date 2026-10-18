# Explainable Academic Anomaly Detection Methodology

## 1. Executive Summary & Design Principles

The Explainable Academic Anomaly Detection system in EduQuery V3 introduces genuine, measurable machine learning and robust statistical capabilities to assist faculty during marksheet moderation and review.

The system is built upon five foundational safety principles:
1. **Never Label Deterministic Checks as ML**: Arithmetic reconciliation gaps and legal range violations are deterministic audit findings, not machine learning predictions.
2. **Never Treat ML Scores as Probabilities**: Tree-based Isolation Forest scores represent structural isolation depth in normalized feature space, *never* probability of student misconduct or administrative error.
3. **Never Override Official Academic Outcomes**: Anomaly detection is purely exploratory and diagnostic. No algorithm alters official student grades, SGPI, or pass/fail determinations.
4. **Transparent Feature Explanations**: Every finding includes the specific features that contributed to the flag, student values vs. cohort medians, and plain language explanations.
5. **Traceable Source Provenance & Moderation Review**: Findings link directly to student transcript profiles (`/students/:id`) and course failure rosters (`/subjects/:code/failures`), and faculty can record moderation review notes.

---

## 2. Three-Tier Detection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MARKSHEET INPUT TABLES (DuckDB)                        │
│             `students`, `courses`, `scores`, `reconciliation`               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│ Tier A: Deterministic │  │ Tier B: Robust Stats   │  │ Tier C: Multivariate  │
│ Validation Rules      │  │ (Median Absolute Dev) │  │ Isolation Forest (ML) │
├───────────────────────┤  ├───────────────────────┤  ├───────────────────────┤
│ • Printed vs computed │  │ • Normalized score    │  │ • 5-dimensional      │
│   total discrepancies │    deviation from course │    feature vector:    │
│   (|printed - sum|    │    median (|Z| >= 3.0 &  │    - norm_mean_score  │
│    > 0.05 marks)      │    |diff| >= 15.0)       │    - score_dispersion │
│ • Out-of-bounds marks │  │ • Intra-student cross-│    - max_mismatch     │
│   (< 0 or > 100)      │    course performance    │    - fail_ratio       │
│ • Unparsed cells      │    volatility collapses  │    - total_marks_norm │
│ • Result vs flag      │  │ • Minimum 10 valid    │  │ • Contamination: 0.05 │
│   contradictions      │    students required     │  │ • Fixed seed: 42      │
└───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘
            │                          │                          │
            └──────────────────────────┼──────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   EXPLAINABLE ANOMALY AGGREGATOR                            │
│  - Stable Finding ID (e.g. DET-MISMATCH-001, STAT-MAD-004, ML-ISOFOREST-002)│
│  - Method & Severity Tagging (Critical / Warning / Info)                    │
│  - Plain-Language Explanations & Limitations Disclaimers                    │
│  - In-Memory / Persisted Faculty Review State                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical & Algorithmic Formulations

### Tier A: Deterministic Academic Verification
- **Total Reconciliation**:
  $$\Delta_{\text{total}} = |\text{printed\_total} - \text{computed\_total}|$$
  A critical finding is raised if $\Delta_{\text{total}} > 0.05$.
- **Boundary Range Validation**:
  $$\text{Valid}(x) = 0.0 \le x \le 100.0 \quad (\text{or } \le 150.0 \text{ for combined lecture+lab courses})$$

### Tier B: Robust Statistical Baseline (Median Absolute Deviation)
Standard mean and standard deviation are heavily influenced by the very outliers being detected. EduQuery V3 uses Median Absolute Deviation (MAD):
$$\text{Median} = \text{median}(X)$$
$$\text{MAD} = \text{median}(|X - \text{Median}|)$$
$$\text{Scale} = \max(1.4826 \times \text{MAD}, 5.0)$$
$$\text{Robust } Z = \frac{X - \text{Median}}{\text{Scale}}$$

An anomaly finding is surfaced if:
$$|Z_{\text{robust}}| \ge 3.0 \quad \text{AND} \quad |X - \text{Median}| \ge 15.0 \text{ marks}$$

### Tier C: Multivariate Numerical Isolation Forest
- **Algorithm**: `sklearn.ensemble.IsolationForest(n_estimators=100, contamination=0.05, random_state=42)`
- **Feature Matrix ($N \times 5$)**:
  1. $\text{mean\_norm\_score} = \frac{1}{|C|} \sum_{c \in C} \frac{s_c}{100.0}$
  2. $\text{score\_dispersion} = \text{std}(\{s_c\}_{c \in C}) / 100.0$
  3. $\text{max\_mismatch} = \max_{c \in C} |p_c - s_c|$
  4. $\text{fail\_ratio} = \frac{\text{count}(s_c < 40.0)}{|C|}$
  5. $\text{total\_marks\_ratio} = \frac{\text{total\_marks}}{\text{max}(\text{total\_marks})}$
- **Exclusion Invariants**:
  Students enrolled in fewer than 2 valid courses or lacking calculated marks are excluded from training to preserve estimator validity. Excluded counts and reasons are tracked.
- **Sample Size Safeguard**:
  If fewer than 15 valid multi-course students exist in the cohort, Isolation Forest is automatically disabled (`insufficient_data = True`), returning deterministic and robust statistical checks with explicit explanation.

---

## 4. Empirical Benchmark Evaluation Results

Evaluated on a controlled synthetic marksheet benchmark ($N = 150$ students, 6 courses, 21 injected anomalies with ground-truth labels kept strictly separate from features via `scripts/evaluate_anomaly_detection.py`):

| Method | True Positives | False Positives | True Negatives | False Negatives | Precision | Recall | FPR | Runtime |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Deterministic Rules** | 12 | 0 | 129 | 9 | **1.000** | 0.571 | 0.000 | 0.17 ms |
| **Robust Z-Score (MAD)** | 13 | 1 | 128 | 8 | **0.929** | 0.619 | 0.008 | 0.76 ms |
| **Multivariate Isolation Forest** | 5 | 3 | 126 | 16 | **0.625** | 0.238 | 0.023 | 76.73 ms |

### Contamination Rate Sensitivity Analysis (Isolation Forest)
| Contamination $\alpha$ | Precision | Recall | False Positive Count |
| :--- | :--- | :--- | :--- |
| $\alpha = 0.01$ | 0.00 | 0.00 | 2 |
| $\alpha = 0.03$ | 0.60 | 0.14 | 2 |
| $\alpha = 0.05$ (Calibrated default) | **0.62** | **0.24** | 3 |
| $\alpha = 0.10$ | **0.73** | **0.52** | 4 |

---

## 5. Known Limitations & Faculty Guidance

1. **Not a Fault Indicator**: Isolation Forest identifies multivariate statistical rarity. A student scoring exceptionally high marks in theoretical subjects but average marks in practical labs will exhibit high dispersion without any academic irregularity.
2. **Denominator Sensitivity**: Robust Z-scores require at least 10 valid student scores per course. Courses with small elective enrollments are skipped.
3. **No Automatic Action**: Faculty must inspect the source marksheet workbook and answer scripts before drawing academic conclusions.
