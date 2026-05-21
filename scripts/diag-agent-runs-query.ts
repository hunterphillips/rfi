// Run with:  pnpm dlx tsx --env-file=.env.local scripts/diag-agent-runs-query.ts
// Summarize recent agent_runs activity to verify Tier 2 wiring after a real
// workflow execution.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await sb
    .from("agent_runs")
    .select(
      "id, draft_id, topic_index, stage, model, prompt_hash, trace_id, tokens_in, tokens_out, latency_ms, salvaged, budget_used, error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`query failed: ${error.message}`);
  console.log(`agent_runs total recent: ${rows?.length ?? 0}`);
  if (!rows || rows.length === 0) return;

  // Group by draft.
  const byDraft = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byDraft.get(r.draft_id) ?? [];
    arr.push(r);
    byDraft.set(r.draft_id, arr);
  }

  for (const [draftId, draftRows] of byDraft) {
    console.log();
    console.log(`draft ${draftId}  (${draftRows.length} rows)`);
    const traceIds = new Set(draftRows.map((r) => r.trace_id).filter(Boolean));
    console.log(`  trace_ids: ${[...traceIds].join(", ")}`);

    // By-stage counts + totals.
    const stages = new Map<
      string,
      { count: number; tokensIn: number; tokensOut: number; salvaged: number; errors: number; latencyMs: number }
    >();
    for (const r of draftRows) {
      const s = stages.get(r.stage) ?? {
        count: 0,
        tokensIn: 0,
        tokensOut: 0,
        salvaged: 0,
        errors: 0,
        latencyMs: 0,
      };
      s.count++;
      s.tokensIn += r.tokens_in ?? 0;
      s.tokensOut += r.tokens_out ?? 0;
      s.salvaged += r.salvaged ? 1 : 0;
      s.errors += r.error ? 1 : 0;
      s.latencyMs += r.latency_ms ?? 0;
      stages.set(r.stage, s);
    }
    for (const [stage, s] of stages) {
      console.log(
        `  ${stage.padEnd(10)} n=${s.count}  tokensIn=${s.tokensIn}  tokensOut=${s.tokensOut}  salvaged=${s.salvaged}  errors=${s.errors}  avg_latency=${Math.round(s.latencyMs / s.count)}ms`,
      );
    }

    // Spot-check: first row's prompt_hash per stage.
    const sample = new Map<string, string | null>();
    for (const r of draftRows) {
      if (!sample.has(r.stage)) sample.set(r.stage, r.prompt_hash);
    }
    console.log(
      `  prompt_hashes: ${[...sample].map(([s, h]) => `${s}=${h?.slice(0, 8) ?? "null"}`).join("  ")}`,
    );
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
