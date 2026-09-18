---
trigger: model_decision
description: Applies to authentication, custom JWT lifecycle, password hashing, PostgreSQL RLS policies, secrets management, backend RBAC authorization, and audit logging.
---

# Smart Pen Academy – Security Model

This file defines the detailed security mechanisms for Smart Pen Academy.

For high-level architecture and stack invariants, see `Architecture.md`.  
For contracted business flows, see `Business_flows.md`.  
For global engineering behavior, see `~/.gemini/GEMINI.md`.

---

## 1. Authentication Model

Authentication is handled by the Node/Express backend. Supabase Auth MUST NOT be introduced.

**Login flow**

1. Client submits credentials over HTTPS.
2. Express validates the request (Zod).
3. Express retrieves the user’s credential record via a controlled backend-only path (service-role or equivalent).
4. Password is verified using bcrypt/bcryptjs.
5. Express issues a signed JWT (short-lived access token + refresh token).
6. Protected requests include the JWT.
7. Express validates the JWT and extracts:
   - user ID
   - role (`admin`, `coach`, `student`)
   - any other trusted claims
8. Express establishes a trusted, transaction-scoped PostgreSQL identity (e.g., via `SET LOCAL` or equivalent).
9. PostgreSQL RLS evaluates access using that trusted context.

PostgreSQL does NOT independently validate the JWT. The backend validates the JWT and then establishes the trusted identity used by RLS.

---

## 2. Pre-Authentication Login Path

The login endpoint operates before the user has a JWT, so credential lookup must use a controlled backend-only authentication path.

Requirements:

- Service-role credentials remain strictly server-side.
- Frontend never receives the service-role key.
- Credential queries are parameterized.
- Login input is validated with Zod.
- Login endpoints are rate-limited.
- Password hashes are never returned to clients.
- Auth errors avoid unnecessarily revealing whether an account exists.
- The privileged login path is not reused as a general-purpose DB access mechanism.

---

## 3. Defense-in-Depth Layers

Security enforcement has multiple layers:

1. **JWT authentication** – ensures the request is associated with a known user.
2. **Backend RBAC/authorization** – enforces permission rules and ownership checks.
3. **Scoped/parameterized DB access** – queries limited by role, user ID, and business rules.
4. **PostgreSQL RLS** – row-level restrictions based on the transaction-scoped identity.

Do NOT remove one layer because another exists. Frontend authorization is NOT a security boundary.

---

## 4. Role-Based Authorization

Supported roles: `admin`, `coach`, `student`.

Backend authorization must enforce the actual permission matrix. Never rely solely on frontend role checks.

For each protected operation, check:

- User role
- Ownership / relationship to the requested record (e.g., student ↔ coach, parent ↔ child)

Prevent:

- IDOR (accessing another user’s record by guessing IDs)
- Cross-student access
- Cross-coach access
- Privilege escalation
- Unauthorized role modification
- Unauthorized student/coach assignment changes

---

## 5. PostgreSQL Row Level Security (RLS)

Sensitive tables MUST use RLS. At minimum, enforce RLS on:

- `users`
- `coaches`
- `students`
- `attendance`
- `fees`
- `progress_trackers`
- `student_works`

RLS must be based on the trusted transaction-scoped identity established by the backend, not on client-supplied values.

Use explicit operation policies where appropriate: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.  
Avoid overly broad `FOR ALL` policies when granular policies provide better control.  
Coaches and students must NOT have `DELETE` access to sensitive records unless explicitly authorized.

---

## 6. Users Table Security

The `users` table is highly sensitive. It may contain: `password_hash`, `role`, `coach_id`, `student_id`, `is_active`, session/security fields.

Ordinary users must never receive sensitive authentication fields. Self-access (if allowed) must be restricted to the user’s own row and must exclude sensitive columns.

Self-update permissions must NOT allow modifying:

- `role`
- `coach_id`
- `student_id`
- `is_active`
- `password_hash`
- token/session security fields

RLS row restrictions alone are not sufficient to authorize sensitive column changes. Use backend validation and explicit update projections.

---

## 7. Coach Table Security

Coach information must distinguish between public profile data and private operational data.

- Potentially public: name, designation, specializations, qualifications, intentionally published profile info.
- Private: phone number, address, emergency contact, date of leaving, internal admin info.

