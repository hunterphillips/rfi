import { Agent, run } from "@openai/agents";
import { z } from "zod";
import type { Scope } from "@/lib/types";
import type { SearchItem } from "@/lib/agents/planner";
import type { ResearcherOutput } from "@/lib/agents/researcher";
import type { JudgeScore } from "./types";

const JUDGE_MODEL = "gpt-5";

// OpenAI structured outputs reject schemas with `propertyNames` (which
// z.record() emits). Each judge has its own fixed-shape output schema and we
// map to the generic { scores, notes } shape at the export boundary.
const NotesField = z
  .string()
  .describe("1-3 sentences justifying the scores. Cite specifics.");

const ParserJudgeSchema = z.object({
  coverage: z.number().min(0).max(3),
  precision: z.number().min(0).max(3),
  format_fidelity: z.number().min(0).max(3),
  notes: NotesField,
});

const ScopeJudgeSchema = z.object({
  correctness: z.number().min(0).max(3),
  abstention: z.number().min(0).max(3),
  notes: NotesField,
});

const ResearcherJudgeSchema = z.object({
  coverage: z.number().min(0).max(3),
  groundedness: z.number().min(0).max(3),
  notes: NotesField,
});

const parserJudgeAgent = new Agent({
  name: "Parser Judge",
  model: JUDGE_MODEL,
  outputType: ParserJudgeSchema,
  instructions: `You judge an RFI Topic Extractor's output against a gold list.

Inputs (JSON):
- expected: gold list of topic texts the extractor should produce.
- extracted: list of topic texts the extractor produced.

Score these criteria 0-3:

coverage: did every expected topic surface?
  3 = every expected topic present (light rewording fine)
  2 = exactly one missing or merged into another
  1 = several missing or merged
  0 = most missing

precision: did the output avoid spurious / out-of-scope items? Spurious includes vendor/firm info, pricing, past performance, submission mechanics, and standard admin (deadlines, contacts, T&Cs).
  3 = no spurious items
  2 = one spurious item
  1 = several spurious items
  0 = many spurious items

format_fidelity: did extracted items preserve source wording without merging or splitting?
  3 = wording preserved, no merges/splits
  2 = one structural issue
  1 = several structural issues
  0 = pervasive rewriting or restructuring

Score every criterion. Be specific in notes: name which expected topic was missed or which extracted item was spurious.`,
});

const scopeJudgeAgent = new Agent({
  name: "Scope Judge",
  model: JUDGE_MODEL,
  outputType: ScopeJudgeSchema,
  instructions: `You judge an RFI Scope Extractor's output against the gold scope.

Inputs (JSON):
- expected: gold Scope { products: [{name}], version, summary } | null. Null means the RFI does not reference ServiceNow at all.
- actual: extractor output of the same shape (or null).

Score these criteria 0-3:

correctness: do the products + version match expected? Canonical naming counts ("Now Assist for ITSM" vs. "Now Assist"), but trivial casing/article differences don't.
  3 = products and version match expected
  2 = one product missing, misnamed, or extra; version correct
  1 = multiple products wrong or version wrong
  0 = pervasive errors

abstention: did the extractor correctly NOT invent scope when the RFI doesn't specify one?
  When expected products is empty AND expected version is null (or expected is null):
    3 = actual products empty + version null (correct abstention)
    2 = added one stray product or version
    1 = invented multiple products/version
    0 = fully hallucinated scope
  When expected has non-empty scope:
    3 = actual is non-empty (didn't drop everything)
    1 = actual is empty (false abstention)

Score every criterion. Be specific in notes.`,
});

const researcherJudgeAgent = new Agent({
  name: "Researcher Judge",
  model: JUDGE_MODEL,
  outputType: ResearcherJudgeSchema,
  instructions: `You judge a Researcher's output for one SearchItem against expected sub-topics.

Inputs (JSON):
- item: { query, source, reason, bundle } the researcher was given.
- expected_topics: list of sub-topics the summary should substantively touch.
- output: { summary, sources } the researcher produced.

Score these criteria 0-3:

coverage: does the summary substantively address each expected_topic?
  3 = every expected topic is substantively present
  2 = one missing or only adjacently mentioned
  1 = multiple missing
  0 = most missing or summary is off-topic

groundedness: are factual claims (version names, product names, specific behaviors, numbers) supported by the listed sources? Verbatim quotes for specifics are a positive signal.
  3 = all factual claims attributable to a listed source; no unsupported specifics
  2 = one claim is unsupported or sources are thin for it
  1 = several unsupported claims; speculation creeping in
  0 = summary speculates broadly; sources mostly decorative

Score every criterion. Be specific in notes: name the unmet sub-topic or the unsupported claim.`,
});

export async function judgeParser(
  expected: string[],
  extracted: string[],
): Promise<JudgeScore> {
  const result = await run(
    parserJudgeAgent,
    JSON.stringify({ expected, extracted }),
  );
  if (!result.finalOutput) throw new Error("Parser judge produced no output");
  const { coverage, precision, format_fidelity, notes } = result.finalOutput;
  return {
    scores: { coverage, precision, format_fidelity },
    notes,
  };
}

export async function judgeScope(
  expected: Scope | null,
  actual: Scope | null,
): Promise<JudgeScore> {
  const result = await run(
    scopeJudgeAgent,
    JSON.stringify({ expected, actual }),
  );
  if (!result.finalOutput) throw new Error("Scope judge produced no output");
  const { correctness, abstention, notes } = result.finalOutput;
  return {
    scores: { correctness, abstention },
    notes,
  };
}

export async function judgeResearcher(
  item: SearchItem,
  expectedTopics: string[],
  output: ResearcherOutput,
): Promise<JudgeScore> {
  const result = await run(
    researcherJudgeAgent,
    JSON.stringify({ item, expected_topics: expectedTopics, output }),
  );
  if (!result.finalOutput)
    throw new Error("Researcher judge produced no output");
  const { coverage, groundedness, notes } = result.finalOutput;
  return {
    scores: { coverage, groundedness },
    notes,
  };
}
