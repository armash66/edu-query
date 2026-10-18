"""Unit tests for the Explainable Academic Anomaly Detection Service."""
from __future__ import annotations

import duckdb
import pytest

from app.api.schemas.anomaly import AnomalyFindingItem
from app.services.anomaly_detection import (
    detect_all_anomalies,
    get_anomaly_summary,
    list_anomaly_findings,
    review_anomaly_finding,
)


@pytest.fixture
def test_db_conn():
    """In-memory DuckDB connection with controlled test tables."""
    con = duckdb.connect(":memory:")

    con.execute("""
        CREATE TABLE students (
            student_id VARCHAR,
            seat_no VARCHAR,
            roll_no VARCHAR,
            name VARCHAR,
            email VARCHAR,
            division VARCHAR,
            level VARCHAR,
            total_marks DOUBLE,
            total_credits DOUBLE,
            result VARCHAR,
            sgpi DOUBLE,
            cgpa DOUBLE,
            source_sheet VARCHAR,
            source_row INTEGER
        );
        CREATE TABLE reconciliation (
            student_id VARCHAR,
            course_code VARCHAR,
            printed_total DOUBLE,
            computed_total DOUBLE,
            total_match BOOLEAN,
            grade VARCHAR,
            flags VARCHAR
        );
        CREATE TABLE scores (
            student_id VARCHAR,
            course_code VARCHAR,
            component VARCHAR,
            value DOUBLE,
            flag VARCHAR,
            state VARCHAR,
            raw_text VARCHAR,
            grade VARCHAR,
            source_sheet VARCHAR,
            source_row INTEGER
        );
    """)

    # Populate 20 clean students
    for i in range(20):
        sid = f"ST_{i+1:03d}"
        con.execute(
            "INSERT INTO students VALUES (?, ?, ?, ?, NULL, 'A', 'UG', ?, 20.0, 'PASSES', 8.0, 8.0, 'Sheet1', ?)",
            [sid, f"SEAT_{i+1}", f"ROLL_{i+1}", f"Student {i+1}", 400.0 + (i * 5), i + 2],
        )
        for c in ["C1", "C2", "C3", "C4"]:
            con.execute(
                "INSERT INTO reconciliation VALUES (?, ?, ?, ?, True, 'A', '')",
                [sid, c, 75.0, 75.0],
            )
            con.execute(
                "INSERT INTO scores VALUES (?, ?, 'TOT1', ?, NULL, 'marked', '75', 'A', 'Sheet1', ?)",
                [sid, c, 75.0, i + 2],
            )

    return con


def test_deterministic_recon_mismatch_detection(test_db_conn):
    """Verify Tier A catches arithmetic mismatches between printed total and component sum."""
    # Inject 1 mismatch
    test_db_conn.execute(
        "INSERT INTO reconciliation VALUES ('ST_001', 'C1_ERR', 85.0, 72.0, False, 'A', '')"
    )

    findings, meta = detect_all_anomalies(test_db_conn)
    mismatch_findings = [f for f in findings if f.category == "score_discrepancy"]
    assert len(mismatch_findings) == 1
    f = mismatch_findings[0]
    assert f.method == "deterministic_rule"
    assert f.score_measure == 13.0
    assert "85.0" in f.explanation
    assert "72.0" in f.explanation
    assert "Does not prove administrative misconduct" in f.limitations


def test_deterministic_boundary_violation(test_db_conn):
    """Verify Tier A catches impossible negative marks or marks > 100."""
    test_db_conn.execute(
        "INSERT INTO scores VALUES ('ST_002', 'C1', 'ESE', -10.0, NULL, 'marked', '-10', 'F', 'Sheet1', 5)"
    )

    findings, meta = detect_all_anomalies(test_db_conn)
    bound_findings = [f for f in findings if f.category == "boundary_violation"]
    assert len(bound_findings) >= 1
    assert any(f.score_measure == -10.0 for f in bound_findings)


def test_robust_zscore_extreme_outlier(test_db_conn):
    """Verify Tier B Median Absolute Deviation flags isolated performance collapse."""
    # Add an extreme collapse for student ST_005 in course C1: score 10 vs median 75
    test_db_conn.execute(
        "UPDATE reconciliation SET computed_total = 10.0 WHERE student_id = 'ST_005' AND course_code = 'C1'"
    )

    # 1. By default (Phase 10 contract), robust_zscore is excluded from default detection
    default_findings, _ = detect_all_anomalies(test_db_conn)
    assert not any(f.method == "robust_zscore" for f in default_findings)

    # 2. When include_statistical=True (for benchmark research evaluations), MAD is evaluated
    findings, meta = detect_all_anomalies(test_db_conn, include_statistical=True)
    stat_findings = [f for f in findings if f.method == "robust_zscore" and f.student_id == "ST_005"]
    assert len(stat_findings) >= 1
    assert "Robust Z-Score" in stat_findings[0].score_label
    assert stat_findings[0].course_code == "C1"


