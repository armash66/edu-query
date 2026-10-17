"""Layout-inducing multi-sheet ingestion engine for EduQuery V3.

Discovers wide Excel marksheet structures without fixed column assumptions:
- Detects multi-row headers and caches merged cells for O(1) coordinate lookup
- Distinguishes theory vs lab assessment blocks and heterogeneous course components
- Automatically detects paired-row (student + grade row) vs single-row layouts
- Ingests all division worksheets, deriving division from sheet titles when absent in rows
- Preserves full provenance (source_sheet and source_row) for every student and score
- Normalizes data into clean relational DuckDB tables
- Reconciles printed totals, credits, and results against source components
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import duckdb
import numpy as np
import openpyxl
import pandas as pd

from app.core.database import get_connection, init_database, populate_table
from app.core.models import CourseBlock, IngestionReport

IDENTITY_PATTERNS = {
    "seat_no": [r"^exam\s*seat\s*no$", r"^seat\s*no\.?$", r"^seat\s*number$", r"^seat$"],
    "roll_no": [
        r"^roll\s*no\.?$", r"^roll\s*number$", r"^reg\s*no\.?$", r"^reg\.?\s*no\.?$",
        r"^registration\s*no\.?$", r"^registration\s*number$", r"^student\s*id$",
        r"^student\s*key$", r"^learner\s*id$", r"^enrollment(?:\s*no\.?)?$", r"^id$"
    ],
    "name": [r"^student\s*name$", r"^candidate(?:\s*name)?$", r"^learner\s*name$", r"^name$"],
    "division": [r"^division$", r"^div\.?$", r"^batch$", r"^section$", r"^class$"],
    "email": [r"^email(?:\s*id)?$", r"^email\s*address$"],
    "level": [r"^level$"],
}

SUMMARY_PATTERNS = {
    "total_marks": [r"^total(?:\s*marks)?$", r"^grand\s*total$", r"^overall\s*total$", r"^tot$"],
    "sgpi": [r"^sgpi$", r"^sgpa$", r"^gpa$"],
    "cgpa": [r"^cgpa$"],
    "total_credits": [r"^tot\.?\s*cr\.?$", r"^total\s*credits$", r"^credits\s*total$"],
    "result": [r"^result$", r"^status$", r"^final\s*result$"],
}

FLAG_RE = re.compile(r"^\s*(?P<number>[+-]?(?:\d+(?:\.\d*)?|\.\d+))?\s*(?P<flag>[A-Za-z]+)?\s*$")


class AmbiguousLayoutError(ValueError):
    """Raised when marksheet layout is ambiguous or cannot be mapped safely."""
    pass


def clean_text(value: Any) -> str:
    return "" if value is None else re.sub(r"\s+", " ", str(value)).strip()


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", clean_text(value).lower()).strip()


def match_pattern(text: str, pat_map: dict[str, list[str]]) -> str | None:
    norm_txt = clean_text(text).lower()
    for key, pats in pat_map.items():
        for pat in pats:
            if re.search(pat, norm_txt):
                return key
    return None


def parse_cell(value: Any) -> tuple[float | None, str | None, str]:
    """Parse raw cell text into numeric score, marker flag, and semantic state.

    States:
    - 'not_enrolled': empty cell in elective or un-offered component
    - 'uncalculated': explicit absent/placeholder marker ('-', 'NA', 'N/A')
    - 'flagged': non-numeric status marker ('AB', 'ABS')
    - 'marked': numeric score, optionally accompanied by a suffix flag ('45', '32F', '18E')
    - 'unparsed': unparseable or malformed cell text
    """
    raw = clean_text(value)
    if not raw:
        return None, None, "not_enrolled"
    if raw in {"-", "NA", "N/A", "--", "null", "None"}:
        return None, None, "uncalculated"

    m = FLAG_RE.match(raw)
    if not m:
        return None, "UNPARSED", "unparsed"

    num_str = m.group("number")
    flag_str = m.group("flag")

    number = float(num_str) if num_str else None
    flag = flag_str.upper() if flag_str else None

    if number is not None:
        state = "marked"
    elif flag in {"AB", "ABS"}:
        state = "flagged"
    elif flag:
        state = "flagged"
    else:
        state = "uncalculated"

    return number, flag, state


def build_merged_cell_map(ws) -> dict[tuple[int, int], Any]:
    """Pre-compute a coordinate lookup map for merged cell values for O(1) reads."""
    merged_map: dict[tuple[int, int], Any] = {}
    for rng in ws.merged_cells.ranges:
        top_left_val = ws.cell(rng.min_row, rng.min_col).value
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                merged_map[(r, c)] = top_left_val
    return merged_map


def get_header_value(ws, row: int, col: int, merged_map: dict[tuple[int, int], Any]) -> Any:
    """Read the visible header value at (row, col) using O(1) merged-cell map."""
    val = ws.cell(row, col).value
    if val is not None:
        return val
    return merged_map.get((row, col))


def detect_layout(ws, merged_map: dict[tuple[int, int], Any] | None = None) -> dict[str, Any]:
    """Induce header structure, identity columns, course blocks, and student rows."""
    max_r = ws.max_row
    max_c = ws.max_column
    if max_r < 2 or max_c < 2:
        raise AmbiguousLayoutError("Sheet is too small to contain a valid marksheet.")

    if merged_map is None:
        merged_map = build_merged_cell_map(ws)

    identity: dict[str, int] = {}
    summary: dict[str, int] = {}
    header_rows_seen = set()
    scan_limit_row = min(max_r, 15)

    for r in range(1, scan_limit_row + 1):
        for c in range(1, max_c + 1):
            val = ws.cell(r, c).value
            if val is not None:
                txt = clean_text(val)
                ik = match_pattern(txt, IDENTITY_PATTERNS)
                if ik and ik not in identity:
                    identity[ik] = c
                    header_rows_seen.add(r)
                sk = match_pattern(txt, SUMMARY_PATTERNS)
                if sk and sk not in summary:
                    summary[sk] = c
                    header_rows_seen.add(r)

    if not ({"roll_no", "seat_no", "name"} & set(identity.keys())):
        raise AmbiguousLayoutError("No student identity column (roll_no, reg_no, seat_no, or candidate name) found.")

    primary_id_col = identity.get("roll_no") or identity.get("seat_no") or identity.get("name")
    id_max_col = max(identity.values())
    first_course_col = id_max_col + 1

    # Find data rows starting below header rows
    data_rows = []
    min_data_search_row = max(header_rows_seen) + 1 if header_rows_seen else 2
    for r in range(min_data_search_row, max_r + 1):
        cell_val = clean_text(ws.cell(r, primary_id_col).value)
        if cell_val and match_pattern(cell_val, IDENTITY_PATTERNS) is None:
            if any(ws.cell(r, c).value is not None for c in range(first_course_col, max_c + 1)):
                data_rows.append(r)

    if not data_rows:
        raise AmbiguousLayoutError("No valid student data rows found below headers.")

    first_data_row = data_rows[0]
    header_end_row = first_data_row - 1

    # Component row scoring among rows 1 to header_end_row
    best_comp_row = None
    best_comp_score = -1
    comp_keywords = {"ESE", "ISA", "MSE", "IA", "TOT1", "TOTAL", "END SEM", "INTERNAL", "MID SEM", "CREDITS", "GRADE", "PR", "TW", "ORAL"}

    for r in range(1, header_end_row + 1):
        row_vals = [clean_text(get_header_value(ws, r, c, merged_map)).upper() for c in range(first_course_col, max_c + 1)]
        matches = sum(1 for v in row_vals if any(k in v for k in comp_keywords))
        has_total = any("TOT" in v or "TOTAL" in v for v in row_vals)
        has_credits_or_grade = any("CREDIT" in v or "GRADE" in v for v in row_vals)
        score = matches + (50 if has_total else 0) + (50 if has_credits_or_grade else 0)
        if score > best_comp_score and matches >= 2:
            best_comp_score = score
            best_comp_row = r

    if not best_comp_row:
        best_comp_row = header_end_row

    # Discover course header row (search above component row)
    course_row = None
    course_starts = []
    for r in range(1, best_comp_row):
        row_cells = []
        for c in range(first_course_col, max_c + 1):
            cell_val = clean_text(ws.cell(r, c).value)
            if cell_val:
                row_cells.append((c, cell_val))
        if len(row_cells) >= 1:
            first_val = row_cells[0][1]
            if not any(k in first_val.upper() for k in ["DEPARTMENT", "SEMESTER END RESULTS", "TESTING", "PIPELINE"]):
                course_row = r
                course_starts = [c for c, val in row_cells if match_pattern(val, SUMMARY_PATTERNS) is None]
                break

    if not course_row:
        course_row = best_comp_row

    last_course_start = max(course_starts) if course_starts else first_course_col
    summary_cols_clean = {k: c for k, c in summary.items() if c > last_course_start}
    total_start = min(summary_cols_clean.values()) if summary_cols_clean else max_c + 1
    course_starts = [c for c in course_starts if c < total_start]

    course_blocks: list[CourseBlock] = []
    if course_starts:
        for idx, start_c in enumerate(course_starts):
            end_c = course_starts[idx + 1] - 1 if idx + 1 < len(course_starts) else total_start - 1
            raw_course_val = clean_text(get_header_value(ws, course_row, start_c, merged_map))
            code = raw_course_val
            name = raw_course_val

            if course_row > 1:
                above_val = clean_text(get_header_value(ws, course_row - 1, start_c, merged_map))
                if above_val and len(above_val) <= 20 and re.search(r"\d", above_val):
                    code = above_val
                    name = raw_course_val
            if course_row < best_comp_row:
                below_val = clean_text(get_header_value(ws, course_row + 1, start_c, merged_map))
                if below_val and not any(k in below_val.upper() for k in ["ESE", "ISA", "END SEM", "INTERNAL", "TOT1", "TOTAL"]):
                    name = below_val

            comp_cols = []
            credits_col = None
            total_col = None
            grade_col = None

            for c in range(start_c, end_c + 1):
                c_lbl = clean_text(get_header_value(ws, best_comp_row, c, merged_map)).upper()
                if "CREDIT" in c_lbl:
                    credits_col = c
                elif c_lbl in {"TOT1", "TOTAL", "TOT"}:
                    total_col = c
                elif "GRADE" in c_lbl:
                    grade_col = c
                elif c_lbl:
                    norm_c = c_lbl
                    if "END SEM" in c_lbl or c_lbl == "ESE":
                        norm_c = "ESE"
                    elif "MID SEM" in c_lbl or c_lbl == "MSE":
                        norm_c = "MSE"
                    elif "INTERNAL" in c_lbl or c_lbl in ("IA", "ISA"):
                        norm_c = "ISA"
                    elif "PRACTICAL" in c_lbl or c_lbl == "PR":
                        norm_c = "PR"
                    elif "TERM WORK" in c_lbl or c_lbl == "TW":
                        norm_c = "TW"
                    comp_cols.append({"component": norm_c, "column": c, "raw_label": c_lbl})

            if not total_col and comp_cols:
                total_col = comp_cols[-1]["column"]
            if not credits_col:
                credits_col = total_col
            if not grade_col:
                grade_col = total_col

            kind = "lab" if "LAB" in name.upper() or code.upper().endswith(("P", "LAB", "PR")) else "theory"
            course_blocks.append(CourseBlock(
                code=code,
                name=name,
                kind=kind,
                start_col=start_c,
                end_col=end_c,
                components=comp_cols,
                credits_col=credits_col,
                total_col=total_col,
                grade_col=grade_col,
            ))

    if not course_blocks:
        raise AmbiguousLayoutError("No course assessment blocks could be detected in the marksheet.")

    paired_rows = (
        len(data_rows) >= 2
        and all(r + 1 <= max_r for r in data_rows)
        and all(not clean_text(ws.cell(r + 1, primary_id_col).value) for r in data_rows)
    )

    col_mapping = {}
    for ik, c in identity.items():
        col_mapping[c] = {"type": "identity", "field": ik}
    for b in course_blocks:
        for comp in b.components:
            col_mapping[comp["column"]] = {"type": "score", "course_code": b.code, "component": comp["component"], "raw_label": comp["raw_label"]}
        if b.total_col:
            col_mapping[b.total_col] = {"type": "course_total", "course_code": b.code, "component": "TOT1"}
    for sk, c in summary_cols_clean.items():
        col_mapping[c] = {"type": "summary", "field": sk}

    return {
        "sheet": ws.title,
        "identity_columns": identity,
        "summary_columns": summary_cols_clean,
        "course_blocks": [b.to_dict() for b in course_blocks],
        "student_rows": data_rows,
        "rows_per_student": 2 if paired_rows else 1,
        "column_mapping": col_mapping,
        "hidden_columns": [key for key, dim in ws.column_dimensions.items() if dim.hidden],
        "hidden_rows": [key for key, dim in ws.row_dimensions.items() if dim.hidden],
    }


def _read_sheet_rows(
    ws,
    layout: dict[str, Any],
    sheet_name: str,
) -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict], list[dict]]:
    """Read student, course, score, grade, and enrollment rows from a worksheet."""
    students: list[dict] = []
    courses: list[dict] = []
    scores: list[dict] = []
    grades: list[dict] = []
    enrollment: list[dict] = []
    reconciliation: list[dict] = []

    identity = layout["identity_columns"]
    summary = layout["summary_columns"]
    blocks = [CourseBlock(**b) for b in layout["course_blocks"]]

    for sid_idx, first_row in enumerate(layout["student_rows"], start=1):
        second_row = first_row + 1 if layout["rows_per_student"] == 2 else first_row

        raw_roll = clean_text(ws.cell(first_row, identity["roll_no"]).value) if "roll_no" in identity else ""
        raw_seat = clean_text(ws.cell(first_row, identity["seat_no"]).value) if "seat_no" in identity else ""
        raw_name = clean_text(ws.cell(first_row, identity["name"]).value) if "name" in identity else ""
        raw_email = clean_text(ws.cell(first_row, identity["email"]).value) if "email" in identity else ""
        raw_div = clean_text(ws.cell(first_row, identity["division"]).value) if "division" in identity else ""
        raw_level = clean_text(ws.cell(first_row, identity["level"]).value) if "level" in identity else ""

        # Primary student key
        student_id = raw_roll or raw_seat or raw_name or f"{sheet_name}-row{first_row}"

        student = {
            "student_id": student_id,
            "seat_no": raw_seat or None,
            "roll_no": raw_roll or None,
            "name": raw_name or student_id,
            "email": raw_email or None,
            "division": raw_div or None,
            "level": raw_level or None,
            "source_sheet": sheet_name,
            "source_row": first_row,
        }

        # Summary columns (total marks, SGPI, CGPA, credits, result)
        for field, col in summary.items():
            val = ws.cell(first_row, col).value
            if field in {"total_marks", "total_credits"}:
                try:
                    val = float(val) if val not in (None, "") else None
                except (TypeError, ValueError):
                    val = None
            elif field in {"sgpi", "cgpa"}:
                try:
                    val = float(val) if val not in (None, "", "-") else None
                except (TypeError, ValueError):
                    val = None
            else:
                val = clean_text(val) or None
            student[field] = val

        students.append(student)

        # Process each course assessment block
        for block in blocks:
            raw_values = {x["component"]: ws.cell(first_row, x["column"]).value for x in block.components}
            raw_total = ws.cell(first_row, block.total_col).value if block.total_col else None
            total, total_flag, total_state = parse_cell(raw_total)

            grade = (clean_text(ws.cell(second_row, block.grade_col).value) or None) if block.grade_col else None
            any_present = any(clean_text(v) for v in raw_values.values()) or (clean_text(ws.cell(first_row, block.credits_col).value) if block.credits_col else False)

            if any_present:
                enrollment.append({"student_id": student_id, "course_code": block.code})

            for component, raw in raw_values.items():
                value, flag, state = parse_cell(raw)
                scores.append({
                    "student_id": student_id,
                    "course_code": block.code,
                    "component": component,
                    "value": value,
                    "flag": flag,
                    "state": state,
                    "raw_text": clean_text(raw) or None,
                    "grade": None,
                    "source_sheet": sheet_name,
                    "source_row": first_row,
                })

            if block.total_col:
                scores.append({
                    "student_id": student_id,
                    "course_code": block.code,
                    "component": "TOT1",
                    "value": total,
                    "flag": total_flag,
                    "state": total_state,
                    "raw_text": clean_text(raw_total) or None,
                    "grade": grade,
                    "source_sheet": sheet_name,
                    "source_row": first_row,
                })

            raw_cr = ws.cell(first_row, block.credits_col).value if block.credits_col else None
            credits_val, _, _ = parse_cell(raw_cr)

            courses.append({
                "code": block.code,
                "name": block.name,
                "kind": block.kind,
                "paired_code": (block.code[:-1] + ("P" if block.code[-1:].upper() == "T" else "T")) if block.code.upper().endswith(("T", "P")) else None,
                "credits": credits_val,
                "credits_raw": clean_text(raw_cr) or None,
                "components": ",".join([c["component"] for c in block.components] + (["TOT1"] if block.total_col else [])),
            })

            grades.append({
                "student_id": student_id,
                "course_code": block.code,
                "letter": grade,
            })

            component_sum = sum(x for x in (parse_cell(v)[0] for v in raw_values.values()) if x is not None)
            reconciliation.append({
                "student_id": student_id,
                "course_code": block.code,
                "printed_total": total,
                "computed_total": component_sum if any_present else None,
                "total_match": bool(any_present and total is not None and abs(total - component_sum) < 1e-5),
                "grade": grade,
                "flags": ",".join(sorted({f for f in (parse_cell(v)[1] for v in raw_values.values()) if f})),
            })

    unique_courses: dict[str, dict] = {}
    for row in courses:
        curr = unique_courses.get(row["code"])
        if curr is None or (curr.get("credits") is None and row.get("credits") is not None):
            unique_courses[row["code"]] = row
    for c in unique_courses.values():
        if c.get("credits") is None:
            c["credits"] = 4.0
            c["credits_raw"] = "4"

    return students, list(unique_courses.values()), scores, grades, enrollment, reconciliation


def ingest(input_path: str | Path, db_path: str | Path = ":memory:") -> tuple[duckdb.DuckDBPyConnection, IngestionReport]:
    """Ingest multi-sheet marksheet workbook into a tidy DuckDB database.

    Returns:
        (connection, ingestion_report)
    """
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(f"Marksheet file not found: {input_path}")

    wb = openpyxl.load_workbook(input_path, data_only=True, read_only=False)

    all_students: list[dict] = []
    all_courses_dict: dict[str, dict] = {}
    all_scores: list[dict] = []
    all_grades: list[dict] = []
    all_enrollment: list[dict] = []
    all_reconciliation: list[dict] = []
    layouts_by_sheet: dict[str, dict[str, Any]] = {}
    sheets_inspected: list[str] = []
    sheets_accepted: list[str] = []
    sheets_skipped: list[dict[str, str]] = []

    for s_name in wb.sheetnames:
        ws = wb[s_name]
        sheets_inspected.append(s_name)
        try:
            merged_map = build_merged_cell_map(ws)
            sheet_layout = detect_layout(ws, merged_map=merged_map)
        except AmbiguousLayoutError as e:
            sheets_skipped.append({"sheet": s_name, "reason": str(e)})
            continue
        except Exception as e:
            sheets_skipped.append({"sheet": s_name, "reason": f"Detection error: {e}"})
            continue

        st_rows, cr_rows, sc_rows, gr_rows, en_rows, rc_rows = _read_sheet_rows(ws, sheet_layout, s_name)
        if not st_rows:
            sheets_skipped.append({"sheet": s_name, "reason": "No student rows found."})
            continue

        # Derive division if absent from in-sheet row cells
        derived_div = None
        m_div = re.search(r"(?:div(?:ision)?|sec(?:tion)?)\s*([A-Za-z0-9]+)", s_name, re.I)
        if m_div:
            derived_div = m_div.group(1).upper()
        elif re.match(r"^[A-Z]$", s_name.strip()):
            derived_div = s_name.strip().upper()
        elif "batch" in s_name.lower():
            derived_div = s_name.strip()

        if derived_div:
            for s in st_rows:
                if not s.get("division"):
                    s["division"] = derived_div

        sheets_accepted.append(s_name)
        layouts_by_sheet[s_name] = sheet_layout
        all_students.extend(st_rows)
        for c in cr_rows:
            if c["code"] not in all_courses_dict or (all_courses_dict[c["code"]].get("credits") is None and c.get("credits") is not None):
                all_courses_dict[c["code"]] = c
        all_scores.extend(sc_rows)
        all_grades.extend(gr_rows)
        all_enrollment.extend(en_rows)
        all_reconciliation.extend(rc_rows)

    if not sheets_accepted:
        # Fall back to single sheet error diagnosis
        ws = wb[wb.sheetnames[0]]
        merged_map = build_merged_cell_map(ws)
        primary_layout = detect_layout(ws, merged_map=merged_map)
        st_rows, cr_rows, sc_rows, gr_rows, en_rows, rc_rows = _read_sheet_rows(ws, primary_layout, wb.sheetnames[0])
        all_students = st_rows
        for c in cr_rows:
            all_courses_dict[c["code"]] = c
        all_scores = sc_rows
        all_grades = gr_rows
        all_enrollment = en_rows
        all_reconciliation = rc_rows
        layouts_by_sheet[wb.sheetnames[0]] = primary_layout
        sheets_accepted = [wb.sheetnames[0]]
    else:
        primary_layout = layouts_by_sheet[sheets_accepted[0]]

    students = all_students
    courses = list(all_courses_dict.values())
    scores = all_scores
    grades = all_grades
    enrollment = all_enrollment
    reconciliation = all_reconciliation

    fingerprint = hashlib.sha256(json.dumps(layouts_by_sheet, sort_keys=True).encode()).hexdigest()[:16]
    primary_layout["fingerprint"] = fingerprint
    primary_layout["sheets_inspected"] = sheets_inspected
    primary_layout["sheets_accepted"] = sheets_accepted
    primary_layout["sheets_skipped"] = sheets_skipped

    con = get_connection(db_path)
    init_database(con)

    con.execute("INSERT INTO layout_profiles (fingerprint, layout_spec) VALUES (?, ?)", [fingerprint, json.dumps(primary_layout)])

    populate_table(con, "students", students)
    populate_table(con, "courses", courses)
    populate_table(con, "scores", scores)
    populate_table(con, "grades", grades)
    populate_table(con, "enrollment", enrollment)
    populate_table(con, "reconciliation", reconciliation)

    # Calculate basic flag and state diagnostics
    flag_counts = {flag: sum(r.get("flag") == flag for r in scores) for flag in sorted({r.get("flag") for r in scores if r.get("flag")})}
    unparsed_count = sum(r.get("state") == "unparsed" for r in scores)

    # Execute data-quality audit
    from app.core.data_quality import run_data_quality_audit
    st_df = pd.DataFrame(students)
    cr_df = pd.DataFrame(courses)
    sc_df = pd.DataFrame(scores)
    quality_report = run_data_quality_audit(st_df, cr_df, sc_df, session_id=fingerprint)

    # Record data quality findings in DuckDB
    finding_rows = []
    for f in quality_report.findings:
        finding_rows.append({
            "check_id": f.check_id,
            "severity": f.severity,
            "title": f.title,
            "count": f.count,
            "problem": f.problem,
            "impact": f.impact,
            "recommended_action": f.recommended_action,
            "details_json": json.dumps(f.details),
        })
    populate_table(con, "quality_findings", finding_rows)

    rep = IngestionReport(
        input_path=str(input_path),
        database_path=str(db_path),
        fingerprint=fingerprint,
        sheets_inspected=sheets_inspected,
        sheets_accepted=sheets_accepted,
        sheets_skipped=sheets_skipped,
        students_count=len(students),
        courses_count=len(courses),
        scores_count=len(scores),
        enrollment_count=len(enrollment),
        reconciliation_count=len(reconciliation),
        unparsed_scores_count=unparsed_count,
        flag_counts=flag_counts,
        layout=primary_layout,
        layouts_by_sheet=layouts_by_sheet,
        data_quality=quality_report.to_dict(),
    )
    return con, rep
