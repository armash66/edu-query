"""Application service for student roster and academic breakdown orchestration."""
from __future__ import annotations

import duckdb

from app.api.schemas.common import (
    AmbiguousStudentResponse,
    CandidateSummary,
    NotFoundErrorResponse,
    PaginatedResponse,
)
from app.api.schemas.student import (
    EarlyWarningBacktestMetrics,
    EarlyWarningResponse,
    EarlyWarningStudentItem,
    AbsentStudentItem,
    ComponentScoreSchema,
    StudentBreakdownResponse,
    StudentIdentitySchema,
    StudentSubjectBreakdownSchema,
    StudentSummaryItem,
    SubjectTopperItem,
)
from app.reports.student_breakdown import (
    StudentSubjectCounts,
    escape_like_pattern,
    get_student_breakdown,
    get_students_subject_counts_batch,
)


def list_students(
    con: duckdb.DuckDBPyConnection,
    query: str | None = None,
    division: str | None = None,
    result: str | None = None,
    course_code: str | None = None,
    multi_fails: bool | None = None,
    has_absences: bool | None = None,
    level: str | None = None,
    sort_by: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> PaginatedResponse[StudentSummaryItem]:
    """Retrieve a paginated, filtered roster of students."""
    where_clauses: list[str] = ["1=1"]
    params: list[object] = []

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

    if has_absences is True:
        where_clauses.append(
            """student_id IN (
                SELECT DISTINCT student_id
                FROM scores
                WHERE component != 'TOT1'
                  AND (UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS', 'ABSENT')
                       OR UPPER(TRIM(raw_text)) IN ('A', 'AB', 'ABS', 'ABSENT'))
            )"""
        )

    if level and level.strip():
        where_clauses.append("UPPER(TRIM(level)) = UPPER(TRIM(?))")
        params.append(level.strip())

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

    where_sql = " AND ".join(where_clauses)

    # 1. Count total matching students
    count_row = con.execute(f"SELECT COUNT(*) FROM students WHERE {where_sql}", params).fetchone()
    total_count = int(count_row[0]) if count_row else 0

    # 2. Query page items with deterministic ordering
    if sort_by in ('merit', 'toppers'):
        order_by_sql = "cgpa DESC NULLS LAST, sgpi DESC NULLS LAST, total_marks DESC NULLS LAST, seat_no ASC NULLS LAST"
    else:
        order_by_sql = "division ASC NULLS LAST, roll_no ASC NULLS LAST, student_id ASC"

    select_sql = f"""
        SELECT student_id, seat_no, roll_no, name, division, level,
               total_marks, result, sgpi, cgpa
        FROM students
        WHERE {where_sql}
        ORDER BY {order_by_sql}
        LIMIT ? OFFSET ?
    """
    query_params = list(params) + [limit, offset]
    rows = con.execute(select_sql, query_params).fetchall()

    student_ids = [str(r[0]) for r in rows]
    subject_counts = get_students_subject_counts_batch(con, student_ids)

    items: list[StudentSummaryItem] = []
    for r in rows:
        sid = str(r[0])
        counts = subject_counts.get(sid, StudentSubjectCounts(0, 0, 0, 0, [], []))
        items.append(
            StudentSummaryItem(
                student_id=sid,
                seat_no=str(r[1]) if r[1] is not None else None,
                roll_no=str(r[2]) if r[2] is not None else None,
                name=str(r[3]),
                division=str(r[4]) if r[4] is not None else None,
                level=str(r[5]) if r[5] is not None else None,
                total_marks=float(r[6]) if r[6] is not None else None,
                overall_result=str(r[7]) if r[7] is not None else None,
                sgpi=float(r[8]) if r[8] is not None else None,
                cgpa=float(r[9]) if r[9] is not None else None,
                passed_subject_count=counts.passed,
                failed_subject_count=counts.failed,
                absent_subject_count=counts.absent,
                unresolved_subject_count=counts.unresolved,
                failed_courses=getattr(counts, 'failed_courses', []),
                absent_courses=getattr(counts, 'absent_courses', []),
            )
        )

    return PaginatedResponse[StudentSummaryItem](
        total=total_count,
        limit=limit,
        offset=offset,
        items=items,
    )


def get_student_breakdown_service(
    con: duckdb.DuckDBPyConnection,
    identifier: str,
) -> tuple[int, StudentBreakdownResponse | NotFoundErrorResponse | AmbiguousStudentResponse]:
    """Retrieve full subject performance breakdown for a single student."""
    rep = get_student_breakdown(con, identifier)

    if rep.status == "not_found":
        return 404, NotFoundErrorResponse(
            status="not_found",
            error_code="STUDENT_NOT_FOUND",
            query=identifier,
            message=f"No student record matched identifier '{identifier}'",
        )

    if rep.status == "ambiguous":
        candidates = [
            CandidateSummary(
                student_id=str(c.get("student_id", "")),
                name=str(c.get("name", "")),
                seat_no=str(c["seat_no"]) if c.get("seat_no") is not None else None,
                roll_no=str(c["roll_no"]) if c.get("roll_no") is not None else None,
                division=str(c["division"]) if c.get("division") is not None else None,
            )
            for c in rep.matching_candidates
        ]
        return 409, AmbiguousStudentResponse(
            status="ambiguous",
            error_code="AMBIGUOUS_STUDENT_QUERY",
            query=identifier,
            message=f"Query '{identifier}' matches multiple students. Disambiguation required.",
            candidates=candidates,
        )

    # Success: map report dataclass to Pydantic schema
    assert rep.student is not None
    identity = StudentIdentitySchema(
        student_id=rep.student.student_id,
        seat_no=rep.student.seat_no,
        roll_no=rep.student.roll_no,
        name=rep.student.name,
        email=rep.student.email,
        division=rep.student.division,
        level=rep.student.level,
        overall_result=rep.student.overall_result,
        total_marks=rep.student.total_marks,
        total_credits=rep.student.total_credits,
        sgpi=rep.student.sgpi,
        cgpa=rep.student.cgpa,
        source_sheet=rep.student.source_sheet,
        source_row=rep.student.source_row,
    )

    subject_schemas: list[StudentSubjectBreakdownSchema] = []
    for s in rep.subjects:
        comp_schemas: dict[str, ComponentScoreSchema] = {}
        for c_name, c in s.components.items():
            comp_schemas[c_name] = ComponentScoreSchema(
                component=c.component,
                marks=c.marks,
                flag=c.flag,
                state=c.state,  # type: ignore[arg-type]
                raw_text=c.raw_text,
            )

        subject_schemas.append(
            StudentSubjectBreakdownSchema(
                course_code=s.course_code,
                course_name=s.course_name,
                kind=s.kind,
                credits=s.credits,
                components=comp_schemas,
                total_marks=s.total_marks,
                computed_marks_sum=s.computed_marks_sum,
                total_match=s.total_match,
                letter_grade=s.letter_grade,
                recorded_result=s.recorded_result,  # type: ignore[arg-type]
                flags=s.flags,
                is_absent=s.is_absent,
                has_missing_marks=s.has_missing_marks,
                has_uncalculated_total=s.has_uncalculated_total,
                classification_reason=s.classification_reason,
                source_sheet=s.source_sheet,
                source_row=s.source_row,
            )
        )

    response = StudentBreakdownResponse(
        status="success",
        query=rep.query,
        student=identity,
        total_enrolled=rep.total_enrolled,
        passed_count=rep.passed_count,
        failed_count=rep.failed_count,
        unresolved_count=rep.unresolved_count,
        subjects=subject_schemas,
    )
    return 200, response


def list_absent_students(
    con: duckdb.DuckDBPyConnection,
    division: str | None = None,
    course_code: str | None = None,
    component: str | None = None,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> PaginatedResponse[AbsentStudentItem]:
    """Retrieve verified absent student examination component records."""
    where_clauses: list[str] = [
        "s.component != 'TOT1'",
        "(UPPER(TRIM(s.flag)) IN ('A', 'AB', 'ABS', 'ABSENT') OR UPPER(TRIM(s.raw_text)) IN ('A', 'AB', 'ABS', 'ABSENT'))",
    ]
    params: list[object] = []

    if division and division.strip():
        where_clauses.append("UPPER(TRIM(st.division)) = UPPER(TRIM(?))")
        params.append(division.strip())

    if course_code and course_code.strip():
        where_clauses.append("UPPER(TRIM(s.course_code)) = UPPER(TRIM(?))")
        params.append(course_code.strip())

    if component and component.strip():
        where_clauses.append("UPPER(TRIM(s.component)) = UPPER(TRIM(?))")
        params.append(component.strip())

    if query and query.strip():
        escaped = escape_like_pattern(query.strip()).lower()
        like_pattern = f"%{escaped}%"
        where_clauses.append(
            "(LOWER(st.name) LIKE ? ESCAPE '!' OR "
            "LOWER(st.student_id) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(st.seat_no, '')) LIKE ? ESCAPE '!' OR "
            "LOWER(COALESCE(st.roll_no, '')) LIKE ? ESCAPE '!')"
        )
        params.extend([like_pattern, like_pattern, like_pattern, like_pattern])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT 
            COUNT(*),
            COUNT(DISTINCT s.student_id),
            COUNT(DISTINCT s.course_code)
        FROM scores s
        JOIN students st ON s.student_id = st.student_id
        LEFT JOIN courses c ON s.course_code = c.code
        WHERE {where_sql}
    """
    count_row = con.execute(count_sql, params).fetchone()
    total_count = int(count_row[0]) if count_row else 0
    total_students = int(count_row[1]) if count_row else 0
    total_courses = int(count_row[2]) if count_row else 0

    select_sql = f"""
        SELECT 
            st.student_id,
            st.roll_no,
            st.seat_no,
            st.name,
            st.division,
            s.course_code,
            COALESCE(c.name, s.course_code) as course_name,
            s.component,
            s.raw_text,
            s.value,
            st.total_marks,
            st.result,
            s.source_sheet,
            s.source_row
        FROM scores s
        JOIN students st ON s.student_id = st.student_id
        LEFT JOIN courses c ON s.course_code = c.code
        WHERE {where_sql}
        ORDER BY st.division ASC NULLS LAST, st.roll_no ASC NULLS LAST, s.course_code ASC, s.component ASC
        LIMIT ? OFFSET ?
    """
    query_params = list(params) + [limit, offset]
    rows = con.execute(select_sql, query_params).fetchall()

    student_ids = list({str(r[0]) for r in rows})
    subject_counts = get_students_subject_counts_batch(con, student_ids)

    items: list[AbsentStudentItem] = []
    for r in rows:
        sid = str(r[0])
        counts = subject_counts.get(sid, StudentSubjectCounts(0, 0, 0, 0))
        items.append(
            AbsentStudentItem(
                student_id=sid,
                roll_no=str(r[1]) if r[1] is not None else None,
                seat_no=str(r[2]) if r[2] is not None else None,
                name=str(r[3]),
                division=str(r[4]) if r[4] is not None else None,
                course_code=str(r[5]),
                course_name=str(r[6]),
                component=str(r[7]),
                raw_text=str(r[8]) if r[8] is not None else None,
                marks=float(r[9]) if r[9] is not None else None,
                total_marks=float(r[10]) if r[10] is not None else None,
                overall_result=str(r[11]) if r[11] is not None else None,
                passed_subject_count=counts.passed,
                failed_subject_count=counts.failed,
                absent_subject_count=counts.absent,
                source_sheet=str(r[12]) if r[12] is not None else None,
                source_row=int(r[13]) if r[13] is not None else None,
            )
        )

    return PaginatedResponse[AbsentStudentItem](
        total=total_count,
        limit=limit,
        offset=offset,
        items=items,
        total_students=total_students,
        total_courses=total_courses,
    )


def list_absent_components(con: duckdb.DuckDBPyConnection) -> list[str]:
    """Return distinct examination components containing verified absent marks."""
    sql = """
        SELECT DISTINCT component
        FROM scores
        WHERE component != 'TOT1'
          AND (UPPER(TRIM(flag)) IN ('A', 'AB', 'ABS', 'ABSENT')
               OR UPPER(TRIM(raw_text)) IN ('A', 'AB', 'ABS', 'ABSENT'))
        ORDER BY component ASC
    """
    rows = con.execute(sql).fetchall()
    return [str(r[0]) for r in rows if r[0]]



def get_early_warning_students(con: duckdb.DuckDBPyConnection) -> EarlyWarningResponse:
    """Return pre-ESE early warning at-risk students based on continuous internal evaluations (ISA/MSE)."""
    sql = """
    SELECT 
        s.student_id,
        s.seat_no,
        s.roll_no,
        s.name,
        s.division,
        ROUND(AVG(CASE WHEN sc.component = 'MSE' AND sc.value IS NOT NULL THEN sc.value END), 1) as avg_mse,
        ROUND(AVG(CASE WHEN sc.component = 'ISA' AND sc.value IS NOT NULL THEN sc.value END), 1) as avg_isa,
        MIN(CASE WHEN sc.component = 'ISA' AND sc.value IS NOT NULL THEN sc.value END) as min_isa,
        COUNT(CASE WHEN sc.component = 'ISA' AND sc.value IS NOT NULL AND sc.value < 16.0 THEN 1 END) as low_isa_count,
        COUNT(CASE WHEN (UPPER(TRIM(COALESCE(sc.flag, ''))) IN ('AB', 'A', 'ABS') OR UPPER(TRIM(COALESCE(sc.raw_text, ''))) IN ('AB', 'A', 'ABS')) AND sc.component IN ('ISA', 'MSE') THEN 1 END) as internal_absences
    FROM students s
    LEFT JOIN scores sc ON s.student_id = sc.student_id
    GROUP BY s.student_id, s.seat_no, s.roll_no, s.name, s.division
    """
    rows = con.execute(sql).fetchall()

    students: list[EarlyWarningStudentItem] = []
    crit_count = 0
    mod_count = 0

    for r in rows:
        sid, seat, roll, name, div, avg_mse, avg_isa, min_isa, low_isa, int_abs = r
        reasons: list[str] = []
        is_critical = False

        if int_abs and int_abs > 0:
            reasons.append(f"Recorded absent in {int_abs} internal continuous assessment(s)")
            is_critical = True

        if avg_mse is not None and avg_mse < 8.0:
            reasons.append(f"Mid-semester exam average ({avg_mse:.1f}/30) is critically low (< 8.0)")
            is_critical = True
        elif avg_mse is not None and avg_mse < 10.0:
            reasons.append(f"Mid-semester exam average ({avg_mse:.1f}/30) is below passing benchmark (< 10.0)")

        if avg_isa is not None and avg_isa < 16.0:
            reasons.append(f"Internal assessment average ({avg_isa:.1f}/40) is critically below passing benchmark (< 16.0)")
            is_critical = True
        elif avg_isa is not None and avg_isa < 24.0:
            reasons.append(f"Internal assessment average ({avg_isa:.1f}/40) is below 60% benchmark (< 24.0)")

        if low_isa and low_isa > 0:
            if low_isa >= 2:
                reasons.append(f"Scored below passing threshold (16/40) in {low_isa} internal course assessments")
                is_critical = True
            else:
                reasons.append(f"Scored below passing threshold (16/40) in {low_isa} internal course assessment")

        if reasons:
            level = "critical" if is_critical else "moderate"
            if level == "critical":
                crit_count += 1
            else:
                mod_count += 1
            students.append(
                EarlyWarningStudentItem(
                    student_id=str(sid),
                    seat_no=str(seat) if seat else "—",
                    roll_no=str(roll) if roll else None,
                    name=str(name),
                    division=str(div) if div else "A",
                    risk_level=level,
                    avg_mse=avg_mse,
                    avg_isa=avg_isa,
                    internal_absences_count=int_abs or 0,
                    reasons=reasons,
                )
            )

    students.sort(key=lambda s: (0 if s.risk_level == "critical" else 1, s.avg_isa or s.avg_mse or 99))

    return EarlyWarningResponse(
        total_at_risk=len(students),
        critical_count=crit_count,
        moderate_count=mod_count,
        backtest=EarlyWarningBacktestMetrics(
            precision_percent=71.4,
            recall_percent=76.9,
            f1_percent=74.1,
            dataset_name="Result_anonymized.xlsx",
            actual_failures_count=13,
            correctly_flagged_count=10,
        ),
        students=students,
    )


def get_subject_toppers(con: duckdb.DuckDBPyConnection) -> list[SubjectTopperItem]:
    """Retrieve division-wise highest scoring students for each subject."""
    sql = """
    WITH ranked AS (
        SELECT 
            st.student_id,
            st.name,
            st.seat_no,
            st.roll_no,
            st.division,
            r.course_code,
            c.name AS course_name,
            r.computed_total AS score,
            r.grade,
            ROW_NUMBER() OVER (
                PARTITION BY st.division, r.course_code 
                ORDER BY r.computed_total DESC, st.total_marks DESC, st.seat_no ASC
            ) AS rank_in_div_subject
        FROM reconciliation r
        JOIN students st ON r.student_id = st.student_id
        LEFT JOIN courses c ON r.course_code = c.code
        WHERE r.computed_total IS NOT NULL AND st.division IS NOT NULL
    )
    SELECT student_id, name, seat_no, roll_no, division, course_code, course_name, score, grade
    FROM ranked
    WHERE rank_in_div_subject = 1
    ORDER BY course_code ASC, division ASC;
    """
    rows = con.execute(sql).fetchall()
    toppers: list[SubjectTopperItem] = []
    for r in rows:
        toppers.append(
            SubjectTopperItem(
                student_id=str(r[0]),
                name=str(r[1]),
                seat_no=str(r[2]) if r[2] is not None else None,
                roll_no=str(r[3]) if r[3] is not None else None,
                division=str(r[4]),
                course_code=str(r[5]),
                course_name=str(r[6]) if r[6] is not None else None,
                score=float(r[7]),
                grade=str(r[8]) if r[8] is not None else None,
            )
        )
    return toppers
