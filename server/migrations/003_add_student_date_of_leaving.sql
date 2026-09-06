-- ==========================================================
-- 003_add_student_date_of_leaving.sql
-- Add date_of_leaving column to public.students table
-- Safe and idempotent
-- ==========================================================

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS date_of_leaving DATE;

COMMENT ON COLUMN public.students.date_of_leaving IS 'Date when the student left or was deactivated from the academy';
