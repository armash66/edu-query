"""Pydantic schemas for privacy-preserving AI assistant features."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

from app.api.schemas.investigation import (
    InvestigationCondition,
    InvestigationFilterGroup,
    InvestigationQueryRequest,
    InvestigationQueryResponse,
)


class AskAiRequest(BaseModel):
    """Payload for natural language question translation."""

    query: str = Field(..., min_length=1, max_length=500, description="User question in natural language")
    limit: int = Field(default=50, ge=1, le=200, description="Result limit if query matches records")


class AskAiResponse(BaseModel):
    """Response containing interpreted predicate AST, explanation, and results."""

    query: str = Field(..., description="Original user question")
    interpreted_query: str = Field(..., description="Human-readable summary of interpreted filter criteria")
    explanation: str = Field(..., description="Plain-language description of how the query was computed")
    refusal: str | None = Field(default=None, description="Clear refusal message if query is unsupported")
    is_refused: bool = Field(default=False, description="True if query was refused")
    predicate_ast: InvestigationFilterGroup | None = Field(
        default=None, description="Extracted predicate AST according to investigation schema"
    )
    query_request: InvestigationQueryRequest | None = Field(
        default=None, description="Compiled investigation query request ready for deterministic execution"
    )
    results: InvestigationQueryResponse | None = Field(
        default=None, description="Deterministic execution results over session marksheet"
    )


class HodBriefResponse(BaseModel):
    """1-page executive summary for the Head of Department with fact verification."""

    title: str = "EduQuery HOD Executive Performance Brief"
    narrative: str = Field(..., description="Executive narrative text")
    facts_used: dict[str, Any] = Field(..., description="Ground-truth facts JSON extracted from dataset")
    verified: bool = Field(..., description="True if every number in narrative exists in facts_used")
    validation_notes: str = Field(..., description="Validation outcome notes")
    generated_at: str = Field(..., description="ISO timestamp")


class NoticeDraftRequest(BaseModel):
    """Request for drafting an institutional notice template."""

    template_type: Literal["failed", "absent", "merit"] = Field(
        ..., description="Notice category"
    )
    custom_instructions: str | None = Field(
        default=None, max_length=300, description="Optional drafting notes"
    )


class NoticeDraftResponse(BaseModel):
    """Drafted institutional notice with standardized placeholders."""

    template_type: Literal["failed", "absent", "merit"]
    title: str
    body_template: str = Field(..., description="Template text with {placeholders}")
    placeholders: list[str] = Field(
        default=["{name}", "{seat_no}", "{roll_no}", "{division}", "{subjects}", "{sgpi}"],
        description="List of detected placeholders to be filled locally",
    )

