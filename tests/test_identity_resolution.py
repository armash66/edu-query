"""Regression and hardening test suite for identity resolution in EduQuery V3."""
from __future__ import annotations

from pathlib import Path
import duckdb
import pytest

from app.core.database import init_database, populate_table
from app.core.ingest import ingest
from app.reports.student_breakdown import get_student_breakdown, resolve_student

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture
def isolated_db():
    """Create an isolated, controlled database fixture for edge-case identity resolution."""
    con = duckdb.connect(":memory:")
    init_database(con)

    students = [
        # Student 1: Primary test student with mixed alphanumeric ID and seat
        {
            "student_id": "STU_Alpha_01",
            "seat_no": "SEAT-99A",
            "roll_no": "101",
            "name": "Aarav Sharma",
            "division": "A",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 10,
        },
        # Student 2: Shares same surname 'Sharma' (for ambiguous partial search)
        {
            "student_id": "STU_Beta_02",
            "seat_no": "SEAT-99B",
            "roll_no": "102",
            "name": "Bhavya Sharma",
            "division": "A",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 12,
        },
        # Student 3: Name matches Student 1's ID string 'STU_Alpha_01' (to test precedence)
        {
            "student_id": "STU_Gamma_03",
            "seat_no": "SEAT-100C",
            "roll_no": "103",
            "name": "STU_Alpha_01 Fanclub",
            "division": "B",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 14,
        },
        # Student 4 & 5: Identical roll numbers in different divisions (to test roll ambiguity)
        {
            "student_id": "STU_Delta_04",
            "seat_no": "SEAT-101D",
            "roll_no": "50",
            "name": "Chetan Verma",
            "division": "A",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 16,
        },
        {
            "student_id": "STU_Epsilon_05",
            "seat_no": "SEAT-102E",
            "roll_no": "50",
            "name": "Deepak Verma",
            "division": "B",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 18,
        },
        # Student 6 & 7: Different IDs that normalize to the same uppercase/trimmed value
        {
            "student_id": "STU_CLASH",
            "seat_no": "SEAT-200A",
            "roll_no": "201",
            "name": "First Clash",
            "division": "C",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 20,
        },
        {
            "student_id": "stu_clash",
            "seat_no": "SEAT-200B",
            "roll_no": "202",
            "name": "Second Clash",
            "division": "C",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 22,
        },
        # Student 8: Has literal '%' in name
        {
            "student_id": "STU_Percent_08",
            "seat_no": "SEAT-301P",
            "roll_no": "301",
            "name": "Special 100% Student",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 24,
        },
        # Student 9: Contrast student with '1000' to verify '%' is not a wildcard
        {
            "student_id": "STU_Contrast_09",
            "seat_no": "SEAT-302C",
            "roll_no": "302",
            "name": "Special 1000 Student",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 26,
        },
        # Student 10: Has literal '_' in name
        {
            "student_id": "STU_Under_10",
            "seat_no": "SEAT-303U",
            "roll_no": "303",
            "name": "Under_Score Student",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 28,
        },
        # Student 11: Contrast student with space to verify '_' does not match space
        {
            "student_id": "STU_Space_11",
            "seat_no": "SEAT-304S",
            "roll_no": "304",
            "name": "Under Score Student",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 30,
        },
        # Student 12: Has literal '!' (the chosen ESCAPE char) in name
        {
            "student_id": "STU_Exclam_12",
            "seat_no": "SEAT-305E",
            "roll_no": "305",
            "name": "Exclamation! Point",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 32,
        },
        # Student 13: Contrast student without '!' to verify literal '!' matching
        {
            "student_id": "STU_Plain_13",
            "seat_no": "SEAT-306P",
            "roll_no": "306",
            "name": "Exclamation Point",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 34,
        },
        # Student 14: Another student with '%' to test ambiguous wildcard matching
        {
            "student_id": "STU_Percent_14",
            "seat_no": "SEAT-307Q",
            "roll_no": "307",
            "name": "Another 100% Student",
            "division": "D",
            "result": "PASSES",
            "source_sheet": "Sheet1",
            "source_row": 36,
        },
    ]
    populate_table(con, "students", students)

    # Add dummy enrollment and courses so get_student_breakdown can build full reports
    courses = [
        {"code": "CS101", "name": "Intro to Programming", "kind": "theory", "credits": 4.0, "components": "TH,TOT1"}
    ]
    populate_table(con, "courses", courses)

    enrollments = [{"student_id": s["student_id"], "course_code": "CS101"} for s in students]
    populate_table(con, "enrollment", enrollments)

    grades = [{"student_id": s["student_id"], "course_code": "CS101", "letter": "A"} for s in students]
    populate_table(con, "grades", grades)

    reconciliation = [
        {"student_id": s["student_id"], "course_code": "CS101", "printed_total": 85.0, "computed_total": 85.0, "total_match": True, "grade": "A", "flags": ""}
        for s in students
    ]
    populate_table(con, "reconciliation", reconciliation)

    return con


