"""Subject catalog and failure analytics route handlers."""
from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.common import (
    AmbiguousCourseResponse,
    NotFoundErrorResponse,
    PaginatedResponse,
)
from app.api.schemas.subject import (
    CourseItem,
    SubjectFailureResponse,
    SubjectFailureSummaryResponse,
    SubjectStudentsResponse,
)
from app.services.export_service import (
    export_subject_failures_csv,
    export_subject_students_excel,
)
from app.services.subject_service import (
    get_course_failures_service,
    get_course_students_service,
    get_failure_summary_service,
    list_courses,
)

router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.get("", response_model=PaginatedResponse[CourseItem])
def get_subjects(
    kind: Annotated[str | None, Query(description="Filter by course modality ('theory' or 'practical')")] = None,
    division: Annotated[str | None, Query(description="Filter courses taken by division")] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit (1-100)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> PaginatedResponse[CourseItem]:
    """Retrieve catalog courses with enrolled student headcounts."""
    return list_courses(
        con=con,
        kind=kind,
        division=division,
        limit=limit,
        offset=offset,
    )


# Note: Declared BEFORE /{course_code}/failures to adhere to standard routing hygiene
@router.get("/failure-summary", response_model=SubjectFailureSummaryResponse)
def get_failure_summary(
    division: Annotated[str | None, Query(description="Filter summary by division")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> SubjectFailureSummaryResponse:
    """Retrieve curriculum-wide failure rates sorted by failure count descending."""
    return get_failure_summary_service(con=con, division=division)


@router.get(
    "/{course_code}/failures",
    response_model=SubjectFailureResponse,
    responses={
        404: {"model": NotFoundErrorResponse, "description": "Course not found"},
        409: {"model": AmbiguousCourseResponse, "description": "Query matches multiple courses"},
    },
)
def get_course_failures(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Page limit (1-100)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> SubjectFailureResponse | JSONResponse:
    """Retrieve confirmed failure roster for a course with atomized component marks."""
    status_code, payload = get_course_failures_service(
        con=con,
        course_code=course_code,
        division=division,
        limit=limit,
        offset=offset,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=payload.model_dump())
    return payload  # type: ignore[return-value]


@router.get("/{course_code}/failures/export", response_model=None)
def export_course_failures_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export confirmed subject failures roster as CSV with formula injection protection."""
    status_code, filename, content = export_subject_failures_csv(
        con=con,
        course_code=course_code,
        division=division,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{course_code}/students",
    response_model=SubjectStudentsResponse,
    responses={
        404: {"model": NotFoundErrorResponse, "description": "Course not found"},
        409: {"model": AmbiguousCourseResponse, "description": "Query matches multiple courses"},
    },
)
def get_course_students_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    result: Annotated[
        str | None,
        Query(description="Filter roster by status: 'passed', 'failed', 'absent', 'unresolved'"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Page limit (1-200)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> SubjectStudentsResponse | JSONResponse:
    """Retrieve unified course student roster showing passed, failed, and absent students together."""
    status_code, payload = get_course_students_service(
        con=con,
        course_code=course_code,
        division=division,
        result_filter=result,
        limit=limit,
        offset=offset,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=payload.model_dump())
    return payload  # type: ignore[return-value]


@router.get("/{course_code}/export-excel", response_model=None)
def export_course_students_excel_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    report_type: Annotated[str, Query(description="Report type: 'all', 'passed', or 'failed'")] = "all",
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export subject student roster as real Excel workbook (.xlsx)."""
    status_code, filename, content = export_subject_students_excel(
        con=con,
        course_code=course_code,
        division=division,
        report_type=report_type,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


