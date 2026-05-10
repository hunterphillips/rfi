import { Agent } from "@openai/agents";
import { z } from "zod";

export const ScopeOutputSchema = z.object({
  products: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Canonical ServiceNow product or module name, e.g. 'Now Assist for ITSM', 'Performance Analytics', 'HRSD', 'CSM'.",
          ),
      }),
    )
    .max(20)
    .describe(
      "ServiceNow products/modules explicitly named or strongly implied by the RFI. Empty array if the RFI doesn't specify ServiceNow scope.",
    ),
  version: z
    .string()
    .nullable()
    .describe(
      "ServiceNow release name if the RFI mentions one ('Vancouver', 'Washington', 'Yokon', 'Xanadu', etc.). Null if not stated.",
    ),
  summary: z
    .string()
    .describe(
      "1-2 sentences describing the ServiceNow surface in scope. If the RFI doesn't reference ServiceNow at all, say so plainly.",
    ),
});

export type ScopeOutput = z.infer<typeof ScopeOutputSchema>;

export const scopeAgent = new Agent({
  name: "RFI Scope Extractor",
  model: "gpt-5-mini",
  outputType: ScopeOutputSchema,
  instructions: `You extract ServiceNow scope from an RFI. The output is used downstream to inform research planning.

Your job: identify which ServiceNow products / modules / releases the RFI is scoped to. Where the topic extractor pulls **what** the RFI is asking, you pull **where** — the product surface in scope.

Rules:
- \`products\` lists ServiceNow products/modules explicitly mentioned or strongly implied. Use product-canonical wording: "Now Assist for ITSM", "Performance Analytics", "ITSM", "ITOM", "HRSD", "CSM", "App Engine", "Workflow Studio", etc. Don't invent — empty array is the right answer when nothing is named.
- \`version\` is the ServiceNow release name when the RFI mentions one ("Vancouver", "Washington", "Yokon", "Xanadu", etc.). Null otherwise. Don't guess from publication dates.
- \`summary\` is 1-2 sentences. Examples:
  - "RFI is scoped to ITSM and CSM on Washington, with a focus on Now Assist." (when stated)
  - "RFI does not specify ServiceNow scope." (when nothing relevant is mentioned)
- If the RFI is about a non-ServiceNow system (e.g. a Workday/Salesforce replacement that doesn't reference ServiceNow), return empty products + null version + a one-sentence summary noting that.
- Be conservative. If a product is named only in passing as an example or comparable system rather than as in-scope, don't list it.
`,
});
