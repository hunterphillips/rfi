import { readFile } from "node:fs/promises";
import {
  EVAL_PASS_THRESHOLD,
  type EvalAggregates,
  type EvalCase,
  type EvalResult,
  type EvalSummary,
  type JudgeScore,
} from "./types";

export type RunFn<TInput, TOutput> = (input: TInput) => Promise<TOutput>;
export type JudgeFn<TInput, TExpected, TOutput> = (
  output: TOutput,
  expected: TExpected,
  input: TInput,
) => Promise<JudgeScore>;

export type EvalRunOptions = {
  /** Override pass threshold (default: every criterion ≥ 2). */
  passThreshold?: number;
};

/**
 * Loads fixture JSON, runs each case through `runFn`, judges via `judgeFn`,
 * prints per-case + aggregate to stdout, returns the summary.
 *
 * Sequential by design — keeps judge cost predictable and progress legible.
 */
export async function runEval<TInput, TExpected, TOutput>(
  stageName: string,
  fixtureFile: string,
  runFn: RunFn<TInput, TOutput>,
  judgeFn: JudgeFn<TInput, TExpected, TOutput>,
  opts: EvalRunOptions = {},
): Promise<EvalSummary<TOutput>> {
  const threshold = opts.passThreshold ?? EVAL_PASS_THRESHOLD;

  const raw = await readFile(fixtureFile, "utf8");
  const cases = JSON.parse(raw) as EvalCase<TInput, TExpected>[];

  console.log(`[${stageName}] ${cases.length} cases (${fixtureFile})`);
  console.log();

  const results: EvalResult<TOutput>[] = [];

  for (const c of cases) {
    const start = Date.now();
    let output: TOutput | null = null;
    let error: string | undefined;
    let judge: JudgeScore | undefined;
    try {
      output = await runFn(c.input);
      judge = await judgeFn(output, c.expected, c.input);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const result: EvalResult<TOutput> = {
      caseId: c.id,
      output,
      error,
      judge,
      durationMs: Date.now() - start,
    };
    results.push(result);
    printCase(stageName, c, result, threshold);
  }

  const aggregates = aggregate(results, threshold);
  printSummary(stageName, aggregates);

  return { stage: stageName, results, aggregates };
}

function passes(r: EvalResult<unknown>, threshold: number): boolean {
  if (r.error || !r.judge) return false;
  const scores = Object.values(r.judge.scores);
  if (scores.length === 0) return false;
  return scores.every((v) => v >= threshold);
}

function aggregate<T>(
  results: EvalResult<T>[],
  threshold: number,
): EvalAggregates {
  const passCount = results.filter((r) => passes(r, threshold)).length;
  const failCount = results.length - passCount;
  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const r of results) {
    if (!r.judge) continue;
    for (const [k, v] of Object.entries(r.judge.scores)) {
      sums[k] = (sums[k] ?? 0) + v;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  const averages: Record<string, number> = {};
  for (const k of Object.keys(sums)) {
    averages[k] = sums[k] / counts[k];
  }
  return { passCount, failCount, averages };
}

function printCase<TInput, TExpected, TOutput>(
  stage: string,
  c: EvalCase<TInput, TExpected>,
  r: EvalResult<TOutput>,
  threshold: number,
): void {
  const tag = r.error ? "ERR " : passes(r, threshold) ? "PASS" : "FAIL";
  const scoreStr = r.judge
    ? Object.entries(r.judge.scores)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "(no judge)";
  console.log(`[${stage}] ${tag}  ${c.id}  (${r.durationMs}ms)  ${scoreStr}`);
  if (r.error) console.log(`         error: ${r.error}`);
  if (r.judge?.notes) console.log(`         ${r.judge.notes}`);
}

function printSummary(stage: string, agg: EvalAggregates): void {
  console.log();
  console.log(`[${stage}] === summary ===`);
  console.log(`[${stage}] pass: ${agg.passCount}  fail: ${agg.failCount}`);
  for (const [k, v] of Object.entries(agg.averages)) {
    console.log(`[${stage}] avg ${k}: ${v.toFixed(2)}`);
  }
}
