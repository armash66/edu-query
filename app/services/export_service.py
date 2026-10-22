"""Export service for faculty reports with anti-formula injection safeguards."""
from __future__ import annotations

import csv
import io
import re
from typing import Any

import duckdb
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from app.reports.student_breakdown import (
    escape_like_pattern,
    get_student_breakdown,
    get_students_subject_counts_batch,
)
from app.reports.subject_failures import get_subject_failures


def _apply_workbook_styles(ws: openpyxl.worksheet.worksheet.Worksheet, header_row_idx: int = 1) -> None:
    """Apply professional typography, dark blue header fills, borders, and auto-adjusted column widths."""
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    for cell in ws[header_row_idx]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    ws.row_dimensions[header_row_idx].height = 26

    for row in ws.iter_rows(min_row=header_row_idx + 1, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
        for cell in row:
            cell.border = thin_border
            if cell.data_type != "s":
                cell.font = Font(name="Calibri", size=10)

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)


def sanitize_csv_cell(value: Any) -> str:
    """Sanitize cell value to prevent CSV / spreadsheet formula injection.

    If untrusted text begins with dangerous formula trigger characters ('=', '+', '-', '@', '\t', '\r'),
    prepend a single quote (') so spreadsheet applications interpret it as a literal string.
    Legitimate numeric values (int, float, or pure numeric strings) are preserved without prefix.
    """
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    raw_str = str(value)
    if not raw_str:
        return ""

    first_char = raw_str[0]
    if first_char in ("=", "+", "-", "@", "\t", "\r"):
        # Distinguish legitimate signed numeric values (e.g. -5, +10.5) from formulas (e.g. -CMD, +SUM)
        if first_char in ("+", "-"):
            try:
                float(raw_str.strip())
                return raw_str
            except ValueError:
                return f"'{raw_str}"
        return f"'{raw_str}"

    return raw_str


def sanitize_filename(base: str) -> str:
    """Ensure filenames are deterministic, clean, and contain no filesystem paths."""
    clean = re.sub(r"[^a-zA-Z0-9_\-]+", "_", base).strip("_")
    return clean or "export"


def export_student_breakdown_csv(
    con: duckdb.DuckDBPyConnection,
    identifier: str,
) -> tuple[int, str, str | dict[str, Any]]:
    """Generate CSV export for a student's full subject performance breakdown."""
    rep = get_student_breakdown(con, identifier)
    if rep.status != "success":
        return (
            404 if rep.status == "not_found" else 409,
            "",
            rep.to_dict(),
        )

    student = rep.student
    assert student is not None

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)

    # 1. Report context header
    writer.writerow(["# EduQuery V3 - Student Academic Performance Breakdown"])
    writer.writerow([
        "Student ID",
        "Student Name",
        "Roll No",
        "Seat No",
        "Division",
        "Total Marks",
        "SGPI",
        "CGPA",
        "Overall Result",
    ])
    writer.writerow([
        sanitize_csv_cell(student.student_id),
        sanitize_csv_cell(student.name),
        sanitize_csv_cell(student.roll_no),
        sanitize_csv_cell(student.seat_no),
        sanitize_csv_cell(student.division),
        sanitize_csv_cell(student.total_marks),
        sanitize_csv_cell(student.sgpi),
        sanitize_csv_cell(student.cgpa),
        sanitize_csv_cell(student.overall_result),
    ])
    writer.writerow([])  # Spacer

    # 2. Detailed subject breakdown
    writer.writerow([
        "Course Code",
        "Course Name",
        "Kind",
        "Credits",
        "Component Scores",
        "Sum of Components",
        "Printed Total",
        "Total Match",
        "Letter Grade",
        "Recorded Outcome",
        "Classification Reason",
        "Flags",
        "Source Sheet",
        "Source Row",
    ])

    for s in rep.subjects:
        comp_parts = []
        for c_tag, c_detail in s.components.items():
            score_disp = str(c_detail.marks) if c_detail.marks is not None else (c_detail.flag or "N/A")
            comp_parts.append(f"{c_tag}: {score_disp}")
        comp_summary = "; ".join(comp_parts)

        writer.writerow([
            sanitize_csv_cell(s.course_code),
            sanitize_csv_cell(s.course_name),
            sanitize_csv_cell(s.kind),
            sanitize_csv_cell(s.credits),
            sanitize_csv_cell(comp_summary),
            sanitize_csv_cell(s.computed_marks_sum),
            sanitize_csv_cell(s.total_marks),
            sanitize_csv_cell("Match" if s.total_match is True else ("Mismatch" if s.total_match is False else "N/A")),
            sanitize_csv_cell(s.letter_grade),
            sanitize_csv_cell(s.recorded_result.upper()),
            sanitize_csv_cell(s.classification_reason),
            sanitize_csv_cell(", ".join(s.flags)),
            sanitize_csv_cell(s.source_sheet),
            sanitize_csv_cell(s.source_row),
        ])

    filename = f"student_{sanitize_filename(student.student_id)}_breakdown.csv"
    return 200, filename, buf.getvalue()


