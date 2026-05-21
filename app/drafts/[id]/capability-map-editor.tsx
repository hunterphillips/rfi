"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCapabilityMap } from "./actions";
import { Button } from "@/app/components/ui/button";
import { Eyebrow } from "@/app/components/ui/card";
import { Textarea } from "@/app/components/ui/input";
import type { CapabilityMap } from "@/lib/types";

type Props = {
  draftId: string;
  topicIndex: number;
  /** The current capability map (canonical from the draft row). */
  initialMap: CapabilityMap;
};

/**
 * Editable view of a topic's capability map. Per-item delete on
 * features/components/open_questions, inline narrative edit. Server prunes
 * sources to those still cited by remaining features.
 *
 * Optimistic local state: edits apply immediately and we call the server
 * action; on failure we revert and surface an inline error. Allowed only
 * while the draft is in `researched` status (server-enforced).
 */
export function CapabilityMapEditor({ draftId, topicIndex, initialMap }: Props) {
  const router = useRouter();
  const [map, setMap] = useState<CapabilityMap>(initialMap);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [narrativeEditing, setNarrativeEditing] = useState(false);
  const [narrativeDraft, setNarrativeDraft] = useState(
    initialMap.architecture_narrative,
  );

  function persist(next: CapabilityMap) {
    const previous = map;
    setMap(next);
    setError(null);
    startTransition(async () => {
      const res = await updateCapabilityMap(draftId, topicIndex, next);
      if (!res.ok) {
        setMap(previous);
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  function removeFeature(i: number) {
    persist({ ...map, features: map.features.filter((_, idx) => idx !== i) });
  }
  function removeComponent(i: number) {
    persist({
      ...map,
      components: map.components.filter((_, idx) => idx !== i),
    });
  }
  function removeOpenQuestion(i: number) {
    persist({
      ...map,
      open_questions: map.open_questions.filter((_, idx) => idx !== i),
    });
  }
  function saveNarrative() {
    const trimmed = narrativeDraft.trim();
    setNarrativeEditing(false);
    if (trimmed === map.architecture_narrative) return;
    persist({ ...map, architecture_narrative: trimmed });
  }
  function cancelNarrative() {
    setNarrativeDraft(map.architecture_narrative);
    setNarrativeEditing(false);
  }

  return (
    <div className="space-y-5 text-sm">
      <section>
        <div className="flex items-center justify-between">
          <Eyebrow>Architecture narrative</Eyebrow>
          {!narrativeEditing && (
            <button
              type="button"
              onClick={() => {
                setNarrativeDraft(map.architecture_narrative);
                setNarrativeEditing(true);
              }}
              className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
              disabled={pending}
            >
              Edit
            </button>
          )}
        </div>
        {narrativeEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={narrativeDraft}
              onChange={(e) => setNarrativeDraft(e.target.value)}
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={cancelNarrative}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={saveNarrative}
                disabled={pending}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-2">
            {map.architecture_narrative || (
              <span className="italic text-ink-4">(empty)</span>
            )}
          </p>
        )}
      </section>

      <section>
        <Eyebrow>Features</Eyebrow>
        {map.features.length === 0 ? (
          <p className="mt-1.5 text-xs italic text-ink-4">
            All features removed.
          </p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {map.features.map((f, i) => (
              <li
                key={i}
                className="group relative rounded-md border border-line bg-elev-2 p-3"
              >
                <RemoveButton
                  label="Remove feature"
                  onClick={() => removeFeature(i)}
                  disabled={pending}
                />
                <p className="pr-8 font-display text-[13px] font-semibold tracking-tight text-ink">
                  {f.name}
                </p>
                <p className="mt-0.5 text-ink-2">{f.purpose}</p>
                <a
                  href={f.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 block truncate font-mono text-[11px] text-accent hover:text-accent hover:underline"
                >
                  {f.source}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {map.components.length > 0 && (
        <section>
          <Eyebrow>Components</Eyebrow>
          <ul className="mt-1.5 space-y-1 text-ink-2">
            {map.components.map((c, i) => (
              <li key={i} className="group flex items-start gap-2">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald" />
                <span className="flex-1">{c}</span>
                <RemoveButton
                  inline
                  label="Remove component"
                  onClick={() => removeComponent(i)}
                  disabled={pending}
                />
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
              <li key={i} className="group flex items-start gap-2">
                <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-warn" />
                <span className="flex-1">{q}</span>
                <RemoveButton
                  inline
                  label="Remove open question"
                  onClick={() => removeOpenQuestion(i)}
                  disabled={pending}
                />
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
                  className="font-mono text-[11px] text-accent hover:text-accent hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function RemoveButton({
  onClick,
  disabled,
  label,
  inline = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  inline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        inline
          ? "shrink-0 rounded text-ink-4 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 disabled:opacity-20"
          : "absolute right-2 top-2 rounded text-ink-4 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 disabled:opacity-20"
      }
    >
      <span aria-hidden className="px-1.5 text-base leading-none">
        ×
      </span>
    </button>
  );
}
