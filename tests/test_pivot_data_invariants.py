"""Product Pivot ground-truth data validation and invariant tests.

Validates the Result_anonymized.xlsx cohort against the exact requirements:
- 145 students, 132 passed, 13 failed
- 7 students with at least one absent mark
- 12 failures in PCEC12T
- Of 13 failed: 7 failed 1-3 subjects, 6 failed 7-12
- Of 7 with absences: 1 absent in 2 subjects, 6 absent in 5-9
- Invariant: failed_subjects <= evaluated_subjects for every student
- E/F suffix treatment: parser extracts numeric score, preserves suffix flag
"""
from __future__ import annotations

import duckdb
import pytest

from app.core.ingest import parse_cell
from app.services.anomaly_detection import detect_all_anomalies


@pytest.fixture
def con():
    """Connect to the ingested dataset."""
    c = duckdb.connect("data/eduquery.duckdb", read_only=True)
    yield c
    c.close()


def test_cohort_student_headcounts(con):
    """Verify 145 students: 132 passed, 13 failed."""
    total = con.execute("SELECT count(*) FROM students").fetchone()[0]
    assert total == 145, f"Expected 145 students, got {total}"

    passed = con.execute("SELECT count(*) FROM students WHERE UPPER(TRIM(result)) LIKE '%PASS%'").fetchone()[0]
    failed = con.execute("SELECT count(*) FROM students WHERE UPPER(TRIM(result)) LIKE '%FAIL%'").fetchone()[0]
    assert passed == 132, f"Expected 132 passed students, got {passed}"
    assert failed == 13, f"Expected 13 failed students, got {failed}"
    assert passed + failed == total


def test_absent_students_count(con):
    """Verify exactly 7 students have at least one verified absent mark."""
    absent_count = con.execute("""
        SELECT count(DISTINCT s.student_id)
        FROM scores s
        WHERE s.component != 'TOT1'
          AND (UPPER(TRIM(s.flag)) IN ('A', 'AB', 'ABS', 'ABSENT')
               OR UPPER(TRIM(s.raw_text)) IN ('A', 'AB', 'ABS', 'ABSENT'))
    """).fetchone()[0]
    assert absent_count == 7, f"Expected 7 absent students, got {absent_count}"


def test_pcec12t_failure_count(con):
    """Verify exactly 12 students failed in PCEC12T."""
    pcec12t_fails = con.execute("""
        SELECT count(*)
        FROM reconciliation r
        WHERE r.course_code = 'PCEC12T'
          AND (UPPER(TRIM(r.grade)) IN ('F', 'FAIL') OR UPPER(r.flags) LIKE '%F%')
    """).fetchone()[0]
    assert pcec12t_fails == 12, f"Expected 12 failures in PCEC12T, got {pcec12t_fails}"


def test_failed_students_distribution(con):
    """Of 13 failed students: 7 failed 1-3 subjects, 6 failed 7-12 subjects."""
    st_fails = con.execute("""
        SELECT student_id, count(DISTINCT course_code) as failed_courses
        FROM reconciliation
        WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
          AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
        GROUP BY student_id
    """).fetchall()

    assert len(st_fails) == 13, f"Expected 13 failing students, got {len(st_fails)}"

    f_1_3 = [s for s in st_fails if 1 <= s[1] <= 3]
    f_7_12 = [s for s in st_fails if 7 <= s[1] <= 12]

    assert len(f_1_3) == 7, f"Expected 7 students failing 1-3 subjects, got {len(f_1_3)}"
    assert len(f_7_12) == 6, f"Expected 6 students failing 7-12 subjects, got {len(f_7_12)}"
    assert len(f_1_3) + len(f_7_12) == 13


def test_absent_students_distribution(con):
    """Of 7 students with absences: 1 absent in 2 subjects, 6 absent in 5-9 subjects."""
    st_abs = con.execute("""
        SELECT s.student_id, count(DISTINCT s.course_code) as absent_courses
        FROM scores s
        WHERE s.component != 'TOT1'
          AND (UPPER(TRIM(s.flag)) IN ('A', 'AB', 'ABS', 'ABSENT')
               OR UPPER(TRIM(s.raw_text)) IN ('A', 'AB', 'ABS', 'ABSENT'))
        GROUP BY s.student_id
    """).fetchall()

    assert len(st_abs) == 7, f"Expected 7 absent students, got {len(st_abs)}"

    a_2 = [s for s in st_abs if s[1] == 2]
    a_5_9 = [s for s in st_abs if 5 <= s[1] <= 9]

    assert len(a_2) == 1, f"Expected 1 student absent in 2 subjects, got {len(a_2)}"
    assert len(a_5_9) == 6, f"Expected 6 students absent in 5-9 subjects, got {len(a_5_9)}"
    assert len(a_2) + len(a_5_9) == 7


