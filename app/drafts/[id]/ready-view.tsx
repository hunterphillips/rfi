import type { DraftRow } from "@/lib/types";
import { QuestionCard } from "./question-card";
import { EditableTitle } from "./editable-title";
import { Eyebrow } from "@/app/components/ui/card";
import { StatusPill } from "@/app/components/ui/status-pill";

export function ReadyView({ draft }: { draft: DraftRow }) {
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

      <ol className="space-y-5">
        {draft.topics.map((q) => (
          <QuestionCard key={q.index} draftId={draft.id} question={q} />
        ))}
      </ol>
    </div>
  );
}
