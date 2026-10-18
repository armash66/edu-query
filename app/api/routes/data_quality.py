"""Data quality audit route handler."""
from __future__ import annotations

from fastapi import APIRouter, Depends
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.data_quality import DataQualityResponse
from app.services.data_quality_service import get_data_quality_service

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


@router.get("", response_model=DataQualityResponse)
def get_data_quality_route(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> DataQualityResponse:
    """Retrieve full marksheet data quality findings and integrity score."""
    return get_data_quality_service(con=con)
