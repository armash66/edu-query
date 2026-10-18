"""API routes for secure workbook upload, preview, validation, and activation."""
from __future__ import annotations

import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, status

from app.api.schemas.common import ErrorResponse, NotFoundErrorResponse
from app.api.schemas.imports import (
    DatasetVersionsResponse,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportPreviewResponse,
    RollbackRequest,
    RollbackResponse,
)
from app.config import Settings, get_settings
from app.services.import_manager import (
    confirm_and_activate_import,
    get_import_session_status,
    list_dataset_versions,
    process_workbook_preview,
    rollback_to_dataset_version,
    validate_import_id,
)

router = APIRouter(prefix="/imports", tags=["Imports"])


def verify_import_authorization(
    request: Request,
    x_eduquery_import_key: Annotated[str | None, Header(alias="X-EduQuery-Import-Key")] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> None:
    """Administrative authorization safeguard for marksheet upload and activation.

    Requires an administrative API key configured in EDUQUERY_IMPORT_API_KEY.
    If the key is not configured, import operations are disabled.
    Compares provided credentials using constant-time comparison to prevent timing leaks.
    """
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    configured_key = settings.import_api_key

    # 1. Reject if administrative key is not configured
    if not configured_key or not configured_key.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "error",
                "error_code": "IMPORT_DISABLED",
                "message": "Workbook import operations are currently disabled because no administrative import API key has been configured.",
                "details": ["Set the EDUQUERY_IMPORT_API_KEY environment variable to enable workbook imports."],
            },
        )

    # 2. Extract provided key from headers
    provided_key: str | None = None
    if x_eduquery_import_key:
        provided_key = x_eduquery_import_key.strip()
    elif authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            provided_key = parts[1]
        elif len(parts) == 1:
            provided_key = parts[0]

    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "status": "error",
                "error_code": "UNAUTHORIZED",
                "message": "Missing administrative import API key credentials.",
                "details": [
                    "Supply the administrative import key in the 'X-EduQuery-Import-Key' or 'Authorization: Bearer <key>' header."
                ],
            },
        )

    # 3. Constant-time digest comparison (prevents timing side-channels)
    if not secrets.compare_digest(provided_key, configured_key.strip()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "status": "error",
                "error_code": "UNAUTHORIZED",
                "message": "Invalid administrative import API key credentials.",
                "details": [],
            },
        )


@router.post(
    "/preview",
    response_model=ImportPreviewResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid administrative import credentials"},
        413: {"model": ErrorResponse, "description": "Uploaded file exceeds maximum permitted size"},
        415: {"model": ErrorResponse, "description": "Unsupported file format or invalid magic bytes"},
        422: {"model": ErrorResponse, "description": "Workbook structure invalid or zero accepted students"},
        503: {"model": ErrorResponse, "description": "Import operations disabled by configuration"},
    },
    dependencies=[Depends(verify_import_authorization)],
)
async def preview_workbook_upload(
    request: Request,
    file: Annotated[UploadFile, File(description="Excel marksheet file (.xlsx)")],
) -> ImportPreviewResponse:
    """Upload candidate academic marksheet, validate format and layout, and return safe preview.

    The workbook is ingested into an isolated candidate DuckDB database. The active
    production dataset is guaranteed not to change during preview.
    """
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    return await process_workbook_preview(upload_file=file, settings=settings)


@router.post(
    "/confirm",
    response_model=ImportConfirmResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid administrative import credentials"},
        404: {"model": NotFoundErrorResponse, "description": "Import session not found"},
        409: {"model": ErrorResponse, "description": "Session expired or blocking validation errors present"},
        422: {"model": ErrorResponse, "description": "Candidate database integrity check failed"},
        500: {"model": ErrorResponse, "description": "Dataset activation failure"},
        503: {"model": ErrorResponse, "description": "Import operations disabled by configuration"},
    },
    dependencies=[Depends(verify_import_authorization)],
)
async def confirm_workbook_import(
    request: Request,
    payload: ImportConfirmRequest,
) -> ImportConfirmResponse:
    """Confirm a validated preview session and atomically activate the candidate dataset.

    Promotes the candidate database to versioned storage, updates the authoritative
    active dataset pointer file, and hot-swaps the runtime database connection target.
    """
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    return await confirm_and_activate_import(
        import_id=payload.import_id,
        app_state=request.app.state,
        settings=settings,
    )


@router.get(
    "/versions",
    response_model=DatasetVersionsResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid administrative import credentials"},
        503: {"model": ErrorResponse, "description": "Import operations disabled by configuration"},
    },
    dependencies=[Depends(verify_import_authorization)],
)
def get_dataset_versions_list(request: Request) -> DatasetVersionsResponse:
    """List all stored persistent dataset versions for audit and rollback."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    return list_dataset_versions(settings=settings)


@router.post(
    "/rollback",
    response_model=RollbackResponse,
    status_code=status.HTTP_200_OK,
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid administrative import credentials"},
        404: {"model": NotFoundErrorResponse, "description": "Dataset version not found"},
        422: {"model": ErrorResponse, "description": "Target dataset integrity check failed"},
        500: {"model": ErrorResponse, "description": "Activation rollback failed"},
        503: {"model": ErrorResponse, "description": "Import operations disabled by configuration"},
    },
    dependencies=[Depends(verify_import_authorization)],
)
async def rollback_dataset(
    request: Request,
    payload: RollbackRequest,
) -> RollbackResponse:
    """Safely roll back active dataset to an existing validated version."""
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    return await rollback_to_dataset_version(
        dataset_id=payload.dataset_id,
        app_state=request.app.state,
        settings=settings,
    )


@router.get(
    "/{import_id}",
    response_model=dict[str, Any],
    responses={
        401: {"model": ErrorResponse, "description": "Missing or invalid administrative import credentials"},
        404: {"model": NotFoundErrorResponse, "description": "Import session not found"},
        503: {"model": ErrorResponse, "description": "Import operations disabled by configuration"},
    },
    dependencies=[Depends(verify_import_authorization)],
)
def get_import_status(
    request: Request,
    import_id: str,
) -> dict[str, Any]:
    """Inspect status and preview details of an ongoing or completed import session."""
    clean_id = validate_import_id(import_id)
    settings: Settings = getattr(request.app.state, "settings", None) or get_settings()
    session_data = get_import_session_status(import_id=clean_id, settings=settings)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "not_found",
                "error_code": "IMPORT_SESSION_NOT_FOUND",
                "query": clean_id,
                "message": f"Import session '{clean_id}' does not exist or has expired.",
            },
        )
    return session_data
