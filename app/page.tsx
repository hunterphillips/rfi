import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

type DraftRow = {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guarantees user is authenticated.
  const { data: drafts } = await supabase
    .from("drafts")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false })
    .returns<DraftRow[]>();

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            RFI
          </h1>
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Your drafts
          </h2>
          <Link
            href="/drafts/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New draft
          </Link>
        </div>

        {drafts && drafts.length > 0 ? (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/drafts/${d.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex flex-col">
                    <span className="text-zinc-900 dark:text-zinc-50">
                      {d.title ?? "Untitled draft"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Updated {new Date(d.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-zinc-500">
                    {d.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
            <p className="text-zinc-600 dark:text-zinc-400">No drafts yet.</p>
            <Link
              href="/drafts/new"
              className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              Start a new RFI →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
