"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { canReview, getDraftAccess } from "@/lib/auth/draft-access";
import { sendEmail } from "@/lib/email/resend";
import {
  approvedEmail,
  assignmentEmail,
  changesRequestedEmail,
} from "@/lib/email/templates";
import type { AssignmentRole } from "@/lib/types";

type Result = { ok: true } | { ok: false; message: string };

const COMMENTABLE = new Set(["ready", "in_review", "approved"]);

/** Look up an email's display address for a user id (best-effort, via profiles). */
async function ownerEmail(ownerId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("email")
    .eq("id", ownerId)
    .single<{ email: string | null }>();
  return data?.email ?? null;
}

// ── Assignment ───────────────────────────────────────────────────────────────

export async function assignReviewer(
  draftId: string,
  rawEmail: string,
  role: AssignmentRole,
): Promise<Result> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (role !== "reviewer" && role !== "editor") {
    return { ok: false, message: "Invalid role." };
  }

  const access = await getDraftAccess(draftId);
  if (!access) return { ok: false, message: "Draft not found." };
  if (access.role !== "owner") {
    return { ok: false, message: "Only the draft owner can assign reviewers." };
  }
  if (email === access.email?.toLowerCase()) {
    return { ok: false, message: "You can't assign the draft to yourself." };
  }
  if (access.status !== "ready" && access.status !== "in_review") {
    return {
      ok: false,
      message: `Reviewers can only be assigned once the draft is 'ready' (currently '${access.status}').`,
    };
  }

  const supabase = await createClient();
  const svc = createServiceClient();

  // Resolve to an existing user where possible (otherwise it's an email invite
  // matched at access-check time by auth.jwt() email).
  const { data: profile } = await svc
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle<{ id: string }>();

  // Reject a duplicate assignment for the same person + role.
  const { data: dupes } = await supabase
    .from("assignments")
    .select("id, assignee_email, assignee_user_id, role")
    .eq("draft_id", draftId)
    .eq("role", role);
  const already = (dupes ?? []).some(
    (a) =>
      a.assignee_email?.toLowerCase() === email ||
      (profile?.id && a.assignee_user_id === profile.id),
  );
  if (already) {
    return { ok: false, message: `Already assigned as ${role}.` };
  }

  const { error: insErr } = await supabase.from("assignments").insert({
    draft_id: draftId,
    role,
    assignee_email: email,
    assignee_user_id: profile?.id ?? null,
    assigned_by: access.userId,
    status: "pending",
  });
  if (insErr) return { ok: false, message: insErr.message };

  // First assignment moves the draft into review.
  if (access.status === "ready") {
    const { error: stErr } = await supabase
      .from("drafts")
      .update({ status: "in_review" })
      .eq("id", draftId);
    if (stErr) return { ok: false, message: stErr.message };
  }

  const { data: draftMeta } = await svc
    .from("drafts")
    .select("title")
    .eq("id", draftId)
    .single<{ title: string | null }>();
  const { subject, html } = assignmentEmail({
    draftId,
    draftTitle: draftMeta?.title ?? null,
    role,
    inviterEmail: access.email ?? "a teammate",
  });
  await sendEmail({ to: email, subject, html });

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

export async function removeAssignment(assignmentId: string): Promise<Result> {
  const supabase = await createClient();
  // RLS lets the owner read/delete; fetch draft_id first to authorize + revalidate.
  const { data: row, error: fetchErr } = await supabase
    .from("assignments")
    .select("draft_id")
    .eq("id", assignmentId)
    .single<{ draft_id: string }>();
  if (fetchErr || !row) {
    return { ok: false, message: fetchErr?.message ?? "Assignment not found." };
  }

  const access = await getDraftAccess(row.draft_id);
  if (!access || access.role !== "owner") {
    return { ok: false, message: "Only the draft owner can remove reviewers." };
  }

  const { error: delErr } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);
  if (delErr) return { ok: false, message: delErr.message };

  // If the last reviewer is removed mid-review, hand the draft back to the owner.
  const { count } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true })
    .eq("draft_id", row.draft_id);
  if ((count ?? 0) === 0 && access.status === "in_review") {
    await supabase
      .from("drafts")
      .update({ status: "ready" })
      .eq("id", row.draft_id);
  }

  revalidatePath(`/drafts/${row.draft_id}`);
  return { ok: true };
}

