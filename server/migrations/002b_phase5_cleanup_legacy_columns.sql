-- ============================================================================
-- SMART PEN ACADEMY - ARCHITECTURAL MIGRATION: PHASE 5 CLEANUP
-- Drop legacy users.coach_id and users.student_id columns after verification
-- ============================================================================

-- Step 1: Drop indexes on legacy columns
DROP INDEX IF EXISTS public.idx_users_student_id;
DROP INDEX IF EXISTS public.idx_users_coach_id;

-- Step 2: Drop legacy foreign key columns from users
ALTER TABLE public.users DROP COLUMN IF EXISTS student_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS coach_id;

-- Step 3: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
