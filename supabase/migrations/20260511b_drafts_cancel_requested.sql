-- Add the missing `cancel_requested` column to drafts. The TypeScript
-- DraftRow type and the SSE routes have referenced this column since Phase 3,
-- but it was apparently never persisted to the live Supabase schema (cancel
-- polling has a silent catch so SELECT failures went unnoticed).
--
-- Apply via Supabase dashboard SQL editor.

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;
