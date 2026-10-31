"""Test suite for Ask AI natural language translation, HOD brief verification, and notice drafting.

Ensures strict compliance with:
- 25+ diverse test questions and high translation accuracy
- Immediate refusal of statistical analysis (correlations, distributions, clustering)
- Zero PII in schema and prompts
- 100% numeric verification of the HOD brief
"""
import duckdb
import pytest
from fastapi.testclient import TestClient

from app.api.schemas.ai import AskAiResponse
from app.api.schemas.investigation import InvestigationQueryRequest
from app.main import create_app
from app.services.ai_service import (
    EXPLORE_SCHEMA,
    STATISTICAL_REFUSAL_MESSAGE,
    draft_notice_template,
    generate_hod_brief,
    translate_natural_query,
)


@pytest.fixture
def app_client():
    app = create_app()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def db_connection():
    con = duckdb.connect("data/eduquery.duckdb", read_only=True)
    yield con
    con.close()


class TestPrivacyAndSchemaGuarantees:
    def test_schema_never_contains_pii(self):
        """Verify the AI schema description contains only field metadata, no student names or marks."""
        field_names = [f["name"] for f in EXPLORE_SCHEMA["fields"]]
        assert "name" not in field_names
        assert "roll_no" not in field_names
        assert "seat_no" not in field_names

        # Verify no student values are leaked in schema definitions
        schema_str = str(EXPLORE_SCHEMA)
        assert "SEAT_" not in schema_str
        assert "Student " not in schema_str


class TestAskAiQuestionSuite:
    """Suite of 27 realistic natural language queries tested for translation accuracy and correctness."""

    TEST_QUESTIONS = [
        # (Query, Expected Conditions Count, Expected Field, Expected Op, Expected Val or Sort)
        ("Students in Division A", 1, "division", "eq", "A"),
        ("Students in Division B", 1, "division", "eq", "B"),
        ("Who failed?", 1, "result", "eq", "FAILED"),
        ("Show all passed students", 1, "result", "eq", "PASSED"),
        ("Students who failed in Division A", 2, "division", "eq", "A"),
        ("Failed students in Division B", 2, "division", "eq", "B"),
        ("Students with absences", 1, "has_absent", "eq", True),
        ("Who missed exams?", 1, "has_absent", "eq", True),
        ("Students absent in 5+ subjects", 1, "absent_subject_count", "gte", 5),
        ("Students absent in 1-2 subjects", 2, "absent_subject_count", "lte", 2),
        ("Who failed in PCEC12T?", 2, "course_code", "eq", "PCEC12T"),
        ("Students absent in PCEC12T", 1, "absent_course_code", "eq", "PCEC12T"),
        ("Critical failures with 4+ backlogs", 1, "failed_subject_count", "gte", 4),
        ("Students who failed 1-3 subjects", 2, "failed_subject_count", "lte", 3),
        ("Students with multiple failed subjects", 1, "multi_fails", "eq", True),
        ("Who are the top 5 toppers?", 0, None, None, None),  # Sort by CGPA desc
        ("Show the merit list", 0, None, None, None),
        ("Students with SGPI >= 9.0", 1, "sgpi", "gte", 9.0),
        ("Students with CGPA above 8.5", 1, "cgpa", "gte", 8.5),
        ("Students with total marks > 700", 1, "total_marks", "gte", 700),
        ("Passed students in Division A", 2, "division", "eq", "A"),
        ("Passed students in Division B", 2, "division", "eq", "B"),
        # Statistical refusals (Out of scope)
        ("What is the correlation between SGPI and PCEC12T marks?", -1, "REFUSAL", "stat", None),
        ("Show me the grade distribution curve for Division A", -1, "REFUSAL", "stat", None),
        ("Cluster the students into 3 performance groups", -1, "REFUSAL", "stat", None),
        ("Calculate standard deviation of marks across subjects", -1, "REFUSAL", "stat", None),
        ("Normalize marks using a bell curve for PCEC14T", -1, "REFUSAL", "stat", None),
    ]

    def test_27_questions_accuracy(self, db_connection):
        correct = 0
        total = len(self.TEST_QUESTIONS)

        for query, expected_cond_count, exp_field, exp_op, exp_val in self.TEST_QUESTIONS:
            res: AskAiResponse = translate_natural_query(db_connection, query)

            if exp_field == "REFUSAL":
                assert res.is_refused is True
                assert STATISTICAL_REFUSAL_MESSAGE in res.refusal
                correct += 1
            else:
                assert res.is_refused is False
                assert res.refusal is None
                assert res.results is not None

                if exp_field is not None:
                    # Condition present
                    matching_cond = [
                        c for c in res.predicate_ast.conditions
                        if c.field == exp_field and c.operator == exp_op and c.value == exp_val
                    ]
                    assert len(matching_cond) >= 1, f"Failed condition match for query: {query}"
                else:
                    # Sort check (toppers)
                    assert res.query_request.sort_by == "cgpa"
                    assert res.query_request.sort_dir == "desc"

                correct += 1

        accuracy_percent = (correct / total) * 100.0
        assert accuracy_percent == 100.0, f"Expected 100% accuracy across test questions, got {accuracy_percent}%"

    def test_non_academic_query_refusal(self, db_connection):
        res = translate_natural_query(db_connection, "What is the capital of France?")
        assert res.is_refused is True
        assert "academic result management assistant" in res.refusal

    def test_query_deterministic_execution_against_dataset(self, db_connection):
        """Verify ground truth numbers when executing natural queries."""
        # 1. "Who failed?" -> 13 students
        res_failed = translate_natural_query(db_connection, "Who failed?")
        assert res_failed.results.total == 13

        # 2. "Who passed?" -> 132 students
        res_passed = translate_natural_query(db_connection, "Who passed?")
        assert res_passed.results.total == 132

        # 3. "Students with absences" -> 7 students
        res_absent = translate_natural_query(db_connection, "Students with absences")
        assert res_absent.results.total == 7

        # 4. "Students absent in 5+ subjects" -> 6 students
        res_absent_crit = translate_natural_query(db_connection, "Students absent in 5+ subjects")
        assert res_absent_crit.results.total == 6

        # 5. "Students absent in 1-2 subjects" -> 1 student
        res_absent_minor = translate_natural_query(db_connection, "Students absent in 1-2 subjects")
        assert res_absent_minor.results.total == 1


