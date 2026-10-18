"""Academic analysis services for EduQuery V3 workspace."""
from __future__ import annotations

from typing import Any
import duckdb

from app.api.schemas.analytics import (
    ActionableFindingItem,
    AnalysisRegistryItem,
    AnalysisRegistryResponse,
    CoFailingSubjectPair,
    DistributionBucket,
    DistributionsResponse,
    DivisionComparisonResponse,
    DivisionCoursePerformanceItem,
    DivisionMetricItem,
    FailurePatternsResponse,
    GradeFrequency,
    MultiFailingStudentItem,
    OutcomeDistributionItem,
    TopFailingCourseItem,
    AnalyticsOverviewResponse,
)
from app.reports.student_breakdown import PASSING_GRADES, FAILING_GRADES
from app.services.data_quality_service import get_data_quality_service
from app.services.subject_service import get_failure_summary_service


def get_analysis_registry() -> AnalysisRegistryResponse:
    """Return typed registry of supported analytical workspace capabilities."""
    analyses = [
        AnalysisRegistryItem(
            id="overall_outcome",
            name="Cohort Outcome Distribution",
            category="Performance Overview",
            description="High-level proportion of confirmed passed, failed, and unresolved student outcomes.",
            available=True,
            drill_down_path="/explore?result=",
            supports_csv=True,
        ),
        AnalysisRegistryItem(
            id="subject_failures",
            name="Subject Failure Ranking",
            category="Curriculum Diagnostics",
            description="Ranked list of courses by confirmed failure counts and failure rates with correct denominators.",
            available=True,
            drill_down_path="/subjects",
            supports_csv=True,
        ),
        AnalysisRegistryItem(
            id="division_comparison",
            name="Cross-Division Performance",
            category="Comparative Analysis",
            description="Comparative student enrollment, passing rates, and subject failure rates across divisions.",
            available=True,
            drill_down_path="/explore?division=",
            supports_csv=True,
        ),
        AnalysisRegistryItem(
            id="failure_patterns",
            name="Multi-Subject Failure Patterns",
            category="Failure Pattern Detection",
            description="Identification of students failing multiple courses and subjects that frequently co-fail.",
            available=True,
            drill_down_path="/explore?multi_fails=true",
            supports_csv=True,
        ),
        AnalysisRegistryItem(
            id="distributions",
            name="Marks & Grade Distributions",
            category="Statistical Analysis",
            description="Binned marks histograms and letter grade frequencies for curriculum courses.",
            available=True,
            drill_down_path="/explore?course=",
            supports_csv=True,
        ),
        AnalysisRegistryItem(
            id="data_quality_alerts",
            name="Data Integrity Findings",
            category="Academic Audit",
            description="Deterministic data quality audit findings, reconciliation mismatches, and layout checks.",
            available=True,
            drill_down_path="/data-quality",
            supports_csv=False,
        ),
    ]
    return AnalysisRegistryResponse(analyses=analyses)


