import { Agent } from "@openai/agents";
import { z } from "zod";
import { hashPrompt } from "./_hash";
import { loadIpcProfile } from "./_profile";

export const EDITOR_MODEL = "gpt-5";

export const EditorOutputSchema = z.object({
  rewrites: z
    .array(
      z.object({
        index: z
          .number()
          .int()
          .describe(
            "The 0-based index of the topic, matching the input array.",
          ),
        content: z
          .string()
          .describe(
            "The rewritten Markdown response with harmonized voice and tone. May be unchanged from input if no edits are warranted.",
          ),
      }),
    )
    .describe(
      "One rewrite per input topic, in any order. Every input index must appear exactly once.",
    ),
});

export type EditorOutput = z.infer<typeof EditorOutputSchema>;

export type EditorHandle = {
  agent: Agent<unknown, typeof EditorOutputSchema>;
  promptHash: string;
  model: string;
};

export async function makeEditor(): Promise<EditorHandle> {
  const profile = await loadIpcProfile();
  const instructions = `You are the editor for an RFI response drafted by multiple per-topic agents. Your job is voice and tone harmonization.

Edit each topic response so the full document reads as a single, consistent piece:
- Same vocabulary for repeated concepts.
- Consistent register (federal-context formality without bureaucratic jargon).
- Same Markdown style (heading levels, bullet vs paragraph, terminology like "we"/"IPC").
- Eliminate duplicated boilerplate across topics.
- Preserve every factual claim and source — do not invent, drop, or relocate facts.
- Do not change the substance or scope of any response.
- Do not add or remove topics.

Return one rewrite per input topic, keyed by the same \`index\`.

--- IPC CAPABILITY PROFILE ---
${profile}
--- END PROFILE ---`;

  const agent = new Agent({
    name: "RFI Editor",
    model: EDITOR_MODEL,
    outputType: EditorOutputSchema,
    instructions,
  });

  return { agent, promptHash: hashPrompt(instructions), model: EDITOR_MODEL };
}
