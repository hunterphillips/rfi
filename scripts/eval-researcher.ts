// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/eval-researcher.ts
//
// Runs the Researcher (live Tavily + sn-docs MCP) against
// evals/fixtures/researcher.json, judges each case with gpt-5, prints
// per-case + aggregate scores.
import path from "node:path";
import { generateTraceId, withTrace } from "@openai/agents";
import { runResearcher } from "@/lib/agents/researcher";
import type { SearchItem } from "@/lib/agents/planner";
import { makeSnDocsServer } from "@/lib/agents/tools/sn-docs";
import { judgeResearcher } from "@/lib/evals/judge";
import { runEval } from "@/lib/evals/runner";
import type { ResearcherOutput } from "@/lib/agents/researcher";

const FIXTURE = path.resolve(process.cwd(), "evals/fixtures/researcher.json");

async function main() {
  const traceId = generateTraceId();
  console.log(
    `[researcher-eval] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );
  console.log();

  const mcp = makeSnDocsServer({
    blockedToolNames: ["sn_search_docs", "sn_get_doc"],
  });
  await mcp.connect();

  try {
    await withTrace(
      "eval-researcher",
      async () => {
        const summary = await runEval<SearchItem, string[], ResearcherOutput>(
          "researcher-eval",
          FIXTURE,
          async (item) => {
            const { output } = await runResearcher(item, mcp);
            if (!output) throw new Error("Researcher produced no output");
            return output;
          },
          async (output, expected, item) =>
            judgeResearcher(item, expected, output),
        );

        if (summary.aggregates.failCount > 0) process.exitCode = 2;
      },
      { traceId },
    );
  } finally {
    try {
      await mcp.close();
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
