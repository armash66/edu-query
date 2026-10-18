"""Privacy-first temporary session manager for EduQuery V3.

Manages isolated, ephemeral marksheet analysis workspaces:
- Generates unguessable, opaque session identifiers (never derived from student PII or filenames).
- Ingests into isolated per-session DuckDB databases (data/sessions/{session_id}/session.duckdb).
- Ensures temporary sessions never overwrite or mutate permanent institutional datasets.
- Implements complete, idempotent session and data deletion.
- Enforces session expiration and automatic cleanup of abandoned/expired sessions.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import time
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import duckdb
from fastapi import HTTPException, UploadFile, status

from app.config import Settings
from app.core.ingest import ingest

logger = logging.getLogger("eduquery.session")

SESSION_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]{16,64}$")

# In-memory single-use download ticket store: ticket_string -> (session_id, resource_id, expires_at)
_DOWNLOAD_TICKETS: dict[str, tuple[str, str, float]] = {}
DOWNLOAD_TICKET_TTL_SECONDS = 60


def issue_download_ticket(session_id: str, resource_id: str = "") -> str:
    """Generate a short-lived (60s), single-use download ticket."""
    clean_id = validate_session_token(session_id)
    ticket = secrets.token_urlsafe(32)
    now = time.time()
    # Prune expired tickets
    expired = [t for t, v in list(_DOWNLOAD_TICKETS.items()) if v[2] < now]
    for exp_t in expired:
        _DOWNLOAD_TICKETS.pop(exp_t, None)

    _DOWNLOAD_TICKETS[ticket] = (clean_id, resource_id, now + DOWNLOAD_TICKET_TTL_SECONDS)
    return ticket


def consume_download_ticket(ticket: str | None) -> str | None:
    """Validate and atomically consume a single-use download ticket, returning session_id."""
    if not ticket or not isinstance(ticket, str):
        return None
    clean_ticket = ticket.strip()
    entry = _DOWNLOAD_TICKETS.pop(clean_ticket, None)
    if not entry:
        return None
    session_id, resource_id, expires_at = entry
    if time.time() > expires_at:
        return None
    return session_id


def validate_session_token(token: str | None) -> str:
    """Validate that token is a safe session identifier, preventing path traversal."""
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "error_code": "INVALID_SESSION_TOKEN",
                "message": "Missing or malformed session identifier.",
            },
        )
    clean = token.strip()
    if not SESSION_ID_RE.match(clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "error_code": "INVALID_SESSION_TOKEN",
                "message": "Malformed session token containing invalid characters.",
            },
        )
    return clean


def get_sessions_root_dir(settings: Settings) -> Path:
    """Ensure and return the root directory for temporary analysis sessions.

    In production, this maps to ephemeral /tmp/eduquery-sessions to isolate
    ephemeral data from persistent storage (/app/data).
    """
    configured_dir = getattr(settings, "temporary_sessions_dir", None)
    if configured_dir:
        sessions_dir = Path(configured_dir).resolve()
    else:
        sessions_dir = Path(settings.data_dir).resolve() / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    return sessions_dir


def get_session_dir(session_id: str, settings: Settings) -> Path:
    """Return the isolated workspace directory for a specific session."""
    clean_id = validate_session_token(session_id)
    return get_sessions_root_dir(settings) / clean_id


def sanitize_display_filename(filename: str | None) -> str:
    """Sanitize uploaded workbook name for display only; never used in filesystem paths."""
    if not filename:
        return "marksheet.xlsx"
    clean = re.sub(r"[^\w\s\.-]", "_", Path(filename).name)
    clean = re.sub(r"\s+", "_", clean).strip("_.")
    return clean or "marksheet.xlsx"


async def create_temporary_session(
    upload_file: UploadFile,
    settings: Settings,
) -> tuple[str, dict[str, Any]]:
    """Stream, validate, and ingest workbook into an isolated temporary session workspace."""
    # Opportunistically clean up any expired sessions
    cleanup_expired_sessions(settings=settings)

    raw_filename = upload_file.filename or ""
    display_name = sanitize_display_filename(raw_filename)

    # 1. Enforce extension restriction (.xlsx only)
    if not raw_filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "status": "error",
                "error_code": "UNSUPPORTED_FILE_TYPE",
                "message": "Only Excel openpyxl workbooks (.xlsx) are supported.",
                "details": [f"File '{display_name}' has unsupported extension."],
            },
        )

    # 2. Allocate opaque session workspace
    session_id = secrets.token_urlsafe(24).replace("-", "_")
    session_dir = get_session_dir(session_id, settings)
    session_dir.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(session_dir, 0o700)
    except Exception:
        pass

    quarantine_path = session_dir / "quarantine.xlsx"
    session_db_path = session_dir / "session.duckdb"
    meta_path = session_dir / "meta.json"

    sha256_hasher = hashlib.sha256()
    total_bytes = 0
    max_bytes = settings.max_upload_size_bytes

    # 3. Bounded streaming read
    try:
        with open(quarantine_path, "wb") as out_f:
            first_chunk = True
            while True:
                chunk = await upload_file.read(65536)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail={
                            "status": "error",
                            "error_code": "FILE_TOO_LARGE",
                            "message": f"Upload exceeds maximum permitted size of {max_bytes} bytes ({max_bytes // (1024 * 1024)} MiB).",
                            "details": [f"Read {total_bytes} bytes before threshold exceeded."],
                        },
                    )

                if first_chunk:
                    if not chunk.startswith(b"PK\x03\x04"):
                        raise HTTPException(
                            status_code=415,
                            detail={
                                "status": "error",
                                "error_code": "INVALID_WORKBOOK_CONTAINER",
                                "message": "Uploaded file is not a valid zip-compressed .xlsx workbook.",
                                "details": ["File magic bytes do not match standard PK zip container header."],
                            },
                        )
                    first_chunk = False

                sha256_hasher.update(chunk)
                out_f.write(chunk)

        if total_bytes == 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "status": "error",
                    "error_code": "EMPTY_FILE",
                    "message": "Uploaded workbook file is empty (0 bytes).",
                    "details": ["Zero content received in upload stream."],
                },
            )
    except Exception:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise

    file_hash = sha256_hasher.hexdigest()

    # 4. OpenXML package security checks
    decompression_error = None
    try:
        with zipfile.ZipFile(quarantine_path, "r") as zf:
            namelist = zf.namelist()
            if "[Content_Types].xml" not in namelist:
                shutil.rmtree(session_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=415,
                    detail={
                        "status": "error",
                        "error_code": "INVALID_WORKBOOK_CONTAINER",
                        "message": "Uploaded zip archive is not a valid OpenXML spreadsheet (.xlsx).",
                        "details": ["Archive does not contain standard '[Content_Types].xml'."],
                    },
                )

            total_uncompressed = 0
            infolist = zf.infolist()
            if len(infolist) > 1000:
                decompression_error = f"Archive contains {len(infolist)} entries, exceeding safety threshold (1000)."

            if not decompression_error:
                for info in infolist:
                    total_uncompressed += info.file_size
                    if info.flag_bits & 0x1:
                        decompression_error = "Encrypted or password-protected archives are not supported."
                        break
                    if ".." in info.filename or info.filename.startswith(("/", "\\")):
                        decompression_error = "Archive contains suspicious relative path traversal entries."
                        break

            if not decompression_error:
                if total_uncompressed > 100 * 1024 * 1024:
                    decompression_error = f"Uncompressed archive size ({total_uncompressed // (1024 * 1024)} MiB) exceeds safety limit (100 MiB)."
                elif total_bytes > 0 and (total_uncompressed / total_bytes) > 100:
                    decompression_error = f"Suspicious decompression ratio ({total_uncompressed / total_bytes:.1f}:1 exceeds 100:1 threshold)."

    except zipfile.BadZipFile:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(
            status_code=415,
            detail={
                "status": "error",
                "error_code": "INVALID_WORKBOOK_CONTAINER",
                "message": "Uploaded file is a malformed or corrupted zip archive.",
            },
        )

    if decompression_error:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "error_code": "SUSPICIOUS_ARCHIVE",
                "message": "Workbook container failed security safety checks.",
                "details": [decompression_error],
            },
        )

    # 5. Ingest into isolated session DuckDB
    divisions: list[str] = []
    try:
        con, report = ingest(input_path=quarantine_path, db_path=session_db_path)
        div_rows = con.execute("SELECT DISTINCT division FROM students WHERE division IS NOT NULL ORDER BY division").fetchall()
        divisions = [str(r[0]) for r in div_rows if r[0]]
        con.close()
    except Exception as exc:
        shutil.rmtree(session_dir, ignore_errors=True)
        logger.warning("Ingestion failed for session %s: %s", session_id, exc)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "error_code": "WORKBOOK_PARSE_FAILED",
                "message": "Could not parse workbook structure into academic records.",
                "details": [f"{type(exc).__name__}: Ingestion engine could not detect valid student or marksheet layout."],
            },
        ) from exc
    finally:
        # Delete original uploaded xlsx file immediately after ingestion into DuckDB
        quarantine_path.unlink(missing_ok=True)

    # 6. Build preview summary
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.import_session_ttl_seconds)

    blocking_errors: list[str] = []
    if report.students_count == 0:
        blocking_errors.append("Workbook contains zero accepted student records.")

    dq_dict = report.data_quality or {}
    raw_findings = dq_dict.get("findings", [])
    for f in raw_findings:
        if str(f.get("severity", "")).lower() == "error":
            blocking_errors.append(f"{f.get('title', 'Error')}: {f.get('problem', '')}")

    can_confirm = len(blocking_errors) == 0

    preview_payload = {
        "sheets": report.sheets_accepted,
        "sheets_detected": report.sheets_accepted,
        "sheets_skipped": report.sheets_skipped,
        "students_count": report.students_count,
        "courses_count": report.courses_count,
        "divisions": divisions,
        "layout_profiles": report.layouts_by_sheet,
        "quality_health": dq_dict.get("health_status", "Good"),
        "quality_score": float(dq_dict.get("quality_score", 100.0)),
        "error_count": int(dq_dict.get("error_count", 0)),
        "warning_count": int(dq_dict.get("warning_count", 0)),
        "findings": raw_findings[:10],
        "elective_groups": getattr(report, "elective_groups", []),
        "format_notes": [
            f"Detected {len(report.sheets_accepted)} accepted sheet(s)",
            f"{report.students_count} student records structured across {len(divisions) or 1} division(s)",
        ],
    }

    session_meta = {
        "session_id": session_id,
        "mode": "temporary",
        "state": "preview_ready",
        "created_at": now.isoformat(),
        "last_accessed_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "filename": display_name,
        "file_size_bytes": total_bytes,
        "sha256": file_hash,
        "students_count": report.students_count,
        "courses_count": report.courses_count,
        "can_confirm": can_confirm,
        "blocking_errors": blocking_errors,
        "preview": preview_payload,
    }

    meta_tmp = session_dir / "meta.json.tmp"
    meta_tmp.write_text(json.dumps(session_meta, indent=2), encoding="utf-8")
    os.replace(meta_tmp, meta_path)

    return session_id, session_meta


def confirm_temporary_session(session_id: str, settings: Settings) -> dict[str, Any]:
    """Confirm a validated preview and activate the temporary session for analysis."""
    session_dir = get_session_dir(session_id, settings)
    meta_path = session_dir / "meta.json"

    if not meta_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "not_found",
                "error_code": "SESSION_NOT_FOUND",
                "message": "Analysis session does not exist or has expired.",
            },
        )

    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    # Check expiration
    expires_at_str = meta.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.now(timezone.utc) > expires_at:
            delete_temporary_session(session_id, settings)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={
                    "status": "expired",
                    "error_code": "SESSION_EXPIRED",
                    "message": "Analysis session has expired due to inactivity. Please upload your marksheet again.",
                },
            )

    if not meta.get("can_confirm", False) or meta.get("blocking_errors"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "status": "conflict",
                "error_code": "BLOCKING_ERRORS_PRESENT",
                "message": "Cannot activate session with blocking validation errors.",
                "details": meta.get("blocking_errors", []),
            },
        )

    now = datetime.now(timezone.utc)
    # Refresh expiration window upon activation
    meta["state"] = "active"
    meta["activated_at"] = now.isoformat()
    meta["last_accessed_at"] = now.isoformat()
    meta["expires_at"] = (now + timedelta(seconds=settings.import_session_ttl_seconds)).isoformat()

    meta_tmp = session_dir / "meta.json.tmp"
    meta_tmp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    os.replace(meta_tmp, meta_path)

    return meta


def get_session_status(session_id: str | None, settings: Settings) -> dict[str, Any]:
    """Retrieve metadata and validity status of a temporary analysis session."""
    if not session_id:
        return {"active": False, "mode": None}

    try:
        clean_id = validate_session_token(session_id)
    except HTTPException:
        return {"active": False, "mode": None}

    session_dir = get_sessions_root_dir(settings) / clean_id
    meta_path = session_dir / "meta.json"
    db_path = session_dir / "session.duckdb"

    if not meta_path.is_file() or not db_path.is_file():
        return {"active": False, "mode": None}

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return {"active": False, "mode": None}

    # Verify expiration
    expires_at_str = meta.get("expires_at")
    if expires_at_str:
        expires_at = datetime.fromisoformat(expires_at_str)
        if datetime.now(timezone.utc) > expires_at:
            delete_temporary_session(clean_id, settings)
            return {"active": False, "mode": None, "reason": "expired"}

    # Update touch time
    now = datetime.now(timezone.utc)
    meta["last_accessed_at"] = now.isoformat()
    try:
        meta_tmp = session_dir / "meta.json.tmp"
        meta_tmp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        os.replace(meta_tmp, meta_path)
    except Exception:
        pass

    return {
        "active": meta.get("state") == "active",
        "state": meta.get("state"),
        "session_id": clean_id,
        "mode": "temporary",
        "filename": meta.get("filename"),
        "students_count": meta.get("students_count", 0),
        "courses_count": meta.get("courses_count", 0),
        "created_at": meta.get("created_at"),
        "expires_at": meta.get("expires_at"),
        "can_confirm": meta.get("can_confirm", False),
        "blocking_errors": meta.get("blocking_errors", []),
        "preview": meta.get("preview"),
    }


def delete_temporary_session(session_id: str | None, settings: Settings) -> bool:
    """Permanently delete a temporary session workspace and all associated artifacts.
    
    Idempotent: returns True even if already deleted.
    """
    if not session_id:
        return True

    try:
        clean_id = validate_session_token(session_id)
    except HTTPException:
        return True

    import gc
    gc.collect()

    session_dir = get_sessions_root_dir(settings) / clean_id
    if session_dir.is_dir():
        # Clean up directory completely
        try:
            shutil.rmtree(session_dir)
        except OSError:
            gc.collect()
            shutil.rmtree(session_dir, ignore_errors=True)
        logger.info("Permanently deleted temporary session %s", clean_id)

    # Evict any memory cache associated with this session
    from app.services.anomaly_detection import _REVIEWS_CACHE
    _REVIEWS_CACHE.pop(f"session_{clean_id}", None)
    _REVIEWS_CACHE.pop(clean_id, None)

    return True


def cleanup_expired_sessions(settings: Settings, max_age_seconds: int = 3600) -> int:
    """Scan and prune expired or abandoned sessions from the sessions directory."""
    sessions_root = get_sessions_root_dir(settings)
    if not sessions_root.is_dir():
        return 0

    cleaned = 0
    now = datetime.now(timezone.utc)

    for entry in list(sessions_root.iterdir()):
        if entry.is_dir():
            meta_file = entry / "meta.json"
            should_remove = False

            if meta_file.is_file():
                try:
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    expires_at_str = meta.get("expires_at")
                    if expires_at_str:
                        if now > datetime.fromisoformat(expires_at_str):
                            should_remove = True
                    else:
                        mtime = entry.stat().st_mtime
                        if (now.timestamp() - mtime) > max_age_seconds:
                            should_remove = True
                except Exception:
                    should_remove = True
            else:
                # Incomplete directory without meta
                mtime = entry.stat().st_mtime
                if (now.timestamp() - mtime) > 300:  # 5 minutes
                    should_remove = True

            if should_remove:
                shutil.rmtree(entry, ignore_errors=True)
                cleaned += 1

    if cleaned > 0:
        logger.info("Pruned %d expired/abandoned temporary sessions.", cleaned)

    return cleaned


def save_session_to_permanent(
    session_id: str,
    settings: Settings,
    dataset_name: str | None = None,
) -> dict[str, Any]:
    """Explicitly promote a temporary session database to permanent institutional storage."""
    session_dir = get_session_dir(session_id, settings)
    db_file = session_dir / "session.duckdb"
    meta_file = session_dir / "meta.json"

    if not db_file.is_file() or not meta_file.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "not_found",
                "error_code": "SESSION_NOT_FOUND",
                "message": "Cannot save dataset: session does not exist or has expired.",
            },
        )

    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    dataset_id = uuid_str = secrets.token_hex(8)

    datasets_dir = Path(settings.data_dir).resolve() / "datasets"
    datasets_dir.mkdir(parents=True, exist_ok=True)
    target_db = datasets_dir / f"{dataset_id}.duckdb"

    # Copy database file to permanent storage
    shutil.copy2(db_file, target_db)

    # Copy any reviews recorded in session to permanent reviews store
    session_reviews_file = session_dir / "reviews.json"
    if session_reviews_file.is_file():
        reviews_dir = Path(settings.data_dir).resolve() / "reviews"
        reviews_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(session_reviews_file, reviews_dir / f"{dataset_id}_reviews.json")

    # Update active dataset pointer
    now_iso = datetime.now(timezone.utc).isoformat()
    pointer_data = {
        "active_dataset_id": dataset_id,
        "active_database_path": str(target_db),
        "activated_at": now_iso,
        "source_filename": meta.get("filename", "marksheet.xlsx"),
        "students_count": meta.get("students_count", 0),
        "courses_count": meta.get("courses_count", 0),
        "mode": "persistent",
    }
    pointer_file = Path(settings.active_dataset_pointer_path).resolve()
    pointer_tmp = pointer_file.parent / f"{pointer_file.name}.tmp"
    pointer_tmp.write_text(json.dumps(pointer_data, indent=2), encoding="utf-8")
    os.replace(pointer_tmp, pointer_file)

    return {
        "status": "saved",
        "dataset_id": dataset_id,
        "database_path": str(target_db),
        "students_count": meta.get("students_count", 0),
        "courses_count": meta.get("courses_count", 0),
        "activated_at": now_iso,
        "message": "Dataset has been successfully saved to persistent institutional storage.",
    }
