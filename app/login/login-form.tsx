"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";
import { Button } from "@/app/components/ui/button";
import { Input, Label } from "@/app/components/ui/input";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "ok") {
    return (
      <div className="rounded-lg border border-line bg-elev-1 p-5 text-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
          <span className="font-display text-[10px] font-medium uppercase tracking-[0.18em] text-accent">
            Link dispatched
          </span>
        </div>
        <p className="text-ink">
          Sent to{" "}
          <span className="font-mono text-ink-2">{state.email}</span>.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          Open the link from your inbox to sign in. You may close this tab.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@integritypro.com"
        />
      </div>

      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="w-full"
      >
        {pending ? "Sending…" : "Send magic link →"}
      </Button>

      {state.status === "error" && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
