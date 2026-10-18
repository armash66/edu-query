"""Subject-wise failure listing service for EduQuery V3."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

import duckdb

from app.reports.student_breakdown import (
    ComponentScoreDetail,
    classify_subject_result,
    classify_subject_result_with_reason,
)


@dataclass
class FailingStudentDetail:
    student_id: str
    name: str
    roll_no: str | None
    seat_no: str | None
    division: str | None
    course_code: str
    course_name: str
    total_marks: float | None
    letter_grade: str | None
    flags: list[str]
    is_absent: bool
    components: dict[str, ComponentScoreDetail]
    source_sheet: str
    source_row: int
    failure_reason: str = "FAILING_LETTER_GRADE"

    def to_dict(self) -> dict[str, Any]:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "roll_no": self.roll_no,
            "seat_no": self.seat_no,
            "division": self.division,
            "course_code": self.course_code,
            "course_name": self.course_name,
            "total_marks": self.total_marks,
            "letter_grade": self.letter_grade,
            "flags": self.flags,
            "is_absent": self.is_absent,
            "components": {k: v.to_dict() for k, v in self.components.items()},
            "source_sheet": self.source_sheet,
            "source_row": self.source_row,
            "failure_reason": self.failure_reason,
        }


@dataclass
class SubjectFailureReport:
    status: str  # "success", "not_found", "ambiguous"
    query: str
    division_filter: str | None
    error_message: str | None = None
    matching_courses: list[dict[str, Any]] = field(default_factory=list)
    course_code: str | None = None
    course_name: str | None = None
    credits: float | None = None
    kind: str | None = None
    total_enrolled: int = 0
    confirmed_failures_count: int = 0
    passed_count: int = 0
    unresolved_count: int = 0
    failure_rate_percent: float = 0.0
    failing_students: list[FailingStudentDetail] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "query": self.query,
            "division_filter": self.division_filter,
            "error_message": self.error_message,
            "matching_courses": self.matching_courses,
            "course_code": self.course_code,
            "course_name": self.course_name,
            "credits": self.credits,
            "kind": self.kind,
            "total_enrolled": self.total_enrolled,
            "confirmed_failures_count": self.confirmed_failures_count,
            "passed_count": self.passed_count,
            "unresolved_count": self.unresolved_count,
            "failure_rate_percent": round(self.failure_rate_percent, 2),
            "failing_students": [s.to_dict() for s in self.failing_students],
        }


def resolve_course(con: duckdb.DuckDBPyConnection, identifier: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Resolve a course code or name using exact and fuzzy matching.

    Returns:
        (unique_course_dict, list_of_ambiguous_matches)
    """
    query = identifier.strip()
    if not query:
        return None, []

    # 1. Exact match on course code
    rows = con.execute("SELECT code, name, kind, credits, components FROM courses WHERE code = ?", [query]).fetchall()
    if len(rows) == 1:
        return _course_row_to_dict(rows[0]), []

    # 2. Case-insensitive exact match on course code
    rows_ci = con.execute("SELECT code, name, kind, credits, components FROM courses WHERE UPPER(TRIM(code)) = UPPER(?)", [query]).fetchall()
    if len(rows_ci) == 1:
        return _course_row_to_dict(rows_ci[0]), []
    if len(rows_ci) > 1:
        return None, [_course_row_to_dict(r) for r in rows_ci]

    # 3. Case-insensitive exact match on course name
    rows_name = con.execute("SELECT code, name, kind, credits, components FROM courses WHERE UPPER(TRIM(name)) = UPPER(?)", [query]).fetchall()
    if len(rows_name) == 1:
        return _course_row_to_dict(rows_name[0]), []
    if len(rows_name) > 1:
        return None, [_course_row_to_dict(r) for r in rows_name]

    # 4. Case-insensitive substring match on name
    rows_sub = con.execute("SELECT code, name, kind, credits, components FROM courses WHERE UPPER(name) LIKE ?", [f"%{query.upper()}%"]).fetchall()
    if len(rows_sub) == 1:
        return _course_row_to_dict(rows_sub[0]), []
    if len(rows_sub) > 1:
        return None, [_course_row_to_dict(r) for r in rows_sub]

    # 5. Case-insensitive substring match on code
    rows_c_sub = con.execute("SELECT code, name, kind, credits, components FROM courses WHERE UPPER(code) LIKE ?", [f"%{query.upper()}%"]).fetchall()
    if len(rows_c_sub) == 1:
        return _course_row_to_dict(rows_c_sub[0]), []
    if len(rows_c_sub) > 1:
        return None, [_course_row_to_dict(r) for r in rows_c_sub]

    return None, []


