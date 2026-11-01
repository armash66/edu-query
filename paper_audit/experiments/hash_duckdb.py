import hashlib
from pathlib import Path

files = [
    Path("data/eduquery.duckdb"),
    Path("data/datasets/dataset_20261022_215257_7dc1725c.duckdb"),
    Path("data/datasets/f5589de919ea0291.duckdb"),
]

for p in files:
    if p.is_file():
        h = hashlib.sha256()
        with open(p, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        print(f"{p.name:<45} | Size: {p.stat().st_size:<8} | SHA256: {h.hexdigest()}")

