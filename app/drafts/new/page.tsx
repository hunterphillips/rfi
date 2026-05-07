import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { NewDraftForm } from "./new-draft-form";

export default async function NewDraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          New draft
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Paste the RFI text or upload a document. The parser will extract
          discrete questions for you to confirm before drafting.
        </p>
        <NewDraftForm />
      </main>
    </div>
  );
}
