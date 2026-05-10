// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/diag-draft.ts <state.json>
//
// Reads a state JSON (the output of diag-research.ts; { title, topics: DraftTopic[] })
// and runs the draft pipeline. Topics whose status is `researched` will be
// auto-promoted to `approved` for the smoke test.
import fs from "node:fs/promises";
import { withTrace, generateTraceId } from "@openai/agents";
import { runDraftWorkflow } from "@/lib/agents/workflows/draft";
import type { DraftTopic } from "@/lib/types";

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: diag-draft.ts <state.json>");
  const text = await fs.readFile(path, "utf8");
  const state = JSON.parse(text) as {
    title?: string | null;
    topics: DraftTopic[];
  };

  // Auto-approve researched topics for the smoke test.
  for (const t of state.topics) {
    if (t.status === "researched") t.status = "approved";
  }

  const traceId = generateTraceId();
  console.log(
    `[draft] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );

  await withTrace(
    "diag-draft",
    async () => {
      await runDraftWorkflow(state.topics, {
        onEvent: (e) => {
          if (e.type === "drafter.complete") {
            console.log(
              "  [%d] drafted (%d sources, %dms)",
              e.index,
              e.sources.length,
              e.duration_ms,
            );
          } else if (e.type === "drafter.error") {
            console.error("  [%d] drafter error: %s", e.index, e.message);
          } else if (e.type === "editor.started") {
            console.log("  editor harmonizing across %d topics…", e.topic_count);
          } else if (e.type === "editor.complete") {
            console.log("  editor done (%dms)", e.duration_ms);
          } else if (e.type === "editor.skipped") {
            console.log("  editor skipped: %s", e.reason);
          }
        },
      });
    },
    { traceId },
  );

  // Render the final markdown.
  const parts: string[] = [];
  if (state.title) parts.push(`# ${state.title}\n`);
  for (const t of state.topics) {
    parts.push(`## Topic ${t.index + 1}\n`);
    const quoted = t.text.split("\n").join("\n> ");
    parts.push(`> ${quoted}\n`);
    if (t.status === "drafted" && t.content) {
      parts.push(`${t.content}\n`);
      if (t.sources.length > 0) {
        parts.push("**Sources:**\n");
        for (const s of t.sources) {
          parts.push(`- [${s.title}](${s.url})`);
        }
        parts.push("");
      }
    } else {
      parts.push(`_Pipeline did not produce a draft (status: ${t.status})._\n`);
    }
  }
  console.log("\n" + parts.join("\n"));
}

main().catch((e) => {
  console.error("[draft] ERROR", e);
  process.exit(1);
});
