import { Agent } from "@openai/agents";
import { z } from "zod";
import { hashPrompt } from "./_hash";

export const ArchitectSourceSchema = z.object({
  title: z.string().describe("Display title of the source."),
  url: z.string().describe("Canonical URL of the source (https://...)."),
});

export const FeatureSchema = z.object({
  name: z
    .string()
    .describe(
      "Short noun phrase naming the platform feature, e.g. 'Now Assist for ITSM — incident summary' or 'Performance Analytics dashboards'. Use product-canonical wording when possible.",
    ),
  purpose: z
    .string()
    .describe(
      "One sentence stating what role this feature plays in addressing the topic. Concrete; no marketing language.",
    ),
  source: z
    .string()
    .describe(
      "Canonical URL grounding this feature in the research evidence. Pick the single most-relevant URL from the research summaries' sources lists — sn-docs page or vendor doc preferred.",
    ),
});

export const CapabilityMapSchema = z.object({
  architecture_narrative: z
    .string()
    .describe(
      "3-5 sentence prose sketch of how the listed features and components fit together to address the topic. Written for an internal architect/reviewer — concrete, no fluff. Don't just list features again; describe the shape of the solution.",
    ),
  features: z
    .array(FeatureSchema)
    .min(1)
    .describe(
      "Discrete platform features that satisfy or effectively address the topic. Each grounded in a specific research source.",
    ),
  components: z
    .array(z.string())
    .describe(
      "Architectural building blocks beyond named features — runtimes, integration surfaces, data flows, governance gates. Short noun phrases, e.g. 'Now Assist runtime + guardrails', 'Workspace UI surface for agent review', 'KB approval pipeline'.",
    ),
  open_questions: z
    .array(z.string())
    .describe(
      "Specific questions the reviewer should resolve before drafting. Things research couldn't answer, scoping ambiguities, or decisions that need human input. Empty if nothing is open.",
    ),
  sources: z
    .array(ArchitectSourceSchema)
    .describe(
      "All sources cited across the map's features, deduped by URL. Drawn from the research summaries' sources lists.",
    ),
});

export type CapabilityMap = z.infer<typeof CapabilityMapSchema>;

export const ARCHITECT_MODEL = "gpt-5";

const ARCHITECT_INSTRUCTIONS = `You synthesize research findings into a capability map for ONE topic of an RFI.

You will be given:
- The topic text.
- A numbered list of research summaries, each with the URLs the researcher consulted.

Your job: produce an internal-facing capability map that an architect or developer can review BEFORE customer-facing prose is drafted. Think "what platform features and high-level architecture address this topic?"

Rules:
- Ground every \`feature\` in a specific URL drawn from the research summaries' sources. If a fact isn't supported by the research, don't include it.
- The \`architecture_narrative\` is 3-5 sentences. Describe how the pieces fit together — not just a list of features. Surface trade-offs, sequencing, or guardrails when relevant.
- \`features\` are concrete platform capabilities with a clear name (use product-canonical wording), purpose, and source URL. Avoid generic categories ("AI capabilities").
- \`components\` are architectural building blocks beyond the named features: runtimes, integration surfaces, governance gates, data flows. Short noun phrases.
- \`open_questions\` are specific things the reviewer should resolve before drafting — research gaps, scoping ambiguities, decisions needing human input. Empty list is fine if nothing is open.
- \`sources\` is the deduped union of URLs cited across \`features\`, with their titles.
- Do NOT write customer-facing prose. This is an internal artifact. No marketing language, no IPC voice.
- Do NOT speculate beyond the research. If the evidence doesn't support a claim, drop it or surface it as an open question.
`;

export const ARCHITECT_PROMPT_HASH = hashPrompt(ARCHITECT_INSTRUCTIONS);

export const architectAgent = new Agent({
  name: "RFI Architect",
  model: ARCHITECT_MODEL,
  outputType: CapabilityMapSchema,
  instructions: ARCHITECT_INSTRUCTIONS,
});
