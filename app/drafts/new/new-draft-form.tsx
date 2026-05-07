"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createDraft, type NewDraftState } from "./actions";

const initial: NewDraftState = { status: "idle" };

export function NewDraftForm() {
  const [state, action, pending] = useActionState(createDraft, initial);
  const [mode, setMode] = useState<"paste" | "upload">("paste");

  return (
    <form action={action} className="space-y-5">
      <div className="flex gap-2">
        <ModeButton
          active={mode === "paste"}
          onClick={() => setMode("paste")}
        >
          Paste text
        </ModeButton>
        <ModeButton
          active={mode === "upload"}
          onClick={() => setMode("upload")}
        >
          Upload file
        </ModeButton>
      </div>

      {mode === "paste" ? (
        <label className="block">
          <span className="sr-only">RFI text</span>
          <textarea
            name="pasted"
            rows={14}
            required={mode === "paste"}
            placeholder="Paste the RFI questions or topics here…"
            className="block w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
      ) : (
        <label className="block">
          <span className="block text-sm text-zinc-700 dark:text-zinc-300">
            RFI document (PDF, DOCX, TXT, MD — up to 2 MB)
          </span>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            required={mode === "upload"}
            className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
          />
        </label>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Parsing…" : "Continue"}
        </button>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }
    >
      {children}
    </button>
  );
}
