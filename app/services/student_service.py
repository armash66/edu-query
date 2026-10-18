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
    ComponentScoreSchema,
    StudentBreakdownResponse,
    StudentIdentitySchema,
    StudentSubjectBreakdownSchema,
    StudentSummaryItem,
)
from app.reports.student_breakdown import escape_like_pattern, get_student_breakdown


def list_students(
    con: duckdb.DuckDBPyConnection,
    query: str | None = None,
    division: str | None = None,
    result: str | None = None,
    course_code: str | None = None,
    multi_fails: bool | None = None,
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
    select_sql = f"""
        SELECT student_id, seat_no, roll_no, name, division, level,
               total_marks, result, sgpi, cgpa
        FROM students
        WHERE {where_sql}
        ORDER BY division ASC NULLS LAST, roll_no ASC NULLS LAST, student_id ASC
        LIMIT ? OFFSET ?
    """
    query_params = list(params) + [limit, offset]
    rows = con.execute(select_sql, query_params).fetchall()

    items: list[StudentSummaryItem] = []
    for r in rows:
        items.append(
            StudentSummaryItem(
                student_id=str(r[0]),
                seat_no=str(r[1]) if r[1] is not None else None,
                roll_no=str(r[2]) if r[2] is not None else None,
                name=str(r[3]),
                division=str(r[4]) if r[4] is not None else None,
                level=str(r[5]) if r[5] is not None else None,
                total_marks=float(r[6]) if r[6] is not None else None,
                overall_result=str(r[7]) if r[7] is not None else None,
                sgpi=float(r[8]) if r[8] is not None else None,
                cgpa=float(r[9]) if r[9] is not None else None,
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
