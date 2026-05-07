"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN =
  process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase() ?? "integritypro.com";

export type LoginState =
  | { status: "idle" }
  | { status: "ok"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return { status: "error", message: "Enter a valid email." };
  }

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return {
      status: "error",
      message: `Sign-in is restricted to @${ALLOWED_DOMAIN} addresses.`,
    };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host") ? `https://${h.get("host")}` : "http://localhost:3000");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return { status: "ok", email };
}
