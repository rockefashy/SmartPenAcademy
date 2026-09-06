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
