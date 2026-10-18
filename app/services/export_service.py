"""Export service for faculty reports with anti-formula injection safeguards."""
from __future__ import annotations

import csv
import io
import re
from typing import Any

import duckdb

from app.reports.student_breakdown import get_student_breakdown
from app.reports.subject_failures import get_subject_failures


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
        where_clauses.append("UPPER(TRIM(result)) = UPPER(TRIM(?))")
        params.append(result.strip())

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
