-- Scope extractor: add nullable scope column to drafts. Existing rows have
-- NULL — the pipeline treats null as "no scope context" and behaves as before.

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS scope JSONB NULL;