def test_insufficient_data_skips_isolation_forest():
    """Verify small cohort (< 15 students) gracefully sets insufficient_data=True and skips ML."""
    tiny_con = duckdb.connect(":memory:")
    tiny_con.execute("""
        CREATE TABLE students (student_id VARCHAR, name VARCHAR, division VARCHAR, result VARCHAR, total_marks DOUBLE, sgpi DOUBLE, cgpa DOUBLE, source_sheet VARCHAR, source_row INTEGER);
        CREATE TABLE reconciliation (student_id VARCHAR, course_code VARCHAR, printed_total DOUBLE, computed_total DOUBLE, grade VARCHAR);
        CREATE TABLE scores (student_id VARCHAR, course_code VARCHAR, component VARCHAR, value DOUBLE, source_sheet VARCHAR, source_row INTEGER);
    """)
    # Add only 5 students
    for i in range(5):
        tiny_con.execute("INSERT INTO students VALUES (?, ?, 'A', 'PASSES', 300.0, 7.0, 7.0, 'S1', 1)", [f"S_{i}", f"Name {i}"])
        tiny_con.execute("INSERT INTO reconciliation VALUES (?, 'C1', 60.0, 60.0, 'B')", [f"S_{i}"])

    findings, meta = detect_all_anomalies(tiny_con)
    assert meta["insufficient_data"] is True
    assert "minimum 15 required" in meta["insufficient_data_reason"]
    # No isolation forest findings produced
    assert not any(f.method == "isolation_forest" for f in findings)


def test_isolation_forest_reproducibility(test_db_conn):
    """Verify fixed random_state produces identical findings across multiple executions."""
    findings1, meta1 = detect_all_anomalies(test_db_conn)
    findings2, meta2 = detect_all_anomalies(test_db_conn)

    if1_ids = [f.finding_id for f in findings1 if f.method == "isolation_forest"]
    if2_ids = [f.finding_id for f in findings2 if f.method == "isolation_forest"]
    assert if1_ids == if2_ids


def test_faculty_review_toggle():
    """Verify faculty review status can be set, updated, and queried."""
    finding_id = "TEST-FINDING-999"

    # 1. Mark reviewed
    res1 = review_anomaly_finding(
        finding_id=finding_id,
        reviewed=True,
        reviewer_name="Prof. Sharma",
        notes="Verified answer sheet in physical records",
    )
    assert res1.reviewed is True
    assert res1.reviewed_by == "Prof. Sharma"
    assert res1.reviewed_at is not None
    assert res1.review_notes == "Verified answer sheet in physical records"

    # 2. Toggle back to unreviewed
    res2 = review_anomaly_finding(
        finding_id=finding_id,
        reviewed=False,
    )
    assert res2.reviewed is False
    assert res2.reviewed_at is None


def test_no_official_outcome_mutation(test_db_conn):
    """Verify anomaly detection never alters official results or grades in DuckDB."""
    # Capture original results
    original_results = test_db_conn.execute("SELECT student_id, result FROM students").fetchall()

    # Run anomaly detection
    detect_all_anomalies(test_db_conn)

    # Verify results remain 100% identical
    after_results = test_db_conn.execute("SELECT student_id, result FROM students").fetchall()
    assert original_results == after_results


def test_anomaly_grouping_and_unique_record_counts(test_db_conn):
    """Verify deduplication groups multiple findings for the same student and reports unique counts."""
    from app.services.anomaly_detection import build_grouped_records, review_student_anomalies

    # Inject multiple anomalies for ST_001 across courses
    test_db_conn.execute("INSERT INTO reconciliation VALUES ('ST_001', 'C1_ERR', 85.0, 72.0, False, 'A', '')")
    test_db_conn.execute("INSERT INTO reconciliation VALUES ('ST_001', 'C2_ERR', 90.0, 70.0, False, 'A', '')")

    summary = get_anomaly_summary(test_db_conn)
    assert summary.total_findings >= 2
    assert summary.unique_affected_records >= 1
    assert summary.unique_affected_records <= summary.total_findings

    list_res = list_anomaly_findings(test_db_conn, student_id="ST_001")
    assert list_res.total >= 2
    assert len(list_res.grouped_records) == 1

    grouped = list_res.grouped_records[0]
    assert grouped.student_id == "ST_001"
    assert grouped.findings_count >= 2
    assert grouped.highest_severity in ("critical", "warning", "info")
    assert "Mark calculation discrepancy" in grouped.headline or "findings" in grouped.headline
    assert grouped.all_reviewed is False


def test_student_level_review_action(test_db_conn):
    """Verify review_student_anomalies marks all findings for a student in one action."""
    from app.services.anomaly_detection import review_student_anomalies

    test_db_conn.execute("INSERT INTO reconciliation VALUES ('ST_003', 'C1_ERR', 80.0, 60.0, False, 'A', '')")

    # Review student
    res = review_student_anomalies(
        con=test_db_conn,
        student_id="ST_003",
        reviewed=True,
        reviewer_name="Dean of Academics",
        notes="Reviewed and cleared",
    )
    assert len(res) >= 1
    assert all(r.reviewed is True for r in res)

    # Check that grouped record reflects all_reviewed = True
    list_res = list_anomaly_findings(test_db_conn, student_id="ST_003")
    assert len(list_res.grouped_records) == 1
    assert list_res.grouped_records[0].all_reviewed is True

