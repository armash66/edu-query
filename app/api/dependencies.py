"""Request-scoped dependency providers and database lifecycle management."""
from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from typing import Any

from fastapi import Request
import duckdb

from app.config import Settings, get_settings


class DatabaseUnavailableError(Exception):
    """Raised when the configured database file is missing or inaccessible."""

    def __init__(self, message: str = "Database unavailable or not initialized.") -> None:
        super().__init__(message)
        self.message = message


def get_db(
    request: Request,
) -> Generator[duckdb.DuckDBPyConnection, None, None]:
    """Yield a request-scoped DuckDB connection.

    - For file databases: checks file existence and opens in read_only mode.
    - Closes connection immediately in finally block to avoid resource leaks.
    - Can be easily overridden in tests via app.dependency_overrides[get_db].
    """
    app_settings = None
    active_path = None
    if request is not None and hasattr(request, "app"):
        if hasattr(request.app.state, "settings"):
            app_settings = request.app.state.settings
        if hasattr(request.app.state, "active_database_path"):
            active_path = request.app.state.active_database_path

    cfg = app_settings or get_settings()

    # 1. Check for active temporary session token in headers, cookies, or short-lived single-use ticket
    # NOTE: Long-lived session tokens in URL query strings are strictly forbidden to prevent log/history leakage.
    session_token = None
    if request is not None and hasattr(request, "scope") and isinstance(request.scope, dict):
        if "headers" in request.scope:
            try:
                session_token = request.headers.get("X-EduQuery-Session-Token")
                if not session_token:
                    session_token = request.cookies.get("eduquery_session")
                # Allow single-use short-lived download ticket for direct browser downloads
                if not session_token and hasattr(request, "query_params"):
                    ticket = request.query_params.get("ticket")
                    if ticket:
                        from app.services.session_manager import consume_download_ticket
                        session_token = consume_download_ticket(ticket)
            except Exception:
                session_token = None

    target_path = None
    if session_token and session_token.strip():
        token = session_token.strip()
        # Prevent path traversal
        import re
        if re.match(r"^[a-zA-Z0-9_\-]{16,64}$", token):
            sessions_root = Path(
                getattr(cfg, "temporary_sessions_dir", None) or (Path(cfg.data_dir).resolve() / "sessions")
            ).resolve()
            session_dir = sessions_root / token
            session_db = session_dir / "session.duckdb"
            meta_file = session_dir / "meta.json"
            if session_dir.is_dir() and session_db.is_file():
                # Check expiration
                if meta_file.is_file():
                    import json
                    from datetime import datetime, timezone
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                        exp = meta.get("expires_at")
                        if exp and datetime.now(timezone.utc) > datetime.fromisoformat(exp):
                            raise DatabaseUnavailableError(
                                "Your analysis session has expired due to inactivity. Please upload your marksheet again."
                            )
                        # Touch last accessed
                        meta["last_accessed_at"] = datetime.now(timezone.utc).isoformat()
                        meta_file.write_text(json.dumps(meta, indent=2), encoding="utf-8")
                    except DatabaseUnavailableError:
                        raise
                    except Exception:
                        pass
                target_path = session_db
            else:
                raise DatabaseUnavailableError(
                    "Analysis session not found or has been deleted. Please upload an Excel workbook to begin."
                )

    if target_path is None:
        target_path = active_path or cfg.database_path

    if str(target_path).strip().lower() == ":memory:":
        con = duckdb.connect(":memory:")
        tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
        if "students" not in tables or "courses" not in tables:
            con.close()
            raise DatabaseUnavailableError(
                "Configured in-memory database is uninitialized (required tables missing)."
            )
        try:
            yield con
        finally:
            con.close()
        return

    db_path = Path(target_path)
    if not db_path.is_file():
        raise DatabaseUnavailableError(
            f"Configured database file '{target_path}' is missing or not initialized."
        )

    try:
        con = duckdb.connect(str(db_path), read_only=True)
    except Exception as exc:
        raise DatabaseUnavailableError(
            f"Failed to connect to database '{target_path}': {exc}"
        ) from exc

    try:
        tables = {row[0] for row in con.execute("SHOW TABLES").fetchall()}
        if "students" not in tables or "courses" not in tables:
            con.close()
            raise DatabaseUnavailableError(
                f"Configured database file '{target_path}' is uninitialized (required tables missing)."
            )
    except DatabaseUnavailableError:
        raise
    except Exception as exc:
        con.close()
        raise DatabaseUnavailableError(
            f"Failed to inspect database '{target_path}': {exc}"
        ) from exc

    try:
        yield con
    finally:
        con.close()


def require_gateway_auth(request: Request) -> Any:
    """Dependency that enforces faculty identity gateway verification when configured.

    Fails closed if gateway authentication is enforced and valid credentials are missing.
    """
    from app.core.gateway_auth import verify_gateway_identity
    return verify_gateway_identity(request)
