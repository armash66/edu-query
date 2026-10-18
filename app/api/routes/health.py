"""Health and liveness inspection route."""
from __future__ import annotations

from collections.abc import Generator
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
import duckdb

from app.api.dependencies import DatabaseUnavailableError, get_db
from app.api.schemas.health import DatabaseHealthInfo, HealthResponse
from app.config import get_settings

router = APIRouter(tags=["Health"])


def get_optional_db(request: Request) -> Generator[duckdb.DuckDBPyConnection | None, None, None]:
    """Provide a database connection if available, or None if unavailable/missing."""
    if get_db in request.app.dependency_overrides:
        override = request.app.dependency_overrides[get_db]
        res = override()
        if hasattr(res, "__iter__") and not hasattr(res, "execute"):
            yield from res
        else:
            yield res
        return

    try:
        yield from get_db(request)
    except DatabaseUnavailableError:
        yield None


@router.get("/health", response_model=HealthResponse)
def health_check(
    request: Request,
    con: duckdb.DuckDBPyConnection | None = Depends(get_optional_db),
) -> HealthResponse | JSONResponse:
    """Inspect application and database health without fabricating metrics."""
    settings = getattr(request.app.state, "settings", None) or get_settings()
    mode = "in_memory" if settings.is_in_memory else "read_only_file"

    if con is None:
        unhealthy_resp = HealthResponse(
            status="unhealthy",
            version=settings.app_version,
            database=DatabaseHealthInfo(
                mode=mode,
                connected=False,
                students_count=None,
                courses_count=None,
            ),
        )
        return JSONResponse(status_code=503, content=unhealthy_resp.model_dump())

    # Check if database has been initialized with schema tables
    try:
        tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
        if "students" not in tables or "courses" not in tables:
            unhealthy_resp = HealthResponse(
                status="unhealthy",
                version=settings.app_version,
                database=DatabaseHealthInfo(
                    mode=mode,
                    connected=False,
                    students_count=None,
                    courses_count=None,
                ),
            )
            return JSONResponse(status_code=503, content=unhealthy_resp.model_dump())

        s_row = con.execute("SELECT COUNT(*) FROM students").fetchone()
        c_row = con.execute("SELECT COUNT(*) FROM courses").fetchone()
        students_count = int(s_row[0]) if s_row else 0
        courses_count = int(c_row[0]) if c_row else 0

        active_dataset_id = getattr(request.app.state, "active_dataset_id", None)
        activated_at = None
        pointer_path = getattr(settings, "active_dataset_pointer_path", None)
        if pointer_path:
            import json
            from pathlib import Path
            p_file = Path(pointer_path).resolve()
            if p_file.is_file():
                try:
                    p_data = json.loads(p_file.read_text(encoding="utf-8"))
                    active_dataset_id = active_dataset_id or p_data.get("active_dataset_id")
                    activated_at = p_data.get("activated_at")
                except Exception:
                    pass

        return HealthResponse(
            status="healthy",
            version=settings.app_version,
            database=DatabaseHealthInfo(
                mode=mode,
                connected=True,
                students_count=students_count,
                courses_count=courses_count,
                active_dataset_id=active_dataset_id,
                activated_at=activated_at,
            ),
        )
    except Exception:
        unhealthy_resp = HealthResponse(
            status="unhealthy",
            version=settings.app_version,
            database=DatabaseHealthInfo(
                mode=mode,
                connected=False,
                students_count=None,
                courses_count=None,
            ),
        )
        return JSONResponse(status_code=503, content=unhealthy_resp.model_dump())


@router.get("/livez", summary="Liveness probe for container orchestration")
def liveness(request: Request) -> JSONResponse:
    """Liveness probe: returns 200 if the web process is running."""
    settings = getattr(request.app.state, "settings", None) or get_settings()
    return JSONResponse(status_code=200, content={"status": "alive", "version": settings.app_version})


@router.get("/readyz", summary="Readiness probe for container orchestration")
def readiness(
    request: Request,
    con: duckdb.DuckDBPyConnection | None = Depends(get_optional_db),
) -> JSONResponse:
    """Readiness probe: returns 200 if database is initialized and serving queries, else 503."""
    settings = getattr(request.app.state, "settings", None) or get_settings()
    if con is None:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "Database connection unavailable or uninitialized"},
        )
    try:
        tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
        if not {"students", "courses"}.issubset(tables):
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "reason": "Required tables (students, courses) missing"},
            )
        return JSONResponse(
            status_code=200,
            content={"status": "ready", "version": settings.app_version},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": str(exc)},
        )

