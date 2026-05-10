import { NextRequest } from "next/server";
import { withTrace, generateTraceId } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { runResearchWorkflow } from "@/lib/agents/workflows/research";
import type { ResearchEvent } from "@/lib/agents/workflows/events";
import type { DraftRow, DraftTopic } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: draft, error: loadErr } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single<DraftRow>();
  if (loadErr || !draft) return new Response("Not found", { status: 404 });

  if (draft.status !== "parsed") {
    return new Response(`Draft is in status "${draft.status}"`, {
      status: 409,
    });
  }
  if (draft.topics.length === 0) {
    return new Response("Draft has no topics", { status: 400 });
  }

  // Initialize working topics with the planning state.
  const topics: DraftTopic[] = draft.topics.map((t) => ({
    ...t,
    status: "pending",
    plan: [],
    research: [],
    capability_map: null,
    feedback_history: t.feedback_history ?? [],
    content: null,
    sources: [],
  }));

  const { error: startErr } = await supabase
    .from("drafts")
    .update({ status: "researching", topics, cancel_requested: false })
    .eq("id", id);
  if (startErr) {
    return new Response(`Failed to start: ${startErr.message}`, { status: 500 });
  }

  const traceId = generateTraceId();
  console.log(
    `[research ${id}] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
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

      // Serialize DB writes so concurrent topic completions don't race.
      let writeChain: Promise<unknown> = Promise.resolve();
      const persist = () => {
        writeChain = writeChain.then(async () => {
          await supabase.from("drafts").update({ topics }).eq("id", id);
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
          "rfi-research",
          async () => {
            await runResearchWorkflow(topics, {
              scope: draft.scope,
              signal: ac.signal,
              onEvent: (e) => {
                send(e);
                // Pipeline mutates topics in place; persist on key milestones.
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
          await supabase
            .from("drafts")
            .update({
              status: "parsed",
              topics: draft.topics,
              cancel_requested: false,
            })
            .eq("id", id);
          send({ type: "cancelled" });
          return;
        }

        await persist();
        await writeChain;
        await supabase
          .from("drafts")
          .update({ status: "researched", topics, cancel_requested: false })
          .eq("id", id);

        send({ type: "done" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Research failed";
        send({ type: "error", message });
        await supabase
          .from("drafts")
          .update({
            status: "parsed",
            topics: draft.topics,
            cancel_requested: false,
          })
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
