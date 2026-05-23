import "server-only";
import type { AssignmentRole } from "@/lib/types";

// Link target for emails. Prefer an explicit app URL; fall back to the Vercel
// deployment URL, then the known prod host. (NEXT_PUBLIC_APP_URL is optional.)
function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "https://rfi-coral.vercel.app";
}

function draftLink(draftId: string): string {
  return `${appUrl()}/drafts/${draftId}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const FRAME = (inner: string) => `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5">
  <div style="font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#1d7a4a;margin-bottom:16px">RFX</div>
  ${inner}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <div style="font-size:12px;color:#9ca3af">Sent by RFX — IPC RFx response tooling.</div>
</div>`;

const BUTTON = (href: string, label: string) => `
<a href="${href}" style="display:inline-block;background:#1d7a4a;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;margin:8px 0">${label}</a>`;

type Email = { subject: string; html: string };

export function assignmentEmail(opts: {
  draftId: string;
  draftTitle: string | null;
  role: AssignmentRole;
  inviterEmail: string;
}): Email {
  const title = opts.draftTitle?.trim() || "an RFx response";
  const verb = opts.role === "editor" ? "edit and review" : "review";
  return {
    subject: `You've been assigned to ${verb} "${title}"`,
    html: FRAME(`
      <p style="font-size:15px;margin:0 0 12px">
        <strong>${escapeHtml(opts.inviterEmail)}</strong> assigned you as
        <strong>${opts.role}</strong> on <strong>${escapeHtml(title)}</strong>.
      </p>
      <p style="font-size:14px;color:#4b5563;margin:0 0 8px">
        You can ${verb} the draft and leave comments per topic.
      </p>
      ${BUTTON(draftLink(opts.draftId), "Open the draft →")}
    `),
  };
}

export function approvedEmail(opts: {
  draftId: string;
  draftTitle: string | null;
  reviewerEmail: string;
}): Email {
  const title = opts.draftTitle?.trim() || "an RFx response";
  return {
    subject: `"${title}" was approved`,
    html: FRAME(`
      <p style="font-size:15px;margin:0 0 12px">
        <strong>${escapeHtml(opts.reviewerEmail)}</strong> approved
        <strong>${escapeHtml(title)}</strong>.
      </p>
      ${BUTTON(draftLink(opts.draftId), "View the draft →")}
    `),
  };
}

export function changesRequestedEmail(opts: {
  draftId: string;
  draftTitle: string | null;
  reviewerEmail: string;
  note: string | null;
}): Email {
  const title = opts.draftTitle?.trim() || "an RFx response";
  const noteBlock = opts.note?.trim()
    ? `<blockquote style="border-left:3px solid #e5e7eb;margin:12px 0;padding:4px 0 4px 14px;color:#4b5563;font-size:14px">${escapeHtml(opts.note.trim())}</blockquote>`
    : "";
  return {
    subject: `Changes requested on "${title}"`,
    html: FRAME(`
      <p style="font-size:15px;margin:0 0 12px">
        <strong>${escapeHtml(opts.reviewerEmail)}</strong> requested changes on
        <strong>${escapeHtml(title)}</strong>. It's back in your queue to edit.
      </p>
      ${noteBlock}
      ${BUTTON(draftLink(opts.draftId), "Open the draft →")}
    `),
  };
}
