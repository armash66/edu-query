"""Report generation and export route handlers."""
from __future__ import annotations

import io
from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
import duckdb

from app.api.dependencies import get_db
from app.services.export_service import (
    export_merit_list_excel,
    export_failed_absent_excel,
    export_mail_merge_csv,
    get_division_student_slips,
    export_analysis_dossier_pdf,
    export_student_slips_pdf,
)
from app.services.overview_service import get_overview_summary
from app.services.ai_service import generate_hod_brief

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/merit-list/export", response_model=None)
def export_merit_list_route(
    anonymize: Annotated[bool, Query(description="Mask student names with seat numbers")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Download verified, uncorrupted Excel workbook (.xlsx) of cohort merit list."""
    filename, excel_bytes = export_merit_list_excel(con, anonymize=anonymize)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/backlogs/export", response_model=None)
def export_backlogs_route(
    anonymize: Annotated[bool, Query(description="Mask student names with seat numbers")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Download verified, uncorrupted Excel workbook (.xlsx) of failed and absent students."""
    filename, excel_bytes = export_failed_absent_excel(con, anonymize=anonymize)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/mail-merge/export", response_model=None)
def export_mail_merge_route(
    anonymize: Annotated[bool, Query(description="Mask student names with seat numbers")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Download RFC 4180 CSV with UTF-8 BOM for student notice mail-merge."""
    filename, csv_bytes = export_mail_merge_csv(con, anonymize=anonymize)
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/slips", response_model=None)
def get_student_slips_route(
    division: Annotated[str | None, Query(description="Filter by division code ('A', 'B', etc.) or omit for all")] = None,
    anonymize: Annotated[bool, Query(description="Mask student names")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> JSONResponse:
    """Retrieve complete subject breakdowns for printable student result slips."""
    slips = get_division_student_slips(con, division=division, anonymize=anonymize)
    return JSONResponse(content={"slips": slips, "total": len(slips)})


@router.get("/analysis-dossier/export", response_model=None)
def export_analysis_dossier_route(
    anonymize: Annotated[bool, Query(description="Mask student names")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Download verified academic result analysis dossier as a clean, genuine PDF document."""
    filename, pdf_bytes = export_analysis_dossier_pdf(con, anonymize=anonymize)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/slips/export-pdf", response_model=None)
def export_student_slips_pdf_route(
    division: Annotated[str | None, Query(description="Filter by division ('A', 'B') or omit for all")] = None,
    anonymize: Annotated[bool, Query(description="Mask student names")] = False,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Download official multi-page printable student result slips as a verified PDF."""
    filename, pdf_bytes = export_student_slips_pdf(con, division=division, anonymize=anonymize)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
