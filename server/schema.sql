-- ============================================================================
-- SMART PEN ACADEMY - PRODUCTION POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS)
-- Defense-in-Depth Architecture: Transaction-Scoped Context + Granular Policies
-- Canonical Single Source of Truth for Database Schema, Indexes, RPCs & RLS
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. MASTER PROFILES: COACHES
-- Master registry for academy coaches & founder
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coaches (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  date_of_joining DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  date_of_leaving DATE,
  educational_qualification TEXT,
  designation TEXT DEFAULT 'Principal Coach',
  specializations TEXT[] DEFAULT ARRAY['Cursive Writing', 'Speed Enhancement', 'Print Script Mastery'],
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. ACADEMIC PROFILES: STUDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  grade TEXT,
  school_name TEXT,
  parent_name TEXT NOT NULL,
  mode_of_learning TEXT DEFAULT 'In-person',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  coach_id TEXT REFERENCES public.coaches(id) ON DELETE SET NULL,
  preferred_slot TEXT,
  total_classes INTEGER DEFAULT 8,
  attended_classes INTEGER DEFAULT 0,
  notes TEXT,
  avatar_url TEXT,
  diagnostic_observations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. CORE IDENTITY & AUTH: USERS
-- Single Source of Truth for Express JWT Authentication & Portal RBAC
-- Passwords must be hashed using bcrypt; never plaintext
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'student')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL DEFAULT '',
  reset_password_token TEXT,
  reset_password_expiry BIGINT,
  token_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 6. DEMO BOOKINGS (Free Demo Sessions 4:00 PM – 7:00 PM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.demo_bookings (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_age INTEGER NOT NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  preferred_date DATE NOT NULL,
  preferred_time_slot TEXT NOT NULL,
  parent_notes TEXT,
  coach_notes TEXT,
  mode_of_learning TEXT DEFAULT 'In-person',
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Scheduled', 'Completed', 'Enrolled', 'Cancelled', 'Pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. ATTENDANCE (8-Class Cycle Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_number INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Excused', 'Late')),
  topic_covered TEXT,
  duration_minutes INTEGER DEFAULT 60,
  coach_notes TEXT,
  marked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. FEES (₹1,600 / 8-Class Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fees (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  paid_date DATE,
  year_month TEXT NOT NULL,
  milestone TEXT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 1600.00,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  receipt_number TEXT,
  payment_method TEXT,
  notes TEXT,
  gpay_utr_ref TEXT,
  screenshot_url TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. FEE REMINDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fee_reminders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  due_date TEXT,
  amount_due NUMERIC(10, 2) DEFAULT 1600.00,
  status TEXT DEFAULT 'Sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. PROGRESS TRACKERS & MILESTONES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.progress_trackers (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluation_title TEXT NOT NULL,
  evaluation_date DATE DEFAULT CURRENT_DATE,
  overall_remark TEXT,
  teacher_feedback TEXT,
  next_steps TEXT,
  overall_stars INTEGER DEFAULT 5,
  formation_stars INTEGER DEFAULT 5,
  spacing_stars INTEGER DEFAULT 5,
  alignment_stars INTEGER DEFAULT 5,
  speed_stars INTEGER DEFAULT 5,
  grip_posture_stars INTEGER DEFAULT 5,
  target_score INTEGER,
  current_score INTEGER,
  speed_wpm INTEGER,
  baseline_speed_wpm INTEGER,
  pressure_level TEXT,
  before_image_url TEXT,
  after_image_url TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  is_unlocked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. STUDENT WORKS (Handwriting samples and camera snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_works (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  work_type TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  submitted_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Pending',
  score INTEGER,
  coach_annotation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 12. TESTIMONIALS & PARENT VOICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.testimonials (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  grade TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  review TEXT,
  title TEXT,
  handwriting_style TEXT,
  status TEXT DEFAULT 'Published' CHECK (status IN ('Published', 'Pending', 'Archived', 'Featured', 'Approved')),
  image TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  verified_student BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 13. SYSTEM ALERTS & NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id TEXT PRIMARY KEY,
  target_audience TEXT DEFAULT 'admin',
  student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  alert_type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 14. AUDIT LOGS (Security & Mutation Auditing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tool_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_role TEXT,
  actor_student_id TEXT,
  tool_name TEXT NOT NULL,
  action_summary TEXT NOT NULL,
  arguments JSONB DEFAULT '{}'::jsonb,
  input_payload JSONB,
  result JSONB DEFAULT '{}'::jsonb,
  output_result JSONB,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  duration_ms INTEGER,
  execution_mode TEXT DEFAULT 'direct_api',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 15. INDEXES FOR HIGH-PERFORMANCE DATA ACCESS
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_email_unique ON public.users(LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), LOWER(TRIM(email)));
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON public.coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_coaches_status ON public.coaches(status);
CREATE INDEX IF NOT EXISTS idx_students_coach_id ON public.students(coach_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fees_student_year_month ON public.fees(student_id, year_month);
CREATE INDEX IF NOT EXISTS idx_fees_status ON public.fees(status);
CREATE INDEX IF NOT EXISTS idx_progress_student_date ON public.progress_trackers(student_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_works_student ON public.student_works(student_id, submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_created ON public.demo_bookings(created_at DESC);

-- ============================================================================
-- 16. HARDENED SECURITY DEFINER CONTEXT & AUTH RPCs
-- ============================================================================

-- Sets transaction-local configuration for PostgreSQL RLS evaluation
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
  -- Strict Parameter Validation
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

  -- Transaction-local session configuration (is_local = true prevents leakage in pooled connections)
  PERFORM set_config('app.current_user_id', p_user_id, true);
  PERFORM set_config('app.current_user_role', p_role, true);
  PERFORM set_config('app.current_user_coach_id', COALESCE(v_coach_id, ''), true);
  PERFORM set_config('app.current_user_student_id', COALESCE(v_student_id, ''), true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_request_context(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_request_context(text, text, text, text) TO authenticated, service_role, postgres;

-- Narrowly Scoped Privileged Backend Authentication Path (Pre-Authentication)
-- Allows backend authentication to resolve candidate login credentials safely
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

-- ============================================================================
-- 17. PUBLIC COACH VIEW REMOVED
-- Coaches are strictly private to the academy.

-- 18. ROW LEVEL SECURITY (RLS) POLICIES
-- Defense-in-Depth: Users, Coaches, Students, Attendance, Fees, Progress, Works
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_works ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- USERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_users_admin ON public.users;
CREATE POLICY rls_users_admin ON public.users
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_users_self_select ON public.users;
CREATE POLICY rls_users_self_select ON public.users
  FOR SELECT
  USING (id = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS rls_users_self_update ON public.users;
CREATE POLICY rls_users_self_update ON public.users
  FOR UPDATE
  USING (
    id = current_setting('app.current_user_id', true)
    AND current_setting('app.current_user_role', true) != 'coach'
  )
  WITH CHECK (
    id = current_setting('app.current_user_id', true)
    AND role = current_setting('app.current_user_role', true)
    AND current_setting('app.current_user_role', true) != 'coach'
  );

-- ----------------------------------------------------------------------------
-- COACHES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_coaches_admin ON public.coaches;
CREATE POLICY rls_coaches_admin ON public.coaches
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

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

DROP POLICY IF EXISTS rls_coaches_self_update ON public.coaches;

DROP POLICY IF EXISTS rls_coaches_active_select ON public.coaches;
CREATE POLICY rls_coaches_active_select ON public.coaches
  FOR SELECT
  USING (status = 'Active');

-- ----------------------------------------------------------------------------
-- STUDENTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_students_admin ON public.students;
CREATE POLICY rls_students_admin ON public.students
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_students_coach_select ON public.students;
CREATE POLICY rls_students_coach_select ON public.students
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'coach'
    AND (
      coach_id = current_setting('app.current_user_coach_id', true)
      OR coach_id = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS rls_students_coach_update ON public.students;
CREATE POLICY rls_students_coach_update ON public.students
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) = 'coach'
    AND (
      coach_id = current_setting('app.current_user_coach_id', true)
      OR coach_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'coach'
    AND (
      coach_id = current_setting('app.current_user_coach_id', true)
      OR coach_id = current_setting('app.current_user_id', true)
    )
  );

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

-- ----------------------------------------------------------------------------
-- ATTENDANCE POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_attendance_admin ON public.attendance;
CREATE POLICY rls_attendance_admin ON public.attendance
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_attendance_coach_select ON public.attendance;
CREATE POLICY rls_attendance_coach_select ON public.attendance
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'coach'
    AND student_id IN (
      SELECT id FROM public.students WHERE coach_id = current_setting('app.current_user_coach_id', true)
    )
  );

DROP POLICY IF EXISTS rls_attendance_coach_insert ON public.attendance;
CREATE POLICY rls_attendance_coach_insert ON public.attendance
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'coach'
    AND student_id IN (
      SELECT id FROM public.students WHERE coach_id = current_setting('app.current_user_coach_id', true)
    )
  );

DROP POLICY IF EXISTS rls_attendance_student_select ON public.attendance;
CREATE POLICY rls_attendance_student_select ON public.attendance
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'student'
    AND student_id = current_setting('app.current_user_student_id', true)
  );

-- ----------------------------------------------------------------------------
-- FEES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_fees_admin ON public.fees;
CREATE POLICY rls_fees_admin ON public.fees
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_fees_student_select ON public.fees;
CREATE POLICY rls_fees_student_select ON public.fees
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'student'
    AND student_id = current_setting('app.current_user_student_id', true)
  );

-- ----------------------------------------------------------------------------
-- PROGRESS TRACKERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_progress_admin ON public.progress_trackers;
CREATE POLICY rls_progress_admin ON public.progress_trackers
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_progress_coach_select ON public.progress_trackers;
CREATE POLICY rls_progress_coach_select ON public.progress_trackers
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'coach'
    AND student_id IN (
      SELECT id FROM public.students WHERE coach_id = current_setting('app.current_user_coach_id', true)
    )
  );

DROP POLICY IF EXISTS rls_progress_student_select ON public.progress_trackers;
CREATE POLICY rls_progress_student_select ON public.progress_trackers
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'student'
    AND student_id = current_setting('app.current_user_student_id', true)
  );

-- ----------------------------------------------------------------------------
-- STUDENT WORKS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS rls_student_works_admin ON public.student_works;
CREATE POLICY rls_student_works_admin ON public.student_works
  FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS rls_student_works_student_select ON public.student_works;
CREATE POLICY rls_student_works_student_select ON public.student_works
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'student'
    AND student_id = current_setting('app.current_user_student_id', true)
  );

-- ============================================================================
-- 19. INITIAL SEED DATA: BATCHES & PRIMARY ADMINISTRATOR
-- Exactly 2 seedings:
--   1. Initial Batches (Schedule slots 4:00 PM – 7:00 PM)
--   2. One Primary Administrator (Admin Coach)
-- No coaches seeded during bootstrap. Coaches are created dynamically via portal.
-- Default initial password for Administrator: Admin@SmartPen2026
-- ============================================================================


-- 2. Seed Single Initial Administrator Account (password: Admin@SmartPen2026)
INSERT INTO public.users (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  coach_id,
  password_hash,
  is_active
) VALUES 
(
  'usr-admin-001',
  'admin@smartpenacademy.com',
  'Admin',
  'Coach',
  '8861751000',
  'admin',
  NULL,
  -- Precomputed bcrypt hash for 'Admin@SmartPen2026' (cost factor 10)
  '$2b$10$zkgI8pF3UaNpN7Og0Ddit..LiDy99fywIN54BYdvkOGYZY3uuzHqm',
  TRUE
) ON CONFLICT (email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  role = 'admin',
  coach_id = NULL,
  password_hash = EXCLUDED.password_hash,
  is_active = TRUE;

-- Refresh PostgREST API schema cache
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SMART PEN ACADEMY - MIGRATION 004: RATE LIMITS TABLE & ATOMIC RPC
-- Replaces in-memory rate limiting with database-backed persistence
-- Supports atomic check-and-increment, TTL expiration, and auto-cleanup
-- ============================================================================

-- Step 1: Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Index on reset_at for fast expiration queries & pruning
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits (reset_at);

-- Step 3: Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role and postgres can access all rate_limits rows
DROP POLICY IF EXISTS rls_rate_limits_service_role ON public.rate_limits;
CREATE POLICY rls_rate_limits_service_role ON public.rate_limits
  FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

-- Step 4: Create atomic check-and-increment PostgreSQL function
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key TEXT,
  p_max_calls INT,
  p_window_seconds INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_reset_at TIMESTAMPTZ;
  v_count INT;
  v_retry_after INT;
  v_allowed BOOLEAN;
BEGIN
  -- 1. Opportunistic pruning: delete expired buckets older than 1 hour past reset
  DELETE FROM public.rate_limits WHERE reset_at < (v_now - INTERVAL '1 hour');

  -- 2. Atomic UPSERT: initialize new window or increment existing
  INSERT INTO public.rate_limits (key, count, reset_at, created_at)
  VALUES (
    p_key, 
    1, 
    v_now + (p_window_seconds || ' seconds')::INTERVAL, 
    v_now
  )
  ON CONFLICT (key) DO UPDATE
  SET 
    count = CASE 
      WHEN public.rate_limits.reset_at < v_now THEN 1
      ELSE public.rate_limits.count + 1
    END,
    reset_at = CASE 
      WHEN public.rate_limits.reset_at < v_now THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
      ELSE public.rate_limits.reset_at
    END
  RETURNING count, reset_at INTO v_count, v_reset_at;

  -- 3. Evaluate threshold & compute retry-after in seconds
  IF v_count > p_max_calls THEN
    v_allowed := false;
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)))::INT;
    IF v_retry_after < 1 THEN v_retry_after := 1; END IF;
  ELSE
    v_allowed := true;
    v_retry_after := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'count', v_count,
    'retry_after', v_retry_after,
    'reset_at', v_reset_at
  );
END;
$$;

-- Step 5: Grant execute permissions to API clients
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(TEXT, INT, INT) TO authenticated, service_role, postgres;

-- Step 6: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
