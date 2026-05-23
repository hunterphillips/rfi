"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveDraft,
  assignReviewer,
  removeAssignment,
  requestChanges,
} from "./collab-actions";
import { Button } from "@/app/components/ui/button";
import { Input, Textarea } from "@/app/components/ui/input";
import { Eyebrow } from "@/app/components/ui/card";
import { Pill } from "@/app/components/ui/pill";
import type {
  Assignment,
  AssignmentRole,
  DraftStatus,
  ViewerRole,
} from "@/lib/types";

export function ReviewPanel({
  draftId,
  status,
  role,
  assignments,
}: {
  draftId: string;
  status: DraftStatus;
  role: ViewerRole | null;
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOwner = role === "owner";
  const canReview = role === "owner" || role === "editor" || role === "reviewer";
  const inReview = status === "in_review";
  const approved = status === "approved";

  // Assign form (owner only).
  const [email, setEmail] = useState("");
  const [assignRole, setAssignRole] = useState<AssignmentRole>("reviewer");

  // Request-changes note.
  const [changesOpen, setChangesOpen] = useState(false);
  const [note, setNote] = useState("");

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

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-elev-1 p-5">
      <div className="absolute inset-x-0 top-0 h-px brand-gradient opacity-60" />
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Review &amp; approval</Eyebrow>
        {approved ? (
          <Pill tone="brand">Approved</Pill>
        ) : inReview ? (
          <Pill tone="info">In review</Pill>
        ) : (
          <Pill tone="neutral">Ready</Pill>
        )}
      </div>

      {/* Assignee list */}
      {assignments.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-elev-2 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="truncate font-mono text-[12px] text-ink-2">
                  {a.assignee_email ?? a.assignee_user_id}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Pill tone={a.role === "editor" ? "brand" : "neutral"}>
                  {a.role}
                </Pill>
                {isOwner && !approved && (
                  <button
                    type="button"
                    onClick={() => run(() => removeAssignment(a.id))}
                    disabled={busy}
                    className="font-mono text-[12px] text-ink-4 transition-colors hover:text-danger"
                    aria-label={`Remove ${a.assignee_email}`}
                  >
                    ×
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-3">
          {isOwner
            ? "No reviewers yet. Assign someone to move this into review."
            : "No reviewers assigned."}
        </p>
      )}

      {/* Assign form (owner, not yet approved) */}
      {isOwner && !approved && (
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block font-display text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">
              Assign by email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reviewer@integritypro.com"
              disabled={busy}
            />
          </div>
          <select
            value={assignRole}
            onChange={(e) => setAssignRole(e.target.value as AssignmentRole)}
            disabled={busy}
            className="h-10 rounded-md border border-line bg-elev-2 px-3 font-mono text-[13px] text-ink-2"
          >
            <option value="reviewer">reviewer</option>
            <option value="editor">editor</option>
          </select>
          <Button
            type="button"
            size="md"
            disabled={busy || !email.trim()}
            onClick={() =>
              run(async () => {
                const res = await assignReviewer(draftId, email, assignRole);
                if (res.ok) setEmail("");
                return res;
              })
            }
          >
            Assign
          </Button>
        </div>
      )}

      {/* Approve / request changes (in_review, any reviewer incl. owner) */}
      {inReview && canReview && (
        <div className="mt-4 border-t border-line pt-4">
          {!changesOpen ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setChangesOpen(true)}
              >
                Request changes
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => run(() => approveDraft(draftId))}
              >
                Approve →
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Eyebrow>What needs to change? (optional)</Eyebrow>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. Topic 03 overstates SLA coverage — tone it down and cite the source."
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setChangesOpen(false);
                    setNote("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const res = await requestChanges(draftId, note);
                      if (res.ok) {
                        setChangesOpen(false);
                        setNote("");
                      }
                      return res;
                    })
                  }
                >
                  Send back to owner
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
