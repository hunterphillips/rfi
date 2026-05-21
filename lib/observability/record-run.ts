import { createClient } from "@/lib/supabase/server";

export type AgentStage =
  | "parser"
  | "scope"
  | "planner"
  | "researcher"
  | "architect"
  | "drafter"
  | "editor"
  | "salvager";

export type RecordRunInput = {
  stage: AgentStage;
  draftId: string;
  topicIndex?: number;
  model: string;
  promptHash?: string;
  traceId?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  salvaged?: boolean;
  budgetUsed?: Record<string, unknown>;
  error?: string;
  rawTelemetry?: Record<string, unknown>;
};

/**
 * Append-only telemetry row for a single agent stage execution. Best-effort:
 * swallows + logs failures (telemetry must never break a workflow). RLS
 * restricts inserts to drafts the caller owns; SSE routes call this server-side
 * as the authenticated user.
 */
export async function recordRun(input: RecordRunInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("agent_runs").insert({
      draft_id: input.draftId,
      topic_index: input.topicIndex ?? null,
      stage: input.stage,
      model: input.model,
      prompt_hash: input.promptHash ?? null,
      trace_id: input.traceId ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
      latency_ms: input.latencyMs ?? null,
      salvaged: input.salvaged ?? false,
      budget_used: input.budgetUsed ?? null,
      error: input.error ?? null,
      raw_telemetry: input.rawTelemetry ?? null,
    });
    if (error) {
      console.warn(
        `[record-run] insert failed (stage=${input.stage}): ${error.message}`,
      );
    }
  } catch (e) {
    console.warn(
      `[record-run] failed (stage=${input.stage}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Extract token usage from an agent run result. Shape per @openai/agents:
 * `result.runContext.usage.{inputTokens,outputTokens}`. Returns `{}` if usage
 * is unavailable so callers can spread safely.
 */
export function extractUsage(result: {
  runContext?: { usage?: { inputTokens?: number; outputTokens?: number } };
}): { tokensIn?: number; tokensOut?: number } {
  const u = result.runContext?.usage;
  if (!u) return {};
  return {
    tokensIn: u.inputTokens,
    tokensOut: u.outputTokens,
  };
}
