# EduQuery Project Audit: 05 - Frontend UI & Design Inventory

## 1. Application Navigation & View Hierarchy

The EduQuery frontend is a client-side Single Page Application (SPA) built with React 19 and React Router DOM v7. Navigation is structured around a persistent layout shell ([AppShell.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/AppShell.tsx)) with a collapsible dark sidebar (`aside.sidebar`) and a top utility bar (`header.top-bar`).

```
                    +-----------------------------+
                    |        UploadPage           |  (No session active:
                    |  (/upload or default /)     |   dropzone & layout preview)
                    +--------------+--------------+
                                   | File Confirmed
                                   v
+-----------------------------------------------------------------------------------+
|                              AppShell (Main Layout)                               |
|  +--------------------+--------------------------------------------------------+  |
|  | Dark Sidebar (260px)| Top Bar: Page Title | Active Dataset Badge | Session Kill|  |
|  | - Overview (/)     +--------------------------------------------------------+  |
|  | - Students         |                                                        |  |
|  | - Absent Roster    |                     <Outlet />                         |  |
|  | - Failures         |              (Current Route Page View)                 |  |
|  | - Curriculum       |                                                        |  |
|  | - Data Quality     |                                                        |  |
|  | - Explore Engine   |                                                        |  |
|  | - Dataset Admin    |                                                        |  |
|  +--------------------+--------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Page & Component Specification

| Page / View | URL Route | Primary Data Displayed | Triggerable User Actions | Associated Modals |
| :--- | :--- | :--- | :--- | :--- |
| **Faculty Upload** | `/upload` | Drag-and-drop dropzone, detected layout profile card (student count, course count, stride), sample rows, blocking errors. | File select/drop, "Confirm & Open Analysis", "Cancel Staging". | None |
| **Academic Overview** | `/` (when session active) | Metric strip (Total Students, Courses, Pass %, Class Avg, Highest Mark), Outcome Donut Chart, Division Comparison Bar Chart, Actionable Anomaly Feed. | Drilldown to student/course, toggle anomaly review status ("Mark Verified" / "Needs Investigation"), open anomaly evidence modal. | Anomaly Evidence Modal |
| **Student Cohort Directory** | `/students` | Paginated student data table (Seat No, Roll No, Name, Division, SGPI, Result, Failed Subjects tally). | Search by name/roll/seat, division filter pill ("All", "A", "B"), pagination next/prev, CSV roster export, click student row to view marksheet. | None |
| **Student Marksheet Breakdown** | `/students/:identifier` | Student summary badge, component marksheet table (Course Code, Name, Credits, IA, ESE, TW, PR, OR marks, Printed vs Computed totals, Letter Grade). | "Print Marksheet" (triggers browser `@media print`), "Back to Students", click course row to jump to subject roster. | Disambiguation Modal (if multiple candidates match query) |
| **Absent Students Audit** | `/absent-students` | Absent student audit table (Seat No, Roll No, Name, Division, Course Code, Component with Absence, Raw Marker text). | Filter by division, filter by subject, search query, "Print Roster" (landscape audit print), "Export to Excel" (SheetJS). | None |
| **Subject Failures Analysis** | `/failures` | Curriculum failure table ranked by failing students count (Course Code, Course Name, Credits, Enrolled, Failures, Failure Rate %, Visual Failure Bar). | Click course row to navigate to subject evaluation roster, export summary table. | None |
| **Curriculum Courses Catalog** | `/subjects` | Card grid of all detected courses (Course Code, Name, Credit value, Component scheme). | Search course catalog, click course card to view detailed evaluation roster. | None |
| **Subject Evaluation Roster** | `/subjects/:courseCode` | Course header (name, credits, failure rate), Status filter pills ("All", "Passed", "Failed", "Absent"), unified student roster table. | Toggle Status filter pills (reactive instant filter), search within subject, "Print Roster", "Export to Excel". | None |
| **Data Quality & Anomaly Audit** | `/data-quality` | Audit summary strip (Critical, Warning, Info counts), quality finding cards (Title, Problem, Impact, Recommended Action, Evidence details). | Filter findings by severity tabs ("All", "Critical", "Warning", "Info"), expand evidence JSON. | None |
| **Interactive Investigation Engine** | `/explore` | Filter builder bar, quick preset chips ("Failed Students", "Toppers >80%", "Division A At-Risk", "Multiple KT Students"), filtered data grid. | Click quick preset, add custom condition (field, operator, value), remove condition chip, search query, drilldown to student marksheet. | Add Filter Editor Popover |
| **Dataset Management & Imports** | `/imports` | Current active dataset badge, administrative staging dropzone, version history list with rollback buttons. | "Set Admin Key", stage permanent dataset, confirm promotion, rollback to previous version. | Admin Key Modal, Confirm Dialog |

---

## 3. Verbatim Contents of Main Frontend Files

### 3.1 `frontend/index.html` (Verbatim)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EduQuery — Academic Marksheet Analysis Engine</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 3.2 `frontend/src/main.tsx` (Verbatim)
```typescript
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}
```

---

## 4. Design System Tokens & Style Inventory

The core design token system is declared in [frontend/src/index.css](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/index.css):

### Color Tokens
```css
--bg-app: #f8fafc;                /* Slate 50 */
--bg-surface: #ffffff;            /* Pure White */
--bg-surface-secondary: #f1f5f9;  /* Slate 100 */
--bg-sidebar: #0f172a;            /* Slate 900 */
--bg-sidebar-hover: #1e293b;      /* Slate 800 */
--bg-sidebar-active: #2563eb;     /* Blue 600 */

