"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DraftQuestion } from "@/lib/types";

export async function saveQuestions(
  draftId: string,
  texts: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cleaned = texts.map((t) => t.trim()).filter((t) => t.length > 0);

  if (cleaned.length === 0) {
    return { ok: false, message: "At least one question is required." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("drafts")
    .select("questions, status")
    .eq("id", draftId)
    .single();

  if (fetchErr || !existing) {
    return { ok: false, message: fetchErr?.message ?? "Draft not found." };
  }

  if (existing.status !== "parsed") {
    return {
      ok: false,
      message: "Questions can only be edited while the draft is in `parsed`.",
    };
  }

  const reindexed: DraftQuestion[] = cleaned.map((text, i) => ({
    index: i,
    text,
    status: "pending",
    content: null,
    sources: [],
  }));

  const { error: updateErr } = await supabase
    .from("drafts")
    .update({ questions: reindexed })
    .eq("id", draftId);

  if (updateErr) return { ok: false, message: updateErr.message };

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}
