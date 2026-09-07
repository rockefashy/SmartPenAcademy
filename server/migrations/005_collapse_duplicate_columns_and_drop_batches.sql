-- ============================================================================
-- SMART PEN ACADEMY - ARCHITECTURAL MIGRATION: PHASE 6 SCHEMA CONSOLIDATION
-- 005_collapse_duplicate_columns_and_drop_batches.sql
-- 
-- 1. Unify fees table on status enum and receipt_number; drop is_paid & receipt_no
-- 2. Unify testimonials on grade and review; drop student_grade & review_text
-- 3. Unify demo_bookings on student_name and student_age; drop child_name & child_age
-- 4. Drop unused ghost table public.batches
-- ============================================================================

-- 1. FEES TABLE CONSOLIDATION
UPDATE public.fees
SET status = 'Paid'
WHERE is_paid = TRUE AND status != 'Paid';

UPDATE public.fees
SET receipt_number = COALESCE(receipt_number, receipt_no)
WHERE receipt_number IS NULL AND receipt_no IS NOT NULL;

ALTER TABLE public.fees DROP COLUMN IF EXISTS is_paid;
ALTER TABLE public.fees DROP COLUMN IF EXISTS receipt_no;

-- 2. TESTIMONIALS TABLE CONSOLIDATION
UPDATE public.testimonials
SET grade = COALESCE(grade, student_grade)
WHERE grade IS NULL AND student_grade IS NOT NULL;

UPDATE public.testimonials
SET review = COALESCE(review, review_text)
WHERE review IS NULL AND review_text IS NOT NULL;

UPDATE public.testimonials
SET image = COALESCE(image, before_image, after_image)
WHERE image IS NULL AND (before_image IS NOT NULL OR after_image IS NOT NULL);

ALTER TABLE public.testimonials DROP COLUMN IF EXISTS student_grade;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS review_text;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS before_image;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS after_image;

-- 3. DEMO BOOKINGS TABLE CONSOLIDATION
UPDATE public.demo_bookings
SET student_name = COALESCE(student_name, child_name)
WHERE (student_name IS NULL OR student_name = '') AND child_name IS NOT NULL;

UPDATE public.demo_bookings
SET student_age = COALESCE(student_age, child_age)
WHERE student_age IS NULL AND child_age IS NOT NULL;

ALTER TABLE public.demo_bookings DROP COLUMN IF EXISTS child_name;
ALTER TABLE public.demo_bookings DROP COLUMN IF EXISTS child_age;

-- 4. DROP GHOST BATCHES TABLE
DROP TABLE IF EXISTS public.batches CASCADE;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
