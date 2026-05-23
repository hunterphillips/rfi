import type { Assignment, Comment, DraftRow, ViewerRole } from "@/lib/types";
import { QuestionCard } from "./question-card";
import { ReviewPanel } from "./review-panel";
import { EditableTitle } from "./editable-title";
import { Eyebrow } from "@/app/components/ui/card";
import { StatusPill } from "@/app/components/ui/status-pill";

export function ReadyView({
  draft,
  role,
  currentUserId,
  assignments,
  comments,
  authorEmails,
}: {
  draft: DraftRow;
  role: ViewerRole | null;
  currentUserId: string | null;
  assignments: Assignment[];
  comments: Comment[];
  authorEmails: Record<string, string>;
}) {
  const isOwner = role === "owner";
  const canEditContent =
    (role === "owner" || role === "editor") && draft.status !== "approved";
  const canRegenerate = role === "owner" && draft.status !== "approved";

  // Bucket comments by anchored topic index (legacy column name).
  const byTopic = new Map<number, Comment[]>();
  for (const c of comments) {
    const arr = byTopic.get(c.anchor_question_index) ?? [];
    arr.push(c);
    byTopic.set(c.anchor_question_index, arr);
  }

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Eyebrow>Final response</Eyebrow>
          <StatusPill status={draft.status} />
        </div>
        <EditableTitle draftId={draft.id} initialTitle={draft.title} />
        <p className="text-sm text-ink-3">
          <span className="font-mono text-ink-2">{draft.topics.length}</span>{" "}
          topic{draft.topics.length === 1 ? "" : "s"} · review per-topic content
          and regenerate as needed.
        </p>
      </header>

      <ReviewPanel
        draftId={draft.id}
        status={draft.status}
        role={role}
        assignments={assignments}
      />

      <ol className="space-y-5">
        {draft.topics.map((q) => (
          <QuestionCard
            key={q.index}
            draftId={draft.id}
            question={q}
            canEditContent={canEditContent}
            canRegenerate={canRegenerate}
            isOwner={isOwner}
            currentUserId={currentUserId}
            comments={byTopic.get(q.index) ?? []}
            authorEmails={authorEmails}
          />
        ))}
      </ol>
    </div>
  );
}
