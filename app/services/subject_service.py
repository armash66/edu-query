"""Application service for course catalog and subject failure analytics."""
from __future__ import annotations

import duckdb

from app.api.schemas.common import (
    AmbiguousCourseResponse,
    NotFoundErrorResponse,
    PaginatedResponse,
)
from app.api.schemas.student import ComponentScoreSchema
from app.api.schemas.subject import (
    CourseItem,
    FailingStudentItem,
    SubjectFailureResponse,
    SubjectFailureSummaryItem,
    SubjectFailureSummaryResponse,
    SubjectStudentItem,
    SubjectStudentsResponse,
)
from app.reports.subject_failures import (
    get_subject_failures,
    list_all_subjects_failure_summary,
)


def list_courses(
    con: duckdb.DuckDBPyConnection,
    kind: str | None = None,
    division: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> PaginatedResponse[CourseItem]:
    """Retrieve catalog courses with enrolled student headcounts."""
    where_clauses: list[str] = ["1=1"]
    params: list[object] = []

    if kind and kind.strip():
        k_clean = kind.strip().lower()
        if k_clean in ("practical", "lab", "laboratory"):
            where_clauses.append("LOWER(TRIM(c.kind)) IN ('practical', 'lab', 'laboratory')")
        elif k_clean in ("theory", "th"):
            where_clauses.append("LOWER(TRIM(c.kind)) IN ('theory', 'th')")
        else:
            where_clauses.append("LOWER(TRIM(c.kind)) = ?")
            params.append(k_clean)

    if division and division.strip():
        # Only include courses where at least one student from this division is enrolled
        where_clauses.append("""
            c.code IN (
                SELECT e.course_code
                FROM enrollment e
                JOIN students s ON e.student_id = s.student_id
                WHERE UPPER(TRIM(s.division)) = UPPER(TRIM(?))
            )
        """)
        params.append(division.strip())

    where_sql = " AND ".join(where_clauses)

    # 1. Total matching courses
    count_row = con.execute(f"SELECT COUNT(*) FROM courses c WHERE {where_sql}", params).fetchone()
    total_count = int(count_row[0]) if count_row else 0

    # 2. Select paginated courses with enrollment counts
    # If division is specified, count only enrolled students in that division
    enrollment_join = """
        LEFT JOIN (
            SELECT e.course_code, COUNT(e.student_id) as enrolled_count
            FROM enrollment e
            JOIN students s ON e.student_id = s.student_id
            {div_filter}
            GROUP BY e.course_code
        ) enr ON c.code = enr.course_code
    """
    div_filter = "WHERE UPPER(TRIM(s.division)) = UPPER(TRIM(?))" if (division and division.strip()) else ""
    enroll_params = [division.strip()] if (division and division.strip()) else []

    select_sql = f"""
        SELECT c.code, c.name, c.kind, c.credits, c.components, COALESCE(enr.enrolled_count, 0)
        FROM courses c
        {enrollment_join.format(div_filter=div_filter)}
        WHERE {where_sql}
        ORDER BY c.code ASC
        LIMIT ? OFFSET ?
    """
    full_params = enroll_params + list(params) + [limit, offset]
    rows = con.execute(select_sql, full_params).fetchall()

    items: list[CourseItem] = []
    for r in rows:
        raw_components = str(r[4]) if r[4] is not None else ""
        component_list = [c.strip() for c in raw_components.split(",") if c.strip()]
        raw_kind = str(r[2]).strip().lower() if r[2] is not None else "theory"
        if raw_kind in ("lab", "laboratory", "practical"):
            norm_kind = "practical"
        elif raw_kind in ("theory", "th"):
            norm_kind = "theory"
        else:
            norm_kind = raw_kind

        items.append(
            CourseItem(
                code=str(r[0]),
                name=str(r[1]),
                kind=norm_kind,
                credits=float(r[3]) if r[3] is not None else None,
                components=component_list,
                enrolled_students_count=int(r[5]) if r[5] is not None else 0,
            )
        )

    return PaginatedResponse[CourseItem](
        total=total_count,
        limit=limit,
        offset=offset,
        items=items,
    )


def get_course_failures_service(
    con: duckdb.DuckDBPyConnection,
    course_code: str,
    division: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, SubjectFailureResponse | NotFoundErrorResponse | AmbiguousCourseResponse]:
    """Retrieve confirmed failure roster and metrics for a course."""
    rep = get_subject_failures(con, course_identifier=course_code, division=division)

    if rep.status == "not_found":
        return 404, NotFoundErrorResponse(
            status="not_found",
            error_code="COURSE_NOT_FOUND",
            query=course_code,
            message=f"Course with identifier '{course_code}' not found",
        )

    if rep.status == "ambiguous":
        return 409, AmbiguousCourseResponse(
            status="ambiguous",
            error_code="AMBIGUOUS_COURSE_QUERY",
            query=course_code,
            message=f"Course query '{course_code}' matches multiple courses. Disambiguation required.",
            candidates=rep.matching_courses,
        )

    # Success: slice failing students according to pagination
    paged_students = rep.failing_students[offset : offset + limit]

    student_items: list[FailingStudentItem] = []
    for s in paged_students:
        comp_schemas: dict[str, ComponentScoreSchema] = {}
        for c_name, c in s.components.items():
            comp_schemas[c_name] = ComponentScoreSchema(
                component=c.component,
                marks=c.marks,
                flag=c.flag,
                state=c.state,  # type: ignore[arg-type]
                raw_text=c.raw_text,
            )

        student_items.append(
            FailingStudentItem(
                student_id=s.student_id,
                name=s.name,
                roll_no=s.roll_no,
                seat_no=s.seat_no,
                division=s.division,
                course_code=s.course_code,
                course_name=s.course_name,
                total_marks=s.total_marks,
                letter_grade=s.letter_grade,
                flags=s.flags,
                is_absent=s.is_absent,
                components=comp_schemas,
                failure_reason=s.failure_reason,
                source_sheet=s.source_sheet,
                source_row=s.source_row,
            )
        )

    response = SubjectFailureResponse(
        status="success",
        course_code=rep.course_code or course_code,
        course_name=rep.course_name or "",
        division_filter=rep.division_filter,
        credits=rep.credits,
        kind=rep.kind,
        total_enrolled=rep.total_enrolled,
        confirmed_failures_count=rep.confirmed_failures_count,
        passed_count=rep.passed_count,
        unresolved_count=rep.unresolved_count,
        failure_rate_percent=rep.failure_rate_percent,
        limit=limit,
        offset=offset,
        failing_students=student_items,
    )
    return 200, response


def get_failure_summary_service(
    con: duckdb.DuckDBPyConnection,
    division: str | None = None,
) -> SubjectFailureSummaryResponse:
    """Retrieve curriculum-wide failure summary for all courses."""
    summary_items = list_all_subjects_failure_summary(con, division=division)

    items: list[SubjectFailureSummaryItem] = []
    for s in summary_items:
        items.append(
            SubjectFailureSummaryItem(
                course_code=s["course_code"],
                course_name=s["course_name"],
                credits=s.get("credits"),
                kind=s.get("kind"),
                division_filter=s.get("division_filter"),
                total_enrolled=s["total_enrolled"],
                confirmed_failures_count=s["confirmed_failures_count"],
                passed_count=s["passed_count"],
                unresolved_count=s["unresolved_count"],
                failure_rate_percent=s["failure_rate_percent"],
            )
        )

    return SubjectFailureSummaryResponse(
        division_filter=division,
        total_courses_evaluated=len(items),
        summary=items,
    )


def get_course_students_service(
    con: duckdb.DuckDBPyConnection,
    course_code: str,
    division: str | None = None,
    result_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[int, SubjectStudentsResponse | NotFoundErrorResponse | AmbiguousCourseResponse]:
    """Retrieve unified course student roster showing passed, failed, and absent students."""
    rep = get_subject_failures(con, course_identifier=course_code, division=division)

    if rep.status == "not_found":
        return 404, NotFoundErrorResponse(
            status="not_found",
            error_code="COURSE_NOT_FOUND",
            query=course_code,
            message=f"Course with identifier '{course_code}' not found",
        )

    if rep.status == "ambiguous":
        return 409, AmbiguousCourseResponse(
            status="ambiguous",
            error_code="AMBIGUOUS_COURSE_QUERY",
            query=course_code,
            message=f"Course query '{course_code}' matches multiple courses. Disambiguation required.",
            candidates=rep.matching_courses,
        )

    # Filter by result_filter if specified
    all_students = rep.all_students
    if result_filter and result_filter.strip():
        rf = result_filter.strip().lower()
        if rf == "passed":
            filtered = [s for s in all_students if s.status == "passed"]
        elif rf == "failed":
            filtered = [s for s in all_students if s.status == "failed"]
        elif rf == "absent":
            filtered = [s for s in all_students if s.is_absent or s.status == "absent"]
        elif rf in ("unresolved", "excluded"):
            filtered = [s for s in all_students if s.status in ("unresolved", "absent")]
        else:
            filtered = all_students
    else:
        filtered = all_students

    total_matching = len(filtered)
    paged = filtered[offset : offset + limit]

    student_items: list[SubjectStudentItem] = []
    for s in paged:
        comp_schemas: dict[str, ComponentScoreSchema] = {}
        for c_name, c in s.components.items():
            comp_schemas[c_name] = ComponentScoreSchema(
                component=c.component,
                marks=c.marks,
                flag=c.flag,
                state=c.state,  # type: ignore[arg-type]
                raw_text=c.raw_text,
            )

        student_items.append(
            SubjectStudentItem(
                student_id=s.student_id,
                name=s.name,
                roll_no=s.roll_no,
                seat_no=s.seat_no,
                division=s.division,
                course_code=s.course_code,
                course_name=s.course_name,
                total_marks=s.total_marks,
                letter_grade=s.letter_grade,
                status=s.status,
                flags=s.flags,
                is_absent=s.is_absent,
                components=comp_schemas,
                failure_reason=s.classification_reason or None,
                source_sheet=s.source_sheet,
                source_row=s.source_row,
            )
        )

    raw_kind = (rep.kind or "").strip().lower()
    norm_kind = (
        "practical"
        if raw_kind in ("lab", "laboratory", "practical")
        else ("theory" if raw_kind in ("theory", "th") else rep.kind)
    )

    response = SubjectStudentsResponse(
        status="success",
        course_code=rep.course_code or course_code,
        course_name=rep.course_name or "",
        division_filter=rep.division_filter,
        result_filter=result_filter,
        credits=rep.credits,
        kind=norm_kind,
        total_enrolled=rep.total_enrolled,
        passed_count=rep.passed_count,
        failed_count=rep.confirmed_failures_count,
        absent_count=rep.absent_count,
        unresolved_count=rep.unresolved_count,
        pass_percentage=rep.pass_percentage,
        denominator_explanation=rep.denominator_explanation,
        total=total_matching,
        limit=limit,
        offset=offset,
        students=student_items,
    )
    return 200, response

