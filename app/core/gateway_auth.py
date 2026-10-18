"""Faculty Identity Gateway and Zero-Trust Access verification for EduQuery V3.

Validates identity assertions from Cloudflare Access or configured reverse proxies:
- Validates JWT signature, issuer, audience (AUD), and expiration.
- Prevents direct access through the Render hostname bypassing the security gateway.
- Fails closed when gateway authentication is required but configuration is absent.
"""
from __future__ import annotations

import json
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import HTTPException, Request, status

from app.config import Settings, get_settings

logger = logging.getLogger("eduquery.auth")

# In-memory cache for gateway public keys (JWKS): team_domain -> (keys_dict, expiry_time)
_JWKS_CACHE: dict[str, tuple[dict[str, Any], float]] = {}
JWKS_CACHE_TTL_SECONDS = 3600


@dataclass
class GatewayIdentity:
    """Authenticated faculty identity from the upstream identity gateway."""
    user_email: str
    user_id: str
    issuer: str
    audience: str
    raw_claims: dict[str, Any]


def get_jwks_for_team(team_domain: str, certs_url: str | None = None) -> dict[str, Any]:
    """Retrieve and cache JWKS public keys from Cloudflare Access."""
    now = time.time()
    cache_entry = _JWKS_CACHE.get(team_domain)
    if cache_entry and cache_entry[1] > now:
        return cache_entry[0]

    url = certs_url
    if not url:
        domain = team_domain.strip().rstrip("/")
        if not domain.startswith("http://") and not domain.startswith("https://"):
            domain = f"https://{domain}.cloudflareaccess.com"
        url = f"{domain}/cdn-cgi/access/certs"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                raise ValueError(f"JWKS endpoint returned HTTP {resp.status_code}")
            jwks = resp.json()
            _JWKS_CACHE[team_domain] = (jwks, now + JWKS_CACHE_TTL_SECONDS)
            return jwks
    except Exception as exc:
        logger.error("Failed to fetch gateway JWKS from %s: %s", url, exc)
        if cache_entry:
            # Fall back to expired cache on network failure
            return cache_entry[0]
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "status": "error",
                "error_code": "GATEWAY_KEY_FETCH_FAILED",
                "message": f"Unable to retrieve identity gateway keys for verification: {exc}",
            },
        ) from exc


