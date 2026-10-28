# EduQuery — "Monochrome Glass" Design System

The **Monochrome Glass** design system is the official design language of EduQuery. It is engineered for academic rigor, visual calm, high data density, and strict WCAG 2.1 AA accessibility.

---

## 1. Design Philosophy

1. **Achromatic Chrome**: All interface chrome, navigation, cards, and buttons strictly use the neutral monochrome scale (white, black, and neutral grays). No decorative blue, purple, or rainbow tints exist in chrome.
2. **Semantic-Only Accents**: Color is reserved purely for meaning:
   - **Pass / Good**: Emerald Green (`#059669` light / `#34d399` dark)
   - **Fail / Critical**: Rose Red (`#dc2626` light / `#f87171` dark)
   - **Warning / Attention**: Amber (`#d97706` light / `#fbbf24` dark)
   - **Informational**: Cool Slate / Neutral (`#2563eb` light / `#ffffff` dark)
3. **Dual Encoding**: Color is never used as the sole conveyor of information. Every status badge, outcome bar, and alert pairs distinct shapes/icons and textual labels with the status tone.
4. **Frosted Depth**: Frosted glass panels (`backdrop-filter: blur(12px)`) float over subtle neutral ambient light orbs, creating physical hierarchy without high visual weight.

---

## 2. Color Palette & Token Scale

### 2.1 Neutral Monochrome Scale
| Token | Light Hex | Dark Hex | Role | Contrast on Base |
| :--- | :--- | :--- | :--- | :--- |
| `--neutral-0` | `#ffffff` | `#ffffff` | Pure white surface / Dark text | 21:1 |
| `--neutral-50` | `#f5f5f5` | `#0b0b0c` | Canvas background tint | — |
| `--neutral-100` | `#ebebeb` | `#141416` | Card and component surfaces | — |
| `--neutral-300` | `#bdbdbd` | `#525252` | Borders, subtle dividers | $\ge 9.5:1$ |
| `--neutral-500` | `#737373` | `#737373` | Tertiary text, meta captions | $\ge 4.5:1$ |
| `--neutral-700` | `#404040` | `#a3a3a3` | Secondary text, table headers | $\ge 9.8:1$ |
| `--neutral-900` | `#171717` | `#e5e5e5` | Primary body and headings | $\ge 17:1$ |
| `--neutral-1000` | `#000000` | `#000000` | Pitch black / Canvas base | 21:1 |

### 2.2 Glass Surface Elevations
- **`glass-1` (Subtle)**: `background: rgba(255, 255, 255, 0.55)` (light) / `rgba(255, 255, 255, 0.05)` (dark). Used for nested containers, filter toolbars, and search inputs.
- **`glass-2` (Standard)**: `background: rgba(255, 255, 255, 0.72)` (light) / `rgba(255, 255, 255, 0.08)` (dark). Used for content cards, data tables, and metrics.
- **`glass-3` (Elevated)**: `background: rgba(255, 255, 255, 0.88)` (light) / `rgba(20, 20, 22, 0.85)` (dark). Used for modal dialogs, drawers, dropdown popups, and the floating navigation bar.
- **`data-surface` (High Contrast Table Surface)**: `background: rgba(255, 255, 255, 0.86)` (light) / `rgba(14, 14, 16, 0.82)` (dark). Optimized for maximum legibility in dense marksheet rows.

---

## 3. Typography

- **Primary Typeface**: Inter, `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- **Monospace Typeface**: JetBrains Mono, `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (strictly for seat numbers, student IDs, course codes, and SGPI/CGPA numbers).

### Typographic Scale
| Token | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `--text-xs` | `0.75rem` (12px) | 1.3 | Overlines, badges, table captions |
| `--text-sm` | `0.875rem` (14px) | 1.4 | Dense table cells, form labels |
| `--text-base` | `1.0rem` (16px) | 1.5 | Body paragraphs, form inputs |
| `--text-md` | `1.125rem` (18px) | 1.4 | Subheaders, section headings |
| `--text-lg` | `1.25rem` (20px) | 1.3 | Card titles, modal headers |
| `--text-xl` | `1.5rem` (24px) | 1.25 | Page titles |
| `--text-2xl` | `2.0rem` (32px) | 1.15 | Large KPI metric values |
| `--text-3xl` | `2.5rem` (40px) | 1.1 | Cohort hero numbers |

---

## 4. Component Library (`frontend/src/ui/`)

### 4.1 Buttons & Controls
- **`Button`**: Primary (`--action-primary-bg`), Secondary (`--action-secondary-bg`), Danger, and Ghost variants. Sizes: `sm`, `md`, `lg`. Built-in loading spinner and disabled state handling.
- **`IconButton`**: Square 36px/40px icon trigger with accessible `aria-label` and tooltip support.
- **`Chip`**: Interactive toggleable tag for active filters and investigation query pills.
- **`StatusBadge`**: Semantic pill with dual encoding (icon + label) for `pass`, `fail`, `warn`, and `info`.

### 4.2 Form Primitives
- **`Input`**: Clean glass input with focus ring (`var(--focus-ring)`).
- **`SearchField`**: Integrated search field with clear button (`✕`) and keyboard shortcut indicator.
- **`Listbox`**: Fully accessible WAI-ARIA 1.2 compliant dropdown replacement for native `<select>`, supporting keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`).

### 4.3 Data Visualization & Display
- **`GlassCard`**: Container primitive with elevation levels 1, 2, 3, configurable padding, and optional header/footer slots.
- **`Stat`**: Metric KPI card with label, value, subtext, delta direction, and sparkline chart slot.
- **`DataTable`**: High-density table with sticky headers, sticky primary columns, and compact/comfortable density toggle.
- **`OutcomeBar`**: Stacked horizontal outcome distribution bar (passed, failed, unresolved) with explicit count and percentage labels.
- **`FailureRateBar`**: Tiered failure rate bar with 3-tier semantic color coding:
  - `< 5%`: Green
  - `5% - 15%`: Amber
  - `> 15%`: Red
- **`DivisionComparison`**: Side-by-side divisional performance bars with pass rates and student headcounts.
- **`Sparkline`**: Lightweight inline SVG line chart showing distribution trends.

### 4.4 Overlay & Feedback Primitives
- **`Modal`**: Glass dialog with backdrop blur, focus trap, Escape key handling, and WAI-ARIA `dialog` role.
- **`Drawer`**: Side slide-over drawer for deep record exploration.
- **`Toast` (`ToastContext`)**: Stacked non-intrusive feedback toasts for copy, export, and review actions.
- **`EmptyState` & `ErrorState`**: Standardized fallback states with actionable buttons.
- **`Skeleton`**: Shimmering placeholder components for smooth async loading.

---

## 5. Accessibility & Invariant Safeguards

1. **Contrast Standards**: All 40 token pairs pass WCAG 2.1 AA ($>4.5:1$ for normal text, $>3:1$ for large headings and UI borders). Checked automatically via `scripts/check-contrast.mjs` on every build.
2. **Focus Visibility**: Universal `:focus-visible` ring (`0 0 0 2px #000000, 0 0 0 4px #ffffff`) guarantees 100% visible keyboard navigation across dark and light surfaces.
3. **Reduced Motion**: All CSS animations (ambient orbs, modals, spinners) respect `@media (prefers-reduced-motion: reduce)` by disabling transitions.
4. **Touch Ergonomics**: All interactive elements maintain a minimum $44 \times 44\text{px}$ touch target on mobile viewports.
