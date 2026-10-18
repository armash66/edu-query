"""Pydantic schemas for explainable academic anomaly detection."""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

AnomalyMethod = Literal["deterministic_rule", "robust_zscore", "isolation_forest"]
AnomalyCategory = Literal[
    "score_discrepancy",
    "boundary_violation",
    "component_imbalance",
    "intra_student_outlier",
    "cohort_outlier",
    "multivariate_outlier",
    "data_inconsistency",
]
AnomalySeverity = Literal["info", "warning", "critical"]


class AnomalyFindingItem(BaseModel):
    """Single explainable academic anomaly finding with evidence and provenance."""

    finding_id: str = Field(..., description="Stable unique finding identifier")
    category: AnomalyCategory = Field(..., description="Category of the anomaly")
    method: AnomalyMethod = Field(..., description="Detection method used")
    severity: AnomalySeverity = Field(..., description="Severity level")
    student_id: str = Field(..., description="Student key")
    student_name: str | None = Field(default=None, description="Student full name")
    division: str | None = Field(default=None, description="Class division")
    course_code: str | None = Field(default=None, description="Course code if course-specific")
    score_measure: float = Field(..., description="Raw score or deviation magnitude")
    score_label: str = Field(..., description="Human-readable score label with units")
    contributing_features: dict[str, Any] = Field(
        default_factory=dict,
        description="Features that contributed to the anomaly detection",
    )
    explanation: str = Field(..., description="Plain language explanation of the anomaly")
    limitations: str = Field(..., description="Explicit method limitations and disclaimers")
    source_sheet: str | None = Field(default=None, description="Originating worksheet name")
    source_row: int | None = Field(default=None, description="Originating spreadsheet row")
    record_link: str = Field(..., description="Frontend URI to inspect the source record")
    reviewed: bool = Field(default=False, description="Whether a faculty member reviewed this finding")
    reviewed_by: str | None = Field(default=None, description="Reviewer name or identifier")
    reviewed_at: str | None = Field(default=None, description="ISO timestamp of review")
    review_notes: str | None = Field(default=None, description="Faculty review commentary")


class AnomalySummaryResponse(BaseModel):
    """Summary of detected anomalies across deterministic, statistical, and ML methods."""

    status: str = "success"
    total_findings: int = Field(..., description="Total anomaly findings identified")
    unique_affected_records: int = Field(..., description="Distinct students/records flagged by at least one anomaly method")
    by_method: dict[str, int] = Field(..., description="Count of findings by detection method")
    by_category: dict[str, int] = Field(..., description="Count of findings by category")
    by_severity: dict[str, int] = Field(..., description="Count of findings by severity")
    reviewed_count: int = Field(..., description="Number of findings marked as reviewed")
    pending_count: int = Field(..., description="Number of pending unreviewed findings")
    reviewed_unique_records: int = Field(default=0, description="Distinct students whose findings are all reviewed")
    pending_unique_records: int = Field(default=0, description="Distinct students with at least one pending finding")
    insufficient_data: bool = Field(default=False, description="Whether ML model was skipped due to small sample size")
    insufficient_data_reason: str | None = Field(default=None, description="Explanation if data was insufficient")
    excluded_records_count: int = Field(default=0, description="Records excluded from ML/statistical models")
    exclusion_reasons: list[str] = Field(default_factory=list, description="Reasons for record exclusions")
    model_metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata on algorithms and parameters")


class GroupedAnomalyRecord(BaseModel):
    """Consolidated record grouping multiple findings concerning the same underlying student."""

    student_id: str = Field(..., description="Student identifier")
    student_name: str | None = Field(default=None, description="Student full name")
    division: str | None = Field(default=None, description="Class division")
    findings_count: int = Field(..., description="Total findings concerning this student")
    methods: list[str] = Field(..., description="Distinct detection methods that flagged this student")
    categories: list[str] = Field(..., description="Distinct anomaly categories observed")
    highest_severity: AnomalySeverity = Field(..., description="Highest severity level among findings")
    headline: str = Field(..., description="Concise explanation synthesizing the student's findings")
    all_reviewed: bool = Field(..., description="True if all findings for this student are marked reviewed")
    findings: list[AnomalyFindingItem] = Field(..., description="All preserved underlying findings with complete evidence")
    record_link: str = Field(..., description="Frontend URI to inspect student detail")


class GroupedAnomalyListResponse(BaseModel):
    """Paginated list of grouped anomaly records."""

    status: str = "success"
    total_unique_records: int = Field(..., description="Total unique students flagged")
    total_findings: int = Field(..., description="Total individual findings across all students")
    limit: int = Field(..., description="Pagination limit")
    offset: int = Field(..., description="Pagination offset")
    records: list[GroupedAnomalyRecord] = Field(..., description="Grouped records")


class AnomalyListResponse(BaseModel):
    """Paginated list of anomaly findings with active filters."""

    status: str = "success"
    total: int = Field(..., description="Total matching findings")
    unique_affected_records: int = Field(default=0, description="Unique students among matching findings")
    limit: int = Field(..., description="Pagination limit")
    offset: int = Field(..., description="Pagination offset")
    findings: list[AnomalyFindingItem] = Field(..., description="List of findings")
    grouped_records: list[GroupedAnomalyRecord] = Field(default_factory=list, description="Deduplicated student groups")


class AnomalyReviewRequest(BaseModel):
    """Request payload to mark an anomaly finding as reviewed or unreviewed."""

    reviewed: bool = Field(..., description="Target review status")
    reviewer_name: str | None = Field(default="Faculty Reviewer", description="Name of faculty reviewer")
    notes: str | None = Field(default=None, description="Optional commentary or moderation notes")


class AnomalyReviewResponse(BaseModel):
    """Response after updating review status of an anomaly finding."""

    status: str = "success"
    finding_id: str
    reviewed: bool
    reviewed_by: str | None
    reviewed_at: str | None
    review_notes: str | None
    message: str


class MethodEvaluationMetric(BaseModel):
    """Evaluation metrics for a specific anomaly detection method."""

    method: str
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    precision: float
    recall: float
    false_positive_rate: float
    runtime_ms: float
    notes: str


class AnomalyEvaluationReportResponse(BaseModel):
    """Empirical evaluation report comparing deterministic, statistical, and ML anomaly detection."""

    status: str = "success"
    evaluation_date: str
    dataset_description: str
    sample_size: int
    injected_anomalies_count: int
    clean_records_count: int
    methods: list[MethodEvaluationMetric]
    contamination_sensitivity: list[dict[str, Any]]
    detection_coverage: dict[str, list[str]]
    known_limitations: list[str]
