import { tool } from "@openai/agents";
import type { MCPServer } from "@openai/agents";
import { z } from "zod";
import {
  checkDocFetchBudget,
  truncate,
  CONTENT_PREVIEW_MAX,
  type ResearcherBag,
} from "./evidence";

type McpContent = { type: string; text: string };

type RawDocChunk = {
  chunk_index?: unknown;
  title?: unknown;
  content?: unknown;
  [k: string]: unknown;
};

function parseSnGetDoc(content: McpContent[]): {
  title: string | null;
  content_preview: string;
} {
  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  // The MCP returns a top-level array of chunks when called with
  // response_format: "json". Each chunk has { chunk_index, title, ..., content }.
  // Assemble content in chunk_index order; title comes from chunk[0].
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const chunks = (parsed as RawDocChunk[]).slice().sort((a, b) => {
        const ai = typeof a.chunk_index === "number" ? a.chunk_index : 0;
        const bi = typeof b.chunk_index === "number" ? b.chunk_index : 0;
        return ai - bi;
      });
      const title =
        typeof chunks[0]?.title === "string" ? (chunks[0].title as string) : null;
      const body = chunks
        .map((c) => (typeof c.content === "string" ? c.content : ""))
        .filter((s) => s.length > 0)
        .join("\n\n");
      return { title, content_preview: truncate(body, CONTENT_PREVIEW_MAX) };
    }
  } catch {
    // fall through
  }
  return { title: null, content_preview: truncate(text, CONTENT_PREVIEW_MAX) };
}

export function makeSnGetDocTool(mcp: MCPServer, bag?: ResearcherBag) {
  return tool({
    name: "sn_get_doc",
    description:
      "Fetch a specific ServiceNow documentation page by URL. Returns `{ ok, url, title, content_preview }` (preview is length-capped). Counts against the doc-fetch budget.",
    parameters: z.object({
      url: z
        .string()
        .describe(
          "Full ServiceNow docs URL (https://www.servicenow.com/docs/...).",
        ),
    }),
    async execute({ url }) {
      const blocked = checkDocFetchBudget(bag);
      if (blocked) return JSON.stringify(blocked);

      const raw = (await mcp.callTool("sn_get_doc", {
        url,
        response_format: "json",
      })) as McpContent[];
      const { title, content_preview } = parseSnGetDoc(raw);

      if (bag) {
        bag.evidence.push({
          kind: "sn_get_doc",
          url,
          title,
          content_preview,
        });
        bag.budget.docFetchesUsed++;
      }
      return JSON.stringify({ ok: true, url, title, content_preview });
    },
  });
}
