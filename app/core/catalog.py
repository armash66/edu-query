"""Metadata extraction and catalog discovery for EduQuery V3."""
from __future__ import annotations

import json
from typing import Any

import duckdb


def get_catalog(con: duckdb.DuckDBPyConnection) -> dict[str, Any]:
    """Extract catalog metadata and entity lists from an ingested DuckDB database."""
    # 1. Courses
    raw_courses = con.execute("SELECT code, name, kind, credits, components FROM courses ORDER BY code").fetchall()
    courses = []
    for code, name, kind, credits_val, comps_str in raw_courses:
        comps = [c.strip() for c in comps_str.split(",") if c.strip()] if comps_str else []
        courses.append({
            "code": str(code),
            "name": str(name),
            "kind": str(kind or "theory"),
            "credits": float(credits_val) if credits_val is not None else None,
            "components": comps,
        })

    # 2. Divisions
    raw_divs = con.execute("SELECT DISTINCT division FROM students WHERE division IS NOT NULL ORDER BY division").fetchall()
    divisions = [str(r[0]) for r in raw_divs]

    # 3. Assessment components
    raw_comps = con.execute("SELECT DISTINCT component FROM scores WHERE component IS NOT NULL ORDER BY component").fetchall()
    components = [str(r[0]) for r in raw_comps]

    # 4. Students
    raw_students = con.execute("""
        SELECT student_id, roll_no, seat_no, name, division, result, total_marks, sgpi, cgpa, source_sheet, source_row
        FROM students ORDER BY student_id
    """).fetchall()
    students = []
    for r in raw_students:
        students.append({
            "student_id": str(r[0]),
            "roll_no": str(r[1]) if r[1] is not None else None,
            "seat_no": str(r[2]) if r[2] is not None else None,
            "name": str(r[3]),
            "division": str(r[4]) if r[4] is not None else None,
            "result": str(r[5]) if r[5] is not None else None,
            "total_marks": float(r[6]) if r[6] is not None else None,
            "sgpi": float(r[7]) if r[7] is not None else None,
            "cgpa": float(r[8]) if r[8] is not None else None,
            "source_sheet": str(r[9]),
            "source_row": int(r[10]),
        })

    # 5. Quality findings
    quality_findings = []
    has_qf = con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name='quality_findings'").fetchone()[0]
    if has_qf:
        raw_qf = con.execute("SELECT check_id, severity, title, count, problem, impact, recommended_action, details_json FROM quality_findings").fetchall()
        for q in raw_qf:
            quality_findings.append({
                "check_id": q[0],
                "severity": q[1],
                "title": q[2],
                "count": q[3],
                "problem": q[4],
                "impact": q[5],
                "recommended_action": q[6],
                "details": json.loads(q[7]) if q[7] else [],
            })

    return {
        "courses": courses,
        "divisions": divisions,
        "components": components,
        "students": students,
        "students_count": len(students),
        "courses_count": len(courses),
        "quality_findings": quality_findings,
    }
