-- Agent-lab port: rename `questions` JSONB column to `topics`, add `researching`
-- and `researched` to the status CHECK, and backfill new per-topic JSONB
-- fields on existing rows.

-- 1. Rename column.
ALTER TABLE drafts RENAME COLUMN questions TO topics;

-- 2. Drop any existing CHECK constraint on `status`, then add the new one.
--    (No-ops cleanly if no CHECK exists.)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'drafts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE drafts DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE drafts
  ADD CONSTRAINT drafts_status_check CHECK (
    status IN (
      'parsed',
      'researching',
      'researched',
      'drafting',
      'ready',
      'in_review',
      'approved'
    )
  );

-- 3. Backfill missing per-topic JSONB fields on existing rows so TS reads
--    don't encounter undefined values.
UPDATE drafts
SET topics = (
  SELECT jsonb_agg(
    t || jsonb_build_object(
      'plan',             COALESCE(t->'plan',             '[]'::jsonb),
      'research',         COALESCE(t->'research',         '[]'::jsonb),
      'capability_map',   COALESCE(t->'capability_map',   'null'::jsonb),
      'feedback_history', COALESCE(t->'feedback_history', '[]'::jsonb)
    )
  )
  FROM jsonb_array_elements(topics) t
)
WHERE topics IS NOT NULL;
