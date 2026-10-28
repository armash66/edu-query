# EduQuery Project Audit: 06 - UI Screenshots & Design Critique

This document accompanies the visual audit captures stored in `/audit/06_ui_screenshots/`. Each section evaluates a page/state across both **Desktop (1440px)** and **Mobile (390px)**, identifying visual weaknesses, hierarchy flaws, layout breakdowns, and opportunities for the future redesign.

---

## 1. Faculty Upload Experience (`/upload`)

### Artifacts:
- `upload_desktop_empty.png`
- `upload_mobile_empty.png`
- `upload_desktop_preview.png`
- `upload_mobile_preview.png`

### Visual Analysis & Critique:
1. **Empty State Dropzone Dominance:**
   - *Desktop:* The drag-and-drop container occupies a large central card with a dashed border (`--border-subtle`). While functional, it feels utilitarian and barren on large screens.
   - *Hierarchy:* The typography hierarchy between "Upload Marksheet" (1.5rem) and the privacy disclaimer ("Privacy-First Analysis — Processed locally in memory...") lacks distinction; both use heavy font weights.
   - *Spacing:* The container padding around the upload area is tight compared to the vast empty background.
2. **Preview State Card (Post-Upload):**
   - *Desktop:* Upon file selection, a layout profile card appears below the dropzone detailing "Detected Layout", "Rows per student: 2", "Discovered: 120 students, 10 courses". The two buttons ("Confirm & Open Analysis" vs "Cancel") are spaced unevenly; the primary confirm button is vibrant blue while cancel is an understated gray that gets lost.
   - *Mobile (390px):* On mobile, the sample preview rows table collapses awkwardly. Long course names wrap over 4 lines, causing the preview table rows to balloon vertically.
3. **Contrast & Color:**
   - The subtle gray privacy notice text (`#64748b`) on the light blue callout box (`#eff6ff`) has borderline contrast (4.1:1).

---

## 2. Academic Overview Dashboard (`/`)

### Artifacts:
- `overview_desktop.png`
- `overview_mobile.png`

### Visual Analysis & Critique:
1. **Metric Strip (Top KPIs):**
   - *Desktop:* Five metric cards ("Total Students", "Enrolled Courses", "Passing %", "Cohort Average", "Highest Score") stretch horizontally across the page. The numbers (`2.25rem`) dominate the cards, but the sub-labels (`0.8rem`) are muted (`#64748b`), creating a jarring jump in optical weight.
   - *Mobile:* The 5 metric cards wrap into a 1-column or 2-column stacked grid that pushes visual charts far below the fold, forcing excessive scrolling before seeing cohort trends.
2. **Chart Layout & Spacing:**
   - *Alignment:* The Outcome Donut Chart and Division Comparison Bar Chart sit side-by-side on desktop. However, the legends inside the SVG containers are positioned with static pixel offsets, causing legend items to clash with SVG boundaries when course titles are long.
   - *Mobile:* The SVG donut chart shrinks to fit the 390px viewport, making pie slices and percentage labels inside the SVG unreadable.
3. **Actionable Anomaly Feed:**
   - *Density:* The anomaly list presents dense text blocks describing mismatches. The action buttons ("Mark Verified" and "Needs Investigation") look identical in shape to regular table pills, creating ambiguity regarding whether they are clickable interactive controls or static status indicators.

---

## 3. Student Cohort Directory (`/students`)

### Artifacts:
- `students_desktop.png`
- `students_mobile.png`

### Visual Analysis & Critique:
1. **Table Typography & Density:**
   - *Desktop:* The tabular data density is high. Column headers (`Seat No`, `Roll No`, `Student Name`, `Division`, `Total Marks`, `SGPI`, `Result`) lack clear visual distinction from table row text; both use similar font sizes (13px vs 14px) and normal font weights.
   - *Zebra Striping:* There is no alternating row background or border contrast, making it easy for the eye to drift across rows when reading large cohort lists.
2. **Search & Filter Controls:**
   - *Alignment:* The search input, division filter pills ("All", "A", "B"), and "Export CSV" button are placed in a single row that lacks balanced flex distribution. On desktop, the search bar stretches across 60% of the screen while filter buttons bunch together on the right.
   - *Mobile:* The search bar and filters stack vertically, taking up 40% of the initial mobile screen height before the first student row is visible.
3. **Status Badges:**
   - The "PASSES" and "FAILS" badges use solid green (`#10b981`) and red (`#ef4444`) backgrounds. The contrast between white badge text and the green background is acceptable, but the red badge draws aggressive attention away from student names.

---

## 4. Student Marksheet Breakdown (`/students/:identifier`)

### Artifacts:
- `student_detail_desktop.png`
- `student_detail_mobile.png`

### Visual Analysis & Critique:
1. **Student Header Banner:**
   - *Desktop:* Displays student name, roll number, seat number, and overall result. The student name is uppercase and large (`1.25rem`), which works well, but the SGPI and Total Marks values are tucked into small gray badges on the far right.
2. **Component Marksheet Grid:**
   - *Information Architecture:* Columns are divided into Course Code, Course Title, Credits, Component Marks (`IA`, `ESE`, `TW`, `PR`, `OR`), Total Marks (`Printed` vs `Computed`), and Letter Grade. While comprehensive, the component sub-columns (`IA: 18 / 20`) cram multiple numbers into single cells.
   - *Mismatches:* If a printed total does not match computed marks, a warning indicator appears. However, the mismatch text is small and easy to overlook unless actively scanning.
3. **Mobile & Print:**
   - *Mobile:* The table requires heavy horizontal scrolling. The student metadata card occupies the entire top viewport.
   - *Print View:* The dedicated "Print Marksheet" action renders a clean, black-and-white landscape format via `@media print`.

