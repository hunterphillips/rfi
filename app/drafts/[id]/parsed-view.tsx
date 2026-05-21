"use client";

import { useState, useTransition } from "react";
import { saveQuestions } from "./actions";
import { ResearchRunner } from "./research-runner";
import { EditableTitle } from "./editable-title";
import { ScopeBadge } from "./scope-badge";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/card";
import type { DraftTopic, DraftRow } from "@/lib/types";

type Item = { localId: string; text: string };

let counter = 0;
const nextId = () => `q${++counter}`;

export function ParsedView({ draft }: { draft: DraftRow }) {
  const [items, setItems] = useState<Item[]>(
    draft.topics.map((q: DraftTopic) => ({
      localId: nextId(),
      text: q.text,
    })),
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);

  if (researching) {
    const liveDraft: DraftRow = {
      ...draft,
      status: "researching",
      topics: items.map((it, i) => ({
        index: i,
        text: it.text,
        status: "pending",
        plan: [],
        research: [],
        capability_map: null,
        feedback_history: [],
        content: null,
        sources: [],
      })),
    };
    return <ResearchRunner draft={liveDraft} autoStart />;
  }

  const dirty =
    items.length !== draft.topics.length ||
    items.some(
      (it, i) => it.text !== (draft.topics[i]?.text ?? "__none__"),
    );

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveQuestions(
        draft.id,
        items.map((i) => i.text),
      );
      if (result.ok) {
        setSavedAt(new Date());
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Eyebrow>Step 02 — Confirm topics</Eyebrow>
        <EditableTitle draftId={draft.id} initialTitle={draft.title} />
        <p className="max-w-2xl text-sm leading-relaxed text-ink-3">
          The parser extracted{" "}
          <span className="font-mono text-ink-2">
            {draft.topics.length}
          </span>{" "}
          topic{draft.topics.length === 1 ? "" : "s"}. Review and adjust before
          drafting.
        </p>
      </header>

      <ScopeBadge draftId={draft.id} scope={draft.scope} editable />

      <ol className="space-y-3">
        {items.map((item, i) => (
          <li
            key={item.localId}
            className="group rounded-lg border border-line bg-elev-1 p-4 backdrop-blur-sm transition-colors hover:border-line-2"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
                Topic{" "}
                <span className="ml-1 font-mono text-ink-2">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((xs) => xs.filter((x) => x.localId !== item.localId))
                }
                className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4 opacity-0 transition-all hover:text-danger group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
            <Textarea
              value={item.text}
              onChange={(e) =>
                setItems((xs) =>
                  xs.map((x) =>
                    x.localId === item.localId
                      ? { ...x, text: e.target.value }
                      : x,
                  ),
                )
              }
              rows={Math.max(2, Math.min(8, item.text.split("\n").length + 1))}
              className="!bg-elev-2 text-sm leading-relaxed"
            />
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setItems((xs) => [...xs, { localId: nextId(), text: "" }])
          }
        >
          + Add topic
        </Button>
        <div className="flex items-center gap-3 text-xs">
          {savedAt && !dirty && !error && (
            <span className="font-mono text-ink-4">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="text-danger">{error}</span>}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSave}
            disabled={pending || !dirty}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Launch research */}
      <div className="relative overflow-hidden rounded-lg border border-line bg-elev-1 p-5 backdrop-blur-sm">
        <div className="absolute inset-x-0 top-0 h-px brand-gradient opacity-60" />
        <div className="flex items-center justify-between gap-4">
          <div className="max-w-xl">
            <Eyebrow className="mb-1.5">Step 03 — Research</Eyebrow>
            <p className="text-sm leading-relaxed text-ink-2">
              Each topic gets a search plan, parallel researchers, and an
              architect synthesis. You&apos;ll review the capability maps before
              drafting.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => setResearching(true)}
            disabled={pending || dirty || items.length === 0}
            title={
              dirty
                ? "Save your changes first"
                : items.length === 0
                  ? "Add at least one topic"
                  : undefined
            }
          >
            Start research →
          </Button>
        </div>
      </div>
    </div>
  );
}
