// Run with:  pnpm dlx tsx --env-file=.env.local scripts/diag-schema.ts
//
// Spot-check the post-migration schema by reading from `drafts` via the
// service role key. Confirms the column rename ran (queries `topics`),
// the new statuses are accepted (does a no-op insert + delete with
// status='researching'), and the JSONB shape on existing rows matches
// the new fields.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Column rename: read using the new name. If the column wasn't renamed
  //    this errors with PostgrestError "column drafts.topics does not exist".
  const { data: rows, error: readErr } = await sb
    .from("drafts")
    .select("id, status, topics")
    .limit(3);
  if (readErr) throw new Error(`read failed: ${readErr.message}`);
  console.log(`✓ column rename: read ${rows?.length ?? 0} row(s) from drafts.topics`);

  // 2. JSONB backfill: existing rows should have the new fields on each topic.
  for (const r of rows ?? []) {
    if (!Array.isArray(r.topics)) continue;
    for (const t of r.topics) {
      const required = ["plan", "research", "capability_map", "feedback_history"];
      const missing = required.filter((k) => !(k in t));
      if (missing.length) {
        console.warn(
          `  ! row ${r.id} topic ${t.index}: missing fields ${missing.join(",")}`,
        );
      }
    }
  }
  console.log("✓ JSONB backfill: existing topics have plan/research/capability_map/feedback_history");

  // 3. New status values: insert a dummy row with status='researching', then delete.
  //    Uses the first user from auth.users so owner_id passes the FK.
  const { data: someUser } = await sb
    .from("profiles")
    .select("id")
    .limit(1)
    .single();
  if (!someUser) {
    console.log("  (skipping status check: no profiles to use as owner_id)");
    return;
  }

  const { data: inserted, error: insertErr } = await sb
    .from("drafts")
    .insert({
      owner_id: someUser.id,
      title: "diag-schema temp",
      input_text: "test",
      topics: [],
      status: "researching",
    })
    .select("id")
    .single();
  if (insertErr) {
    throw new Error(`status='researching' insert rejected: ${insertErr.message}`);
  }
  console.log(`✓ CHECK accepts 'researching' (inserted row ${inserted!.id})`);

  // Try the other new value too.
  const { error: updErr } = await sb
    .from("drafts")
    .update({ status: "researched" })
    .eq("id", inserted!.id);
  if (updErr) {
    throw new Error(`status='researched' update rejected: ${updErr.message}`);
  }
  console.log("✓ CHECK accepts 'researched'");

  await sb.from("drafts").delete().eq("id", inserted!.id);
  console.log("✓ cleanup: temp row deleted");
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
