"""Application service for data-quality audit reporting."""
from __future__ import annotations

import json
from typing import Any

import duckdb

from app.api.schemas.data_quality import (
    DataQualityFindingItem,
    DataQualityResponse,
    HealthStatusLevel,
    SeverityLevel,
)
from app.core.data_quality import run_data_quality_audit


def get_data_quality_service(con: duckdb.DuckDBPyConnection) -> DataQualityResponse:
    """Retrieve comprehensive marksheet data quality metrics and findings."""
    # 1. Check if database has any students loaded
    st_count_row = con.execute("SELECT COUNT(*) FROM students").fetchone()
    st_count = int(st_count_row[0]) if st_count_row else 0

    if st_count == 0:
        return DataQualityResponse(
            session_id="empty",
            health_status="Good",
            quality_score=100.0,
            total_checks=0,
            error_count=0,
            warning_count=0,
            info_count=0,
            findings=[
                DataQualityFindingItem(
                    check_id="empty_dataset",
                    severity="info",
                    title="Empty Dataset",
                    count=0,
                    problem="No student records found in database.",
                    impact="No academic marksheet data available to evaluate.",
                    recommended_action="Ingest a valid marksheet workbook.",
                    details=["Table 'students' is empty."],
                )
            ],
        )

    # 2. Check if quality_findings table already has recorded audit findings
    findings_rows = con.execute(
        """
        SELECT check_id, severity, title, count, problem, impact, recommended_action, details_json
        FROM quality_findings
        ORDER BY severity ASC, check_id ASC
        """
    ).fetchall()

    if findings_rows:
        session_row = con.execute("SELECT fingerprint FROM layout_profiles LIMIT 1").fetchone()
        session_id = str(session_row[0]) if session_row else "active_session"

        items: list[DataQualityFindingItem] = []
        for r in findings_rows:
            details: list[str] = []
            if r[7]:
                try:
                    loaded = json.loads(str(r[7]))
                    if isinstance(loaded, list):
                        details = [str(x) for x in loaded]
                except Exception:
                    details = [str(r[7])]

            items.append(
                DataQualityFindingItem(
                    check_id=str(r[0]),
                    severity=str(r[1]).lower(),  # type: ignore[arg-type]
                    title=str(r[2]),
                    count=int(r[3]),
                    problem=str(r[4]),
                    impact=str(r[5]),
                    recommended_action=str(r[6]),
                    details=details,
                )
            )

        err_cnt = sum(1 for f in items if f.severity == "error")
        warn_cnt = sum(1 for f in items if f.severity == "warning")
        info_cnt = sum(1 for f in items if f.severity == "info")

        penalty = (err_cnt * 25.0) + (warn_cnt * 10.0)
        quality_score = max(0.0, 100.0 - penalty)
        if err_cnt > 0:
            health_status: HealthStatusLevel = "Critical"
        elif warn_cnt > 0:
            health_status = "Needs Attention"
        else:
            health_status = "Good"

        return DataQualityResponse(
            session_id=session_id,
            health_status=health_status,
            quality_score=quality_score,
            total_checks=8,
            error_count=err_cnt,
            warning_count=warn_cnt,
            info_count=info_cnt,
            findings=items,
        )

    # 3. If quality_findings is unpopulated, run audit on-demand
    st_df = con.execute("SELECT * FROM students").df()
    cr_df = con.execute("SELECT * FROM courses").df()
    sc_df = con.execute("SELECT * FROM scores").df()

    report = run_data_quality_audit(st_df, cr_df, sc_df, session_id="on_demand")

    finding_items: list[DataQualityFindingItem] = []
    for f in report.findings:
        finding_items.append(
            DataQualityFindingItem(
                check_id=f.check_id,
                severity=f.severity,  # type: ignore[arg-type]
                title=f.title,
                count=f.count,
                problem=f.problem,
                impact=f.impact,
                recommended_action=f.recommended_action,
                details=f.details,
            )
        )

    return DataQualityResponse(
        session_id=report.session_id,
        health_status=report.health_status,  # type: ignore[arg-type]
        quality_score=report.quality_score,
        total_checks=report.total_checks,
        error_count=report.error_count,
        warning_count=report.warning_count,
        info_count=report.info_count,
        findings=finding_items,
    )
