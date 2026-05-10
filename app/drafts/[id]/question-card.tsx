"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/card";
import { Pill } from "@/app/components/ui/pill";
import { Textarea } from "@/app/components/ui/input";
import type { DraftTopic } from "@/lib/types";

type SseEvent =
  | { type: "topic.started"; index: number }
  | {
      type: "topic.complete";
      index: number;
      content: string;
      sources: { title: string; url: string }[];
    }
  | { type: "topic.error"; index: number; message: string }
  | { type: "cancelled" }
  | { type: "done" }
  | { type: "error"; message: string };

type Phase = "idle" | "feedback" | "running" | "cancelling" | "error";

export function QuestionCard({
  draftId,
  question,
}: {
  draftId: string;
  question: DraftTopic;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [content, setContent] = useState<string | null>(question.content);
  const [sources, setSources] = useState(question.sources);
  const [propContentSnap, setPropContentSnap] = useState(question.content);
  const [propSourcesSnap, setPropSourcesSnap] = useState(question.sources);
  if (
    propContentSnap !== question.content ||
    propSourcesSnap !== question.sources
  ) {
    setPropContentSnap(question.content);
    setPropSourcesSnap(question.sources);
    setContent(question.content);
    setSources(question.sources);
  }

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (phase === "feedback") textareaRef.current?.focus();
  }, [phase]);

  async function onCancel() {
    setPhase("cancelling");
    try {
      await fetch(`/api/drafts/${draftId}/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // ignore
    }
  }

  async function submitRegenerate() {
    setPhase("running");
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/drafts/${draftId}/topics/${question.index}/draft`,
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
          if (evt.type === "topic.complete") {
            setContent(evt.content);
            setSources(evt.sources);
          } else if (evt.type === "topic.error") {
            setPhase("error");
            setErrorMsg(evt.message);
          } else if (evt.type === "done") {
            setPhase((p) => (p === "error" ? p : "idle"));
            setFeedback("");
            router.refresh();
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

  return (
    <li className="overflow-hidden rounded-lg border border-line bg-elev-1/60 backdrop-blur-sm transition-colors hover:border-line-2">
      <div className="border-b border-line px-5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
              Topic{" "}
              <span className="ml-1 font-mono text-ink-2">
                {String(question.index + 1).padStart(2, "0")}
              </span>
            </span>
            <p className="mt-1 text-sm font-medium leading-relaxed text-ink">
              {question.text}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {phase === "idle" && (
              <button
                type="button"
                onClick={() => setPhase("feedback")}
                className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
              >
                Regenerate
              </button>
            )}
            {phase === "running" && (
              <>
                <Pill tone="brand">
                  <span className="pulse-dot inline-flex h-1 w-1 rounded-full bg-teal" />
                  Regenerating
                </Pill>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => void onCancel()}
                >
                  Cancel
                </Button>
              </>
            )}
            {phase === "cancelling" && (
              <span className="font-mono text-[11px] text-ink-3">
                Cancelling…
              </span>
            )}
          </div>
        </div>
      </div>

      {phase === "feedback" && (
        <div className="border-b border-line bg-elev-2/60 px-5 py-4">
          <Eyebrow className="mb-2">What should change? (optional)</Eyebrow>
          <Textarea
            ref={textareaRef}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submitRegenerate();
              }
            }}
            rows={3}
            placeholder="e.g. Lead with implementation timeline; cite specific ServiceNow modules; less marketing tone."
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] text-ink-4">
              ⌘+Enter to submit · blank to retry
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhase("idle");
                  setFeedback("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void submitRegenerate()}
              >
                Regenerate →
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 py-5">
        {content ? (
          <article className="md-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm italic text-ink-4">
            No draft was produced for this topic.
          </p>
        )}
      </div>

      {phase === "error" && errorMsg && (
        <div className="border-t border-line bg-[rgba(224,123,123,0.05)] px-5 py-3 text-xs text-danger">
          {errorMsg}{" "}
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setErrorMsg(null);
            }}
            className="ml-2 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      {sources.length > 0 && (
        <div className="border-t border-line bg-elev-2/30 px-5 py-3">
          <Eyebrow className="mb-2">Sources · {sources.length}</Eyebrow>
          <ul className="space-y-1">
            {sources.map((s, i) => (
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
        </div>
      )}
    </li>
  );
}
