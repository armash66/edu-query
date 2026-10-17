"""Academic integrity validator and data-quality auditor for EduQuery V3."""
from __future__ import annotations

import pandas as pd

from app.core.models import DataQualityFinding, DataQualityReport


def run_data_quality_audit(
    students_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    scores_df: pd.DataFrame,
    session_id: str = "",
) -> DataQualityReport:
    """Run full academic integrity check suite across normalized marksheet tables."""
    findings: list[DataQualityFinding] = []
    total_checks = 8

    # 1. Duplicate student identifiers
    if not students_df.empty and "student_id" in students_df.columns:
        dup_sids = students_df[students_df.duplicated(subset=["student_id"], keep=False)]
        if not dup_sids.empty:
            distinct_dups = dup_sids["student_id"].unique().tolist()
            sample_details = [
                f"Student ID: {sid} (Name: {students_df.loc[students_df['student_id'] == sid, 'name'].iloc[0]})"
                for sid in distinct_dups[:5]
            ]
            findings.append(
                DataQualityFinding(
                    check_id="duplicate_student_id",
                    severity="error",
                    title="Duplicate Student Identifiers",
                    count=len(distinct_dups),
                    problem=f"{len(distinct_dups)} student identifier(s) appear multiple times in the marksheet.",
                    impact="Duplicate student identifiers corrupt cohort headcounts, rankings, and pass/fail calculations.",
                    recommended_action="Ensure student identifiers (Roll No / Seat No) are unique across student rows.",
                    details=sample_details,
                )
            )

    # 2. Missing student identifiers
    if not students_df.empty and "student_id" in students_df.columns:
        blank_sids = students_df[students_df["student_id"].isna() | (students_df["student_id"].astype(str).str.strip() == "")]
        if not blank_sids.empty:
            findings.append(
                DataQualityFinding(
                    check_id="missing_student_id",
                    severity="error",
                    title="Missing Student Identifiers",
                    count=len(blank_sids),
                    problem=f"{len(blank_sids)} student record(s) lack a valid student key or roll number.",
                    impact="Scores cannot be attributed to specific students, creating orphaned mark records.",
                    recommended_action="Provide unique roll numbers or remove empty placeholder rows.",
                    details=[f"Row index {idx + 1}" for idx in blank_sids.index[:5]],
                )
            )

    # 3. Unparsed marks and malformed cells
    if not scores_df.empty and "state" in scores_df.columns:
        unparsed = scores_df[scores_df["state"] == "unparsed"]
        if not unparsed.empty:
            sample_details = [
                f"Student {r.student_id} in {r.course_code} ({r.component}): raw_text={r.raw_text!r}"
                for r in unparsed.itertuples()
            ][:5]
            findings.append(
                DataQualityFinding(
                    check_id="unparsed_marks",
                    severity="error",
                    title="Unparsed Marks / Malformed Cells",
                    count=len(unparsed),
                    problem=f"{len(unparsed)} score cell(s) contain unparseable or unrecognized text patterns.",
                    impact="Malformed cells cannot be converted to numeric scores and risk distorting calculations.",
                    recommended_action="Review cell formatting in the spreadsheet and correct non-standard notations.",
                    details=sample_details,
                )
            )

    # 4. Out-of-range marks (< 0 or > 100)
    if not scores_df.empty and "value" in scores_df.columns:
        numeric_scores = scores_df[scores_df["value"].notna()]
        out_of_bounds = numeric_scores[(numeric_scores["value"] < 0) | (numeric_scores["value"] > 100)]
        if not out_of_bounds.empty:
            sample_details = [
                f"Student {r.student_id} in {r.course_code} ({r.component}): score {r.value}"
                for r in out_of_bounds.itertuples()
            ][:5]
            findings.append(
                DataQualityFinding(
                    check_id="out_of_range_marks",
                    severity="error",
                    title="Out-of-Range Marks",
                    count=len(out_of_bounds),
                    problem=f"{len(out_of_bounds)} score entries are negative or exceed the maximum limit of 100.",
                    impact="Distorts average calculations, grade band assignments, and rankings.",
                    recommended_action="Check the original spreadsheet for typing errors or incorrect scale definitions.",
                    details=sample_details,
                )
            )

    # 5. Component sum mismatches printed total
    if not scores_df.empty and "component" in scores_df.columns:
        comp_scores = scores_df[~scores_df["component"].isin(["TOT", "TOT1", "TOTAL"]) & scores_df["value"].notna()]
        tot_scores = scores_df[scores_df["component"].isin(["TOT", "TOT1", "TOTAL"]) & scores_df["value"].notna()]
        if not comp_scores.empty and not tot_scores.empty:
            comp_sums = (
                comp_scores.groupby(["student_id", "course_code"])["value"]
                .sum()
                .reset_index(name="computed_tot")
            )
            merged_tots = pd.merge(tot_scores, comp_sums, on=["student_id", "course_code"])
            mismatches = merged_tots[
                (abs(merged_tots["value"] - merged_tots["computed_tot"]) > 0.05)
            ]
            if not mismatches.empty:
                findings.append(
                    DataQualityFinding(
                        check_id="inconsistent_totals",
                        severity="warning",
                        title="Component Sum Mismatches Printed Total",
                        count=len(mismatches),
                        problem=f"{len(mismatches)} record(s) exhibit differences between printed total marks and summed components.",
                        impact="Queries relying on TOT1 may diverge from raw component aggregations.",
                        recommended_action="Verify whether grace marks, scaling, or rounding was applied to total marks.",
                        details=[
                            f"Student {r.student_id} in {r.course_code}: printed={r.value}, sum={r.computed_tot}"
                            for r in mismatches.itertuples()
                        ][:5],
                    )
                )

    # 6. Recorded result vs Component failure consistency
    if not students_df.empty and "result" in students_df.columns and not scores_df.empty:
        # Check if sheet contains recorded results
        has_recorded_results = students_df["result"].notna().any()
        if has_recorded_results:
            # Check for students with result == 'PASSES' but with failure flags ('E', 'F', 'AB')
            flagged_failed_sids = set(scores_df[scores_df["flag"].isin(["E", "F", "AB"])]["student_id"].unique())
            passing_students = students_df[students_df["result"].astype(str).str.upper() == "PASSES"]
            mismatched_passes = passing_students[passing_students["student_id"].isin(flagged_failed_sids)]
            if not mismatched_passes.empty:
                findings.append(
                    DataQualityFinding(
                        check_id="result_mismatch_pass_with_failure_flags",
                        severity="warning",
                        title="Recorded Pass with Failing Component Flags",
                        count=len(mismatched_passes),
                        problem=f"{len(mismatched_passes)} student(s) are recorded as PASSES but carry failing flags (E/F/AB) in components.",
                        impact="Recorded result may conflict with component-level academic pass rules.",
                        recommended_action="Verify if compensatory condonation / grace marks were granted to pass the student.",
                        details=[f"Student ID: {r.student_id} ({r.name})" for r in mismatched_passes.itertuples()][:5],
                    )
                )

    # 7. Absent vs Genuine Zero Distribution
    if not scores_df.empty and "flag" in scores_df.columns and "value" in scores_df.columns:
        absent_entries = scores_df[scores_df["flag"].isin(["AB", "ABS"])]
        zero_entries = scores_df[scores_df["value"] == 0.0]
        if not absent_entries.empty or not zero_entries.empty:
            findings.append(
                DataQualityFinding(
                    check_id="absent_vs_zero",
                    severity="info",
                    title="Absent vs Numeric Zero Distribution",
                    count=len(absent_entries) + len(zero_entries),
                    problem=f"Found {len(absent_entries)} Absent ('AB'/'ABS') record(s) and {len(zero_entries)} genuine numeric zero(s).",
                    impact="EduQuery enforces semantic safety: absent students are excluded from averages and not conflated with zero marks.",
                    recommended_action="Informational: Semantic safety invariants are active.",
                    details=[
                        f"Absent records: {len(absent_entries)} cells",
                        f"Zero records: {len(zero_entries)} cells",
                    ],
                )
            )

    # 8. Missing recorded result in workbook
    if not students_df.empty and "result" in students_df.columns:
        null_res_count = students_df["result"].isna().sum()
        if null_res_count == len(students_df):
            findings.append(
                DataQualityFinding(
                    check_id="no_recorded_result_column",
                    severity="info",
                    title="No Recorded PASS/FAIL Summary in Workbook",
                    count=null_res_count,
                    problem="This workbook does not contain a printed RESULT summary column; pass/fail must be derived dynamically.",
                    impact="System will compute pass/fail status directly from course/component thresholds.",
                    recommended_action="Configure course passing thresholds in settings if default (40) is not applicable.",
                    details=["All student rows lack a printed RESULT field."],
                )
            )
        elif null_res_count > 0:
            findings.append(
                DataQualityFinding(
                    check_id="partial_missing_results",
                    severity="warning",
                    title="Incomplete Recorded Result Status",
                    count=int(null_res_count),
                    problem=f"{null_res_count} student record(s) have a blank RESULT field while others are populated.",
                    impact="Some students may require manual verification of their academic outcome.",
                    recommended_action="Verify if results for these students are withheld or pending moderation.",
                    details=[f"Student ID: {r.student_id}" for r in students_df[students_df["result"].isna()].itertuples()][:5],
                )
            )

    error_cnt = sum(1 for f in findings if f.severity == "error")
    warn_cnt = sum(1 for f in findings if f.severity == "warning")
    info_cnt = sum(1 for f in findings if f.severity == "info")

    penalty = (error_cnt * 25.0) + (warn_cnt * 10.0)
    quality_score = max(0.0, 100.0 - penalty)
    if error_cnt > 0:
        health_status = "Critical"
    elif warn_cnt > 0:
        health_status = "Needs Attention"
    else:
        health_status = "Good"

    return DataQualityReport(
        session_id=session_id,
        total_checks=total_checks,
        error_count=error_cnt,
        warning_count=warn_cnt,
        info_count=info_cnt,
        quality_score=quality_score,
        health_status=health_status,
        findings=findings,
    )