def get_analytics_overview(con: duckdb.DuckDBPyConnection) -> AnalyticsOverviewResponse:
    """Generate executive academic analysis overview across active marksheet dataset."""
    # 1. Total counts
    st_row = con.execute("SELECT COUNT(*) FROM students").fetchone()
    total_students = int(st_row[0]) if st_row else 0

    cr_row = con.execute("SELECT COUNT(*) FROM courses").fetchone()
    total_courses = int(cr_row[0]) if cr_row else 0

    if total_students == 0 or total_courses == 0:
        return AnalyticsOverviewResponse(
            total_students=total_students,
            total_courses=total_courses,
            passed_students=0,
            failed_students=0,
            unresolved_students=0,
            conflicting_students=0,
            quality_score=100.0,
            outcome_distribution=[],
            top_failing_courses=[],
            division_summary=[],
            findings=[],
        )

    # 2. Overall outcome distribution
    results_rows = con.execute(
        """
        SELECT COALESCE(result, '') AS res, COUNT(*) AS cnt
        FROM students
        GROUP BY COALESCE(result, '')
        """
    ).fetchall()

    passed_count = 0
    failed_count = 0
    unresolved_count = 0

    for raw_res, cnt in results_rows:
        val = str(raw_res).strip().upper()
        if "PASS" in val:
            passed_count += cnt
        elif "FAIL" in val:
            failed_count += cnt
        else:
            unresolved_count += cnt

    outcomes: list[OutcomeDistributionItem] = []
    if total_students > 0:
        outcomes.append(
            OutcomeDistributionItem(
                status="Passed",
                count=passed_count,
                percentage=round((passed_count / total_students) * 100.0, 1),
            )
        )
        outcomes.append(
            OutcomeDistributionItem(
                status="Failed",
                count=failed_count,
                percentage=round((failed_count / total_students) * 100.0, 1),
            )
        )
        if unresolved_count > 0:
            outcomes.append(
                OutcomeDistributionItem(
                    status="Unresolved",
                    count=unresolved_count,
                    percentage=round((unresolved_count / total_students) * 100.0, 1),
                )
            )

    # 3. Conflicting student count (passing course grade + component failure flag)
    conflicting_row = con.execute(
        """
        SELECT COUNT(DISTINCT student_id)
        FROM reconciliation
        WHERE UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS')
          AND UPPER(flags) LIKE '%F%'
        """
    ).fetchone()
    conflicting_students = int(conflicting_row[0]) if conflicting_row else 0

    # 4. Top failing courses (from verified subject failure summary)
    failure_rep = get_failure_summary_service(con)
    top_failing_courses: list[TopFailingCourseItem] = []
    for item in failure_rep.summary[:5]:
        if item.confirmed_failures_count > 0:
            top_failing_courses.append(
                TopFailingCourseItem(
                    course_code=item.course_code,
                    course_name=item.course_name,
                    enrolled_count=item.total_enrolled,
                    failed_count=item.confirmed_failures_count,
                    failure_rate_percent=round(item.failure_rate_percent, 1),
                )
            )

    # 5. Division performance summary
    div_rows = con.execute(
        """
        SELECT 
            COALESCE(division, 'Unknown') AS div,
            COUNT(*) AS total,
            SUM(CASE WHEN UPPER(COALESCE(result, '')) LIKE '%PASS%' THEN 1 ELSE 0 END) AS pass_cnt,
            SUM(CASE WHEN UPPER(COALESCE(result, '')) LIKE '%FAIL%' THEN 1 ELSE 0 END) AS fail_cnt
        FROM students
        GROUP BY COALESCE(division, 'Unknown')
        ORDER BY div ASC
        """
    ).fetchall()

    division_summary: list[DivisionMetricItem] = []
    for d_name, tot, p_cnt, f_cnt in div_rows:
        tot_i = int(tot)
        p_i = int(p_cnt or 0)
        f_i = int(f_cnt or 0)
        unres_i = tot_i - (p_i + f_i)
        p_rate = round((p_i / tot_i) * 100.0, 1) if tot_i > 0 else 0.0
        division_summary.append(
            DivisionMetricItem(
                division=str(d_name),
                student_count=tot_i,
                passed_count=p_i,
                failed_count=f_i,
                unresolved_count=unres_i,
                pass_rate_percent=p_rate,
            )
        )

    # 6. Data quality score
    dq = get_data_quality_service(con)
    quality_score = dq.quality_score

    # 7. Deterministic Actionable Findings
    findings: list[ActionableFindingItem] = []

    # Finding A: Highest failing subject
    if top_failing_courses:
        highest_course = top_failing_courses[0]
        findings.append(
            ActionableFindingItem(
                id="highest_failing_course",
                severity="warning" if highest_course.failure_rate_percent < 25.0 else "critical",
                title=f"Elevated Failure Concentration: {highest_course.course_code}",
                metric=f"{highest_course.failed_count} Failures ({highest_course.failure_rate_percent:.1f}%)",
                description=(
                    f"{highest_course.course_name} ({highest_course.course_code}) has the highest failure "
                    f"rate in the catalog with {highest_course.failed_count} failing students out of "
                    f"{highest_course.enrolled_count} enrolled."
                ),
                drill_down_url=f"/subjects/{highest_course.course_code}/failures",
                count=highest_course.failed_count,
            )
        )

    # Finding B: Students failing multiple courses
    multi_fails_row = con.execute(
        """
        WITH fail_records AS (
            SELECT student_id, course_code
            FROM reconciliation
            WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
              AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
        )
        SELECT COUNT(*)
        FROM (
            SELECT student_id
            FROM fail_records
            GROUP BY student_id
            HAVING COUNT(DISTINCT course_code) >= 2
        )
        """
    ).fetchone()
    multi_fail_count = int(multi_fails_row[0]) if multi_fails_row else 0

    if multi_fail_count > 0:
        findings.append(
            ActionableFindingItem(
                id="multi_subject_failures",
                severity="critical",
                title="Multi-Subject Academic Deficiencies",
                metric=f"{multi_fail_count} Students",
                description=(
                    f"{multi_fail_count} students have confirmed failure records across two or more "
                    "distinct curriculum subjects, requiring remedial counseling or ATKT evaluation."
                ),
                drill_down_url="/explore?multi_fails=true",
                count=multi_fail_count,
            )
        )

    # Finding C: Division performance disparity
    if len(division_summary) >= 2:
        sorted_divs = sorted(division_summary, key=lambda d: d.pass_rate_percent)
        lowest_div = sorted_divs[0]
        highest_div = sorted_divs[-1]
        gap = round(highest_div.pass_rate_percent - lowest_div.pass_rate_percent, 1)
        if gap >= 5.0:
            findings.append(
                ActionableFindingItem(
                    id="division_gap",
                    severity="info",
                    title=f"Division Variance: Div {lowest_div.division} vs Div {highest_div.division}",
                    metric=f"{gap}% Pass Gap",
                    description=(
                        f"Division {lowest_div.division} has a pass rate of {lowest_div.pass_rate_percent}%, "
                        f"which is {gap}% lower than Division {highest_div.division} ({highest_div.pass_rate_percent}%)."
                    ),
                    drill_down_url=f"/explore?division={lowest_div.division}",
                    count=lowest_div.failed_count,
                )
            )

    # Finding D: Conflicting records alert
    if conflicting_students > 0:
        findings.append(
            ActionableFindingItem(
                id="conflicting_records",
                severity="warning",
                title="Conflicting Marksheet Indicators",
                metric=f"{conflicting_students} Records",
                description=(
                    f"{conflicting_students} course record(s) contain conflicting indicators (passing course letter "
                    "grade alongside an assessment component 'F' flag) requiring administrative verification."
                ),
                drill_down_url="/explore?result=unresolved",
                count=conflicting_students,
            )
        )

    # Finding E: Data Quality Findings
    if dq.error_count > 0 or dq.warning_count > 0:
        findings.append(
            ActionableFindingItem(
                id="data_integrity_audit",
                severity="warning" if dq.error_count == 0 else "critical",
                title="Marksheet Data Integrity Findings",
                metric=f"{dq.quality_score}% Score ({dq.error_count} Errors, {dq.warning_count} Warnings)",
                description=(
                    f"The automated data quality audit detected {dq.error_count} error(s) and {dq.warning_count} "
                    "warning(s) in totals reconciliation or mark ranges."
                ),
                drill_down_url="/data-quality",
                count=dq.error_count + dq.warning_count,
            )
        )

    return AnalyticsOverviewResponse(
        total_students=total_students,
        total_courses=total_courses,
        passed_students=passed_count,
        failed_students=failed_count,
        unresolved_students=unresolved_count,
        conflicting_students=conflicting_students,
        quality_score=quality_score,
        outcome_distribution=outcomes,
        top_failing_courses=top_failing_courses,
        division_summary=division_summary,
        findings=findings,
    )


