"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DraftTopic, Scope } from "@/lib/types";

export async function saveQuestions(
  draftId: string,
  texts: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cleaned = texts.map((t) => t.trim()).filter((t) => t.length > 0);

  if (cleaned.length === 0) {
    return { ok: false, message: "At least one topic is required." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("drafts")
    .select("topics, status")
    .eq("id", draftId)
    .single();

  if (fetchErr || !existing) {
    return { ok: false, message: fetchErr?.message ?? "Draft not found." };
  }

  if (existing.status !== "parsed") {
    return {
      ok: false,
      message: "Topics can only be edited while the draft is in `parsed`.",
    };
  }

  const reindexed: DraftTopic[] = cleaned.map((text, i) => ({
    index: i,
    text,
    status: "pending",
    plan: [],
    research: [],
    capability_map: null,
    feedback_history: [],
    content: null,
    sources: [],
  }));

  const { error: updateErr } = await supabase
    .from("drafts")
    .update({ topics: reindexed })
    .eq("id", draftId);

  if (updateErr) return { ok: false, message: updateErr.message };

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

export async function renameDraft(
  draftId: string,
  rawTitle: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const title = rawTitle.trim();
  if (title.length === 0) {
    return { ok: false, message: "Title cannot be empty." };
  }
  if (title.length > 200) {
    return { ok: false, message: "Title is too long (max 200 chars)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("drafts")
    .update({ title })
    .eq("id", draftId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/drafts/${draftId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateScope(
  draftId: string,
  scope: Scope | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("drafts")
    .select("status")
    .eq("id", draftId)
    .single();
  if (fetchErr || !existing) {
    return { ok: false, message: fetchErr?.message ?? "Draft not found." };
  }
  if (existing.status !== "parsed" && existing.status !== "researched") {
    return {
      ok: false,
      message: `Scope can only be edited while the draft is in 'parsed' or 'researched' (currently '${existing.status}').`,
    };
  }

  // Normalize: trim names, drop empties, dedupe by lowercase name.
  let normalized: Scope | null = null;
  if (scope) {
    const seen = new Set<string>();
    const products = scope.products
      .map((p) => ({ name: p.name.trim() }))
      .filter((p) => {
        if (!p.name) return false;
        const key = p.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const version = scope.version?.trim() || null;
    const summary = scope.summary?.trim() ?? "";
    normalized = { products, version, summary };
  }

  const { error: updateErr } = await supabase
    .from("drafts")
    .update({ scope: normalized })
    .eq("id", draftId);
  if (updateErr) return { ok: false, message: updateErr.message };

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

export async function deleteDraft(formData: FormData): Promise<void> {
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return;

  const supabase = await createClient();
  // RLS gates this to the owner. The DB schema should cascade comments/assignments;
  // this returns a Postgres FK error if cascading isn't set up.
  const { error } = await supabase.from("drafts").delete().eq("id", draftId);
  if (error) {
    // Bubble the error up so it shows in the UI rather than silently failing.
    throw new Error(error.message);
  }

  revalidatePath("/");
  redirect("/");
}
