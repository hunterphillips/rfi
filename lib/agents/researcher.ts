import {
  Agent,
  run,
  type MCPServer,
  type RunErrorHandlerInput,
  type RunErrorHandlerResult,
} from '@openai/agents';
import { z } from 'zod';
import type { SearchItem } from './planner';
import { makeSnSearchTool } from './tools/sn-search';
import { makeSnGetDocTool } from './tools/sn-get-doc';
import { makeWebSearchTool } from './tools/web-search';
import {
  DEFAULT_SN_BUDGET,
  DEFAULT_WEB_BUDGET,
  makeBag,
  type ResearcherBag,
} from './tools/evidence';
import { hashPrompt } from './_hash';

export const RESEARCHER_MODEL = 'gpt-5-mini';
export const SALVAGER_MODEL = 'gpt-5-mini';

// Outermost backstop: cap reasoning rounds per researcher. Per-tool budgets
// (in evidence.ts) are the primary control; this catches the rare case where
// the model loops on reasoning instead of tools. When tripped, the salvage
// handler synthesizes a ResearcherOutput from typed evidence.
export const RESEARCHER_MAX_TURNS = 6;

export const ResearcherSourceSchema = z.object({
  title: z.string().describe('Display title of the source.'),
  url: z.string().describe('Canonical URL of the source (https://...).'),
});

export const ResearcherOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      '4-8 sentence factual summary of what the search surfaced. Include verbatim quotes for any version numbers, product names, or feature specifics — do not paraphrase those. Do not speculate beyond what the sources say.',
    ),
  sources: z
    .array(ResearcherSourceSchema)
    .describe(
      'URLs of the sources you actually consulted (search results, doc pages).',
    ),
});

export type ResearcherOutput = z.infer<typeof ResearcherOutputSchema>;

export type ResearcherTelemetry = {
  turns: number;
  tool_calls: number;
  salvaged: boolean;
  max_turns: number;
  searches_used: number;
  doc_fetches_used: number;
};

const SN_GUIDANCE =
  'Call `sn_search_docs` with the query. If the user message contains a `Bundle:` line, pass that bundle as the `bundle` arg. If a top result needs more detail to answer the topic, call `sn_get_doc` on its URL. Then summarize.';
const WEB_GUIDANCE =
  'Call `web_search` with the query, then summarize the top results.';

function researcherInstructions(guidance: string): string {
  return `You investigate ONE specific aspect of an RFI topic.

The user message is the search query. ${guidance}

Rules:
- Return a 4-8 sentence factual summary. Include verbatim quotes for any version numbers, product names, feature specifics.
- Do not speculate or generalize beyond what the sources say.
- \`sources\` should list ONLY the URLs you actually consulted (search hits you treated as evidence, plus any sn_get_doc URL you fetched).
- If a tool returns \`{ ok: false, error }\`, stop calling tools and summarize from what you already have.
`;
}

const RESEARCHER_SN_INSTRUCTIONS = researcherInstructions(SN_GUIDANCE);
const RESEARCHER_WEB_INSTRUCTIONS = researcherInstructions(WEB_GUIDANCE);

export const RESEARCHER_SN_PROMPT_HASH = hashPrompt(RESEARCHER_SN_INSTRUCTIONS);
export const RESEARCHER_WEB_PROMPT_HASH = hashPrompt(
  RESEARCHER_WEB_INSTRUCTIONS,
);

function makeResearcher(
  item: SearchItem,
  mcp: MCPServer,
  bag: ResearcherBag,
): Agent<unknown, typeof ResearcherOutputSchema> {
  const sn = item.source === 'sn_docs';
  const tools = sn
    ? [makeSnSearchTool(mcp, bag), makeSnGetDocTool(mcp, bag)]
    : [makeWebSearchTool(bag)];

  return new Agent({
    name: `RFI Researcher (${item.source})`,
    model: RESEARCHER_MODEL,
    outputType: ResearcherOutputSchema,
    mcpServers: sn ? [mcp] : [],
    tools,
    instructions: sn ? RESEARCHER_SN_INSTRUCTIONS : RESEARCHER_WEB_INSTRUCTIONS,
  });
}

