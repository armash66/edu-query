"""Import session lifecycle, streaming upload validation, candidate staging, and atomic dataset activation."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import time
import duckdb
from fastapi import HTTPException, UploadFile, status

from app.api.schemas.data_quality import DataQualityFindingItem
from app.api.schemas.imports import (
    DataQualityPreview,
    ImportConfirmResponse,
    ImportPreviewResponse,
    ImportState,
    LayoutSummary,
    SafeWorkbookMeta,
)
from app.config import Settings
from app.core.ingest import ingest

logger = logging.getLogger("eduquery.imports")

# Global in-process lock to serialize candidate promotions and activations
_activation_lock = asyncio.Lock()

IMPORT_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]{8,64}$")


def validate_import_id(import_id: str | None) -> str:
    """Validate that import_id is a safe session identifier, preventing path traversal."""
    if not import_id or not isinstance(import_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "error_code": "INVALID_IMPORT_ID",
                "message": "Missing or malformed import identifier.",
                "details": ["Identifier must be a non-empty alphanumeric session key."],
            },
        )
    clean = import_id.strip()
    if not IMPORT_ID_RE.match(clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "error_code": "INVALID_IMPORT_ID",
                "message": f"Malformed import identifier '{clean}'.",
                "details": ["Identifier contains invalid characters or path traversal sequence."],
            },
        )
    return clean


class CrossProcessLock:
    """Cross-process file lock using atomic OS file creation."""

    def __init__(self, lock_path: Path, timeout: float = 15.0):
        self.lock_path = lock_path
        self.timeout = timeout
        self.fd: int | None = None

    def __enter__(self) -> CrossProcessLock:
        start = time.monotonic()
        while True:
            try:
                self.lock_path.parent.mkdir(parents=True, exist_ok=True)
                self.fd = os.open(str(self.lock_path), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                return self
            except FileExistsError:
                if time.monotonic() - start > self.timeout:
                    # Check if existing lock is stale (> 60s)
                    try:
                        mtime = self.lock_path.stat().st_mtime
                        if time.time() - mtime > 60:
                            self.lock_path.unlink(missing_ok=True)
                            continue
                    except Exception:
                        pass
                    raise TimeoutError(f"Timed out after {self.timeout}s waiting for activation lock.")
                time.sleep(0.05)

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        if self.fd is not None:
            try:
                os.close(self.fd)
            except Exception:
                pass
            self.lock_path.unlink(missing_ok=True)


def get_import_storage_dirs(settings: Settings) -> dict[str, Path]:
    """Ensure and return required storage directories for import workflow."""
    base_data = Path(settings.data_dir).resolve()
    dirs = {
        "uploads": base_data / "imports" / "uploads",
        "candidates": base_data / "imports" / "candidates",
        "sessions": base_data / "imports" / "sessions",
        "datasets": base_data / "datasets",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def sanitize_filename(filename: str | None) -> str:
    """Sanitize uploaded filename for safe display; never used in filesystem paths."""
    if not filename:
        return "unnamed_workbook.xlsx"
    clean = re.sub(r"[^\w\s\.-]", "_", Path(filename).name)
    clean = re.sub(r"\s+", "_", clean).strip("_.")
    return clean or "workbook.xlsx"


async def process_workbook_preview(
    upload_file: UploadFile,
    settings: Settings,
) -> ImportPreviewResponse:
    """Stream, validate, stage in candidate DuckDB database, and generate safe preview."""
    dirs = get_import_storage_dirs(settings)
    raw_filename = upload_file.filename or ""
    safe_name = sanitize_filename(raw_filename)

    # 1. Enforce extension restriction (.xlsx only)
    if not raw_filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "status": "error",
                "error_code": "UNSUPPORTED_FILE_TYPE",
                "message": "Only Excel openpyxl workbooks (.xlsx) are supported.",
                "details": [f"File '{safe_name}' has unsupported extension."],
            },
        )

    import_id = uuid.uuid4().hex
    quarantine_path = dirs["uploads"] / f"upload_{import_id}.xlsx"
    candidate_db_path = dirs["candidates"] / f"candidate_{import_id}.duckdb"

    sha256_hasher = hashlib.sha256()
    total_bytes = 0
    max_bytes = settings.max_upload_size_bytes

    # 2. Bounded streaming read to enforce size limit and prevent memory exhaustion
    try:
        with open(quarantine_path, "wb") as out_f:
            first_chunk = True
            while True:
                chunk = await upload_file.read(65536)  # 64 KB chunks
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
                    # 3. Magic bytes inspection (PK zip header: 50 4B 03 04)
                    if not chunk.startswith(b"PK\x03\x04"):
                        raise HTTPException(
                            status_code=415,
                            detail={
                                "status": "error",
                                "error_code": "INVALID_WORKBOOK_HEADER",
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
        # Cleanup partial upload on failure
        quarantine_path.unlink(missing_ok=True)
        raise

    file_hash = sha256_hasher.hexdigest()

    # 3b. Verify valid OpenXML zip package structure and guard against decompression bombs
    is_valid_openxml = True
    decompression_error = None
    try:
        import zipfile
        with zipfile.ZipFile(quarantine_path, "r") as zf:
            namelist = zf.namelist()
            if "[Content_Types].xml" not in namelist:
                is_valid_openxml = False

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
        is_valid_openxml = False

    if not is_valid_openxml:
        quarantine_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=415,
            detail={
                "status": "error",
                "error_code": "INVALID_WORKBOOK_CONTAINER",
                "message": "Uploaded zip archive is not a valid OpenXML spreadsheet (.xlsx).",
                "details": ["Archive does not contain standard '[Content_Types].xml'."],
            },
        )

    if decompression_error:
        quarantine_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "error_code": "SUSPICIOUS_ARCHIVE",
                "message": "Workbook container failed security safety checks.",
                "details": [decompression_error],
            },
        )

    # 4. Ingest into isolated candidate DuckDB database
    try:
        con, report = ingest(input_path=quarantine_path, db_path=candidate_db_path)
        con.close()
    except Exception as exc:
        import gc
        gc.collect()
        try:
            quarantine_path.unlink(missing_ok=True)
        except OSError:
            pass
        try:
            candidate_db_path.unlink(missing_ok=True)
        except OSError:
            pass
        logger.warning("Workbook ingestion failed for candidate %s: %s", import_id, exc)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "error_code": "WORKBOOK_PARSE_FAILED",
                "message": "Academic marksheet ingestion engine could not parse workbook structure.",
                "details": [f"{type(exc).__name__}: Ingestion failed to parse marksheet layout or data."],
            },
        ) from exc

    # 5. Build safe preview models and determine confirmability
    blocking_errors: list[str] = []
    if report.students_count == 0:
        blocking_errors.append("Workbook contains zero accepted student records.")

    dq_dict = report.data_quality or {}
    raw_findings = dq_dict.get("findings", [])
    finding_items: list[DataQualityFindingItem] = []
    for f in raw_findings:
        f_sev = str(f.get("severity", "info")).lower()
        if f_sev == "error":
            blocking_errors.append(f"{f.get('title', 'Error')}: {f.get('problem', '')}")

        finding_items.append(
            DataQualityFindingItem(
                check_id=str(f.get("check_id", "audit")),
                severity=f_sev,  # type: ignore[arg-type]
                title=str(f.get("title", "")),
                count=int(f.get("count", 0)),
                problem=str(f.get("problem", "")),
                impact=str(f.get("impact", "")),
                recommended_action=str(f.get("recommended_action", "")),
                details=[str(d) for d in f.get("details", [])[:5]],
            )
        )

    can_confirm = (len(blocking_errors) == 0)
    current_state: ImportState = "preview_ready" if can_confirm else "validation_failed"

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(seconds=settings.import_session_ttl_seconds)

    preview_resp = ImportPreviewResponse(
        import_id=import_id,
        state=current_state,
        created_at=created_at.isoformat(),
        expires_at=expires_at.isoformat(),
        workbook=SafeWorkbookMeta(
            filename=safe_name,
            file_size_bytes=total_bytes,
            sha256=file_hash,
            content_type=upload_file.content_type or "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        layout=LayoutSummary(
            strategy=str(report.layout.get("strategy", "unknown")),
            sheets_inspected=report.sheets_inspected,
            sheets_accepted=report.sheets_accepted,
            sheets_skipped=report.sheets_skipped,
            elective_groups=report.layout.get("elective_groups", []),
        ),
        students_count=report.students_count,
        courses_count=report.courses_count,
        scores_count=report.scores_count,
        enrollment_count=report.enrollment_count,
        reconciliation_count=report.reconciliation_count,
        data_quality=DataQualityPreview(
            health_status=dq_dict.get("health_status", "Good"),
            quality_score=float(dq_dict.get("quality_score", 100.0)),
            total_checks=int(dq_dict.get("total_checks", 8)),
            error_count=int(dq_dict.get("error_count", 0)),
            warning_count=int(dq_dict.get("warning_count", 0)),
            info_count=int(dq_dict.get("info_count", 0)),
            findings=finding_items,
        ),
        can_confirm=can_confirm,
        blocking_errors=blocking_errors,
        active_dataset_changed=False,
    )

    # 6. Save persistent session metadata (for surviving server restart)
    session_data = {
        "import_id": import_id,
        "state": current_state,
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "can_confirm": can_confirm,
        "blocking_errors": blocking_errors,
        "filename": safe_name,
        "file_size_bytes": total_bytes,
        "sha256": file_hash,
        "upload_path": str(quarantine_path),
        "candidate_db_path": str(candidate_db_path),
        "students_count": report.students_count,
        "courses_count": report.courses_count,
        "preview_response": preview_resp.model_dump(),
    }
    session_file = dirs["sessions"] / f"{import_id}.json"
    session_tmp = dirs["sessions"] / f"{import_id}.json.tmp"
    session_tmp.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
    os.replace(session_tmp, session_file)

    return preview_resp


async def confirm_and_activate_import(
    import_id: str,
    app_state: Any,
    settings: Settings,
) -> ImportConfirmResponse:
    """Verify session, revalidate candidate DuckDB integrity, and atomically activate dataset."""
    clean_import_id = validate_import_id(import_id)
    dirs = get_import_storage_dirs(settings)
    session_file = dirs["sessions"] / f"{clean_import_id}.json"

    if not session_file.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "not_found",
                "error_code": "IMPORT_SESSION_NOT_FOUND",
                "query": clean_import_id,
                "message": f"Import session '{clean_import_id}' does not exist or has been cleaned up.",
            },
        )

    lock_file = dirs["sessions"] / ".activation.lock"
    async with _activation_lock:
        with CrossProcessLock(lock_file):
            session_data = json.loads(session_file.read_text(encoding="utf-8"))
            current_state = session_data.get("state")

            # 1. Check idempotency: already activated returns success
            if current_state == "activated":
                return ImportConfirmResponse(
                    import_id=clean_import_id,
                    state="activated",
                    activated_at=session_data.get("activated_at", datetime.now(timezone.utc).isoformat()),
                    students_count=int(session_data.get("students_count", 0)),
                    courses_count=int(session_data.get("courses_count", 0)),
                    active_dataset_id=session_data.get("active_dataset_id", "active"),
                    message="Import session has already been activated.",
                )

            # 2. Check expiration
            expires_at_str = session_data.get("expires_at")
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str)
                if datetime.now(timezone.utc) > expires_at:
                    session_data["state"] = "expired"
                    session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "status": "conflict",
                            "error_code": "IMPORT_SESSION_EXPIRED",
                            "message": f"Import session '{clean_import_id}' expired at {expires_at_str}.",
                        },
                    )

            # 3. Check confirmability
            if current_state != "preview_ready":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "status": "conflict",
                        "error_code": "INVALID_STATE_TRANSITION",
                        "message": f"Cannot confirm import session in state '{current_state}'.",
                        "details": session_data.get("blocking_errors", []),
                    },
                )

            if not session_data.get("can_confirm", False) or session_data.get("blocking_errors"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "status": "conflict",
                        "error_code": "BLOCKING_ERRORS_PRESENT",
                        "message": "Cannot activate a dataset with blocking academic integrity errors.",
                        "details": session_data.get("blocking_errors", []),
                    },
                )

            candidate_raw = session_data.get("candidate_db_path")
            if not candidate_raw:
                session_data["state"] = "failed"
                session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "error",
                        "error_code": "CANDIDATE_DATABASE_MISSING",
                        "message": "Candidate dataset path is missing from session record.",
                    },
                )

            candidate_path = Path(candidate_raw)
            candidates_dir = dirs["candidates"].resolve()
            if not candidate_path.resolve().is_relative_to(candidates_dir):
                session_data["state"] = "failed"
                session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "status": "error",
                        "error_code": "INVALID_CANDIDATE_PATH",
                        "message": "Candidate database path is outside permitted quarantine storage.",
                        "details": [],
                    },
                )

            if not candidate_path.is_file():
                session_data["state"] = "failed"
                session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "error",
                        "error_code": "CANDIDATE_DATABASE_MISSING",
                        "message": "Candidate dataset file is missing from temporary quarantine storage.",
                    },
                )

            # 4. Revalidate candidate database integrity before promotion
            try:
                con = duckdb.connect(str(candidate_path), read_only=True)
                tbls = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
                if "students" not in tbls or "courses" not in tbls or "scores" not in tbls:
                    con.close()
                    raise ValueError("Candidate database missing required schema tables.")
                s_cnt = con.execute("SELECT COUNT(*) FROM students").fetchone()[0]
                c_cnt = con.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
                con.close()
                if s_cnt == 0:
                    raise ValueError("Candidate database contains 0 students.")
            except Exception as exc:
                session_data["state"] = "failed"
                session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")
                raise HTTPException(
                    status_code=422,
                    detail={
                        "status": "error",
                        "error_code": "CANDIDATE_INTEGRITY_CHECK_FAILED",
                        "message": "Candidate database validation failed prior to activation.",
                        "details": [f"{type(exc).__name__}: Integrity check failed."],
                    },
                ) from exc

            # 5. Promote candidate to versioned dataset
            now_dt = datetime.now(timezone.utc)
            ts_str = now_dt.strftime("%Y%m%d_%H%M%S")
            dataset_id = f"dataset_{ts_str}_{clean_import_id[:8]}"
            promoted_db_path = dirs["datasets"] / f"{dataset_id}.duckdb"

            try:
                shutil.copy2(candidate_path, promoted_db_path)
                # Verify promoted database can be opened
                test_con = duckdb.connect(str(promoted_db_path), read_only=True)
                test_con.close()
            except Exception as exc:
                promoted_db_path.unlink(missing_ok=True)
                logger.error("Failed to promote candidate database %s: %s", clean_import_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "error",
                        "error_code": "PROMOTION_FAILED",
                        "message": "Could not promote candidate database to persistent versioned storage.",
                    },
                ) from exc

            # 6. Atomically and durably update the active dataset pointer file
            pointer_path = Path(settings.active_dataset_pointer_path).resolve()
            pointer_tmp = pointer_path.parent / f"{pointer_path.name}.tmp"
            pointer_payload = {
                "active_dataset_id": dataset_id,
                "active_database_path": str(promoted_db_path),
                "import_id": clean_import_id,
                "activated_at": now_dt.isoformat(),
                "students_count": s_cnt,
                "courses_count": c_cnt,
            }
            try:
                pointer_path.parent.mkdir(parents=True, exist_ok=True)
                with open(pointer_tmp, "w", encoding="utf-8") as pf:
                    pf.write(json.dumps(pointer_payload, indent=2))
                    pf.flush()
                    os.fsync(pf.fileno())
                os.replace(pointer_tmp, pointer_path)
            except Exception as exc:
                pointer_tmp.unlink(missing_ok=True)
                promoted_db_path.unlink(missing_ok=True)
                logger.error("Failed to update active dataset pointer file: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "error",
                        "error_code": "ACTIVATION_FAILED",
                        "message": "Failed to update active dataset pointer file.",
                    },
                ) from exc

            # 7. Update in-memory application state
            if app_state is not None:
                app_state.active_database_path = str(promoted_db_path)
                app_state.active_dataset_id = dataset_id
                if hasattr(app_state, "settings"):
                    app_state.settings.database_path = str(promoted_db_path)

            # 8. Mark session activated and persist
            session_data["state"] = "activated"
            session_data["activated_at"] = now_dt.isoformat()
            session_data["active_dataset_id"] = dataset_id
            session_file.write_text(json.dumps(session_data, indent=2), encoding="utf-8")

            # Cleanup candidate quarantine file now that it is promoted
            candidate_path.unlink(missing_ok=True)

            return ImportConfirmResponse(
                import_id=clean_import_id,
                state="activated",
                activated_at=now_dt.isoformat(),
                students_count=int(s_cnt),
                courses_count=int(c_cnt),
                active_dataset_id=dataset_id,
                message="Workbook dataset successfully activated. All subsequent queries will target this dataset.",
            )


def get_import_session_status(import_id: str, settings: Settings) -> dict[str, Any] | None:
    """Read session status from disk safely, validating import_id against path traversal."""
    try:
        clean_import_id = validate_import_id(import_id)
    except HTTPException:
        return None
    dirs = get_import_storage_dirs(settings)
    s_file = dirs["sessions"] / f"{clean_import_id}.json"
    if not s_file.is_file():
        return None
    try:
        raw = json.loads(s_file.read_text(encoding="utf-8"))
        # Strip internal server filesystem paths to prevent information leakage
        return {k: v for k, v in raw.items() if k not in ("candidate_db_path", "upload_path")}
    except Exception:
        return None


def cleanup_import_storage(settings: Settings, max_age_seconds: int = 86400) -> int:
    """Idempotently clean up expired or abandoned temporary import artifacts; never touches active dataset."""
    dirs = get_import_storage_dirs(settings)
    cleaned_count = 0
    now = datetime.now(timezone.utc)

    # Active dataset path to strictly protect
    pointer_path = Path(settings.active_dataset_pointer_path).resolve()
    protected_active_path = None
    if pointer_path.is_file():
        try:
            p_data = json.loads(pointer_path.read_text(encoding="utf-8"))
            protected_active_path = p_data.get("active_database_path")
        except Exception:
            pass

    lock_file = dirs["sessions"] / ".activation.lock"
    try:
        with CrossProcessLock(lock_file, timeout=2.0):
            for s_file in dirs["sessions"].glob("*.json"):
                try:
                    data = json.loads(s_file.read_text(encoding="utf-8"))
                    s_state = data.get("state")
                    exp_str = data.get("expires_at")
                    is_expired = False
                    if exp_str:
                        exp_dt = datetime.fromisoformat(exp_str)
                        is_expired = (now > exp_dt)

                    # Cleanup candidate and upload if expired or failed
                    if is_expired or s_state in ("failed", "validation_failed"):
                        cand = data.get("candidate_db_path")
                        if cand and cand != protected_active_path:
                            Path(cand).unlink(missing_ok=True)
                        upld = data.get("upload_path")
                        if upld:
                            Path(upld).unlink(missing_ok=True)
                        cleaned_count += 1
                except Exception as e:
                    logger.warning("Error during session cleanup for %s: %s", s_file, e)
    except TimeoutError:
        logger.warning("Storage cleanup skipped: activation lock currently held by another task.")
        return 0

    return cleaned_count


def list_dataset_versions(settings: Settings) -> dict[str, Any]:
    """Inspect and list all versioned persistent DuckDB datasets in storage."""
    dirs = get_import_storage_dirs(settings)
    datasets_dir = dirs["datasets"]

    # Active dataset pointer
    pointer_path = Path(settings.active_dataset_pointer_path).resolve()
    active_id = None
    if pointer_path.is_file():
        try:
            p_data = json.loads(pointer_path.read_text(encoding="utf-8"))
            active_id = p_data.get("active_dataset_id")
        except Exception:
            pass

    versions: list[dict[str, Any]] = []
    for db_file in sorted(datasets_dir.glob("dataset_*.duckdb"), key=lambda p: p.stat().st_mtime, reverse=True):
        d_id = db_file.stem
        try:
            con = duckdb.connect(str(db_file), read_only=True)
            s_cnt = con.execute("SELECT COUNT(*) FROM students").fetchone()[0]
            c_cnt = con.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
            con.close()
            mtime = datetime.fromtimestamp(db_file.stat().st_mtime, tz=timezone.utc).isoformat()
            versions.append({
                "dataset_id": d_id,
                "is_active": (d_id == active_id),
                "created_at": mtime,
                "students_count": int(s_cnt),
                "courses_count": int(c_cnt),
                "size_bytes": int(db_file.stat().st_size),
            })
        except Exception as e:
            logger.warning("Could not read dataset version %s: %s", db_file, e)
            continue

    return {
        "active_dataset_id": active_id,
        "total_versions": len(versions),
        "versions": versions,
    }


async def rollback_to_dataset_version(
    dataset_id: str,
    app_state: Any,
    settings: Settings,
) -> dict[str, Any]:
    """Atomically roll back to a previously validated dataset version."""
    clean_id = validate_import_id(dataset_id)
    dirs = get_import_storage_dirs(settings)
    target_db = dirs["datasets"] / f"{clean_id}.duckdb"

    if not target_db.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "not_found",
                "error_code": "DATASET_VERSION_NOT_FOUND",
                "message": f"Dataset version '{clean_id}' does not exist in persistent storage.",
            },
        )

    # Revalidate target database integrity before rollback
    try:
        con = duckdb.connect(str(target_db), read_only=True)
        tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
        if "students" not in tables or "courses" not in tables:
            con.close()
            raise ValueError("Target database missing required schema tables.")
        s_cnt = con.execute("SELECT COUNT(*) FROM students").fetchone()[0]
        c_cnt = con.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
        con.close()
        if s_cnt == 0:
            raise ValueError("Target database contains zero students.")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "error",
                "error_code": "CANDIDATE_INTEGRITY_CHECK_FAILED",
                "message": f"Cannot rollback to corrupted dataset version '{clean_id}'.",
                "details": [str(exc)],
            },
        ) from exc

    pointer_path = Path(settings.active_dataset_pointer_path).resolve()
    prev_id = None
    if pointer_path.is_file():
        try:
            p_data = json.loads(pointer_path.read_text(encoding="utf-8"))
            prev_id = p_data.get("active_dataset_id")
        except Exception:
            pass

    if prev_id == clean_id:
        return {
            "status": "success",
            "previous_dataset_id": prev_id,
            "active_dataset_id": clean_id,
            "students_count": int(s_cnt),
            "courses_count": int(c_cnt),
            "activated_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Dataset version '{clean_id}' is already active.",
        }

    lock_file = dirs["sessions"] / ".activation.lock"
    now_dt = datetime.now(timezone.utc)
    async with _activation_lock:
        with CrossProcessLock(lock_file):
            pointer_tmp = pointer_path.parent / f"{pointer_path.name}.tmp"
            pointer_payload = {
                "active_dataset_id": clean_id,
                "active_database_path": str(target_db),
                "import_id": f"rollback_{clean_id}",
                "activated_at": now_dt.isoformat(),
                "students_count": s_cnt,
                "courses_count": c_cnt,
            }
            try:
                pointer_path.parent.mkdir(parents=True, exist_ok=True)
                with open(pointer_tmp, "w", encoding="utf-8") as pf:
                    pf.write(json.dumps(pointer_payload, indent=2))
                    pf.flush()
                    os.fsync(pf.fileno())
                os.replace(pointer_tmp, pointer_path)
            except Exception as exc:
                pointer_tmp.unlink(missing_ok=True)
                logger.error("Failed to update active pointer on rollback: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "status": "error",
                        "error_code": "ACTIVATION_FAILED",
                        "message": "Failed to update active dataset pointer during rollback.",
                    },
                ) from exc

            # Update in-memory app state
            if app_state is not None:
                app_state.active_database_path = str(target_db)
                app_state.active_dataset_id = clean_id
                if hasattr(app_state, "settings"):
                    app_state.settings.database_path = str(target_db)

            return {
                "status": "success",
                "previous_dataset_id": prev_id,
                "active_dataset_id": clean_id,
                "students_count": int(s_cnt),
                "courses_count": int(c_cnt),
                "activated_at": now_dt.isoformat(),
                "message": f"Successfully rolled back to dataset version '{clean_id}'.",
            }

