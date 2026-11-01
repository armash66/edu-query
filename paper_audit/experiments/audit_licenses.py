import json
from importlib.metadata import metadata, distributions

key_packages = [
    "fastapi", "uvicorn", "duckdb", "openpyxl", "pydantic",
    "scikit-learn", "numpy", "pandas", "reportlab", "starlette"
]

py_licenses = []
for pkg in key_packages:
    try:
        meta = metadata(pkg)
        license_str = meta.get("License") or meta.get("License-Expression") or "Unknown"
        # Take first line if multiline
        license_clean = license_str.split("\n")[0].strip()
        py_licenses.append({
            "package": pkg,
            "version": meta.get("Version"),
            "license": license_clean,
            "home_page": meta.get("Home-page") or meta.get("Project-URL")
        })
    except Exception as e:
        py_licenses.append({"package": pkg, "version": "unknown", "license": str(e)})

npm_packages = [
    {"package": "react", "license": "MIT"},
    {"package": "react-dom", "license": "MIT"},
    {"package": "react-router-dom", "license": "MIT"},
    {"package": "lucide-react", "license": "ISC"},
    {"package": "vite", "license": "MIT"},
    {"package": "typescript", "license": "Apache-2.0"},
]

out = {
    "python_licenses": py_licenses,
    "npm_licenses": npm_packages
}

with open("paper_audit/experiments/dependency_licenses.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)

print("Dependency license audit complete:")
for p in py_licenses:
    print(f"Python: {p['package']:<15} {p['version']:<10} -> {p['license']}")
for n in npm_packages:
    print(f"NPM:    {n['package']:<15} -> {n['license']}")

