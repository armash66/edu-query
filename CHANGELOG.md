# Changelog

All notable changes to the EduQuery project during the Monochrome Glass redesign will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] - Redesign Phase 2: Design Tokens & Theme Foundation

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
