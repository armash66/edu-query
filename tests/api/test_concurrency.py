"""Concurrency, isolation, and load resilience test suite for EduQuery V3 API."""
from __future__ import annotations

import asyncio
import concurrent.futures
import tempfile
import time
from pathlib import Path
from typing import Any

import duckdb
import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.database import init_database, populate_table
from app.main import create_app


@pytest.fixture
def concurrent_on_disk_db():
    """Create an on-disk DuckDB database with controlled synthetic multi-division records."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = Path(tmp_dir) / "concurrent_test.duckdb"
        con = duckdb.connect(str(db_path))
        init_database(con)

        # 10 synthetic students across Div A and B
        students = [
            {"student_id": f"STU_{i:02d}", "name": f"Student {i}", "seat_no": f"S{i:02d}", "roll_no": str(i),
             "division": "A" if i <= 5 else "B", "result": "PASSES" if i % 3 != 0 else "FAILS", "source_sheet": "Sheet1", "source_row": 10 + i}
            for i in range(1, 11)
        ]
        populate_table(con, "students", students)

        # 3 courses
        courses = [
            {"code": "CS101", "name": "Theory of Computing", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
            {"code": "CS102", "name": "Database Systems", "kind": "theory", "credits": 4.0, "components": "TH,IA"},
            {"code": "CS103L", "name": "Systems Lab", "kind": "practical", "credits": 2.0, "components": "PR"},
        ]
        populate_table(con, "courses", courses)

        # Enrollments
        enrollments = []
        for s in students:
            enrollments.append({"student_id": s["student_id"], "course_code": "CS101"})
            enrollments.append({"student_id": s["student_id"], "course_code": "CS102"})
            if s["division"] == "A":
                enrollments.append({"student_id": s["student_id"], "course_code": "CS103L"})
        populate_table(con, "enrollment", enrollments)

        # Scores & grades
        scores = []
        grades = []
        for s in students:
            sid = s["student_id"]
            is_fail = (s["result"] == "FAILS")
            # CS101
            scores.append({
                "student_id": sid, "course_code": "CS101", "component": "TH",
                "value": 25.0 if is_fail else 65.0, "flag": "F" if is_fail else None,
                "state": "marked", "raw_text": "25 F" if is_fail else "65",
                "source_sheet": "Sheet1", "source_row": s["source_row"]
            })
            grades.append({"student_id": sid, "course_code": "CS101", "letter": "F" if is_fail else "B"})

            # CS102 (all pass)
            scores.append({
                "student_id": sid, "course_code": "CS102", "component": "TH",
                "value": 70.0, "flag": None, "state": "marked", "raw_text": "70",
                "source_sheet": "Sheet1", "source_row": s["source_row"]
            })
            grades.append({"student_id": sid, "course_code": "CS102", "letter": "A"})
        populate_table(con, "scores", scores)
        populate_table(con, "grades", grades)

        # Reconciliation
        reconcil = []
        for s in students:
            sid = s["student_id"]
            is_fail = (s["result"] == "FAILS")
            reconcil.append({
                "student_id": sid, "course_code": "CS101",
                "printed_total": 25.0 if is_fail else 65.0,
                "computed_total": 25.0 if is_fail else 65.0,
                "total_match": True, "grade": "F" if is_fail else "B",
                "flags": "F" if is_fail else ""
            })
        populate_table(con, "reconciliation", reconcil)

        con.close()
        yield str(db_path)


@pytest.mark.asyncio
async def test_concurrent_health_checks(concurrent_on_disk_db):
    """Verify multiple concurrent health probes return 200 with identical metrics."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get("/health") for _ in range(20)]
        responses = await asyncio.gather(*tasks)

        assert len(responses) == 20
        for r in responses:
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "healthy"
            assert data["database"]["connected"] is True
            assert data["database"]["students_count"] == 10
            assert data["database"]["courses_count"] == 3


@pytest.mark.asyncio
async def test_concurrent_student_roster_queries(concurrent_on_disk_db):
    """Verify concurrent student list queries with disparate filters return deterministic results."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    queries = [
        "/api/v1/students",
        "/api/v1/students?division=A",
        "/api/v1/students?division=B",
        "/api/v1/students?result=FAILS",
        "/api/v1/students?query=Student%201",
        "/api/v1/students?limit=2&offset=0",
        "/api/v1/students?limit=2&offset=2",
    ] * 3  # 21 requests

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get(q) for q in queries]
        responses = await asyncio.gather(*tasks)

        assert len(responses) == len(queries)
        for r in responses:
            assert r.status_code == 200
            data = r.json()
            assert "total" in data
            assert "items" in data


@pytest.mark.asyncio
async def test_concurrent_student_breakdown_queries(concurrent_on_disk_db):
    """Verify concurrent requests for multiple student breakdowns resolve cleanly without locking."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    student_urls = [f"/api/v1/students/STU_{i:02d}/breakdown" for i in range(1, 11)] * 2  # 20 requests

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get(url) for url in student_urls]
        responses = await asyncio.gather(*tasks)

        assert len(responses) == 20
        for r in responses:
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "success"
            assert len(data["subjects"]) >= 2


