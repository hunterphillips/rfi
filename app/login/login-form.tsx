"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "ok") {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-zinc-900 dark:text-zinc-50">
          Magic link sent to <span className="font-medium">{state.email}</span>.
        </p>
        <p className="mt-1 text-zinc-500">
          Check your inbox and click the link to sign in. The tab can be closed.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@integritypro.com"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
