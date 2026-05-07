import { Agent } from "@openai/agents";
import { z } from "zod";

export const ParserOutputSchema = z.object({
  title: z
    .string()
    .describe(
      "A short (3–8 word) title summarizing the RFI. Sentence case. No trailing punctuation.",
    ),
  questions: z
    .array(
      z.object({
        text: z
          .string()
          .describe(
            "The full question or topic, preserving the source wording. Include any sub-bullets as part of the same string when they belong to the same question.",
          ),
      }),
    )
    .min(1)
    .describe(
      "The discrete questions or topics asked in the RFI, in the order they appear.",
    ),
});

export type ParserOutput = z.infer<typeof ParserOutputSchema>;

export const parserAgent = new Agent({
  name: "RFI Parser",
  model: "gpt-5-mini",
  outputType: ParserOutputSchema,
  instructions: `You extract a list of discrete questions or topics from an RFI (Request for Information) document supplied by the user.

Rules:
- Output **distinct** items only. Do not merge separate questions into one. Do not split a single question into multiple items.
- Preserve the source wording. Light cleanup of formatting artifacts (PDF line wraps, bullet glyphs) is fine; rewriting is not.
- If a question has sub-bullets that are clearly part of the same ask, keep them in one item separated by newlines.
- Ignore boilerplate (deadlines, submission instructions, contact info, signature blocks) — only return the substantive questions or topics the responder must address.
- If the input is not actually an RFI or contains no questions, return an empty \`questions\` array — do not fabricate.
- The \`title\` should be a short, plain summary of the RFI's subject (e.g., "AI/ServiceNow capability inquiry"). Avoid generic titles like "RFI Response."
`,
});
