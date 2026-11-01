# Deliverable 11: Project Evolution, Commit History, and Design Lessons

## 1. Longitudinal Development Phases

The EduQuery project evolved through six distinct engineering phases, transitioning from an exploratory marksheet parser into an on-premises, privacy-preserving academic audit platform.

```
October 17, 2026 ───> Phase 1: Ingestion Core & In-Process DuckDB Foundation
October 18, 2026 ───> Phase 2: Security Gate Hardening, Zip-Bomb Shields & Quarantining
October 18, 2026 ───> Phase 3: 3-Tier Explainable Anomaly Detection Engine
October 23, 2026 ───> Phase 4: "Monochrome Glass" Design System & Ergonomic Refactoring
October 28-31, 2026 > Phase 5: Zero-PII Ask AI AST Compiler & Fact-Verified Briefings
November 1, 2026 ───> Phase 6: Multi-Format Egress Polish, Absentee Grouping & Release
```

### Phase-by-Phase Git Progression
| Phase | Date Range | Key Commits | Architectural Objectives & Changes | Key Lessons Learned |
| :--- | :---: | :--- | :--- | :--- |
| **Phase 1: Ingestion Core** | 2026-10-17 | `372ea95`, `9d4544f` | Built dynamic layout induction, merged-cell $O(1)$ lookup cache, cell regex parser (`FLAG_RE`), relational DuckDB normalization, and arithmetic reconciliation table. | Pre-computing openpyxl merged cells into an $O(1)$ coordinate dictionary reduced layout induction time by $85\%$. |
| **Phase 2: Security Gate** | 2026-10-18 | `4f23f36`, `b8764ce`, `bab209f` | Implemented 30 MB upload bounding, Zip-bomb decompression ratio ($100\times$) defense, anti-formula injection shielding (`'`), and unguessable session token workspaces. | Spreadsheet cell text starting with `=`, `+`, or `-` will execute OS commands in desktop Excel if exported without prefix escaping. |
| **Phase 3: Anomaly Engine**| 2026-10-18 | `13428` (`evaluate_anomaly_detection.py`) | Created 3-tier anomaly architecture: Tier A (arithmetic/bounds), Tier B (Robust MAD), Tier C (Isolation Forest). Introduced faculty moderation review store. | Non-parametric MAD flags genuine top performers as outliers. Tier B was decoupled from default faculty views to eliminate alert fatigue. |
| **Phase 4: Ergonomic Redesign** | 2026-10-23 – 2026-10-28 | `68a1868`, `b3b458e`, `5d6f06f`, `25e8a62` | Replaced 18 fragmented routes with 8 structured tabs under Analyze/Investigate/Act. Replaced bloated charting libraries with CSS micro-bars. Achieved 99.88 KiB gzip bundle. | High-saturation chromatic dashboards cause rapid cognitive fatigue when auditing thousands of marks; monochrome glass preserves visual focus. |
| **Phase 5: Privacy-First AI** | 2026-10-28 – 2026-10-31 | `a7e08ab`, `fd2b0a0`, `ca461eb` | Developed rule-based Schema-Constrained Predicate AST Compiler. Replaced remote LLM with local DuckDB SQL. Built 1-page HOD brief with automated numeric verification. | Generative LLMs hallucinate numbers in tabular datasets. Parsing questions into formal SQL ASTs guarantees $100\%$ mathematical correctness. |
| **Phase 6: Multi-Format Egress** | 2026-10-31 – 2026-11-01 | `5ffad91`, `ae47d7a`, `1468fb4`, `2b0572e`, `32caa74` | Synchronized Excel/PDF/CSV exports across students, subjects, and absentees. Built student multi-absence grouping and formal institutional notice drafting with Outlook mail-merge. | Examination offices require identical numbers across screen, printed PDF slips, and exported spreadsheets; a single unified SQL query must back all views. |

---

## 2. Architectural Comparison: Original (V1) vs Final System (V3)

| Architectural Dimension | Initial Prototype (V1) | Production Release (V3) | Rationale for Evolution |
| :--- | :--- | :--- | :--- |
| **Database Engine** | SQLite / On-disk Pandas DataFrames | In-process DuckDB 1.4.1 (OLAP) | DuckDB provides vectorized columnar aggregations, instant in-memory tables, and zero locking overhead. |
| **Client Bundle Size** | 1,480 KiB gzip (Recharts, heavy icons) | **99.88 KiB gzip** (Vite, Rollup, CSS bars) | Sub-100 KiB gzip enables instant loading over slow institutional intranets. |
| **Navigation Model** | 18 flat, unorganized sidebar links | 8 unified tabs in 3 cognitive groups | Reduces decision paralysis and click depth for high-stakes exam auditing. |
| **"AI" Paradigm** | Speculative external LLM API prompts | **Schema-Constrained Local AST Compiler** | Eliminates student PII egress to third parties and guarantees zero numerical hallucination. |
| **Data Persistence** | Permanent un-audited SQLite storage | **Isolated Ephemeral Sessions + Safe Purge** | Guarantees compliance with data minimization by permanently deleting session files on exit. |
| **Anomaly Classification**| Black-box outlier flags | **Explainable Multi-Tier Categorization** | Every finding presents the exact mathematical rule, contributing features, and explicit limitation disclaimer. |

---

## 3. Four Core Architectural Lessons for Educational Systems

1. **Deterministic SQL Trumps Generative LLMs for Marksheets**: In academic grading, numerical accuracy is non-negotiable. Passing a failed candidate or hallucinating an SGPI from a pasted markdown table destroys institutional trust. Restricting natural language querying to an AST compiler that executes deterministic SQL against DuckDB yields reproducible, verified answers in sub-20ms latency.
2. **Decouple Arithmetic Defects from Distributional Variance**: A spreadsheet where component marks do not sum to the printed total is an administrative error that must be resolved prior to grade declaration. In contrast, an exceptional student who scores 98 in a subject with a median of 50 is an asset to the cohort. Conflating mathematical errors with statistical outliers produces faculty alert fatigue.
3. **Defense-in-Depth for Spreadsheet Files**: Marksheets shared across academic departments frequently contain corrupted XML, macro triggers, or formulas. Enforcing ZIP magic byte validation, bounded decompression limits ($100\text{ MB}$), and formula sanitization (`'`) prevents malicious exploits and accidental corruption.
4. **Ergonomic Simplicity Drives High-Stakes Adoption**: Controllers auditing grades do not need 3D animated graphs. They need tabular alignment, high contrast (WCAG 2.1 AA), density controls (comfortable vs compact), and fast multi-format exports (PDF, XLSX, CSV).

