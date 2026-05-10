"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DraftRunner } from "./draft-runner";
import { EditableTitle } from "./editable-title";
import { ScopeBadge } from "./scope-badge";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/card";
import { Textarea } from "@/app/components/ui/input";
import { StatusPill } from "@/app/components/ui/status-pill";
import { ProgressRail } from "@/app/components/ui/progress-rail";
import type {
  DraftRow,
  DraftTopic,
  CapabilityMap,
  PlanItem,
  Source,
} from "@/lib/types";

type Mode = "review" | "drafting" | "topic-research";

export function ResearchedView({ draft }: { draft: DraftRow }) {
  const [mode, setMode] = useState<Mode>("review");
  const [reResearchIndex, setReResearchIndex] = useState<number | null>(null);

  if (mode === "drafting") {
    const liveDraft: DraftRow = { ...draft, status: "drafting" };
    return <DraftRunner draft={liveDraft} autoStart />;
  }
  if (mode === "topic-research" && reResearchIndex !== null) {
    return (
      <TopicResearchRunner
        draft={draft}
        topicIndex={reResearchIndex}
        onDone={() => {
          setMode("review");
          setReResearchIndex(null);
        }}
      />
    );
  }

  return (
    <ReviewView
      draft={draft}
      onStartDraft={() => setMode("drafting")}
      onReResearch={(idx) => {
        setReResearchIndex(idx);
        setMode("topic-research");
      }}
    />
  );
}

