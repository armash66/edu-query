# EduQuery - Security and Privacy Specification

## 1. Overview and Threat Model

EduQuery processes higher-education academic marksheets that contain student names, seat numbers, roll numbers, component marks, and performance outcomes. The system is designed to provide verifiable academic intelligence while maintaining student privacy and defending against unauthorized access, data leakage, and container attacks.

### Security Boundaries

| Asset / Surface | Threat | Mitigation Strategy |
| :--- | :--- | :--- |
| **Backend Origin (Render)** | Direct unauthenticated access bypassing faculty SSO | Faculty Identity Gateway (Cloudflare Access RS256 JWT verification) with origin bypass prevention. |
| **Browser Cross-Origin** | Attacker websites stealing faculty session data | Strict CORS allowlist; rejection of lookalike domains; credentials disallowed on wildcards. |
| **Student Roster & Marks** | PII leakage via logs, errors, or persistent traces | Zero student PII in application logs; ephemeral analysis sessions by default; complete deletion upon session termination. |
| **Excel Ingestion** | Zip-bomb archives, path-traversal files, corrupt formats | Max 25 MiB upload stream limit; uncompressed size bounding (max 100 MiB); secure filename sanitization. |
| **Database Queries** | SQL injection and wildcard denial-of-service | Parameterized queries exclusively; escaped LIKE wildcard characters (`%`, `_`, `!`). |
| **CSV Exports** | Session token leakage in URLs and CSV formula injection | Session tokens removed from query strings; single-use atomic download tickets; spreadsheet formula command sanitization. |

---

## 2. Faculty Identity Gateway (Zero Trust Authentication)

To ensure that only authorized faculty and academic administrators can access the analysis engine, EduQuery integrates with enterprise identity gateways (such as Cloudflare Access or university SSO proxies).

### Architecture and JWT Verification

When `EDUQUERY_GATEWAY_AUTH_REQUIRED=true` is set:

1. **Assertion Extraction**:
   - The gateway middleware inspects the `Cf-Access-Jwt-Assertion` header (or `Authorization: Bearer <jwt>`).
   - If no assertion header is present, the request is rejected with `HTTP 401 Unauthorized` (`MISSING_GATEWAY_ASSERTION`).

2. **Cryptographic Validation (`app/core/gateway_auth.py`)**:
   - Decodes token header to retrieve key ID (`kid`).
   - Fetches the public key set (JWKS) from `https://<team_domain>.cloudflareaccess.com/cdn-cgi/access/certs` with in-memory caching.
   - Validates the RS256 signature using the matching public RSA key.
   - Validates the audience (`aud`) claim against `CF_ACCESS_AUD`.
   - Validates the issuer (`iss`) claim against `https://<team_domain>.cloudflareaccess.com`.
   - Validates the expiration (`exp`) timestamp.

3. **Fail-Closed Behavior**:
   - If gateway authentication is required but neither `CF_ACCESS_AUD` nor a shared secret is configured, the server fails closed with `HTTP 500 Internal Server Error` (`GATEWAY_CONFIG_MISSING`).

4. **Direct Origin Bypass Prevention**:
   - Requests sent directly to the backend origin (e.g. `https://EduQuery.onrender.com`) without routing through the identity gateway are blocked with HTTP 401.

5. **Exempt Health Probes**:
   - Infrastructure orchestration probes (`/livez`, `/readyz`, `/health`) and static assets remain accessible without gateway authentication to support container lifecycle management.

---

## 3. Cross-Origin Resource Sharing (CORS) Security

EduQuery enforces strict origin validation:

- **Exact Match Evaluation**: Origins are checked against explicit entries in `EDUQUERY_CORS_ORIGINS` (e.g. `https://faculty.college.edu`, `http://localhost:5173`).
- **Lookalike Rejection**: Domains such as `https://faculty.college.edu.attacker.com` or arbitrary `.vercel.app` domains are rejected without `Access-Control-Allow-Origin` headers.
- **Credentials Policy**: `Access-Control-Allow-Credentials: true` is enabled only for explicitly listed, non-wildcard origins. Wildcard configurations (`*`) strictly disallow credential sharing.
- **Preflight Handling**: OPTIONS preflight requests return approved methods and headers without evaluating downstream authentication.