def get_division_comparison(con: duckdb.DuckDBPyConnection) -> DivisionComparisonResponse:
    """Compute cross-division comparison and course-level division breakdown."""
    overview = get_analytics_overview(con)

    # Course breakdown per division
    course_div_rows = con.execute(
        """
        WITH course_failures AS (
            SELECT 
                r.course_code,
                s.student_id,
                COALESCE(s.division, 'Unknown') AS division,
                CASE 
                    WHEN (UPPER(TRIM(r.grade)) IN ('F', 'FAIL') OR UPPER(r.flags) LIKE '%F%')
                         AND NOT (UPPER(TRIM(r.grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(r.flags) LIKE '%F%')
                    THEN 1 ELSE 0 
                END AS is_failed
            FROM reconciliation r
            JOIN students s ON r.student_id = s.student_id
        )
        SELECT 
            e.course_code,
            c.name,
            COALESCE(s.division, 'Unknown') AS div,
            COUNT(e.student_id) AS enrolled,
            COALESCE(SUM(cf.is_failed), 0) AS failed
        FROM enrollment e
        JOIN courses c ON e.course_code = c.code
        JOIN students s ON e.student_id = s.student_id
        LEFT JOIN course_failures cf ON e.course_code = cf.course_code AND e.student_id = cf.student_id
        GROUP BY e.course_code, c.name, COALESCE(s.division, 'Unknown')
        ORDER BY e.course_code ASC, div ASC
        """
    ).fetchall()

    breakdown: list[DivisionCoursePerformanceItem] = []
    for c_code, c_name, div, enrolled, failed in course_div_rows:
        enr_i = int(enrolled)
        f_i = int(failed)
        rate = round((f_i / enr_i) * 100.0, 1) if enr_i > 0 else 0.0
        breakdown.append(
            DivisionCoursePerformanceItem(
                course_code=str(c_code),
                course_name=str(c_name),
                division=str(div),
                enrolled=enr_i,
                failed=f_i,
                failure_rate_percent=rate,
            )
        )

    return DivisionComparisonResponse(
        divisions=overview.division_summary,
        course_breakdown=breakdown,
    )


