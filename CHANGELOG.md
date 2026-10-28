# Changelog

All notable changes to the EduQuery project during the Monochrome Glass redesign will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] - Redesign Phase 3: Component Library & Data Visualizations

### Added
- Complete "Monochrome Glass" component library in `frontend/src/ui/`:
  - `GlassCard.tsx`: Frosted glass cards (`glass-1`, `glass-2`, `glass-3`, `data-surface`) with header/footer slots.
  - `Button.tsx`: High-contrast solid primary, frosted glass secondary, ghost, danger; sm/md/lg sizes; 44px min touch target; loading spinner with `aria-busy`.
  - `IconButton.tsx`: 44px accessible icon buttons with required `aria-label`.
  - `Chip.tsx`: Interactive filter chips with 44px touch-target remove button.
  - `StatusBadge.tsx`: Dual-encoding (icon + text) status badges for `pass`, `fail`, `warn`, `info`.
  - `Tabs.tsx`: WAI-ARIA tab pattern with Arrow/Home/End keyboard navigation.
  - `SegmentedControl.tsx`: Keyboard accessible 2-4 item glass toggle.
  - `Input.tsx` & `SearchField.tsx`: Floating labels, clearable button, error alert slots, `Ctrl+K` shortcut hint.
  - `Listbox.tsx`: WAI-ARIA accessible custom select popover replacing native `<select>`.
  - `Modal.tsx` & `Drawer.tsx`: Focus trap, Escape key listener, backdrop dismissal, mobile bottom-sheet transform.
  - `Toast.tsx` & `ToastContext`: Stacking dismissible glass toasts with pause-on-hover.
  - `Skeleton.tsx`: Shimmer placeholder pulse in neutral scale.
  - `EmptyState.tsx` & `ErrorState.tsx`: Accessible fallback displays with retry and clear actions.
  - `ProgressBar.tsx`: Determinate and indeterminate accessible progress bars.
  - `Stat.tsx`: KPI cards with tabular display numbers, delta indicators, and sparklines.
  - `DataTable.tsx`: Semantic table with sortable columns (`aria-sort`), sticky header/columns, density toggle, and pagination.
  - SVG Visualizations: `OutcomeBar.tsx`, `DivisionComparison.tsx`, `FailureRateBar.tsx` (with tiered `<5%`, `5-15%`, `>15%` colors), and `Sparkline.tsx`.
- 17 new Vitest unit tests in `frontend/src/ui/__tests__/components.test.tsx` verifying accessibility and keyboard interactions (94/94 total passing).
- Updated `/styleguide` route with interactive live showcase of every component in both light and dark themes.

---

## [0.2.0] - Redesign Phase 2: Design Tokens & Theme Foundation

### Added
- Implemented complete "Monochrome Glass" design token architecture in `frontend/src/index.css`:
  - Strict 8-step neutral palette (`neutral-0` to `neutral-1000`).
  - Semantic glass family (`.glass-1`, `.glass-2`, `.glass-3`, `.data-surface`).
  - Fluid typography scale in `rem` with `font-variant-numeric: tabular-nums`.
  - Pure CSS atmosphere refraction canvas with drifting radial orbs.
  - Semantic status tokens with high contrast ratios for results (`PASS`, `FAIL`, `WARN`, `INFO`).
- Created `scripts/check-contrast.mjs` verifying 40/40 token/surface pairs against WCAG 2.1 AA thresholds ($>4.5:1$); integrated into `npm run build`.
- Created `frontend/src/context/ThemeContext.tsx` providing System / Light / Dark theme management with `localStorage` persistence and OS media listener.
- Updated `frontend/index.html` with pre-paint theme resolution script to eliminate theme flashes, adaptive monochrome SVG favicon, Web Manifest, and complete Open Graph/SEO tags.
- Built `/styleguide` view (`frontend/src/pages/StyleguidePage.tsx`) showcasing all tokens, surfaces, and semantic indicators in live light and dark themes.

---

## [0.1.0] - Redesign Phase 1: Baseline

### Added
- Created dedicated redesign branch `redesign/mono-glass`.
- Captured 33 baseline "before" screenshots across all 11 routes and 3 viewports into `/audit_after/before/`.
- Archived baseline Google Lighthouse audits in `/audit_after/lighthouse/`.
- Recorded baseline Vite production bundle sizes.
- Initialized `/docs/design-decisions.md` and `CHANGELOG.md`.
