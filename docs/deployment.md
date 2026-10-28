# EduQuery - Production Deployment Guide

## 1. Overview

EduQuery is an academic marksheet analysis platform for higher education faculty. This document outlines the containerization, environment configuration, storage topology, and operational requirements for hosting EduQuery in production.

---

## 2. Deployment Architectures

### Architecture Option A: Unified Container on Render (Recommended)
In this topology, a single Docker container runs FastAPI (Uvicorn) with non-root user execution, serving both the REST API and the compiled React single-page application (SPA).

- Host: Render Web Service (Docker runtime).
- Persistent Disk: Mounted at `/app/data` (10 GB) for institutional datasets, pointers, and faculty reviews.
- Ephemeral Disk: Mounted at `/tmp/eduquery-sessions` for privacy-first temporary analysis sessions.
- Ingress: HTTPS termination handled by Cloudflare / Render edge with HTTP health checks at `/livez`.

```text
                           +--------------------------------------+
                           |   Cloudflare Access / Edge Ingress   |
                           |   (TLS Termination, Identity Auth)   |
                           +--------------------------------------+
                                              |
                                      HTTP port 8000
                                              v
                           +--------------------------------------+
                           |          FastAPI ASGI Server         |
                           |       (uvicorn, non-root user)       |
                           +--------------------------------------+
                                  /                    \
                       /api/v1/* /                      \ Static Assets
                                v                        v
                     [API Routers & Services]         [frontend/dist/]
                                |
               +----------------+----------------+
               |                                 |
               v                                 v
       Temporary Analysis              Optional Institutional
            Sessions                          Storage
     /tmp/eduquery-sessions/             /app/data/datasets/
     - session.duckdb                    - dataset_<id>.duckdb
     - meta.json                         - active_dataset.json
     - reviews.json                      - data/reviews/*.json
   [Erased on delete/TTL]                [Persisted across restarts]
```

### Architecture Option B: Decoupled Vercel Frontend + Render Backend (Current Live Setup)
In this topology:
- Frontend: Hosted as a static single-page application on Vercel (`https://edu-query-hazel.vercel.app/`). SPA routing is managed via `vercel.json` rewrites (`/(.*)` -> `/index.html`).
- Backend: Hosted as a Docker container on Render in the `singapore` region (`https://edu-query.onrender.com/`).
- Cold-Start Mitigation: Render's free tier spins down idle containers after 15 minutes. The frontend implements `BootScreen.tsx`, which activates on cold starts, displays a ~50s container wake-up progress bar, and automatically polls `/health` every 4 seconds until the backend is warm.
- Communication: HTTPS API requests with strict CORS allowlisting on the backend (`EDUQUERY_CORS_ORIGIN_REGEX="https://.*\\.vercel\\.app"`).
- Additive Streaming Exports: Server-side streaming `.xlsx` exports powered by `openpyxl` are served at `/api/v1/students/export/xlsx`, `/api/v1/subjects/{course_code}/export/xlsx`, and `/api/v1/subjects/absent/export/xlsx`.

---

## 3. Storage Topology and Privacy Segregation

EduQuery implements two segregated storage modes:

### Mode A: Ephemeral Analysis Sessions (Default, Privacy-First)
- Path: `EDUQUERY_TEMPORARY_SESSIONS_DIR` (`/tmp/eduquery-sessions`).
- Session Token: Cryptographically secure 32-byte URL-safe base64 token.
- Contents: `session.duckdb`, `meta.json`, `reviews.json`. Uploaded Excel files are deleted immediately following parsing.
- Cleanup Lifecycle:
  - Explicit Deletion: Faculty clicking "Delete Session & Clear Data" triggers `DELETE /api/v1/session`, which erases the session directory on disk and clears client cookies.
  - Inactivity TTL: Sessions idle beyond `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` (default: 3600 seconds / 1 hour) are pruned.
  - Startup Pruning: Expired sessions are automatically cleared on container startup.
- Guarantee: Does not write to `/app/data/datasets/` or modify `active_dataset.json`.

### Mode B: Institutional Persistent Storage (Opt-In Only)
- Path: `/app/data/datasets/` and `/app/data/reviews/`.
- Active Dataset Pointer: `/app/data/active_dataset.json`.
- Requirement: Persistent volume mount (`/app/data`).

---

## 4. Multi-Stage Docker Build

The root `Dockerfile` packages the entire application into a minimal, non-root production container:

```dockerfile
# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Minimal Python Runtime
FROM python:3.11-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN groupadd -g 10001 eduquery && \
    useradd -u 10001 -g eduquery -s /bin/sh -d /app eduquery && \
    mkdir -p /app/data/datasets /app/data/reviews /tmp/eduquery-sessions && \
    chmod 777 /tmp/eduquery-sessions
COPY app/ ./app
COPY --from=frontend-builder /build/dist ./frontend/dist
RUN chown -R eduquery:eduquery /app /tmp/eduquery-sessions
USER eduquery

ENV EDUQUERY_ENV=production \
    EDUQUERY_DATABASE_PATH=/app/data/eduquery.duckdb \
    EDUQUERY_DATA_DIR=/app/data \
    EDUQUERY_TEMPORARY_SESSIONS_DIR=/tmp/eduquery-sessions \
    EDUQUERY_ACTIVE_POINTER_PATH=/app/data/active_dataset.json \
    PYTHONUNBUFFERED=1

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/livez || exit 1
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
```

