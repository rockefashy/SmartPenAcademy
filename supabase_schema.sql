-- ==========================================================
-- SMARTPEN ACADEMY - SUPABASE POSTGRESQL SCHEMA & MIGRATION
-- Safe, idempotent script for both fresh setup and existing databases.
-- ==========================================================

-- Enable pgcrypto extension for UUIDs and cryptography
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. COACHES TABLE (Master registry for instructors)
CREATE TABLE IF NOT EXISTS public.coaches (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
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
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure user_id exists on coaches
ALTER TABLE public.coaches ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. STUDENTS TABLE (Master student profiles - created before users for FK resolution)
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER,
  grade TEXT,
  school_name TEXT,
  parent_name TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  date_of_leaving DATE,
  coach_id TEXT REFERENCES public.coaches(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  preferred_slot TEXT,
  total_classes INTEGER DEFAULT 8,
  attended_classes INTEGER DEFAULT 0,
  notes TEXT,
  avatar_url TEXT,
  diagnostic_observations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure coach_id, user_id and newer columns exist on existing students tables
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS coach_id TEXT REFERENCES public.coaches(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS preferred_slot TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_classes INTEGER DEFAULT 8;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS attended_classes INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS diagnostic_observations JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. USERS TABLE (Authentication credentials and role mappings)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'student')),
  avatar_url TEXT,
  password_hash TEXT NOT NULL DEFAULT '',
  reset_password_token TEXT,
  reset_password_expiry BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure newer columns exist on existing users tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reset_password_expiry BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_number INTEGER,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Absent', 'Excused', 'Late')),
  coach_notes TEXT,
  marked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FEES TABLE (8-Class Cycle Ledgers)
CREATE TABLE IF NOT EXISTS public.fees (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  paid_date DATE,
  year_month TEXT,
  milestone TEXT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 1600.00,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  receipt_number TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROGRESS TRACKERS (Milestone evaluations, star metrics & dynamic report source)
CREATE TABLE IF NOT EXISTS public.progress_trackers (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluation_title TEXT NOT NULL,
  evaluation_date DATE DEFAULT CURRENT_DATE,
  overall_remark TEXT,
  teacher_feedback TEXT,
  next_steps TEXT,
  overall_stars INTEGER DEFAULT 0,
  formation_stars INTEGER DEFAULT 0,
  spacing_stars INTEGER DEFAULT 0,
  alignment_stars INTEGER DEFAULT 0,
  speed_stars INTEGER DEFAULT 0,
  grip_posture_stars INTEGER DEFAULT 0,
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

-- Ensure all metrics exist on existing progress_trackers tables
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS evaluation_title TEXT NOT NULL DEFAULT 'Evaluation Milestone';
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS evaluation_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS overall_remark TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS next_steps TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS overall_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS formation_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS spacing_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS alignment_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS speed_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS grip_posture_stars INTEGER DEFAULT 0;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS target_score INTEGER;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS current_score INTEGER;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS speed_wpm INTEGER;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS baseline_speed_wpm INTEGER;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS pressure_level TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS before_image_url TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS after_image_url TEXT;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.progress_trackers ADD COLUMN IF NOT EXISTS is_unlocked BOOLEAN DEFAULT TRUE;

-- 7. STUDENT WORKS TABLE (Handwriting samples and camera snapshots)
CREATE TABLE IF NOT EXISTS public.student_works (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title TEXT,
  work_type TEXT,
  file_url TEXT,
  submitted_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Reviewed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FEE REMINDERS TABLE
CREATE TABLE IF NOT EXISTS public.fee_reminders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  due_date TEXT,
  status TEXT DEFAULT 'Sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DEMO BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.demo_bookings (
  id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_age INTEGER NOT NULL,
  parent_name TEXT,
  parent_phone TEXT NOT NULL,
  preferred_date DATE,
  preferred_time_slot TEXT,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Scheduled', 'Completed', 'Enrolled', 'Cancelled')),
  coach_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  alert_type TEXT,
  target_audience TEXT DEFAULT 'admin',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TESTIMONIALS TABLE
CREATE TABLE IF NOT EXISTS public.testimonials (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  parent_name TEXT,
  grade TEXT,
  rating INTEGER DEFAULT 5,
  review TEXT NOT NULL,
  title TEXT,
  handwriting_style TEXT,
  status TEXT DEFAULT 'Published' CHECK (status IN ('Published', 'Pending', 'Archived')),
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TOOL AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.tool_audit_logs (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  user_id TEXT,
  user_role TEXT,
  actor_student_id TEXT,
  action_summary TEXT,
  arguments JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'success',
  execution_mode TEXT DEFAULT 'direct_api',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_coaches_user_id ON public.coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_coaches_status ON public.coaches(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_students_coach_id ON public.students(coach_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_trackers_student_id ON public.progress_trackers(student_id);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_created_at ON public.demo_bookings(created_at DESC);

-- Reload PostgREST schema cache to ensure all newly added columns are instantly recognized
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
