-- ============================================================================
-- SMART PEN ACADEMY - MIGRATION 007: AUDIT LOG EXECUTION MODE CONSTRAINT
-- 007_tool_audit_logs_execution_mode_check.sql
--
-- 1. Adds a named PostgreSQL CHECK constraint to restrict execution_mode to 
--    the authoritative approved values ('remote_gemini', 'local_agent', 'direct_api').
-- 2. Permits NULL explicitly (execution_mode IS NULL OR ...) to preserve the
--    underlying column nullability while strictly forbidding invalid values.
-- 3. Fully guarded & idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'tool_audit_logs_execution_mode_check'
  ) THEN
    ALTER TABLE public.tool_audit_logs
    ADD CONSTRAINT tool_audit_logs_execution_mode_check
    CHECK (
      execution_mode IS NULL OR
      execution_mode IN (
        'remote_gemini',
        'local_agent',
        'direct_api'
      )
    );
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
