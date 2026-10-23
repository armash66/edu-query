# EduQuery - Documentation Architecture

This directory contains technical specifications, architecture guides, deployment procedures, operational standards, and historical engineering reports for EduQuery.

---

## Core System Documentation

| Document | Purpose |
| :--- | :--- |
| [`architecture.md`](./architecture.md) | System goals, non-goals, layer boundaries, DuckDB concurrency model, relational schema, and component flow. |
| [`development.md`](./development.md) | Local developer onboarding, prerequisites, virtual environments, development servers, and troubleshooting. |
| [`deployment.md`](./deployment.md) | Production Docker containerization, Render web service deployment, Vercel frontend, storage mounts, and health probes. |
| [`security.md`](./security.md) | Faculty Identity Gateway (Cloudflare Access RS256 JWT), CORS allowlisting, ephemeral session isolation, CSV export protections, and threat model. |
| [`data-handling.md`](./data-handling.md) | Excel workbook ingestion, layout induction, absence-versus-zero handling, MDM elective semantics, data-quality checks (Checks 1-10), and classification rules. |
| [`testing.md`](./testing.md) | Test suite organization, execution commands, 279 Pytest backend tests, 61 Vitest frontend tests, TypeScript validation, and acceptance workbooks. |
| [`api-contract.md`](./api-contract.md) | Complete REST API endpoint contracts, request/response schemas, status codes, and error envelopes. |
| [`investigation-engine.md`](./investigation-engine.md) | Interactive multi-condition query engine, filtering grammar, presets, and SQL translation. |
| [`anomaly-detection-methodology.md`](./anomaly-detection-methodology.md) | Three-tier noise-reduced anomaly detection methodology, evaluation benchmarks, and faculty review loops. |

---

## Historical Engineering & Milestone Reports

These documents preserve technical decisions, acceptance criteria, and audit findings from development phases:

- [`product-reorientation.md`](./product-reorientation.md): Architectural transition from earlier natural-language LLM planning prototypes to deterministic marksheet analysis.
- [`implementation-roadmap.md`](./implementation-roadmap.md): Milestone delivery schedule and criteria.
- [`phase5-acceptance-report.md`](./phase5-acceptance-report.md): Phase 5 ground-truth validation across disparate curriculum workbooks.
- [`phase6-reliability-report.md`](./phase6-reliability-report.md): Phase 6 database lifecycle, connection pooling, and CSV export hardening.
- [`phase7-release-candidate-report.md`](./phase7-release-candidate-report.md): Phase 7 end-to-end integration and release candidate audit.
- [`phase8-implementation-report.md`](./phase8-implementation-report.md): Phase 8 anomaly detection implementation and evaluation benchmark.
- [`phase9-minimalist-design-report.md`](./phase9-minimalist-design-report.md): Phase 9 institutional UI design system and component architecture.
- [`phase10-workflow-and-hosting-audit.md`](./phase10-workflow-and-hosting-audit.md): Phase 10 MDM elective invariants, containerization, and hosting audit.
- [`phase11-release-candidate-report.md`](./phase11-release-candidate-report.md): Phase 11 production release candidate validation and security boundaries.
- [`phase12-product-and-privacy-report.md`](./phase12-product-and-privacy-report.md): Phase 12 privacy-first upload workflow, ephemeral session deletion, and UX.
- [`phase13-deployment-gate-report.md`](./phase13-deployment-gate-report.md): Phase 13 pre-deployment security gate, CORS hardening, gateway auth, and ticket downloads.