def test_invariant_failed_subjects_le_evaluated_subjects(con):
    """Invariant: For every student, failed_subjects <= evaluated_subjects must strictly hold."""
    # 1. Check database reconciliation against enrollment
    rows = con.execute("""
        SELECT 
            st.student_id,
            COALESCE(e.enrolled_count, 0) as evaluated_count,
            COALESCE(f.failed_count, 0) as failed_count
        FROM students st
        LEFT JOIN (
            SELECT student_id, count(DISTINCT course_code) as enrolled_count
            FROM enrollment
            GROUP BY student_id
        ) e ON st.student_id = e.student_id
        LEFT JOIN (
            SELECT student_id, count(DISTINCT course_code) as failed_count
            FROM reconciliation
            WHERE (UPPER(TRIM(grade)) IN ('F', 'FAIL') OR UPPER(flags) LIKE '%F%')
              AND NOT (UPPER(TRIM(grade)) IN ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'P', 'PASS') AND UPPER(flags) LIKE '%F%')
            GROUP BY student_id
        ) f ON st.student_id = f.student_id
    """).fetchall()

    for sid, evaluated, failed in rows:
        assert failed <= evaluated, (
            f"Invariant violation for student {sid}: failed {failed} subjects > evaluated {evaluated} subjects!"
        )

    # 2. Check that anomaly detection findings never report impossible counts
    findings, _ = detect_all_anomalies(con)
    for f in findings:
        desc = (f.what_noticed or "") + " " + (f.evidence or "")
        import re
        m = re.search(r"(\d+)\s+failed subject\(s\)\s+out of\s+(\d+)\s+evaluated", desc)
        if m:
            f_cnt = int(m.group(1))
            ev_cnt = int(m.group(2))
            assert f_cnt <= ev_cnt, f"Impossible finding detected in finding {f.finding_id}: {f_cnt} failed > {ev_cnt} evaluated!"


def test_mark_suffix_parser_treatment():
    """Verify parser treatment of E/F mark suffixes without guessing."""
    # Score with 'F' suffix (failing mark indicator)
    num, flag, state = parse_cell("32F")
    assert num == 32.0
    assert flag == "F"
    assert state == "marked"

    # Score with 'E' suffix (exemption or evaluation suffix)
    num_e, flag_e, state_e = parse_cell("18E")
    assert num_e == 18.0
    assert flag_e == "E"
    assert state_e == "marked"

    # Standard clean score
    num_clean, flag_clean, state_clean = parse_cell("45")
    assert num_clean == 45.0
    assert flag_clean is None
    assert state_clean == "marked"

    # Absent marker
    num_ab, flag_ab, state_ab = parse_cell("AB")
    assert num_ab is None
    assert flag_ab == "AB"
    assert state_ab == "flagged"



def test_student_preset_filters_and_merit_ranking(con):
    """Verify list_students preset filters and merit ranking invariants."""
    from app.services.student_service import list_students

    # 1. Has absences preset returns exactly 7 students
    res_absent = list_students(con, has_absences=True, limit=200)
    assert res_absent.total == 7
    assert len(res_absent.items) == 7

    # 2. Failed preset returns exactly 13 students
    res_failed = list_students(con, result="FAIL", limit=200)
    assert res_failed.total == 13
    assert len(res_failed.items) == 13

    # 3. Regular UG preset returns exactly 127 students
    res_ug = list_students(con, level="UG", limit=200)
    assert res_ug.total == 127

    # 4. DSY preset returns exactly 18 students
    res_dsy = list_students(con, level="DSY", limit=200)
    assert res_dsy.total == 18

    # 5. Merit sort returns highest CGPA / SGPI first
    res_merit = list_students(con, sort_by="merit", limit=10)
    assert res_merit.items[0].cgpa is not None
    assert res_merit.items[0].cgpa >= res_merit.items[1].cgpa
