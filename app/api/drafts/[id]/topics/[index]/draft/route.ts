import { NextRequest } from "next/server";
import { withTrace, generateTraceId, run } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { makeDrafter } from "@/lib/agents/drafter";
import type { DraftRow, Source } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type DraftEvent =
  | { type: "topic.started"; index: number }
  | {
      type: "topic.complete";
      index: number;
      content: string;
      sources: Source[];
    }
  | { type: "topic.error"; index: number; message: string }
  | { type: "cancelled" }
  | { type: "done" }
  | { type: "error"; message: string };

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; index: string }>;
  },
) {
  const { id, index: indexStr } = await params;
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0) {
    return new Response("Bad topic index", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { feedback?: string } = {};
  try {
    body = (await req.json()) as { feedback?: string };
  } catch {
    // empty body fine
  }
  const feedback = body.feedback?.trim() ?? "";

  const { data: draft, error: loadErr } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single<DraftRow>();
  if (loadErr || !draft) return new Response("Not found", { status: 404 });

  if (draft.status !== "ready" && draft.status !== "in_review") {
    return new Response(
      `Cannot regenerate while draft status is "${draft.status}"`,
      { status: 409 },
    );
  }
  if (index >= draft.topics.length) {
    return new Response("Topic index out of range", { status: 400 });
  }

  const topic = draft.topics[index];
  if (topic.capability_map === null) {
    return new Response(
      "Topic has no capability map; re-research before redrafting",
      { status: 409 },
    );
  }
  const previousContent = topic.content ?? "";
  const previousSources = topic.sources;

  const draftingTopics = draft.topics.map((t, i) =>
    i === index
      ? { ...t, status: "drafting" as const, content: null, sources: [] }
      : t,
  );
  await supabase
    .from("drafts")
    .update({ topics: draftingTopics, cancel_requested: false })
    .eq("id", id);

  const traceId = generateTraceId();
  console.log(
    `[topic-draft ${id}/${index}] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DraftEvent) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      };

      const ac = new AbortController();
      let cancelled = false;
      const cancelPoll = setInterval(async () => {
        try {
          const { data } = await supabase
            .from("drafts")
            .select("cancel_requested")
            .eq("id", id)
            .single<{ cancel_requested: boolean }>();
          if (data?.cancel_requested) {
            cancelled = true;
            ac.abort();
          }
        } catch {
          // poll failures non-fatal
        }
      }, 2000);

      try {
        send({ type: "topic.started", index });

        const promptParts: string[] = [
          JSON.stringify({
            topic: topic.text,
            capability_map: topic.capability_map,
          }),
        ];
        if (previousContent) {
          promptParts.push("\n\n## Previous draft\n\n" + previousContent);
        }
        if (feedback) {
          promptParts.push(
            "\n\n## Reviewer feedback on the previous draft\n\n" +
              feedback +
              "\n\nProduce a new draft that addresses this feedback. Preserve anything in the previous draft that isn't called out as a problem.",
          );
        } else if (previousContent) {
          promptParts.push(
            "\n\nProduce a new draft. Try a different angle or tighten the existing one.",
          );
        }

        try {
          const drafter = await makeDrafter({
            attached: draft.attached_context ?? [],
          });
          await withTrace(
            "rfi-topic-draft",
            async () => {
              const result = await run(drafter, promptParts.join(""), {
                signal: ac.signal,
              });
              const out = result.finalOutput;
              if (!out) throw new Error("Empty drafter output");

              const seen = new Set<string>();
              const dedup: Source[] = [];
              for (const s of out.sources) {
                if (!seen.has(s.url)) {
                  seen.add(s.url);
                  dedup.push(s);
                }
              }

              const { data: latest } = await supabase
                .from("drafts")
                .select("topics")
                .eq("id", id)
                .single<{ topics: DraftRow["topics"] }>();
              const next = (latest?.topics ?? draftingTopics).map((q, i) =>
                i === index
                  ? {
                      ...q,
                      status: "drafted" as const,
                      content: out.content,
                      sources: dedup,
                    }
                  : q,
              );
              await supabase
                .from("drafts")
                .update({ topics: next, cancel_requested: false })
                .eq("id", id);

              send({
                type: "topic.complete",
                index,
                content: out.content,
                sources: dedup,
              });
              send({ type: "done" });
            },
            { traceId },
          );
        } catch (e) {
          // Restore the topic to its pre-regen state. Same path for error and cancel.
          const { data: latest } = await supabase
            .from("drafts")
            .select("topics")
            .eq("id", id)
            .single<{ topics: DraftRow["topics"] }>();
          const next = (latest?.topics ?? draftingTopics).map((q, i) =>
            i === index
              ? {
                  ...q,
                  status: previousContent
                    ? ("drafted" as const)
                    : ("failed" as const),
                  content: previousContent || null,
                  sources: previousContent ? previousSources : [],
                }
              : q,
          );
          await supabase
            .from("drafts")
            .update({ topics: next, cancel_requested: false })
            .eq("id", id);
          if (cancelled) {
            send({ type: "cancelled" });
          } else {
            const message = e instanceof Error ? e.message : "Drafter failed";
            send({ type: "topic.error", index, message });
          }
          send({ type: "done" });
        }
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Pipeline failed",
        });
      } finally {
        clearInterval(cancelPoll);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
