"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createDraft, type NewDraftState } from "./actions";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/input";
import { cn } from "@/lib/cn";

const initial: NewDraftState = { status: "idle" };

export function NewDraftForm() {
  const [state, action, pending] = useActionState(createDraft, initial);
  const [mode, setMode] = useState<"paste" | "upload">("paste");

  return (
    <form action={action} className="space-y-6">
      {/* Mode toggle */}
      <div
        role="tablist"
        className="inline-flex items-center gap-1 rounded-lg border border-line bg-elev-1 p-1"
      >
        <ModeTab active={mode === "paste"} onClick={() => setMode("paste")}>
          Paste text
        </ModeTab>
        <ModeTab active={mode === "upload"} onClick={() => setMode("upload")}>
          Upload file
        </ModeTab>
      </div>

      {/* Input surface */}
      {mode === "paste" ? (
        <div className="rounded-lg border border-line bg-elev-1/60 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
              RFI source · pasted
            </span>
            <span className="font-mono text-[10px] text-ink-4">
              plain text · markdown ok
            </span>
          </div>
          <Textarea
            name="pasted"
            rows={16}
            required
            placeholder="Paste the RFI topics here…&#10;&#10;e.g. 1. Describe your platform's approach to identity governance…"
            className="!border-0 !bg-transparent !ring-0 !shadow-none font-mono text-[13px] leading-relaxed focus:!ring-0"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line-3 bg-elev-1/40 px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-line-2 bg-elev-2">
            <UploadGlyph />
          </div>
          <p className="font-display text-sm font-medium text-ink">
            Upload an RFI document
          </p>
          <p className="mt-1 text-xs text-ink-3">
            PDF · DOCX · TXT · MD — up to 2 MB
          </p>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            required
            className={cn(
              "mt-5 block w-full max-w-md mx-auto text-xs text-ink-2",
              "file:mr-3 file:cursor-pointer file:rounded-md file:border-0",
              "file:bg-elev-3 file:px-3 file:py-2 file:font-display",
              "file:text-[11px] file:font-medium file:uppercase file:tracking-[0.12em] file:text-ink",
              "hover:file:bg-elev-2",
            )}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
        <Link
          href="/"
          className="font-display text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink"
        >
          ← Cancel
        </Link>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Parsing…" : "Continue → Parse"}
        </Button>
      </div>

      {state.status === "error" && (
        <p className="rounded-md border border-[rgba(224,123,123,0.3)] bg-[rgba(224,123,123,0.06)] px-3 py-2 text-xs text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

function ModeTab({
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 font-display text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
        active
          ? "bg-elev-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]"
          : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function UploadGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-2"
    >
      <path d="M3 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" />
      <path d="M5 6l3-3 3 3" />
      <path d="M8 3v8" />
    </svg>
  );
}
