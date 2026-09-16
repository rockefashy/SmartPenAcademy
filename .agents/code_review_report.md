# Smart Pen Academy — Code Review Report
**Review Date**: 2026-09-12  
**Scope**: Full codebase — architecture, security, data integrity, functionality  
**Reviewer**: Antigravity (AI Code Review)

---

## Executive Summary

The codebase is a well-structured, single-deployment full-stack application with a genuine security-first orientation. The authentication model, error hierarchy, logging, input validation, and audit trail are significantly above average for a product of this size. The PostgreSQL schema, RLS policy design, and AI tool authorization layering are notably strong.

There are several real issues that require attention — one **critical security design flaw** (the `forgot-password` flow), one **high severity architectural gap** (RLS context is defined but never activated), and several medium and low severity findings.

---

## Grading Legend

| Symbol | Severity |
| :--- | :--- |
| 🔴 **CRITICAL** | Active security vulnerability or data integrity failure |
| 🟠 **HIGH** | Significant security gap or architectural violation |
| 🟡 **MEDIUM** | Code quality issue, missing control, or reliability gap |
| 🔵 **LOW** | Improvement or best-practice deviation |
| ✅ **STRONG** | Notable positive finding |

---

## 1. Architecture

### ✅ Strong: Single-deployment, stateless design
The application is correctly architected as a stateless Node/Express backend serving a Vite/React SPA. Authentication state is carried in JWT claims — no server-side session store. The design is horizontally scalable without any synchronized process memory.

### ✅ Strong: Clear separation of concerns
- `server.ts` — HTTP routing, middleware, endpoint handlers
- `server/supabaseDb.ts` — All database access through typed class methods
- `server/aiAgent.ts` + `server/tools/*` — AI agent execution engine
- `src/services/api.ts` — Frontend API client
- `server/schemas.ts` — Shared Zod schemas (good: avoids duplication)

### 🟡 MEDIUM: `package.json` name is `react-example`
The `name` field in [`package.json`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/package.json) is `"react-example"`. This is a scaffolding artifact with no production consequences, but it is misleading in deployments, Render dashboards, and error reports.

### 🟡 MEDIUM: Vite and esbuild are both in `dependencies` (not `devDependencies`)
Build tools (`vite`, `esbuild`, `tsx`, all `@types/*`) are in the `dependencies` block. They should be `devDependencies`. This inflates the production `node_modules` install and is especially costly on Render where cold-start install time matters.

### 🔵 LOW: No `engines` field in `package.json`
No declared Node.js version constraint. A mismatch between dev/prod Node versions can silently cause runtime differences.

---

## 2. Authentication

### ✅ Strong: Custom JWT with `httpOnly`, `SameSite=Strict`, `Secure` cookies
The access token is issued as a server-side `httpOnly` cookie. The fallback to `Authorization: Bearer` header is accepted for non-browser clients (tests, AI agent). Cookie flags are correctly conditional on `NODE_ENV=production` for development compatibility.

### ✅ Strong: Hardened pre-auth login path (`get_auth_user_by_identifier`)
Login credential lookup is routed through a `SECURITY DEFINER` PostgreSQL RPC that:
- Validates input before querying
- Is revoked from PUBLIC
- Is granted only to `authenticated, service_role, postgres`
- Has explicit `SET search_path`

This correctly prevents client-controlled SQL injection and bypasses RLS only for the pre-authentication credential path.

### ✅ Strong: Login audit trail
Failed and successful login attempts are audit-logged, including the failure reason subcategory (`auth_login_failed`, `auth_login_rejected_inactive_coach`). Password values are never logged.

### ✅ Strong: Rate limiting on auth endpoints
The `authRateLimiter` (10 attempts / 15 min) is applied to login, forgot-password, request-reset, and change-password. Rate limiting is backed by a PostgreSQL atomic RPC (`check_and_increment_rate_limit`) with a table-based fallback.

