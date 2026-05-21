-- Tier 2 observability: per-agent-stage run telemetry. One row per LLM call
-- (planner, scope, parser, researcher × N, architect, drafter × N, editor).
-- Lets us answer "salvage rate this week", "p50 cost per draft", "which prompt
-- version was active". Trace IDs persisted on drafts so production runs link
-- to their OpenAI traces.
--
-- Apply via Supabase dashboard SQL editor (MCP OAuth is broken at time of
-- writing; service-role REST works for reads/writes via @supabase/supabase-js).

-- 1. agent_runs table.
CREATE TABLE IF NOT EXISTS agent_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id      uuid NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  topic_index   int,                    -- null for draft-level stages (parser, scope, editor)
  stage         text NOT NULL,          -- 'parser' | 'scope' | 'planner' | 'researcher' | 'architect' | 'drafter' | 'editor' | 'salvager'
  model         text NOT NULL,
  prompt_hash   text,                   -- sha256[:16] of the agent's instructions template at run time
  trace_id      text,                   -- OpenAI trace id (matches drafts.trace_id when stage was inside that trace)
  tokens_in     int,
  tokens_out    int,
  cost_usd      numeric(10, 6),         -- nullable; populated downstream from a model-rate map
  latency_ms    int,
  salvaged      boolean NOT NULL DEFAULT false,
  budget_used   jsonb,                  -- { searches_used, doc_fetches_used } for researcher; null elsewhere
  error         text,                   -- non-null on stage failure
  raw_telemetry jsonb,                  -- stage-specific extras (e.g. researcher tool_calls breakdown)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_draft_idx ON agent_runs(draft_id, stage);
CREATE INDEX IF NOT EXISTS agent_runs_created_idx ON agent_runs(created_at DESC);

-- 2. RLS — restrict to the draft owner. Pre-Phase 4/5 there are no
-- assignees/reviewers; this matches how drafts itself is gated.
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_runs_select_own ON agent_runs;
CREATE POLICY agent_runs_select_own ON agent_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drafts
      WHERE drafts.id = agent_runs.draft_id
        AND drafts.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agent_runs_insert_own ON agent_runs;
CREATE POLICY agent_runs_insert_own ON agent_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM drafts
      WHERE drafts.id = agent_runs.draft_id
        AND drafts.owner_id = auth.uid()
    )
  );

-- 3. Persist the per-run OpenAI trace id on drafts. The two SSE phase routes
-- (/api/drafts/[id]/research, /api/drafts/[id]/draft) set this when they
-- generate the trace; agent_runs.trace_id duplicates it for query convenience.
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS trace_id text;
