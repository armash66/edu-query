# EduQuery V3 - Development Guide

## 1. Prerequisites

- Python 3.11, 3.12, 3.13, or 3.14 (Verified on Python 3.14.2)
- Node.js >= 18 (Verified on Node.js v24.14.0) and npm
- Git
- Operating Systems: Windows 10/11, macOS, or Linux

---

## 2. Local Setup Workflow

### Step 1: Clone Repository
```bash
git clone https://github.com/armash66/edu-query-v3.git
cd edu-query-v3
```

### Step 2: Set Up Backend Environment

Create and activate a virtual environment:

```bash
# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

# Linux / macOS (bash/zsh)
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies:
```bash
pip install -r requirements.txt
```

Verify backend installation:
```bash
python -c "import duckdb, fastapi, pydantic, sklearn; print('Backend dependencies installed successfully.')"
```

### Step 3: Configure Environment Variables

Copy the example configuration:
```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Key development environment variables:
- `EDUQUERY_ENV=development`
- `EDUQUERY_DATABASE_PATH=data/eduquery.duckdb`
- `EDUQUERY_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000`
- `EDUQUERY_LOG_LEVEL=INFO`

### Step 4: Set Up Frontend Environment

Navigate to the `frontend/` directory and install packages:
```bash
cd frontend
npm install
cd ..
```

---

## 3. Running Development Servers

### Backend Development Server
Run FastAPI with auto-reload from the repository root:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The API is accessible at `http://127.0.0.1:8000`.
Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Development Server
In a separate terminal, launch the Vite development server:
```bash
cd frontend
npm run dev
```
The frontend dashboard is accessible at `http://localhost:5173`.
Vite is configured to automatically proxy `/api` and `/health` requests to `http://127.0.0.1:8000`.

---

## 4. Testing Commands and Verification

### Backend Tests (Pytest)
Run the complete backend test suite:
```bash
pytest
```
Run with verbose output:
```bash
pytest -v
```
Run a specific test module:
```bash
pytest tests/api/test_security_gate_audit.py -v
pytest tests/test_phase12_session_privacy.py -v
```

Current backend baseline: **279/279 tests passing** in ~58 seconds.

### Frontend Tests (Vitest)
Run component and integration tests:
```bash
cd frontend
npm run test
```

Current frontend baseline: **61/61 tests passing** across 12 suites.

### Strict TypeScript Compilation
Run type checking without emitting files:
```bash
cd frontend
node ./node_modules/typescript/bin/tsc -b
```

### Production Build Verification
Build the production frontend bundle:
```bash
cd frontend
npm run build
```
Production assets are generated in `frontend/dist/`.

---

## 5. Anomaly Detection Evaluation Script

To run the standalone reproducible evaluation of the three-tier anomaly detection engine:
```bash
python scripts/evaluate_anomaly_detection.py
```
This script evaluates deterministic rules, robust MAD Z-scores, and multivariate Isolation Forest against a synthetic cohort of 150 students with known ground-truth injected anomalies.

---

## 6. Troubleshooting Common Issues

### Windows Path and PowerShell Execution Policy
If PowerShell blocks virtual environment activation:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Port 8000 or 5173 Already in Use
Check which process is listening on the port:
```powershell
# Windows
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State

# Linux / macOS
lsof -i :8000
```
Stop the process or change the port using `--port 8001` and update `VITE_API_BASE_URL` in `frontend/.env`.

### Database Locked (`WinError 32: process cannot access the file`)
On Windows, DuckDB database files cannot be replaced while an active process holds an open file handle. EduQuery V3 uses versioned dataset filenames (`dataset_<timestamp>_<uuid>.duckdb`) and ephemeral session directories to avoid lock contention. Ensure all background Python processes from prior runs are terminated if you need to manually delete local database files in `data/`.

### CORS Headers Missing
Ensure `EDUQUERY_CORS_ORIGINS` in your `.env` contains your exact browser URL including scheme and port (e.g. `http://localhost:5173`).
