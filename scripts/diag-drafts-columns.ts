// Run with:  pnpm dlx tsx --env-file=.env.local scripts/diag-drafts-columns.ts
// Service-role check of drafts column list.
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.from("drafts").select("*").limit(1);
  if (error) {
    console.error("✗ select * failed:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.log("(no rows; falling back to empty insert echo)");
    return;
  }
  console.log("drafts row columns:");
  for (const k of Object.keys(data[0]).sort()) {
    console.log(`  ${k}`);
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
