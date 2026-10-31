"""Student-wise performance breakdown service for EduQuery V3."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

import duckdb

PASSING_GRADES: frozenset[str] = frozenset({"O", "A+", "A", "B+", "B", "C", "D", "E", "P", "PASS", "PASSED"})
FAILING_GRADES: frozenset[str] = frozenset({"F", "FAIL", "FAILS"})
ABSENT_MARKERS: frozenset[str] = frozenset({"A", "AB", "ABS", "ABSENT"})


@dataclass
class ComponentScoreDetail:
    component: str
    marks: float | None
    flag: str | None
    state: str  # "marked", "not_enrolled", "uncalculated", "flagged", "unparsed"
    raw_text: str | None
    source_sheet: str
    source_row: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class StudentSubjectBreakdown:
    course_code: str
    course_name: str
    kind: str
    credits: float | None
    components: dict[str, ComponentScoreDetail]
    total_marks: float | None
    computed_marks_sum: float | None
    total_match: bool | None
    letter_grade: str | None
    recorded_result: str  # "passed", "failed", "unresolved"
    flags: list[str]
    is_absent: bool
    has_missing_marks: bool
    has_uncalculated_total: bool
    source_sheet: str
    source_row: int
    classification_reason: str = "UNRESOLVED"

    def to_dict(self) -> dict[str, Any]:
        return {
            "course_code": self.course_code,
            "course_name": self.course_name,
            "kind": self.kind,
            "credits": self.credits,
            "components": {k: v.to_dict() for k, v in self.components.items()},
            "total_marks": self.total_marks,
            "computed_marks_sum": self.computed_marks_sum,
            "total_match": self.total_match,
            "letter_grade": self.letter_grade,
            "recorded_result": self.recorded_result,
            "flags": self.flags,
            "is_absent": self.is_absent,
            "has_missing_marks": self.has_missing_marks,
            "has_uncalculated_total": self.has_uncalculated_total,
            "source_sheet": self.source_sheet,
            "source_row": self.source_row,
            "classification_reason": self.classification_reason,
        }


@dataclass
class StudentIdentity:
    student_id: str
    seat_no: str | None
    roll_no: str | None
    name: str
    email: str | None
    division: str | None
    level: str | None
    overall_result: str | None
    total_marks: float | None
    total_credits: float | None
    sgpi: float | None
    cgpa: float | None
    source_sheet: str
    source_row: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class StudentBreakdownReport:
    status: str  # "success", "not_found", "ambiguous"
    query: str
    error_message: str | None = None
    matching_candidates: list[dict[str, Any]] = field(default_factory=list)
    student: StudentIdentity | None = None
    total_enrolled: int = 0
    passed_count: int = 0
    failed_count: int = 0
    unresolved_count: int = 0
    subjects: list[StudentSubjectBreakdown] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "query": self.query,
            "error_message": self.error_message,
            "matching_candidates": self.matching_candidates,
            "student": self.student.to_dict() if self.student else None,
            "total_enrolled": self.total_enrolled,
            "passed_count": self.passed_count,
            "failed_count": self.failed_count,
            "unresolved_count": self.unresolved_count,
            "subjects": [s.to_dict() for s in self.subjects],
        }


def classify_subject_result_with_reason(
    letter_grade: str | None,
    component_flags: list[str],
    is_absent: bool = False,
) -> tuple[str, str]:
    """Classify subject result into (outcome, reason).

    Invariants:
    - Never count an empty, absent or unknown result as a confirmed pass or confirmed fail.
    - An explicit recognized failing letter grade (e.g. 'F') is an authoritative confirmed failure.
    - If no final grade is given, an explicit component failure flag ('F') confirms subject failure.
    - If a passing grade is recorded but an assessment component has a failure flag ('F'), surface as
      unresolved conflict ('CONFLICTING_RESULT_INDICATORS') so faculty can review without false certainty.
    - If a passing grade is recorded despite an absent component, classify as passed with explanation
      ('PASSING_GRADE_WITH_ABSENT_COMPONENT') respecting the authoritative institutional outcome.
    - An explicit recognized passing letter grade with no failure flags is a confirmed pass.
    """
    clean_grade = (letter_grade or "").strip().upper()
    clean_flags = {f.strip().upper() for f in component_flags if f}
    has_fail_flag = "F" in clean_flags
    has_absent_flag = is_absent or any(f in ABSENT_MARKERS for f in clean_flags) or (clean_grade in {"AB", "ABS", "ABSENT"})

    # 1. Conflicting indicators: passing letter grade recorded, but component has failure flag 'F'
    if clean_grade in PASSING_GRADES and has_fail_flag:
        return "unresolved", "CONFLICTING_RESULT_INDICATORS"

    # 2. Authoritative final failing grade
    if clean_grade in FAILING_GRADES:
        return "failed", "FAILING_LETTER_GRADE"

    # 3. Component failure flag when final grade is absent or unrecorded
    if has_fail_flag:
        return "failed", "EXPLICIT_FAIL_FLAG"

    # 4. Authoritative final passing grade
    if clean_grade in PASSING_GRADES:
        if has_absent_flag:
            return "passed", "PASSING_GRADE_WITH_ABSENT_COMPONENT"
        return "passed", "PASSING_LETTER_GRADE"

    # 5. Absent in assessment without authoritative letter grade
    if has_absent_flag:
        return "unresolved", "ABSENT_IN_ASSESSMENT"

    # 6. Unrecognized grade string
    if clean_grade:
        return "unresolved", "UNRECOGNIZED_GRADE"

    # 7. Blank or missing grade
    return "unresolved", "MISSING_GRADE_UNRESOLVED"


def classify_subject_result(
    letter_grade: str | None,
    component_flags: list[str],
    is_absent: bool = False,
) -> str:
    """Classify subject result into 'passed', 'failed', or 'unresolved'.

    Invariants:
    - Never count an empty, absent or unknown result as a pass or fail.
    - An explicit failure flag (e.g. 'F') or fail letter grade is a confirmed failure.
    - An explicit recognized passing letter grade with no failure flags is a confirmed pass.
    """
    outcome, _ = classify_subject_result_with_reason(letter_grade, component_flags, is_absent=is_absent)
    return outcome


def escape_like_pattern(text: str, escape_char: str = "!") -> str:
    """Escape SQL LIKE wildcard characters (%, _, and escape_char) to treat user input as literal."""
    return text.replace(escape_char, escape_char * 2).replace("%", escape_char + "%").replace("_", escape_char + "_")


def resolve_student(con: duckdb.DuckDBPyConnection, identifier: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """Search for a student using exact and normalized fuzzy criteria.

    Precedence:
    1. Exact student_id (exact case), then case-insensitive student_id (UPPER TRIM).
    2. Exact seat_no (exact case), then case-insensitive seat_no (UPPER TRIM).
    3. Exact / trimmed roll_no.
    4. Exact name (case-insensitive, trimmed).
    5. Partial name (case-insensitive substring with literal wildcard escaping).

    Returns:
        (unique_student_row, list_of_ambiguous_matches)
    """
    query = identifier.strip() if isinstance(identifier, str) else str(identifier).strip()
    if not query:
        return None, []

    fields_sql = """
        SELECT student_id, seat_no, roll_no, name, email, division, level,
               total_marks, total_credits, result, sgpi, cgpa, source_sheet, source_row
        FROM students
    """

    # 1a. Exact match on student_id
    rows_id_exact = con.execute(f"{fields_sql} WHERE student_id = ?", [query]).fetchall()
    if len(rows_id_exact) == 1:
        return _row_to_dict(rows_id_exact[0]), []
    if len(rows_id_exact) > 1:
        return None, [_row_to_dict(r) for r in rows_id_exact]

    # 1b. Case-insensitive / trimmed match on student_id
    rows_id_ci = con.execute(f"{fields_sql} WHERE UPPER(TRIM(student_id)) = UPPER(?)", [query]).fetchall()
    if len(rows_id_ci) == 1:
        return _row_to_dict(rows_id_ci[0]), []
    if len(rows_id_ci) > 1:
        return None, [_row_to_dict(r) for r in rows_id_ci]

    # 2a. Exact match on seat_no
    rows_seat_exact = con.execute(f"{fields_sql} WHERE seat_no = ?", [query]).fetchall()
    if len(rows_seat_exact) == 1:
        return _row_to_dict(rows_seat_exact[0]), []
    if len(rows_seat_exact) > 1:
        return None, [_row_to_dict(r) for r in rows_seat_exact]

    # 2b. Case-insensitive / trimmed match on seat_no
    rows_seat_ci = con.execute(f"{fields_sql} WHERE UPPER(TRIM(seat_no)) = UPPER(?)", [query]).fetchall()
    if len(rows_seat_ci) == 1:
        return _row_to_dict(rows_seat_ci[0]), []
    if len(rows_seat_ci) > 1:
        return None, [_row_to_dict(r) for r in rows_seat_ci]

    # 3. Exact / trimmed match on roll_no
    rows_roll = con.execute(f"{fields_sql} WHERE TRIM(roll_no) = ?", [query]).fetchall()
    if len(rows_roll) == 1:
        return _row_to_dict(rows_roll[0]), []
    if len(rows_roll) > 1:
        return None, [_row_to_dict(r) for r in rows_roll]

    # 4. Case-insensitive exact match on name
    rows_name = con.execute(f"{fields_sql} WHERE LOWER(TRIM(name)) = LOWER(?)", [query]).fetchall()
    if len(rows_name) == 1:
        return _row_to_dict(rows_name[0]), []
    if len(rows_name) > 1:
        return None, [_row_to_dict(r) for r in rows_name]

    # 5. Case-insensitive substring match on name (with literal wildcard escaping)
    escaped_query = escape_like_pattern(query).lower()
    rows_sub = con.execute(f"{fields_sql} WHERE LOWER(name) LIKE ? ESCAPE '!'", [f"%{escaped_query}%"]).fetchall()
    if len(rows_sub) == 1:
        return _row_to_dict(rows_sub[0]), []
    if len(rows_sub) > 1:
        return None, [_row_to_dict(r) for r in rows_sub]

    return None, []


def _row_to_dict(row: tuple) -> dict[str, Any]:
    return {
        "student_id": str(row[0]),
        "seat_no": str(row[1]) if row[1] is not None else None,
        "roll_no": str(row[2]) if row[2] is not None else None,
        "name": str(row[3]),
        "email": str(row[4]) if row[4] is not None else None,
        "division": str(row[5]) if row[5] is not None else None,
        "level": str(row[6]) if row[6] is not None else None,
        "total_marks": float(row[7]) if row[7] is not None else None,
        "total_credits": float(row[8]) if row[8] is not None else None,
        "overall_result": str(row[9]) if row[9] is not None else None,
        "sgpi": float(row[10]) if row[10] is not None else None,
        "cgpa": float(row[11]) if row[11] is not None else None,
        "source_sheet": str(row[12]),
        "source_row": int(row[13]),
    }


def get_student_breakdown(con: duckdb.DuckDBPyConnection, identifier: str) -> StudentBreakdownReport:
    """Retrieve complete, traceable subject breakdown for a specific student."""
    student_dict, ambiguous_matches = resolve_student(con, identifier)

    if ambiguous_matches:
        candidate_summaries = [
            {
                "student_id": c["student_id"],
                "name": c["name"],
                "roll_no": c["roll_no"],
                "seat_no": c["seat_no"],
                "division": c["division"],
            }
            for c in ambiguous_matches
        ]
        return StudentBreakdownReport(
            status="ambiguous",
            query=identifier,
            error_message=f"Identifier '{identifier}' matched {len(ambiguous_matches)} students. Please specify unambiguous student ID or seat number.",
            matching_candidates=candidate_summaries,
        )

    if not student_dict:
        return StudentBreakdownReport(
            status="not_found",
            query=identifier,
            error_message=f"Student '{identifier}' not found in database.",
        )

    student_identity = StudentIdentity(
        student_id=student_dict["student_id"],
        seat_no=student_dict["seat_no"],
        roll_no=student_dict["roll_no"],
        name=student_dict["name"],
        email=student_dict["email"],
        division=student_dict["division"],
        level=student_dict["level"],
        overall_result=student_dict["overall_result"],
        total_marks=student_dict["total_marks"],
        total_credits=student_dict["total_credits"],
        sgpi=student_dict["sgpi"],
        cgpa=student_dict["cgpa"],
        source_sheet=student_dict["source_sheet"],
        source_row=student_dict["source_row"],
    )

    sid = student_identity.student_id

    # Enrolled courses for this student
    enrolled_courses = con.execute("""
        SELECT e.course_code, c.name, c.kind, c.credits
        FROM enrollment e
        JOIN courses c ON e.course_code = c.code
        WHERE e.student_id = ?
        ORDER BY e.course_code
    """, [sid]).fetchall()

    subjects: list[StudentSubjectBreakdown] = []

    for c_code, c_name, c_kind, c_credits in enrolled_courses:
        # 1. Assessment component scores (exclude synthetic TOT1)
        raw_comp_scores = con.execute("""
            SELECT component, value, flag, state, raw_text, source_sheet, source_row
            FROM scores
            WHERE student_id = ? AND course_code = ? AND component != 'TOT1'
            ORDER BY component
        """, [sid, c_code]).fetchall()

        comp_dict: dict[str, ComponentScoreDetail] = {}
        comp_flags: list[str] = []
        is_absent = False
        has_missing_marks = False

        for comp, val, flag, state, raw_text, s_sheet, s_row in raw_comp_scores:
            comp_dict[comp] = ComponentScoreDetail(
                component=str(comp),
                marks=float(val) if val is not None else None,
                flag=str(flag) if flag is not None else None,
                state=str(state),
                raw_text=str(raw_text) if raw_text is not None else None,
                source_sheet=str(s_sheet),
                source_row=int(s_row),
            )
            if flag:
                clean_f = str(flag).strip().upper()
                comp_flags.append(clean_f)
                if clean_f in ABSENT_MARKERS:
                    is_absent = True

            if val is None and state in {"uncalculated", "flagged", "not_enrolled"}:
                has_missing_marks = True

        # 2. Reconciliation & totals
        recon_row = con.execute("""
            SELECT printed_total, computed_total, total_match, grade, flags
            FROM reconciliation
            WHERE student_id = ? AND course_code = ?
        """, [sid, c_code]).fetchone()

        printed_total = float(recon_row[0]) if recon_row and recon_row[0] is not None else None
        computed_total = float(recon_row[1]) if recon_row and recon_row[1] is not None else None
        total_match = bool(recon_row[2]) if recon_row and recon_row[2] is not None else None
        recon_flags = [f.strip().upper() for f in recon_row[4].split(",") if f.strip()] if recon_row and recon_row[4] else []

        # 3. Letter grade
        grade_row = con.execute("""
            SELECT letter FROM grades WHERE student_id = ? AND course_code = ?
        """, [sid, c_code]).fetchone()

        raw_grade = grade_row[0] if grade_row and grade_row[0] is not None else (recon_row[3] if recon_row else None)
        letter_grade = str(raw_grade).strip() if raw_grade is not None else None

        if letter_grade and letter_grade.upper() in {"AB", "ABS", "ABSENT"}:
            is_absent = True

        # Combine all unique flags
        all_flags = sorted(set(comp_flags + recon_flags))

        # Effective total marks
        total_marks = printed_total if printed_total is not None else computed_total
        has_uncalculated_total = (total_marks is None)

        recorded_result, classification_reason = classify_subject_result_with_reason(
            letter_grade, all_flags, is_absent=is_absent
        )

        # Source provenance
        source_sheet = raw_comp_scores[0][5] if raw_comp_scores else student_identity.source_sheet
        source_row = raw_comp_scores[0][6] if raw_comp_scores else student_identity.source_row

        subjects.append(
            StudentSubjectBreakdown(
                course_code=str(c_code),
                course_name=str(c_name),
                kind=str(c_kind or "theory"),
                credits=float(c_credits) if c_credits is not None else None,
                components=comp_dict,
                total_marks=total_marks,
                computed_marks_sum=computed_total,
                total_match=total_match,
                letter_grade=letter_grade,
                recorded_result=recorded_result,
                flags=all_flags,
                is_absent=is_absent,
                has_missing_marks=has_missing_marks,
                has_uncalculated_total=has_uncalculated_total,
                source_sheet=str(source_sheet),
                source_row=int(source_row),
                classification_reason=classification_reason,
            )
        )

    passed_count = sum(1 for s in subjects if s.recorded_result == "passed")
    failed_count = sum(1 for s in subjects if s.recorded_result == "failed")
    unresolved_count = sum(1 for s in subjects if s.recorded_result == "unresolved")

    return StudentBreakdownReport(
        status="success",
        query=identifier,
        student=student_identity,
        total_enrolled=len(subjects),
        passed_count=passed_count,
        failed_count=failed_count,
        unresolved_count=unresolved_count,
        subjects=subjects,
    )


from typing import NamedTuple


class StudentSubjectCounts(NamedTuple):
    passed: int
    failed: int
    absent: int
    unresolved: int
    failed_courses: list[str] = []
    absent_courses: list[str] = []


def get_students_subject_counts_batch(
    con: duckdb.DuckDBPyConnection,
    student_ids: list[str],
) -> dict[str, StudentSubjectCounts]:
    """Compute (passed_count, failed_count, absent_count, unresolved_count) for each student_id in a batch.

    Returns:
        dict mapping student_id -> StudentSubjectCounts(passed, failed, absent, unresolved)
    """
    if not student_ids:
        return {}

    clean_sids = [str(sid).strip() for sid in student_ids if str(sid).strip()]
    if not clean_sids:
        return {}

    placeholders = ", ".join(["?"] * len(clean_sids))

    # 1. Enrolled courses per student
    enr_rows = con.execute(
        f"SELECT student_id, course_code FROM enrollment WHERE student_id IN ({placeholders})",
        clean_sids,
    ).fetchall()

    if not enr_rows:
        return {sid: StudentSubjectCounts(0, 0, 0, 0) for sid in clean_sids}

    # 2. Batch load reconciliation
    recon_rows = con.execute(
        f"SELECT student_id, course_code, grade, flags FROM reconciliation WHERE student_id IN ({placeholders})",
        clean_sids,
    ).fetchall()
    recon_map = {(r[0], r[1]): (r[2], r[3]) for r in recon_rows}

    # 3. Batch load grades
    grade_rows = con.execute(
        f"SELECT student_id, course_code, letter FROM grades WHERE student_id IN ({placeholders})",
        clean_sids,
    ).fetchall()
    grade_map = {(r[0], r[1]): r[2] for r in grade_rows}

    # 4. Batch load scores with flags or absent markers
    score_rows = con.execute(
        f"""
        SELECT student_id, course_code, flag, raw_text
        FROM scores
        WHERE student_id IN ({placeholders})
          AND component != 'TOT1'
          AND (flag IS NOT NULL OR raw_text IN ('A', 'AB', 'ABS', 'ABSENT', 'a', 'ab', 'abs', 'absent'))
        """,
        clean_sids,
    ).fetchall()
    score_flags_map: dict[tuple[str, str], list[str]] = {}
    score_absent_map: dict[tuple[str, str], bool] = {}
    for sid, ccode, flg, raw_t in score_rows:
        key = (sid, ccode)
        if flg:
            clean_f = str(flg).strip().upper()
            score_flags_map.setdefault(key, []).append(clean_f)
            if clean_f in ABSENT_MARKERS:
                score_absent_map[key] = True
        if raw_t and str(raw_t).strip().upper() in ABSENT_MARKERS:
            score_absent_map[key] = True

    # Aggregate counts per student
    counts: dict[str, list[int]] = {sid: [0, 0, 0] for sid in clean_sids}
    failed_courses_per_student: dict[str, list[str]] = {sid: [] for sid in clean_sids}
    absent_courses_per_student: dict[str, set[str]] = {sid: set() for sid in clean_sids}

    for sid, ccode in enr_rows:
        key = (sid, ccode)
        rc = recon_map.get(key)
        recon_grade = rc[0] if rc else None
        recon_flags_raw = rc[1] if rc else None
        recon_flags = [f.strip().upper() for f in recon_flags_raw.split(",") if f.strip()] if recon_flags_raw else []

        gr = grade_map.get(key, recon_grade)
        letter_grade = str(gr).strip() if gr is not None else None

        comp_flags = score_flags_map.get(key, [])
        all_flags = sorted(set(comp_flags + recon_flags))

        is_absent = score_absent_map.get(key, False)
        if letter_grade and letter_grade.upper() in {"AB", "ABS", "ABSENT"}:
            is_absent = True

        if is_absent and sid in absent_courses_per_student:
            absent_courses_per_student[sid].add(ccode)

        outcome, _ = classify_subject_result_with_reason(letter_grade, all_flags, is_absent=is_absent)
        if sid in counts:
            if outcome == "passed":
                counts[sid][0] += 1
            elif outcome == "failed":
                counts[sid][1] += 1
                if sid in failed_courses_per_student and ccode not in failed_courses_per_student[sid]:
                    failed_courses_per_student[sid].append(ccode)
            else:
                counts[sid][2] += 1

    return {
        sid: StudentSubjectCounts(
            passed=c[0],
            failed=c[1],
            absent=len(absent_courses_per_student.get(sid, set())),
            unresolved=c[2],
            failed_courses=sorted(failed_courses_per_student.get(sid, [])),
            absent_courses=sorted(absent_courses_per_student.get(sid, set())),
        )
        for sid, c in counts.items()
    }