---

## 4. Privacy-First Ephemeral Sessions vs. Institutional Storage

### Mode A: Temporary Analysis Sessions (Default)
- **Zero Permanent Storage**: Workbooks uploaded for temporary analysis are parsed into ephemeral DuckDB files in `/tmp/eduquery-sessions/{session_id}/`.
- **Session Identification**: Cryptographically random 32-byte tokens generated via `secrets.token_urlsafe(32)`.
- **Complete Erasure**:
  - Faculty clicking "Delete Session & Clear Data" invokes `DELETE /api/v1/session`.
  - The backend closes the database connection, deletes the entire session directory from disk via `shutil.rmtree`, and clears the session cookie.
- **Inactivity Cleanup**: Sessions inactive beyond `EDUQUERY_IMPORT_SESSION_TTL_SECONDS` (default: 3600 seconds) are automatically pruned by background tasks and on server restart.

### Mode B: Institutional Persistent Storage (Opt-In Only)
- Faculty must explicitly select "Save to Institutional Storage" and supply a dataset name.
- Persistent datasets are saved to `/app/data/datasets/` and activated via atomic pointer swaps (`active_dataset.json`).

---

## 5. CSV Export and Download Ticket Security

### Token Removal from URLs
Previous architectures passed session tokens in GET query strings (e.g. `?session_token=...`), which exposed session credentials in browser history, proxy access logs, and referrer headers. In EduQuery:
- Primary export downloads use authenticated `fetch` requests with session credentials passed in HTTP headers (`X-EduQuery-Session-Token` or session cookies) and received as client-side `Blob` objects.

### Single-Use Atomic Download Tickets
For scenarios requiring native browser file downloads:
1. The authenticated frontend calls `POST /api/v1/session/download-ticket` with the target resource name.
2. The server issues a cryptographically secure ticket valid for exactly 60 seconds.
3. The browser requests `GET /api/v1/students/export?ticket=<ticket>`.
4. The server atomically validates and consumes the ticket on first redemption.
5. Any subsequent replay attempt with the same ticket is rejected.

### Formula Injection Protection
To protect faculty opening exported CSVs in Microsoft Excel or Google Sheets from CSV Injection / Formula Injection attacks:
- The export service inspects every text cell.
- Any cell beginning with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote (`'`), neutralizing executable expressions.
- Valid numeric numbers (e.g. `-5.2`, `+10`) are preserved without quoting.

---

## 6. Student Data Protection and Logging Standards

- **Zero Student PII in Logs**: Log messages record HTTP paths, status codes, course identifiers, execution times, and record counts. Student names, seat numbers, roll numbers, email addresses, and marks are strictly excluded from server log output.
- **Error Envelopes**: API error responses never expose internal filesystem paths, database connection strings, or raw Python stack traces.
- **SQL Parameterization**: All SQL queries against DuckDB use parameter substitution (`?`). Search queries escape wildcard characters (`%`, `_`, `!`) using `ESCAPE '!'`.

---

## 7. Known Security Limitations and Prerequisites

1. **Infrastructure Access Logs**: While EduQuery erases session files on disk, edge reverse proxies (such as Cloudflare or hosting load balancers) maintain standard network access logs (IP addresses, request paths, timestamps).
2. **Single-Node In-Memory Tickets**: Download tickets are stored in-memory per container instance. Multi-instance load-balanced deployments require sticky sessions or a shared token cache.
3. **SSO Identity Requirement**: For production use, `EDUQUERY_GATEWAY_AUTH_REQUIRED` should always be set to `true` with an identity provider (Cloudflare Access, Okta, or Google Workspace) configured at the edge.