--text-main: #0f172a;             /* Slate 900 */
--text-muted: #64748b;            /* Slate 500 */
--text-sub: #475569;              /* Slate 600 */
--text-inverse: #f8fafc;          /* Slate 50 */

--border-color: #e2e8f0;          /* Slate 200 */
--border-subtle: #cbd5e1;         /* Slate 300 */
--border-focus: #3b82f6;          /* Blue 500 */

--primary: #2563eb;               /* Blue 600 */
--primary-hover: #1d4ed8;         /* Blue 700 */
--primary-light: #eff6ff;         /* Blue 50 */

--success: #10b981;               /* Emerald 500 */
--success-bg: #ecfdf5;            /* Emerald 50 */
--success-text: #065f46;          /* Emerald 800 */
--success-border: #a7f3d0;        /* Emerald 200 */

--danger: #ef4444;                /* Red 500 */
--danger-bg: #fef2f2;             /* Red 50 */
--danger-text: #991b1b;           /* Red 800 */
--danger-border: #fecaca;         /* Red 200 */

--warning: #f59e0b;               /* Amber 500 */
--warning-bg: #fffbeb;            /* Amber 50 */
--warning-text: #92400e;          /* Amber 800 */
--warning-border: #fde68a;        /* Amber 200 */

--info: #3b82f6;                  /* Blue 500 */
--info-bg: #eff6ff;               /* Blue 50 */
--info-text: #1e40af;             /* Blue 800 */
--info-border: #bfdbfe;           /* Blue 200 */
```

### Elevation & Border Radii
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
```

### Typography Token
```css
--font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

---

## 5. Design Inconsistencies & Anomalies (For Redesign Planning)

A detailed review reveals several visual and token inconsistencies across the codebase:

1. **Gray Palette Clutter (12+ Neutral Hex Values):**
   Instead of adhering strictly to `--border-color` and `--text-muted`, inline styles and component CSS introduce multiple conflicting neutral tones:
   - `#64748b` (Slate 500)
   - `#475569` (Slate 600)
   - `#334155` (Slate 700)
   - `#94a3b8` (Slate 400)
   - `#cbd5e1` (Slate 300)
   - `#e2e8f0` (Slate 200)
   - `#f1f5f9` (Slate 100)
   - `#f8fafc` (Slate 50)
   - `#e5e7eb` (Gray 200)
   - `#d1d5db` (Gray 300)
   - `#9ca3af` (Gray 400)
   - `#374151` (Gray 700)
   - `#111827` (Gray 900)
   *Recommendation for Redesigner:* Consolidate into a strict 6-step neutral token scale (`neutral-50` through `neutral-900`).