Public APIs must use explicit column projections. Do not expose the entire coach row merely because the name is public. Only administrators may create, modify, or delete coach records unless the finalized permission model explicitly states otherwise.

---

## 8. Transaction-Scoped Database Identity

The identity used by RLS must be transaction-scoped.

When using pooled connections:

- Do NOT use persistent connection-level identity settings that can leak between requests.
- Use transaction-local mechanisms (e.g., `SET LOCAL`) where appropriate.
- Establish identity context and protected queries within the correct transaction boundary.

The identity context must never leak from one request/user to another.

---

## 9. Security Definer Functions

Any `SECURITY DEFINER` function used for security context establishment is highly sensitive. It MUST have:

- Explicit `search_path`
- Strict input validation
- Controlled ownership
- Least-privilege execution
- No unsafe dynamic SQL
- `REVOKE ALL FROM PUBLIC`
- Explicit/granular `EXECUTE` grants
- No ability for untrusted clients to forge identities

Never expose privileged `SECURITY DEFINER` functionality directly to the frontend. Never allow arbitrary users to set another user’s: user ID, role, coach ID, student ID.

---

## 10. Refresh Tokens & Sessions

Access tokens must be short-lived.

Refresh tokens must:

- Be stored securely (server-side, http-only cookies or equivalent where applicable)
- Be stored as hashes when persisted
- Never be stored in plaintext in the database
- Support expiration
- Support revocation
- Support rotation

Implement refresh-token reuse detection. If a previously rotated refresh token is reused, treat it as potential token theft and revoke the appropriate session/token family according to the security design.

---

## 11. Password Security

Passwords must:

- Never be stored in plaintext
- Never appear in logs
- Never be returned through APIs
- Use bcrypt/bcryptjs with the approved cost factor

Password reset tokens must:

- Be cryptographically secure
- Expire
- Be single-use
- Be safely stored (e.g., hashed or time-limited tokens in DB)
- Not reveal account existence unnecessarily

---

## 12. Input Validation & Database Queries

All externally supplied input must be validated.

Use Zod for:

- Request bodies
- Query parameters
- Route parameters
- Important externally controlled values

Never trust frontend validation. Database queries must be parameterized. Never construct SQL using unsafe string concatenation.

Avoid `SELECT *`. Prefer explicit projections containing only required fields.

---

## 13. API Security

Protected routes must use appropriate authentication and authorization middleware.

Maintain:

- Helmet/security headers
- CORS restrictions
- Rate limiting
- JWT authentication
- RBAC
- Input validation
- Sanitized errors
- Structured logging

Production API responses must never expose:

- Stack traces
- SQL
- Password hashes
- Tokens
- Secrets
- Internal credentials
- Sensitive implementation details

---

## 14. Secrets

The following must remain strictly server-side:

- `JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `GEMINI_API_KEY`
- Database credentials
- Other backend secrets

Never expose backend secrets through Vite/client bundles. Never prefix backend-only secrets with `VITE_`. Never hardcode secrets in source code. If a secret is discovered in source code, do NOT display its value; rotate it and remove it.

---

## 15. Audit Logging

Security-sensitive administrative and data-integrity actions must be recorded using the established `recordAudit()` mechanism and `tool_audit_logs` where applicable.

At minimum, carefully consider logging:

- Administrative changes
- User/role changes
- Coach creation/modification
- Student enrollment
- Fee modifications
- Security-sensitive account actions

Do not log:

- Passwords
- Password hashes
- JWT secrets
- Raw refresh tokens
- Authorization headers
- API keys

Audit logging must not become a mechanism for storing sensitive credentials.

---

## 16. Security Change Protocol

Before modifying security-sensitive code:

1. Inspect the existing implementation.
2. Identify the current security boundary.
3. Identify the exact problem.
4. Make the smallest safe change.
5. Preserve existing security controls.
6. Verify the resulting behavior.

Never weaken or bypass authentication, authorization, RLS, input validation, security middleware, or database restrictions merely to make a feature work.  
If a feature conflicts with a security control, stop and explain the conflict before proceeding.

---

## 17. Relationship to Other Documents

- Global engineering behavior: `~/.gemini/GEMINI.md`  
- Architecture & stack: `Architecture.md`  
- Business flows: `Business_flows.md`  
- UI/mobile patterns: `.agents/rules/mobile.md`

For security mechanisms, this file (`Security.md`) is authoritative for Smart Pen Academy.