"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteDraft } from "./drafts/[id]/actions";
import { StatusPill } from "@/app/components/ui/status-pill";
import type { DraftStatus } from "@/lib/types";

type Row = {
  id: string;
  title: string | null;
  status: DraftStatus;
  updated_at: string;
};

export function DraftListRow({ draft }: { draft: Row }) {
  const [pending, startTransition] = useTransition();

  function onDelete(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !confirm(
        `Delete "${draft.title ?? "Untitled draft"}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.append("draftId", draft.id);
    startTransition(async () => {
      await deleteDraft(fd);
    });
  }

  return (
    <li className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-elev-2">
      {/* leading marker line */}
      <span className="absolute inset-y-0 left-0 w-px scale-y-0 brand-gradient transition-transform duration-300 group-hover:scale-y-100" />

      <Link
        href={`/drafts/${draft.id}`}
        className="flex min-w-0 flex-1 flex-col gap-1"
      >
        <span className="truncate font-display text-[15px] font-medium tracking-tight text-ink transition-colors group-hover:brand-text-gradient">
          {draft.title ?? "Untitled draft"}
        </span>
        <span className="font-mono text-[11px] text-ink-4">
          Updated{" "}
          {new Date(draft.updated_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-3">
        <StatusPill status={draft.status} />
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="rounded font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-4 opacity-0 transition-all hover:text-danger group-hover:opacity-100 disabled:opacity-30"
          aria-label="Delete draft"
        >
          {pending ? "deleting…" : "delete"}
        </button>
      </div>
    </li>
  );
}
