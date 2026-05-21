import { NextRequest } from "next/server";
import { withTrace, generateTraceId } from "@openai/agents";
import { createClient } from "@/lib/supabase/server";
import { runDraftWorkflow } from "@/lib/agents/workflows/draft";
import type { DraftEvent } from "@/lib/agents/workflows/events";
import type { DraftRow, DraftTopic } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  if (draft.status !== "researched") {
    return new Response(`Draft is in status "${draft.status}"`, {
      status: 409,
    });
  }

  // Phase 2 only runs over approved topics. Topics that are still `researched`
  // (not yet approved) or in `failed` state are skipped here.
  const eligible = draft.topics.filter(
    (t) => t.status === "approved" && t.capability_map !== null,
  );
  if (eligible.length === 0) {
    return new Response("No approved topics with capability maps to draft", {
      status: 400,
    });
  }

  const topics: DraftTopic[] = draft.topics.map((t) => ({ ...t }));

  const traceId = generateTraceId();
  console.log(
    `[draft ${id}] View trace: https://platform.openai.com/traces/trace?trace_id=${traceId}`,
  );

  const { error: startErr } = await supabase
    .from("drafts")
    .update({
      status: "drafting",
      topics,
      cancel_requested: false,
      trace_id: traceId,
    })
    .eq("id", id);
  if (startErr) {
    return new Response(`Failed to start: ${startErr.message}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: DraftEvent | { type: string; [k: string]: unknown }) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        );
      };

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
        // Only the eligible topics get drafted. Pipeline mutates them in place.
        const eligibleSubset = topics.filter(
          (t) => t.status === "approved" && t.capability_map !== null,
        );
        await withTrace(
          "rfi-draft",
          async () => {
            await runDraftWorkflow(eligibleSubset, {
              attached: draft.attached_context ?? [],
              signal: ac.signal,
              draftId: id,
              traceId,
              onEvent: (e) => {
                send(e);
                if (
                  e.type === "drafter.complete" ||
                  e.type === "drafter.error" ||
                  e.type === "editor.complete"
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
              status: "researched",
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
          .update({ status: "ready", topics, cancel_requested: false })
          .eq("id", id);

        send({ type: "done" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Drafting pipeline failed";
        send({ type: "error", message });
        await supabase
          .from("drafts")
          .update({
            status: "researched",
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
