"""Data quality audit route handler."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.data_quality import DataQualityResponse
from app.services.data_quality_service import get_data_quality_service

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


class DataQualityReviewRequest(BaseModel):
    check_id: str = Field(description="Check identifier or finding ID")
    status: str = Field(description="'confirmed' or 'flagged'")
    note: str | None = Field(default=None, description="Optional reviewer commentary")
    reviewer_name: str | None = Field(default="Faculty Reviewer", description="Name of faculty reviewer")


@router.get("", response_model=DataQualityResponse)
def get_data_quality_route(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> DataQualityResponse:
    """Retrieve full marksheet data quality findings and integrity score."""
    return get_data_quality_service(con=con)


@router.post("/review")
def record_quality_review_route(
    req: DataQualityReviewRequest,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
):
    """Record faculty verification sign-off or confirmation for a data quality finding."""
    from app.services.anomaly_detection import _get_dataset_id_from_con, review_anomaly_finding
    from app.services.overview_service import clear_overview_cache

    dataset_id = _get_dataset_id_from_con(con)
    reviewed = (req.status.lower() in ("confirmed", "reviewed", "ok"))
    res = review_anomaly_finding(
        finding_id=req.check_id,
        reviewed=reviewed,
        reviewer_name=req.reviewer_name,
        notes=req.note,
        dataset_id=dataset_id,
    )
    clear_overview_cache(dataset_id)
    return {"status": "success", "check_id": req.check_id, "reviewed": reviewed}
