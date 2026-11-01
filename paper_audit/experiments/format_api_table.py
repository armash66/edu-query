import json

with open('paper_audit/experiments/api_routes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

endpoints = data.get('endpoints', [])

md_lines = []
md_lines.append("| Method | Path | Summary / Description | Tags |")
md_lines.append("| :--- | :--- | :--- | :--- |")

for ep in endpoints:
    method = f"`{ep['method']}`"
    path = f"`{ep['path']}`"
    summary = ep.get('summary', '').replace('|', '\\|')
    tags = ', '.join(ep.get('tags', []))
    md_lines.append(f"| {method} | {path} | {summary} | {tags} |")

with open('paper_audit/experiments/api_table.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(md_lines))

print(f"Generated API markdown table with {len(endpoints)} rows.")

