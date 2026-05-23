"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment, deleteComment, setCommentResolved } from "./collab-actions";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/card";
import type { Comment } from "@/lib/types";

function authorLabel(
  comment: Comment,
  currentUserId: string | null,
  authorEmails: Record<string, string>,
): string {
  if (comment.author_id === currentUserId) return "You";
  return authorEmails[comment.author_id] || "Reviewer";
}

export function CommentThread({
  draftId,
  topicIndex,
  comments,
  currentUserId,
  isOwner,
  authorEmails,
}: {
  draftId: string;
  topicIndex: number;
  comments: Comment[];
  currentUserId: string | null;
  isOwner: boolean;
  authorEmails: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const unresolved = comments.filter((c) => !c.resolved).length;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  function submit() {
    const text = body.trim();
    if (!text) return;
    run(async () => {
      const res = await addComment(draftId, topicIndex, text);
      if (res.ok) {
        setBody("");
        setOpen(false);
      }
      return res;
    });
  }

  return (
    <div className="border-t border-line bg-elev-2 px-5 py-3">
      <div className="flex items-center justify-between">
        <Eyebrow>
          Comments
          {comments.length > 0 ? ` · ${comments.length}` : ""}
          {unresolved > 0 ? (
            <span className="ml-1.5 text-accent">{unresolved} open</span>
          ) : null}
        </Eyebrow>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
        >
          {open ? "Cancel" : "Add comment"}
        </button>
      </div>

      {comments.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {comments.map((c) => {
            const mine = c.author_id === currentUserId;
            return (
              <li
                key={c.id}
                className={
                  c.resolved
                    ? "rounded-md border border-line bg-elev-1 px-3 py-2 opacity-60"
                    : "rounded-md border border-line bg-elev-1 px-3 py-2"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink-2">
                    {authorLabel(c, currentUserId, authorEmails)}
                    {c.resolved ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-accent">
                        resolved
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {(mine || isOwner) && (
                      <button
                        type="button"
                        onClick={() =>
                          run(() => setCommentResolved(c.id, !c.resolved))
                        }
                        disabled={busy}
                        className="font-mono text-[10px] text-ink-4 transition-colors hover:text-ink"
                      >
                        {c.resolved ? "reopen" : "resolve"}
                      </button>
                    )}
                    {(mine || isOwner) && (
                      <button
                        type="button"
                        onClick={() => run(() => deleteComment(c.id))}
                        disabled={busy}
                        className="font-mono text-[10px] text-ink-4 transition-colors hover:text-danger"
                        aria-label="Delete comment"
                      >
                        delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                  {c.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            placeholder="Leave a note on this topic…"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-ink-4">
              ⌘+Enter to post
            </span>
            <Button
              type="button"
              size="sm"
              disabled={busy || !body.trim()}
              onClick={submit}
            >
              Post
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
