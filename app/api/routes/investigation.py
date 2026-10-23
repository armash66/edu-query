"""FastAPI routes for the interactive academic investigation engine."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.dependencies import get_db
from app.api.schemas.investigation import (
    InvestigationCapabilitiesResponse,
    InvestigationQueryRequest,
    InvestigationQueryResponse,
)
from app.services.investigation_service import (
    execute_investigation_query,
    export_investigation_csv,
    export_investigation_excel_service,
    get_investigation_capabilities,
)

router = APIRouter(prefix="/investigation", tags=["Investigation Engine"])


@router.get(
    "/capabilities",
    response_model=InvestigationCapabilitiesResponse,
    summary="Get supported investigation fields, operators, and dataset options",
)
def get_capabilities(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> InvestigationCapabilitiesResponse:
    """Retrieve the capability registry of allowed fields, operators, and dataset dimensions."""
    return get_investigation_capabilities(con)


@router.post(
    "/query",
    response_model=InvestigationQueryResponse,
    summary="Execute multi-condition investigation query with live count and pagination",
)
def run_investigation_query(
    req: InvestigationQueryRequest,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> InvestigationQueryResponse:
    """Execute a validated, parameterized investigation query across student mark records."""
    return execute_investigation_query(con, req)


@router.post(
    "/export-excel",
    summary="Download unpaginated Excel .xlsx export of matching investigation records",
)
@router.post(
    "/export/xlsx",
    summary="Download unpaginated Excel .xlsx export of matching investigation records (alias)",
)
def download_investigation_excel(
    req: InvestigationQueryRequest,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Export the complete unpaginated matching investigation cohort to an Excel workbook (.xlsx)."""
    filename, excel_bytes = export_investigation_excel_service(con, req)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


@router.post(
    "/export-csv",
    summary="Download unpaginated formula-safe CSV export of matching investigation records",
)
def download_investigation_csv(
    req: InvestigationQueryRequest,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> Response:
    """Export the complete unpaginated matching investigation cohort to formula-safe CSV."""
    filename, csv_content = export_investigation_csv(con, req)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )

