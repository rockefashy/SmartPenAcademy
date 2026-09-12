-- ============================================================================
-- Migration 011: Unified Student Query & Search Function
-- Replaces multi-table in-memory Node.js hydration with database-side joins.
-- Handles both full listing (p_query IS NULL) and multi-column fuzzy search.
-- ============================================================================

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
    -- Full student listing with database joins & pagination (Zero in-memory N+1)
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
    -- Multi-column fuzzy ILIKE search with relevance ranking
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
