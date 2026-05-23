import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getDraftAccess } from "@/lib/auth/draft-access";
import { AppHeader } from "@/app/components/app-header";
import { ParsedView } from "./parsed-view";
import { ResearchRunner } from "./research-runner";
import { ResearchedView } from "./researched-view";
import { DraftRunner } from "./draft-runner";
import { ReadyView } from "./ready-view";
import type { Assignment, Comment, DraftRow, ViewerRole } from "@/lib/types";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: draft, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single<DraftRow>();

  if (error || !draft) notFound();

  const isReviewState =
    draft.status === "ready" ||
    draft.status === "in_review" ||
    draft.status === "approved";

  // Collaboration data (assignments / comments / viewer role) only matters in
  // the post-draft review states. Both queries are RLS-scoped to the viewer.
  let role: ViewerRole | null = null;
  let assignments: Assignment[] = [];
  let comments: Comment[] = [];
  let authorEmails: Record<string, string> = {};

  if (isReviewState) {
    const [access, assignRes, commentRes] = await Promise.all([
      getDraftAccess(id),
      supabase
        .from("assignments")
        .select("*")
        .eq("draft_id", id)
        .order("created_at", { ascending: true })
        .returns<Assignment[]>(),
      supabase
        .from("comments")
        .select("*")
        .eq("draft_id", id)
        .order("created_at", { ascending: true })
        .returns<Comment[]>(),
    ]);
    role = access?.role ?? null;
    assignments = assignRes.data ?? [];
    comments = commentRes.data ?? [];

    // Resolve commenter + assignee emails for display (service client lookup).
    const ids = [
      ...new Set([
        ...comments.map((c) => c.author_id),
        ...assignments
          .map((a) => a.assignee_user_id)
          .filter((x): x is string => Boolean(x)),
      ]),
    ];
    if (ids.length > 0) {
      const svc = createServiceClient();
      const { data: profiles } = await svc
        .from("profiles")
        .select("id, email")
        .in("id", ids)
        .returns<{ id: string; email: string | null }[]>();
      authorEmails = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.email ?? ""]),
      );
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <AppHeader userEmail={user?.email} />

      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-10">
        <div className="rise rise-1">
          {draft.status === "parsed" && <ParsedView draft={draft} />}
          {draft.status === "researching" && (
            <ResearchRunner draft={draft} autoStart={false} />
          )}
          {draft.status === "researched" && <ResearchedView draft={draft} />}
          {draft.status === "drafting" && (
            <DraftRunner draft={draft} autoStart={false} />
          )}
          {isReviewState && (
            <ReadyView
              draft={draft}
              role={role}
              currentUserId={user?.id ?? null}
              assignments={assignments}
              comments={comments}
              authorEmails={authorEmails}
            />
          )}
        </div>
      </main>
    </div>
  );
}
