"""Unit regression tests for Academic Rules and Classification Correctness (Phases 6 & 7).

Invariants tested:
- Blank marks / missing grade -> unresolved (MISSING_GRADE_UNRESOLVED).
- Unknown grade strings -> unresolved (UNRECOGNIZED_GRADE).
- Absent codes alone -> unresolved (ABSENT_IN_ASSESSMENT), never silently equated to failure or zero.
- Conflicting indicators (e.g. passing letter grade 'A' with component flag 'F') -> unresolved (CONFLICTING_RESULT_INDICATORS) surfaced for review, never falsely counted as confirmed failure.
- Absent component with authoritative passing final grade -> passed (PASSING_GRADE_WITH_ABSENT_COMPONENT).
- Failing final grade with passing component -> confirmed fail (FAILING_LETTER_GRADE).
- Explicit fail grades ('F', 'FAIL') -> confirmed fail (FAILING_LETTER_GRADE).
- Explicit component fail flags ('F') without final grade -> confirmed fail (EXPLICIT_FAIL_FLAG).
- Valid passing grades ('O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'P') -> confirmed pass (PASSING_LETTER_GRADE).
- Case and whitespace insensitivity in grades and flags.
"""

import pytest

from app.reports.student_breakdown import (
    classify_subject_result,
    classify_subject_result_with_reason,
)


def test_passing_grades_with_no_fail_flags():
    for grade in ["O", "A+", "A", "B+", "B", "C", "D", "E", "P", "  a+  ", "b"]:
        outcome, reason = classify_subject_result_with_reason(grade, [])
        assert outcome == "passed", f"Expected passed for {grade}, got {outcome}"
        assert reason == "PASSING_LETTER_GRADE"
        assert classify_subject_result(grade, []) == "passed"


def test_failing_grades():
    for grade in ["F", "FAIL", "FAILS", " f ", "fail"]:
        outcome, reason = classify_subject_result_with_reason(grade, [])
        assert outcome == "failed", f"Expected failed for {grade}, got {outcome}"
        assert reason == "FAILING_LETTER_GRADE"
        assert classify_subject_result(grade, []) == "failed"


def test_failing_final_grade_with_passing_component():
    # University awards overall 'F', even though a component had passing marks
    outcome, reason = classify_subject_result_with_reason("F", ["P"])
    assert outcome == "failed"
    assert reason == "FAILING_LETTER_GRADE"
    assert classify_subject_result("F", ["P"]) == "failed"


def test_explicit_fail_flag_without_letter_grade():
    outcome, reason = classify_subject_result_with_reason(None, ["F"])
    assert outcome == "failed"
    assert reason == "EXPLICIT_FAIL_FLAG"
    assert classify_subject_result(None, ["F"]) == "failed"


def test_conflicting_result_indicators_surfaced_as_unresolved():
    # Passing letter grade 'A' but one component was flagged as 'F' (e.g. failed internal assessment)
    # Must NOT be classified as confirmed failure, but as unresolved for review
    outcome, reason = classify_subject_result_with_reason("A", ["P", "F"])
    assert outcome == "unresolved"
    assert reason == "CONFLICTING_RESULT_INDICATORS"
    assert classify_subject_result("A", ["P", "F"]) == "unresolved"

    outcome, reason = classify_subject_result_with_reason("B+", ["f"])
    assert outcome == "unresolved"
    assert reason == "CONFLICTING_RESULT_INDICATORS"


def test_absent_component_with_passing_final_grade():
    # Student was absent in internal assessment (e.g. quiz), but passed overall with final grade 'B'
    outcome, reason = classify_subject_result_with_reason("B", ["ABS"], is_absent=True)
    assert outcome == "passed"
    assert reason == "PASSING_GRADE_WITH_ABSENT_COMPONENT"
    assert classify_subject_result("B", ["ABS"], is_absent=True) == "passed"


def test_absent_in_assessment_never_equated_to_failure():
    # Student marked absent without a failure grade or failure flag must be unresolved, NOT confirmed failed
    outcome, reason = classify_subject_result_with_reason(None, ["AB"], is_absent=True)
    assert outcome == "unresolved"
    assert reason == "ABSENT_IN_ASSESSMENT"
    assert classify_subject_result(None, ["AB"], is_absent=True) == "unresolved"

    outcome, reason = classify_subject_result_with_reason("", ["ABS"])
    assert outcome == "unresolved"
    assert reason == "ABSENT_IN_ASSESSMENT"


def test_unrecognized_grades_remain_unresolved():
    # Unknown grades like 'XY', 'AUDIT', 'W', 'INCOMPLETE'
    for grade in ["XY", "AUDIT", "W", "INC", "UNKNOWN"]:
        outcome, reason = classify_subject_result_with_reason(grade, [])
        assert outcome == "unresolved", f"Expected unresolved for {grade}, got {outcome}"
        assert reason == "UNRECOGNIZED_GRADE"
        assert classify_subject_result(grade, []) == "unresolved"


def test_missing_or_blank_grades_remain_unresolved():
    for blank in [None, "", "   "]:
        outcome, reason = classify_subject_result_with_reason(blank, [])
        assert outcome == "unresolved"
        assert reason == "MISSING_GRADE_UNRESOLVED"
        assert classify_subject_result(blank, []) == "unresolved"
