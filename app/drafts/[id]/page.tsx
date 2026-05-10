import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/app-header";
import { ParsedView } from "./parsed-view";
import { ResearchRunner } from "./research-runner";
import { ResearchedView } from "./researched-view";
import { DraftRunner } from "./draft-runner";
import { ReadyView } from "./ready-view";
import type { DraftRow } from "@/lib/types";

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
          {(draft.status === "ready" ||
            draft.status === "in_review" ||
            draft.status === "approved") && <ReadyView draft={draft} />}
        </div>
      </main>
    </div>
  );
}
