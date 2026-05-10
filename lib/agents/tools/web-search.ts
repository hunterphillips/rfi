import { tool } from "@openai/agents";
import { tavily } from "@tavily/core";
import { z } from "zod";
import {
  checkSearchBudget,
  truncate,
  SNIPPET_MAX,
  type ResearcherBag,
  type SearchResult,
} from "./evidence";

const tavilyClient = () => tavily({ apiKey: process.env.TAVILY_API_KEY });

export function makeWebSearchTool(bag?: ResearcherBag) {
  return tool({
    name: "web_search",
    description:
      "Search the public web. Returns up to 5 results as `{ ok, results: [{title, url, snippet, rank}] }`. Counts against the search budget.",
    parameters: z.object({
      query: z
        .string()
        .describe("A focused web search query (5-12 words works best)."),
    }),
    async execute({ query }) {
      const blocked = checkSearchBudget(bag);
      if (blocked) return JSON.stringify(blocked);

      const client = tavilyClient();
      const res = await client.search(query, {
        maxResults: 5,
        searchDepth: "basic",
      });
      const results: SearchResult[] = res.results.slice(0, 5).map((r, i) => ({
        title: r.title ?? "Untitled",
        url: r.url ?? "",
        snippet: truncate(r.content ?? "", SNIPPET_MAX),
        rank: i + 1,
      }));

      if (bag) {
        bag.evidence.push({ kind: "web_search", query, results });
        bag.budget.searchesUsed++;
      }
      return JSON.stringify({ ok: true, results });
    },
  });
}