def _course_row_to_dict(row: tuple) -> dict[str, Any]:
    return {
        "code": str(row[0]),
        "name": str(row[1]),
        "kind": str(row[2] or "theory"),
        "credits": float(row[3]) if row[3] is not None else None,
        "components": [c.strip() for c in str(row[4]).split(",") if c.strip()] if row[4] else [],
    }


def get_subject_failures(
    con: duckdb.DuckDBPyConnection,
    course_identifier: str,
    division: str | None = None,
) -> SubjectFailureReport:
    """List all confirmed failing students for a course with full performance details."""
    clean_div = division.strip().upper() if division and division.strip() else None

    course_dict, ambiguous_matches = resolve_course(con, course_identifier)

    if ambiguous_matches:
        candidate_summaries = [
            {"code": c["code"], "name": c["name"], "kind": c["kind"]}
            for c in ambiguous_matches
        ]
        return SubjectFailureReport(
            status="ambiguous",
            query=course_identifier,
            division_filter=clean_div,
            error_message=f"Course identifier '{course_identifier}' matched {len(ambiguous_matches)} courses. Please specify exact course code.",
            matching_courses=candidate_summaries,
        )

    if not course_dict:
        return SubjectFailureReport(
            status="not_found",
            query=course_identifier,
            division_filter=clean_div,
            error_message=f"Course '{course_identifier}' not found in database.",
        )

    course_code = course_dict["code"]
    course_name = course_dict["name"]

    # Retrieve all enrolled students for this course, applying optional division filter
    query_sql = """
        SELECT e.student_id, s.name, s.roll_no, s.seat_no, s.division, s.source_sheet, s.source_row
        FROM enrollment e
        JOIN students s ON e.student_id = s.student_id
        WHERE e.course_code = ?
    """
    params: list[Any] = [course_code]

    if clean_div:
        query_sql += " AND UPPER(TRIM(s.division)) = ?"
        params.append(clean_div)

    query_sql += " ORDER BY s.division, s.student_id"

    enrolled_students = con.execute(query_sql, params).fetchall()

    failing_students: list[FailingStudentDetail] = []
    passed_count = 0
    confirmed_failures_count = 0
    unresolved_count = 0

    for sid, name, roll_no, seat_no, s_div, s_sheet, s_row in enrolled_students:
        # Get reconciliation and letter grade
        recon_row = con.execute("""
            SELECT printed_total, computed_total, total_match, grade, flags
            FROM reconciliation
            WHERE student_id = ? AND course_code = ?
        """, [sid, course_code]).fetchone()

        printed_total = float(recon_row[0]) if recon_row and recon_row[0] is not None else None
        computed_total = float(recon_row[1]) if recon_row and recon_row[1] is not None else None
        recon_flags = [f.strip().upper() for f in recon_row[4].split(",") if f.strip()] if recon_row and recon_row[4] else []

        grade_row = con.execute("""
            SELECT letter FROM grades WHERE student_id = ? AND course_code = ?
        """, [sid, course_code]).fetchone()

        raw_grade = grade_row[0] if grade_row and grade_row[0] is not None else (recon_row[3] if recon_row else None)
        letter_grade = str(raw_grade).strip() if raw_grade is not None else None

        # Component scores
        raw_comp_scores = con.execute("""
            SELECT component, value, flag, state, raw_text, source_sheet, source_row
            FROM scores
            WHERE student_id = ? AND course_code = ? AND component != 'TOT1'
            ORDER BY component
        """, [sid, course_code]).fetchall()

        comp_dict: dict[str, ComponentScoreDetail] = {}
        comp_flags: list[str] = []
        is_absent = False

        for comp, val, flag, state, raw_text, cs_sheet, cs_row in raw_comp_scores:
            comp_dict[comp] = ComponentScoreDetail(
                component=str(comp),
                marks=float(val) if val is not None else None,
                flag=str(flag) if flag is not None else None,
                state=str(state),
                raw_text=str(raw_text) if raw_text is not None else None,
                source_sheet=str(cs_sheet),
                source_row=int(cs_row),
            )
            if flag:
                clean_f = str(flag).strip().upper()
                comp_flags.append(clean_f)
                if clean_f in {"AB", "ABS"}:
                    is_absent = True

        if letter_grade and letter_grade.upper() in {"AB", "ABS"}:
            is_absent = True

        all_flags = sorted(set(comp_flags + recon_flags))
        total_marks = printed_total if printed_total is not None else computed_total

        result, reason = classify_subject_result_with_reason(letter_grade, all_flags, is_absent=is_absent)

        if result == "failed":
            confirmed_failures_count += 1
            failing_students.append(
                FailingStudentDetail(
                    student_id=str(sid),
                    name=str(name),
                    roll_no=str(roll_no) if roll_no is not None else None,
                    seat_no=str(seat_no) if seat_no is not None else None,
                    division=str(s_div) if s_div is not None else None,
                    course_code=course_code,
                    course_name=course_name,
                    total_marks=total_marks,
                    letter_grade=letter_grade,
                    flags=all_flags,
                    is_absent=is_absent,
                    components=comp_dict,
                    source_sheet=str(s_sheet) if s_sheet is not None else "",
                    source_row=int(s_row) if s_row is not None else 0,
                    failure_reason=reason,
                )
            )
        elif result == "passed":
            passed_count += 1
        else:
            unresolved_count += 1

    total_enrolled = len(enrolled_students)
    failure_rate = (confirmed_failures_count / total_enrolled * 100.0) if total_enrolled > 0 else 0.0

    return SubjectFailureReport(
        status="success",
        query=course_identifier,
        division_filter=clean_div,
        course_code=course_code,
        course_name=course_name,
        credits=course_dict["credits"],
        kind=course_dict["kind"],
        total_enrolled=total_enrolled,
        confirmed_failures_count=confirmed_failures_count,
        passed_count=passed_count,
        unresolved_count=unresolved_count,
        failure_rate_percent=failure_rate,
        failing_students=failing_students,
    )


def list_all_subjects_failure_summary(
    con: duckdb.DuckDBPyConnection,
    division: str | None = None,
) -> list[dict[str, Any]]:
    """Generate high-level failure statistics for all courses in the catalog."""
    courses = con.execute("SELECT code, name FROM courses ORDER BY code").fetchall()
    summaries = []

    for code, name in courses:
        rep = get_subject_failures(con, str(code), division=division)
        if rep.status == "success" and rep.total_enrolled > 0:
            summaries.append({
                "course_code": rep.course_code,
                "course_name": rep.course_name,
                "credits": rep.credits,
                "kind": rep.kind,
                "division_filter": rep.division_filter,
                "total_enrolled": rep.total_enrolled,
                "confirmed_failures_count": rep.confirmed_failures_count,
                "passed_count": rep.passed_count,
                "unresolved_count": rep.unresolved_count,
                "failure_rate_percent": rep.failure_rate_percent,
            })

    # Sort courses by failure count descending
    summaries.sort(key=lambda s: s["confirmed_failures_count"], reverse=True)
    return summaries
