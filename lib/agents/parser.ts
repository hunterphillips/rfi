import { Agent } from "@openai/agents";
import { z } from "zod";

export const ParserOutputSchema = z.object({
  title: z
    .string()
    .describe(
      "A short (3–8 word) title summarizing the RFI. Sentence case. No trailing punctuation.",
    ),
  topics: z
    .array(
      z.object({
        text: z
          .string()
          .describe(
            "The full topic text, preserving the source wording. Include any sub-bullets as part of the same string when they belong to the same topic.",
          ),
      }),
    )
    .min(1)
    .max(50)
    .describe(
      "The discrete topics in the RFI, in the order they appear. A topic is any substantive item the responder must address — whether phrased as a question, a requirement, a capability statement, or a labeled bullet. Hard cap of 50 — if the input appears to have more, return only the first 50 substantive items.",
    ),
});

export type ParserOutput = z.infer<typeof ParserOutputSchema>;

export const parserAgent = new Agent({
  name: "RFI Topic Extractor",
  model: "gpt-5-mini",
  outputType: ParserOutputSchema,
  instructions: `You extract discrete topics from an RFI (Request for Information) document supplied by the user.

This tool is scoped to **technical and functional requirements only** — what a system, platform, or solution must do or be capable of. Other RFI sections (firm credentials, pricing, past performance, submission mechanics) are out of scope and must be excluded even when they are valid sections of a real RFI response.

A "topic" is any substantive technical or functional item the responder must address. Topics may be phrased as:
- Explicit questions ("How does your solution support X?")
- Requirements / capability statements ("Managers need to build dashboards...")
- Labeled feature bullets ("a) Student Profile Management")
- Section headers describing functionality ("Employer Database Integration")

Rules:
- Output **distinct** items only. Do not merge separate topics into one. Do not split a single topic into multiple items.
- Preserve the source wording. Light cleanup of formatting artifacts (PDF line wraps, bullet glyphs, leading letters like "a)") is fine; rewriting is not.
- If a topic has sub-bullets that are clearly part of the same item, keep them in one entry separated by newlines.
- If a section header introduces a list of sub-topics but has no substantive content of its own (e.g. "Provide a response to each example listed below"), skip the header and extract the sub-items instead. If there are no sub-items, skip it entirely.
- If the input contains no substantive technical or functional topics, return an empty \`topics\` array — do not fabricate.
- The \`title\` should be a short, plain summary of the RFI's subject (e.g., "Student information system modernization"). Avoid generic titles like "RFI Response."

EXCLUDE these categories. They are valid sections of a formal RFI response, but this tool does not address them:
- **Vendor / firm information**: company overview, executive summary, organization profile, mission, history, stature, size, certifications, team bios.
- **Pricing**: price structures, pricing models, cost estimates, fee schedules, rate cards, budgetary tables, per-module costs, licensing tiers.
- **Past performance**: prior experience, similar projects, named past clients, case studies, references.
- **Submission mechanics**: page limits, format directives (e.g. "single PDF"), file naming, upload instructions, marketing-material restrictions.
- **Standard administrative**: deadlines, contact info, signature blocks, evaluation criteria, terms and conditions, NDA / confidentiality language.

If an item could plausibly belong to one of the excluded categories AND a technical/functional category, prefer to exclude — this tool is conservative.
`,
});