def verify_gateway_identity(
    request: Request,
    settings: Settings | None = None,
    test_public_key: str | None = None,
) -> GatewayIdentity | None:
    """Verify that the incoming request passed through the authorized faculty identity gateway.

    Enforces:
    1. If gateway_auth_required is True, rejects requests without valid gateway credentials.
    2. Validates Cloudflare Access JWT (aud, iss, signature, exp) or gateway shared secret.
    3. Blocks direct origin host access on Render.
    4. Fails closed if configuration is missing when required.
    """
    if settings is not None:
        cfg = settings
    else:
        app = getattr(request, "app", None)
        app_state = getattr(app, "state", None) if app else None
        cfg = getattr(app_state, "settings", None) or get_settings()

    # 1. Check if gateway authentication is required
    is_required = cfg.gateway_auth_required

    # Extract assertion token from headers
    token = request.headers.get("Cf-Access-Jwt-Assertion")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    # Check shared gateway secret header (e.g. for custom proxies / Cloudflare Transform Rules)
    gateway_secret_header = (
        request.headers.get("X-EduQuery-Gateway-Secret")
        or request.headers.get("X-Gateway-Secret")
        or request.headers.get("CF-Access-Client-Secret")
    )

    # If gateway auth is required, ensure either JWT gateway or shared secret is configured
    if is_required:
        if not (cfg.cf_access_aud or cfg.gateway_shared_secret or test_public_key):
            logger.critical("Gateway authentication required but no gateway parameters (aud/secret) configured.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "error",
                    "error_code": "GATEWAY_CONFIG_MISSING",
                    "message": "Gateway authentication is required, but identity gateway settings are not configured.",
                },
            )

    # If neither token nor secret is provided
    if not token and not gateway_secret_header:
        if is_required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "status": "error",
                    "error_code": "MISSING_GATEWAY_ASSERTION",
                    "message": "Direct access to backend origin is blocked. Request must be routed through the authorized identity gateway.",
                },
            )
        return None

    # Verify shared secret if configured
    if cfg.gateway_shared_secret and gateway_secret_header:
        if not secrets.compare_digest(gateway_secret_header, cfg.gateway_shared_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "status": "error",
                    "error_code": "INVALID_GATEWAY_SECRET",
                    "message": "Gateway authorization secret mismatch. Direct origin access blocked.",
                },
            )
        return GatewayIdentity(
            user_email="gateway-authorized@college.edu",
            user_id="gateway-proxy",
            issuer="gateway-secret",
            audience="eduquery-backend",
            raw_claims={"method": "shared_secret"},
        )

    # Verify JWT assertion
    if token:
        expected_aud = cfg.cf_access_aud
        expected_team = cfg.cf_access_team_domain
        certs_url = cfg.cf_access_certs_url

        if is_required and not expected_aud and not test_public_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "status": "error",
                    "error_code": "GATEWAY_AUD_NOT_CONFIGURED",
                    "message": "Expected audience tag (CF_ACCESS_AUD) is not configured on server.",
                },
            )

        try:
            # Decode unverified header to get key id (kid) and algorithm
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg", "RS256")
            kid = unverified_header.get("kid")

            # Determine key for verification
            key: Any = None
            if test_public_key:
                key = test_public_key
            elif expected_team or certs_url:
                jwks = get_jwks_for_team(expected_team or "default", certs_url)
                keys_list = jwks.get("keys", [])
                matching_key = next((k for k in keys_list if k.get("kid") == kid), None)
                if not matching_key and keys_list:
                    # If kid doesn't match, reload once in case keys were rotated
                    jwks = get_jwks_for_team(expected_team or "default", certs_url)
                    keys_list = jwks.get("keys", [])
                    matching_key = next((k for k in keys_list if k.get("kid") == kid), None)

                if matching_key:
                    key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(matching_key))
                elif not is_required:
                    return None
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail={
                            "status": "error",
                            "error_code": "UNKNOWN_GATEWAY_KEY",
                            "message": f"Gateway token signing key ID '{kid}' not found in JWKS.",
                        },
                    )

            if not key:
                if is_required:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail={
                            "status": "error",
                            "error_code": "NO_VERIFICATION_KEY",
                            "message": "Unable to verify gateway token: no public verification key available.",
                        },
                    )
                return None

            # Verify claims: signature, exp, aud
            decode_kwargs: dict[str, Any] = {
                "algorithms": [alg],
                "options": {
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": bool(expected_aud),
                },
            }
            if expected_aud:
                decode_kwargs["audience"] = expected_aud

            payload = jwt.decode(token, key, **decode_kwargs)

            # Validate issuer if configured
            if expected_team:
                clean_team = expected_team.strip().rstrip("/")
                if not clean_team.startswith("http://") and not clean_team.startswith("https://"):
                    expected_iss = f"https://{clean_team}.cloudflareaccess.com"
                else:
                    expected_iss = clean_team
                actual_iss = payload.get("iss", "")
                if actual_iss != expected_iss:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail={
                            "status": "error",
                            "error_code": "INVALID_GATEWAY_ISSUER",
                            "message": f"Gateway token issuer '{actual_iss}' does not match expected '{expected_iss}'.",
                        },
                    )

            email = payload.get("email") or payload.get("sub") or "faculty@college.edu"
            sub = payload.get("sub") or email
            return GatewayIdentity(
                user_email=email,
                user_id=sub,
                issuer=payload.get("iss", ""),
                audience=payload.get("aud", [""])[0] if isinstance(payload.get("aud"), list) else payload.get("aud", ""),
                raw_claims=payload,
            )

        except jwt.ExpiredSignatureError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "status": "error",
                    "error_code": "EXPIRED_GATEWAY_TOKEN",
                    "message": "Identity gateway token has expired. Please re-authenticate through the faculty portal.",
                },
            ) from exc
        except jwt.InvalidAudienceError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "status": "error",
                    "error_code": "INVALID_GATEWAY_AUDIENCE",
                    "message": "Gateway token audience does not match this application.",
                },
            ) from exc
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "status": "error",
                    "error_code": "INVALID_GATEWAY_TOKEN",
                    "message": f"Identity gateway assertion verification failed: {exc}",
                },
            ) from exc

    return None