2. **Mixed Dimension Units (Pixels vs Rems):**
   Font sizes and paddings oscillate arbitrarily between rem values (`0.65rem`, `0.75rem`, `0.85rem`, `1.15rem`, `1.5rem`) and raw pixels (`11px`, `12px`, `13px`, `14px`, `16px`, `24px`).

3. **Hardcoded Inline SVG Colors:**
   Chart components ([OutcomeDonutChart.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/charts/OutcomeDonutChart.tsx), [DivisionComparisonChart.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/charts/DivisionComparisonChart.tsx)) hardcode fills like `#0284c7`, `#10b981`, `#f59e0b`, and `#ef4444` rather than referencing CSS custom properties, preventing theme overriding.

4. **Dead / Orphaned Stylesheet (`frontend/src/App.css`):**
   [App.css](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/App.css) contains 184 lines of boilerplate Vite template CSS (`.counter`, `.hero`, `.vite`, `#center`, `#next-steps`) that are completely unused by EduQuery.

---

## 6. Third-Party Libraries & Asset Sizes

Derived from the production Vite Rollup build:

| Library / Asset | Runtime Version | Uncompressed Size | Compressed (Gzip) Size | Purpose in Frontend |
| :--- | :--- | :--- | :--- | :--- |
| **`xlsx` (SheetJS)** | `^0.18.5` | ~420 KiB | ~135 KiB | Generates binary `.xlsx` workbooks on the client for absent student and course roster exports. |
| **`react` & `react-dom`** | `^19.2.8` | ~160 KiB | ~50 KiB | React 19 core virtual DOM runtime and reconciliation engine. |
| **`react-router-dom`** | `^7.18.4` | ~45 KiB | ~15 KiB | Client-side routing, navigation history, and path matching. |
| **`lucide-react`** | `^1.59.0` | ~110 KiB (tree-shaken) | ~25 KiB | Scalable vector SVG icon components. |
| **Total Production JS Bundle (`index-[hash].js`)** | -- | **~745 KiB** | **227.7 KiB** | Monolithic combined client script. |
| **Total Production CSS (`index-[hash].css`)** | -- | **~18.5 KiB** | **3.6 KiB** | Compiled global design tokens, utilities, and print rules. |

---

## 7. Accessibility & Responsiveness Observations

### Accessibility Strengths
- **Logical Tab Order:** Keyboard navigation moves naturally from the sidebar to the top utility actions and into data tables.
- **Modal Focus Management:** [ConfirmDialog.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/ConfirmDialog.tsx) and [DisambiguationModal.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/DisambiguationModal.tsx) implement Escape key event listeners (`handleKeyDown`) to close cleanly.
- **Table Semantics:** Data grids use standard `<table>`, `<thead>`, `<tbody>`, and `<th scope="col">` markup.

### Accessibility Deficiencies (Audited via Lighthouse)
1. **Low Color Contrast on Subtitle & Badge Text:** Text rendered in `--text-muted` (`#64748b`) against `--bg-surface-secondary` (`#f1f5f9`) achieves a contrast ratio of only **3.7:1**, failing WCAG AA (minimum 4.5:1 for normal text).
2. **Missing Form Labels:** The search input in [SearchBar.tsx](file:///c:/Users/Armash%20Ansari/OneDrive/Desktop/Projects/AI%20&%20ML/eduquery-v3/frontend/src/components/SearchBar.tsx) relies on a `placeholder` attribute without an explicit associated `<label>` or `aria-label`.
3. **HTML Metadata Gap:** `index.html` lacks a `<meta name="description">` tag, triggering an SEO / accessibility penalty.

### Mobile Responsiveness Observations (390px Viewport)
1. **Sidebar Collapsible Behavior:** The sidebar correctly collapses off-screen on mobile viewports (`@media (max-width: 768px) { position: fixed; transform: translateX(-100%); }`), toggled via a hamburger button in the top bar.
2. **Horizontal Table Overflow:** Wide marksheet tables (e.g., student roster with 10+ columns and absent student rosters) overflow horizontally. While wrapped in `overflow-x: auto`, there are no sticky columns for student names/seat numbers, making row identification difficult on small screens.
3. **Touch Target Sizing:** Pagination numbers and small icon buttons in tables measure under $36\times 36\text{ px}$, falling below the recommended $44\times 44\text{ px}$ mobile touch target standard.

