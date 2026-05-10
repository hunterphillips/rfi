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

function parseSnGetDoc(content: McpContent[]): {
  title: string | null;
  content_preview: string;
} {
  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  // sn_get_doc returns markdown by default, sometimes wrapped in { title, content }
  // JSON. Try parse-as-JSON first; on failure, treat the whole blob as markdown
  // and pull a title from the first H1 if present.
  let title: string | null = null;
  let content_text = text;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.content === "string") content_text = obj.content;
      if (typeof obj.title === "string") title = obj.title;
    }
  } catch {
    const h1 = content_text.match(/^#\s+(.+)$/m);
    if (h1) title = h1[1].trim();
  }

  return { title, content_preview: truncate(content_text, CONTENT_PREVIEW_MAX) };
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
      response_format: z
        .enum(["markdown", "html"])
        .nullable()
        .describe("Return format. Pass null for the server default (markdown)."),
    }),
    async execute({ url, response_format }) {
      const blocked = checkDocFetchBudget(bag);
      if (blocked) return JSON.stringify(blocked);

      const args: Record<string, unknown> = { url };
      if (response_format != null) args.response_format = response_format;
      const raw = (await mcp.callTool("sn_get_doc", args)) as McpContent[];
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
