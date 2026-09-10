-- ============================================================================
-- SMART PEN ACADEMY - MIGRATION 009: ADD 'WAIVED' TO FEE STATUS CONSTRAINT
-- 009_add_waived_to_fee_status.sql
--
-- 1. Drops the existing fees_status_check constraint on public.fees if present.
-- 2. Re-adds fees_status_check to permit 'Waived' alongside 'Paid', 'Pending',
--    and 'Overdue', while allowing NULL for flexibility.
-- 3. Fully guarded, idempotent, and non-destructive to existing fee records.
-- ============================================================================

DO $$
BEGIN
  -- Drop existing status check constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'fees_status_check'
      AND conrelid = 'public.fees'::regclass
  ) THEN
    ALTER TABLE public.fees DROP CONSTRAINT fees_status_check;
  END IF;

  -- Add updated check constraint including 'Waived'
  ALTER TABLE public.fees
    ADD CONSTRAINT fees_status_check
    CHECK (
      status IS NULL OR
      status IN (
        'Paid',
        'Pending',
        'Overdue',
        'Waived'
      )
    );
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
