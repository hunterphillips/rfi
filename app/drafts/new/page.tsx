import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/app/components/app-header";
import { Eyebrow } from "@/app/components/ui/card";
import { NewDraftForm } from "./new-draft-form";

export default async function NewDraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <AppHeader userEmail={user?.email} />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-12">
        <div className="rise rise-1 mb-8">
          <Eyebrow>Step 01 — Intake</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
            Start a new draft
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-3">
            Paste the RFI text or upload a document. The parser will extract
            discrete topics for you to confirm before research begins.
          </p>
        </div>

        <div className="rise rise-2">
          <NewDraftForm />
        </div>
      </main>
    </div>
  );
}
