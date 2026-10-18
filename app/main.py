"""FastAPI application factory and entry point for EduQuery V3."""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import duckdb
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.dependencies import DatabaseUnavailableError
from app.api.router import api_v1_router
from app.api.routes.health import router as health_router
from app.api.schemas.common import ErrorResponse
from app.config import Settings, get_settings

logger = logging.getLogger("eduquery.api")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure a FastAPI application instance."""
    cfg = settings or get_settings()

    # Active dataset pointer recovery on startup / crash recovery
    active_db_path = cfg.database_path
    active_dataset_id: str | None = None
    pointer_path = Path(cfg.active_dataset_pointer_path).resolve()
    datasets_dir = (Path(cfg.data_dir).resolve() / "datasets").resolve()
    if pointer_path.is_file():
        try:
            pointer_data = json.loads(pointer_path.read_text(encoding="utf-8"))
            candidate_db = pointer_data.get("active_database_path")
            if candidate_db and Path(candidate_db).is_file():
                resolved_candidate = Path(candidate_db).resolve()
                if not resolved_candidate.is_relative_to(datasets_dir):
                    logger.warning(
                        "Active dataset pointer references path %s outside authorized datasets directory %s; ignoring pointer.",
                        resolved_candidate,
                        datasets_dir,
                    )
                else:
                    con = duckdb.connect(str(resolved_candidate), read_only=True)
                    tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
                    s_cnt = 0
                    if {"students", "courses"}.issubset(tables):
                        s_cnt = con.execute("SELECT COUNT(*) FROM students").fetchone()[0]
                    con.close()
                    if s_cnt > 0:
                        active_db_path = str(resolved_candidate)
                        active_dataset_id = pointer_data.get("active_dataset_id")
                        cfg.database_path = str(resolved_candidate)
                        logger.info(
                            "Active dataset recovered from pointer: %s -> %s (%d students)",
                            active_dataset_id,
                            active_db_path,
                            s_cnt,
                        )
                    else:
                        logger.warning(
                            "Candidate database %s contains 0 students or missing required tables; ignoring pointer.",
                            resolved_candidate,
                        )
        except Exception as exc:
            logger.warning("Failed to recover active dataset from pointer %s: %s", pointer_path, exc)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        # Startup logging without student PII
        logger.info(
            "Starting %s v%s (env: %s, database: %s, dataset_id: %s)",
            cfg.app_name,
            cfg.app_version,
            cfg.app_env,
            active_db_path,
            active_dataset_id,
        )
        # Prune any stale or expired temporary sessions
        try:
            from app.services.session_manager import cleanup_expired_sessions
            cleanup_expired_sessions(cfg)
        except Exception as exc:
            logger.warning("Session cleanup error on startup: %s", exc)
        yield
        logger.info("Shutting down %s", cfg.app_name)

    app = FastAPI(
        title=cfg.app_name,
        version=cfg.app_version,
        description="Deterministic academic marksheet analysis engine for college faculty.",
        lifespan=lifespan,
    )
    app.state.settings = cfg
    app.state.active_database_path = active_db_path
    app.state.active_dataset_id = active_dataset_id

    # CORS configuration
    cors_origins = cfg.cors_origins
    cors_regex = getattr(cfg, "cors_origin_regex", None)
    if cors_origins or cors_regex:
        has_wildcard = bool(cors_origins and "*" in cors_origins)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins or [],
            allow_origin_regex=cors_regex or None,
            allow_credentials=not has_wildcard,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Exception Handlers
    @app.exception_handler(DatabaseUnavailableError)
    async def database_unavailable_handler(
        request: Request, exc: DatabaseUnavailableError
    ) -> JSONResponse:
        logger.warning("Database unavailable error on %s %s: %s", request.method, request.url.path, exc.message)
        error_resp = ErrorResponse(
            status="error",
            error_code="DATABASE_UNAVAILABLE",
            message=exc.message,
            details=["Ensure database has been initialized with an ingested marksheet."],
        )
        return JSONResponse(status_code=503, content=error_resp.model_dump())

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "error_code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": [],
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in exc.errors()]
        error_resp = ErrorResponse(
            status="error",
            error_code="VALIDATION_ERROR",
            message="Request parameter validation failed.",
            details=details,
        )
        return JSONResponse(status_code=422, content=error_resp.model_dump())

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled server exception on %s %s", request.method, request.url.path, exc_info=True)
        error_resp = ErrorResponse(
            status="error",
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
            details=[],
        )
        return JSONResponse(status_code=500, content=error_resp.model_dump())

    # Register Routers
    app.include_router(health_router)
    app.include_router(api_v1_router, prefix=cfg.api_prefix)

    # Mount production frontend static assets and SPA fallback
    frontend_dist = Path(getattr(cfg, "frontend_dist_dir", "frontend/dist")).resolve()
    if frontend_dist.is_dir():
        assets_dir = frontend_dist / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa_app(full_path: str) -> FileResponse:
            # Never intercept API or health endpoints
            clean_path = full_path.lstrip("/")
            if (
                clean_path.startswith("api/")
                or clean_path.startswith("assets/")
                or clean_path in ("health", "livez", "readyz", "docs", "openapi.json", "redoc")
            ):
                raise StarletteHTTPException(status_code=404, detail="Not Found")

            # Check if static root file exists (e.g. favicon.svg, icons.svg)
            target = (frontend_dist / clean_path).resolve()
            if clean_path and target.is_file() and target.is_relative_to(frontend_dist):
                return FileResponse(target)

            index_html = frontend_dist / "index.html"
            if index_html.is_file():
                return FileResponse(index_html)
            raise StarletteHTTPException(status_code=404, detail="Frontend index.html not found")

    return app


# Application singleton for ASGI servers (e.g. uvicorn app.main:app)
app = create_app()
