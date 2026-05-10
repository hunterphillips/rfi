import { run } from "@openai/agents";
import { architectAgent } from "@/lib/agents/architect";
import { plannerAgent, type SearchItem } from "@/lib/agents/planner";
import {
  runResearcher,
  type ResearcherOutput,
  type ResearcherTelemetry,
} from "@/lib/agents/researcher";
import { makeSnDocsServer } from "@/lib/agents/tools/sn-docs";
import type {
  CapabilityMap,
  DraftTopic,
  FeedbackEntry,
  PlanItem,
  ResearchSummary,
  Scope,
} from "@/lib/types";
import type { ResearchEvent } from "./events";

export type ResearchOptions = {
  scope?: Scope | null;
  signal?: AbortSignal;
  onEvent?: (e: ResearchEvent) => void;
};

const emptyEmit: (e: ResearchEvent) => void = () => {};

/**
 * Phase 1: for each topic in parallel: Planner → parallel Researchers → Architect.
 *
 * Mutates the supplied `topics` array in place: sets `plan`, `research`,
 * `capability_map`, `status` on each. MCP server is connected once and
 * shared across all researchers, then closed.
 */
export async function runResearchWorkflow(
  topics: DraftTopic[],
  opts: ResearchOptions = {},
): Promise<void> {
  const emit = opts.onEvent ?? emptyEmit;
  if (topics.length === 0) return;

  const mcp = makeSnDocsServer({
    blockedToolNames: ["sn_search_docs", "sn_get_doc"],
  });
  await mcp.connect();
  try {
    await Promise.all(
      topics.map((topic) =>
        researchOneTopic(topic, mcp, emit, opts.signal, undefined, opts.scope),
      ),
    );
  } finally {
    try {
      await mcp.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Re-run Plan + Researchers + Architect for ONE topic with feedback baked in.
 * Mutates the passed `topic` and appends to its `feedback_history`.
 */
export async function updateTopic(
  topic: DraftTopic,
  feedback: string,
  opts: ResearchOptions = {},
): Promise<void> {
  const emit = opts.onEvent ?? emptyEmit;

  topic.feedback_history.push({
    ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    feedback,
  } satisfies FeedbackEntry);

  const mcp = makeSnDocsServer({
    blockedToolNames: ["sn_search_docs", "sn_get_doc"],
  });
  await mcp.connect();
  try {
    await researchOneTopic(topic, mcp, emit, opts.signal, feedback, opts.scope);
  } finally {
    try {
      await mcp.close();
    } catch {
      // ignore
    }
  }
}

async function researchOneTopic(
  topic: DraftTopic,
  mcp: Awaited<ReturnType<typeof makeSnDocsServer>>,
  emit: (e: ResearchEvent) => void,
  signal?: AbortSignal,
  feedback?: string,
  scope?: Scope | null,
): Promise<void> {
  const tq = Date.now();

  // Reset prior content (re-runs overwrite).
  topic.plan = [];
  topic.research = [];
  topic.capability_map = null;
  topic.status = "planning";

  const plannerInput = formatPlannerInput(topic.text, scope, feedback);

  // 1. Plan
  emit({ type: "planner.started", index: topic.index });
  let plan: { items: SearchItem[] };
  try {
    const result = await run(plannerAgent, plannerInput, { signal });
    if (!result.finalOutput || result.finalOutput.items.length === 0) {
      throw new Error("Planner produced empty plan");
    }
    plan = result.finalOutput;
  } catch (e) {
    topic.status = "failed";
    const message = e instanceof Error ? e.message : "planner error";
    emit({ type: "planner.error", index: topic.index, message });
    return;
  }

  topic.plan = plan.items.map<PlanItem>((it) => ({
    query: it.query,
    source: it.source,
    reason: it.reason,
    bundle: it.bundle ?? null,
  }));
  emit({ type: "planner.complete", index: topic.index, plan: topic.plan });

  // 2. Researchers (parallel)
  topic.status = "researching";
  type Successful = {
    item: SearchItem;
    output: ResearcherOutput;
    telemetry: ResearcherTelemetry;
  };
  const researcherResults = await Promise.all(
    plan.items.map(async (item, rIndex) => {
      emit({
        type: "researcher.started",
        topic_index: topic.index,
        r_index: rIndex,
        query: item.query,
        source: item.source,
      });
      try {
        const { output, telemetry } = await runResearcher(item, mcp);
        if (!output) throw new Error("Researcher produced no output");
        emit({
          type: "researcher.complete",
          topic_index: topic.index,
          r_index: rIndex,
          summary_chars: output.summary.length,
          sources: output.sources,
          tool_calls: telemetry.tool_calls,
          salvaged: telemetry.salvaged,
        });
        return { item, output, telemetry } satisfies Successful;
      } catch (e) {
        const message = e instanceof Error ? e.message : "researcher error";
        emit({
          type: "researcher.error",
          topic_index: topic.index,
          r_index: rIndex,
          message,
        });
        return null;
      }
    }),
  );
  const successful = researcherResults.filter((r): r is Successful => r !== null);

  topic.research = successful.map<ResearchSummary>(
    ({ item, output, telemetry }) => ({
      query: item.query,
      source: item.source,
      summary: output.summary,
      sources: output.sources,
      telemetry,
    }),
  );

  if (successful.length === 0) {
    topic.status = "failed";
    emit({
      type: "architect.error",
      index: topic.index,
      message: "all researchers failed",
    });
    return;
  }

  // 3. Architect
  emit({
    type: "architect.started",
    index: topic.index,
    research_count: successful.length,
  });
  const architectInput = formatArchitectInput(topic.text, successful, feedback);
  let cap: CapabilityMap;
  try {
    const result = await run(architectAgent, architectInput, { signal });
    if (!result.finalOutput) throw new Error("Architect produced no output");
    cap = result.finalOutput;
  } catch (e) {
    topic.status = "failed";
    const message = e instanceof Error ? e.message : "architect error";
    emit({ type: "architect.error", index: topic.index, message });
    return;
  }

  topic.capability_map = cap;
  topic.status = "researched";
  const duration_ms = Date.now() - tq;
  emit({
    type: "architect.complete",
    index: topic.index,
    capability_map: cap,
    duration_ms,
  });
  emit({ type: "topic.complete", index: topic.index, duration_ms });
}

function formatPlannerInput(
  topicText: string,
  scope?: Scope | null,
  feedback?: string,
): string {
  const parts: string[] = [topicText];
  // Only inject scope when something concrete was found. A summary alone
  // (e.g. "RFI does not reference ServiceNow") is noise for the Planner.
  if (scope && (scope.products.length > 0 || scope.version)) {
    const lines: string[] = ["", "## RFI scope"];
    if (scope.summary) lines.push(scope.summary);
    if (scope.products.length > 0) {
      lines.push(`Products: ${scope.products.map((p) => p.name).join(", ")}`);
    }
    lines.push(`Version: ${scope.version ?? "unspecified"}`);
    parts.push(lines.join("\n"));
  }
  if (feedback) {
    parts.push(`\n## Reviewer feedback to incorporate\n${feedback}`);
  }
  return parts.join("\n");
}

function formatArchitectInput(
  topicText: string,
  successful: { item: SearchItem; output: ResearcherOutput }[],
  feedback?: string,
): string {
  const parts: string[] = [`# Topic\n\n${topicText}\n`];
  if (feedback) {
    parts.push(`## Reviewer feedback to incorporate\n\n${feedback}\n`);
  }
  parts.push("## Research findings\n");
  successful.forEach(({ item, output }, i) => {
    parts.push(`### Finding ${i + 1}: ${item.query}\n`);
    parts.push(output.summary);
    if (output.sources.length > 0) {
      parts.push("\n**Sources consulted:**");
      for (const s of output.sources) {
        parts.push(`- [${s.title}](${s.url})`);
      }
    }
    parts.push("");
  });
  return parts.join("\n");
}
