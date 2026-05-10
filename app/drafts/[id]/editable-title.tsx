"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { renameDraft } from "./actions";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export function EditableTitle({
  draftId,
  initialTitle,
}: {
  draftId: string;
  initialTitle: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [committed, setCommitted] = useState(initialTitle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = title.trim();
    if (next === committed) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renameDraft(draftId, next);
      if (res.ok) {
        setCommitted(next);
        setEditing(false);
      } else {
        setError(res.message);
      }
    });
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setTitle(committed);
                setError(null);
                setEditing(false);
              }
            }}
            maxLength={200}
            disabled={pending}
            className="!font-display !text-2xl !font-semibold !tracking-tight"
          />
          <Button
            type="button"
            onClick={commit}
            disabled={pending}
            size="sm"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTitle(committed);
              setError(null);
              setEditing(false);
            }}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
        </div>
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        {committed || (
          <span className="text-ink-4">Untitled draft</span>
        )}
      </h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-4 opacity-0 transition-all hover:text-ink group-hover:opacity-100"
        aria-label="Rename draft"
      >
        rename
      </button>
    </div>
  );
}
