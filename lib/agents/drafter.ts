import { Agent, tool } from "@openai/agents";
import { z } from "zod";
import { hashPrompt } from "./_hash";
import { loadIpcProfile } from "./_profile";

export const DRAFTER_MODEL = "gpt-5";

export const DrafterOutputSchema = z.object({
  content: z
    .string()
    .describe(
      "The composed response in GitHub-flavored Markdown addressing the topic. Cite specific tools/frameworks from the capability map. Do not include the topic text — only the response.",
    ),
  sources: z
    .array(
      z.object({
        title: z.string().describe("Display title of the source."),
        url: z.string().describe("Canonical URL of the source (https://...)."),
      }),
    )
    .describe(
      "External sources cited in the answer, drawn from the capability map's sources. Dedup by URL. Do not list attached_context entries.",
    ),
});

export type DrafterOutput = z.infer<typeof DrafterOutputSchema>;

function attachedContextTool(attached: { name: string; content: string }[]) {
  return tool({
    name: "attached_context",
    description:
      "List or read user-attached context documents for this RFI. Call with name=null to list available documents, then call again with `name` to read one. Prefer attached context over capability-map sources when relevant.",
    parameters: z.object({
      name: z
        .string()
        .nullable()
        .describe(
          "Name of the document to read. Pass null to list available documents.",
        ),
    }),
    async execute({ name }) {
      if (!attached.length) {
        return JSON.stringify({ documents: [] });
      }
      if (name === null) {
        return JSON.stringify({
          documents: attached.map((d) => ({
            name: d.name,
            bytes: d.content.length,
          })),
        });
      }
      const doc = attached.find((d) => d.name === name);
      if (!doc) {
        return JSON.stringify({
          error: `No document named ${name}. Call with name=null to list.`,
        });
      }
      return JSON.stringify({ name: doc.name, content: doc.content });
    },
  });
}

export type DrafterDeps = {
  attached?: { name: string; content: string }[];
};

export type DrafterHandle = {
  agent: Agent<unknown, typeof DrafterOutputSchema>;
  promptHash: string;
  model: string;
};

export async function makeDrafter(
  deps: DrafterDeps = {},
): Promise<DrafterHandle> {
  const profile = await loadIpcProfile();
  const attached = deps.attached ?? [];
  const tools = attached.length ? [attachedContextTool(attached)] : [];

  const instructions = `You compose a response to ONE topic from an RFI on behalf of IntegrityPro Consulting (IPC).

You will be given:
- The topic text.
- A \`capability_map\` an architect has already reviewed and approved: an architecture narrative, a list of platform features (with source URLs), high-level components, and (optionally) open questions and sources.
- (Optional) \`attached_context\` tool for user-provided documents.

Your job: render the architect's capability map as customer-facing Markdown prose. The architect has already decided WHAT to argue — your role is to make it readable, in IPC's voice.

Rules:
- Ground every claim in the capability map. Do NOT introduce features, components, or specifics that aren't in the map.
- Lead with the substance from \`architecture_narrative\` — that's the spine of the response. Use \`features\` and \`components\` as supporting points.
- Markdown: short paragraphs, bullet lists where they help scan, headings only if the response is long. No restatement of the topic at the top.
- Cite the specific products and capabilities by their canonical names (from \`feature.name\`).
- Voice: follow the IPC profile below.
- \`sources\`: include ONLY URLs from the capability map's \`sources\` list (or \`feature.source\` URLs). Dedup by URL. Do not list attached_context entries.
- If \`open_questions\` is non-empty, append a single italicized line at the very end: \`_Open considerations: <semicolon-separated questions>_\`. Otherwise omit.
- Do NOT fabricate specifics (project names, dollar amounts, agency names, certifications). If you'd want to cite something not in the map, drop it.

--- IPC CAPABILITY PROFILE ---
${profile}
--- END PROFILE ---`;

  const agent = new Agent({
    name: "RFI Drafter",
    model: DRAFTER_MODEL,
    outputType: DrafterOutputSchema,
    tools,
    instructions,
  });

  return { agent, promptHash: hashPrompt(instructions), model: DRAFTER_MODEL };
}
