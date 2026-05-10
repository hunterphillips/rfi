import { tool } from "@openai/agents";
import type { MCPServer } from "@openai/agents";
import { z } from "zod";
import {
  checkSearchBudget,
  truncate,
  SNIPPET_MAX,
  type ResearcherBag,
  type SearchResult,
} from "./evidence";

type McpContent = { type: string; text: string };

type RawSearchPayload = {
  results?: Array<{
    title?: unknown;
    url?: unknown;
    snippet?: unknown;
    content?: unknown;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

function parseSnSearchResults(content: McpContent[]): SearchResult[] {
  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  let parsed: RawSearchPayload;
  try {
    parsed = JSON.parse(text) as RawSearchPayload;
  } catch {
    return [];
  }
  const items = parsed.results ?? [];
  return items.slice(0, 5).map((it, i) => ({
    title: String(it.title ?? "Untitled"),
    url: String(it.url ?? ""),
    snippet: truncate(String(it.snippet ?? it.content ?? ""), SNIPPET_MAX),
    rank: i + 1,
  }));
}

export function makeSnSearchTool(mcp: MCPServer, bag?: ResearcherBag) {
  return tool({
    name: "sn_search_docs",
    description:
      "Search ServiceNow product documentation. Returns up to 5 results as `{ ok, results: [{title, url, snippet, rank}] }`. Counts against the search budget.",
    parameters: z.object({
      query: z
        .string()
        .describe("Search query, ideally 5-20 words. Be specific."),
      bundle: z
        .string()
        .nullable()
        .describe(
          "Optional bundle name (e.g. 'vancouver-now-intelligence') to scope the search. Pass null to search all bundles.",
        ),
      n_results: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .describe("Number of results to return (1-10). Pass null for default."),
    }),
    async execute({ query, bundle, n_results }) {
      const blocked = checkSearchBudget(bag);
      if (blocked) return JSON.stringify(blocked);

      const args: Record<string, unknown> = { query };
      if (bundle != null) args.bundle = bundle;
      if (n_results != null) args.n_results = n_results;
      const raw = (await mcp.callTool("sn_search_docs", args)) as McpContent[];
      const results = parseSnSearchResults(raw);

      if (bag) {
        bag.evidence.push({
          kind: "sn_search",
          query,
          bundle: bundle ?? null,
          results,
        });
        bag.budget.searchesUsed++;
      }
      return JSON.stringify({ ok: true, results });
    },
  });
}
