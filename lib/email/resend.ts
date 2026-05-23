import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

const client = apiKey ? new Resend(apiKey) : null;

/** True only when both an API key and a verified sender address are set. */
export function emailConfigured(): boolean {
  return Boolean(client && fromEmail);
}

export type SendResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

/**
 * Send a transactional email. Degrades gracefully: when Resend isn't
 * configured (no API key, or RESEND_FROM_EMAIL unset because no domain is
 * verified yet) this logs and no-ops rather than throwing, so the surrounding
 * action still succeeds in dev. Never let email failure break a status change.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!client || !fromEmail) {
    console.warn(
      `[email] skipped (RESEND not configured) → to=${opts.to} subject="${opts.subject}"`,
    );
    return { ok: false, skipped: true };
  }
  try {
    const { error } = await client.emails.send({
      from: fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[email] send error", error);
      return { ok: false, skipped: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw", e);
    return {
      ok: false,
      skipped: false,
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