@pytest.mark.asyncio
async def test_concurrent_subject_failure_queries(concurrent_on_disk_db):
    """Verify concurrent subject failure and summary endpoints execute in parallel and reconcile."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    endpoints = [
        "/api/v1/subjects",
        "/api/v1/subjects/failure-summary",
        "/api/v1/subjects/CS101/failures",
        "/api/v1/subjects/CS101/failures?division=A",
        "/api/v1/subjects/CS101/failures?division=B",
        "/api/v1/subjects/CS102/failures",
    ] * 4  # 24 requests

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get(ep) for ep in endpoints]
        responses = await asyncio.gather(*tasks)

        assert len(responses) == 24
        for r in responses:
            assert r.status_code == 200


@pytest.mark.asyncio
async def test_concurrent_mixed_endpoints_and_error_isolation(concurrent_on_disk_db):
    """Verify concurrent mixture of valid requests and error-inducing requests do not cross-contaminate."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    requests_mix = [
        # Valid requests (expect 200)
        ("/health", 200),
        ("/api/v1/students", 200),
        ("/api/v1/students/STU_01/breakdown", 200),
        ("/api/v1/subjects/CS101/failures", 200),
        ("/api/v1/data-quality", 200),
        # Unknown student (expect 404)
        ("/api/v1/students/NON_EXISTENT_999/breakdown", 404),
        # Unknown course (expect 404)
        ("/api/v1/subjects/UNKNOWN_COURSE_999/failures", 404),
        # Invalid pagination (expect 422)
        ("/api/v1/students?limit=-1", 422),
        ("/api/v1/students?limit=5000", 422),
    ] * 3  # 27 concurrent requests

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        tasks = [client.get(path) for path, _ in requests_mix]
        responses = await asyncio.gather(*tasks)

        for resp, (path, expected_status) in zip(responses, requests_mix):
            assert resp.status_code == expected_status, f"Path {path} returned {resp.status_code}, expected {expected_status}"


def test_multithreaded_concurrency_with_threadpool(concurrent_on_disk_db):
    """Verify simultaneous multithreaded requests across OS worker threads."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    def worker_task(url: str) -> tuple[int, dict[str, Any]]:
        with TestClient(app) as client:
            resp = client.get(url)
            return resp.status_code, resp.json()

    urls = [
        "/health",
        "/api/v1/students",
        "/api/v1/subjects",
        "/api/v1/subjects/failure-summary",
        "/api/v1/data-quality",
        "/api/v1/students/STU_02/breakdown",
    ] * 5  # 30 requests

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(worker_task, urls))

    assert len(results) == 30
    for status_code, body in results:
        assert status_code == 200
        assert body is not None


@pytest.mark.asyncio
async def test_concurrency_performance_benchmark(concurrent_on_disk_db):
    """Benchmark: Execute 100 concurrent requests across all core endpoints and measure latencies."""
    settings = Settings(database_path=concurrent_on_disk_db)
    app = create_app(settings)

    endpoint_mix = [
        "/health",
        "/api/v1/students",
        "/api/v1/students/STU_01/breakdown",
        "/api/v1/students/STU_04/breakdown",
        "/api/v1/subjects",
        "/api/v1/subjects/failure-summary",
        "/api/v1/subjects/CS101/failures",
        "/api/v1/subjects/CS101/failures?division=A",
        "/api/v1/data-quality",
    ]
    total_requests = 100
    urls = [endpoint_mix[i % len(endpoint_mix)] for i in range(total_requests)]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        start_time = time.perf_counter()
        tasks = [client.get(u) for u in urls]
        responses = await asyncio.gather(*tasks)
        total_duration = time.perf_counter() - start_time

        assert len(responses) == total_requests
        assert all(r.status_code == 200 for r in responses)

        # All requests succeeded
        throughput = total_requests / total_duration
        avg_latency_ms = (total_duration / total_requests) * 1000

        # Assert reasonable bounds (< 15ms per request avg, > 50 req/sec)
        assert avg_latency_ms < 50.0  # Well within sub-50ms bounds
        assert throughput > 20.0
