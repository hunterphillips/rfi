"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/card";
import { StatusPill, Dot } from "@/app/components/ui/status-pill";
import { ProgressRail } from "@/app/components/ui/progress-rail";
import type {
  DraftRow,
  DraftTopic,
  PlanItem,
  Source,
} from "@/lib/types";

type Phase =
  | "running"
  | "done"
  | "error"
  | "cancelling"
  | "cancelled";

type Snapshot = {
  index: number;
  text: string;
  status: DraftTopic["status"];
  plan: PlanItem[];
  researchProgress: { rIndex: number; query: string; sources: Source[] }[];
  errorMessage: string | null;
};

type SseEvent =
  | { type: "planner.started"; index: number }
  | { type: "planner.complete"; index: number; plan: PlanItem[] }
  | { type: "planner.error"; index: number; message: string }
  | {
      type: "researcher.started";
      topic_index: number;
      r_index: number;
      query: string;
      source: PlanItem["source"];
    }
  | {
      type: "researcher.complete";
      topic_index: number;
      r_index: number;
      summary_chars: number;
      sources: Source[];
      tool_calls: number;
      salvaged: boolean;
    }
  | {
      type: "researcher.error";
      topic_index: number;
      r_index: number;
      message: string;
    }
  | {
      type: "architect.started";
      index: number;
      research_count: number;
    }
  | { type: "architect.complete"; index: number; duration_ms: number }
  | { type: "architect.error"; index: number; message: string }
  | { type: "topic.complete"; index: number; duration_ms: number }
  | { type: "cancelled" }
  | { type: "done" }
  | { type: "error"; message: string };

const snapshotFrom = (draft: DraftRow): Snapshot[] =>
  draft.topics.map((t) => ({
    index: t.index,
    text: t.text,
    status: t.status,
    plan: t.plan,
    researchProgress: [],
    errorMessage: null,
  }));

export function ResearchRunner({
  draft,
  autoStart,
}: {
  draft: DraftRow;
  autoStart: boolean;
}) {
  if (autoStart) return <LiveRunner draft={draft} />;
  return <ResumeView draft={draft} />;
}

function LiveRunner({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("running");
  const [items, setItems] = useState<Snapshot[]>(() => snapshotFrom(draft));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const handleEvent = (evt: SseEvent) => {
      if (evt.type === "planner.started") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index ? { ...t, status: "planning" } : t,
          ),
        );
      } else if (evt.type === "planner.complete") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index
              ? { ...t, status: "researching", plan: evt.plan }
              : t,
          ),
        );
      } else if (evt.type === "planner.error") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index
              ? { ...t, status: "failed", errorMessage: evt.message }
              : t,
          ),
        );
      } else if (evt.type === "researcher.started") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.topic_index
              ? {
                  ...t,
                  researchProgress: [
                    ...t.researchProgress,
                    { rIndex: evt.r_index, query: evt.query, sources: [] },
                  ],
                }
              : t,
          ),
        );
      } else if (evt.type === "researcher.complete") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.topic_index
              ? {
                  ...t,
                  researchProgress: t.researchProgress.map((rp) =>
                    rp.rIndex === evt.r_index
                      ? { ...rp, sources: evt.sources }
                      : rp,
                  ),
                }
              : t,
          ),
        );
      } else if (evt.type === "architect.complete") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index ? { ...t, status: "researched" } : t,
          ),
        );
      } else if (evt.type === "architect.error") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index
              ? { ...t, status: "failed", errorMessage: evt.message }
              : t,
          ),
        );
      } else if (evt.type === "cancelled") {
        setPhase("cancelled");
        router.refresh();
      } else if (evt.type === "done") {
        setPhase((p) => (p === "cancelled" ? p : "done"));
        router.refresh();
      } else if (evt.type === "error") {
        setPhase("error");
        setErrorMsg(evt.message);
      }
    };

    const runStream = async () => {
      try {
        const res = await fetch(`/api/drafts/${draft.id}/research`, {
          method: "POST",
          redirect: "manual",
          credentials: "same-origin",
        });
        if (res.type === "opaqueredirect" || res.redirected) {
          setPhase("error");
          setErrorMsg(
            "Server redirected the SSE request (auth gate). Sign in again and retry.",
          );
          return;
        }
        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => res.statusText);
          setPhase("error");
          setErrorMsg(msg || `Failed to start research (status ${res.status})`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const blocks = buf.split("\n\n");
          buf = blocks.pop() ?? "";
          for (const block of blocks) {
            const dataLine = block
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              handleEvent(JSON.parse(dataLine.slice(6)));
            } catch {
              // skip malformed event
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPhase("error");
        setErrorMsg(e instanceof Error ? e.message : "Stream failed");
      }
    };

    void runStream();
    // No cleanup-abort: React 19 StrictMode would cancel the fetch on synthetic
    // unmount/remount, and the server-side run keeps going regardless.
  }, [draft.id, router]);

  async function onCancel() {
    setPhase("cancelling");
    try {
      await fetch(`/api/drafts/${draft.id}/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // ignore
    }
  }

  return (
    <ResearchDisplay
      title={draft.title}
      items={items}
      phase={phase}
      errorMsg={errorMsg}
      onCancel={onCancel}
    />
  );
}

function ResumeView({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("running");
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [router]);

  async function onCancel() {
    setPhase("cancelling");
    try {
      await fetch(`/api/drafts/${draft.id}/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // ignore
    }
  }

  const items = snapshotFrom(draft);
  return (
    <ResearchDisplay
      title={draft.title}
      items={items}
      phase={phase}
      errorMsg={null}
      onCancel={onCancel}
    />
  );
}