// Rare-fallback salvager. Triggered only when RESEARCHER_MAX_TURNS trips —
// per-tool budgets cap upstream activity before we get here. Consumes typed
// evidence directly (no string parsing).
const SALVAGER_INSTRUCTIONS = `You salvage a researcher run that hit its turn limit before producing a structured summary.

You will be given (as JSON):
- \`query\`: the search query the researcher was working on.
- \`evidence\`: a list of typed evidence items the researcher gathered before being cut off. Each item is \`kind\`-tagged:
  - \`{ kind: "sn_search" | "web_search", query, results: [{title, url, snippet, rank}, ...] }\`
  - \`{ kind: "sn_get_doc", url, title, content_preview }\`

Produce a \`ResearcherOutput\` summary based ONLY on the content in those evidence items. Don't speculate beyond them.

Rules:
- 4-8 sentence factual summary of what the captured evidence actually contains.
- \`sources\` should list the URLs surfaced in the evidence: the \`url\` field on search results, plus any \`url\` on \`sn_get_doc\` items.
- If the captured evidence is too thin to summarize meaningfully, return a brief note acknowledging that with whatever sources are present.
`;

export const SALVAGER_PROMPT_HASH = hashPrompt(SALVAGER_INSTRUCTIONS);

const salvagerAgent = new Agent({
  name: 'Researcher Salvager',
  model: SALVAGER_MODEL,
  outputType: ResearcherOutputSchema,
  instructions: SALVAGER_INSTRUCTIONS,
});

export type RunResearcherOptions = {
  /**
   * Override the per-source default budget. Used by the budget-sweep eval to
   * compare (maxSearches, maxDocFetches) combinations without duplicating the
   * researcher orchestration. Production code should rely on defaults.
   */
  budget?: { maxSearches: number; maxDocFetches: number };
};

/**
 * Run a researcher with graceful salvage on max-turns. Tool budgets in the
 * `bag` are the primary control; max-turns is the outer backstop. Returns
 * the output and a small telemetry record for observability.
 */
export async function runResearcher(
  item: SearchItem,
  mcp: MCPServer,
  opts: RunResearcherOptions = {},
): Promise<{
  output: ResearcherOutput | null;
  telemetry: ResearcherTelemetry;
  tokensIn?: number;
  tokensOut?: number;
}> {
  const baseBudget =
    opts.budget ??
    (item.source === 'sn_docs' ? DEFAULT_SN_BUDGET : DEFAULT_WEB_BUDGET);
  const bag = makeBag(baseBudget);
  const researcher = makeResearcher(item, mcp, bag);
  let salvaged = false;

  const onMaxTurns: (
    input: RunErrorHandlerInput<unknown, typeof researcher>,
  ) => Promise<RunErrorHandlerResult<typeof researcher>> = async () => {
    salvaged = true;
    if (bag.evidence.length === 0) {
      return {
        finalOutput: {
          summary: '(turn cap reached before any tool returned data)',
          sources: [],
        },
      };
    }
    const salvageInput = JSON.stringify({
      query: item.query,
      evidence: bag.evidence,
    });
    const salvageResult = await run(salvagerAgent, salvageInput, {
      maxTurns: 2,
    });
    const out = salvageResult.finalOutput ?? {
      summary: '(salvage produced no structured output)',
      sources: [],
    };
    return { finalOutput: out, includeInHistory: true };
  };

  const userMessage =
    item.bundle && item.source === 'sn_docs'
      ? `Query: ${item.query}\nBundle: ${item.bundle}`
      : item.query;
  const result = await run(researcher, userMessage, {
    maxTurns: RESEARCHER_MAX_TURNS,
    errorHandlers: { maxTurns: onMaxTurns },
  });

  return {
    output: result.finalOutput ?? null,
    telemetry: {
      turns: 0,
      tool_calls: bag.budget.searchesUsed + bag.budget.docFetchesUsed,
      salvaged,
      max_turns: RESEARCHER_MAX_TURNS,
      searches_used: bag.budget.searchesUsed,
      doc_fetches_used: bag.budget.docFetchesUsed,
    },
    tokensIn: result.runContext?.usage?.inputTokens,
    tokensOut: result.runContext?.usage?.outputTokens,
  };
}
