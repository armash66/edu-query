"""API routes for privacy-first temporary analysis session lifecycle."""
from __future__ import annotations

from typing import Annotated, Any
from fastapi import APIRouter, Cookie, File, Header, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.services.session_manager import (
    confirm_temporary_session,
    create_sample_session,
    create_temporary_session,
    delete_temporary_session,
    get_session_status,
    save_session_to_permanent,
    validate_session_token,
)

router = APIRouter(prefix="/session", tags=["Analysis Session"])

COOKIE_NAME = "eduquery_session"


class SessionConfirmRequest(BaseModel):
    session_id: str | None = None


class SessionSaveRequest(BaseModel):
    dataset_name: str | None = None


def is_request_secure(request: Request, settings: Settings) -> bool:
    """Determine if cookie should have secure attribute based on HTTPS scheme or proxy header."""
    if not settings.is_production:
        return False
    forwarded = request.headers.get("x-forwarded-proto", "").lower()
    return request.url.scheme == "https" or forwarded == "https"


def resolve_session_id(
    request: Request,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> str | None:
    """Resolve session ID strictly from header or secure cookie (never from query strings)."""
    token = x_eduquery_session_token or eduquery_session
    if not token and hasattr(request, "cookies"):
        token = request.cookies.get(COOKIE_NAME)
    return token.strip() if token else None


@router.post("/upload", summary="Upload marksheet into an isolated temporary analysis session")
async def upload_temporary_marksheet(
    request: Request,
    response: Response,
    file: Annotated[UploadFile, File(description="Excel marksheet file (.xlsx)")],
) -> dict[str, Any]:
    """Upload marksheet workbook into a temporary session without requiring an admin key."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id, meta = await create_temporary_session(upload_file=file, settings=settings)

    # Set secure session cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=is_request_secure(request, settings),
        max_age=settings.import_session_ttl_seconds,
        path="/",
    )
    response.headers["X-EduQuery-Session-Token"] = session_id

    return {
        "status": "success",
        "session_id": session_id,
        "mode": "temporary",
        "state": meta["state"],
        "filename": meta["filename"],
        "students_count": meta["students_count"],
        "courses_count": meta["courses_count"],
        "can_confirm": meta["can_confirm"],
        "blocking_errors": meta["blocking_errors"],
        "preview": meta["preview"],
    }




@router.post("/sample", summary="Load anonymized sample dataset for instant analysis exploration")
def load_sample_session_route(
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Load bundled anonymized sample marksheet (Result_anonymized.xlsx) into an isolated session."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id, meta = create_sample_session(settings=settings)

    response.set_cookie(
        key=COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=is_request_secure(request, settings),
        max_age=settings.import_session_ttl_seconds,
        path="/",
    )
    response.headers["X-EduQuery-Session-Token"] = session_id
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

    return {
        "status": "success",
        "session_id": session_id,
        "mode": "temporary",
        "state": meta["state"],
        "filename": meta["filename"],
        "students_count": meta["students_count"],
        "courses_count": meta["courses_count"],
        "can_confirm": meta["can_confirm"],
        "blocking_errors": meta["blocking_errors"],
        "preview": meta["preview"],
    }

@router.post("/confirm", summary="Confirm preview and activate the temporary session for analysis")
def confirm_session(
    request: Request,
    response: Response,
    payload: SessionConfirmRequest | None = None,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> dict[str, Any]:
    """Activate the session after reviewing the detected layout preview."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id = (payload and payload.session_id) or resolve_session_id(
        request, eduquery_session, x_eduquery_session_token
    )
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "error", "message": "Missing session identifier to confirm."},
        )

    clean_id = validate_session_token(session_id)
    meta = confirm_temporary_session(session_id=clean_id, settings=settings)

    # Refresh cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=clean_id,
        httponly=True,
        samesite="lax",
        secure=is_request_secure(request, settings),
        max_age=settings.import_session_ttl_seconds,
        path="/",
    )
    response.headers["X-EduQuery-Session-Token"] = clean_id

    return {
        "status": "active",
        "session_id": clean_id,
        "mode": "temporary",
        "students_count": meta["students_count"],
        "courses_count": meta["courses_count"],
        "activated_at": meta.get("activated_at"),
        "message": "Temporary analysis session is active and ready for exploration.",
    }


