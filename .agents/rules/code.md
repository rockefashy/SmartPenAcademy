# Database Schema & Structure Directives

1. **Single Source of Truth**:
   - `server/database.types.ts` is the authoritative single source of truth for the database schema.
   - All backend queries, DB mapping layers (`server/supabaseDb.ts`), frontend types (`src/types.ts`), and validations must strictly conform to `server/database.types.ts`.

2. **Database Structure Changes Policy**:
   - If any feature, bugfix, or refactor would necessitate changing the database structure (e.g., adding/removing/altering columns, tables, constraints, enums, or migrations), **PAUSE IMMEDIATELY**.
   - Propose the rationale and exact schema changes to the user, and obtain explicit user approval before proceeding.
