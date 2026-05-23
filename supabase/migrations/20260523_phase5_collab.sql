-- Phase 5: collaboration — assignments, comments, reviewer/editor access.
--
-- Widens `drafts` SELECT RLS so assignees can READ a draft they're assigned to.
-- Non-owner WRITES (reviewer approve, editor topic/capability-map edit) are
-- deliberately NOT granted at the RLS layer — RLS is row-level, not
-- column-level, so granting assignees UPDATE on `drafts` would let them mutate
-- any column. Those writes go through server actions that authorize the caller
-- (owner / editor / reviewer) and then execute with the service-role client.
-- RLS here governs reads + the `comments` / `assignments` tables themselves.
--
-- Apply via Supabase dashboard SQL editor (MCP OAuth is broken at time of
-- writing; service-role REST works for reads/writes via @supabase/supabase-js).

-- ── 1. assignee predicate ───────────────────────────────────────────────────
-- SECURITY DEFINER so it bypasses RLS on `assignments` when evaluated inside
-- another table's policy — prevents recursive policy evaluation. Matches by
-- user id OR invited email (an email-invited reviewer has no profile row until
-- they first sign in, but auth.jwt() carries their email immediately).
CREATE OR REPLACE FUNCTION is_draft_assignee(d_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.draft_id = d_id
      AND (
        a.assignee_user_id = auth.uid()
        OR lower(a.assignee_email) = lower(auth.jwt() ->> 'email')
      )
  );
$$;

-- ── 2. drafts: add an assignee SELECT policy ────────────────────────────────
-- Additive — the existing owner-only SELECT policy stays; permissive policies
-- are OR'd, so owner OR assignee can read. UPDATE/DELETE remain owner-only.
DROP POLICY IF EXISTS drafts_select_assignee ON drafts;
CREATE POLICY drafts_select_assignee ON drafts
  FOR SELECT
  USING (is_draft_assignee(id));

-- ── 3. comments: Phase 5 columns ────────────────────────────────────────────
-- The original Phase 4 scaffold already created `author_id uuid NOT NULL`
-- (references auth.users); we reuse it as the comment author rather than adding
-- a parallel column. An earlier draft of this migration mistakenly added a
-- redundant `author_user_id` — drop it if a prior run created it.
-- `anchor_question_index` is kept as-is (legacy name from the questions→topics
-- rename; renaming risks a PostgREST schema-cache stall for cosmetic gain).
--
-- Drop the dependent policies before the column (a prior run may have created
-- them referencing author_user_id; Postgres won't drop a column they depend on).
-- They're recreated against author_id further down.
DROP POLICY IF EXISTS comments_insert ON comments;
DROP POLICY IF EXISTS comments_update ON comments;
DROP POLICY IF EXISTS comments_delete ON comments;

ALTER TABLE comments DROP COLUMN IF EXISTS author_user_id;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS comments_draft_idx
  ON comments(draft_id, anchor_question_index);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = comments.draft_id AND d.owner_id = auth.uid()
    )
    OR is_draft_assignee(comments.draft_id)
  );

DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM drafts d
        WHERE d.id = comments.draft_id AND d.owner_id = auth.uid()
      )
      OR is_draft_assignee(comments.draft_id)
    )
  );

-- Author can edit/resolve their own; draft owner can resolve any.
DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
  FOR UPDATE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = comments.draft_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = comments.draft_id AND d.owner_id = auth.uid()
    )
  );

-- ── 4. assignments: Phase 5 column + RLS ────────────────────────────────────
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS assignments_draft_idx ON assignments(draft_id);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Owner sees all assignments on their draft; an assignee sees their own row.
DROP POLICY IF EXISTS assignments_select ON assignments;
CREATE POLICY assignments_select ON assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = assignments.draft_id AND d.owner_id = auth.uid()
    )
    OR assignee_user_id = auth.uid()
    OR lower(assignee_email) = lower(auth.jwt() ->> 'email')
  );

-- Only the draft owner manages assignments.
DROP POLICY IF EXISTS assignments_insert ON assignments;
CREATE POLICY assignments_insert ON assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = assignments.draft_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS assignments_update ON assignments;
CREATE POLICY assignments_update ON assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = assignments.draft_id AND d.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS assignments_delete ON assignments;
CREATE POLICY assignments_delete ON assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM drafts d
      WHERE d.id = assignments.draft_id AND d.owner_id = auth.uid()
    )
  );