@router.get("/status", summary="Check current active session or permanent dataset status")
def check_session_status(
    request: Request,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> dict[str, Any]:
    """Inspect whether the user has an active session or the server has an active persistent dataset."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id = resolve_session_id(request, eduquery_session, x_eduquery_session_token)

    if session_id:
        status_data = get_session_status(session_id=session_id, settings=settings)
        if status_data.get("active") or status_data.get("state") == "preview_ready":
            return status_data

    # Check if an institutional dataset has been explicitly activated on the server
    pointer_path = getattr(settings, "active_dataset_pointer_path", None)
    if pointer_path:
        from pathlib import Path
        import json
        p_file = Path(pointer_path).resolve()
        datasets_dir = (Path(settings.data_dir).resolve() / "datasets").resolve()
        if p_file.is_file():
            try:
                p_data = json.loads(p_file.read_text(encoding="utf-8"))
                target_db = p_data.get("active_database_path")
                active_id = p_data.get("active_dataset_id")
                if target_db and active_id:
                    resolved_target = Path(target_db).resolve()
                    if resolved_target.is_file() and resolved_target.is_relative_to(datasets_dir):
                        return {
                            "active": True,
                            "mode": "persistent",
                            "session_id": active_id,
                            "filename": p_data.get("filename", "Institutional Dataset"),
                            "students_count": p_data.get("students_count"),
                            "courses_count": p_data.get("courses_count"),
                        }
            except Exception:
                pass

    return {"active": False, "mode": None}


@router.delete("", summary="Permanently delete current temporary session and all server-side records")
@router.post("/delete", summary="Permanently delete current temporary session (POST fallback)")
def delete_session(
    request: Request,
    response: Response,
    payload: SessionConfirmRequest | None = None,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> dict[str, Any]:
    """Erase temporary session workspace, uncompressed files, DuckDB database, and reviews."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id = (payload and payload.session_id) or resolve_session_id(
        request, eduquery_session, x_eduquery_session_token
    )

    if session_id:
        delete_temporary_session(session_id=session_id, settings=settings)

    # Invalidate cookie
    response.delete_cookie(key=COOKIE_NAME, path="/")
    response.headers["X-EduQuery-Session-Deleted"] = "true"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

    return {
        "status": "deleted",
        "message": "Temporary analysis session and all associated records have been permanently erased.",
    }


@router.post("/save", summary="Explicit opt-in to save current temporary dataset to institutional storage")
def save_session(
    request: Request,
    payload: SessionSaveRequest | None = None,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> dict[str, Any]:
    """Promote the active temporary session to persistent storage upon explicit faculty opt-in."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_id = resolve_session_id(request, eduquery_session, x_eduquery_session_token)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "error", "message": "No active temporary session to save."},
        )

    clean_id = validate_session_token(session_id)
    saved_info = save_session_to_permanent(
        session_id=clean_id,
        settings=settings,
        dataset_name=payload.dataset_name if payload else None,
    )

    # Update app runtime state so the saved dataset is immediately active server-wide
    request.app.state.active_database_path = saved_info["database_path"]
    request.app.state.active_dataset_id = saved_info["dataset_id"]

    return saved_info


class DownloadTicketRequest(BaseModel):
    resource_id: str | None = None


@router.post("/download-ticket", summary="Generate a single-use short-lived ticket for direct file downloads")
def create_download_ticket(
    request: Request,
    payload: DownloadTicketRequest | None = None,
    eduquery_session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    x_eduquery_session_token: str | None = Header(default=None, alias="X-EduQuery-Session-Token"),
) -> dict[str, Any]:
    """Generate a 60-second single-use download ticket tied to the active session.

    Avoids exposing the long-lived session token in download URLs or browser history.
    """
    session_id = resolve_session_id(request, eduquery_session, x_eduquery_session_token)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "status": "error",
                "error_code": "SESSION_REQUIRED",
                "message": "An active analysis session is required to generate download tickets.",
            },
        )
    from app.services.session_manager import issue_download_ticket
    resource = payload.resource_id if payload else ""
    ticket = issue_download_ticket(session_id=session_id, resource_id=resource or "")
    return {
        "status": "success",
        "ticket": ticket,
        "expires_in_seconds": 60,
    }