### 🟡 MEDIUM: 7-day JWT access token with no refresh token mechanism
The JWT is valid for 7 days. If a token is stolen (e.g. via an XSS attack on a subdomain), it remains valid for up to 7 days without a revocation path. The `token_version` column exists in the schema and is incremented on password change, but it is **not validated** in the `authenticateJwt` middleware. The token_version claim is embedded in the JWT payload on issue but never cross-checked against the database on each request.

**Risk**: A user who changes their password does not immediately invalidate old tokens that are still alive for their remaining 7-day window.

**Recommendation**: On each `authenticateJwt` call (or at minimum on sensitive operations), fetch the current `token_version` from the database and compare against the JWT claim. Alternatively, implement short-lived access tokens (15–30 min) with a refresh token flow.

### 🟡 MEDIUM: `supabase-session` endpoint accepts client-supplied `role`
[`POST /api/auth/supabase-session`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1322) accepts `role` from the request body (validated by Zod enum) and passes it to `db.upsertUserFromSupabase`. If the database lookup fails to find an existing user record or if `upsertUserFromSupabase` does not strictly enforce role based on DB state, a caller could attempt privilege escalation by POST-ing `role: "admin"`.

**Needed**: Verify that `upsertUserFromSupabase` never allows the role to be upgraded via this path — the database role for an existing user must always win.

### 🟡 MEDIUM: `family-students` endpoint has no authentication and leaks student enrollment metadata
[`POST /api/auth/family-students`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1290) accepts an email address with no authentication and returns student IDs, names, ages, grade class, and school name. This is a **student data enumeration endpoint** accessible to the public internet.

**Intended purpose**: Sibling profile discovery before login. **Risk**: Anyone who knows or guesses a parent's email can retrieve PII (children's names, ages, schools) for all enrolled students in that family.

**Recommendation**: Require the caller to possess a temporary token (e.g. issued after successful password validation) before returning the family student list, or restrict to only student ID + first name.

### 🔵 LOW: `forgot-password` audit log reveals whether an account exists
The [`POST /api/auth/forgot-password`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1395) endpoint throws `NotFoundError('No account found with this username or email.')` when the identifier doesn't match. This reveals account existence to unauthenticated callers (account enumeration). The endpoint is rate-limited, which mitigates this significantly, but a timing-safe "we'll send an email if an account exists" pattern is the standard approach.

---

## 3. Security — Critical Finding

### 🔴 CRITICAL: `forgot-password` sends the plaintext password via email

