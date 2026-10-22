"""Aggregated API router for EduQuery V3 under /api/v1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.analytics import router as analytics_router
from app.api.routes.anomaly import router as anomaly_router
from app.api.routes.data_quality import router as data_quality_router
from app.api.routes.imports import router as imports_router
from app.api.routes.investigation import router as investigation_router
from app.api.routes.session import router as session_router
from app.api.routes.students import (
    export_absent_students_excel_route,
    get_absent_students_route,
    router as students_router,
)
from app.api.routes.subjects import router as subjects_router

api_v1_router = APIRouter()

api_v1_router.include_router(session_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(investigation_router)
api_v1_router.include_router(anomaly_router)
api_v1_router.include_router(students_router)
api_v1_router.include_router(subjects_router)
api_v1_router.include_router(data_quality_router)
api_v1_router.include_router(imports_router)

# Aliases for absent-students convenience
api_v1_router.add_api_route("/absent-students/export", export_absent_students_excel_route, methods=["GET"], tags=["students"])
api_v1_router.add_api_route("/absent-students/export-excel", export_absent_students_excel_route, methods=["GET"], tags=["students"])
api_v1_router.add_api_route("/absent-students", get_absent_students_route, methods=["GET"], tags=["students"])



