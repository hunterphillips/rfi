import { Agent } from "@openai/agents";
import { z } from "zod";

export const SearchSourceSchema = z.enum(["sn_docs", "web"]);

export const SearchItemSchema = z.object({
  query: z
    .string()
    .describe(
      "A focused search query, ideally 5-15 words. Specific enough that a single search returns actionable results.",
    ),
  source: SearchSourceSchema.describe(
    "Where to run the search: 'sn_docs' for ServiceNow product mechanics (features, modules, integrations); 'web' for IPC- or market-context facts, vendor news, federal program references.",
  ),
  reason: z
    .string()
    .describe("One sentence: why this specific search is needed for the topic."),
  bundle: z
    .string()
    .nullable()
    .describe(
      "Optional sn-docs bundle hint (e.g. 'vancouver-now-intelligence' or 'washington-itsm') to scope an sn_docs search. Set when the RFI scope makes the relevant bundle clear; null otherwise. Ignored for web searches.",
    ),
});

export const SearchPlanSchema = z.object({
  items: z
    .array(SearchItemSchema)
    .min(1)
    .max(6)
    .describe(
      "3-5 search items covering distinct sub-aspects of the topic. Avoid duplicates and overlapping queries.",
    ),
});

export type SearchItem = z.infer<typeof SearchItemSchema>;
export type SearchPlan = z.infer<typeof SearchPlanSchema>;

export const plannerAgent = new Agent({
  name: "RFI Search Planner",
  model: "gpt-5-mini",
  outputType: SearchPlanSchema,
  instructions: `You produce a search plan for ONE RFI topic on behalf of an AI/ServiceNow consultancy.

Your job: decide which searches a researcher needs to run to answer this topic well. You do NOT answer the topic or run searches yourself — you only emit the plan.

The user message contains the topic text and (optionally) an "## RFI scope" block with the ServiceNow products/version the RFI is scoped to. Use scope to ground your queries — favor product-canonical wording in queries and set \`bundle\` on \`sn_docs\` items when the scope makes the right bundle clear.

Rules:
- Emit 3-5 items typically. One per distinct sub-aspect of the topic.
- Each \`query\` must be a focused, specific search string (5-15 words).
- \`source = "sn_docs"\` for ServiceNow product mechanics, features, modules, integrations, version-specific behavior.
- \`source = "web"\` for vendor-agnostic context, federal procurement / agency program references, recent news, IPC-specific market positioning.
- \`reason\` is one sentence explaining why this search is needed.
- \`bundle\` (sn_docs only): set to a bundle hint like 'vancouver-now-intelligence' or 'washington-itsm' when the RFI scope makes the relevant bundle clear. Null when scope is unclear or for web searches. Don't guess bundle names you aren't reasonably confident in — null is safer.
- Avoid overlapping queries — each search should return distinct evidence.
- If the topic has clear sub-bullets, plan one search per sub-bullet (where each merits a search).
- Don't plan a search just to "get more context" — every item must contribute a fact the answer will need.
`,
});