The [`sendForgotPasswordEmail`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/email.ts#L359) function accepts a `rawPassword` or `password` parameter and embeds the plaintext password value directly in the email body:

```typescript
// email.ts:392
<span style="font-size: 20px; font-weight: 800;">
  ${passwordToDisplay}   // ← raw plaintext password
</span>
```

The calling endpoint [`POST /api/auth/forgot-password`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1421) passes `user` (a `StoredUser` object) directly to this function:

```typescript
const emailResult = await sendForgotPasswordEmail(user.email, user);
```

The `StoredUser` type includes `passwordHash` — but `password` and `rawPassword` are also optional fields. The `findUsersByIdentifier` function does return `password_hash` in its column selection. The email function checks for `user.rawPassword || user.password` — if neither is set (which is the normal case for bcrypt-hashed accounts), the function returns `{ success: false }` and the endpoint proceeds without sending a usable email.

**However**, this function signature and logic is **architecturally incorrect and dangerous**:
1. The endpoint is designed to **send a raw password via email**, which is a fundamental violation of password security (passwords must never be recoverable — they are stored only as bcrypt hashes)
2. The code pattern signals intent to store or recover raw passwords somewhere, or to use this for new-enrollment "welcome" emails where a temporary password is sent
3. The `rawPassword` field in `sendForgotPasswordEmail`'s signature implies the system was designed — or might be configured — to recover plaintext passwords

**Verdict**: For well-established users with bcrypt-hashed passwords, this is currently a dead code path (returns `success: false`). But the design is wrong and the function should be refactored to **never send raw passwords via email** — the only correct flow is a secure tokenized reset link.

> [!CAUTION]
> **This design violates Section 17 of your system directives.** The `forgot-password` flow must be replaced with a secure token-based reset link (the `request-reset-link` endpoint already exists and is implemented correctly). The `sendForgotPasswordEmail` function should be removed or repurposed to send only the reset link, not a password value.

---

## 4. Security — High Severity Findings

### 🟠 HIGH: PostgreSQL RLS context (`set_request_context`) is never called from application code

The schema defines a `SECURITY DEFINER` RPC `set_request_context(user_id, role, coach_id, student_id)` that populates `app.current_user_id`, `app.current_user_role`, etc. — which all RLS policies depend on.

**Verification result**: A full project-wide search confirms that `set_request_context` is **never called** from any TypeScript server file:
```
grep result: zero hits in server/supabaseDb.ts, server.ts, or any tool file
```

This means all RLS policies are evaluating `current_setting('app.current_user_id', true)` against an **empty string** on every request, because the transaction context is never set.

**Practical consequence**: The backend uses the `service_role` key (which bypasses RLS entirely). RLS is therefore **not enforced** for any query. The backend's own application-level authorization (RBAC middleware, `verifyStudentAccess`, tool-level ownership checks) is the only enforced boundary.

This is a defense-in-depth gap: RLS exists as Layer 4 of the stated security model, but Layer 4 is currently inactive. If a bug or regression bypasses application-level authorization, there is no RLS backstop.

> [!WARNING]
> **Action Required**: Either activate `set_request_context` per request (establishes a transaction-local identity that RLS can evaluate), or explicitly document and acknowledge that the service_role client bypasses RLS and that application-level RBAC is the sole enforcement layer.

### 🟠 HIGH: Server-side Supabase client falls back to anon key

In [`server/supabase.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabase.ts):
```typescript
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_ANON_KEY   // ← fallback to anon key
  || process.env.VITE_SUPABASE_ANON_KEY || '';
```

If `SUPABASE_SERVICE_ROLE_KEY` is not configured (e.g. missing environment variable in a staging deployment), the server silently falls back to the `ANON_KEY`. This changes the Supabase connection permission model without any warning or startup failure. All queries that need service-role authority (like `get_auth_user_by_identifier`) would silently fail or return wrong data.

**Recommendation**: The server should **fail fast at startup** if `SUPABASE_SERVICE_ROLE_KEY` is not set, not fall back silently.

---

## 5. Data Integrity

### ✅ Strong: Schema normalization and database.types.ts alignment
The identity-first normalized schema (`students.user_id → users.id`) is consistently enforced across all mapping functions. The recent alignment work ensures TypeScript types match actual database columns (no phantom fields).

### ✅ Strong: Receipt number protection
The Zod schemas in [`server/schemas.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/schemas.ts) use `superRefine` to reject any client-supplied `receiptNumber`:
```typescript
if (data.receiptNumber !== undefined || data.receipt_number !== undefined) {
  ctx.addIssue({ message: 'receiptNumber cannot be supplied by clients...' })
}
```
The PostgreSQL trigger generates receipt numbers, and the schema validation enforces this as immutable from the application layer.

### ✅ Strong: Soft deletes with data preservation
No hard deletes of student or coach records. `status: 'Inactive'` + `date_of_leaving` is the archival pattern, preserving full historical data.

### 🟡 MEDIUM: `getAllStudents()` and `getAllCoaches()` use broad `SELECT *` with N+1 fan-out
[`getAllStudents`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabaseDb.ts#L965) does:
1. `SELECT *` from `students` (up to 5000 rows)
2. `SELECT *` from `users` (up to 5000 rows)
3. `SELECT id, user_id` from `coaches`

All are fetched every time any student list is needed. With 30+ AI tools calling `db.getAllStudents()` (including `findStudent()` which calls it for fuzzy name resolution), this produces many full-table-scan pairs per AI conversation turn.

**Risk**: As student/user count grows, this becomes the primary performance bottleneck. Each AI tool invocation that does name-based student lookup triggers a full students + users pull.

**Recommendation**: Move fuzzy student lookup to a parameterized DB query (`ILIKE` on name) rather than loading all students into memory for in-process filtering.

### 🟡 MEDIUM: bcrypt cost factor is 8 (below recommended minimum of 10)
All password hashing uses `bcrypt.hashSync(password, 8)`. The current OWASP recommendation is **cost factor 10** (minimum) for bcryptjs on modern hardware. Cost factor 8 is approximately 4× faster to crack than cost factor 10.

### 🔵 LOW: `notes` column used as a JSON blob for student metadata
Several structured fields (`dominantHand`, `preferredDays`, `scriptsRequired`, `academicModules`) are stored as a JSON blob inside `students.notes`. This makes SQL queries on those fields impossible and requires deserialization in every read. These should be proper columns if they are first-class attributes.

---

## 6. Authorization

### ✅ Strong: Multi-layer tool authorization (AI agent)
The `executeTool` engine in [`aiAgent.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/aiAgent.ts) enforces:
1. Tool registry lookup (unknown tools rejected)
2. Per-tool atomic rate limiting (PostgreSQL-backed)
3. Declarative `allowedRoles` check
4. `selfServiceOnly` flag prevents admin bypass of personal-identity tools
5. Per-tool `execute()` performs additional ownership checks

This is a well-designed layered authorization model for the AI tool surface.

### ✅ Strong: `PATCH /api/auth/me` blocks sensitive field modification
The self-update endpoint explicitly rejects attempts to modify `role`, `coachId`, `studentId`, `isActive`, `passwordHash`, and other security-sensitive fields, before Zod schema validation — not after.

### ✅ Strong: `verifyStudentAccess` middleware checks actual database state
The `canAccessStudent` helper fetches the student from the database and checks `student.coachId` against the authenticated user's identity — it does not trust URL parameters or JWT claims for ownership decisions.

### 🟡 MEDIUM: Coach `DELETE /api/fees/:id` and `PATCH /api/fees/:id` have no per-fee ownership check
[`DELETE /api/fees/:id`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L2296) and [`PATCH /api/fees/:id`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L2259) authenticate (`requireCoachOrAdmin`) but do **not** then check whether the fee record belongs to a student assigned to the requesting coach. A coach can modify/delete any fee record for any student if they know the fee ID.

The AI tool version of `updateFeeStatus` **does** implement this scoping correctly — the REST API endpoint does not.

---

## 7. Input Validation

### ✅ Strong: Zod throughout
All endpoint request bodies, route parameters, and query strings are validated through Zod schemas before processing. The error messages from Zod propagate as `ValidationError` (HTTP 400) through the centralized error handler.

### ✅ Strong: `server/schemas.ts` centralizes shared schemas
Attendance, fee, coach, student, and testimonial schemas are defined once in `schemas.ts` and shared between Express routes and AI tools — no duplication.

### 🟡 MEDIUM: `enrollStudentSchema` uses `.passthrough()`
The enrollment schema in `server.ts` uses `.passthrough()`, which allows unknown fields to flow through Zod validation and into `newStudent`. While the downstream DB write mapping controls what actually reaches PostgreSQL, extra fields can persist in the object and be logged or misused. Prefer strict schemas.

### 🟡 MEDIUM: Supabase `.or()` filter injection risk in `findUsersByIdentifier`
[`supabaseDb.ts:505`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabaseDb.ts#L505):
```typescript
const filterConditions = [
  `email.ilike.${clean}`,
  `phone.eq.${phoneDigits || clean}`,
  `id.eq.${clean}`
];
// ...
supabase.from('users').select(...).or(filterConditions.join(','))
```

PostgREST filter values are not parameterized in the same way as SQL parameters — they are embedded directly into the filter string. If `clean` contains special PostgREST syntax characters (e.g. commas, parentheses, `.`), they could corrupt the filter expression. The primary path (the RPC `get_auth_user_by_identifier`) is safe, but this fallback path is not.

---

## 8. Observability & Logging

### ✅ Strong: Structured domain logger with automatic redaction
The [`Logger`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/logger.ts) class:
- Recursively redacts sensitive keys via regex (`password`, `token`, `secret`, etc.)
- Detects and redacts raw JWT strings and API key prefixes (`sbp_`, `re_`, `AIza`)
- Outputs structured JSON in production (compatible with Render, Datadog, etc.)
- Uses `stdout` / `stderr` correctly (stdout for INFO/WARN/DEBUG, stderr for ERROR/FATAL)
- Handles circular references safely

### ✅ Strong: `tool_audit_logs` table captures all AI tool invocations
Every AI tool execution (both successful and failed) is logged to `tool_audit_logs` with actor identity, tool name, sanitized arguments, summary, and result. This provides a complete operational audit trail.

### 🔵 LOW: No structured request access log
There is no access log for all inbound HTTP requests (method, path, status, response time). This makes it difficult to identify slow endpoints, error rate spikes, or suspicious access patterns in production.

---

## 9. Error Handling

### ✅ Strong: Typed AppError hierarchy
The [`errors.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/errors.ts) hierarchy (`ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `DatabaseError`, `ExternalServiceError`, `InternalServerError`) maps cleanly to HTTP status codes and structured client responses.

### ✅ Strong: Production error sanitization
The centralized `errorHandler` in [`errorHandler.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/middleware/errorHandler.ts) correctly suppresses stack traces and internal messages in `NODE_ENV=production`. Debug stacks are exposed only in development.

### 🔵 LOW: `asyncHandler` doesn't preserve `req.user` type narrowing across the boundary
`asyncHandler` wraps the route handler in a plain `(req, res, next) => ...` closure, which loses the `AuthRequest` type narrowing. TypeScript allows this but it means routes with `authenticateJwt` middleware can't statically guarantee `req.user` is set inside the handler without explicit non-null assertion.

---

## 10. Frontend & API Client

### ✅ Strong: Token stored in httpOnly cookie; localStorage is a fallback mirror only
The primary authentication channel is the `httpOnly` cookie. The `localStorage.setItem('smartpen_token', ...)` in `AuthContext` appears to be a convenience mirror for the `Authorization` header fallback, but the server prioritizes the cookie.

### 🟡 MEDIUM: `src/lib/supabase.ts` frontend client could leak the anon key in network traffic
The frontend Supabase client uses `VITE_SUPABASE_ANON_KEY` which is bundled into the client JavaScript (by Vite design). The anon key is intended to be public, but RLS must be active on the database to ensure the anon key cannot access sensitive data. Given that RLS context is never set (finding §4.1), this could allow direct Supabase client queries from the browser to bypass backend authorization.

**Mitigating factor**: The frontend Supabase client appears to be used primarily for `supabaseAuthService` (OAuth flows), not for direct data queries.

### 🔵 LOW: `supabaseAuthService.ts` role inference uses email-contains heuristic
```typescript
role: userProfile?.role || meta.role || (data.user.email?.includes('admin') ? 'admin' : 'student')
```
If a Supabase-authenticated user's profile is not found in `public.users`, their role falls back to checking whether the email contains the string `"admin"`. This is a role-assignment heuristic that could grant admin role to a user whose email address happens to contain "admin" but who is not actually an administrator.

---

## 11. AI Agent Surface

### ✅ Strong: Guest-vs-authenticated tool separation
`PUBLIC_TOOLS` (no `allowedRoles`) are available to unauthenticated visitors. Role-gated tools are enforced at the `executeTool` level. Public tools cannot access protected data.

### ✅ Strong: Per-tool rate limiting is PostgreSQL-atomic
Tool rate limits are enforced via `check_and_increment_rate_limit` RPC — atomic, correct under concurrent load, with a graceful table-based fallback.

### ✅ Strong: AI tool inputs are independently validated
Each tool validates its own inputs with Zod (via `validateWithSchema` helper) and enforces ownership rules independently of the Gemini model's output. The AI model cannot instruct a tool to bypass authorization.

### 🟡 MEDIUM: `handleAIAgentChat` accepts client-supplied `apiKey`
The AI chat endpoint allows the frontend to pass an `apiKey` in `settings`:
```typescript
const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
```
This means any user can supply their own Gemini API key for chat sessions. This is probably intentional (admin configuration feature), but it means server requests will use the user-supplied key against Google's API, which could be used to attribute usage/costs to another person's key.

---

## 12. Summary Table

| Category | Status | Key Findings |
| :--- | :--- | :--- |
| **Architecture** | 🟢 Good | Stateless, well-separated; minor config/package issues |
| **Authentication** | 🟡 Needs Work | Long-lived JWT, token_version not validated, family-students leak |
| **Auth — Critical** | 🔴 Critical | `forgot-password` sends plaintext password via email |
| **Authorization (API)** | 🟡 Needs Work | Fee PATCH/DELETE missing coach scoping |
| **Authorization (Tools)** | 🟢 Strong | Multi-layer RBAC, rate limiting, selfServiceOnly flag |
| **RLS** | 🟠 High | `set_request_context` never called; RLS is inactive in practice |
| **Data Integrity** | 🟢 Good | Normalized schema, soft deletes, receipt generation |
| **Input Validation** | 🟡 Needs Work | `.passthrough()` in enroll schema, .or() PostgREST injection risk |
| **Password Security** | 🟡 Needs Work | bcrypt cost=8 (should be ≥10), rawPassword in email signature |
| **Logging** | 🟢 Strong | Structured logger with auto-redaction, audit trail |
| **Error Handling** | 🟢 Strong | Typed hierarchy, production sanitization |
| **Frontend** | 🟡 Needs Work | RLS not active = anon key could bypass backend for direct queries |

---

## Priority Action Items

| Priority | Action | File |
| :--- | :--- | :--- |
| 1 🔴 | Remove `sendForgotPasswordEmail` raw-password flow; redirect all forgot-password to `request-reset-link` | [`email.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/email.ts), [`server.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1395) |
| 2 🟠 | Call `set_request_context` per request to activate RLS, or explicitly document RLS bypass | [`supabaseDb.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabaseDb.ts) |
| 3 🟠 | Fail fast at startup if `SUPABASE_SERVICE_ROLE_KEY` is not set; remove anon key fallback | [`server/supabase.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabase.ts) |
| 4 🟡 | Add token_version validation in `authenticateJwt` middleware | [`server.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L200) |
| 5 🟡 | Add coach ownership check to `PATCH /api/fees/:id` and `DELETE /api/fees/:id` | [`server.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L2259) |
| 6 🟡 | Restrict `POST /api/auth/family-students` to require at minimum a pre-auth token | [`server.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server.ts#L1290) |
| 7 🟡 | Increase bcrypt cost factor from 8 to 10 across all `hashSync` calls | [`supabaseDb.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabaseDb.ts) |
| 8 🟡 | Replace `getAllStudents()` fuzzy search with a parameterized DB query | [`supabaseDb.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/supabaseDb.ts#L965), [`tools/helpers.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/server/tools/helpers.ts) |
| 9 🔵 | Fix `package.json` name and move build tools to `devDependencies` | [`package.json`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/package.json) |
| 10 🔵 | Remove role-from-email heuristic in `supabaseAuthService.ts` | [`supabaseAuthService.ts`](file:///Ubuntu/home/rocke/Projects/SmartPenAcademy/src/services/supabaseAuthService.ts) |
