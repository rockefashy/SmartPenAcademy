-- ============================================================================
-- Migration 012: Add preferred_days TEXT[] to students table
-- Promotes preferredDays from serialized notes JSON to a first-class array column.
-- Normalizes existing records into canonical uppercase codes ('SUN', 'MON', etc.)
-- ============================================================================

-- 1. Add preferred_days column to students table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS preferred_days TEXT[] DEFAULT '{}';

-- 2. Create GIN index for high-performance array operations
CREATE INDEX IF NOT EXISTS idx_students_preferred_days ON public.students USING GIN (preferred_days);

-- 3. Backfill existing preferredDays from notes JSON
DO $$
DECLARE
  r RECORD;
  v_raw TEXT;
  v_days TEXT[];
  v_part TEXT;
  v_upper TEXT;
BEGIN
  FOR r IN 
    SELECT id, notes
    FROM public.students
    WHERE (preferred_days IS NULL OR preferred_days = '{}')
      AND notes IS NOT NULL
      AND notes LIKE '{%'
  LOOP
    BEGIN
      v_raw := (r.notes::jsonb ->> 'preferredDays');
      IF v_raw IS NOT NULL AND TRIM(v_raw) <> '' THEN
        v_days := '{}';
        FOR v_part IN SELECT TRIM(x) FROM regexp_split_to_table(v_raw, '[,&/]|(\band\b)') AS x WHERE TRIM(x) <> '' LOOP
          v_upper := UPPER(v_part);
          IF v_upper LIKE 'SUN%' THEN v_days := array_append(v_days, 'SUN');
          ELSIF v_upper LIKE 'MON%' THEN v_days := array_append(v_days, 'MON');
          ELSIF v_upper LIKE 'TUE%' THEN v_days := array_append(v_days, 'TUE');
          ELSIF v_upper LIKE 'WED%' THEN v_days := array_append(v_days, 'WED');
          ELSIF v_upper LIKE 'THU%' THEN v_days := array_append(v_days, 'THU');
          ELSIF v_upper LIKE 'FRI%' THEN v_days := array_append(v_days, 'FRI');
          ELSIF v_upper LIKE 'SAT%' THEN v_days := array_append(v_days, 'SAT');
          END IF;
        END LOOP;

        IF array_length(v_days, 1) > 0 THEN
          SELECT ARRAY(SELECT DISTINCT unnest(v_days)) INTO v_days;
          UPDATE public.students SET preferred_days = v_days WHERE id = r.id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 4. Update get_all_students_search function to return preferred_days
DROP FUNCTION IF EXISTS public.get_all_students_search(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_all_students_search(
  p_query TEXT DEFAULT NULL,
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  student_id TEXT,
  user_id TEXT,
  coach_id TEXT,
  parent_name TEXT,
  age INTEGER,
  grade TEXT,
  school_name TEXT,
  mode_of_learning TEXT,
  status TEXT,
  enrollment_date DATE,
  total_classes INTEGER,
  attended_classes INTEGER,
  notes TEXT,
  avatar_url TEXT,
  diagnostic_observations JSONB,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  preferred_slot TEXT,
  preferred_days TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  coach_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean TEXT;
  v_term TEXT;
BEGIN
  v_clean := TRIM(COALESCE(p_query, ''));
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 1000);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  IF v_clean = '' THEN
    RETURN QUERY
    SELECT 
      s.id AS student_id,
      s.user_id,
      s.coach_id,
      s.parent_name,
      s.age,
      s.grade,
      s.school_name,
      s.mode_of_learning,
      s.status,
      s.enrollment_date,
      s.total_classes,
      s.attended_classes,
      s.notes,
      COALESCE(s.avatar_url, u.avatar_url) AS avatar_url,
      s.diagnostic_observations,
      s.emergency_contact_name,
      s.emergency_contact_phone,
      s.preferred_slot,
      s.preferred_days,
      s.created_at,
      s.updated_at,
      COALESCE(u.first_name, '') AS first_name,
      COALESCE(u.last_name, '') AS last_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.phone, s.emergency_contact_phone, '') AS phone,
      TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')) AS coach_name
    FROM public.students s
    LEFT JOIN public.users u ON s.user_id = u.id
    LEFT JOIN public.coaches c ON s.coach_id = c.id
    LEFT JOIN public.users cu ON c.user_id = cu.id
    ORDER BY s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;

  ELSE
    v_term := '%' || v_clean || '%';

    RETURN QUERY
    SELECT 
      s.id AS student_id,
      s.user_id,
      s.coach_id,
      s.parent_name,
      s.age,
      s.grade,
      s.school_name,
      s.mode_of_learning,
      s.status,
      s.enrollment_date,
      s.total_classes,
      s.attended_classes,
      s.notes,
      COALESCE(s.avatar_url, u.avatar_url) AS avatar_url,
      s.diagnostic_observations,
      s.emergency_contact_name,
      s.emergency_contact_phone,
      s.preferred_slot,
      s.preferred_days,
      s.created_at,
      s.updated_at,
      COALESCE(u.first_name, '') AS first_name,
      COALESCE(u.last_name, '') AS last_name,
      COALESCE(u.email, '') AS email,
      COALESCE(u.phone, s.emergency_contact_phone, '') AS phone,
      TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')) AS coach_name
    FROM public.students s
    LEFT JOIN public.users u ON s.user_id = u.id
    LEFT JOIN public.coaches c ON s.coach_id = c.id
    LEFT JOIN public.users cu ON c.user_id = cu.id
    WHERE 
      s.id ILIKE (v_clean || '%')
      OR u.first_name ILIKE v_term
      OR u.last_name ILIKE v_term
      OR TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) ILIKE v_term
      OR s.parent_name ILIKE v_term
      OR s.emergency_contact_name ILIKE v_term
      OR TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')) ILIKE v_term
    ORDER BY
      CASE 
        WHEN LOWER(s.id) = LOWER(v_clean) THEN 1
        WHEN LOWER(u.first_name) = LOWER(v_clean) THEN 2
        WHEN LOWER(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))) = LOWER(v_clean) THEN 3
        WHEN u.first_name ILIKE (v_clean || '%') THEN 4
        ELSE 5
      END,
      s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_all_students_search(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_students_search(TEXT, INT, INT) TO authenticated, service_role;
