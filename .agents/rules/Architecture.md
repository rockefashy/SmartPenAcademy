---
trigger: always_on
---

# Smart Pen Academy – Architecture Contract

This document defines the authoritative architecture, stack invariants, data contracts, and technical standards for Smart Pen Academy.

For behavioral and engineering discipline, see `~/.gemini/GEMINI.md`.  
For detailed security mechanisms, RLS, tokens, and audit logging, see `Security.md`.  
For business workflows, see `Business_flows.md`.  
For mobile/UI standards and shared component usage, see `mobile.md`.  
For error propagation and logging, see `error-framework.md`.

---

## 1. Core Stack & Infrastructure Invariants

The technology stack is finalized:
- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Lucide React icons, Motion animations.
- **Backend**: Node.js, Express, TypeScript, Zod schema validation, bcrypt/bcryptjs password hashing.
- **Authentication**: Custom JWT authentication (short-lived access tokens, secure refresh rotation). **Do NOT introduce Supabase Auth or third-party auth widgets.**
- **Persistence**: Supabase PostgreSQL is the authoritative single source of truth.
- **Hosting & Infra**: Render is the production platform. Production server must bind to `0.0.0.0` using the environment-supplied port. Preserve the single-application deployment model.

---

## 2. Architecture Governance & Change Protocol

The approved architecture is final. You are an implementation partner, not an autonomous architect.

You MUST NOT silently:
- Redesign systems, replace technologies, or add caching infrastructure (e.g. Redis).
- Introduce microservices, GraphQL, or alternative databases/ORMs.
- Bypass RLS, authentication middleware, or security boundaries.
- Alter contracted business flows (`Business_flows.md`) or API contracts.

If an architectural change is genuinely required, explain:
> **PROPOSED ARCHITECTURAL CHANGE**  
> Current design: ...  
> Proposed change: ...  
> Reason / Tradeoffs / Security / Performance / Cost Impact: ...  
Then wait for explicit user approval before proceeding.

---

## 3. Database as the Single Source of Truth

PostgreSQL is the authoritative store for all application data.

- **Stateless API**: Any backend instance must handle any request. Horizontal scaling must not rely on process memory.
- **No In-Memory Mirrors**: Never hydrate entire tables into Node memory or maintain persistent in-memory database mirrors.
- **Query Discipline**: Use efficient queries with explicit column projections, proper filtering, pagination, and parameterized inputs. Avoid `SELECT *`.

---

## 4. Data Model & Schema Contracts

Persisted data must conform to the active PostgreSQL schema. TypeScript types and API contracts must represent the current database schema accurately.
- **Structured Fields**: Entities (students, coaches, fees, attendance) must use typed, structured columns rather than untyped JSON blobs or compressed strings.
- **Relationship Integrity**: Multi-child / sibling relationships must be preserved (multiple students linked to the same parent contact).
- **Field Modifications**: Any column addition or modification must strictly follow Section 12 (Data Field Change Flow).

---

## 5. Contracted Business Flows

All core workflows (student enrollment, attendance, fee management, progress tracking, coach assignment, parent/student portals, demo bookings) are governed by `Business_flows.md`.
- Flows represent authoritative business rules. Never modify business logic implicitly in code.
- Iterative enhancement is supported as directed by the user; update `Business_flows.md` in lockstep with business rule changes.

---

## 6. Security & API Invariants (Delegated Authority)

Security enforcement operates via defense-in-depth:
1. **Custom JWT Auth**: Verified on every protected request by backend middleware.
2. **Backend RBAC & Resource Ownership**: Role checks (`admin`, `coach`, `student`) and relationship validation. Frontend checks are never a security boundary.
3. **Parameterized SQL Queries**: All database queries must be parameterized to prevent SQL injection.
4. **PostgreSQL Row Level Security (RLS)**: Enforced via transaction-scoped backend identity.
5. **Input Validation**: All externally supplied input (body, query, params) must be validated with Zod.
6. **API Response Confidentiality**: Production responses must never expose stack traces, raw SQL queries, password hashes, secrets, or server paths (`error-framework.md`).

For specific authentication paths, RLS policies, token handling, passwords, and audit logging (`recordAudit()`), **`Security.md` is authoritative**.

---

## 7. Environment Variables & Runtime Configuration