@pytest.fixture(scope="module")
def primary_con():
    """Ingest primary acceptance marksheet into DuckDB."""
    wb_path = DATA_DIR / "Result_anonymized.xlsx"
    if not wb_path.exists():
        pytest.skip(f"Workbook {wb_path} not found")
    con, _ = ingest(wb_path, db_path=":memory:")
    return con


# 1. Uppercase student ID resolves correctly
def test_resolution_uppercase_student_id(isolated_db):
    s, amb = resolve_student(isolated_db, "STU_ALPHA_01")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 2. Lowercase student ID resolves the same student
def test_resolution_lowercase_student_id(isolated_db):
    s, amb = resolve_student(isolated_db, "stu_alpha_01")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 3. Mixed-case student ID resolves correctly
def test_resolution_mixed_case_student_id(isolated_db):
    s, amb = resolve_student(isolated_db, "StU_aLpHa_01")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 4. Leading/trailing whitespace is handled consistently
def test_resolution_whitespace_normalization(isolated_db):
    s, amb = resolve_student(isolated_db, "   STU_Alpha_01 \t\n ")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 5. Case-insensitive seat-number lookup works
def test_resolution_seat_number_case_insensitive(isolated_db):
    s_upper, amb1 = resolve_student(isolated_db, "SEAT-99A")
    s_lower, amb2 = resolve_student(isolated_db, "seat-99a")
    s_space, amb3 = resolve_student(isolated_db, "  seat-99a  ")

    assert s_upper is not None
    assert s_lower is not None
    assert s_space is not None
    assert s_upper["student_id"] == s_lower["student_id"] == s_space["student_id"] == "STU_Alpha_01"
    assert len(amb1) == len(amb2) == len(amb3) == 0


# 6. Existing roll-number lookup still works
def test_resolution_roll_number_lookup(isolated_db):
    s, amb = resolve_student(isolated_db, "101")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 7. Exact name lookup still works
def test_resolution_exact_name_lookup(isolated_db):
    s, amb = resolve_student(isolated_db, "aarav sharma")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 8. Partial-name lookup still works
def test_resolution_partial_name_lookup(isolated_db):
    s, amb = resolve_student(isolated_db, "Bhavya")
    assert s is not None
    assert s["student_id"] == "STU_Beta_02"
    assert len(amb) == 0


# 9. Common partial name returns ambiguous and includes all candidates
def test_resolution_common_partial_name_ambiguous(isolated_db):
    s, amb = resolve_student(isolated_db, "Sharma")
    assert s is None
    assert len(amb) == 2
    matched_ids = {c["student_id"] for c in amb}
    assert matched_ids == {"STU_Alpha_01", "STU_Beta_02"}

    # Also check through report service
    rep = get_student_breakdown(isolated_db, "Sharma")
    assert rep.status == "ambiguous"
    assert len(rep.matching_candidates) == 2


# 10. Query matching multiple records after normalization never silently picks one
def test_resolution_multiple_matches_after_normalization(isolated_db):
    # Query 'stu_clash' matches both 'STU_CLASH' (exact) and 'stu_clash' (exact)
    # Stage 1a finds 1 ('stu_clash'), but if queried with mixed case 'Stu_Clash',
    # Stage 1a has 0 matches, and Stage 1b finds both records -> must return ambiguous
    s, amb = resolve_student(isolated_db, "Stu_Clash")
    assert s is None
    assert len(amb) == 2
    matched_ids = {c["student_id"] for c in amb}
    assert matched_ids == {"STU_CLASH", "stu_clash"}

    # Also test roll number collision across divisions
    s_roll, amb_roll = resolve_student(isolated_db, "50")
    assert s_roll is None
    assert len(amb_roll) == 2
    roll_ids = {c["student_id"] for c in amb_roll}
    assert roll_ids == {"STU_Delta_04", "STU_Epsilon_05"}


# 11. Higher-priority identifier preserves precedence over lower-priority name
def test_resolution_precedence_identifier_over_name(isolated_db):
    # Query 'STU_Alpha_01' matches student 1 as student_id and student 3 as name substring
    # Precedence rule: student_id MUST take priority over partial-name match
    s, amb = resolve_student(isolated_db, "STU_Alpha_01")
    assert s is not None
    assert s["student_id"] == "STU_Alpha_01"
    assert len(amb) == 0


# 12. Unknown identifier returns not_found
def test_resolution_unknown_identifier(isolated_db):
    s, amb = resolve_student(isolated_db, "UNKNOWN_STUDENT_XYZ_999")
    assert s is None
    assert len(amb) == 0

    rep = get_student_breakdown(isolated_db, "UNKNOWN_STUDENT_XYZ_999")
    assert rep.status == "not_found"
    assert rep.student is None


