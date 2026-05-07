"use client";

import { useState, useTransition } from "react";
import { saveQuestions } from "./actions";
import type { DraftQuestion, DraftRow } from "@/lib/types";

type Item = { localId: string; text: string };

let counter = 0;
const nextId = () => `q${++counter}`;

export function ParsedView({ draft }: { draft: DraftRow }) {
  const [items, setItems] = useState<Item[]>(
    draft.questions.map((q: DraftQuestion) => ({
      localId: nextId(),
      text: q.text,
    })),
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    items.length !== draft.questions.length ||
    items.some(
      (it, i) => it.text !== (draft.questions[i]?.text ?? "__none__"),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {draft.title ?? "Untitled draft"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The parser extracted {draft.questions.length} question
          {draft.questions.length === 1 ? "" : "s"}. Review and adjust before
          drafting.
        </p>
      </div>

      <ol className="space-y-3">
        {items.map((item, i) => (
          <li
            key={item.localId}
            className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Question {i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setItems((xs) => xs.filter((x) => x.localId !== item.localId))
                }
                className="text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              >
                Remove
              </button>
            </div>
            <textarea
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
              className="block w-full resize-y rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setItems((xs) => [...xs, { localId: nextId(), text: "" }])
          }
          className="text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          + Add question
        </button>
        <div className="flex items-center gap-3 text-sm">
          {savedAt && !dirty && !error && (
            <span className="text-zinc-500">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !dirty}
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        Drafting kickoff and per-question agent runs land in the next phase.
        For now, save your edited question list and the row stays in{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
          parsed
        </code>
        .
      </div>
    </div>
  );
}
