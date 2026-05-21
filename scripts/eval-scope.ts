// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/eval-scope.ts
//
// Runs the Scope Extractor against evals/fixtures/scope.json, judges each
// case with gpt-5, prints per-case + aggregate scores.
import path from "node:path";
import { generateTraceId, run, withTrace } from "@openai/agents";
import { scopeAgent } from "@/lib/agents/scope";
import { judgeScope } from "@/lib/evals/judge";
import { runEval } from "@/lib/evals/runner";
import type { Scope } from "@/lib/types";

const FIXTURE = path.resolve(process.cwd(), "evals/fixtures/scope.json");

async function main() {
  const traceId = generateTraceId();
  console.log(
    `[scope-eval] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );
  console.log();

  await withTrace(
    "eval-scope",
    async () => {
      const summary = await runEval<string, Scope, Scope>(
        "scope-eval",
        FIXTURE,
        async (rfiText) => {
          const result = await run(scopeAgent, rfiText);
          if (!result.finalOutput) throw new Error("Scope produced no output");
          return result.finalOutput;
        },
        async (output, expected) => judgeScope(expected, output),
      );

      if (summary.aggregates.failCount > 0) process.exitCode = 2;
    },
    { traceId },
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
