"""Student roster and breakdown route handlers."""
from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.common import (
    AmbiguousStudentResponse,
    NotFoundErrorResponse,
    PaginatedResponse,
)
from app.api.schemas.student import (
    EarlyWarningResponse,
    AbsentStudentItem,
    StudentBreakdownResponse,
    StudentSummaryItem,
    SubjectToppersResponse,
)
from app.services.export_service import (
    export_absent_students_excel,
    export_student_breakdown_csv,
    export_student_breakdown_excel,
    export_students_roster_csv,
    export_students_roster_excel,
)
from app.services.student_service import (
    get_early_warning_students,
    get_subject_toppers,
    get_student_breakdown_service,
    list_absent_components,
    list_absent_students,
    list_students,
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=PaginatedResponse[StudentSummaryItem])
def get_students(
    query: Annotated[str | None, Query(description="Case-insensitive student search filter")] = None,
    division: Annotated[str | None, Query(description="Filter by class division")] = None,
    result: Annotated[str | None, Query(description="Filter by overall outcome")] = None,
    course_code: Annotated[str | None, Query(description="Filter by course enrollment")] = None,
    multi_fails: Annotated[bool | None, Query(description="Filter students failing 2 or more courses")] = None,
    has_absences: Annotated[bool | None, Query(description="Filter students with at least 1 absent mark")] = None,
    level: Annotated[str | None, Query(description="Filter students by level ('UG' or 'DSY')")] = None,
    sort_by: Annotated[str | None, Query(description="Sort order ('merit' for toppers rank or None for default)")] = None,
    limit: Annotated[int, Query(ge=1, le=1000, description="Page limit (1-1000)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> PaginatedResponse[StudentSummaryItem]:
    """Retrieve paginated student roster with optional filtering."""
    return list_students(
        con=con,
        query=query,
        division=division,
        result=result,
        course_code=course_code,
        multi_fails=multi_fails,
        has_absences=has_absences,
        level=level,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )


@router.get("/export/xlsx", response_model=None)
@router.get("/export-excel", response_model=None)
def export_students_excel_route(
    query: Annotated[str | None, Query(description="Case-insensitive student search filter")] = None,
    division: Annotated[str | None, Query(description="Filter by class division")] = None,
    result: Annotated[str | None, Query(description="Filter by overall outcome")] = None,
    course_code: Annotated[str | None, Query(description="Filter by course enrollment")] = None,
    multi_fails: Annotated[bool | None, Query(description="Filter students failing 2 or more courses")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Export complete filtered student roster as real Excel workbook (.xlsx)."""
    filename, excel_bytes = export_students_roster_excel(
        con=con,
        query=query,
        division=division,
        result=result,
        course_code=course_code,
        multi_fails=multi_fails,
    )
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export", response_model=None)
def export_students_route(
    query: Annotated[str | None, Query(description="Case-insensitive student search filter")] = None,
    division: Annotated[str | None, Query(description="Filter by class division")] = None,
    result: Annotated[str | None, Query(description="Filter by overall outcome")] = None,
    course_code: Annotated[str | None, Query(description="Filter by course enrollment")] = None,
    multi_fails: Annotated[bool | None, Query(description="Filter students failing 2 or more courses")] = None,
    format: Annotated[str | None, Query(description="Export format: 'csv' or 'xlsx'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Export complete filtered student roster as CSV or Excel with formula injection protection."""
    if format and format.strip().lower() in ("xlsx", "excel"):
        return export_students_excel_route(
            query=query,
            division=division,
            result=result,
            course_code=course_code,
            multi_fails=multi_fails,
            con=con,
        )
    filename, csv_text = export_students_roster_csv(
        con=con,
        query=query,
        division=division,
        result=result,
        course_code=course_code,
        multi_fails=multi_fails,
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/absent", response_model=PaginatedResponse[AbsentStudentItem])
def get_absent_students_route(
    division: Annotated[str | None, Query(description="Filter by division")] = None,
    course_code: Annotated[str | None, Query(description="Filter by subject / course code")] = None,
    component: Annotated[str | None, Query(description="Filter by absent component (e.g. ESE, MSE, ISA)")] = None,
    query: Annotated[str | None, Query(description="Search by student name, roll no, or seat no")] = None,
    limit: Annotated[int, Query(ge=1, le=1000, description="Page limit (1-1000)")] = 50,
    offset: Annotated[int, Query(ge=0, description="Page offset")] = 0,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> PaginatedResponse[AbsentStudentItem]:
    """Retrieve verified absent student examination component records."""
    return list_absent_students(
        con=con,
        division=division,
        course_code=course_code,
        component=component,
        query=query,
        limit=limit,
        offset=offset,
    )


@router.get("/absent/export/xlsx", response_model=None)
@router.get("/absent/export-excel", response_model=None)
@router.get("/absent/export", response_model=None)
def export_absent_students_excel_route(
    division: Annotated[str | None, Query(description="Filter by division")] = None,
    course_code: Annotated[str | None, Query(description="Filter by subject / course code")] = None,
    component: Annotated[str | None, Query(description="Filter by absent component")] = None,
    query: Annotated[str | None, Query(description="Search by student name, roll no, or seat no")] = None,
    format: Annotated[str | None, Query(description="Export format")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Export verified absent student examination records as real Excel workbook (.xlsx)."""
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


@router.get("/absent/components", response_model=list[str])
def get_absent_components_route(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> list[str]:
    """Retrieve distinct examination components containing verified absent marks."""
    return list_absent_components(con=con)


@router.get("/early-warning", response_model=EarlyWarningResponse, summary="Get pre-ESE at-risk early warning roster")
def get_early_warning_route(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> EarlyWarningResponse:
    """Identify students likely to struggle based on continuous internal evaluation marks."""
    return get_early_warning_students(con=con)


@router.get("/subject-toppers", response_model=SubjectToppersResponse, summary="Get division-wise highest scorers for each subject")
def get_subject_toppers_route(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> SubjectToppersResponse:
    """Retrieve top-scoring students in each subject for each division cohort."""
    items = get_subject_toppers(con=con)
    return SubjectToppersResponse(total=len(items), items=items)


@router.get(
    "/{identifier}/breakdown",
    response_model=StudentBreakdownResponse,
    responses={
        404: {"model": NotFoundErrorResponse, "description": "Student not found"},
        409: {"model": AmbiguousStudentResponse, "description": "Query matches multiple students"},
    },
)
def get_student_breakdown_route(
    identifier: str,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> StudentBreakdownResponse | JSONResponse:
    """Retrieve comprehensive subject breakdown for a resolved student."""
    status_code, payload = get_student_breakdown_service(con=con, identifier=identifier)
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=payload.model_dump())
    return payload  # type: ignore[return-value]


@router.get("/{identifier}/export", response_model=None)
def export_student_breakdown_route(
    identifier: str,
    format: Annotated[str | None, Query(description="Export format: 'csv' or 'xlsx'")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export full student subject breakdown report as CSV or Excel with formula injection protection."""
    if format and format.strip().lower() in ("xlsx", "excel"):
        return export_student_breakdown_excel_route(identifier=identifier, con=con)
    status_code, filename, content = export_student_breakdown_csv(con=con, identifier=identifier)
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{identifier}/export-excel", response_model=None)
def export_student_breakdown_excel_route(
    identifier: str,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response | JSONResponse:
    """Export full student subject breakdown report as real Excel workbook (.xlsx)."""
    status_code, filename, content = export_student_breakdown_excel(con=con, identifier=identifier)
    if status_code != 200:
        return JSONResponse(status_code=status_code, content=content)
    return Response(
        content=content,  # type: ignore[arg-type]
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


