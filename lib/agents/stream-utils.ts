/**
 * Helpers for inspecting `RunStreamEvent`s from `@openai/agents`.
 *
 * The SDK's stream item shapes aren't stably typed in the public surface
 * (rawItem is a union of many protocol shapes), so we use shallow runtime
 * checks instead of trusting types.
 */

const ARG_PREVIEW_MAX = 120;

export function previewArgs(raw: unknown): string {
  if (raw == null) return "";
  try {
    const s = typeof raw === "string" ? raw : JSON.stringify(raw);
    return s.length > ARG_PREVIEW_MAX
      ? s.slice(0, ARG_PREVIEW_MAX) + "…"
      : s;
  } catch {
    return String(raw).slice(0, ARG_PREVIEW_MAX);
  }
}

export function extractToolCall(item: unknown): {
  name: string;
  args: string;
} | null {
  const r = (item as { rawItem?: { name?: unknown; arguments?: unknown } } | undefined)
    ?.rawItem;
  if (!r || typeof r.name !== "string") return null;
  return { name: r.name, args: previewArgs(r.arguments) };
}

export function extractMessageText(item: unknown): string {
  const r = (item as { rawItem?: { content?: unknown; text?: unknown } } | undefined)
    ?.rawItem;
  if (!r) return "";
  if (Array.isArray(r.content)) {
    return r.content
      .map((c: unknown) => {
        if (typeof c === "string") return c;
        const cText = (c as { text?: unknown } | null)?.text;
        return typeof cText === "string" ? cText : "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof r.text === "string") return r.text;
  return "";
}