---

## 5. Absent Students Audit Roster (`/absent-students`)

### Artifacts:
- `absent_students_desktop.png`
- `absent_students_mobile.png`

### Visual Analysis & Critique:
1. **Header & Context:**
   - *Desktop:* Clear audit title and explanatory subtitle ("Audit roster identifying all students possessing absence markers (AB, ABS)"). Filter controls allow narrowing by division or specific course code.
2. **Table Presentation:**
   - *Contrast:* Absence marker text (`AB`) is rendered with an amber badge (`#fffbeb` background, `#92400e` text). This provides good contrast, but when a student is absent in multiple subjects, identical amber badges repeat down the entire column, creating visual monotony.
3. **Mobile Viewport:**
   - On 390px mobile, the table columns (`Student Name`, `Seat`, `Roll`, `Course`, `Component`, `Marker`) truncate or require horizontal scrolling. Without a fixed sticky column for student names, faculty lose context while swiping left/right.

---

## 6. Curriculum & Subject Evaluation Rosters (`/subjects` and `/subjects/:courseCode`)

### Artifacts:
- `subjects_catalog_desktop.png`
- `subjects_catalog_mobile.png`
- `subject_detail_desktop.png`
- `subject_detail_mobile.png`
- `subject_failures_desktop.png`
- `subject_failures_mobile.png`

### Visual Analysis & Critique:
1. **Catalog Card Grid (`/subjects`):**
   - *Desktop:* 3-column card grid representing courses. Each card shows course code, title, credits, and component types (`IA + ESE`). The cards are clean, but lack a visual indicator of class failure rate directly on the card, forcing users to click each course or visit `/failures`.
2. **Failures Summary Table (`/failures`):**
   - *Visual Progress Bar:* The "Failure Rate %" column includes an inline bar showing failure percentage. However, the bar color is hardcoded red (`#ef4444`) regardless of whether the failure rate is 2% or 50%, missing an opportunity for tiered color coding (green <5%, amber 5-15%, red >15%).
3. **Subject Detail Evaluation Roster (`/subjects/:courseCode`):**
   - *Status Filter Pills:* The filter buttons ("All", "Passed", "Failed", "Absent") sit directly above the student table. In the desktop screenshot, the active pill is solid blue while inactive pills are light gray. The distinction is clear, but the student count per status is not shown on the pill itself (e.g. "Failed (12)"), requiring faculty to look at the pagination footer to see counts.

---

## 7. Interactive Investigation Engine (`/explore`)

### Artifacts:
- `explore_desktop.png`
- `explore_desktop_filter_applied.png`
- `explore_mobile.png`
- `explore_mobile_filter_applied.png`

### Visual Analysis & Critique:
1. **Preset Filter Bar:**
   - *Desktop:* Quick preset chips ("Failed Students", "Toppers >80%", "Division A At-Risk") appear as pill buttons with small icons. Clicking them immediately applies filter criteria and populates the table. This is one of the most functional UI sections in the app.
   - *Flaw:* The active filter chips below the search bar display small "x" removal icons that have tiny hitboxes ($16\times 16\text{ px}$), making them difficult to target with a mouse or finger.
2. **Filter Builder Popover:**
   - When expanding "Add Filter", a form appears with field, operator, and value dropdowns. The dropdowns use native HTML `<select>` elements which look inconsistent with custom-styled buttons across the rest of the application.
3. **Mobile Screen Crowding:**
   - On 390px mobile, the combination of the page title, search bar, 4 preset chips, active filter chips, and table headers pushes the actual data rows completely off the initial screen.

---

## 8. Data Quality & Anomaly Audit (`/data-quality`)

### Artifacts:
- `data_quality_desktop.png`
- `data_quality_mobile.png`

### Visual Analysis & Critique:
1. **Severity Cards:**
   - Findings are grouped into "Critical", "Warning", and "Info" cards. Each card contains structured sections: "Problem", "Impact", "Recommended Action", and an expandable JSON details drawer.
   - *Clarity:* The structured layout is informative, but the text density inside each card is overwhelming. The font size is uniform across all sections, reducing visual scanability.
2. **Expandable Details:**
   - Raw JSON payloads inside the details drawer wrap arbitrarily and lack code syntax highlighting.

---

## 9. Administrative Modals & Overlays

### Artifacts:
- `admin_key_modal_desktop.png`
- `imports_desktop.png`
- `imports_mobile.png`

### Visual Analysis & Critique:
1. **Admin Key Modal:**
   - A centered dialog with dark backdrop blur (`rgba(0, 0, 0, 0.5)`). The input field includes an eye toggle to show/hide the key. The modal is focused, accessible, and clean.
2. **Imports Page:**
   - Displays the current active dataset ID, database file path, and record tallies. The version rollback table shows historical imports with a red "Rollback" button. The red button looks identical to a destructive "Delete" action, which may frighten users who want to safely revert to a previous marksheet version.

---

## 10. Deployed Production Site Comparison (`https://edu-query-hazel.vercel.app/`)

### Artifacts:
- `deployed_production_desktop.png`
- `deployed_production_mobile.png`

### Visual Analysis & Critique:
1. **Initial Unauthenticated State:**
   - On the deployed Vercel site without an active session, the app cleanly displays the faculty upload dropzone. The title "Analyze a Marksheet — Privacy-First Academic Analysis" immediately orients first-time faculty users.
2. **Consistency Local vs Deployed:**
   - The visual layout, typography, and SVG rendering between the local Vite dev server and the production Vercel deployment are identical, confirming that the CSS build pipeline does not introduce layout drift or missing styles.

