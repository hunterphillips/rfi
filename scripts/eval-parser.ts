// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/eval-parser.ts
//
// Runs the Parser against evals/fixtures/parser.json, judges each case with
// gpt-5, prints per-case + aggregate scores.
import path from "node:path";
import { generateTraceId, run, withTrace } from "@openai/agents";
import { parserAgent } from "@/lib/agents/parser";
import { judgeParser } from "@/lib/evals/judge";
import { runEval } from "@/lib/evals/runner";

const FIXTURE = path.resolve(process.cwd(), "evals/fixtures/parser.json");

async function main() {
  const traceId = generateTraceId();
  console.log(
    `[parser-eval] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );
  console.log();

  await withTrace(
    "eval-parser",
    async () => {
      const summary = await runEval<string, string[], string[]>(
        "parser-eval",
        FIXTURE,
        async (rfiText) => {
          const result = await run(parserAgent, rfiText);
          if (!result.finalOutput) throw new Error("Parser produced no output");
          return result.finalOutput.topics.map((t) => t.text);
        },
        async (output, expected) => judgeParser(expected, output),
      );

      // Exit non-zero if any case failed — so this can be wired into CI later
      // without rework.
      if (summary.aggregates.failCount > 0) process.exitCode = 2;
    },
    { traceId },
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
