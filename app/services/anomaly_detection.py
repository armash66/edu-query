"""Explainable Academic Anomaly Detection Service for EduQuery V3.

Implements a 3-tier explainable anomaly detection architecture:
- Tier A: Deterministic academic validation rules (printed total vs computed total mismatches,
          boundary violations, conflicting pass/fail indicators).
- Tier B: Robust univariate & bivariate statistical baselines (Median Absolute Deviation / Robust Z-Scores,
          intra-student cross-course variance).
- Tier C: Multivariate numerical Isolation Forest for detecting unusual multi-dimensional score patterns.

Strict Safety Invariants:
1. Deterministic rules are NEVER labeled as ML predictions.
2. Isolation Forest decision values are NEVER labeled or presented as probabilities.
3. No anomaly finding modifies or overrides official academic pass/fail outcomes.
4. Unresolved or incomplete records are excluded from statistical/ML models with documented reasons.
5. Every finding includes human-readable explanations, feature contributions, and explicit limitation disclaimers.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
import math
import os
from pathlib import Path
from typing import Any
import duckdb
import numpy as np
from sklearn.ensemble import IsolationForest

from app.api.schemas.anomaly import (
    AnomalyCategory,
    AnomalyFindingItem,
    AnomalyListResponse,
    AnomalyMethod,
    AnomalyReviewResponse,
    AnomalySeverity,
    AnomalySummaryResponse,
    GroupedAnomalyRecord,
)

logger = logging.getLogger("eduquery.anomalies")

# Memory cache for active dataset reviews: dataset_id -> finding_id -> review_dict
_REVIEWS_CACHE: dict[str, dict[str, dict[str, Any]]] = {}


def _get_reviews_dir() -> Path:
    env_dir = os.getenv("EDUQUERY_DATA_DIR")
    if env_dir:
        data_dir = env_dir
    else:
        from app.config import get_settings
        settings = get_settings()
        data_dir = getattr(settings, "data_dir", "data")
    r_dir = Path(data_dir) / "reviews"
    r_dir.mkdir(parents=True, exist_ok=True)
    return r_dir


def _get_dataset_id_from_con(con: duckdb.DuckDBPyConnection | None) -> str:
    if con is None:
        return "default"
    try:
        rows = con.execute("PRAGMA database_list").fetchall()
        for _, name, path in rows:
            if path and str(path).endswith(".duckdb"):
                p = Path(path)
                parts_lower = [part.lower() for part in p.parts]
                if "sessions" in parts_lower:
                    idx = parts_lower.index("sessions")
                    if idx + 1 < len(p.parts) - 1:
                        return f"session_{p.parts[idx + 1]}"
                    elif p.parent.name and p.parent.name != "sessions":
                        return f"session_{p.parent.name}"
                return p.stem
        lp = con.execute("SELECT fingerprint FROM layout_profiles LIMIT 1").fetchone()
        if lp and lp[0]:
            return f"mem_{lp[0]}"
    except Exception:
        pass
    return "default"


def _load_reviews_store(dataset_id: str = "default") -> dict[str, dict[str, Any]]:
    if dataset_id in _REVIEWS_CACHE:
        return _REVIEWS_CACHE[dataset_id]

    if dataset_id.startswith("session_"):
        clean_sid = dataset_id.replace("session_", "")
        r_file = _get_reviews_dir().parent / "sessions" / clean_sid / "reviews.json"
    else:
        r_file = _get_reviews_dir() / f"{dataset_id}_reviews.json"

    reviews: dict[str, dict[str, Any]] = {}
    if r_file.is_file():
        try:
            reviews = json.loads(r_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Could not load reviews file %s: %s", r_file, exc)
            reviews = {}
    _REVIEWS_CACHE[dataset_id] = reviews
    return reviews


def _save_reviews_store(dataset_id: str, reviews: dict[str, dict[str, Any]]) -> None:
    _REVIEWS_CACHE[dataset_id] = reviews
    if dataset_id.startswith("session_"):
        clean_sid = dataset_id.replace("session_", "")
        r_dir = _get_reviews_dir().parent / "sessions" / clean_sid
        r_dir.mkdir(parents=True, exist_ok=True)
        r_file = r_dir / "reviews.json"
        tmp_file = r_dir / "reviews.json.tmp"
    else:
        r_dir = _get_reviews_dir()
        r_file = r_dir / f"{dataset_id}_reviews.json"
        tmp_file = r_dir / f"{dataset_id}_reviews.json.tmp"

    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(reviews, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_file, r_file)
    except Exception as exc:
        tmp_file.unlink(missing_ok=True)
        logger.warning("Could not persist reviews for dataset %s: %s", dataset_id, exc)


def _get_review_status(finding_id: str, dataset_id: str = "default") -> dict[str, Any]:
    reviews = _load_reviews_store(dataset_id)
    return reviews.get(
        finding_id,
        {
            "reviewed": False,
            "reviewed_by": None,
            "reviewed_at": None,
            "review_notes": None,
        },
    )


def review_anomaly_finding(
    finding_id: str,
    reviewed: bool,
    reviewer_name: str | None = None,
    notes: str | None = None,
    dataset_id: str = "default",
) -> AnomalyReviewResponse:
    """Record faculty review status and moderation notes for a specific anomaly finding."""
    now_iso = datetime.now(timezone.utc).isoformat() if reviewed else None
    reviewer = reviewer_name or ("Faculty Reviewer" if reviewed else None)

    reviews = _load_reviews_store(dataset_id)
    reviews[finding_id] = {
        "reviewed": reviewed,
        "reviewed_by": reviewer,
        "reviewed_at": now_iso,
        "review_notes": notes,
    }
    _save_reviews_store(dataset_id, reviews)

    status_msg = "Finding marked as reviewed" if reviewed else "Finding review status cleared"
    return AnomalyReviewResponse(
        status="success",
        finding_id=finding_id,
        reviewed=reviewed,
        reviewed_by=reviewer,
        reviewed_at=now_iso,
        review_notes=notes,
        message=status_msg,
    )


def review_student_anomalies(
    con: duckdb.DuckDBPyConnection,
    student_id: str,
    reviewed: bool,
    reviewer_name: str | None = None,
    notes: str | None = None,
) -> list[AnomalyReviewResponse]:
    """Record review status for all anomaly findings concerning a specific student."""
    dataset_id = _get_dataset_id_from_con(con)
    findings, _ = detect_all_anomalies(con)
    student_findings = [f for f in findings if f.student_id == student_id]
    responses = []
    for f in student_findings:
        resp = review_anomaly_finding(
            finding_id=f.finding_id,
            reviewed=reviewed,
            reviewer_name=reviewer_name,
            notes=notes,
            dataset_id=dataset_id,
        )
        responses.append(resp)
    return responses



def detect_all_anomalies(
    con: duckdb.DuckDBPyConnection,
    include_statistical: bool = False,
) -> tuple[list[AnomalyFindingItem], dict[str, Any]]:
    """Execute explainable anomaly detection across cohort records.

    By default (Phase 10 contract), faculty-facing detection executes:
    - Tier A: Deterministic Academic Integrity Checks (mark mismatches, out-of-bounds scores)
    - Tier C: Multivariate Numerical Isolation Forest (exploratory ML)
    Tier B (Robust Z-Score/MAD) is decoupled from the faculty workflow and only executed
    when include_statistical=True for benchmark research evaluation.
    """
    findings: list[AnomalyFindingItem] = []
    metadata: dict[str, Any] = {
        "deterministic_count": 0,
        "robust_zscore_count": 0,
        "isolation_forest_count": 0,
        "excluded_records_count": 0,
        "exclusion_reasons": [],
        "insufficient_data": False,
        "insufficient_data_reason": None,
    }

    dataset_id = _get_dataset_id_from_con(con)

    # Fetch student metadata for quick lookup
    students_rows = con.execute(
        "SELECT student_id, name, division, result, total_marks, sgpi, cgpa, source_sheet, source_row FROM students"
    ).fetchall()
    student_meta = {
        str(r[0]): {
            "name": str(r[1]) if r[1] is not None else None,
            "division": str(r[2]) if r[2] is not None else None,
            "result": str(r[3]) if r[3] is not None else None,
            "total_marks": float(r[4]) if r[4] is not None else None,
            "sgpi": float(r[5]) if r[5] is not None else None,
            "cgpa": float(r[6]) if r[6] is not None else None,
            "source_sheet": str(r[7]) if r[7] is not None else None,
            "source_row": int(r[8]) if r[8] is not None else None,
        }
        for r in students_rows
    }

    # -------------------------------------------------------------------------
    # Tier A: Deterministic Academic Integrity Checks
    # -------------------------------------------------------------------------

    # A1: Printed total vs Computed total mismatch
    recon_mismatches = con.execute(
        """
        SELECT student_id, course_code, printed_total, computed_total, grade
        FROM reconciliation
        WHERE printed_total IS NOT NULL AND computed_total IS NOT NULL
          AND ABS(printed_total - computed_total) > 0.05
        ORDER BY ABS(printed_total - computed_total) DESC
        """
    ).fetchall()

    for idx, (sid, ccode, printed, computed, grade) in enumerate(recon_mismatches):
        diff = round(abs(float(printed) - float(computed)), 2)
        smeta = student_meta.get(str(sid), {})
        finding_id = f"DET-MISMATCH-{str(sid)[-4:]}-{str(ccode)}-{idx+1}"
        review = _get_review_status(finding_id, dataset_id=dataset_id)

        plain_title = "Printed Total Does Not Match Component Sum"
        what_noticed = f"The printed course total in {ccode} differs from the sum of component assessments."
        evidence_str = f"Printed total: {printed}, Sum of components: {computed} (Difference: {diff} mark(s))."
        rec_action = "Review the original marksheet row and re-verify the assessment breakdown."
        tech_details = f"Deterministic arithmetic check: abs({printed} - {computed}) = {diff}."

        findings.append(
            AnomalyFindingItem(
                finding_id=finding_id,
                category="score_discrepancy",
                method="deterministic_rule",
                severity="critical" if diff >= 5.0 else "warning",
                student_id=str(sid),
                student_name=smeta.get("name"),
                division=smeta.get("division"),
                course_code=str(ccode),
                score_measure=diff,
                score_label=f"Total Mark Discrepancy: {diff} marks",
                contributing_features={
                    "printed_total": float(printed),
                    "computed_components_sum": float(computed),
                    "discrepancy": diff,
                    "recorded_grade": str(grade) if grade else None,
                },
                explanation=(
                    f"{plain_title}: Printed course total ({printed}) in {ccode} does not match the "
                    f"sum of component assessments ({computed}). A reconciliation gap of {diff} mark(s) exists."
                ),
                title=plain_title,
                what_noticed=what_noticed,
                evidence=evidence_str,
                recommended_action=rec_action,
                technical_details=tech_details,
                limitations=(
                    "Deterministic verification rule. Confirms a mathematical mismatch in spreadsheet source cells. "
                    "Does not prove administrative misconduct or intent."
                ),
                source_sheet=smeta.get("source_sheet"),
                source_row=smeta.get("source_row"),
                record_link=f"/students/{sid}",
                reviewed=review["reviewed"],
                reviewed_by=review["reviewed_by"],
                reviewed_at=review["reviewed_at"],
                review_notes=review["review_notes"],
            )
        )
    metadata["deterministic_count"] += len(recon_mismatches)

    # A2: Out-of-bounds component marks (< 0 or > 100 for component, > 150 for course total)
    boundary_rows = con.execute(
        """
        SELECT student_id, course_code, component, value, source_sheet, source_row
        FROM scores
        WHERE value IS NOT NULL AND (
            (component != 'TOT1' AND (value < 0 OR value > 100)) OR
            (component = 'TOT1' AND (value < 0 OR value > 150))
        )
        ORDER BY value DESC
        """
    ).fetchall()

    for idx, (sid, ccode, comp, val, ssheet, srow) in enumerate(boundary_rows):
        val_flt = float(val)
        smeta = student_meta.get(str(sid), {})
        finding_id = f"DET-BOUND-{str(sid)[-4:]}-{str(ccode)}-{idx+1}"
        review = _get_review_status(finding_id, dataset_id=dataset_id)
        max_bound = 150 if str(comp) == "TOT1" else 100
        plain_title = "Mark Outside Expected Range"
        what_noticed = f"Score value of {val_flt} in component '{comp}' exceeds allowable range [0, {max_bound}]."
        evidence_str = f"Component: {comp}, Recorded mark: {val_flt}, Permissible range: 0 to {max_bound}."
        rec_action = "Verify if this is a typographical error or parsing artifact in the source marksheet."
        tech_details = f"Deterministic boundary check: score {val_flt} not in [0, {max_bound}]."

        findings.append(
            AnomalyFindingItem(
                finding_id=finding_id,
                category="boundary_violation",
                method="deterministic_rule",
                severity="critical",
                student_id=str(sid),
                student_name=smeta.get("name"),
                division=smeta.get("division"),
                course_code=str(ccode),
                score_measure=val_flt,
                score_label=f"Invalid Score: {val_flt} (out of 0-{max_bound} bounds)",
                contributing_features={
                    "component": str(comp),
                    "score_value": val_flt,
                    "legal_range": [0, max_bound],
                },
                explanation=f"{plain_title}: {what_noticed}",
                title=plain_title,
                what_noticed=what_noticed,
                evidence=evidence_str,
                recommended_action=rec_action,
                technical_details=tech_details,
                limitations=(
                    "Deterministic range validation rule. Direct indication of typographical error or parsing artifact."
                ),
                source_sheet=str(ssheet) if ssheet else smeta.get("source_sheet"),
                source_row=int(srow) if srow is not None else smeta.get("source_row"),
                record_link=f"/students/{sid}",
                reviewed=review["reviewed"],
                reviewed_by=review["reviewed_by"],
                reviewed_at=review["reviewed_at"],
                review_notes=review["review_notes"],
            )
        )
    metadata["deterministic_count"] += len(boundary_rows)

    # -------------------------------------------------------------------------
    # Tier B: Robust Statistical Baseline (Median Absolute Deviation / Robust Z)
    # (Decoupled from faculty workflow as per Phase 10; preserved for research)
    # -------------------------------------------------------------------------
    robust_findings_count = 0
    if include_statistical:
        # Extract valid numerical scores per course
        recon_rows = con.execute(
            """
            SELECT student_id, course_code, computed_total
            FROM reconciliation
            WHERE computed_total IS NOT NULL AND computed_total > 0
            """
        ).fetchall()

        # Group scores by course
        course_scores: dict[str, list[tuple[str, float]]] = {}
        for sid, ccode, score in recon_rows:
            course_scores.setdefault(str(ccode), []).append((str(sid), float(score)))

        for ccode, student_scores in course_scores.items():
            if len(student_scores) < 10:
                continue  # Insufficient cohort depth for robust course statistics

            vals = np.array([s[1] for s in student_scores], dtype=float)
            median_val = float(np.median(vals))
            abs_diffs = np.abs(vals - median_val)
            mad = float(np.median(abs_diffs))

            # Consistent estimator for normal distribution: scale factor 1.4826 with minimum 5.0 marks threshold
            denom = max(float(mad * 1.4826), 5.0)

            for sid, score in student_scores:
                z_score = (score - median_val) / denom
                abs_z = abs(z_score)
                abs_mark_diff = abs(score - median_val)

                # High deviation threshold |Z_robust| >= 3.0 and absolute mark diff >= 15.0
                if abs_z >= 3.0 and abs_mark_diff >= 15.0:
                    smeta = student_meta.get(sid, {})
                    finding_id = f"STAT-MAD-{sid[-4:]}-{ccode}"
                    review = _get_review_status(finding_id, dataset_id=dataset_id)
                    direction = "significantly below" if z_score < 0 else "significantly above"

                    plain_title = "Unusual Mark Difference from Course Median"
                    what_noticed = (
                        f"The student's score of {score:.1f} in {ccode} is {direction} the course median of {median_val:.1f}."
                    )
                    evidence_str = (
                        f"Subject: {ccode}, Student score: {score:.1f}, Course median: {median_val:.1f} (Z-Score: {z_score:+.2f})."
                    )
                    rec_action = "Review subject marks to understand if this reflects student specialization or an entry error."
                    tech_details = f"Median Absolute Deviation (MAD) robust Z-score: {z_score:+.2f}."

                    findings.append(
                        AnomalyFindingItem(
                            finding_id=finding_id,
                            category="intra_student_outlier" if z_score < 0 else "cohort_outlier",
                            method="robust_zscore",
                            severity="warning",
                            student_id=sid,
                            student_name=smeta.get("name"),
                            division=smeta.get("division"),
                            course_code=ccode,
                            score_measure=round(abs_z, 2),
                            score_label=f"Robust Z-Score: {z_score:+.2f} (|Z|={abs_z:.2f})",
                            contributing_features={
                                "student_course_score": score,
                                "course_median": round(median_val, 1),
                                "course_mad": round(mad, 1),
                                "robust_z": round(z_score, 2),
                                "enrolled_in_course": len(student_scores),
                            },
                            explanation=f"{plain_title}: {what_noticed}",
                            title=plain_title,
                            what_noticed=what_noticed,
                            evidence=evidence_str,
                            recommended_action=rec_action,
                            technical_details=tech_details,
                            limitations=(
                                "Statistical outlier flag using Median Absolute Deviation. Indicates exceptional individual "
                                "performance divergence, not a marksheet defect or grading irregularity."
                            ),
                            source_sheet=smeta.get("source_sheet"),
                            source_row=smeta.get("source_row"),
                            record_link=f"/subjects/{ccode}/failures",
                            reviewed=review["reviewed"],
                            reviewed_by=review["reviewed_by"],
                            reviewed_at=review["reviewed_at"],
                            review_notes=review["review_notes"],
                        )
                    )
                    robust_findings_count += 1

    metadata["robust_zscore_count"] = robust_findings_count

    # -------------------------------------------------------------------------
    # Tier C: Multivariate Numerical Isolation Forest
    # -------------------------------------------------------------------------
    # Build multivariate feature vectors per student
    # Features:
    # 1. mean_norm_score: average score across enrolled subjects (normalized to 0-1)
    # 2. score_dispersion: std deviation of marks across courses (measures intra-student volatility)
    # 3. max_mismatch: maximum |printed - computed|
    # 4. fail_rate: failed courses / enrolled courses
    # 5. total_marks_ratio: total marks / cohort max marks

    # Extract all enrolled course totals per student
    student_course_map: dict[str, list[float]] = {}
    student_mismatch_map: dict[str, float] = {}
    student_fail_map: dict[str, int] = {}

    student_enrolled_count: dict[str, int] = {}

    for sid, ccode, printed, computed, grade in con.execute(
        "SELECT student_id, course_code, printed_total, computed_total, grade FROM reconciliation"
    ).fetchall():
        s_id = str(sid)
        student_enrolled_count[s_id] = student_enrolled_count.get(s_id, 0) + 1
        s_id = str(sid)
        if computed is not None and float(computed) > 0:
            student_course_map.setdefault(s_id, []).append(float(computed))

        diff = abs(float(printed) - float(computed)) if printed is not None and computed is not None else 0.0
        student_mismatch_map[s_id] = max(student_mismatch_map.get(s_id, 0.0), diff)

        is_fail = str(grade).upper() in ("F", "FAIL") if grade else False
        if is_fail:
            student_fail_map[s_id] = student_fail_map.get(s_id, 0) + 1

    # Max total marks in cohort
    max_tot_row = con.execute("SELECT MAX(total_marks) FROM students WHERE total_marks IS NOT NULL").fetchone()
    cohort_max_marks = float(max_tot_row[0]) if max_tot_row and max_tot_row[0] else 1000.0

    valid_sids: list[str] = []
    features_list: list[list[float]] = []
    excluded_count = 0
    exclusion_reasons: list[str] = []

    for sid, smeta in student_meta.items():
        courses = student_course_map.get(sid, [])
        if len(courses) < 2 or smeta.get("total_marks") is None:
            # Exclude incomplete or uncalculated records
            excluded_count += 1
            if len(courses) < 2:
                exclusion_reasons.append(f"Student {sid}: Enrolled in fewer than 2 valid subjects ({len(courses)})")
            continue

        mean_score = float(np.mean(courses)) / 100.0  # normalize
        std_dispersion = float(np.std(courses)) / 100.0
        max_mismatch = float(student_mismatch_map.get(sid, 0.0))
        total_eval = max(student_enrolled_count.get(sid, len(courses)), len(courses), student_fail_map.get(sid, 0))
        fail_ratio = float(student_fail_map.get(sid, 0)) / float(total_eval) if total_eval > 0 else 0.0
        tot_ratio = float(smeta["total_marks"] or 0.0) / cohort_max_marks

        valid_sids.append(sid)
        features_list.append([mean_score, std_dispersion, max_mismatch, fail_ratio, tot_ratio])

    metadata["excluded_records_count"] = excluded_count
    metadata["exclusion_reasons"] = list(set(exclusion_reasons))[:5]

    # Sample size validation for ML
    if len(valid_sids) < 15:
        metadata["insufficient_data"] = True
        metadata["insufficient_data_reason"] = (
            f"Cohort contains only {len(valid_sids)} valid multi-course student observations (minimum 15 required "
            "for calibrated Isolation Forest inference). ML detection skipped; deterministic baselines retained."
        )
    else:
        # Fit Isolation Forest with calibrated contamination and fixed seed for strict reproducibility
        X = np.array(features_list, dtype=float)
        contamination_rate = 0.05
        clf = IsolationForest(
            n_estimators=100,
            contamination=contamination_rate,
            random_state=42,
            n_jobs=1,
        )
        clf.fit(X)

        # Decision function: lower values mean more anomalous.
        # Isolation Forest decision_function < 0 represents anomalies under specified contamination
        scores = clf.decision_function(X)
        preds = clf.predict(X)  # -1 for anomaly, +1 for inlier

        cohort_medians = np.median(X, axis=0)
        feature_names = [
            "mean_norm_score",
            "score_dispersion",
            "max_mismatch",
            "fail_ratio",
            "total_marks_ratio",
        ]

        if_count = 0
        for i, sid in enumerate(valid_sids):
            if preds[i] == -1:
                # Convert raw decision function to an interpretable anomaly magnitude index:
                # Invert decision function so higher positive value = higher anomaly index
                anomaly_index = round(float(-scores[i]), 3)
                smeta = student_meta.get(sid, {})
                finding_id = f"ML-ISOFOREST-{sid[-4:]}"
                review = _get_review_status(finding_id, dataset_id=dataset_id)

                feat_dict = {
                    name: round(float(X[i][j]), 3)
                    for j, name in enumerate(feature_names)
                }
                feat_medians_dict = {
                    name: round(float(cohort_medians[j]), 3)
                    for j, name in enumerate(feature_names)
                }

                # Construct explainable sentence based on highest contributing component
                high_dispersion = X[i][1] > cohort_medians[1] * 1.5
                high_mismatch = X[i][2] > 0.5
                tot_marks = smeta.get("total_marks")
                fail_cnt = student_fail_map.get(sid, 0)
                # Enforce invariant: failed_subjects <= evaluated_subjects
                enrolled_cnt = max(student_enrolled_count.get(sid, len(student_course_map.get(sid, []))), len(student_course_map.get(sid, [])), fail_cnt)

                if high_mismatch:
                    plain_title = "Discrepancy Between Component Sum and Printed Total"
                    what_noticed = (
                        f"The student's marksheet shows a discrepancy of up to {X[i][2]:.1f} marks "
                        f"between component sums and printed totals."
                    )
                    evidence_str = (
                        f"Maximum component mismatch: {X[i][2]:.1f} mark(s). Recorded total marks: {tot_marks}."
                    )
                    rec_action = "Review the component breakdown in the source marksheet to reconcile the totals."
                elif high_dispersion:
                    plain_title = "Large Difference Between Subject Marks"
                    what_noticed = (
                        "The student shows unusually high variation in marks across different subjects compared to cohort peers."
                    )
                    evidence_str = (
                        f"Subject mark variation (standard deviation: {X[i][1]*100:.1f} marks) is higher than cohort median "
                        f"({cohort_medians[1]*100:.1f} marks). Recorded total marks: {tot_marks}."
                    )
                    rec_action = "Review marks across subjects to see if the student excels in some areas while struggling in others."
                elif fail_cnt > 0:
                    plain_title = "Unusual Combination of Marks and Failures"
                    what_noticed = (
                        f"The student has {fail_cnt} failed subject(s) out of {enrolled_cnt} evaluated subjects despite their recorded overall score."
                    )
                    evidence_str = (
                        f"Recorded overall marks: {tot_marks}, Failed subjects: {fail_cnt} of {enrolled_cnt}."
                    )
                    rec_action = "Verify the source record before taking action; check whether subject-wise marks or passing thresholds require review."
                else:
                    plain_title = "Unusual Score Pattern Detected"
                    what_noticed = "The student's overall marks profile differs noticeably from typical cohort patterns."
                    evidence_str = f"Recorded overall marks: {tot_marks} across {enrolled_cnt} enrolled subjects."
                    rec_action = "Inspect subject marks to confirm evaluation accuracy."

                tech_details = (
                    f"Flagged by Isolation Forest multivariate outlier detection (anomaly index: {anomaly_index:.3f}, "
                    f"decision function: {scores[i]:.4f}) across 5 normalized academic dimensions."
                )

                findings.append(
                    AnomalyFindingItem(
                        finding_id=finding_id,
                        category="multivariate_outlier",
                        method="isolation_forest",
                        severity="warning",
                        student_id=sid,
                        student_name=smeta.get("name"),
                        division=smeta.get("division"),
                        course_code=None,
                        score_measure=anomaly_index,
                        score_label=f"Isolation Index: {anomaly_index:.3f} (Contamination: {contamination_rate*100:.0f}%)",
                        contributing_features={
                            "student_features": feat_dict,
                            "cohort_feature_medians": feat_medians_dict,
                            "decision_function_raw": round(float(scores[i]), 4),
                        },
                        explanation=f"{plain_title}: {what_noticed}",
                        title=plain_title,
                        what_noticed=what_noticed,
                        evidence=evidence_str,
                        recommended_action=rec_action,
                        technical_details=tech_details,
                        limitations=(
                            "Multivariate Isolation Forest anomaly score indicates structural uniqueness in feature space. "
                            "It is NOT a probability of error or fraud, and does NOT alter official academic pass/fail status."
                        ),
                        source_sheet=smeta.get("source_sheet"),
                        source_row=smeta.get("source_row"),
                        record_link=f"/students/{sid}",
                        reviewed=review["reviewed"],
                        reviewed_by=review["reviewed_by"],
                        reviewed_at=review["reviewed_at"],
                        review_notes=review["review_notes"],
                    )
                )
                if_count += 1

        metadata["isolation_forest_count"] = if_count
        metadata["model_metadata"] = {
            "algorithm": "IsolationForest",
            "n_estimators": 100,
            "contamination": contamination_rate,
            "random_state": 42,
            "evaluated_students": len(valid_sids),
            "features": feature_names,
        }

    return findings, metadata


def build_grouped_records(findings: list[AnomalyFindingItem]) -> list[GroupedAnomalyRecord]:
    """Group individual findings by student, synthesizing plain headline and highest severity."""
    severity_rank: dict[str, int] = {"critical": 3, "warning": 2, "info": 1}
    groups: dict[str, list[AnomalyFindingItem]] = {}
    for f in findings:
        groups.setdefault(f.student_id, []).append(f)

    grouped_records: list[GroupedAnomalyRecord] = []
    for sid, s_findings in groups.items():
        first = s_findings[0]
        methods = list(dict.fromkeys(f.method for f in s_findings))
        categories = list(dict.fromkeys(f.category for f in s_findings))

        highest_sev = max(s_findings, key=lambda f: severity_rank.get(f.severity, 0)).severity
        all_reviewed = all(f.reviewed for f in s_findings)

        has_det = any(f.method == "deterministic_rule" for f in s_findings)
        has_stat = any(f.method == "robust_zscore" for f in s_findings)
        has_ml = any(f.method == "isolation_forest" for f in s_findings)

        courses_flagged = [f.course_code for f in s_findings if f.course_code]
        unique_courses = list(dict.fromkeys(courses_flagged))

        if has_det and has_ml:
            headline = f"Mark calculation discrepancy & multivariate pattern ({len(s_findings)} findings across {len(unique_courses)} course(s))"
        elif has_det:
            headline = f"Mark calculation discrepancy detected ({len(s_findings)} findings across {len(unique_courses)} course(s))"
        elif has_stat and has_ml:
            headline = f"Statistical deviation & multivariate outlier pattern ({len(s_findings)} findings across {len(unique_courses)} course(s))"
        elif has_stat:
            headline = f"Statistical deviation from course medians ({len(s_findings)} findings in {len(unique_courses)} course(s))"
        elif has_ml:
            headline = f"Multivariate performance pattern flagged by Isolation Forest ({len(s_findings)} findings)"
        else:
            headline = f"{len(s_findings)} anomaly findings requiring academic review"

        grouped_records.append(
            GroupedAnomalyRecord(
                student_id=sid,
                student_name=first.student_name,
                division=first.division,
                findings_count=len(s_findings),
                methods=methods,
                categories=categories,
                highest_severity=highest_sev,
                headline=headline,
                all_reviewed=all_reviewed,
                findings=s_findings,
                record_link=f"/students/{sid}",
            )
        )

    grouped_records.sort(
        key=lambda r: (severity_rank.get(r.highest_severity, 0), r.findings_count),
        reverse=True,
    )
    return grouped_records


def get_anomaly_summary(
    con: duckdb.DuckDBPyConnection,
    include_statistical: bool = False,
) -> AnomalySummaryResponse:
    """Retrieve summarized statistics across all detected academic anomalies."""
    findings, meta = detect_all_anomalies(con, include_statistical=include_statistical)

    by_method: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    reviewed_count = 0

    student_findings: dict[str, list[AnomalyFindingItem]] = {}
    for f in findings:
        by_method[f.method] = by_method.get(f.method, 0) + 1
        by_category[f.category] = by_category.get(f.category, 0) + 1
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        if f.reviewed:
            reviewed_count += 1
        student_findings.setdefault(f.student_id, []).append(f)

    pending_count = len(findings) - reviewed_count
    unique_affected_records = len(student_findings)
    reviewed_unique_records = sum(1 for sid, s_list in student_findings.items() if all(sf.reviewed for sf in s_list))
    pending_unique_records = unique_affected_records - reviewed_unique_records

    return AnomalySummaryResponse(
        total_findings=len(findings),
        unique_affected_records=unique_affected_records,
        by_method=by_method,
        by_category=by_category,
        by_severity=by_severity,
        reviewed_count=reviewed_count,
        pending_count=pending_count,
        reviewed_unique_records=reviewed_unique_records,
        pending_unique_records=pending_unique_records,
        insufficient_data=meta["insufficient_data"],
        insufficient_data_reason=meta["insufficient_data_reason"],
        excluded_records_count=meta["excluded_records_count"],
        exclusion_reasons=meta["exclusion_reasons"],
        model_metadata=meta.get("model_metadata", {}),
    )


def list_anomaly_findings(
    con: duckdb.DuckDBPyConnection,
    category: str | None = None,
    method: str | None = None,
    severity: str | None = None,
    reviewed: bool | None = None,
    student_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    include_statistical: bool = False,
) -> AnomalyListResponse:
    """Filter and paginate detected anomaly findings."""
    all_findings, _ = detect_all_anomalies(con, include_statistical=include_statistical)

    filtered = all_findings
    if category:
        filtered = [f for f in filtered if f.category == category]
    if method:
        filtered = [f for f in filtered if f.method == method]
    if severity:
        filtered = [f for f in filtered if f.severity == severity]
    if reviewed is not None:
        filtered = [f for f in filtered if f.reviewed == reviewed]
    if student_id:
        clean_sid = student_id.strip().upper()
        filtered = [f for f in filtered if clean_sid in f.student_id.upper()]

    total = len(filtered)
    page_items = filtered[offset : offset + limit]
    grouped = build_grouped_records(filtered)
    unique_affected = len(set(f.student_id for f in filtered))

    return AnomalyListResponse(
        total=total,
        unique_affected_records=unique_affected,
        limit=limit,
        offset=offset,
        findings=page_items,
        grouped_records=grouped,
    )

