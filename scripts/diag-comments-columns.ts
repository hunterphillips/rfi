// Run with: pnpm dlx tsx --env-file=.env.local scripts/diag-comments-columns.ts
// One-shot probe of comments + assignments column shape.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("env missing");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  for (const tbl of ["comments", "assignments"]) {
    const { data, error } = await sb.from(tbl).select("*").limit(1);
    if (error) {
      console.log(`${tbl}: ERROR ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`${tbl}: empty; querying information_schema via rpc fallback…`);
      // Iteratively try column names to detect existence.
      const candidates: Record<string, string[]> = {
        comments: [
          "id", "draft_id", "anchor_question_index", "anchor_topic_index",
          "author_user_id", "author_email", "body", "content", "resolved",
          "resolved_at", "resolved_by", "parent_comment_id", "created_at", "updated_at",
        ],
        assignments: [
          "id", "draft_id", "role", "assignee_user_id", "assignee_email",
          "status", "invited_at", "responded_at", "created_at", "updated_at",
        ],
      };
      const cols = candidates[tbl] ?? [];
      const present: string[] = [];
      const absent: string[] = [];
      for (const c of cols) {
        const { error: colErr } = await sb.from(tbl).select(c).limit(1);
        if (colErr) absent.push(c);
        else present.push(c);
      }
      console.log(`  ${tbl} present: ${present.join(", ") || "(none)"}`);
      console.log(`  ${tbl} absent:  ${absent.join(", ") || "(none)"}`);
    } else {
      console.log(`${tbl} columns: ${Object.keys(data[0]).sort().join(", ")}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
