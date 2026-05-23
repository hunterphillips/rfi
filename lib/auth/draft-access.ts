import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DraftStatus, ViewerRole } from "@/lib/types";

export type DraftAccess = {
  userId: string;
  email: string | null;
  ownerId: string;
  status: DraftStatus;
  // null only when the draft exists but the user is neither owner nor assignee
  // (RLS should already have hidden it, but we don't assume).
  role: ViewerRole | null;
};

/**
 * Resolve the current user's access to a draft. Owner wins; otherwise the
 * highest-privilege assignment (editor > reviewer) the user holds, matched by
 * user id or invited email. Returns null if there's no authenticated user or
 * the draft isn't visible to them.
 *
 * Reads use the RLS-scoped session client, so a non-owner only sees the draft
 * (and their own assignment rows) when policy permits — this never leaks.
 */
export async function getDraftAccess(
  draftId: string,
): Promise<DraftAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: draft } = await supabase
    .from("drafts")
    .select("owner_id, status")
    .eq("id", draftId)
    .single<{ owner_id: string; status: DraftStatus }>();
  if (!draft) return null;

  const base = {
    userId: user.id,
    email: user.email ?? null,
    ownerId: draft.owner_id,
    status: draft.status,
  };

  if (draft.owner_id === user.id) return { ...base, role: "owner" };

  // Assignment rows are visible to the assignee under RLS (by id or email).
  const { data: rows } = await supabase
    .from("assignments")
    .select("role")
    .eq("draft_id", draftId)
    .returns<{ role: "reviewer" | "editor" }[]>();

  const roles = new Set((rows ?? []).map((r) => r.role));
  if (roles.has("editor")) return { ...base, role: "editor" };
  if (roles.has("reviewer")) return { ...base, role: "reviewer" };
  return { ...base, role: null };
}

/** editor or owner — can mutate draft content. */
export function canEdit(role: ViewerRole | null): boolean {
  return role === "owner" || role === "editor";
}

/** reviewer, editor, or owner — can approve / request changes. */
export function canReview(role: ViewerRole | null): boolean {
  return role === "owner" || role === "editor" || role === "reviewer";
}
