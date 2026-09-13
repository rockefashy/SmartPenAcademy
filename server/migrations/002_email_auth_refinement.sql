-- Migration: 002_email_auth_refinement.sql
-- Description: Refine authentication identifier resolution to match users by email (with future phone support), removing Student ID login matching.

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
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_by_identifier(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_by_identifier(text) TO authenticated, service_role, postgres;
