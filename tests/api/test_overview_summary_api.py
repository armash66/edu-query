"""Comprehensive tests for additive GET /api/v1/overview/summary endpoint."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_overview_summary_endpoint_success(client: TestClient) -> None:
    """Verify endpoint responds 200 and matches all synthetic dataset ground truth numbers."""
    response = client.get("/api/v1/overview/summary")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # 1. Dataset metadata
    assert "dataset" in data
    assert data["dataset"]["id"] is not None
    assert "status_label" in data["dataset"]
    # Internal word 'Persistent' must never be used
    assert "Persistent" not in data["dataset"]["status_label"]

    # 2. KPIs
    kpis = data["kpis"]
    assert kpis["total_students"] == 145
    assert kpis["total_courses"] == 27
    assert kpis["passed_students"] == 132
    assert kpis["failed_students"] == 13
    assert kpis["absent_students"] == 0
    assert kpis["pass_rate_percent"] == 91.0
    assert kpis["divisions_count"] == 2
    assert kpis["needs_attention_count"] == 8
    assert kpis["sgpi_average"] == 8.8
    assert kpis["sgpi_median"] == 8.9
    assert kpis["students_with_sgpi"] == 132
    assert kpis["students_without_sgpi"] == 13

    # 3. Needs attention list (top 5 max, title cased, reason and severity)
    needs_att = data["needs_attention"]
    assert len(needs_att) <= 5
    assert len(needs_att) > 0
    for student in needs_att:
        assert student["student_id"]
        assert student["student_name"]
        # Must be title-cased
        assert not student["student_name"].isupper()
        assert student["severity"] in ["info", "warning", "critical"]
        assert student["reason"]
        assert student["finding_id"]
        assert student["record_link"]

    # 4. Results & Division breakdown
    results = data["results"]
    assert results["passed"]["count"] == 132
    assert results["passed"]["percentage"] == 91.0
    assert results["failed"]["count"] == 13
    assert results["failed"]["percentage"] == 9.0
    assert results["absent"]["count"] == 0
    assert results["absent"]["percentage"] == 0.0

    divs = {d["division_code"]: d for d in results["divisions"]}
    assert "A" in divs and "B" in divs
    assert divs["A"]["passed"] == 75
    assert divs["A"]["enrolled"] == 85
    assert divs["A"]["pass_rate_percent"] == 88.2

    assert divs["B"]["passed"] == 57
    assert divs["B"]["enrolled"] == 60
    assert divs["B"]["pass_rate_percent"] == 95.0

    # 5. SGPI Distribution
    sgpi_dist = data["sgpi_distribution"]
    assert sgpi_dist["average"] == 8.8
    assert sgpi_dist["median"] == 8.9
    assert sgpi_dist["students_with_sgpi"] == 132
    assert sgpi_dist["students_without_sgpi"] == 13

    # Bin counts must sum to exactly students_with_sgpi (132)
    bin_total = sum(b["count"] for b in sgpi_dist["bins"])
    assert bin_total == 132, f"Bin sum {bin_total} != 132 students with SGPI"
    assert len(sgpi_dist["bins"]) == 10

    # 6. Hardest subjects (top 5 with tier rule from A1)
    hardest = data["hardest_subjects"]
    assert len(hardest) <= 5
    top_subject = hardest[0]
    assert top_subject["course_code"] == "PCEC12T"
    assert top_subject["failed_count"] == 12
    assert top_subject["enrolled_count"] == 145
    assert top_subject["failure_rate_percent"] == 8.3
    assert top_subject["tier"] == "amber"  # 5-15% is amber

    # Subsequent courses (<5% failure rate) must be neutral
    for subj in hardest[1:]:
        assert subj["failure_rate_percent"] < 5.0
        assert subj["tier"] == "neutral"

    # 7. Highlights strip (deterministic server-computed insight sentences)
    highlights = data["highlights"]
    assert len(highlights) >= 1
    texts = [h["text"] for h in highlights]

    # Check the 3 deterministic templates
    assert any("highest failure rate: 8.3% (12 students)" in t for t in texts)
    assert any("Division B's pass rate is 6.8 points higher than Division A's" in t for t in texts)
    assert any("9 students failed two or more subjects" in t for t in texts)

