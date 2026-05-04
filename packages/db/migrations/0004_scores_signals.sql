-- Add signals column to scores table so the lead-detail panel can
-- display the scoring rationale pills. The column is jsonb (string[])
-- and nullable so existing rows don't break.
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS signals jsonb;
