import subprocess
import json
import platform
import psutil
import sys
import os

p = subprocess.run('pip list --format=json', shell=True, capture_output=True, text=True)
pkgs = json.loads(p.stdout)
print(f"Total Python packages: {len(pkgs)}")

with open('paper_audit/experiments/pip_list.json', 'w', encoding='utf-8') as f:
    json.dump(pkgs, f, indent=2)

with open('paper_audit/experiments/pip_freeze.txt', 'w', encoding='utf-8') as f:
    for pkg in pkgs:
        f.write(f"{pkg['name']}=={pkg['version']}\n")

# Frontend packages
npm_ls = subprocess.run('npm list --prefix frontend --depth=0 --json', shell=True, capture_output=True, text=True)
try:
    frontend_deps = json.loads(npm_ls.stdout)
    with open('paper_audit/experiments/npm_list.json', 'w', encoding='utf-8') as f:
        json.dump(frontend_deps, f, indent=2)
    print("Frontend dependencies dumped.")
except Exception as e:
    print(f"Error parsing npm list: {e}")

# System hardware & OS
sys_info = {
    "git_commit": "32caa740cd71b66210bc12a14bab1ab4344d835e",
    "audit_date": "2026-11-01",
    "python_version": sys.version,
    "platform": platform.platform(),
    "machine": platform.machine(),
    "processor": platform.processor(),
    "cores_physical": psutil.cpu_count(logical=False),
    "cores_logical": psutil.cpu_count(logical=True),
    "ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
    "node_version": subprocess.run('node -v', shell=True, capture_output=True, text=True).stdout.strip(),
    "npm_version": subprocess.run('npm -v', shell=True, capture_output=True, text=True).stdout.strip(),
}

with open('paper_audit/experiments/system_manifest.json', 'w', encoding='utf-8') as f:
    json.dump(sys_info, f, indent=2)

print("System manifest written to paper_audit/experiments/system_manifest.json")