# 13. User input is safely parameterized through DB-API
def test_resolution_sql_parameterization_safety(isolated_db):
    # Malicious SQL injection payloads
    payloads = [
        "' OR '1'='1",
        "'; DROP TABLE students; --",
        "STU_Alpha_01' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL --",
        "%' OR 1=1 --",
    ]
    for payload in payloads:
        rep = get_student_breakdown(isolated_db, payload)
        # Injection must fail safely without executing unauthorized SQL or returning all students
        assert rep.status == "not_found"
        assert rep.student is None

    # Verify database table still exists and is healthy
    count = isolated_db.execute("SELECT count(*) FROM students").fetchone()[0]
    assert count == 14


# 14. Real-workbook acceptance verification with case-insensitivity
def test_real_workbook_case_insensitive_student_lookup(primary_con):
    # Lowercase lookup of failing student 23108a0032
    rep_lower = get_student_breakdown(primary_con, "23108a0032")
    rep_upper = get_student_breakdown(primary_con, "23108A0032")
    rep_space = get_student_breakdown(primary_con, "  23108A0032  ")

    assert rep_lower.status == "success"
    assert rep_upper.status == "success"
    assert rep_space.status == "success"
    assert rep_lower.student.student_id == rep_upper.student.student_id == "23108A0032"
    assert rep_lower.total_enrolled == 12
    assert rep_lower.failed_count == 2
    assert rep_lower.passed_count == 10


# 15. Literal '%' in partial-name search is not interpreted as a wildcard
def test_resolution_literal_percent_wildcard(isolated_db):
    # 'Special 100%' matches STU_Percent_08 ('Special 100% Student')
    # and MUST NOT match STU_Contrast_09 ('Special 1000 Student')
    s, amb = resolve_student(isolated_db, "Special 100%")
    assert s is not None
    assert s["student_id"] == "STU_Percent_08"
    assert len(amb) == 0

    # Case-insensitivity preserved with literal '%'
    s_ci, amb_ci = resolve_student(isolated_db, "special 100%")
    assert s_ci is not None
    assert s_ci["student_id"] == "STU_Percent_08"
    assert len(amb_ci) == 0


# 16. Literal '_' in partial-name search is not interpreted as a wildcard
def test_resolution_literal_underscore_wildcard(isolated_db):
    # 'Under_Score' matches STU_Under_10 ('Under_Score Student')
    # and MUST NOT match STU_Space_11 ('Under Score Student')
    s, amb = resolve_student(isolated_db, "Under_Score")
    assert s is not None
    assert s["student_id"] == "STU_Under_10"
    assert len(amb) == 0

    # 'Under Score' matches STU_Space_11 and MUST NOT match STU_Under_10
    s_space, amb_space = resolve_student(isolated_db, "Under Score")
    assert s_space is not None
    assert s_space["student_id"] == "STU_Space_11"
    assert len(amb_space) == 0


# 17. The escape character '!' is treated literally in search queries
def test_resolution_escape_character_literal(isolated_db):
    # 'Exclamation!' matches STU_Exclam_12 ('Exclamation! Point')
    # and MUST NOT match STU_Plain_13 ('Exclamation Point')
    s, amb = resolve_student(isolated_db, "Exclamation!")
    assert s is not None
    assert s["student_id"] == "STU_Exclam_12"
    assert len(amb) == 0

    # '!' alone matches only STU_Exclam_12
    s_bang, amb_bang = resolve_student(isolated_db, "!")
    assert s_bang is not None
    assert s_bang["student_id"] == "STU_Exclam_12"
    assert len(amb_bang) == 0


# 18. Genuinely ambiguous partial search with literal wildcards returns all matching candidates
def test_resolution_ambiguous_with_literal_wildcards(isolated_db):
    # Query '100%' matches both STU_Percent_08 ('Special 100% Student')
    # and STU_Percent_14 ('Another 100% Student'), but NOT STU_Contrast_09 ('Special 1000 Student')
    s, amb = resolve_student(isolated_db, "100%")
    assert s is None
    assert len(amb) == 2
    matched_ids = {c["student_id"] for c in amb}
    assert matched_ids == {"STU_Percent_08", "STU_Percent_14"}

    rep = get_student_breakdown(isolated_db, "100%")
    assert rep.status == "ambiguous"
    assert len(rep.matching_candidates) == 2


# 19. Wildcard-only search does not match all students or bypass filtering
def test_resolution_wildcard_only_queries_safe(isolated_db):
    # '%%%' does not match any student (no student has 3 consecutive %)
    s_perc, amb_perc = resolve_student(isolated_db, "%%%")
    assert s_perc is None
    assert len(amb_perc) == 0

    # '_____' does not match any student (no student has 5 consecutive _)
    s_under, amb_under = resolve_student(isolated_db, "_____")
    assert s_under is None
    assert len(amb_under) == 0

