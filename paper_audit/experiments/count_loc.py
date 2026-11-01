import os
import json

ext_map = {
    '.py': 'Python',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.js': 'JavaScript',
    '.mjs': 'JavaScript (Module)',
    '.css': 'CSS',
    '.html': 'HTML',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.sql': 'SQL',
    '.yml': 'YAML',
    '.yaml': 'YAML',
}

stats = {k: {'files': 0, 'lines': 0, 'code': 0, 'comment': 0, 'blank': 0} for k in set(ext_map.values())}
stats['Other'] = {'files': 0, 'lines': 0, 'code': 0, 'comment': 0, 'blank': 0}

total_size = 0
file_count = 0

ignore_dirs = {'.git', 'node_modules', '.pytest_cache', '__pycache__', 'dist', 'build', '.gemini', 'paper_audit'}

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for file in files:
        path = os.path.join(root, file)
        try:
            sz = os.path.getsize(path)
            total_size += sz
            file_count += 1
            ext = os.path.splitext(file)[1].lower()
            lang = ext_map.get(ext, 'Other')
            
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            c_code = 0
            c_comment = 0
            c_blank = 0
            
            for line in lines:
                s = line.strip()
                if not s:
                    c_blank += 1
                elif s.startswith('#') or s.startswith('//') or s.startswith('/*') or s.startswith('*'):
                    c_comment += 1
                else:
                    c_code += 1
                    
            stats[lang]['files'] += 1
            stats[lang]['lines'] += len(lines)
            stats[lang]['code'] += c_code
            stats[lang]['comment'] += c_comment
            stats[lang]['blank'] += c_blank
        except Exception:
            pass

out_txt = []
out_txt.append(f"Total Repo Size (excl git/node_modules/dist/paper_audit): {total_size / (1024*1024):.2f} MB")
out_txt.append(f"Total Files Audited: {file_count}")
out_txt.append("-" * 75)
header = f"{'Language':<25} {'Files':>6} {'Blank':>8} {'Comment':>8} {'Code':>8} {'Total':>8}"
out_txt.append(header)
out_txt.append("-" * 75)

for lang, s in sorted(stats.items(), key=lambda x: x[1]['code'], reverse=True):
    if s['files'] > 0:
        row = f"{lang:<25} {s['files']:>6} {s['blank']:>8} {s['comment']:>8} {s['code']:>8} {s['lines']:>8}"
        out_txt.append(row)

result_str = "\n".join(out_txt)
print(result_str)

with open('paper_audit/experiments/loc_stats.txt', 'w', encoding='utf-8') as f:
    f.write(result_str + "\n")

with open('paper_audit/experiments/loc_stats.json', 'w', encoding='utf-8') as f:
    json.dump({
        'total_size_mb': round(total_size / (1024*1024), 2),
        'total_files': file_count,
        'by_language': stats
    }, f, indent=2)

