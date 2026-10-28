# EduQuery Redesign: Design Decisions & Tradeoffs

This document records architectural, design, and accessibility decisions made during the "Monochrome Glass" complete frontend redesign.

---

## 1. Design System & Theming Decisions

### Decision 1.1: Strict Monochrome Palette with Semantic Status Accents
- **Choice:** All interface chrome, cards, typography, borders, backgrounds, and layout controls strictly employ the neutral gray scale (neutral-0 to neutral-1000). Color is completely eliminated from buttons, chrome icons, headers, and backgrounds. Accent colors (green, red, amber) are reserved exclusively for data semantics (Passed, Failed, Warning/Attention).
- **Rationale:** Prevents the color clutter and contrast degradation identified in the audit (where 12+ gray shades and arbitrary blues/greens were mixed). Ensures cognitive focus remains on academic data.

### Decision 1.2: Flash-Free Theme Initialization
- **Choice:** An inline `<script>` is placed in `<head>` of `index.html` that reads `localStorage.getItem('eduquery_theme')` (wrapped in `try...catch`), resolves `system` preference against `window.matchMedia('(prefers-color-scheme: dark)')`, and immediately injects `data-theme="dark"` or `data-theme="light"` onto `document.documentElement` before any stylesheet or bundle evaluates.
- **Rationale:** Prevents Flash of Unstyled Theme (FOUT) / Flash of White during dark mode page loads.

### Decision 1.3: Background Atmosphere Glass Refraction
- **Choice:** Pure CSS radial-gradient orbs are rendered via `body::before` with `position: fixed; pointer-events: none; filter: blur(80px)`. Light mode uses neutral-500 orbs at 0.08 opacity; dark mode uses pure white orbs at 0.05 opacity. Ambient drift animations are guarded by `@media (prefers-reduced-motion: no-preference)`.
- **Rationale:** Allows frosted glass panels (`backdrop-filter: blur(...)`) to refract subtle light without adding image assets or layout paint recalculations.

---

## 2. Information Architecture & Navigation Consolidation

### Decision 2.1: Navigation Consolidation (8 $\rightarrow$ 5 Items)
- **Choice:** Consolidated navigation into:
  1. `Overview` (`/`)
  2. `Students` (`/students` — integrates directory, faceted investigation engine, and absenteeism auditing)
  3. `Subjects` (`/subjects` — integrates curriculum catalog and failures ranking via tabs)
  4. `Data Quality` (`/data-quality`)
  5. `Datasets` (`/imports`)
- **Compatibility:** Legacy routes (`/explore`, `/absent-students`, `/failures`) are preserved as client-side `<Navigate>` redirects pointing to the consolidated destinations with query parameters.
- **Rationale:** Eliminates redundant view navigation and cognitive fatigue while preserving deep links and external bookmarks.

---

## 3. Performance & Asset Budget Decisions

### Decision 3.1: Route-Level Code Splitting & Dynamic SheetJS Elimination
- **Choice:** All route pages are dynamically loaded with `React.lazy()`. Heavy binary generation (`xlsx` / SheetJS) is removed from client entry bundles; exports are offloaded to dedicated streaming backend endpoints (`/export/xlsx`, `/export/csv`).
- **Rationale:** Reduces main bundle size from 775 KiB (224 KiB gzip) to $<80\text{ KiB gzip}$, enabling instant mobile FCP and LCP $<2.2\text{s}$.

---

## 4. Component Library & Accessible UI Primitives

### Decision 4.1: Custom Accessible WAI-ARIA Listbox Over Native `<select>`
- **Choice:** Built a custom keyboard-navigable Listbox component compliant with the WAI-ARIA Combobox / Listbox 1.2 specification, replacing native `<select>` dropdowns across the application.
- **Rationale:** Native `<select>` popups cannot be styled with frosted glassmorphism, have inconsistent cross-browser rendering on Windows/macOS/mobile, and do not support rich item sublabels or badges. The custom `Listbox` supports full ArrowUp/Down navigation, Enter/Space selection, Escape to dismiss, type-ahead matching, and maintains WCAG 2.1 AA contrast.

### Decision 4.2: DataTable Sticky Headers, Sticky Columns, and Density Toggling
- **Choice:** Created `DataTable` with native `table`, `thead`, `tbody` semantic markup, sticky header (`position: sticky; top: 0; z-index: 2`), optional sticky primary column, and user-toggleable density (`comfortable` 54px vs `compact` 38px).
- **Rationale:** Audits revealed that tall marksheets caused faculty to lose column context upon scrolling. Compact density accommodates dense marksheets with 10+ columns without excessive vertical scrolling.

### Decision 4.3: Tiered Color Semantics in Failure Visualization
- **Choice:** `FailureRateBar` strictly enforces a 3-tier semantic color system:
  - Green `< 5%` failure rate (normal/passing)
  - Amber `5% - 15%` failure rate (moderate backlog risk)
  - Red `> 15%` failure rate (critical curriculum intervention needed)
- **Rationale:** Provides instant visual triage for academic faculty without arbitrary decorative colors.
