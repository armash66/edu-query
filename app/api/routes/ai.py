"""API routes for privacy-preserving AI assistant features."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Depends

from app.api.dependencies import get_db
from app.api.schemas.ai import (
    AskAiRequest,
    AskAiResponse,
    HodBriefResponse,
    NoticeDraftRequest,
    NoticeDraftResponse,
)
from app.services.ai_service import (
    draft_notice_template,
    generate_hod_brief,
    translate_natural_query,
)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post(
    "/ask",
    response_model=AskAiResponse,
    summary="Translate natural query into schema predicate AST and execute deterministically",
)
def ask_ai_endpoint(
    req: AskAiRequest,
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> AskAiResponse:
    """Natural language query interface executing strictly against investigation schema without PII."""
    return translate_natural_query(con, req.query, req.limit)


@router.get(
    "/hod-brief",
    response_model=HodBriefResponse,
    summary="Generate 1-page executive performance brief verified against ground-truth facts",
)
def get_hod_brief_endpoint(
    con: duckdb.DuckDBPyConnection = Depends(get_db),
) -> HodBriefResponse:
    """Generate executive HOD brief with strict numeric verification against marksheet facts."""
    return generate_hod_brief(con)


@router.post(
    "/notice-draft",
    response_model=NoticeDraftResponse,
    summary="Generate institutional notice template with placeholders",
)
def get_notice_draft_endpoint(
    req: NoticeDraftRequest,
) -> NoticeDraftResponse:
    """Draft official notice template for failed, absent, or merit students."""
    return draft_notice_template(req.template_type, req.custom_instructions)

