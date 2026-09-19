-- ============================================================================
-- Migration 015: Lockdown Supabase Anon/Authenticated RPC and Table Privileges
-- Smart Pen Academy - Defense-in-Depth Security Hardening
-- ============================================================================

-- 1. Revoke EXECUTE on all functions in schema public from anon, authenticated, and PUBLIC
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- 2. Grant EXECUTE strictly to trusted backend roles (service_role, postgres)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role, postgres;

-- 3. Update default privileges so any future functions do not auto-grant execute to anon or authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role, postgres;

-- 4. Drop leaky public policy on coaches (which allowed anon to read address, emergency contacts, notes)
DROP POLICY IF EXISTS rls_coaches_active_select ON public.coaches;

-- 5. Ensure RLS is explicitly enabled on all tables in public schema
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.progress_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.demo_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tool_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 6. Reload PostgREST API schema cache
NOTIFY pgrst, 'reload schema';
