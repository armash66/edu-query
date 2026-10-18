"""Academic analysis workspace route handlers."""
from __future__ import annotations

from typing import Annotated
from fastapi import APIRouter, Depends, Query
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.analytics import (
    AnalysisRegistryResponse,
    AnalyticsOverviewResponse,
    DistributionsResponse,
    DivisionComparisonResponse,
    FailurePatternsResponse,
)
from app.services.analytics_service import (
    get_analysis_registry,
    get_analytics_overview,
    get_distributions,
    get_division_comparison,
    get_failure_patterns,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_overview_endpoint(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> AnalyticsOverviewResponse:
    """Retrieve executive academic overview metrics, outcome distributions, and key findings."""
    return get_analytics_overview(con)


@router.get("/division-comparison", response_model=DivisionComparisonResponse)
def get_division_comparison_endpoint(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> DivisionComparisonResponse:
    """Retrieve comparative performance metrics and subject failure breakdown across divisions."""
    return get_division_comparison(con)


@router.get("/failure-patterns", response_model=FailurePatternsResponse)
def get_failure_patterns_endpoint(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> FailurePatternsResponse:
    """Retrieve multi-subject failure diagnostics, co-failing course pairs, and student rosters."""
    return get_failure_patterns(con)


@router.get("/distributions", response_model=DistributionsResponse)
def get_distributions_endpoint(
    course_code: Annotated[str | None, Query(description="Filter by specific course code")] = None,
    division: Annotated[str | None, Query(description="Filter by class division")] = None,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> DistributionsResponse:
    """Retrieve binned score histograms and grade frequencies."""
    return get_distributions(con, course_code=course_code, division=division)


@router.get("/registry", response_model=AnalysisRegistryResponse)
def get_registry_endpoint() -> AnalysisRegistryResponse:
    """Retrieve metadata registry of supported analytical capabilities."""
    return get_analysis_registry()
