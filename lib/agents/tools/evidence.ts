/**
 * Researcher tool-interface types.
 *
 * The Researcher's three tool wrappers (web_search, sn_search_docs, sn_get_doc)
 * share a single per-run "bag" that holds typed evidence + a tool-call budget.
 * Wrappers check the budget before making upstream calls, push typed
 * EvidenceItems on success, and return compact normalized JSON to the model.
 *
 * Built so the salvager (lib/agents/researcher.ts) consumes typed evidence
 * directly instead of stringified raw payloads.
 */

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  rank: number;
};

export type EvidenceItem =
  | {
      kind: "sn_search";
      query: string;
      bundle: string | null;
      results: SearchResult[];
    }
  | {
      kind: "sn_get_doc";
      url: string;
      title: string | null;
      content_preview: string;
    }
  | {
      kind: "web_search";
      query: string;
      results: SearchResult[];
    };

export type ToolBudget = {
  maxSearches: number;
  maxDocFetches: number;
  searchesUsed: number;
  docFetchesUsed: number;
};

export type ResearcherBag = {
  evidence: EvidenceItem[];
  budget: ToolBudget;
};

/**
 * Default budgets ship lenient. They allow one query refinement past the
 * planner's intended single search. Tighten via the eval harness follow-up.
 */
export const DEFAULT_SN_BUDGET = {
  maxSearches: 2,
  maxDocFetches: 1,
} as const;

export const DEFAULT_WEB_BUDGET = {
  maxSearches: 2,
  maxDocFetches: 0,
} as const;

/** Per-result snippet cap (chars). Past this the model has diminishing returns. */
export const SNIPPET_MAX = 400;
/** Per-doc-fetch content preview cap (chars). */
export const CONTENT_PREVIEW_MAX = 4000;

export function makeBag(
  base: { maxSearches: number; maxDocFetches: number },
): ResearcherBag {
  return {
    evidence: [],
    budget: { ...base, searchesUsed: 0, docFetchesUsed: 0 },
  };
}

/** Truncate a string to `max` chars; append "…" when truncated. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export type BudgetExhausted = { ok: false; error: string };

export function checkSearchBudget(
  bag: ResearcherBag | undefined,
): BudgetExhausted | null {
  if (!bag) return null;
  if (bag.budget.searchesUsed >= bag.budget.maxSearches) {
    return {
      ok: false,
      error: `search budget exhausted (${bag.budget.searchesUsed}/${bag.budget.maxSearches})`,
    };
  }
  return null;
}

export function checkDocFetchBudget(
  bag: ResearcherBag | undefined,
): BudgetExhausted | null {
  if (!bag) return null;
  if (bag.budget.docFetchesUsed >= bag.budget.maxDocFetches) {
    return {
      ok: false,
      error: `doc-fetch budget exhausted (${bag.budget.docFetchesUsed}/${bag.budget.maxDocFetches})`,
    };
  }
  return null;
}