// ── Approval / request changes ────────────────────────────────────────────────

export async function approveDraft(draftId: string): Promise<Result> {
  const access = await getDraftAccess(draftId);
  if (!access) return { ok: false, message: "Draft not found." };
  if (!canReview(access.role)) {
    return { ok: false, message: "You don't have review access to this draft." };
  }
  if (access.status !== "in_review") {
    return {
      ok: false,
      message: `Only an 'in_review' draft can be approved (currently '${access.status}').`,
    };
  }

  // Service-role write — reviewer assignees are authorized above; RLS keeps
  // `drafts` UPDATE owner-only.
  const svc = createServiceClient();
  const { error } = await svc
    .from("drafts")
    .update({ status: "approved" })
    .eq("id", draftId);
  if (error) return { ok: false, message: error.message };

  if (access.role !== "owner") {
    const to = await ownerEmail(access.ownerId);
    if (to) {
      const { data: draftMeta } = await svc
        .from("drafts")
        .select("title")
        .eq("id", draftId)
        .single<{ title: string | null }>();
      const { subject, html } = approvedEmail({
        draftId,
        draftTitle: draftMeta?.title ?? null,
        reviewerEmail: access.email ?? "A reviewer",
      });
      await sendEmail({ to, subject, html });
    }
  }

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

export async function requestChanges(
  draftId: string,
  rawNote: string,
): Promise<Result> {
  const note = rawNote.trim() || null;
  const access = await getDraftAccess(draftId);
  if (!access) return { ok: false, message: "Draft not found." };
  if (!canReview(access.role)) {
    return { ok: false, message: "You don't have review access to this draft." };
  }
  if (access.status !== "in_review") {
    return {
      ok: false,
      message: `Changes can only be requested on an 'in_review' draft (currently '${access.status}').`,
    };
  }

  const svc = createServiceClient();
  const { error } = await svc
    .from("drafts")
    .update({ status: "ready" })
    .eq("id", draftId);
  if (error) return { ok: false, message: error.message };

  if (access.role !== "owner") {
    const to = await ownerEmail(access.ownerId);
    if (to) {
      const { data: draftMeta } = await svc
        .from("drafts")
        .select("title")
        .eq("id", draftId)
        .single<{ title: string | null }>();
      const { subject, html } = changesRequestedEmail({
        draftId,
        draftTitle: draftMeta?.title ?? null,
        reviewerEmail: access.email ?? "A reviewer",
        note,
      });
      await sendEmail({ to, subject, html });
    }
  }

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(
  draftId: string,
  topicIndex: number,
  rawBody: string,
): Promise<Result> {
  const body = rawBody.trim();
  if (!body) return { ok: false, message: "Comment can't be empty." };
  if (body.length > 4000) {
    return { ok: false, message: "Comment is too long (max 4000 chars)." };
  }

  const access = await getDraftAccess(draftId);
  if (!access || !access.role) {
    return { ok: false, message: "You don't have access to this draft." };
  }
  if (!COMMENTABLE.has(access.status)) {
    return {
      ok: false,
      message: `Comments are only available once the draft is drafted (currently '${access.status}').`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    draft_id: draftId,
    anchor_question_index: topicIndex,
    author_id: access.userId,
    body,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/drafts/${draftId}`);
  return { ok: true };
}

export async function setCommentResolved(
  commentId: string,
  resolved: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("comments")
    .select("draft_id")
    .eq("id", commentId)
    .single<{ draft_id: string }>();
  if (fetchErr || !row) {
    return { ok: false, message: fetchErr?.message ?? "Comment not found." };
  }

  // RLS restricts this to the comment author or the draft owner.
  const { error } = await supabase
    .from("comments")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/drafts/${row.draft_id}`);
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("comments")
    .select("draft_id")
    .eq("id", commentId)
    .single<{ draft_id: string }>();
  if (fetchErr || !row) {
    return { ok: false, message: fetchErr?.message ?? "Comment not found." };
  }

  // RLS restricts this to the comment author or the draft owner.
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/drafts/${row.draft_id}`);
  return { ok: true };
}