def get_failure_patterns(con: duckdb.DuckDBPyConnection) -> FailurePatternsResponse:
    """Compute multi-subject failure patterns and co-failing subject pairs."""
    # 1. Distinct failed courses per student
    fail_records = con.execute(
        """
        SELECT 
            r.student_id,
            s.name,
            s.roll_no,
            s.seat_no,
            s.division,
            r.course_code
        FROM reconciliation r
        JOIN students s ON r.student_id = s.student_id
        WHERE (UPPER(TRIM(r.grade)) IN ('F', 'FAIL') OR UPPER(r.flags) LIKE '%F%')
          AND NOT (UPPER(TRIM(r.grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(r.flags) LIKE '%F%')
        ORDER BY r.student_id, r.course_code
        """
    ).fetchall()

    student_fails: dict[str, dict[str, Any]] = {}
    for sid, name, roll, seat, div, c_code in fail_records:
        if sid not in student_fails:
            student_fails[sid] = {
                "name": name,
                "roll_no": roll,
                "seat_no": seat,
                "division": div,
                "courses": [],
            }
        student_fails[sid]["courses"].append(str(c_code))

    # Histogram
    hist: dict[str, int] = {"1_course": 0, "2_courses": 0, "3_plus_courses": 0}
    multi_students: list[MultiFailingStudentItem] = []

    for sid, data in student_fails.items():
        cnt = len(data["courses"])
        if cnt == 1:
            hist["1_course"] += 1
        elif cnt == 2:
            hist["2_courses"] += 1
            multi_students.append(
                MultiFailingStudentItem(
                    student_id=sid,
                    name=data["name"],
                    roll_no=data["roll_no"],
                    seat_no=data["seat_no"],
                    division=data["division"],
                    failed_courses_count=cnt,
                    failed_courses=data["courses"],
                )
            )
        elif cnt >= 3:
            hist["3_plus_courses"] += 1
            multi_students.append(
                MultiFailingStudentItem(
                    student_id=sid,
                    name=data["name"],
                    roll_no=data["roll_no"],
                    seat_no=data["seat_no"],
                    division=data["division"],
                    failed_courses_count=cnt,
                    failed_courses=data["courses"],
                )
            )

    multi_students.sort(key=lambda s: s.failed_courses_count, reverse=True)

    # Co-failing course pairs
    pair_counts: dict[tuple[str, str], int] = {}
    for sid, data in student_fails.items():
        courses = sorted(set(data["courses"]))
        for i in range(len(courses)):
            for j in range(i + 1, len(courses)):
                pair = (courses[i], courses[j])
                pair_counts[pair] = pair_counts.get(pair, 0) + 1

    co_pairs: list[CoFailingSubjectPair] = [
        CoFailingSubjectPair(course_a=p[0], course_b=p[1], co_fail_count=cnt)
        for p, cnt in sorted(pair_counts.items(), key=lambda item: item[1], reverse=True)
        if cnt >= 1
    ]

    return FailurePatternsResponse(
        failure_count_histogram=hist,
        multi_failing_students=multi_students,
        co_failing_pairs=co_pairs[:10],
    )