- **Server-Side Secrets**: Sensitive variables (`JWT_SECRET`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GEMINI_API_KEY`) must strictly reside on the server. The backend must validate required secrets at startup and fail-fast with an actionable error if any are missing.
- **Client-Side Variables**: Only client-safe variables prefixed with `VITE_` are allowed in frontend code. Never prefix secrets with `VITE_`.
- **Source Code Protection**: Never hardcode secrets or commit `.env` files.

---

## 8. Frontend Architecture & State Management

- **Global Session State**: Auth state (`user`, `token`, login modal triggers, sibling student switching) is managed strictly via React Context in `src/context/AuthContext.tsx`.
- **Component / Screen State**: Form state, active tabs, and modals are managed via local React hooks (`useState`, `useCallback`, `useMemo`).
- **API Client Layer**: Frontend requests must flow through centralized typed client services (`src/services/` or `src/lib/api.ts`), never raw ad hoc `fetch()` calls.
- **Mobile-First UI Primitives**: Adhere strictly to `mobile.md` for shared component reuse (`<Button>`, `<Modal>`, `<FormField>`) and viewport handling (`dvh`).

---

## 9. Performance & Horizontal Scalability

Performance must come from database efficiency:
- Proper indexing, connection pooling, pagination, and avoiding unnecessary round-trips.
- Do NOT introduce Redis or in-memory caches merely because an application is enterprise-grade.
- The backend must remain strictly stateless.

---

## 10. Database Migration Standards

All database modifications must use version-controlled migrations:
- **Location**: Store SQL files in `supabase/migrations/`.
- **Naming**: Use deterministic timestamped naming: `YYYYMMDDHHMMSS_description.sql`.
- **Idempotency**: Migrations must be non-destructive where possible and idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **No Manual Schema Edits**: Never make undocumented, manual schema changes in production.

---

## 11. Technical Verification Baseline

Before declaring any task complete:
1. **Type Safety**: Run `npx tsc --noEmit` and confirm 0 errors.
2. **Production Compilation**: Run `npm run build` and confirm successful compilation and static prerendering.
3. **Automated Regression Testing**: When touching backend endpoints, auth flows, or database mappings, run relevant test suites (e.g. `npx tsx scripts/e2e-test-suite.ts`) to confirm contract stability.
4. **Status Vocabulary**: Clearly report status using: `IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `NOT IMPLEMENTED`, or `NOT VERIFIED`.

---

## 12. Data Field Change Flow

Adding or modifying an entity field (student, coach, fee, etc.) must follow this fixed 7-step sequence across all layers:

1. **Database Schema**: Add column via a version-controlled migration in `supabase/migrations/`.
2. **DB Mapping Layer**: Update both row→object and object→row mappings in the appropriate domain repository in `server/db/` (e.g., `students.db.ts`, `coaches.db.ts`, `fees.db.ts`).
3. **TypeScript Contract**: Update the shared interface in `src/types/`.
4. **Backend Validation**: Add the field to relevant Zod create/update schemas in `server/routes/`.
5. **Properties Layer**: Define UI labels/options in `src/properties/` (if applicable).
6. **Frontend Form UI**: Wire the input using the shared component (`FormField`) and step 5.
7. **Display Surfaces**: Update only the profiles, tables, or views explicitly intended to show the field.

---

## 13. Backend Modular Architecture Invariant

The backend is strictly modularized across two core tiers:

### A. Express Routing Tier (`server.ts` & `server/routes/`)
- `server.ts` is strictly a bootstrap orchestrator (< 200 lines). It is reserved for global middleware (CORS, cookies, helmet, request logger) and mounting feature routers.
- **Strict Invariant**: NEVER add route handlers (`app.get()`, `app.post()`, etc.) or helper methods directly into `server.ts`.
- All endpoints must reside in their respective domain router under `server/routes/*.routes.ts` (e.g., `students.routes.ts`, `coaches.routes.ts`, `fees.routes.ts`, etc.) or a new domain router.

### B. Database Persistence Tier (`server/db/` & `server/supabaseDb.ts`)
- All database queries, table mappings, and schema mutations must reside in domain repositories under `server/db/*.db.ts`.
- `server/supabaseDb.ts` is strictly a typed aggregator/facade preserving compatibility for `{ db }`.
- **Strict Invariant**: NEVER add query methods directly into `server/supabaseDb.ts`. Always add them to the relevant domain repository in `server/db/` and delegate/re-export via the facade.

---

## 14. Document Hierarchy

When requirements conflict, precedence is:
1. `Security.md` for security, auth, tokens, RLS, and secrets.
2. `Architecture.md` for stack invariants, data contracts, and migrations.
3. `Business_flows.md` for domain workflows and business rules.
4. `mobile.md` for UI and mobile implementation.
5. `error-framework.md` for logging and error handling.
6. `~/.gemini/GEMINI.md` for global engineering principles, verification, and change control.
