// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/diag-research.ts <fixture-path>
// or with --topic for a single topic:
//   pnpm dlx tsx --env-file=.env.local scripts/diag-research.ts --topic "..."
//
// Writes the resulting capability maps as JSON to stdout. For pre-port lab
// equivalent, see agent-lab/runners/research.py.
import fs from "node:fs/promises";
import { withTrace, generateTraceId, run } from "@openai/agents";
import { parserAgent } from "@/lib/agents/parser";
import { runResearchWorkflow } from "@/lib/agents/workflows/research";
import type { DraftTopic } from "@/lib/types";

function blankTopic(index: number, text: string): DraftTopic {
  return {
    index,
    text,
    status: "pending",
    plan: [],
    research: [],
    capability_map: null,
    feedback_history: [],
    content: null,
    sources: [],
  };
}

async function main() {
  const args = process.argv.slice(2);
  let topics: DraftTopic[] = [];
  let title: string | null = null;

  if (args[0] === "--topic") {
    const text = args.slice(1).join(" ");
    if (!text) throw new Error("--topic requires a string");
    topics = [blankTopic(0, text)];
  } else {
    const path = args[0];
    if (!path) throw new Error("usage: diag-research.ts <fixture-path|--topic ...>");
    const text = await fs.readFile(path, "utf8");
    console.log("[research] parsing fixture %s (%d bytes)…", path, text.length);
    const parseResult = await run(parserAgent, text);
    const parsed = parseResult.finalOutput;
    if (!parsed) throw new Error("Parser produced no output");
    title = parsed.title;
    topics = parsed.topics.map((t, i) => blankTopic(i, t.text));
    console.log("[research] parsed %d topics: %s", topics.length, parsed.title);
  }

  const traceId = generateTraceId();
  console.log(
    `[research] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );

  await withTrace(
    "diag-research",
    async () => {
      await runResearchWorkflow(topics, {
        onEvent: (e) => {
          if (e.type === "planner.complete") {
            console.log(
              "  [%d] plan: %d items",
              e.index,
              e.plan.length,
            );
          } else if (e.type === "researcher.complete") {
            console.log(
              "  [%d/%d] researcher done — %d sources, %d tool calls%s",
              e.topic_index,
              e.r_index,
              e.sources.length,
              e.tool_calls,
              e.salvaged ? " (salvaged)" : "",
            );
          } else if (e.type === "architect.complete") {
            console.log(
              "  [%d] architect: %d features, %d components, %d open questions (%dms)",
              e.index,
              e.capability_map.features.length,
              e.capability_map.components.length,
              e.capability_map.open_questions.length,
              e.duration_ms,
            );
          } else if (
            e.type === "planner.error" ||
            e.type === "architect.error" ||
            e.type === "researcher.error"
          ) {
            console.error(
              "  [%s] %s: %s",
              e.type,
              "index" in e ? `topic ${e.index}` : `topic ${e.topic_index}/${e.r_index}`,
              e.message,
            );
          }
        },
      });
    },
    { traceId },
  );

  console.log(JSON.stringify({ title, topics }, null, 2));
}

main().catch((e) => {
  console.error("[research] ERROR", e);
  process.exit(1);
});