def get_distributions(
    con: duckdb.DuckDBPyConnection,
    course_code: str | None = None,
    division: str | None = None,
) -> DistributionsResponse:
    """Compute score range histograms and letter grade frequency distributions."""
    params: list[Any] = []
    where_clauses: list[str] = []

    if course_code and course_code.strip():
        where_clauses.append("r.course_code = ?")
        params.append(course_code.strip())

    if division and division.strip():
        where_clauses.append("s.division = ?")
        params.append(division.strip())

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    if course_code:
        # Course-specific marks (printed_total or computed_total)
        query = f"""
            SELECT 
                COALESCE(r.printed_total, r.computed_total) AS mark,
                COALESCE(r.grade, '') AS grade
            FROM reconciliation r
            JOIN students s ON r.student_id = s.student_id
            {where_sql}
        """
        rows = con.execute(query, params).fetchall()
    else:
        # Cohort total marks across students
        st_where = ("WHERE division = ?" if division and division.strip() else "")
        st_params = [division.strip()] if division and division.strip() else []
        rows = con.execute(
            f"SELECT total_marks AS mark, result AS grade FROM students {st_where}",
            st_params,
        ).fetchall()

    valid_marks = [float(r[0]) for r in rows if r[0] is not None]
    total_records = len(valid_marks)

    # 1. Binned buckets
    buckets: list[DistributionBucket] = []
    if course_code:
        # Standard 100-point course scale
        ranges = [
            ("0–39", 0.0, 39.9),
            ("40–49", 40.0, 49.9),
            ("50–59", 50.0, 59.9),
            ("60–69", 60.0, 69.9),
            ("70–79", 70.0, 79.9),
            ("80–89", 80.0, 89.9),
            ("90–100", 90.0, 100.0),
        ]
        for label, min_v, max_v in ranges:
            cnt = sum(1 for m in valid_marks if min_v <= m <= max_v)
            buckets.append(DistributionBucket(label=label, min_val=min_v, max_val=max_v, count=cnt))
    else:
        # Cohort grand total (determine dynamic min/max)
        if valid_marks:
            min_m = min(valid_marks)
            max_m = max(valid_marks)
            step = max(50.0, round((max_m - min_m) / 6.0, -1))
            cur = (min_m // 50) * 50
            while cur < max_m:
                nxt = cur + step
                cnt = sum(1 for m in valid_marks if cur <= m < nxt)
                buckets.append(
                    DistributionBucket(label=f"{int(cur)}–{int(nxt)-1}", min_val=cur, max_val=nxt - 0.1, count=cnt)
                )
                cur = nxt

    # 2. Grade frequencies
    grade_counts: dict[str, int] = {}
    for r in rows:
        g = str(r[1]).strip().upper() if r[1] is not None else "UNASSIGNED"
        if g:
            grade_counts[g] = grade_counts.get(g, 0) + 1

    grades_list: list[GradeFrequency] = []
    tot_eval = sum(grade_counts.values())
    for g, cnt in sorted(grade_counts.items(), key=lambda x: x[1], reverse=True):
        pct = round((cnt / tot_eval) * 100.0, 1) if tot_eval > 0 else 0.0
        grades_list.append(GradeFrequency(grade=g, count=cnt, percentage=pct))

    return DistributionsResponse(
        course_code=course_code,
        total_records=total_records,
        score_buckets=buckets,
        grade_frequencies=grades_list,
    )
