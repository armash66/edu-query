"""API route handler for additive Overview summary endpoint."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, Request
import duckdb

from app.api.dependencies import get_db
from app.api.schemas.overview import OverviewSummaryResponse
from app.config import get_settings
from app.services.overview_service import get_overview_summary

router = APIRouter(prefix="/overview", tags=["Overview"])


@router.get("/summary", response_model=OverviewSummaryResponse)
def get_overview_summary_endpoint(
    request: Request,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> OverviewSummaryResponse:
    """Retrieve unified overview metrics, KPIs, results, SGPI distribution, hardest subjects, and highlights."""
    settings = getattr(request.app.state, "settings", None) or get_settings()

    # Determine if temporary session and remaining minutes
    dataset_name_hint = None
    is_temporary_hint = False
    expires_in_minutes_hint = None

    session_token = request.headers.get("X-EduQuery-Session-Token") or request.cookies.get("eduquery_session")
    if session_token and session_token.strip():
        token = session_token.strip()
        sessions_root = Path(
            getattr(settings, "temporary_sessions_dir", None) or (Path(settings.data_dir).resolve() / "sessions")
        ).resolve()
        session_dir = sessions_root / token
        meta_file = session_dir / "meta.json"
        if meta_file.is_file():
            is_temporary_hint = True
            try:
                import json
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                dataset_name_hint = meta.get("filename") or meta.get("dataset_name")
                exp = meta.get("expires_at")
                if exp:
                    exp_dt = datetime.fromisoformat(exp)
                    now_dt = datetime.now(timezone.utc)
                    remaining = int((exp_dt - now_dt).total_seconds() / 60)
                    expires_in_minutes_hint = max(1, remaining)
            except Exception:
                pass

    if not dataset_name_hint:
        # Check active pointer in data_dir
        ptr_file = Path(settings.data_dir).resolve() / "active_dataset.json"
        if ptr_file.is_file():
            try:
                import json
                ptr = json.loads(ptr_file.read_text(encoding="utf-8"))
                dataset_name_hint = ptr.get("dataset_name") or ptr.get("filename")
            except Exception:
                pass

    return get_overview_summary(
        con,
        dataset_name_hint=dataset_name_hint,
        is_temporary_hint=is_temporary_hint,
        expires_in_minutes_hint=expires_in_minutes_hint,
    )

