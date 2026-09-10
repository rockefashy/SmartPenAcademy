-- ============================================================================
-- SMART PEN ACADEMY - ARCHITECTURAL MIGRATION: PHASE 4 SCHEMA CLEANUP
-- 006_tool_audit_logs_actor_username.sql
-- 
-- 1. Ensure orphaned ghost tables are dropped: fee_records, evaluation_reports, batches
-- 2. Add missing actor_username column to public.tool_audit_logs
-- 3. Reload PostgREST schema cache
-- Fully guarded & idempotent
-- ============================================================================

-- 1. ENSURE ORPHANED TABLES ARE DROPPED
DROP TABLE IF EXISTS public.fee_records CASCADE;
DROP TABLE IF EXISTS public.evaluation_reports CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;

-- 2. ADD MISSING ACTOR_USERNAME COLUMN TO TOOL_AUDIT_LOGS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tool_audit_logs' AND column_name = 'actor_username'
  ) THEN
    ALTER TABLE public.tool_audit_logs ADD COLUMN actor_username text;
  END IF;
END $$;

-- 3. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
