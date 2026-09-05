-- ============================================================================
-- SMART PEN ACADEMY - ARCHITECTURAL MIGRATION: IDENTITY-FIRST SCHEMA
-- Migration: Add user_id to coaches & students, backfill from users,
--            update RPCs & RLS, and remove coach_id & student_id from users.
-- ============================================================================

-- Step 1: Add user_id to public.coaches
ALTER TABLE public.coaches 
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 2: Add user_id to public.students
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- Step 3: Backfill user_id on coaches from existing users.coach_id linkage
UPDATE public.coaches c
SET user_id = u.id
FROM public.users u
WHERE u.coach_id = c.id
  AND c.user_id IS NULL;

-- Step 4: Backfill user_id on students from existing users.student_id linkage
UPDATE public.students s
SET user_id = u.id
FROM public.users u
WHERE u.student_id = s.id
  AND s.user_id IS NULL;

-- Step 5: Create indexes on the new foreign keys
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON public.coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Step 6: Update public.users email uniqueness constraint to composite
-- (Allowing siblings to share parent contact email with unique first + last name)
DROP INDEX IF EXISTS public.idx_users_email_lower;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_email_unique 
  ON public.users(LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), LOWER(TRIM(email)));

-- Step 7: Update RPC - get_auth_user_by_identifier
-- Resolves user by email, phone, or student profile lookup
DROP FUNCTION IF EXISTS public.get_auth_user_by_identifier(text);
CREATE OR REPLACE FUNCTION public.get_auth_user_by_identifier(p_identifier text)
RETURNS TABLE (
  id text,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text,
  avatar_url text,
  is_active boolean,
  password_hash text,
  token_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_identifier IS NULL OR length(trim(p_identifier)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.role,
    u.avatar_url,
    u.is_active,
    u.password_hash,
    u.token_version
  FROM public.users u
  WHERE u.is_active = true
    AND (
      LOWER(u.email) = LOWER(trim(p_identifier))
      OR u.phone = trim(p_identifier)
      OR u.id IN (
        SELECT s.user_id FROM public.students s WHERE LOWER(s.id) = LOWER(trim(p_identifier)) AND s.user_id IS NOT NULL
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_by_identifier(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_identifier(text) TO authenticated, service_role, postgres;

-- Step 8: Update RPC - set_request_context
DROP FUNCTION IF EXISTS public.set_request_context(text, text, text, text);
DROP FUNCTION IF EXISTS public.set_request_context(text, text);
CREATE OR REPLACE FUNCTION public.set_request_context(
  p_user_id text,
  p_role text,
  p_coach_id text DEFAULT '',
  p_student_id text DEFAULT ''
) RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_coach_id text := p_coach_id;
  v_student_id text := p_student_id;
BEGIN
  IF p_role NOT IN ('admin', 'coach', 'student') THEN
    RAISE EXCEPTION 'Invalid application role: %', p_role USING ERRCODE = '28000';
  END IF;

  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'User ID cannot be null or empty' USING ERRCODE = '28000';
  END IF;

  -- Auto-resolve coach_id or student_id if not explicitly provided
  IF p_role = 'coach' AND (v_coach_id IS NULL OR length(trim(v_coach_id)) = 0) THEN
    SELECT id INTO v_coach_id FROM public.coaches WHERE user_id = p_user_id LIMIT 1;
  END IF;

  IF p_role = 'student' AND (v_student_id IS NULL OR length(trim(v_student_id)) = 0) THEN
    SELECT id INTO v_student_id FROM public.students WHERE user_id = p_user_id LIMIT 1;
  END IF;

  PERFORM set_config('app.current_user_id', p_user_id, true);
  PERFORM set_config('app.current_user_role', p_role, true);
  PERFORM set_config('app.current_user_coach_id', COALESCE(v_coach_id, ''), true);
  PERFORM set_config('app.current_user_student_id', COALESCE(v_student_id, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_request_context(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_request_context(text, text, text, text) TO authenticated, service_role, postgres;

-- Step 9: Update RLS Policies for students & coaches using user_id (with backward compatibility)
DROP POLICY IF EXISTS rls_students_self_select ON public.students;
CREATE POLICY rls_students_self_select ON public.students
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'student'
    AND (
      user_id = current_setting('app.current_user_id', true)
      OR id = current_setting('app.current_user_student_id', true)
    )
  );

DROP POLICY IF EXISTS rls_coaches_self_select ON public.coaches;
CREATE POLICY rls_coaches_self_select ON public.coaches
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'coach'
    AND (
      user_id = current_setting('app.current_user_id', true)
      OR id = current_setting('app.current_user_coach_id', true)
    )
  );

-- Step 10: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
