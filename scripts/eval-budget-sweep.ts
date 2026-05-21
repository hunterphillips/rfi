// Run with:
//   pnpm dlx tsx --env-file=.env.local scripts/eval-budget-sweep.ts
//
// Runs the researcher fixtures across multiple (maxSearches, maxDocFetches)
// budget variants and prints a comparison table to inform empirical defaults
// for DEFAULT_SN_BUDGET / DEFAULT_WEB_BUDGET.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateTraceId, withTrace } from "@openai/agents";
import {
  runResearcher,
  type RunResearcherOptions,
} from "@/lib/agents/researcher";
import type { SearchItem } from "@/lib/agents/planner";
import { makeSnDocsServer } from "@/lib/agents/tools/sn-docs";
import { judgeResearcher } from "@/lib/evals/judge";
import type { EvalCase } from "@/lib/evals/types";

const FIXTURE = path.resolve(process.cwd(), "evals/fixtures/researcher.json");

type Variant = {
  label: string;
  budget: { maxSearches: number; maxDocFetches: number };
};

const VARIANTS: Variant[] = [
  { label: "1/1", budget: { maxSearches: 1, maxDocFetches: 1 } },
  { label: "2/1", budget: { maxSearches: 2, maxDocFetches: 1 } }, // current default for sn_docs
  { label: "3/1", budget: { maxSearches: 3, maxDocFetches: 1 } },
  { label: "2/2", budget: { maxSearches: 2, maxDocFetches: 2 } },
];

type CaseRow = {
  caseId: string;
  ok: boolean;
  coverage: number;
  groundedness: number;
  searchesUsed: number;
  docFetchesUsed: number;
  salvaged: boolean;
  durationMs: number;
};

type VariantSummary = {
  label: string;
  rows: CaseRow[];
  passCount: number;
  failCount: number;
  errCount: number;
  avgCoverage: number;
  avgGroundedness: number;
  avgSearches: number;
  avgDocFetches: number;
  salvageRate: number;
  avgDurationMs: number;
};

async function runVariant(
  variant: Variant,
  cases: EvalCase<SearchItem, string[]>[],
  mcp: Awaited<ReturnType<typeof makeSnDocsServer>>,
): Promise<VariantSummary> {
  console.log(
    `[sweep] variant ${variant.label}  (searches=${variant.budget.maxSearches}, doc_fetches=${variant.budget.maxDocFetches})`,
  );

  const opts: RunResearcherOptions = { budget: variant.budget };
  const rows: CaseRow[] = [];

  for (const c of cases) {
    const start = Date.now();
    try {
      const { output, telemetry } = await runResearcher(c.input, mcp, opts);
      if (!output) throw new Error("no output");
      const judge = await judgeResearcher(c.input, c.expected, output);
      const coverage = judge.scores.coverage ?? 0;
      const groundedness = judge.scores.groundedness ?? 0;
      const ok = coverage >= 2 && groundedness >= 2;
      const row: CaseRow = {
        caseId: c.id,
        ok,
        coverage,
        groundedness,
        searchesUsed: telemetry.searches_used,
        docFetchesUsed: telemetry.doc_fetches_used,
        salvaged: telemetry.salvaged,
        durationMs: Date.now() - start,
      };
      rows.push(row);
      console.log(
        `[sweep]   ${ok ? "PASS" : "FAIL"} ${c.id}  cov=${coverage} ground=${groundedness}  s=${row.searchesUsed} d=${row.docFetchesUsed}${row.salvaged ? " SALVAGED" : ""}  (${row.durationMs}ms)`,
      );
    } catch (e) {
      rows.push({
        caseId: c.id,
        ok: false,
        coverage: 0,
        groundedness: 0,
        searchesUsed: 0,
        docFetchesUsed: 0,
        salvaged: false,
        durationMs: Date.now() - start,
      });
      console.log(
        `[sweep]   ERR  ${c.id}  ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return summarize(variant.label, rows);
}

function summarize(label: string, rows: CaseRow[]): VariantSummary {
  const passCount = rows.filter((r) => r.ok).length;
  const errCount = rows.filter((r) => r.coverage === 0 && r.groundedness === 0)
    .length;
  const failCount = rows.length - passCount;
  const n = rows.length || 1;
  return {
    label,
    rows,
    passCount,
    failCount,
    errCount,
    avgCoverage: rows.reduce((s, r) => s + r.coverage, 0) / n,
    avgGroundedness: rows.reduce((s, r) => s + r.groundedness, 0) / n,
    avgSearches: rows.reduce((s, r) => s + r.searchesUsed, 0) / n,
    avgDocFetches: rows.reduce((s, r) => s + r.docFetchesUsed, 0) / n,
    salvageRate: rows.filter((r) => r.salvaged).length / n,
    avgDurationMs: rows.reduce((s, r) => s + r.durationMs, 0) / n,
  };
}

function printTable(summaries: VariantSummary[]): void {
  const cases = summaries[0]?.rows.length ?? 0;
  console.log();
  console.log("=== Budget sweep comparison ===");
  console.log(`fixtures: ${cases} cases (researcher.json)`);
  console.log();
  const header = [
    "variant".padEnd(8),
    "pass".padStart(6),
    "cov".padStart(6),
    "ground".padStart(8),
    "search".padStart(8),
    "fetch".padStart(7),
    "salvage".padStart(9),
    "ms".padStart(7),
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const s of summaries) {
    console.log(
      [
        s.label.padEnd(8),
        `${s.passCount}/${cases}`.padStart(6),
        s.avgCoverage.toFixed(2).padStart(6),
        s.avgGroundedness.toFixed(2).padStart(8),
        s.avgSearches.toFixed(2).padStart(8),
        s.avgDocFetches.toFixed(2).padStart(7),
        `${(s.salvageRate * 100).toFixed(0)}%`.padStart(9),
        Math.round(s.avgDurationMs).toString().padStart(7),
      ].join("  "),
    );
  }
  console.log();
}

async function main() {
  const traceId = generateTraceId();
  console.log(
    `[sweep] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );
  console.log();

  const raw = await readFile(FIXTURE, "utf8");
  const cases = JSON.parse(raw) as EvalCase<SearchItem, string[]>[];
  console.log(
    `[sweep] ${cases.length} fixtures × ${VARIANTS.length} variants = ${cases.length * VARIANTS.length} researcher runs`,
  );
  console.log();

  const mcp = makeSnDocsServer({
    blockedToolNames: ["sn_search_docs", "sn_get_doc"],
  });
  await mcp.connect();

  const summaries: VariantSummary[] = [];
  try {
    await withTrace(
      "eval-budget-sweep",
      async () => {
        for (const variant of VARIANTS) {
          const s = await runVariant(variant, cases, mcp);
          summaries.push(s);
          console.log();
        }
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

  printTable(summaries);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