### Local Container Build Command
```bash
docker build -t EduQuery:latest .
```

### Local Container Run Command
```bash
docker run -d \
  --name eduquery-test \
  -p 8000:8000 \
  -e EDUQUERY_ENV=production \
  -e EDUQUERY_CORS_ORIGINS="http://localhost:8000" \
  -v eduquery_data:/app/data \
  EduQuery:latest
```

---

## 5. Render Blueprint Specification (`render.yaml`)

```yaml
services:
  - type: web
    name: EduQuery
    env: docker
    dockerfilePath: Dockerfile
    plan: starter
    region: singapore
    numInstances: 1
    healthCheckPath: /livez
    disk:
      name: eduquery-data
      mountPath: /app/data
      sizeGB: 10
    envVars:
      - key: EDUQUERY_ENV
        value: production
      - key: EDUQUERY_DATA_DIR
        value: /app/data
      - key: EDUQUERY_DATABASE_PATH
        value: /app/data/eduquery.duckdb
      - key: EDUQUERY_ACTIVE_POINTER_PATH
        value: /app/data/active_dataset.json
      - key: EDUQUERY_IMPORT_SESSION_TTL_SECONDS
        value: "3600"
      - key: EDUQUERY_MAX_UPLOAD_SIZE_BYTES
        value: "26214400"
      - key: EDUQUERY_LOG_LEVEL
        value: INFO
      - key: EDUQUERY_TEMPORARY_SESSIONS_DIR
        value: /tmp/eduquery-sessions
      - key: EDUQUERY_CORS_ORIGINS
        sync: false
      - key: EDUQUERY_IMPORT_API_KEY
        generateValue: true
      - key: EDUQUERY_GATEWAY_AUTH_REQUIRED
        sync: false
      - key: CF_ACCESS_TEAM_DOMAIN
        sync: false
      - key: CF_ACCESS_AUD
        sync: false
```

---

## 6. Vercel Frontend Configuration (`vercel.json`)

When deploying the frontend independently on Vercel:

Root `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Environment Variable on Vercel:
- `VITE_API_BASE_URL`: URL of the deployed backend (e.g. `https://eduquery-api.onrender.com`).

---

## 7. Environment Variables Reference

| Variable | Environment | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `EDUQUERY_ENV` | All | `production` | Set to `production` in live deployments. |
| `PORT` | Production | `8000` | Port assigned by hosting provider. |
| `HOST` | Production | `0.0.0.0` | Bind address. |
| `EDUQUERY_DATA_DIR` | Production | `/app/data` | Root directory for persistent datasets and reviews. |
| `EDUQUERY_TEMPORARY_SESSIONS_DIR` | Production | `/tmp/eduquery-sessions` | Isolated directory for ephemeral analysis sessions. |
| `EDUQUERY_DATABASE_PATH` | Production | `/app/data/eduquery.duckdb` | Fallback persistent DuckDB file path. |
| `EDUQUERY_ACTIVE_POINTER_PATH` | Production | `/app/data/active_dataset.json` | Path to atomic active dataset pointer file. |
| `EDUQUERY_CORS_ORIGINS` | Production | `""` | Comma-separated list of approved origins. |
| `EDUQUERY_MAX_UPLOAD_SIZE_BYTES` | All | `26214400` (25 MiB) | Maximum upload stream size limit. |
| `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` | All | `3600` (1 hour) | Expiration time for temporary analysis sessions. |
| `EDUQUERY_LOG_LEVEL` | All | `INFO` | Logging level. Never logs student PII. |
| `EDUQUERY_GATEWAY_AUTH_REQUIRED` | Production | `false` | When `true`, enforces Cloudflare Access JWT validation. |
| `CF_ACCESS_TEAM_DOMAIN` | Production | `""` | Cloudflare Access team domain (e.g. `college.cloudflareaccess.com`). |
| `CF_ACCESS_AUD` | Production | `""` | Application Audience tag for JWT signature verification. |
| `EDUQUERY_GATEWAY_SHARED_SECRET` | Production | `""` | Optional shared secret header for reverse proxies. |

---

## 8. Deployment Health Verification

After deployment, verify the service endpoints:

```bash
# Liveness check (verifies process is responsive)
curl -f https://EduQuery.onrender.com/livez

# Readiness check (verifies database queryability)
curl -f https://EduQuery.onrender.com/readyz

# Health status
curl -s https://EduQuery.onrender.com/health
```

Expected output of `/livez`:
```json
{"status": "alive"}
```
