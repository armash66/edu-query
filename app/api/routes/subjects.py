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
    export_absent_students_excel,
    export_subject_failures_csv,
    export_subject_students_csv,
    export_subject_students_excel,
    export_subject_students_pdf,
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
    format: Annotated[str | None, Query(description="Export format: 'csv' or 'xlsx'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export confirmed subject failures roster as CSV or Excel with formula injection protection."""
    if format and format.strip().lower() in ("xlsx", "excel"):
        return export_course_students_excel_route(
            course_code=course_code,
            division=division,
            report_type="failed",
            con=con,
        )
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
    status: Annotated[
        str | None,
        Query(description="Filter roster by status alias: 'passed', 'failed', 'absent', 'unresolved'"),
    ] = None,
    search: Annotated[
        str | None,
        Query(description="Search by student name, roll no, or seat no"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Page limit (1-200)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> SubjectStudentsResponse | JSONResponse:
    """Retrieve unified course student roster showing passed, failed, and absent students together."""
    effective_result = (status or result or None)
    if effective_result and effective_result.strip().lower() == "all":
        effective_result = None
    status_code, payload = get_course_students_service(
        con=con,
        course_code=course_code,
        division=division,
        result_filter=effective_result,
        search=search,
        limit=limit,
        offset=offset,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=payload.model_dump())
    return payload  # type: ignore[return-value]


@router.get("/{course_code}/export/pdf", response_model=None, include_in_schema=False)
@router.get("/{course_code}/export-pdf", response_model=None)
def export_course_students_pdf_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    report_type: Annotated[str | None, Query(description="Report type: 'all', 'passed', 'failed', or 'absent'")] = None,
    category: Annotated[str | None, Query(description="Category alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    status: Annotated[str | None, Query(description="Status alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export subject student roster as official printable PDF marksheet."""
    effective_type = (category or status or report_type or "all").strip().lower()
    status_code, filename, content = export_subject_students_pdf(
        con=con,
        course_code=course_code,
        division=division,
        report_type=effective_type,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{course_code}/export/csv", response_model=None, include_in_schema=False)
@router.get("/{course_code}/export-csv", response_model=None)
def export_course_students_csv_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    report_type: Annotated[str | None, Query(description="Report type: 'all', 'passed', 'failed', or 'absent'")] = None,
    category: Annotated[str | None, Query(description="Category alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    status: Annotated[str | None, Query(description="Status alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export subject student roster as formula-safe UTF-8 CSV."""
    effective_type = (category or status or report_type or "all").strip().lower()
    status_code, filename, content = export_subject_students_csv(
        con=con,
        course_code=course_code,
        division=division,
        report_type=effective_type,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{course_code}/export/xlsx", response_model=None, include_in_schema=False)
@router.get("/{course_code}/export", response_model=None, include_in_schema=False)
@router.get("/{course_code}/export-excel", response_model=None)
def export_course_students_excel_route(
    course_code: str,
    division: Annotated[str | None, Query(description="Filter roster by division")] = None,
    report_type: Annotated[str | None, Query(description="Report type: 'all', 'passed', 'failed', or 'absent'")] = None,
    category: Annotated[str | None, Query(description="Category alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    status: Annotated[str | None, Query(description="Status alias: 'all', 'passed', 'failed', or 'absent'")] = None,
    format: Annotated[str | None, Query(description="Export format: 'xlsx', 'pdf', 'csv'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export subject student roster as real Excel workbook (.xlsx), PDF (.pdf), or CSV (.csv)."""
    if format and format.strip().lower() == "pdf":
        return export_course_students_pdf_route(
            course_code=course_code,
            division=division,
            report_type=report_type,
            category=category,
            status=status,
            con=con,
        )
    if format and format.strip().lower() == "csv":
        return export_course_students_csv_route(
            course_code=course_code,
            division=division,
            report_type=report_type,
            category=category,
            status=status,
            con=con,
        )
    effective_type = (category or status or report_type or "all").strip().lower()
    status_code, filename, content = export_subject_students_excel(
        con=con,
        course_code=course_code,
        division=division,
        report_type=effective_type,
    )
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



@router.get("/absent/export/xlsx", response_model=None)
@router.get("/absent/export", response_model=None)
def export_absent_subjects_excel_route(
    division: str | None = None,
    course_code: str | None = None,
    component: str | None = None,
    query: str | None = None,
    con = Depends(get_db),
):
    filename, excel_bytes = export_absent_students_excel(
        con=con,
        division=division,
        course_code=course_code,
        component=component,
        query=query,
    )
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
