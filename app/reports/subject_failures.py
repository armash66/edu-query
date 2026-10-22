"""Subject-wise failure listing service for EduQuery V3."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

import duckdb

from app.reports.student_breakdown import (
    ABSENT_MARKERS,
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
class SubjectStudentDetail:
    student_id: str
    name: str
    roll_no: str | None
    seat_no: str | None
    division: str | None
    course_code: str
    course_name: str
    total_marks: float | None
    letter_grade: str | None
    status: str  # "passed", "failed", "unresolved", "absent"
    flags: list[str]
    is_absent: bool
    components: dict[str, ComponentScoreDetail]
    source_sheet: str
    source_row: int
    classification_reason: str = ""

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
            "status": self.status,
            "flags": self.flags,
            "is_absent": self.is_absent,
            "components": {k: v.to_dict() for k, v in self.components.items()},
            "source_sheet": self.source_sheet,
            "source_row": self.source_row,
            "classification_reason": self.classification_reason,
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
    absent_count: int = 0
    failure_rate_percent: float = 0.0
    pass_percentage: float = 0.0
    denominator_explanation: str = "Pass percentage is calculated as: Passed / (Passed + Failed) among classified eligible students."
    failing_students: list[FailingStudentDetail] = field(default_factory=list)
    all_students: list[SubjectStudentDetail] = field(default_factory=list)

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
            "absent_count": self.absent_count,
            "failure_rate_percent": round(self.failure_rate_percent, 2),
            "pass_percentage": round(self.pass_percentage, 2),
            "denominator_explanation": self.denominator_explanation,
            "failing_students": [s.to_dict() for s in self.failing_students],
            "all_students": [s.to_dict() for s in self.all_students],
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
    all_students: list[SubjectStudentDetail] = []
    passed_count = 0
    confirmed_failures_count = 0
    unresolved_count = 0
    absent_count = 0

    # Batch load reconciliation, grades, and scores for this course
    recon_rows = con.execute("""
        SELECT student_id, printed_total, computed_total, total_match, grade, flags
        FROM reconciliation
        WHERE course_code = ?
    """, [course_code]).fetchall()
    recon_map = {r[0]: r for r in recon_rows}

    grade_rows = con.execute("""
        SELECT student_id, letter FROM grades WHERE course_code = ?
    """, [course_code]).fetchall()
    grade_map = {r[0]: r[1] for r in grade_rows}

    score_rows = con.execute("""
        SELECT student_id, component, value, flag, state, raw_text, source_sheet, source_row
        FROM scores
        WHERE course_code = ? AND component != 'TOT1'
        ORDER BY component
    """, [course_code]).fetchall()
    score_map: dict[str, list[Any]] = {}
    for sr in score_rows:
        score_map.setdefault(sr[0], []).append(sr[1:])

    for sid, name, roll_no, seat_no, s_div, s_sheet, s_row in enrolled_students:
        recon_row = recon_map.get(sid)
        printed_total = float(recon_row[1]) if recon_row and recon_row[1] is not None else None
        computed_total = float(recon_row[2]) if recon_row and recon_row[2] is not None else None
        recon_flags = [f.strip().upper() for f in recon_row[5].split(",") if f.strip()] if recon_row and recon_row[5] else []

        raw_grade = grade_map.get(sid, recon_row[4] if recon_row else None)
        letter_grade = str(raw_grade).strip() if raw_grade is not None else None

        raw_comp_scores = score_map.get(sid, [])
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
                if clean_f in ABSENT_MARKERS:
                    is_absent = True
            if raw_text and str(raw_text).strip().upper() in ABSENT_MARKERS:
                is_absent = True

        if letter_grade and letter_grade.upper() in {"AB", "ABS", "ABSENT"}:
            is_absent = True

        all_flags = sorted(set(comp_flags + recon_flags))
        total_marks = printed_total if printed_total is not None else computed_total

        result, reason = classify_subject_result_with_reason(letter_grade, all_flags, is_absent=is_absent)

        student_status = result
        if is_absent and result == "unresolved":
            student_status = "absent"
            absent_count += 1
        elif result == "failed":
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

        all_students.append(
            SubjectStudentDetail(
                student_id=str(sid),
                name=str(name),
                roll_no=str(roll_no) if roll_no is not None else None,
                seat_no=str(seat_no) if seat_no is not None else None,
                division=str(s_div) if s_div is not None else None,
                course_code=course_code,
                course_name=course_name,
                total_marks=total_marks,
                letter_grade=letter_grade,
                status=student_status,
                flags=all_flags,
                is_absent=is_absent,
                components=comp_dict,
                source_sheet=str(s_sheet) if s_sheet is not None else "",
                source_row=int(s_row) if s_row is not None else 0,
                classification_reason=reason,
            )
        )

    total_enrolled = len(enrolled_students)
    failure_rate = (confirmed_failures_count / total_enrolled * 100.0) if total_enrolled > 0 else 0.0
    classified_denominator = passed_count + confirmed_failures_count
    pass_pct = (passed_count / classified_denominator * 100.0) if classified_denominator > 0 else 0.0

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
        absent_count=absent_count,
        failure_rate_percent=failure_rate,
        pass_percentage=pass_pct,
        denominator_explanation="Pass percentage is calculated as: Passed / (Passed + Failed) among classified eligible students.",
        failing_students=failing_students,
        all_students=all_students,
    )


def list_all_subjects_failure_summary(
    con: duckdb.DuckDBPyConnection,
    division: str | None = None,
) -> list[dict[str, Any]]:
    """Generate high-level failure statistics for all courses in the catalog using vectorized batch query."""
    clean_div = division.strip().upper() if division and division.strip() else None

    courses = con.execute("SELECT code, name, credits, kind FROM courses ORDER BY code").fetchall()
    if not courses:
        return []

    div_filter = "AND UPPER(TRIM(s.division)) = ?" if clean_div else ""
    params = [clean_div] if clean_div else []

    batch_query = f"""
        WITH comp_flags AS (
            SELECT student_id, course_code, 
                   STRING_AGG(DISTINCT flag, ',') AS comp_flags,
                   BOOL_OR(UPPER(TRIM(COALESCE(flag, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')
                           OR UPPER(TRIM(COALESCE(raw_text, ''))) IN ('A', 'AB', 'ABS', 'ABSENT')) AS has_absent
            FROM scores
            WHERE component != 'TOT1' AND ((flag IS NOT NULL AND TRIM(flag) != '') OR (raw_text IS NOT NULL AND TRIM(raw_text) != ''))
            GROUP BY student_id, course_code
        )
        SELECT 
            e.course_code,
            c.name AS course_name,
            c.credits,
            c.kind,
            e.student_id,
            COALESCE(g.letter, r.grade) AS letter_grade,
            r.flags AS recon_flags,
            cf.comp_flags,
            COALESCE(cf.has_absent, false) AS comp_absent
        FROM enrollment e
        JOIN courses c ON e.course_code = c.code
        JOIN students s ON e.student_id = s.student_id
        LEFT JOIN reconciliation r ON e.student_id = r.student_id AND e.course_code = r.course_code
        LEFT JOIN grades g ON e.student_id = g.student_id AND e.course_code = g.course_code
        LEFT JOIN comp_flags cf ON e.student_id = cf.student_id AND e.course_code = cf.course_code
        WHERE 1=1 {div_filter}
        ORDER BY e.course_code
    """
    rows = con.execute(batch_query, params).fetchall()

    from collections import defaultdict
    course_stats: dict[str, dict[str, Any]] = defaultdict(lambda: {
        'total_enrolled': 0,
        'confirmed_failures_count': 0,
        'passed_count': 0,
        'unresolved_count': 0,
        'credits': None,
        'kind': None,
        'course_name': '',
    })

    for r in rows:
        c_code, c_name, credits_val, kind_val, sid, letter_grade, recon_flags_str, comp_flags_str, comp_absent = r
        stats = course_stats[c_code]
        stats['total_enrolled'] += 1
        stats['course_name'] = c_name
        stats['credits'] = credits_val
        stats['kind'] = kind_val

        comp_flags = [f.strip().upper() for f in comp_flags_str.split(',') if f.strip()] if comp_flags_str else []
        recon_flags = [f.strip().upper() for f in recon_flags_str.split(',') if f.strip()] if recon_flags_str else []
        all_flags = sorted(set(comp_flags + recon_flags))

        clean_grade = str(letter_grade).strip() if letter_grade is not None else None
        is_absent = bool(comp_absent) or (clean_grade is not None and clean_grade.upper() in ABSENT_MARKERS)

        result, reason = classify_subject_result_with_reason(clean_grade, all_flags, is_absent=is_absent)
        if result == 'failed':
            stats['confirmed_failures_count'] += 1
        elif result == 'passed':
            stats['passed_count'] += 1
        else:
            stats['unresolved_count'] += 1

    summaries = []
    for c_code, stats in course_stats.items():
        if stats['total_enrolled'] > 0:
            tot = stats['total_enrolled']
            fails = stats['confirmed_failures_count']
            rate = (fails / tot * 100.0) if tot > 0 else 0.0
            summaries.append({
                "course_code": c_code,
                "course_name": stats['course_name'],
                "credits": stats['credits'],
                "kind": stats['kind'],
                "division_filter": clean_div,
                "total_enrolled": tot,
                "confirmed_failures_count": fails,
                "passed_count": stats['passed_count'],
                "unresolved_count": stats['unresolved_count'],
                "failure_rate_percent": rate,
            })

    # Sort courses by failure count descending
    summaries.sort(key=lambda s: s["confirmed_failures_count"], reverse=True)
    return summaries
