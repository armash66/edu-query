# Multi-stage Dockerfile for EduQuery Production Deployment
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Runtime
FROM python:3.11-slim AS runtime

# System dependencies for production execution and health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root system user and persistent storage directories
RUN groupadd -g 10001 eduquery && \
    useradd -u 10001 -g eduquery -s /bin/sh -d /app eduquery && \
    mkdir -p /app/data/datasets /app/data/reviews /tmp/eduquery-sessions && \
    chmod 777 /tmp/eduquery-sessions

# Copy backend application source
COPY app/ ./app

# Copy built static frontend assets
COPY --from=frontend-builder /build/dist ./frontend/dist

# Set ownership of application and persistent data directories
RUN chown -R eduquery:eduquery /app /tmp/eduquery-sessions

# Switch to non-root execution
USER eduquery

# Environment configuration
ENV EDUQUERY_ENV=production \
    EDUQUERY_DATABASE_PATH=/app/data/eduquery.duckdb \
    EDUQUERY_DATA_DIR=/app/data \
    EDUQUERY_TEMPORARY_SESSIONS_DIR=/tmp/eduquery-sessions \
    EDUQUERY_ACTIVE_POINTER_PATH=/app/data/active_dataset.json \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Health probe check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/livez || exit 1

# Production server entrypoint
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2"]
