import os
from collections import Counter

exts = Counter()
ignore_dirs = {'.git', 'node_modules', '.pytest_cache', '__pycache__', 'dist', 'build', '.gemini', 'paper_audit'}
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if not ext:
            ext = '[no ext]'
        exts[ext] += 1

for ext, count in exts.most_common(25):
    print(f"{ext:<15}: {count}")

