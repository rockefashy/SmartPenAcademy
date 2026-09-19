-- ============================================================================
-- Migration 016: Add media_consent Column to Testimonials Table
-- Smart Pen Academy - Privacy & DPDP Compliance
-- ============================================================================

ALTER TABLE public.testimonials 
ADD COLUMN IF NOT EXISTS media_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.testimonials.media_consent IS 'Explicit opt-in parental consent for minor photo and review publishing';

NOTIFY pgrst, 'reload schema';
