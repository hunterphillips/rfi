import { createHash } from "node:crypto";

/**
 * Stable short hash of an agent prompt template. Truncated to 16 hex chars —
 * collision-safe at our prompt scale, easy to eyeball in DB rows.
 *
 * Hash only the **template** (with dynamic placeholders already interpolated
 * for static branches like researcher sn vs web). Do NOT hash per-run inputs
 * (user message, scope summary, feedback) — those vary every run and would
 * destroy the rollup signal that "prompt version X had salvage rate Y."
 */
export function hashPrompt(template: string): string {
  return createHash("sha256").update(template).digest("hex").slice(0, 16);
}
