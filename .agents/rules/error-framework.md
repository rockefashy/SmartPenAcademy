# SMART PEN ACADEMY — ERROR HANDLING & LOGGING FRAMEWORK DIRECTIVES

This document specifies the authoritative standards for error handling, exception propagation, structured logging, and observability across the Smart Pen Academy platform.

---

## 1. Core Architecture & Components

The framework consists of four integrated layers:
1. **Domain-Scoped Logger (Logger.get(domain))** in server/logger.ts
   - Log domains: API, DB, AUTH, AI_AGENT, AUDIT, SYSTEM
   - Priority levels: DEBUG (0) < INFO (1) < WARN (2) < ERROR (3) < FATAL (4)
   - Native stdout/stderr output. **No local file persistence** (Render containers have ephemeral filesystems; all logs stream directly to standard streams).
2. **Typed Error Hierarchy (AppError)** in server/errors.ts
   - Subclasses: ValidationError (400), AuthenticationError (401), AuthorizationError (403), NotFoundError (404), ConflictError (409), RateLimitError (429), DatabaseError (500), ExternalServiceError (502), InternalServerError (500).
3. **Centralized Express Error Pipeline** in server/middleware/errorHandler.ts
   - syncHandler(fn) route wrapper catches unhandled async rejections and forwards to 
ext(err).
   - errorHandler terminal middleware formats uniform client JSON, logs with sanitized metadata, and masks internal implementation details.
4. **Frontend Error Boundary** in src/components/ErrorBoundary.tsx
   - Prevents uncaught React render crashes from rendering a blank screen; presents user-friendly recovery UI.

---

## 2. Invariants & Operational Rules

### Rule #1: Centralized Single Error Path
Route handlers must not employ copy-pasted inline 	ry { ... } catch (err) { res.status(500).json(...) } blocks. Handlers must be wrapped in syncHandler(fn) and throw typed AppError instances directly. Uncaught errors flow naturally to the global errorHandler middleware.

### Rule #2: Automatic Recursive Secret Redaction
Sensitive keys (password, 	oken, secret, uthorization, cookie, piKey, credential, session, earer, hash) and values matching JWTs or API keys must be recursively sanitized before writing to logs. Plaintext secrets must never appear in standard streams.

### Rule #3: Stdout / Stderr Exclusivity
- Standard output (process.stdout.write): DEBUG, INFO, WARN.
- Standard error (process.stderr.write): ERROR, FATAL.
- Do NOT write log files to local disk. Render natively aggregates stdout/stderr streams.

### Rule #4: Distinction Between Empty State and Failure Propagation
Database query methods and service layers must explicitly distinguish between **legitimate empty query results** and **execution failures**:
- **Legitimate Empty Results**: When a query executes successfully and yields zero matching rows, returning [] (for collections) or 
ull (for single entity lookups) is required and correct behavior per GEMINI.md Section 3.
- **Execution Failures**: When a query or database connection throws an exception (e.g., connection drop, timeout, syntax/schema error, constraint violation), catching and silently swallowing that exception into [] or 
ull to masquerade as an empty state is strictly prohibited. All caught database exceptions must be logged via Logger.get('DB') and re-thrown as a typed DatabaseError so the API layer can respond with an appropriate HTTP error and diagnostic context.

### Rule #5: Log-and-Exit on Fatal Uncaught Exceptions
When process.on('uncaughtException') fires:
1. The error must be logged immediately with full stack trace via Logger.get('SYSTEM').fatal(...).
2. A grace timeout (1000ms max) is allotted for streams to flush.
3. The process must exit with process.exit(1).
*Do NOT attempt to continue running after an uncaught exception, as internal process memory and state may be corrupted.*

### Rule #6: Dual-Track Audit Architecture
- **PostgreSQL Audit Trail (ecordAudit() / 	ool_audit_logs)**: Authoritative, persistent, tamper-evident ledger in PostgreSQL (GEMINI.md Section 21).
- **Logger.get('AUDIT')**: Real-time operational log stream to stdout for DevOps and monitoring visibility.
ecordAudit() must emit to Logger.get('AUDIT') upon execution. The operational log stream does not replace PostgreSQL persistence.

### Rule #7: Frontend Crash Protection
The application root must be wrapped in an ErrorBoundary. When a render crash occurs, display the user-friendly recovery UI and log diagnostic info rather than allowing a blank screen.
