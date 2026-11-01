# Figure Captions Master Register

### Figure 1: Privacy-Preserving System Architecture
**Caption:** Comprehensive end-to-end decoupled architectural stages of EduQuery V3. Raw multi-layout institutional workbooks are ingested through an upload-hardened gateway (enforcing zip-bomb ratio checks and formula sanitization), processed via an openpyxl-based coordinate induction engine, and stored in an in-memory vectorized DuckDB OLAP database. The client single-page application (React 19 + TailwindCSS 4) operates under a strict sub-100 KiB gzip bundle budget, interacting with the analytical backend via local REST endpoints with zero external LLM egress and total ephemeral session teardown upon completion.
*Source Data:* `paper_audit/figures/fig1_system_architecture.csv`

---

### Figure 2: End-to-End Marksheet Ingestion & Analytics Pipeline
**Caption:** Seven-stage sequential data transformation pipeline implemented in EduQuery V3: (1) Intake & Hardening, (2) Layout Induction, (3) Vectorized OLAP Normalization, (4) Tier A Deterministic Invariant Checks, (5) Tiered Statistical & ML Anomaly Detection, (6) Academic Grouping & Faculty Moderation, and (7) Cryptographically Clean Reporting Egress. Every computation runs strictly within local host boundaries, ensuring complete privacy preservation.
*Source Data:* `paper_audit/figures/fig2_data_pipeline.csv`

---

### Figure 3: Isolation Forest Contamination Sensitivity & Tier Ablation
**Caption:** Sensitivity profile of the Multivariate Isolation Forest (Tier C) across contamination hyperparameters ($c \in [0.01, 0.15]$), benchmarked over 10 random seeds with planted anomalies ($N=150$). Precision decreases monotonically from 0.780 to 0.748 as $c$ increases, while recall rises from 0.010 to 0.819. The system default operating point ($c=0.05$) balances false positive control ($FPR=0.014$) and precision (0.775) when coupled with deterministic Tier A checks ($F_1 = 0.806$).
*Source Data:* `paper_audit/figures/fig3_anomaly_pr_curves.csv`

---

### Figure 4: Confusion Matrices across Anomaly Detection Tiers
**Caption:** Empirical confusion matrices comparing four anomaly detection configurations on an evaluation cohort ($N=150$, 21 positive anomalies, 129 controls; mean over 10 seeds): (a) Tier A (Deterministic Invariants), achieving perfect precision ($1.000$) and zero false positives ($FPR=0.000$); (b) Tier C (Isolation Forest alone at $c=0.05$); (c) EduQuery System Default (Tier A + Tier C), achieving $F_1=0.806$ while suppressing false alerts on top performers; and (d) High-Recall Ensemble (Tier A + Tier B), achieving $F_1=0.993$ and $100\%$ recall.
*Source Data:* `paper_audit/figures/fig4_anomaly_confusion_matrices.csv`

---

### Figure 5: Ingestion Scalability & API Latency Profile
**Caption:** System scalability and response time profile. (Left) Wall-clock ingestion runtime and peak memory usage across synthetic student cohorts ($N=100$ to $2,000$ students, up to $64,000$ scores), exhibiting sub-linear scaling ($13.737$ s and $134.13$ MB RAM at $N=2,000$). (Right) Cold hit vs warm mean latency for core analytical REST endpoints, demonstrating sub-70 ms warm response times across all operational queries.
*Source Data:* `paper_audit/figures/fig5_latency_scaling.csv`

---

### Figure 6: Responsive UI Multi-Device Architecture (Monochrome Glass)
**Caption:** Responsive layout transformations across Desktop ($1440 \times 900$), Tablet ($768 \times 1024$), and Mobile ($390 \times 844$) viewports. The Monochrome Glass design system utilizes high-contrast semantic tokens passing 40/40 WCAG 2.1 AA accessibility checks, a dual-density table rendering engine, and achieves a $68.7\%$ bundle size reduction and $38\%$ interaction click reduction compared to legacy marksheet portals.
*Source Data:* `paper_audit/figures/fig6_ui_responsive_grid.csv`
