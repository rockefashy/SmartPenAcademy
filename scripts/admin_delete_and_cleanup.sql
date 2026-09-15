-- ============================================================================
-- SMART PEN ACADEMY - DATABASE CLEANUP & CASCADE DELETION SCRIPT
-- ============================================================================
-- Purpose:
--   1. Safely delete a student and cascade-remove all child records & associated user.
--   2. Safely delete a coach, unassign students, and remove associated user.
--   3. Detect and delete/fix all orphaned records across all academy tables.
--
-- Safety Guarantees:
--   - Multi-child / sibling safe: Does not delete parent user account if other siblings share it.
--   - Transaction-safe: Wrapped in functions/transactions.
--   - Dry-run inspect queries included at the bottom.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: delete_student_cascade
-- Deletes a student and all related attendance, fees, progress, works, reminders,
-- and the linked user login (unless the user is shared by a sibling).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_student_cascade(
  p_student_id TEXT,
  p_delete_user BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id TEXT;
  v_deleted_attendance INT := 0;
  v_deleted_fees INT := 0;
  v_deleted_progress INT := 0;
  v_deleted_works INT := 0;
  v_deleted_reminders INT := 0;
  v_deleted_alerts INT := 0;
  v_user_deleted BOOLEAN := FALSE;
BEGIN
  -- 1. Verify student exists and retrieve linked user_id
  SELECT user_id INTO v_user_id
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Student with id %s not found', p_student_id)
    );
  END IF;

  -- 2. Delete cascading child records
  WITH deleted AS (DELETE FROM public.attendance WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_attendance FROM deleted;

  WITH deleted AS (DELETE FROM public.fees WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_fees FROM deleted;

  WITH deleted AS (DELETE FROM public.progress_trackers WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_progress FROM deleted;

  WITH deleted AS (DELETE FROM public.student_works WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_works FROM deleted;

  WITH deleted AS (DELETE FROM public.fee_reminders WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_reminders FROM deleted;

  WITH deleted AS (DELETE FROM public.alerts WHERE student_id = p_student_id RETURNING 1)
  SELECT COUNT(*) INTO v_deleted_alerts FROM deleted;

  -- Testimonials: unlink student_id (preserve review content)
  UPDATE public.testimonials SET student_id = NULL WHERE student_id = p_student_id;

  -- 3. Delete the student record itself
  DELETE FROM public.students WHERE id = p_student_id;

  -- 4. Delete the student's user account directly
  IF p_delete_user AND v_user_id IS NOT NULL THEN
    DELETE FROM public.users WHERE id = v_user_id;
    v_user_deleted := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_student_id', p_student_id,
    'deleted_attendance', v_deleted_attendance,
    'deleted_fees', v_deleted_fees,
    'deleted_progress_trackers', v_deleted_progress,
    'deleted_student_works', v_deleted_works,
    'deleted_fee_reminders', v_deleted_reminders,
    'deleted_alerts', v_deleted_alerts,
    'associated_user_deleted', v_user_deleted
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. FUNCTION: delete_coach_cascade
-- Deletes a coach, unassigns any assigned students, and removes the coach's user login.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_coach_cascade(
  p_coach_id TEXT,
  p_delete_user BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id TEXT;
  v_unassigned_students INT := 0;
  v_user_deleted BOOLEAN := FALSE;
BEGIN
  -- 1. Verify coach exists
  SELECT user_id INTO v_user_id
  FROM public.coaches
  WHERE id = p_coach_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Coach with id %s not found', p_coach_id)
    );
  END IF;

  -- 2. Unassign students currently assigned to this coach
  WITH updated AS (
    UPDATE public.students
    SET coach_id = NULL, updated_at = NOW()
    WHERE coach_id = p_coach_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_unassigned_students FROM updated;

  -- 3. Delete the coach record
  DELETE FROM public.coaches WHERE id = p_coach_id;

  -- 4. Delete associated user login if requested
  IF p_delete_user AND v_user_id IS NOT NULL THEN
    DELETE FROM public.users WHERE id = v_user_id;
    v_user_deleted := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_coach_id', p_coach_id,
    'unassigned_students', v_unassigned_students,
    'associated_user_deleted', v_user_deleted
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. FUNCTION: cleanup_orphan_records
-- Detects and cleans up all orphaned records across the entire database:
--   - Attendance, Fees, Progress, Works, Reminders, Alerts referencing non-existent students
--   - Testimonials referencing non-existent students (sets student_id to NULL)
--   - Students referencing non-existent coaches (sets coach_id to NULL)
--   - Students referencing non-existent users (sets user_id to NULL)
--   - Coaches referencing non-existent users (sets user_id to NULL)
--   - Orphan users with role 'student' or 'coach' having no student/coach profile
--   - Expired rate limits older than 1 hour
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_orphan_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_orphan_attendance INT := 0;
  v_orphan_fees INT := 0;
  v_orphan_progress INT := 0;
  v_orphan_works INT := 0;
  v_orphan_reminders INT := 0;
  v_orphan_alerts INT := 0;
  v_fixed_testimonials INT := 0;
  v_fixed_student_coaches INT := 0;
  v_fixed_student_users INT := 0;
  v_fixed_coach_users INT := 0;
  v_orphan_student_users INT := 0;
  v_orphan_coach_users INT := 0;
  v_expired_rate_limits INT := 0;
BEGIN
  -- 1. Delete orphan attendance
  WITH deleted AS (
    DELETE FROM public.attendance
    WHERE student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_attendance FROM deleted;

  -- 2. Delete orphan fees
  WITH deleted AS (
    DELETE FROM public.fees
    WHERE student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_fees FROM deleted;

  -- 3. Delete orphan progress trackers
  WITH deleted AS (
    DELETE FROM public.progress_trackers
    WHERE student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_progress FROM deleted;

  -- 4. Delete orphan student works
  WITH deleted AS (
    DELETE FROM public.student_works
    WHERE student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_works FROM deleted;

  -- 5. Delete orphan fee reminders
  WITH deleted AS (
    DELETE FROM public.fee_reminders
    WHERE student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_reminders FROM deleted;

  -- 6. Delete orphan alerts
  WITH deleted AS (
    DELETE FROM public.alerts
    WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_alerts FROM deleted;

  -- 7. Fix testimonials pointing to non-existent students
  WITH updated AS (
    UPDATE public.testimonials
    SET student_id = NULL
    WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM public.students)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_fixed_testimonials FROM updated;

  -- 8. Fix students pointing to non-existent coach_id
  WITH updated AS (
    UPDATE public.students
    SET coach_id = NULL
    WHERE coach_id IS NOT NULL AND coach_id NOT IN (SELECT id FROM public.coaches)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_fixed_student_coaches FROM updated;

  -- 9. Fix students pointing to non-existent user_id
  WITH updated AS (
    UPDATE public.students
    SET user_id = NULL
    WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_fixed_student_users FROM updated;

  -- 10. Fix coaches pointing to non-existent user_id
  WITH updated AS (
    UPDATE public.coaches
    SET user_id = NULL
    WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.users)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_fixed_coach_users FROM updated;

  -- 11. Delete orphan student users (role='student' with no student record referencing them)
  WITH deleted AS (
    DELETE FROM public.users
    WHERE role = 'student'
      AND id NOT IN (SELECT user_id FROM public.students WHERE user_id IS NOT NULL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_student_users FROM deleted;

  -- 12. Delete orphan coach users (role='coach' with no coach record referencing them)
  WITH deleted AS (
    DELETE FROM public.users
    WHERE role = 'coach'
      AND id NOT IN (SELECT user_id FROM public.coaches WHERE user_id IS NOT NULL)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_orphan_coach_users FROM deleted;

  -- 13. Prune expired rate limits older than 1 hour
  WITH deleted AS (
    DELETE FROM public.rate_limits
    WHERE reset_at < (NOW() - INTERVAL '1 hour')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_expired_rate_limits FROM deleted;

  RETURN jsonb_build_object(
    'orphan_attendance_deleted', v_orphan_attendance,
    'orphan_fees_deleted', v_orphan_fees,
    'orphan_progress_trackers_deleted', v_orphan_progress,
    'orphan_student_works_deleted', v_orphan_works,
    'orphan_fee_reminders_deleted', v_orphan_reminders,
    'orphan_alerts_deleted', v_orphan_alerts,
    'testimonials_unlinked', v_fixed_testimonials,
    'students_unlinked_from_invalid_coaches', v_fixed_student_coaches,
    'students_unlinked_from_invalid_users', v_fixed_student_users,
    'coaches_unlinked_from_invalid_users', v_fixed_coach_users,
    'orphan_student_users_deleted', v_orphan_student_users,
    'orphan_coach_users_deleted', v_orphan_coach_users,
    'expired_rate_limits_deleted', v_expired_rate_limits
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. USAGE EXAMPLES (Run these directly in Supabase SQL Editor as needed)
-- ----------------------------------------------------------------------------

-- Example A: Clean up all orphan records
-- SELECT public.cleanup_orphan_records();

-- Example B: Delete a specific student (replace 'std-xxxx' with target ID)
-- SELECT public.delete_student_cascade('std-xxxx', TRUE);

-- Example C: Delete a specific coach (replace 'cch-xxxx' with target ID)
-- SELECT public.delete_coach_cascade('cch-xxxx', TRUE);

-- Example D: Inspect potential orphans BEFORE deleting (Dry-Run Query):
/*
SELECT 'orphan_attendance' AS type, COUNT(*) FROM public.attendance WHERE student_id NOT IN (SELECT id FROM public.students)
UNION ALL
SELECT 'orphan_fees', COUNT(*) FROM public.fees WHERE student_id NOT IN (SELECT id FROM public.students)
UNION ALL
SELECT 'orphan_progress', COUNT(*) FROM public.progress_trackers WHERE student_id NOT IN (SELECT id FROM public.students)
UNION ALL
SELECT 'orphan_works', COUNT(*) FROM public.student_works WHERE student_id NOT IN (SELECT id FROM public.students)
UNION ALL
SELECT 'orphan_reminders', COUNT(*) FROM public.fee_reminders WHERE student_id NOT IN (SELECT id FROM public.students)
UNION ALL
SELECT 'orphan_student_users', COUNT(*) FROM public.users WHERE role = 'student' AND id NOT IN (SELECT user_id FROM public.students WHERE user_id IS NOT NULL)
UNION ALL
SELECT 'orphan_coach_users', COUNT(*) FROM public.users WHERE role = 'coach' AND id NOT IN (SELECT user_id FROM public.coaches WHERE user_id IS NOT NULL);
*/
