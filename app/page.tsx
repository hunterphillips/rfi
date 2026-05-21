import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/app-header";
import { LinkButton } from "@/app/components/ui/button";
import { BrandMark } from "@/app/components/brand";
import { DraftListRow } from "./draft-list-row";
import type { DraftStatus } from "@/lib/types";

type DraftRow = {
  id: string;
  title: string | null;
  status: DraftStatus;
  updated_at: string;
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: draftsRaw } = await supabase
    .from("drafts")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .returns<DraftRow[]>();
  const drafts = draftsRaw ?? [];

  const stats = computeStats(drafts);

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <AppHeader userEmail={user?.email} />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-20 pt-12">
        {/* Page header */}
        <div className="rise rise-1 mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 font-display text-[10px] font-medium uppercase tracking-[0.32em] text-ink-3">
              Workspace
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Response drafts
            </h1>
            <p className="mt-2 max-w-md text-sm text-ink-3">
              Parse incoming RFIs, run the agent pipeline, review the output,
              and ship a polished response.
            </p>
          </div>
          <LinkButton href="/drafts/new" size="lg">
            <span className="mr-1 font-display tracking-wider">+</span>
            New draft
          </LinkButton>
        </div>

        {/* Stat strip */}
        {drafts.length > 0 && (
          <div className="rise rise-2 mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="In flight" value={stats.inFlight} accent="lime" />
            <Stat label="In review" value={stats.review} accent="warn" />
            <Stat label="Approved" value={stats.approved} accent="teal" />
          </div>
        )}

        {/* List */}
        {drafts.length > 0 ? (
          <ul className="rise rise-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-elev-1 backdrop-blur-sm">
            {drafts.map((d) => (
              <DraftListRow key={d.id} draft={d} />
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function computeStats(drafts: DraftRow[]) {
  const total = drafts.length;
  const inFlight = drafts.filter((d) =>
    ["parsed", "researching", "researched", "drafting"].includes(d.status),
  ).length;
  const review = drafts.filter((d) => d.status === "in_review").length;
  const approved = drafts.filter((d) => d.status === "approved").length;
  return { total, inFlight, review, approved };
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "lime" | "warn" | "teal";
}) {
  const accentColor =
    accent === "lime"
      ? "var(--color-lime)"
      : accent === "warn"
        ? "var(--color-warn)"
        : accent === "teal"
          ? "var(--color-teal)"
          : "var(--color-ink-3)";
  return (
    <div className="bg-elev-1 px-5 py-4">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-flex h-1.5 w-1.5 rounded-full"
          style={{ background: accentColor }}
        />
        <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
          {label}
        </span>
      </div>
      <div className="font-display text-2xl font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rise rise-3 relative overflow-hidden rounded-lg border border-line bg-elev-1 px-6 py-20 text-center">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(65,187,113,0.08),transparent_60%)]" />
      <div className="mx-auto mb-5 flex w-fit items-center justify-center rounded-full border border-line-2 bg-elev-2 p-4">
        <BrandMark size={32} />
      </div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
        No drafts yet
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">
        Paste an RFI&apos;s topics or upload the source document. The parser
        will pull discrete questions for you to confirm.
      </p>
      <LinkButton href="/drafts/new" size="md" className="mt-6">
        Start your first draft →
      </LinkButton>
    </div>
  );
}
