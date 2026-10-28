"""Overview summary aggregation service with dataset-level caching."""
from __future__ import annotations

import logging
from typing import Any
import duckdb

from app.api.schemas.overview import (
    DivisionResultRow,
    OutcomeCountPercent,
    OverviewDatasetMeta,
    OverviewFlaggedStudent,
    OverviewHardestSubject,
    OverviewHighlight,
    OverviewKpis,
    OverviewResults,
    OverviewSgpiDistribution,
    OverviewSummaryResponse,
    SgpiHistogramBin,
)
from app.services.anomaly_detection import _get_dataset_id_from_con, detect_all_anomalies
from app.services.subject_service import get_failure_summary_service

logger = logging.getLogger("eduquery.overview")

# In-memory cache for overview summaries: dataset_id -> OverviewSummaryResponse
_OVERVIEW_CACHE: dict[str, OverviewSummaryResponse] = {}


def clear_overview_cache(dataset_id: str | None = None) -> None:
    """Clear overview cache for a specific dataset or all datasets."""
    global _OVERVIEW_CACHE
    if dataset_id:
        _OVERVIEW_CACHE.pop(dataset_id, None)
    else:
        _OVERVIEW_CACHE.clear()


def to_title_case(text: str | None) -> str:
    """Convert full uppercase student names to clean title case."""
    if not text:
        return ""
    words = text.strip().split()
    return " ".join(word.capitalize() for word in words)


