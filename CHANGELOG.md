# Changelog

All notable changes to the EduQuery project during the Monochrome Glass redesign will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - Complete Monochrome Glass Redesign Release

### Added
- **Full Monochrome Glass Design Language**:
  - Replaced all ad-hoc styling and 12+ conflicting gray shades with an 8-step neutral scale (`neutral-0` to `neutral-1000`) and 4 frosted glass surfaces (`.glass-1`, `.glass-2`, `.glass-3`, `.data-surface`).
  - Strict elimination of decorative blue, purple, or rainbow tints in chrome; color is exclusively reserved for semantic outcomes (`PASS`, `FAIL`, `WARN`, `INFO`).
  - Pre-paint flash prevention script in `index.html` eliminating FOUT / theme flicker.
  - Complete WCAG 2.1 AA compliance across 40 token pairs ($>4.5:1$ contrast) verified by automated audit.
- **Component Library (`frontend/src/ui/`)**:
  - `GlassCard`, `Button`, `IconButton`, `Chip`, `StatusBadge`, `Tabs`, `SegmentedControl`, `Input`, `SearchField`, `Listbox`, `Modal`, `Drawer`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar`, `Stat`, `DataTable`.
  - Accessible custom SVG visualizations: `OutcomeBar`, `DivisionComparison`, `FailureRateBar` (tiered green/amber/red failure rates), and `Sparkline`.
  - WAI-ARIA accessible custom select `Listbox` replacing native `<select>` across all filter interfaces.
  - Interactive `/styleguide` live catalog showcasing all components in light and dark themes.
- **Consolidated Navigation & Modern Shell**:
  - Consolidated navigation from 8 items down to 5 primary destinations (`Overview`, `Students`, `Subjects`, `Data Quality`, `Datasets`).
  - Adaptive desktop floating glass sidebar with collapsible 72px rail mode.
  - Floating mobile bottom glass navigation bar (`glass-3`) with 44px minimum touch targets on mobile viewports $<768\text{px}$.
  - Global `Ctrl+K` / `⌘K` keyboard Command Palette for rapid navigation and theme switching.
  - Graceful cold-start `BootScreen` with container wake-up progress bar and automatic 4-second health polling.
- **Page-by-Page Redesign**:
  - `UploadPage`: Clean dropzone, accurate privacy disclosures (clarified backend memory parsing), instant layout preview.
  - `OverviewPage`: High-impact KPI strip, outcome distribution bar, divisional pass comparison, actionable anomaly review modal.
  - `StudentsPage`: High-density `DataTable` with sticky header and column, search, division filter, and export actions.
  - `StudentDetailPage`: Academic summary card, reconciliation verification badge, and atomized component table.
  - `SubjectsCatalogPage`: Tabbed catalog and failures ranking with tiered failure rate indicators.
  - `SubjectDetailPage`: Unified pass/fail roster, pass rate explanations, and print styling.
  - `DataQualityPage`: Health status card, blocking anomaly counters, and finding breakdown table.
  - `ImportPage`: Guided candidate preview, elective offerings inspection, blocking errors checklist, and dataset rollback table.
- **Performance & Asset Optimization**:
  - Route-level code splitting using `React.lazy()` and `<Suspense>`.
  - Optimized chunking separating `vendor-react`, `vendor-icons`, and page chunks (main bundle $<60\text{ kB}$, zero chunks exceeding 500 kB).
  - Additive streaming `.xlsx` export routes (`/api/v1/students/export/xlsx`, `/api/v1/subjects/{code}/export/xlsx`, `/api/v1/subjects/absent/export/xlsx`) powered by `openpyxl`.
  - Pruned dead starter files (`App.css`, `react.svg`).
  - Updated Render configuration to `region: singapore` for low-latency academic access.
  - Comprehensive documentation: `docs/design-system.md`, `docs/design-decisions.md`, `docs/deployment.md`.
  - 100% test pass rate maintained: 288/288 Pytest backend tests and 94/94 Vitest frontend tests.

---

## [0.5.0] - Redesign Phase 6: Performance, Code Splitting & SEO

### Added
- Route-level code splitting using `React.lazy()` and `<Suspense>` in `App.tsx`.
- Rollup manual chunking splitting `vendor-react` and `vendor-icons`.
- Chunk size optimizations reducing initial bundle footprint.

---

## [0.4.0] - Redesign Phase 5: Page-by-Page Redesign

### Added
- Redesigned `UploadPage.tsx`, `OverviewPage.tsx`, `StudentsPage.tsx`, `StudentDetailPage.tsx`, `SubjectsCatalogPage.tsx`, `SubjectDetailPage.tsx`, `DataQualityPage.tsx`, and `ImportPage.tsx` using Monochrome Glass primitives.

---

## [0.3.0] - Redesign Phase 3: Component Library & Data Visualizations

### Added
- Complete "Monochrome Glass" component library in `frontend/src/ui/`.
- 17 unit tests in `frontend/src/ui/__tests__/components.test.tsx`.
- `/styleguide` live token and component showcase.

---

## [0.2.0] - Redesign Phase 2: Design Tokens & Theme Foundation

### Added
- Strict 8-step neutral palette (`neutral-0` to `neutral-1000`) and semantic glass surfaces.
- Automated WCAG 2.1 AA contrast checker (`scripts/check-contrast.mjs`).
- `ThemeContext.tsx` supporting System / Light / Dark modes with `localStorage` persistence.
- Pre-paint theme resolution script in `index.html`.

---

## [0.1.0] - Redesign Phase 1: Baseline

### Added
- Created dedicated redesign branch `redesign/mono-glass`.
- Captured 33 baseline "before" screenshots across 11 routes and 3 viewports.
- Archived baseline Lighthouse audits and file inventory.
