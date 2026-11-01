# 00_manifest.md — EduQuery System & Audit Manifest

> **Audit Date:** 2026-11-01T10:39:12+05:30  
> **Target Commit Hash:** `32caa740cd71b66210bc12a14bab1ab4344d835e`  
> **Repository:** `https://github.com/armash66/eduquery-v3.git` (formerly `https://github.com/armash66/edu-query.git`)  
> **Branch:** `main` (clean working tree at target commit)

---

## 1. System & Execution Environment

All experiments, benchmarks, tests, and measurements recorded in this audit were executed directly on the reference host described below:

| Property | Value | Evidence Source |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Home / Pro (Build 10.0.26300-SP0) | `platform.platform()` in `paper_audit/experiments/dump_env.py` |
| **Architecture** | AMD64 / x86_64 | `platform.machine()` in `paper_audit/experiments/dump_env.py` |
| **Processor** | Intel64 Family 6 Model 186 Stepping 3, GenuineIntel | `platform.processor()` in `paper_audit/experiments/dump_env.py` |
| **CPU Physical Cores** | 10 | `psutil.cpu_count(logical=False)` |
| **CPU Logical Threads** | 12 | `psutil.cpu_count(logical=True)` |
| **Installed RAM** | 15.65 GB (16,802,295,808 bytes) | `psutil.virtual_memory().total` |
| **Python Runtime** | Python 3.14.2 (tags/v3.14.2:df79316, Dec 5 2025, 17:18:21) [MSC v.1944 64 bit] | `sys.version` in `paper_audit/experiments/dump_env.py` |
| **Node.js Runtime** | v24.14.0 | `node -v` |
| **npm Package Manager** | 11.9.0 | `npm -v` |
| **Repository License** | UNLICENSED / Proprietary (No `LICENSE` file present in root) | Directory inspection of root workspace |

---

## 2. Codebase Size & Language Inventory

Measurements generated using `paper_audit/experiments/count_loc.py` across all tracked project files, excluding third-party packages (`node_modules/`), VCS internals (`.git/`), compilation artifacts (`dist/`, `build/`, `__pycache__/`, `.pytest_cache/`), and audit deliverables (`paper_audit/`).

- **Total Non-VCS Repository Size:** 47.31 MB
- **Total Audited Files:** 761 files

### Lines of Code (LOC) by Language

| Language | Files | Blank Lines | Comment Lines | Code Lines | Total Lines |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Python (`.py`)** | 135 | 7,367 | 1,486 | 30,555 | 39,408 |
| **TypeScript / React (`.tsx`)** | 74 | 7,565 | 205 | 22,268 | 30,038 |
| **TypeScript (`.ts`)** | 10 | 4,655 | 93 | 2,794 | 7,542 |
| **HTML (`.html`)** | 7 | 1,937 | 1,170 | 14,391 | 17,498 |
| **Markdown (`.md`)** | 96 | 3,511 | 2,254 | 12,155 | 17,920 |
| **JSON (`.json`)** | 41 | 8 | 4 | 130,057 | 130,069 |
| **CSS (`.css`)** | 1 | 121 | 47 | 813 | 981 |
| **JavaScript / Modules (`.mjs`, `.js`, `.cjs`)** | 13 | 131 | 80 | 726 | 937 |
| **YAML (`.yml`, `.yaml`)** | 1 | 0 | 0 | 38 | 38 |
| **Binary & Assets (`.png`, `.csv`, `.xlsx`, `.duckdb`)** | 383 | 0 | 0 | 0 | 0 |
| **Total Code / Script Lines** | **233** | **21,787** | **3,085** | **67,232** | **92,104** |

*Raw machine-readable artifact:* `paper_audit/experiments/loc_stats.json`

---

## 3. Pinned Dependency Ecosystem

The complete environment snapshot contains 297 Python packages and 14 direct frontend dependencies. The core packages powering the system are pinned below:

### Backend Key Dependencies (`paper_audit/experiments/pip_freeze.txt`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **duckdb** | `1.4.1` | In-process analytical columnar OLAP database engine |
| **fastapi** | `0.115.11` | High-performance async ASGI web framework |
| **uvicorn** | `0.34.0` | ASGI web server implementation |
| **pydantic** | `2.10.6` | Data validation and type enforcement schemas |
| **openpyxl** | `3.1.5` | Office Open XML Excel workbook parsing and generation |
| **scikit-learn** | `1.7.0` | Isolation Forest unsupervised outlier detection |
| **reportlab** | `4.4.1` | Programmatic PDF document layout and typographic generation |
| **numpy** | `2.2.3` | Vectorized numerical processing and matrix operations |
| **pytest** | `9.0.2` | Test execution framework and assertion runner |
| **httpx** | `0.28.1` | Async HTTP client for test suite and AI integration |
| **google-genai** | `0.1.1` | Google Gemini API SDK (opt-in Ask AI copilot) |

*Full pinned environment (297 packages):* `paper_audit/experiments/pip_freeze.txt`

### Frontend Key Dependencies (`paper_audit/experiments/npm_list.json` & `frontend/package.json`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| **react** | `^19.0.0` | Declarative UI framework |
| **react-dom** | `^19.0.0` | React DOM rendering engine |
| **react-router-dom**| `^7.2.0` | Client-side SPA routing and navigation |
| **lucide-react** | `^0.475.0` | Accessibility-compliant vector icon system |
| **vite** | `^6.1.0` | High-speed ESM frontend bundler and development server |
| **typescript** | `~5.7.2` | Static type checking and compiler |
| **tailwindcss** | `^4.0.6` | Utility-first styling framework |
| **@tailwindcss/vite**| `^4.0.6`| Tailwind CSS Vite build integration |
| **oxlint** | `^0.15.11` | High-performance JavaScript/TypeScript linter |

---

## 4. Verification Evidence Command

To regenerate the manifest numbers independently from the repository root:
```powershell
python paper_audit/experiments/dump_env.py
python paper_audit/experiments/count_loc.py
python paper_audit/experiments/get_extensions.py
```

