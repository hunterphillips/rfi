import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { ParsedView } from "./parsed-view";
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
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            RFI
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">{user?.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {draft.status === "parsed" ? (
          <ParsedView draft={draft} />
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">
              Status:{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-900">
                {draft.status}
              </code>
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              UI for this state is not yet implemented.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
