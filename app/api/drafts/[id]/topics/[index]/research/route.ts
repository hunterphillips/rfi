import { NextRequest } from "next/server";
import { withTrace, generateTraceId } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { updateTopic } from "@/lib/agents/workflows/research";
import type { ResearchEvent } from "@/lib/agents/workflows/events";
import type { DraftRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

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
    // empty body is fine
  }
  const feedback = body.feedback?.trim() ?? "";

  const { data: draft, error: loadErr } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single<DraftRow>();
  if (loadErr || !draft) return new Response("Not found", { status: 404 });

  if (draft.status !== "researched") {
    return new Response(
      `Cannot re-research while draft status is "${draft.status}"`,
      { status: 409 },
    );
  }
  if (index >= draft.topics.length) {
    return new Response("Topic index out of range", { status: 400 });
  }

  const topics = [...draft.topics];
  const topic = { ...topics[index] };
  const previous = topics[index];
  topics[index] = topic;

  await supabase
    .from("drafts")
    .update({
      topics: topics.map((t, i) =>
        i === index ? { ...t, status: "planning" as const } : t,
      ),
      cancel_requested: false,
    })
    .eq("id", id);

  const traceId = generateTraceId();
  console.log(
    `[topic-research ${id}/${index}] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ResearchEvent | { type: string; [k: string]: unknown }) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      };

      let writeChain: Promise<unknown> = Promise.resolve();
      const persist = () => {
        writeChain = writeChain.then(async () => {
          const next = [...topics];
          next[index] = topic;
          await supabase.from("drafts").update({ topics: next }).eq("id", id);
        });
        return writeChain;
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
          // poll failures are non-fatal
        }
      }, 2000);

      try {
        await withTrace(
          "rfi-topic-research",
          async () => {
            await updateTopic(topic, feedback, {
              scope: draft.scope,
              signal: ac.signal,
              onEvent: (e) => {
                send(e);
                if (
                  e.type === "planner.complete" ||
                  e.type === "architect.complete" ||
                  e.type === "planner.error" ||
                  e.type === "architect.error"
                ) {
                  void persist();
                }
              },
            });
          },
          { traceId },
        );

        if (cancelled) {
          // Restore the previous topic state (with research preserved as it was).
          const restored = [...topics];
          restored[index] = previous;
          await supabase
            .from("drafts")
            .update({ topics: restored, cancel_requested: false })
            .eq("id", id);
          send({ type: "cancelled" });
          send({ type: "done" });
          return;
        }

        await persist();
        await writeChain;
        // Draft-level status remains `researched`. The single topic carries
        // its own `researched` (or `failed`) flag.
        await supabase
          .from("drafts")
          .update({ cancel_requested: false })
          .eq("id", id);
        send({ type: "done" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Re-research failed";
        send({ type: "error", message });
        // Best-effort restore.
        const restored = [...topics];
        restored[index] = previous;
        await supabase
          .from("drafts")
          .update({ topics: restored, cancel_requested: false })
          .eq("id", id);
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