function ResearchDisplay({
  title,
  items,
  phase,
  errorMsg,
  onCancel,
}: {
  title: string | null;
  items: Snapshot[];
  phase: Phase;
  errorMsg: string | null;
  onCancel: () => void;
}) {
  const total = items.length;
  const researched = items.filter((t) => t.status === "researched").length;
  const failed = items.filter((t) => t.status === "failed").length;
  const done = researched + failed;
  const canCancel = phase === "running";

  return (
    <div className="space-y-7">
      {/* Header with progress rail */}
      <header className="space-y-4">
        <Eyebrow>Step 03 — Research in flight</Eyebrow>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {title ?? "Untitled draft"}
            </h1>
            <p className="mt-1 text-sm text-ink-3">
              {phaseLabel(phase, researched, failed, total)}
            </p>
          </div>
          {canCancel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          {phase === "cancelling" && (
            <span className="font-mono text-xs text-ink-3">Cancelling…</span>
          )}
        </div>

        <div className="rounded-lg border border-line bg-elev-1/60 p-4">
          <ProgressRail
            done={done}
            total={total}
            label="Pipeline progress"
            active={phase === "running"}
          />
        </div>
      </header>

      <ol className="space-y-3">
        {items.map((t) => (
          <ResearchTopicCard key={t.index} topic={t} />
        ))}
      </ol>

      {phase === "error" && errorMsg && (
        <div className="rounded-lg border border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.06)] p-4 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {phase === "done" && (
        <div className="relative overflow-hidden rounded-lg border border-[rgba(39,182,129,0.3)] bg-[rgba(39,182,129,0.05)] p-4 text-sm text-ink">
          <div className="absolute inset-x-0 top-0 h-px brand-gradient" />
          <span className="brand-text-gradient font-display font-semibold uppercase tracking-[0.14em]">
            Research complete.
          </span>{" "}
          <span className="text-ink-2">Refreshing for review…</span>
        </div>
      )}
    </div>
  );
}

function ResearchTopicCard({ topic }: { topic: Snapshot }) {
  return (
    <li className="rounded-lg border border-line bg-elev-1/60 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
          Topic{" "}
          <span className="ml-1 font-mono text-ink-2">
            {String(topic.index + 1).padStart(2, "0")}
          </span>
        </span>
        <StatusPill status={topic.status} />
      </div>

      <p className="text-sm leading-relaxed text-ink">{topic.text}</p>

      {topic.plan.length > 0 && (
        <details
          className="mt-4 group"
          open={topic.status !== "researched"}
        >
          <summary className="cursor-pointer list-none font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Plan · {topic.plan.length}{" "}
            {topic.plan.length === 1 ? "search" : "searches"}
          </summary>
          <ul className="mt-3 space-y-1.5 border-l border-line pl-4">
            {topic.plan.map((p, i) => {
              const research = topic.researchProgress.find(
                (rp) => rp.rIndex === i,
              );
              const done = research && research.sources.length > 0;
              const inFlight = research && !done;
              const dotColor = done
                ? "var(--color-emerald)"
                : inFlight
                  ? "var(--color-lime)"
                  : "var(--color-ink-5)";
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-ink-2"
                >
                  <span className="mt-1.5">
                    <Dot color={dotColor} pulse={inFlight} size={5} />
                  </span>
                  <span className="flex-1">
                    <span className="mr-2 inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-3">
                      {p.source}
                    </span>
                    <span className="font-mono text-[12px] text-ink-2">
                      {p.query}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {topic.errorMessage && (
        <p className="mt-2 text-xs text-danger">{topic.errorMessage}</p>
      )}
    </li>
  );
}

function phaseLabel(
  phase: Phase,
  researched: number,
  failed: number,
  total: number,
) {
  if (phase === "done") return "Research ready for review.";
  if (phase === "error") return "Research hit an error.";
  if (phase === "cancelling") return "Cancelling — finishing in-flight calls…";
  if (phase === "cancelled") return "Cancelled. Returning to topic list…";
  const done = researched + failed;
  return `Researching ${done} of ${total} topics…`;
}
