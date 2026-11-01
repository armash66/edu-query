import sys
import os
sys.path.insert(0, os.path.abspath('.'))

import json
from app.main import app

openapi = app.openapi()
paths = openapi.get('paths', {})

endpoints = []
for path, methods_dict in sorted(paths.items()):
    for method, details in methods_dict.items():
        if method.lower() in ['get', 'post', 'put', 'delete', 'patch']:
            endpoints.append({
                'path': path,
                'method': method.upper(),
                'summary': details.get('summary', ''),
                'operation_id': details.get('operationId', ''),
                'tags': details.get('tags', []),
                'parameters': [p.get('name') for p in details.get('parameters', [])],
                'responses': list(details.get('responses', {}).keys())
            })

with open('paper_audit/experiments/api_routes.json', 'w', encoding='utf-8') as f:
    json.dump({'total': len(endpoints), 'endpoints': endpoints}, f, indent=2)

print(f"Total OpenAPI Endpoints Discovered: {len(endpoints)}")
for ep in endpoints:
    print(f"{ep['method']:<7} {ep['path']:<45} {ep['summary']}")
