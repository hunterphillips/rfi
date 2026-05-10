"use server";

import { redirect } from "next/navigation";
import { run } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { parserAgent } from "@/lib/agents/parser";
import { scopeAgent } from "@/lib/agents/scope";
import { extractDocumentText } from "@/lib/parse-document";
import type { DraftTopic, Scope } from "@/lib/types";

export type NewDraftState =
  | { status: "idle" }
  | { status: "error"; message: string };

const MAX_INPUT_BYTES = 2 * 1024 * 1024; // 2 MB

export async function createDraft(
  _prev: NewDraftState,
  formData: FormData,
): Promise<NewDraftState> {
  const pasted = String(formData.get("pasted") ?? "").trim();
  const fileEntry = formData.get("file");
  const file =
    fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  let inputText = "";
  if (file) {
    if (file.size > MAX_INPUT_BYTES) {
      return {
        status: "error",
        message: `File is too large (${(file.size / 1_000_000).toFixed(1)} MB). Limit is 2 MB.`,
      };
    }
    try {
      inputText = await extractDocumentText(file);
    } catch (e) {
      return {
        status: "error",
        message: e instanceof Error ? e.message : "Failed to read file.",
      };
    }
  } else if (pasted) {
    if (pasted.length > MAX_INPUT_BYTES) {
      return {
        status: "error",
        message: "Pasted text exceeds the 2 MB limit.",
      };
    }
    inputText = pasted;
  }

  if (!inputText.trim()) {
    return { status: "error", message: "Paste an RFI or upload a file." };
  }

  // Run Parser and Scope extractor in parallel. Parser failure aborts;
  // Scope failure is swallowed (downstream tolerates null scope).
  const [parserResult, scopeResult] = await Promise.allSettled([
    run(parserAgent, inputText),
    run(scopeAgent, inputText),
  ]);

  if (parserResult.status === "rejected") {
    return {
      status: "error",
      message:
        parserResult.reason instanceof Error
          ? parserResult.reason.message
          : "Parser failed.",
    };
  }

  const parsed = parserResult.value.finalOutput;
  if (!parsed || parsed.topics.length === 0) {
    return {
      status: "error",
      message:
        "No topics detected. The input may not be a valid RFI document.",
    };
  }

  let scope: Scope | null = null;
  if (scopeResult.status === "fulfilled" && scopeResult.value.finalOutput) {
    scope = scopeResult.value.finalOutput;
  } else if (scopeResult.status === "rejected") {
    console.warn("[createDraft] scope extractor failed:", scopeResult.reason);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { status: "error", message: "Not signed in." };
  }

  const topics: DraftTopic[] = parsed.topics.map((q, i) => ({
    index: i,
    text: q.text,
    status: "pending",
    plan: [],
    research: [],
    capability_map: null,
    feedback_history: [],
    content: null,
    sources: [],
  }));

  const { data: draft, error: insertErr } = await supabase
    .from("drafts")
    .insert({
      owner_id: user.id,
      title: parsed.title,
      input_text: inputText,
      topics,
      scope,
      status: "parsed",
    })
    .select("id")
    .single();

  if (insertErr || !draft) {
    return {
      status: "error",
      message: insertErr?.message ?? "Could not save draft.",
    };
  }

  redirect(`/drafts/${draft.id}`);
}