function ReviewView({
  draft,
  onStartDraft,
  onReResearch,
}: {
  draft: DraftRow;
  onStartDraft: () => void;
  onReResearch: (index: number) => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = draft.topics.length;
  const approved = draft.topics.filter((t) => t.status === "approved").length;
  const failed = draft.topics.filter((t) => t.status === "failed").length;
  const allApproved = approved === total - failed && total - failed > 0;

  async function toggleApprove(index: number, current: DraftTopic["status"]) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/drafts/${draft.id}/topics/${index}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            approved: current === "researched",
          }),
        },
      );
      if (!res.ok) {
        setError(await res.text().catch(() => "Approve failed"));
        return;
      }
      router.refresh();
    });
  }

  async function approveAllAndDraft() {
    setError(null);
    startTransition(async () => {
      const unapproved = draft.topics.filter((t) => t.status === "researched");
      for (const t of unapproved) {
        const res = await fetch(
          `/api/drafts/${draft.id}/topics/${t.index}/approve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ approved: true }),
          },
        );
        if (!res.ok) {
          setError(await res.text().catch(() => "Approve failed"));
          return;
        }
      }
      onStartDraft();
    });
  }

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <Eyebrow>Step 04 — Review research</Eyebrow>
        <EditableTitle draftId={draft.id} initialTitle={draft.title} />
        <p className="max-w-2xl text-sm leading-relaxed text-ink-3">
          <span className="font-mono text-ink-2">{total}</span> topic
          {total === 1 ? "" : "s"} researched
          {failed > 0 ? (
            <>
              {" "}
              (<span className="text-danger">{failed} failed</span>)
            </>
          ) : null}
          . Review each capability map before drafting.
        </p>
      </header>

      <ScopeBadge draftId={draft.id} scope={draft.scope} editable />

      <div className="rounded-lg border border-line bg-elev-1/60 p-4">
        <ProgressRail
          done={approved}
          total={total - failed}
          label="Approval progress"
          active={!allApproved}
        />
      </div>

      <ol className="space-y-4">
        {draft.topics.map((t) => (
          <TopicReviewCard
            key={t.index}
            topic={t}
            busy={busy}
            onApproveToggle={() => toggleApprove(t.index, t.status)}
            onReResearch={() => onReResearch(t.index)}
          />
        ))}
      </ol>

      {error && (
        <p className="rounded-md border border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.06)] px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="relative overflow-hidden rounded-lg border border-line bg-elev-1/60 p-5 backdrop-blur-sm">
        <div className="absolute inset-x-0 top-0 h-px brand-gradient opacity-60" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow className="mb-1.5">Step 05 — Draft</Eyebrow>
            <p className="text-sm text-ink-2">
              <span className="font-mono text-ink">{approved}</span>
              <span className="text-ink-3"> of </span>
              <span className="font-mono">{total - failed}</span>
              <span className="text-ink-3"> approved.</span>{" "}
              {allApproved
                ? "Ready to draft."
                : "Approve all topics, or click below to approve and start drafting."}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() =>
              allApproved ? onStartDraft() : void approveAllAndDraft()
            }
            disabled={busy || total - failed === 0}
          >
            {allApproved ? "Start drafting →" : "Approve all & draft →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopicReviewCard({
  topic,
  busy,
  onApproveToggle,
  onReResearch,
}: {
  topic: DraftTopic;
  busy: boolean;
  onApproveToggle: () => void;
  onReResearch: () => void;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-elev-1/60 backdrop-blur-sm">
      <div className="border-b border-line px-5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
              Topic{" "}
              <span className="ml-1 font-mono text-ink-2">
                {String(topic.index + 1).padStart(2, "0")}
              </span>
            </span>
            <p className="mt-1 text-sm font-medium leading-relaxed text-ink">
              {topic.text}
            </p>
          </div>
          <StatusPill status={topic.status} />
        </div>
      </div>

      <div className="px-5 py-4">
        {topic.capability_map ? (
          <CapabilityMapView map={topic.capability_map} />
        ) : (
          <p className="text-sm italic text-ink-4">
            No capability map. Re-research to retry.
          </p>
        )}

        {topic.feedback_history.length > 0 && (
          <details className="mt-4 border-t border-line pt-3 group">
            <summary className="cursor-pointer list-none font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink">
              <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
                ›
              </span>
              Feedback history · {topic.feedback_history.length}
            </summary>
            <ul className="mt-2 space-y-2 border-l border-line pl-4 text-xs text-ink-2">
              {topic.feedback_history.map((f, i) => (
                <li key={i}>
                  <span className="font-mono text-[10px] text-ink-4">
                    {f.ts}
                  </span>{" "}
                  {f.feedback}
                </li>
              ))}
            </ul>
          </details>
        )}

        {feedbackOpen && <ReResearchPanel onSubmit={onReResearch} />}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <button
          type="button"
          onClick={() => setFeedbackOpen((o) => !o)}
          className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
        >
          {feedbackOpen ? "Cancel" : "Re-research with feedback"}
        </button>
        {topic.capability_map && (
          <Button
            type="button"
            variant={topic.status === "approved" ? "secondary" : "primary"}
            size="sm"
            onClick={onApproveToggle}
            disabled={busy}
          >
            {topic.status === "approved" ? "Unapprove" : "Approve"}
          </Button>
        )}
      </div>
    </li>
  );
}

function CapabilityMapView({ map }: { map: CapabilityMap }) {
  return (
    <div className="space-y-5 text-sm">
      <section>
        <Eyebrow>Architecture narrative</Eyebrow>
        <p className="mt-1.5 leading-relaxed text-ink-2">
          {map.architecture_narrative}
        </p>
      </section>

      <section>
        <Eyebrow>Features</Eyebrow>
        <ul className="mt-2 space-y-2.5">
          {map.features.map((f, i) => (
            <li
              key={i}
              className="rounded-md border border-line bg-elev-2/40 p-3"
            >
              <p className="font-display text-[13px] font-semibold tracking-tight text-ink">
                {f.name}
              </p>
              <p className="mt-0.5 text-ink-2">{f.purpose}</p>
              <a
                href={f.source}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 block truncate font-mono text-[11px] text-teal hover:text-emerald hover:underline"
              >
                {f.source}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {map.components.length > 0 && (
        <section>
          <Eyebrow>Components</Eyebrow>
          <ul className="mt-1.5 space-y-1 text-ink-2">
            {map.components.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {map.open_questions.length > 0 && (
        <section>
          <Eyebrow>Open questions</Eyebrow>
          <ul className="mt-1.5 space-y-1 text-ink-2">
            {map.open_questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-warn" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {map.sources.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink">
            <span className="mr-1.5 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Sources · {map.sources.length}
          </summary>
          <ul className="mt-2 space-y-1 border-l border-line pl-4">
            {map.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-teal hover:text-emerald hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReResearchPanel({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="mt-4 rounded-lg border border-line-2 bg-elev-2 p-3.5">
      <p className="text-xs leading-relaxed text-ink-2">
        Submit feedback (e.g. &quot;include HRSD adjacencies&quot; or
        &quot;focus on the Now Assist guardrails&quot;) and we&apos;ll re-run
        Plan + Research + Architect for this topic.
      </p>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onSubmit}
        >
          Open feedback
        </Button>
      </div>
    </div>
  );
}

function TopicResearchRunner({
  draft,
  topicIndex,
  onDone,
}: {
  draft: DraftRow;
  topicIndex: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [phase, setPhase] = useState<"input" | "running" | "done" | "error">(
    "input",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    plan: PlanItem[];
    completed: number;
  }>({ plan: [], completed: 0 });
  const startedRef = useRef(false);

  async function startStream() {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("running");

    type SseEvent =
      | { type: "planner.complete"; plan: PlanItem[] }
      | { type: "researcher.complete"; sources: Source[] }
      | { type: "architect.complete" }
      | { type: "cancelled" }
      | { type: "done" }
      | { type: "error"; message: string };

    try {
      const res = await fetch(
        `/api/drafts/${draft.id}/topics/${topicIndex}/research`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ feedback: feedback.trim() || undefined }),
        },
      );
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => res.statusText);
        setPhase("error");
        setErrorMsg(msg || `Failed (status ${res.status})`);
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
          let evt: SseEvent;
          try {
            evt = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (evt.type === "planner.complete") {
            setProgress({ plan: evt.plan, completed: 0 });
          } else if (evt.type === "researcher.complete") {
            setProgress((p) => ({ ...p, completed: p.completed + 1 }));
          } else if (evt.type === "done") {
            setPhase("done");
            router.refresh();
            setTimeout(onDone, 600);
          } else if (evt.type === "error") {
            setPhase("error");
            setErrorMsg(evt.message);
          }
        }
      }
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Stream failed");
    }
  }

  const topic = draft.topics[topicIndex];
  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Re-research topic</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          Topic{" "}
          <span className="font-mono">
            {String(topicIndex + 1).padStart(2, "0")}
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          {topic.text}
        </p>
      </header>

      {phase === "input" && (
        <div className="space-y-4">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="What should change? (optional — leave blank to just retry)"
          />
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDone}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="md"
              onClick={() => void startStream()}
            >
              Re-research →
            </Button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border border-line bg-elev-1/60 p-4">
          <ProgressRail
            done={progress.completed}
            total={Math.max(progress.plan.length, 1)}
            label={
              progress.plan.length === 0
                ? "Planning"
                : "Research progress"
            }
            active
          />
        </div>
      )}

      {phase === "done" && (
        <div className="relative overflow-hidden rounded-lg border border-[rgba(39,182,129,0.3)] bg-[rgba(39,182,129,0.05)] p-4 text-sm">
          <div className="absolute inset-x-0 top-0 h-px brand-gradient" />
          <span className="brand-text-gradient font-display font-semibold uppercase tracking-[0.14em]">
            Done.
          </span>{" "}
          <span className="text-ink-2">Returning to review…</span>
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div className="rounded-lg border border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.06)] p-4 text-sm text-danger">
          {errorMsg}
          <button
            type="button"
            onClick={onDone}
            className="ml-3 underline hover:no-underline"
          >
            back
          </button>
        </div>
      )}
    </div>
  );
}