def export_subject_failures_csv(
    con: duckdb.DuckDBPyConnection,
    course_code: str,
    division: str | None = None,
) -> tuple[int, str, str | dict[str, Any]]:
    """Generate CSV export for a subject's confirmed failing students roster."""
    rep = get_subject_failures(con, course_code, division=division)
    if rep.status != "success":
        return (
            404 if rep.status == "not_found" else 409,
            "",
            rep.to_dict(),
        )

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)

    # 1. Report context header
    writer.writerow(["# EduQuery V3 - Confirmed Subject Failures Roster"])
    writer.writerow([
        "Course Code",
        "Course Name",
        "Division Filter",
        "Total Enrolled",
        "Confirmed Failures",
        "Passing Count",
        "Unresolved Count",
        "Failure Rate (%)",
    ])
    writer.writerow([
        sanitize_csv_cell(rep.course_code),
        sanitize_csv_cell(rep.course_name),
        sanitize_csv_cell(rep.division_filter or "All Divisions"),
        sanitize_csv_cell(rep.total_enrolled),
        sanitize_csv_cell(rep.confirmed_failures_count),
        sanitize_csv_cell(rep.passed_count),
        sanitize_csv_cell(rep.unresolved_count),
        sanitize_csv_cell(round(rep.failure_rate_percent, 2)),
    ])
    writer.writerow([])  # Spacer

    # 2. Failing students roster
    writer.writerow([
        "Student ID",
        "Name",
        "Roll No",
        "Seat No",
        "Division",
        "Total Marks",
        "Letter Grade",
        "Flags",
        "Absent",
        "Failure Reason",
        "Component Marks",
        "Source Sheet",
        "Source Row",
    ])

    for st in rep.failing_students:
        comp_parts = []
        for c_tag, c_detail in st.components.items():
            score_disp = str(c_detail.marks) if c_detail.marks is not None else (c_detail.flag or "N/A")
            comp_parts.append(f"{c_tag}: {score_disp}")
        comp_summary = "; ".join(comp_parts)

        writer.writerow([
            sanitize_csv_cell(st.student_id),
            sanitize_csv_cell(st.name),
            sanitize_csv_cell(st.roll_no),
            sanitize_csv_cell(st.seat_no),
            sanitize_csv_cell(st.division),
            sanitize_csv_cell(st.total_marks),
            sanitize_csv_cell(st.letter_grade),
            sanitize_csv_cell(", ".join(st.flags)),
            sanitize_csv_cell("Yes" if st.is_absent else "No"),
            sanitize_csv_cell(st.failure_reason),
            sanitize_csv_cell(comp_summary),
            sanitize_csv_cell(st.source_sheet),
            sanitize_csv_cell(st.source_row),
        ])

    div_tag = f"_{sanitize_filename(division)}" if division else ""
    filename = f"subject_{sanitize_filename(rep.course_code or 'course')}{div_tag}_failures.csv"
    return 200, filename, buf.getvalue()