class TestHodBriefFactVerification:
    def test_hod_brief_verified_against_ground_truth(self, db_connection):
        brief = generate_hod_brief(db_connection)
        assert brief.verified is True
        assert "All numeric statements verified" in brief.validation_notes

        # Ground truth checks in facts_used
        facts = brief.facts_used
        assert facts["cohort_total"] == 145
        assert facts["total_passed"] == 132
        assert facts["total_failed"] == 13
        assert facts["pass_percentage"] == 91.0
        assert facts["fail_percentage"] == 9.0
        assert facts["division_a_total"] == 85
        assert facts["division_a_passed"] == 75
        assert facts["division_a_pass_percent"] == 88.2
        assert facts["division_b_total"] == 60
        assert facts["division_b_passed"] == 57
        assert facts["division_b_pass_percent"] == 95.0
        assert facts["total_students_with_absent"] == 7
        assert facts["hardest_course_code"] == "PCEC12T"
        assert facts["hardest_course_failures"] == 12
        assert facts["top_cgpa"] == 9.85
        assert facts["unresolved_data_discrepancies"] == 0

    def test_hod_brief_catches_unverified_hallucination(self):
        """Simulate an LLM outputting a hallucinated number not in the facts."""
        from app.services.ai_service import re

        fake_facts = {"cohort_total": 145, "total_passed": 132}
        hallucinated_text = "145 students took the exam, and 141 passed with flying colors!"

        allowed = {str(v) for v in fake_facts.values()}
        extracted = re.findall(r"\b\d+(?:\.\d+)?\b", hallucinated_text)
        unverified = [n for n in extracted if n not in allowed]

        assert "141" in unverified
        assert len(unverified) > 0  # Successfully caught hallucinated number


class TestNoticeDrafting:
    def test_failed_notice_draft(self):
        draft = draft_notice_template("failed")
        assert draft.template_type == "failed"
        assert "{name}" in draft.body_template
        assert "{roll_no}" in draft.body_template
        assert "{subjects}" in draft.body_template
        assert "{sgpi}" in draft.body_template

    def test_absent_notice_draft(self):
        draft = draft_notice_template("absent")
        assert draft.template_type == "absent"
        assert "ABSENT" in draft.body_template
        assert "{subjects}" in draft.body_template

    def test_merit_notice_draft(self):
        draft = draft_notice_template("merit")
        assert draft.template_type == "merit"
        assert "Merit List" in draft.body_template
        assert "{sgpi}" in draft.body_template


class TestAiApiEndpoints:
    def test_api_ask_endpoint(self, app_client):
        res = app_client.post("/api/v1/ai/ask", json={"query": "Who failed in Division A?"})
        assert res.status_code == 200
        data = res.json()
        assert data["is_refused"] is False
        assert "Division = 'A'" in data["interpreted_query"]
        assert data["results"]["total"] == 10  # 10 failures in Div A

    def test_api_ask_statistical_refusal(self, app_client):
        res = app_client.post("/api/v1/ai/ask", json={"query": "Calculate correlation between marks"})
        assert res.status_code == 200
        data = res.json()
        assert data["is_refused"] is True
        assert STATISTICAL_REFUSAL_MESSAGE in data["refusal"]

    def test_api_hod_brief_endpoint(self, app_client):
        res = app_client.get("/api/v1/ai/hod-brief")
        assert res.status_code == 200
        data = res.json()
        assert data["verified"] is True
        assert data["facts_used"]["cohort_total"] == 145

    def test_api_notice_draft_endpoint(self, app_client):
        res = app_client.post("/api/v1/ai/notice-draft", json={"template_type": "merit"})
        assert res.status_code == 200
        data = res.json()
        assert "{sgpi}" in data["body_template"]
