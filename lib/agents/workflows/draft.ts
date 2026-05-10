import { run } from "@openai/agents";
import { makeDrafter } from "@/lib/agents/drafter";
import { makeEditor } from "@/lib/agents/editor";
import type { DraftTopic, Source } from "@/lib/types";
import type { DraftEvent } from "./events";

export type DraftOptions = {
  attached?: { name: string; content: string }[];
  signal?: AbortSignal;
  skipEditor?: boolean;
  onEvent?: (e: DraftEvent) => void;
};

const emptyEmit: (e: DraftEvent) => void = () => {};

/**
 * Phase 2: for each approved topic with a capability_map, run Drafter; then Editor across all.
 *
 * Mutates `topics` in place: sets `status`, `content`, `sources` on each.
 * Topics without a capability_map (or already failed) are surfaced as failed
 * but don't block the rest.
 */
export async function runDraftWorkflow(
  topics: DraftTopic[],
  opts: DraftOptions = {},
): Promise<{ topics: DraftTopic[]; editor_ran: boolean }> {
  const emit = opts.onEvent ?? emptyEmit;

  const drafter = await makeDrafter({ attached: opts.attached });

  await Promise.all(
    topics.map(async (topic) => {
      const tq = Date.now();
      if (topic.capability_map === null) {
        topic.status = "failed";
        emit({
          type: "drafter.error",
          index: topic.index,
          message: "no capability map",
        });
        return;
      }

      topic.status = "drafting";
      emit({
        type: "drafter.started",
        index: topic.index,
        feature_count: topic.capability_map.features.length,
      });

      const input = JSON.stringify({
        topic: topic.text,
        capability_map: topic.capability_map,
      });

      try {
        const result = await run(drafter, input, { signal: opts.signal });
        const output = result.finalOutput;
        if (!output) throw new Error("Drafter produced no output");
        const seen = new Set<string>();
        const dedupedSources: Source[] = [];
        for (const s of output.sources) {
          if (!seen.has(s.url)) {
            seen.add(s.url);
            dedupedSources.push(s);
          }
        }
        topic.status = "drafted";
        topic.content = output.content;
        topic.sources = dedupedSources;
        const duration_ms = Date.now() - tq;
        emit({
          type: "drafter.complete",
          index: topic.index,
          content: output.content,
          sources: dedupedSources,
          duration_ms,
        });
      } catch (e) {
        topic.status = "failed";
        const message = e instanceof Error ? e.message : "drafter error";
        emit({ type: "drafter.error", index: topic.index, message });
      }
    }),
  );

  let editor_ran = false;
  const drafted = topics.filter((t) => t.status === "drafted");
  if (opts.skipEditor) {
    emit({ type: "editor.skipped", reason: "skipEditor=true" });
  } else if (drafted.length === 0) {
    emit({ type: "editor.skipped", reason: "no successful drafts" });
  } else {
    emit({ type: "editor.started", topic_count: drafted.length });
    const tEd = Date.now();
    try {
      const editor = await makeEditor();
      const editorInput = JSON.stringify(
        drafted.map((t) => ({
          index: t.index,
          topic: t.text,
          draft: t.content,
        })),
      );
      const editResult = await run(editor, editorInput, {
        signal: opts.signal,
      });
      const editorOut = editResult.finalOutput;
      if (editorOut) {
        const byIndex = new Map(topics.map((t) => [t.index, t]));
        for (const r of editorOut.rewrites) {
          const target = byIndex.get(r.index);
          if (target && target.status === "drafted") {
            target.content = r.content;
          }
        }
        editor_ran = true;
        emit({
          type: "editor.complete",
          duration_ms: Date.now() - tEd,
        });
      } else {
        emit({ type: "editor.skipped", reason: "editor empty output" });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "editor error";
      emit({ type: "editor.skipped", reason: `editor error: ${reason}` });
    }
  }

  return { topics, editor_ran };
}