def export_students_roster_csv(
    con: duckdb.DuckDBPyConnection,
    query: str | None = None,
    division: str | None = None,
    result: str | None = None,
    course_code: str | None = None,
    multi_fails: bool | None = None,
) -> tuple[str, str]:
    """Generate CSV export for full filtered student roster."""
    where_clauses: list[str] = []
    params: list[Any] = []

    if division and division.strip():
        where_clauses.append("UPPER(TRIM(division)) = UPPER(TRIM(?))")
        params.append(division.strip())

    if result and result.strip():
        r_clean = result.strip().upper()
        if "PASS" in r_clean:
            where_clauses.append("UPPER(TRIM(result)) LIKE '%PASS%'")
        elif "FAIL" in r_clean:
            where_clauses.append("UPPER(TRIM(result)) LIKE '%FAIL%'")
        elif "UNRESOLVED" in r_clean:
            where_clauses.append("NOT (UPPER(TRIM(result)) LIKE '%PASS%' OR UPPER(TRIM(result)) LIKE '%FAIL%')")
        else:
            where_clauses.append("UPPER(TRIM(result)) = UPPER(TRIM(?))")
            params.append(r_clean)

    if course_code and course_code.strip():
        where_clauses.append("student_id IN (SELECT student_id FROM enrollment WHERE UPPER(course_code) = UPPER(?))")
        params.append(course_code.strip())

    if multi_fails is True:
        where_clauses.append(
            """student_id IN (
                SELECT student_id
                FROM reconciliation
                WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
                  AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
                GROUP BY student_id
                HAVING COUNT(DISTINCT course_code) >= 2
            )"""
        )

    if query and query.strip():
        # Escape wildcards
        clean_q = query.strip().replace("!", "!!").replace("%", "!%").replace("_", "!_")
        where_clauses.append(
            "(student_id LIKE ? ESCAPE '!' OR seat_no LIKE ? ESCAPE '!' OR roll_no LIKE ? ESCAPE '!' OR name LIKE ? ESCAPE '!')"
        )
        like_term = f"%{clean_q}%"
        params.extend([like_term, like_term, like_term, like_term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT student_id, name, roll_no, seat_no, division, level, total_marks, result, sgpi, cgpa, source_sheet, source_row
        FROM students
        {where_sql}
        ORDER BY division, student_id
    """
    rows = con.execute(sql, params).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)

    writer.writerow(["# EduQuery V3 - Student Roster Export"])
    writer.writerow([
        "Student ID",
        "Name",
        "Roll No",
        "Seat No",
        "Division",
        "Level",
        "Total Marks",
        "Overall Result",
        "SGPI",
        "CGPA",
        "Source Sheet",
        "Source Row",
    ])

    for r in rows:
        writer.writerow([
            sanitize_csv_cell(r[0]),
            sanitize_csv_cell(r[1]),
            sanitize_csv_cell(r[2]),
            sanitize_csv_cell(r[3]),
            sanitize_csv_cell(r[4]),
            sanitize_csv_cell(r[5]),
            sanitize_csv_cell(r[6]),
            sanitize_csv_cell(r[7]),
            sanitize_csv_cell(r[8]),
            sanitize_csv_cell(r[9]),
            sanitize_csv_cell(r[10]),
            sanitize_csv_cell(r[11]),
        ])

    return "student_roster.csv", buf.getvalue()


def export_students_roster_excel(
    con: duckdb.DuckDBPyConnection,
    query: str | None = None,
    division: str | None = None,
    result: str | None = None,
    course_code: str | None = None,
    multi_fails: bool | None = None,
) -> tuple[str, bytes]:
    """Generate professional .xlsx export for filtered student roster."""
    where_clauses: list[str] = []
    params: list[Any] = []

    if division and division.strip():
        where_clauses.append("UPPER(TRIM(division)) = UPPER(TRIM(?))")
        params.append(division.strip())

    if result and result.strip():
        r_clean = result.strip().upper()
        if "PASS" in r_clean:
            where_clauses.append("UPPER(TRIM(result)) LIKE '%PASS%'")
        elif "FAIL" in r_clean:
            where_clauses.append("UPPER(TRIM(result)) LIKE '%FAIL%'")
        elif "UNRESOLVED" in r_clean:
            where_clauses.append("NOT (UPPER(TRIM(result)) LIKE '%PASS%' OR UPPER(TRIM(result)) LIKE '%FAIL%')")
        else:
            where_clauses.append("UPPER(TRIM(result)) = UPPER(TRIM(?))")
            params.append(r_clean)

    if course_code and course_code.strip():
        where_clauses.append("student_id IN (SELECT student_id FROM enrollment WHERE UPPER(course_code) = UPPER(?))")
        params.append(course_code.strip())

    if multi_fails is True:
        where_clauses.append(
            """student_id IN (
                SELECT student_id
                FROM reconciliation
                WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
                  AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
                GROUP BY student_id
                HAVING COUNT(DISTINCT course_code) >= 2
            )"""
        )

    if query and query.strip():
        clean_q = query.strip()
        escaped = escape_like_pattern(clean_q).lower()
        like_pattern = f"%{escaped}%"
        where_clauses.append(
            "(LOWER(name) LIKE ? ESCAPE '!' OR "
            "LOWER(student_id) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(seat_no, '')) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(roll_no, '')) LIKE ? ESCAPE '!')"
        )
        params.extend([like_pattern, like_pattern, like_pattern, like_pattern])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    sql = f"""
        SELECT student_id, name, roll_no, seat_no, division, level, total_marks, result, sgpi, cgpa, source_sheet, source_row
        FROM students
        {where_sql}
        ORDER BY division ASC NULLS LAST, roll_no ASC NULLS LAST, student_id ASC
    """
    rows = con.execute(sql, params).fetchall()

    student_ids = [str(r[0]) for r in rows]
    subject_counts = get_students_subject_counts_batch(con, student_ids)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Roster"

    headers = [
        "Student ID",
        "Name",
        "Roll No",
        "Seat No",
        "Division",
        "Level",
        "Total Marks",
        "Overall Result",
        "SGPI",
        "CGPA",
        "Passed Subjects",
        "Failed Subjects",
        "Source Sheet",
        "Source Row",
    ]
    ws.append(headers)

    for r in rows:
        sid = str(r[0])
        passed_c, failed_c, _ = subject_counts.get(sid, (0, 0, 0))
        row_vals = [
            sid,
            str(r[1]) if r[1] is not None else "",
            str(r[2]) if r[2] is not None else "",
            str(r[3]) if r[3] is not None else "",
            str(r[4]) if r[4] is not None else "",
            str(r[5]) if r[5] is not None else "",
            float(r[6]) if r[6] is not None else "",
            str(r[7]) if r[7] is not None else "",
            float(r[8]) if r[8] is not None else "",
            float(r[9]) if r[9] is not None else "",
            passed_c,
            failed_c,
            str(r[10]) if r[10] is not None else "",
            int(r[11]) if r[11] is not None else "",
        ]
        ws.append(row_vals)
        cur_row = ws.max_row
        ws.cell(row=cur_row, column=1).data_type = "s"
        ws.cell(row=cur_row, column=3).data_type = "s"
        ws.cell(row=cur_row, column=4).data_type = "s"

    _apply_workbook_styles(ws, header_row_idx=1)

    buf = io.BytesIO()
    wb.save(buf)
    return "student_roster.xlsx", buf.getvalue()


def export_subject_students_excel(
    con: duckdb.DuckDBPyConnection,
    course_code: str,
    division: str | None = None,
    report_type: str = "all",
) -> tuple[int, str, bytes | dict[str, Any]]:
    """Generate Excel .xlsx export for a course: all, passed, or failed students."""
    rep = get_subject_failures(con, course_identifier=course_code, division=division)
    if rep.status != "success":
        return (
            404 if rep.status == "not_found" else 409,
            "",
            rep.to_dict(),
        )

    clean_type = report_type.strip().lower()
    safe_code = sanitize_filename(rep.course_code or course_code)

    if clean_type == "passed":
        students_to_export = [s for s in rep.all_students if s.status == "passed"]
        filename = f"{safe_code}_Passed_Students.xlsx"
        sheet_title = "Passed Students"
    elif clean_type == "failed":
        students_to_export = [s for s in rep.all_students if s.status == "failed"]
        filename = f"{safe_code}_Failed_Students.xlsx"
        sheet_title = "Failed Students"
    else:
        students_to_export = rep.all_students
        filename = f"{safe_code}_All_Students.xlsx"
        sheet_title = "All Students"

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title[:31]

    # Subject Metadata Header Rows
    ws.append([f"EduQuery — Subject Analysis Roster: {rep.course_code} - {rep.course_name}"])
    ws.append([f"Component Type: {rep.kind or 'theory'} | Division: {rep.division_filter or 'All Divisions'} | Credits: {rep.credits or 'N/A'}"])
    ws.append([f"Total Enrolled: {rep.total_enrolled} | Passed: {rep.passed_count} | Failed: {rep.confirmed_failures_count} | Absent: {rep.absent_count} | Pass Rate: {rep.pass_percentage:.1f}% ({rep.denominator_explanation})"])
    ws.append([])

    table_header_row = 5
    headers = [
        "Roll No",
        "Seat No",
        "Student ID",
        "Name",
        "Division",
        "Component Marks",
        "Total Marks",
        "Letter Grade",
        "Status",
        "Flags",
        "Classification Reason",
        "Source Sheet",
        "Source Row",
    ]
    ws.append(headers)

    for st in students_to_export:
        comp_parts = []
        for c_tag, c_detail in st.components.items():
            score_disp = str(c_detail.marks) if c_detail.marks is not None else (c_detail.flag or "N/A")
            comp_parts.append(f"{c_tag}: {score_disp}")
        comp_summary = "; ".join(comp_parts)

        row_vals = [
            str(st.roll_no) if st.roll_no is not None else "",
            str(st.seat_no) if st.seat_no is not None else "",
            str(st.student_id),
            str(st.name),
            str(st.division) if st.division is not None else "",
            comp_summary,
            float(st.total_marks) if st.total_marks is not None else "",
            str(st.letter_grade) if st.letter_grade is not None else "",
            str(st.status).upper(),
            ", ".join(st.flags),
            str(st.classification_reason),
            str(st.source_sheet),
            int(st.source_row) if st.source_row is not None else "",
        ]
        ws.append(row_vals)
        cur_row = ws.max_row
        ws.cell(row=cur_row, column=1).data_type = "s"
        ws.cell(row=cur_row, column=2).data_type = "s"
        ws.cell(row=cur_row, column=3).data_type = "s"

    _apply_workbook_styles(ws, header_row_idx=table_header_row)

    ws.cell(row=1, column=1).font = Font(name="Calibri", size=13, bold=True, color="0F172A")
    meta_font = Font(name="Calibri", size=10, bold=True, color="334155")
    ws.cell(row=2, column=1).font = meta_font
    ws.cell(row=3, column=1).font = meta_font

    buf = io.BytesIO()
    wb.save(buf)
    return 200, filename, buf.getvalue()


def export_student_breakdown_excel(
    con: duckdb.DuckDBPyConnection,
    identifier: str,
) -> tuple[int, str, bytes | dict[str, Any]]:
    """Generate Excel .xlsx export for a student's full subject performance breakdown."""
    rep = get_student_breakdown(con, identifier)
    if rep.status != "success":
        return (
            404 if rep.status == "not_found" else 409,
            "",
            rep.to_dict(),
        )

    student = rep.student
    assert student is not None

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Academic Breakdown"

    ws.append([f"EduQuery — Academic Performance Breakdown: {student.name} ({student.student_id})"])
    ws.append([f"Roll No: {student.roll_no or 'N/A'} | Seat No: {student.seat_no or 'N/A'} | Division: {student.division or 'N/A'} | Result: {student.overall_result or 'N/A'}"])
    ws.append([f"Total Marks: {student.total_marks or 'N/A'} | SGPI: {student.sgpi or 'N/A'} | CGPA: {student.cgpa or 'N/A'} | Passed: {rep.passed_count} | Failed: {rep.failed_count}"])
    ws.append([])

    table_header_row = 5
    headers = [
        "Course Code",
        "Course Name",
        "Kind",
        "Credits",
        "Component Scores",
        "Computed Sum",
        "Printed Total",
        "Total Match",
        "Letter Grade",
        "Recorded Outcome",
        "Classification Reason",
        "Flags",
        "Source Sheet",
        "Source Row",
    ]
    ws.append(headers)

    for s in rep.subjects:
        comp_parts = []
        for c_tag, c_detail in s.components.items():
            score_disp = str(c_detail.marks) if c_detail.marks is not None else (c_detail.flag or "N/A")
            comp_parts.append(f"{c_tag}: {score_disp}")
        comp_summary = "; ".join(comp_parts)

        row_vals = [
            str(s.course_code),
            str(s.course_name),
            str(s.kind),
            float(s.credits) if s.credits is not None else "",
            comp_summary,
            float(s.computed_marks_sum) if s.computed_marks_sum is not None else "",
            float(s.total_marks) if s.total_marks is not None else "",
            "Match" if s.total_match is True else ("Mismatch" if s.total_match is False else "N/A"),
            str(s.letter_grade) if s.letter_grade is not None else "",
            str(s.recorded_result).upper(),
            str(s.classification_reason or ""),
            ", ".join(s.flags),
            str(s.source_sheet),
            int(s.source_row),
        ]
        ws.append(row_vals)
        cur_row = ws.max_row
        ws.cell(row=cur_row, column=1).data_type = "s"

    _apply_workbook_styles(ws, header_row_idx=table_header_row)

    ws.cell(row=1, column=1).font = Font(name="Calibri", size=13, bold=True, color="0F172A")
    meta_font = Font(name="Calibri", size=10, bold=True, color="334155")
    ws.cell(row=2, column=1).font = meta_font
    ws.cell(row=3, column=1).font = meta_font

    filename = f"student_{sanitize_filename(student.student_id)}_breakdown.xlsx"
    buf = io.BytesIO()
    wb.save(buf)
    return 200, filename, buf.getvalue()


def export_investigation_excel(
    con: duckdb.DuckDBPyConnection,
    where_sql: str,
    params: list[object],
    order_clause: str,
    explanation: str,
) -> tuple[str, bytes]:
    """Generate Excel .xlsx export for matching investigation cohort records."""
    select_sql = f"""
        SELECT student_id, name, roll_no, seat_no, division, level,
               total_marks, result, sgpi, cgpa, source_sheet, source_row
        FROM students
        WHERE {where_sql}
        ORDER BY {order_clause}
    """
    rows = con.execute(select_sql, params).fetchall()

    student_ids = [str(r[0]) for r in rows]
    subject_counts = get_students_subject_counts_batch(con, student_ids)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Investigation Results"

    ws.append(["EduQuery — Academic Investigation Export"])
    ws.append([f"Active Filter Query: {explanation}"])
    ws.append([f"Total Matching Students: {len(rows)}"])
    ws.append([])

    table_header_row = 5
    headers = [
        "Student ID",
        "Name",
        "Roll No",
        "Seat No",
        "Division",
        "Level",
        "Total Marks",
        "Overall Result",
        "SGPI",
        "CGPA",
        "Passed Subjects",
        "Failed Subjects",
        "Source Sheet",
        "Source Row",
    ]
    ws.append(headers)

    for r in rows:
        sid = str(r[0])
        passed_c, failed_c, _ = subject_counts.get(sid, (0, 0, 0))
        row_vals = [
            sid,
            str(r[1]) if r[1] is not None else "",
            str(r[2]) if r[2] is not None else "",
            str(r[3]) if r[3] is not None else "",
            str(r[4]) if r[4] is not None else "",
            str(r[5]) if r[5] is not None else "",
            float(r[6]) if r[6] is not None else "",
            str(r[7]) if r[7] is not None else "",
            float(r[8]) if r[8] is not None else "",
            float(r[9]) if r[9] is not None else "",
            passed_c,
            failed_c,
            str(r[10]) if r[10] is not None else "",
            int(r[11]) if r[11] is not None else "",
        ]
        ws.append(row_vals)
        cur_row = ws.max_row
        ws.cell(row=cur_row, column=1).data_type = "s"
        ws.cell(row=cur_row, column=3).data_type = "s"
        ws.cell(row=cur_row, column=4).data_type = "s"

    _apply_workbook_styles(ws, header_row_idx=table_header_row)

    ws.cell(row=1, column=1).font = Font(name="Calibri", size=13, bold=True, color="0F172A")
    meta_font = Font(name="Calibri", size=10, bold=True, color="334155")
    ws.cell(row=2, column=1).font = meta_font
    ws.cell(row=3, column=1).font = meta_font

    buf = io.BytesIO()
    wb.save(buf)
    return "investigation_results.xlsx", buf.getvalue()

