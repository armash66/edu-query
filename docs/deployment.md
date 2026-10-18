# EduQuery V3 — Production Deployment Guide

## Overview

EduQuery V3 is an academic marksheet analysis and verification platform designed for higher education faculty. This document outlines the architecture, containerization, environment configuration, storage topology, and operational requirements for hosting EduQuery V3 in production.

---

## 1. System Architecture

The application is packaged as a unified container combining:
- **Frontend SPA**: React 19 + TypeScript + Vite, compiled to static HTML/CSS/JS assets.
- **Backend API**: Python 3.11 + FastAPI + DuckDB engine.
- **Static Serving**: FastAPI ASGI server mounts compiled frontend assets at `/` and handles HTML5 pushState client routing via an SPA fallback mechanism, while preserving 404/5xx errors on all `/api/*` endpoints.

```
                           +--------------------------------------+
                           |       Reverse Proxy / TLS Ingress    |
                           |     (Nginx / Caddy / Cloudflare)     |
                           +--------------------------------------+
                                              |
                                     HTTP port 8000
                                              v
                           +--------------------------------------+
                           |          FastAPI ASGI Server         |
                           |       (uvicorn, non-root user)       |
                           +--------------------------------------+
                                  /                    \
                       /api/v1/* /                      \ Static SPA
                                v                        v
                     [API Routers & Services]         [frontend/dist/]
                                |
               +----------------+----------------+
               |                                 |
               v                                 v
       Temporary Analysis              Optional Institutional
            Sessions                          Storage
   data/sessions/{session_id}/          data/datasets/*.duckdb
   - session.duckdb                     - permanent_default.duckdb
   - meta.json                          - active_dataset.json
   - reviews.json                       - data/reviews/*.json
   [Erased on deletion/TTL]             [Retained across restarts]
```

---

## 2. Storage Topology & Privacy Modes

EduQuery V3 implements two clearly segregated storage modes:

### Mode A: Temporary Ephemeral Analysis (Default)
- **Directory**: `/app/data/sessions/{session_id}/`
- **Session Identification**: Cryptographically secure 32-byte URL-safe base64 token (`secrets.token_urlsafe(32)`).
- **Session Files**:
  - `session.duckdb`: Isolated DuckDB database holding ingested student and marks records.
  - `meta.json`: Session metadata, creation timestamp, last accessed timestamp, TTL expiration.
  - `reviews.json`: Session-scoped faculty anomaly moderation tags.
  - Uploaded `.xlsx` files are deleted immediately after parsing.
- **Lifecycle & Cleanup**:
  - **Explicit deletion**: Calling `DELETE /api/v1/session` completely deletes the session folder via `shutil.rmtree` and clears client cookies.
  - **Inactivity TTL**: Auto-deleted after `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` (default: 3600 seconds / 1 hour).
  - **Startup cleanup**: On server startup, all expired sessions in `/app/data/sessions` are scanned and pruned.
- **Persistence Guarantees**: Does NOT modify the persistent dataset pointer (`active_dataset.json`) or create persistent DuckDB files in `data/datasets/`.

### Mode B: Institutional Persistent Storage (Explicit Opt-In Only)
- **Directory**: `/app/data/datasets/` and `/app/data/reviews/`
- **Activation Pointer**: `/app/data/active_dataset.json`
- **Requirement**: Requires a persistent volume mount (`-v /mnt/eduquery_data:/app/data`).
- **Serverless Hosting Note**: Stateless serverless platforms (e.g. standard Google Cloud Run, AWS Lambda) do not support persistent mode unless backed by network mounts (such as AWS EFS or Cloud Storage Fuse).

---

## 3. Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `EDUQUERY_ENV` | string | `production` | Environment mode (`development`, `production`, `testing`). Enables HTTPS cookies and security boundaries. |
| `HOST` | string | `0.0.0.0` | Bind host for ASGI server. |
| `PORT` | integer | `8000` | Bind port for ASGI server. |
| `EDUQUERY_DATA_DIR` | path | `data` (`/app/data`) | Root data storage directory. Must be writable by UID 10001. |
| `EDUQUERY_DATABASE_PATH` | path | `data/eduquery.duckdb` | Fallback persistent database path. |
| `EDUQUERY_ACTIVE_POINTER_PATH` | path | `data/active_dataset.json` | JSON file pointing to current active institutional dataset. |
| `EDUQUERY_IMPORT_API_KEY` | string | *None* | Optional secret for institutional rollback API. **Never** requested from faculty. |
| `EDUQUERY_IMPORT_SESSION_TTL_SECONDS`| integer | `3600` | Idle timeout for temporary analysis sessions (in seconds). |
| `EDUQUERY_MAX_UPLOAD_SIZE_BYTES` | integer | `26214400` (25 MiB) | Maximum marksheet upload stream limit. |
| `EDUQUERY_CORS_ORIGINS` | string | `""` | Comma-separated list of allowed origins. |
| `EDUQUERY_LOG_LEVEL` | string | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |

---

## 4. Multi-Stage Docker Container Build

The application uses a multi-stage `Dockerfile`:
1. **Stage 1 (`frontend-builder`)**: Compiles TypeScript and runs Vite production build.
2. **Stage 2 (`runtime`)**: Minimal `python:3.11-slim` runtime, non-root user (`eduquery:10001`), with pre-created data directories.

### Build Command
```bash
docker build -t eduquery-v3:latest .
```

### Run Command (Temporary Mode / Stateless)
```bash
docker run -d \
  --name eduquery-v3 \
  -p 8000:8000 \
  -e EDUQUERY_ENV=production \
  -e EDUQUERY_IMPORT_SESSION_TTL_SECONDS=3600 \
  eduquery-v3:latest
```

### Run Command (Persistent Institutional Storage)
```bash
docker run -d \
  --name eduquery-v3 \
  -p 8000:8000 \
  -v /var/data/eduquery:/app/data \
  -e EDUQUERY_ENV=production \
  -e EDUQUERY_DATA_DIR=/app/data \
  eduquery-v3:latest
```

---

## 5. Security & Network Hardening

1. **Faculty Session Authentication**:
   - Every session receives an opaque session token via `Set-Cookie: eduquery_session=...; HttpOnly; SameSite=Lax; Path=/`.
   - If HTTPS is active (`request.url.scheme == 'https'` or `X-Forwarded-Proto: https`), `Secure=True` is enforced.
   - Dual authentication support: clients can also provide `X-EduQuery-Session-Token` header.
2. **Path Traversal & Archive Bomb Defense**:
   - Upload streams are rejected if exceeding 25 MiB.
   - OpenXML zip containers are inspected prior to extraction: maximum 1000 entries, maximum 100 MiB uncompressed, maximum 100:1 compression ratio, and zero relative `..` path entries.
3. **Student Privacy & Logging Hygiene**:
   - Student PII, individual marks, raw names, and uploaded contents are **never** logged.
   - Server logs contain only high-level structural counts (e.g. `145 students ingested`) and anonymous session IDs.

---

## 6. Health & Readiness Probes

The server exposes three operational probe endpoints:

- **`/livez`**: Returns `200 OK` `{"status": "alive"}` immediately. Used for container orchestrator liveness checks.
- **`/readyz`**: Returns `200 OK` `{"status": "ready"}` when database engines, dependencies, and storage directories are initialized.
- **`/health`**: Returns detailed database connection health and enrolled student/course counts.