def get_overview_summary(
    con: duckdb.DuckDBPyConnection,
    dataset_name_hint: str | None = None,
    is_temporary_hint: bool = False,
    expires_in_minutes_hint: int | None = None,
) -> OverviewSummaryResponse:
    """Aggregate all overview metrics into a single response, cached per dataset."""
    dataset_id = _get_dataset_id_from_con(con)
    if dataset_id in _OVERVIEW_CACHE:
        return _OVERVIEW_CACHE[dataset_id]

    # 1. Cohort totals and counts
    st_row = con.execute("SELECT COUNT(*) FROM students").fetchone()
    total_students = int(st_row[0]) if st_row else 0

    cr_row = con.execute("SELECT COUNT(*) FROM courses").fetchone()
    total_courses = int(cr_row[0]) if cr_row else 0

    # Class division count
    div_count_row = con.execute(
        "SELECT COUNT(DISTINCT division) FROM students WHERE division IS NOT NULL AND division != ''"
    ).fetchone()
    divisions_count = int(div_count_row[0]) if div_count_row else 0

    # Passed / Failed / Absent breakdown
    results_rows = con.execute(
        """
        SELECT COALESCE(result, '') AS res, COUNT(*) AS cnt
        FROM students
        GROUP BY COALESCE(result, '')
        """
    ).fetchall()

    passed_count = 0
    failed_count = 0
    absent_count = 0

    for raw_res, cnt in results_rows:
        val = str(raw_res).strip().upper()
        if "PASS" in val:
            passed_count += cnt
        elif "FAIL" in val:
            failed_count += cnt
        elif "ABSENT" in val:
            absent_count += cnt
        else:
            # If not explicitly pass/fail/absent, check if marks are absent
            absent_count += cnt

    pass_rate = round((passed_count / total_students) * 100.0, 1) if total_students > 0 else 0.0
    fail_rate = round((failed_count / total_students) * 100.0, 1) if total_students > 0 else 0.0
    absent_rate = round((absent_count / total_students) * 100.0, 1) if total_students > 0 else 0.0

    # 2. SGPI statistics (exclude students without SGPI)
    sgpi_stats_row = con.execute(
        """
        SELECT 
            AVG(sgpi) as avg_val,
            MEDIAN(sgpi) as med_val,
            COUNT(sgpi) as with_sgpi,
            SUM(CASE WHEN sgpi IS NULL THEN 1 ELSE 0 END) as without_sgpi
        FROM students
        """
    ).fetchone()

    avg_sgpi = round(float(sgpi_stats_row[0]), 1) if sgpi_stats_row and sgpi_stats_row[0] is not None else None
    med_sgpi = round(float(sgpi_stats_row[1]), 1) if sgpi_stats_row and sgpi_stats_row[1] is not None else None
    students_with_sgpi = int(sgpi_stats_row[2]) if sgpi_stats_row and sgpi_stats_row[2] is not None else 0
    students_without_sgpi = int(sgpi_stats_row[3]) if sgpi_stats_row and sgpi_stats_row[3] is not None else 0

    # SGPI Histogram Bins: 0-1, 1-2, 2-3, 3-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10
    histogram_bins: list[SgpiHistogramBin] = []
    sgpi_rows = con.execute(
        "SELECT sgpi FROM students WHERE sgpi IS NOT NULL"
    ).fetchall()
    all_sgpi_vals = [float(r[0]) for r in sgpi_rows if r[0] is not None]

    for bin_idx in range(10):
        min_v = float(bin_idx)
        max_v = float(bin_idx + 1)
        label = f"{bin_idx}-{bin_idx + 1}"
        if bin_idx == 9:
            # 9-10 includes 10.0
            b_cnt = sum(1 for v in all_sgpi_vals if 9.0 <= v <= 10.0)
        else:
            b_cnt = sum(1 for v in all_sgpi_vals if min_v <= v < max_v)
        b_pct = round((b_cnt / students_with_sgpi) * 100.0, 1) if students_with_sgpi > 0 else 0.0
        histogram_bins.append(
            SgpiHistogramBin(
                bin_label=label,
                min_val=min_v,
                max_val=max_v,
                count=b_cnt,
                percentage=b_pct,
            )
        )

    # 3. Anomaly detection findings & Needs Attention
    findings, _ = detect_all_anomalies(con)
    unique_flagged_students: dict[str, Any] = {}
    for f in findings:
        if f.student_id not in unique_flagged_students:
            unique_flagged_students[f.student_id] = f

    needs_attention_count = len(unique_flagged_students)

    needs_attention_list: list[OverviewFlaggedStudent] = []
    for sid, f in list(unique_flagged_students.items())[:5]:
        reason_text = f.title or f.explanation
        needs_attention_list.append(
            OverviewFlaggedStudent(
                student_id=sid,
                student_name=to_title_case(f.student_name),
                severity=f.severity,
                reason=reason_text,
                finding_id=f.finding_id,
                record_link=f.record_link,
                evidence=f.evidence,
                recommended_action=f.recommended_action,
            )
        )

    # 4. Division Breakdown
    div_rows = con.execute(
        """
        SELECT 
            COALESCE(division, 'Unknown') AS div,
            COUNT(*) AS total,
            SUM(CASE WHEN UPPER(COALESCE(result, '')) LIKE '%PASS%' THEN 1 ELSE 0 END) AS pass_cnt
        FROM students
        GROUP BY COALESCE(division, 'Unknown')
        ORDER BY div ASC
        """
    ).fetchall()

    divisions_results: list[DivisionResultRow] = []
    for d_name, tot, p_cnt in div_rows:
        tot_i = int(tot)
        p_i = int(p_cnt or 0)
        d_rate = round((p_i / tot_i) * 100.0, 1) if tot_i > 0 else 0.0
        clean_code = str(d_name).strip()
        clean_label = f"Division {clean_code}" if not clean_code.lower().startswith("division") else clean_code
        divisions_results.append(
            DivisionResultRow(
                division=clean_label,
                division_code=clean_code,
                passed=p_i,
                enrolled=tot_i,
                pass_rate_percent=d_rate,
            )
        )

    # 5. Hardest Subjects (top 5 with tier rule from A1)
    # Tier rule: under 5% neutral gray, 5-15% amber, over 15% red
    failure_rep = get_failure_summary_service(con)
    hardest_subjects: list[OverviewHardestSubject] = []
    for item in failure_rep.summary[:5]:
        rate = round(item.failure_rate_percent, 1)
        if rate > 15.0:
            tier = "red"
        elif rate >= 5.0:
            tier = "amber"
        else:
            tier = "neutral"

        hardest_subjects.append(
            OverviewHardestSubject(
                course_code=item.course_code,
                course_title=to_title_case(item.course_name),
                failed_count=item.confirmed_failures_count,
                enrolled_count=item.total_enrolled,
                failure_rate_percent=rate,
                tier=tier,
            )
        )

    # 6. Highlights strip (up to 3 deterministic template sentences)
    highlights: list[OverviewHighlight] = []

    # Highlight 1: Hardest course
    if hardest_subjects and hardest_subjects[0].failed_count > 0:
        top_subj = hardest_subjects[0]
        highlights.append(
            OverviewHighlight(
                id="highest_failure_course",
                text=f"{top_subj.course_title} has the highest failure rate: {top_subj.failure_rate_percent:.1f}% ({top_subj.failed_count} students).",
                url=f"/subjects?search={top_subj.course_code}",
            )
        )

    # Highlight 2: Division comparison gap
    if len(divisions_results) >= 2:
        sorted_divs = sorted(divisions_results, key=lambda d: d.pass_rate_percent, reverse=True)
        top_div = sorted_divs[0]
        bot_div = sorted_divs[-1]
        diff_pts = round(top_div.pass_rate_percent - bot_div.pass_rate_percent, 1)
        if diff_pts > 0:
            highlights.append(
                OverviewHighlight(
                    id="division_pass_rate_gap",
                    text=f"{top_div.division}'s pass rate is {diff_pts:.1f} points higher than {bot_div.division}'s.",
                    url=f"/explore?division={top_div.division_code}",
                )
            )

    # Highlight 3: Multi-subject failures
    multi_fails_row = con.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT student_id
            FROM reconciliation
            WHERE UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%'
            GROUP BY student_id
            HAVING COUNT(*) >= 2
        )
        """
    ).fetchone()
    multi_fails_cnt = int(multi_fails_row[0]) if multi_fails_row else 0
    if multi_fails_cnt > 0:
        highlights.append(
            OverviewHighlight(
                id="multi_subject_failures",
                text=f"{multi_fails_cnt} students failed two or more subjects.",
                url="/explore?multi_fails=true",
            )
        )

    # Dataset metadata
    dataset_name = dataset_name_hint or "Uploaded Marksheet"
    is_temp = is_temporary_hint or dataset_id.startswith("session_")
    if is_temp:
        exp_min = expires_in_minutes_hint if expires_in_minutes_hint is not None else 60
        status_label = f"Temporary session · expires in {exp_min} min"
    else:
        status_label = "Saved dataset"

    response = OverviewSummaryResponse(
        dataset=OverviewDatasetMeta(
            id=dataset_id,
            name=dataset_name,
            status_label=status_label,
            is_temporary=is_temp,
            expires_in_minutes=expires_in_minutes_hint if is_temp else None,
        ),
        kpis=OverviewKpis(
            total_students=total_students,
            total_courses=total_courses,
            passed_students=passed_count,
            failed_students=failed_count,
            absent_students=absent_count,
            pass_rate_percent=pass_rate,
            divisions_count=divisions_count,
            needs_attention_count=needs_attention_count,
            sgpi_average=avg_sgpi,
            sgpi_median=med_sgpi,
            students_with_sgpi=students_with_sgpi,
            students_without_sgpi=students_without_sgpi,
        ),
        needs_attention=needs_attention_list,
        results=OverviewResults(
            passed=OutcomeCountPercent(count=passed_count, percentage=pass_rate),
            failed=OutcomeCountPercent(count=failed_count, percentage=fail_rate),
            absent=OutcomeCountPercent(count=absent_count, percentage=absent_rate),
            divisions=divisions_results,
        ),
        sgpi_distribution=OverviewSgpiDistribution(
            average=avg_sgpi,
            median=med_sgpi,
            students_with_sgpi=students_with_sgpi,
            students_without_sgpi=students_without_sgpi,
            bins=histogram_bins,
        ),
        hardest_subjects=hardest_subjects,
        highlights=highlights,
    )

    _OVERVIEW_CACHE[dataset_id] = response
    return response
