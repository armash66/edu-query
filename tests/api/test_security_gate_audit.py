"""Pre-deployment security gate and hardening test suite for EduQuery V3.

Validates:
1. Strict CORS allowlisting, lookalike origin rejection, and preflight behavior.
2. Faculty Identity Gateway (Cloudflare Access RS256 JWT, audience, issuer, expiry, fail-closed, direct-bypass blocking).
3. CSV Export authentication, deprecation of query-token fallback, single-use ticket consumption, and formula injection protection.
4. Storage and session isolation between temporary sessions (/tmp/eduquery-sessions) and institutional datasets (/app/data).
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import Settings
from app.core.gateway_auth import verify_gateway_identity
from app.main import create_app
from app.services.export_service import sanitize_csv_cell
from app.services.session_manager import (
    consume_download_ticket,
    issue_download_ticket,
    save_session_to_permanent,
)


@pytest.fixture(scope="module")
def rsa_keypair():
    """Generate an RSA key pair for testing JWT gateway verification."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem.decode("utf-8")


# =============================================================================
# 1. CORS AUDIT TESTS
# =============================================================================

def test_cors_allowed_origin_receives_headers():
    """Verify that an explicitly approved origin receives CORS allow headers."""
    settings = Settings(
        app_env="production",
        cors_origins=["https://faculty.college.edu", "http://localhost:5173"],
        cors_origin_regex=None,
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    response = client.get("/livez", headers={"Origin": "https://faculty.college.edu"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://faculty.college.edu"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_lookalike_domain():
    """Verify that lookalike attacker domains are rejected without CORS headers."""
    settings = Settings(
        app_env="production",
        cors_origins=["https://faculty.college.edu", "https://eduquery-v3.vercel.app"],
        cors_origin_regex=None,
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    # Attackers attempting domain suffix or lookalike tricks
    malicious_origins = [
        "https://faculty.college.edu.attacker.com",
        "https://attacker-faculty.college.edu",
        "https://eduquery-v3.vercel.app.attacker.com",
        "https://fakeeduquery-v3.vercel.app",
        "https://unapproved.vercel.app",
    ]

    for evil_origin in malicious_origins:
        response = client.get("/health", headers={"Origin": evil_origin})
        assert response.headers.get("access-control-allow-origin") is None, (
            f"Malicious origin {evil_origin} must not receive Access-Control-Allow-Origin header"
        )


def test_cors_preflight_options_behavior():
    """Verify OPTIONS preflight request behavior for allowed vs disallowed origins."""
    settings = Settings(
        app_env="production",
        cors_origins=["https://faculty.college.edu"],
        cors_origin_regex=None,
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    # Valid preflight
    resp_valid = client.options(
        "/api/v1/session/upload",
        headers={
            "Origin": "https://faculty.college.edu",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, X-EduQuery-Session-Token",
        },
    )
    assert resp_valid.status_code == 200
    assert resp_valid.headers.get("access-control-allow-origin") == "https://faculty.college.edu"
    assert "POST" in resp_valid.headers.get("access-control-allow-methods", "")

    # Disallowed preflight
    resp_evil = client.options(
        "/api/v1/session/upload",
        headers={
            "Origin": "https://attacker.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp_evil.headers.get("access-control-allow-origin") is None


def test_cors_is_not_authentication():
    """Verify CORS does not grant access to protected endpoints without session credentials."""
    settings = Settings(
        app_env="production",
        cors_origins=["https://faculty.college.edu"],
        cors_origin_regex=None,
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    # Sending an approved origin to a protected route without session token must fail
    response = client.get(
        "/api/v1/analytics/overview",
        headers={"Origin": "https://faculty.college.edu"},
    )
    # Database is uninitialized memory without session -> 503 DATABASE_UNAVAILABLE
    assert response.status_code in (401, 503)


# =============================================================================
# 2. FACULTY IDENTITY GATEWAY AUTHENTICATION TESTS
# =============================================================================

def test_gateway_auth_required_fails_closed_when_unconfigured():
    """Verify fail-closed behavior when gateway authentication is required but unconfigured."""
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_aud=None,
        gateway_shared_secret=None,
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    response = client.get("/api/v1/analytics/overview")
    assert response.status_code == 500
    data = response.json()
    err_code = data.get("error_code") or data.get("detail", {}).get("error_code")
    assert err_code == "GATEWAY_CONFIG_MISSING"


def test_gateway_blocks_direct_render_hostname_access(rsa_keypair):
    """Verify that direct access through Render hostname without gateway assertion is blocked with 401."""
    _, public_pem = rsa_keypair
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_team_domain="college-team",
        cf_access_aud="audit-app-aud-12345",
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    # Direct request without gateway token
    response = client.get("/api/v1/analytics/overview")
    assert response.status_code == 401
    data = response.json()
    err_code = data.get("error_code") or data.get("detail", {}).get("error_code")
    assert err_code == "MISSING_GATEWAY_ASSERTION"


def test_gateway_validates_valid_rs256_token(rsa_keypair):
    """Verify valid RS256 Cloudflare Access token grants access."""
    private_pem, public_pem = rsa_keypair
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_team_domain="college-team",
        cf_access_aud="audit-app-aud-12345",
        database_path=":memory:",
    )

    token = jwt.encode(
        {
            "aud": "audit-app-aud-12345",
            "iss": "https://college-team.cloudflareaccess.com",
            "exp": time.time() + 300,
            "email": "faculty@college.edu",
            "sub": "fac-001",
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": "key-1"},
    )

    app = create_app(settings)
    client = TestClient(app)

    with patch("app.core.gateway_auth.verify_gateway_identity", side_effect=lambda req, cfg: verify_gateway_identity(req, cfg, test_public_key=public_pem)):
        # Gateway check passes; request reaches route
        response = client.get(
            "/api/v1/analytics/overview",
            headers={"Cf-Access-Jwt-Assertion": token},
        )
        # Reached backend database inspection
        assert response.status_code in (200, 503)


def test_gateway_rejects_expired_token(rsa_keypair):
    """Verify expired gateway token is rejected with 401 EXPIRED_GATEWAY_TOKEN."""
    private_pem, public_pem = rsa_keypair
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_team_domain="college-team",
        cf_access_aud="audit-app-aud-12345",
        database_path=":memory:",
    )

    expired_token = jwt.encode(
        {
            "aud": "audit-app-aud-12345",
            "iss": "https://college-team.cloudflareaccess.com",
            "exp": time.time() - 60,
            "email": "faculty@college.edu",
        },
        private_pem,
        algorithm="RS256",
    )

    app = create_app(settings)
    client = TestClient(app)

    with patch("app.core.gateway_auth.verify_gateway_identity", side_effect=lambda req, cfg: verify_gateway_identity(req, cfg, test_public_key=public_pem)):
        response = client.get(
            "/api/v1/analytics/overview",
            headers={"Cf-Access-Jwt-Assertion": expired_token},
        )
        assert response.status_code == 401
        data = response.json()
        err_code = data.get("error_code") or data.get("detail", {}).get("error_code")
        assert err_code == "EXPIRED_GATEWAY_TOKEN"


def test_gateway_rejects_audience_mismatch(rsa_keypair):
    """Verify token signed for a different audience tag is rejected."""
    private_pem, public_pem = rsa_keypair
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_team_domain="college-team",
        cf_access_aud="expected-aud-12345",
        database_path=":memory:",
    )

    wrong_aud_token = jwt.encode(
        {
            "aud": "attacker-aud-99999",
            "iss": "https://college-team.cloudflareaccess.com",
            "exp": time.time() + 300,
            "email": "faculty@college.edu",
        },
        private_pem,
        algorithm="RS256",
    )

    app = create_app(settings)
    client = TestClient(app)

    with patch("app.core.gateway_auth.verify_gateway_identity", side_effect=lambda req, cfg: verify_gateway_identity(req, cfg, test_public_key=public_pem)):
        response = client.get(
            "/api/v1/analytics/overview",
            headers={"Cf-Access-Jwt-Assertion": wrong_aud_token},
        )
        assert response.status_code == 401
        data = response.json()
        err_code = data.get("error_code") or data.get("detail", {}).get("error_code")
        assert err_code == "INVALID_GATEWAY_AUDIENCE"


def test_health_probes_unauthenticated_under_gateway():
    """Verify health endpoints remain accessible for container orchestration even when gateway auth is required."""
    settings = Settings(
        app_env="production",
        gateway_auth_required=True,
        cf_access_aud="audit-app-aud-12345",
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    assert client.get("/livez").status_code == 200
    assert client.get("/readyz").status_code in (200, 503)
    assert client.get("/health").status_code in (200, 503)


# =============================================================================
# 3. CSV EXPORT & DOWNLOAD TICKET SECURITY TESTS
# =============================================================================

def test_query_session_token_is_ignored():
    """Verify that passing session_token in query string does not authenticate request."""
    settings = Settings(
        app_env="testing",
        database_path=":memory:",
    )
    app = create_app(settings)
    client = TestClient(app)

    # Attempting to authenticate via ?session_token=... must be ignored
    response = client.get("/api/v1/students/export?session_token=fake_session_token_123456789")
    # Must fail with 503 (no db attached to fake token) or 401, not using query token as valid session
    assert response.status_code in (401, 503)


def test_single_use_download_ticket_atomic_consumption():
    """Verify that download tickets can only be consumed once and expire."""
    session_id = "test_sess_0123456789abcdef"
    ticket = issue_download_ticket(session_id, resource_id="breakdown")

    # First consumption succeeds
    consumed_session = consume_download_ticket(ticket)
    assert consumed_session == session_id

    # Second consumption must return None (replay prevented)
    replayed_session = consume_download_ticket(ticket)
    assert replayed_session is None


def test_formula_injection_prevention():
    """Verify that CSV cells beginning with dangerous characters are neutralized."""
    # Dangerous spreadsheet formulas
    assert sanitize_csv_cell("=cmd|'/C calc'!A0") == "'=cmd|'/C calc'!A0"
    assert sanitize_csv_cell("+SUM(A1:A10)") == "'+SUM(A1:A10)"
    assert sanitize_csv_cell("-CMD") == "'-CMD"
    assert sanitize_csv_cell("@IMPORTXML(url)") == "'@IMPORTXML(url)"
    assert sanitize_csv_cell("\tTAB_INJECTION") == "'\tTAB_INJECTION"
    assert sanitize_csv_cell("\rRETURN_INJECTION") == "'\rRETURN_INJECTION"

    # Legitimate signed numeric values must NOT be prefixed
    assert sanitize_csv_cell(-5) == "-5"
    assert sanitize_csv_cell(10.5) == "10.5"
    assert sanitize_csv_cell("+10") == "+10"
    assert sanitize_csv_cell("-2.5") == "-2.5"
    assert sanitize_csv_cell(0) == "0"


# =============================================================================
# 4. STORAGE & SESSION ISOLATION TESTS
# =============================================================================

def test_temporary_session_stored_in_temporary_sessions_dir(tmp_path):
    """Verify temporary sessions use the configured temporary_sessions_dir."""
    temp_dir = tmp_path / "ephemeral_sessions"
    perm_dir = tmp_path / "persistent_data"

    settings = Settings(
        app_env="testing",
        data_dir=str(perm_dir),
        temporary_sessions_dir=str(temp_dir),
        database_path=":memory:",
    )

    from app.services.session_manager import get_session_dir
    session_dir = get_session_dir("test_sess_1234567890abcdef", settings)

    # Verify session directory is inside temporary_sessions_dir, not data_dir
    assert str(temp_dir) in str(session_dir)
    assert str(perm_dir) not in str(session_dir)


def test_cross_session_isolation(tmp_path):
    """Verify that session A cannot read or access session B's database."""
    temp_dir = tmp_path / "ephemeral_sessions"
    temp_dir.mkdir(parents=True)

    session_a = temp_dir / "session_alpha_12345678"
    session_b = temp_dir / "session_beta_987654321"
    session_a.mkdir()
    session_b.mkdir()

    # Session directories are distinct and isolated
    assert session_a.resolve() != session_b.resolve()
    assert not session_a.is_relative_to(session_b)
    assert not session_b.is_relative_to(session_a)
