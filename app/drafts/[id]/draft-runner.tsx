"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/card";
import { StatusPill } from "@/app/components/ui/status-pill";
import { ProgressRail } from "@/app/components/ui/progress-rail";
import type { DraftRow, DraftTopic, Source } from "@/lib/types";

type Phase =
  | "drafting"
  | "editing"
  | "done"
  | "error"
  | "cancelling"
  | "cancelled";

type Snapshot = {
  index: number;
  text: string;
  status: DraftTopic["status"];
  content: string | null;
  sources: Source[];
};

type SseEvent =
  | { type: "drafter.started"; index: number; feature_count: number }
  | {
      type: "drafter.complete";
      index: number;
      content: string;
      sources: Source[];
      duration_ms: number;
    }
  | { type: "drafter.error"; index: number; message: string }
  | { type: "editor.started"; topic_count: number }
  | { type: "editor.complete"; duration_ms: number }
  | { type: "editor.skipped"; reason: string }
  | { type: "cancelled" }
  | { type: "done" }
  | { type: "error"; message: string };

const snapshotFrom = (draft: DraftRow): Snapshot[] =>
  draft.topics.map((t) => ({
    index: t.index,
    text: t.text,
    status: t.status,
    content: t.content,
    sources: t.sources,
  }));

export function DraftRunner({
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
  const [phase, setPhase] = useState<Phase>("drafting");
  const [items, setItems] = useState<Snapshot[]>(() => snapshotFrom(draft));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [perTopicErrors, setPerTopicErrors] = useState<Record<number, string>>(
    {},
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const handleEvent = (evt: SseEvent) => {
      if (evt.type === "drafter.started") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index ? { ...t, status: "drafting" } : t,
          ),
        );
      } else if (evt.type === "drafter.complete") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index
              ? {
                  ...t,
                  status: "drafted",
                  content: evt.content,
                  sources: evt.sources,
                }
              : t,
          ),
        );
      } else if (evt.type === "drafter.error") {
        setItems((xs) =>
          xs.map((t) =>
            t.index === evt.index ? { ...t, status: "failed" } : t,
          ),
        );
        setPerTopicErrors((m) => ({ ...m, [evt.index]: evt.message }));
      } else if (evt.type === "editor.started") {
        setPhase((p) => (p === "cancelling" ? p : "editing"));
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
        const res = await fetch(`/api/drafts/${draft.id}/draft`, {
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
          setErrorMsg(msg || `Failed to start drafting (status ${res.status})`);
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
    <DraftingDisplay
      title={draft.title}
      items={items}
      phase={phase}
      errorMsg={errorMsg}
      perTopicErrors={perTopicErrors}
      onCancel={onCancel}
    />
  );
}

function ResumeView({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("drafting");
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
    <DraftingDisplay
      title={draft.title}
      items={items}
      phase={phase}
      errorMsg={null}
      perTopicErrors={{}}
      onCancel={onCancel}
    />
  );
}

function DraftingDisplay({
  title,
  items,
  phase,
  errorMsg,
  perTopicErrors,
  onCancel,
}: {
  title: string | null;
  items: Snapshot[];
  phase: Phase;
  errorMsg: string | null;
  perTopicErrors: Record<number, string>;
  onCancel?: () => void;
}) {
  const total = items.length;
  const drafted = items.filter((t) => t.status === "drafted").length;
  const failed = items.filter((t) => t.status === "failed").length;
  const done = drafted + failed;
  const canCancel =
    onCancel && (phase === "drafting" || phase === "editing");

  return (
    <div className="space-y-7">
      <header className="space-y-4">
        <Eyebrow>
          {phase === "editing" ? "Step 06 — Editing" : "Step 05 — Drafting"}
        </Eyebrow>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {title ?? "Untitled draft"}
            </h1>
            <p className="mt-1 text-sm text-ink-3">
              {phaseLabel(phase, drafted, failed, total)}
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
            label="Drafting progress"
            active={phase === "drafting"}
          />
          {phase === "editing" && (
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-xs">
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-emerald)" }}
              >
                <span
                  className="pulse-dot inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--color-emerald)" }}
                />
              </span>
              <span className="font-display font-medium uppercase tracking-[0.14em] text-emerald">
                Editor
              </span>
              <span className="text-ink-3">
                Harmonizing voice across all topics…
              </span>
            </div>
          )}
        </div>
      </header>

      <ol className="space-y-3">
        {items.map((t) => (
          <li
            key={t.index}
            className="rounded-lg border border-line bg-elev-1/60 p-4 backdrop-blur-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
                Topic{" "}
                <span className="ml-1 font-mono text-ink-2">
                  {String(t.index + 1).padStart(2, "0")}
                </span>
              </span>
              <StatusPill status={t.status} />
            </div>
            <p className="text-sm leading-relaxed text-ink">{t.text}</p>
            {t.status === "drafted" && t.content && (
              <details className="mt-3 group" open={total <= 3}>
                <summary className="cursor-pointer list-none font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink">
                  <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                  Show draft
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-line bg-elev-2 p-3 font-mono text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                  {t.content}
                </pre>
              </details>
            )}
            {t.status === "failed" && perTopicErrors[t.index] && (
              <p className="mt-2 text-xs text-danger">
                {perTopicErrors[t.index]}
              </p>
            )}
          </li>
        ))}
      </ol>

      {phase === "error" && errorMsg && (
        <div className="rounded-lg border border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.06)] p-4 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {phase === "done" && (
        <div className="relative overflow-hidden rounded-lg border border-[rgba(39,182,129,0.3)] bg-[rgba(39,182,129,0.05)] p-4 text-sm">
          <div className="absolute inset-x-0 top-0 h-px brand-gradient" />
          <span className="brand-text-gradient font-display font-semibold uppercase tracking-[0.14em]">
            Drafting complete.
          </span>{" "}
          <span className="text-ink-2">Refreshing…</span>
        </div>
      )}
    </div>
  );
}

function phaseLabel(
  phase: Phase,
  drafted: number,
  failed: number,
  total: number,
) {
  if (phase === "editing") return "Harmonizing voice across all topics…";
  if (phase === "done") return `All ${total} topics ready.`;
  if (phase === "error") return "Drafting hit an error.";
  if (phase === "cancelling") return "Cancelling — finishing in-flight calls…";
  if (phase === "cancelled") return "Cancelled. Returning to topic review…";
  const done = drafted + failed;
  return `Drafting ${done} of ${total}…`;
}
