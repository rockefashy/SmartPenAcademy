-- ============================================================================
-- Migration 014: Add before_after_tag and drop unused handwriting_style
-- Smart Pen Academy
-- ============================================================================

-- 1. Add before_after_tag column to testimonials
ALTER TABLE public.testimonials
ADD COLUMN IF NOT EXISTS before_after_tag TEXT;

-- 2. Drop unused handwriting_style column from testimonials
ALTER TABLE public.testimonials
DROP COLUMN IF EXISTS handwriting_style;

COMMENT ON COLUMN public.testimonials.before_after_tag IS 'Key transformation highlight tag entered or selected by the parent/student';
