import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DraftRow, TopicStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; index: string }>;
  },
) {
  const { id, index: indexStr } = await params;
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0) {
    return new Response("Bad topic index", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { approved?: boolean } = {};
  try {
    body = (await req.json()) as { approved?: boolean };
  } catch {
    // empty body — toggle.
  }

  const { data: draft, error: loadErr } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", id)
    .single<DraftRow>();
  if (loadErr || !draft) return new Response("Not found", { status: 404 });

  if (draft.status !== "researched") {
    return new Response(
      `Cannot toggle approval while draft status is "${draft.status}"`,
      { status: 409 },
    );
  }
  if (index >= draft.topics.length) {
    return new Response("Topic index out of range", { status: 400 });
  }

  const current = draft.topics[index].status;
  if (current !== "researched" && current !== "approved") {
    return new Response(
      `Topic is in status "${current}"; approve only available for researched topics`,
      { status: 409 },
    );
  }

  const target: TopicStatus =
    body.approved !== undefined
      ? body.approved
        ? "approved"
        : "researched"
      : current === "approved"
        ? "researched"
        : "approved";

  const next = draft.topics.map((t, i) =>
    i === index ? { ...t, status: target } : t,
  );

  const { error } = await supabase
    .from("drafts")
    .update({ topics: next })
    .eq("id", id);

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true, status: target });
}
