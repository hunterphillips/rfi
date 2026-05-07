"use server";

import { redirect } from "next/navigation";
import { run } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { parserAgent } from "@/lib/agents/parser";
import { extractDocumentText } from "@/lib/parse-document";
import type { DraftQuestion } from "@/lib/types";

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

  let parsed;
  try {
    const result = await run(parserAgent, inputText);
    parsed = result.finalOutput;
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Parser failed.",
    };
  }

  if (!parsed || parsed.questions.length === 0) {
    return {
      status: "error",
      message:
        "No questions detected. The input may not be a valid RFI document.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { status: "error", message: "Not signed in." };
  }

  const questions: DraftQuestion[] = parsed.questions.map((q, i) => ({
    index: i,
    text: q.text,
    status: "pending",
    content: null,
    sources: [],
  }));

  const { data: draft, error: insertErr } = await supabase
    .from("drafts")
    .insert({
      owner_id: user.id,
      title: parsed.title,
      input_text: inputText,
      questions,
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
