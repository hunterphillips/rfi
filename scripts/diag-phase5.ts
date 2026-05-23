// Run with: pnpm dlx tsx --env-file=.env.local scripts/diag-phase5.ts
//
// Post-migration smoke for Phase 5 (assignments + comments + RLS helper).
// Uses the service-role client (bypasses RLS) to exercise the exact writes the
// app performs, so it validates the migration without needing a logged-in user
// or the magic-link two-account flow. Creates only throwaway rows and deletes
// them in a finally block.
//
// Apply supabase/migrations/20260523_phase5_collab.sql FIRST.
import { createClient } from "@supabase/supabase-js";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // ── 0. New columns present? ────────────────────────────────────────────────
  for (const [tbl, col] of [
    ["comments", "author_id"],
    ["comments", "resolved"],
    ["comments", "resolved_at"],
    ["comments", "updated_at"],
    ["assignments", "updated_at"],
  ] as const) {
    const { error } = await sb.from(tbl).select(col).limit(1);
    record(`${tbl}.${col} exists`, !error, error?.message);
  }

  // The redundant column an earlier migration draft added should be gone.
  {
    const { error } = await sb.from("comments").select("author_user_id").limit(1);
    record("comments.author_user_id dropped", Boolean(error), error ? "absent (good)" : "still present");
  }

  // ── 1. is_draft_assignee RPC callable? ──────────────────────────────────────
  // Under the service role auth.uid() is null, so it returns false — we only
  // assert the function exists and runs without error.
  {
    const { data, error } = await sb.rpc("is_draft_assignee", {
      d_id: "00000000-0000-0000-0000-000000000000",
    });
    record(
      "is_draft_assignee() callable",
      !error,
      error?.message ?? `returned ${JSON.stringify(data)}`,
    );
  }

  // ── 2. Find (or create) a draft to write against ────────────────────────────
  let draftId: string | null = null;
  let ownerId: string | null = null;
  let createdDraft = false;

  {
    const { data: drafts } = await sb
      .from("drafts")
      .select("id, owner_id")
      .limit(1)
      .returns<{ id: string; owner_id: string }[]>();
    if (drafts && drafts.length > 0) {
      draftId = drafts[0].id;
      ownerId = drafts[0].owner_id;
    } else {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id")
        .limit(1)
        .returns<{ id: string }[]>();
      if (!profiles || profiles.length === 0) {
        record("draft available for write tests", false, "no drafts and no profiles to own a temp draft");
      } else {
        ownerId = profiles[0].id;
        const { data: created, error } = await sb
          .from("drafts")
          .insert({ owner_id: ownerId, status: "ready", topics: [] })
          .select("id")
          .single<{ id: string }>();
        if (error || !created) {
          record("temp draft created", false, error?.message);
        } else {
          draftId = created.id;
          createdDraft = true;
          record("temp draft created", true, draftId);
        }
      }
    }
  }

  if (!draftId || !ownerId) {
    summarize();
    return;
  }

  const createdAssignmentIds: string[] = [];
  const createdCommentIds: string[] = [];

  try {
    // ── 3. assignments insert with status='pending' (the key CHECK risk) ──────
    {
      const { data, error } = await sb
        .from("assignments")
        .insert({
          draft_id: draftId,
          role: "reviewer",
          assignee_email: "diag-phase5@example.com",
          assignee_user_id: null,
          assigned_by: ownerId,
          status: "pending",
        })
        .select("id, status, updated_at")
        .single<{ id: string; status: string; updated_at: string | null }>();
      if (error || !data) {
        record("assignments insert (status='pending')", false, error?.message);
      } else {
        createdAssignmentIds.push(data.id);
        record("assignments insert (status='pending')", true, `status=${data.status}`);
        record("assignments.updated_at defaulted", Boolean(data.updated_at), data.updated_at ?? "null");
      }
    }

    // ── 4. comments insert + resolve + defaults ───────────────────────────────
    {
      const { data, error } = await sb
        .from("comments")
        .insert({
          draft_id: draftId,
          anchor_question_index: 0,
          author_id: ownerId,
          body: "diag-phase5 smoke comment",
        })
        .select("id, resolved, updated_at")
        .single<{ id: string; resolved: boolean; updated_at: string | null }>();
      if (error || !data) {
        record("comments insert (author_id)", false, error?.message);
      } else {
        createdCommentIds.push(data.id);
        record("comments insert (author_id)", true, `id=${data.id}`);
        record("comments.resolved defaults false", data.resolved === false, String(data.resolved));
        record("comments.updated_at defaulted", Boolean(data.updated_at), data.updated_at ?? "null");

        const { error: upErr } = await sb
          .from("comments")
          .update({ resolved: true, resolved_at: new Date().toISOString() })
          .eq("id", data.id);
        record("comments resolve update", !upErr, upErr?.message);
      }
    }
  } finally {
    // ── 5. cleanup ────────────────────────────────────────────────────────────
    for (const id of createdCommentIds) await sb.from("comments").delete().eq("id", id);
    for (const id of createdAssignmentIds) await sb.from("assignments").delete().eq("id", id);
    if (createdDraft) await sb.from("drafts").delete().eq("id", draftId);
    console.log("\n(cleaned up throwaway rows)");
  }

  summarize();
}

function summarize() {
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
