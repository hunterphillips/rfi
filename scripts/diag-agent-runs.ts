// Run with:  pnpm dlx tsx --env-file=.env.local scripts/diag-agent-runs.ts
//
// Verifies the 20260511_agent_runs migration applied cleanly:
// - drafts.trace_id column exists
// - agent_runs table exists with the expected columns
// - INSERT / DELETE via service role works
// - cascade delete drops agent_runs when its parent draft is deleted
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. drafts.trace_id readable.
  const { error: traceColErr } = await sb
    .from("drafts")
    .select("id, trace_id")
    .limit(1);
  if (traceColErr) throw new Error(`drafts.trace_id read failed: ${traceColErr.message}`);
  console.log("✓ drafts.trace_id column exists");

  // 2. agent_runs readable (empty is fine).
  const { data: existing, error: readErr } = await sb
    .from("agent_runs")
    .select("id, stage, model, draft_id, topic_index, prompt_hash, trace_id, tokens_in, tokens_out, latency_ms, salvaged, budget_used, error, raw_telemetry, created_at")
    .limit(1);
  if (readErr) throw new Error(`agent_runs read failed: ${readErr.message}`);
  console.log(`✓ agent_runs table reads cleanly (${existing?.length ?? 0} sample row)`);

  // 3. Insert a test draft + child agent_run; verify cascade delete.
  const { data: ownerRow } = await sb
    .from("profiles")
    .select("id")
    .limit(1)
    .single();
  if (!ownerRow) {
    console.log("  (skipping insert/cascade check: no profile available as owner)");
    return;
  }

  const { data: draftRow, error: draftErr } = await sb
    .from("drafts")
    .insert({
      owner_id: ownerRow.id,
      title: "diag-agent-runs temp",
      input_text: "test",
      topics: [],
      status: "parsed",
      trace_id: "trace_diag_smoke_only",
    })
    .select("id, trace_id")
    .single();
  if (draftErr) throw new Error(`temp-draft insert failed: ${draftErr.message}`);
  console.log(`✓ temp draft inserted with trace_id=${draftRow!.trace_id}`);

  const { data: runRow, error: runErr } = await sb
    .from("agent_runs")
    .insert({
      draft_id: draftRow!.id,
      topic_index: null,
      stage: "planner",
      model: "gpt-5-mini",
      prompt_hash: "abcdef0123456789",
      trace_id: draftRow!.trace_id,
      tokens_in: 100,
      tokens_out: 50,
      latency_ms: 1234,
      salvaged: false,
      budget_used: { searches_used: 0, doc_fetches_used: 0 },
      raw_telemetry: { note: "smoke-test" },
    })
    .select("id")
    .single();
  if (runErr) throw new Error(`agent_runs insert failed: ${runErr.message}`);
  console.log(`✓ agent_runs row inserted (${runRow!.id})`);

  // 4. Delete the draft; the agent_run row should cascade away.
  const { error: delErr } = await sb.from("drafts").delete().eq("id", draftRow!.id);
  if (delErr) throw new Error(`temp-draft delete failed: ${delErr.message}`);

  const { data: afterRun } = await sb
    .from("agent_runs")
    .select("id")
    .eq("id", runRow!.id)
    .maybeSingle();
  if (afterRun) {
    throw new Error(`✗ cascade delete failed — agent_runs row ${runRow!.id} still present`);
  }
  console.log("✓ cascade delete: agent_runs row dropped with its parent draft");

  console.log();
  console.log("All checks passed.");
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
